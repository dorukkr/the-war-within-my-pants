// /api/apply.js — Vercel Serverless (CommonJS)
// - Cloudflare Turnstile verification (timeout’lu)
// - Discord Webhook send
// - content+embeds GELSE BİLE kritik alanları (rio/wcl/discord/consent vb.) backend'de doğrular
// - Officers rolünü mentionlar (OFFICERS_ROLE_ID)
// - Honeypot (website) desteği

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const WEBHOOK   = process.env.DISCORD_WEBHOOK_URL;
    const CF_SECRET = process.env.CF_TURNSTILE_SECRET;
    const ROLE_ID   = process.env.OFFICERS_ROLE_ID || "";

    if (!WEBHOOK || !CF_SECRET) {
      res.status(500).json({ ok: false, error: "Server not configured" });
      return;
    }

    // Body güvenli parse
    let bodyRaw = req.body;
    if (typeof bodyRaw === "string") {
      try { bodyRaw = JSON.parse(bodyRaw); } catch {}
    }
    const body = bodyRaw || {};

    // Honeypot (bot) — Turnstile'a bile gitmeden sessizce OK dön
    if (body.website) { res.status(200).json({ ok: true }); return; }

    // ============= 1) Turnstile verify =============
    const turnstileToken =
      body.turnstileToken ||
      body["cf-turnstile-response"] || // fallback
      "";
    if (!turnstileToken) {
      res.status(400).json({ ok: false, error: "Missing Turnstile token" });
      return;
    }

    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();

    // timeout'lu verify
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let verify;
    try {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: CF_SECRET,
          response: String(turnstileToken),
          ...(ip ? { remoteip: ip } : {})
        }),
        signal: ctrl.signal
      });
      clearTimeout(t);
      verify = await verifyRes.json();
    } catch (e) {
      clearTimeout(t);
      res.status(502).json({ ok: false, error: "Turnstile verification network error" });
      return;
    }

    if (!verify || !verify.success) {
      res.status(400).json({
        ok: false,
        error: "Turnstile verification failed",
        details: (verify && verify["error-codes"]) || []
      });
      return;
    }

    // ============= 2) Alanları topla/normalize et =============
    const {
      character = '',
      realm = '',
      btag = '',
      classes = [],
      roles = [],
      rio = '',
      wcl = '',
      availability = '',
      notes = '',
      consent = false,
      discord = '',                 // kullanıcıdan gelen raw değer (@toxarica / <@id> / 123.. / toxarica)
      discord_id_guess = null,      // client normalize tahmini
      discord_username_guess = null,
      meta = {}
    } = body;

    // URL kontrol fonksiyonu
    const isUrl = (u) => { try { const url = new URL(u); return /^https?:/i.test(url.protocol); } catch { return false; } };

    // ZORUNLU KONTROL (embed gelse bile server tarafında enforce ediyoruz)
    if (!character || !realm || !btag || !availability || !rio || !wcl || !discord) {
      res.status(400).json({ ok: false, error: "Missing required fields" });
      return;
    }
    if (!isUrl(rio) || !isUrl(wcl)) {
      res.status(400).json({ ok: false, error: "Invalid URL" });
      return;
    }
    if (!consent) {
      res.status(400).json({ ok: false, error: "Consent is required" });
      return;
    }

    // Discord alanını embed’e yazmak için gösterim değeri oluştur
    // (ID varsa <@ID> şeklinde, yoksa @username, o da yoksa raw string)
    const discordFieldValue =
      (discord_id_guess && String(discord_id_guess).match(/^\d{15,25}$/))
        ? `<@${discord_id_guess}>`
        : (discord && /<@!?\d{15,25}>/.test(discord))
          ? discord
          : (discord_username_guess ? `@${discord_username_guess}` : String(discord));

    // ============= 3) Mesaj/Embed inşa et =============
    let content = body.content;
    let embeds  = body.embeds;

    // Client embed gönderdiyse: Discord alanı yoksa ekle / boşsa doldur
    if (embeds && Array.isArray(embeds) && embeds[0]) {
      const e0 = embeds[0];
      // fields array'i yoksa oluştur
      if (!Array.isArray(e0.fields)) e0.fields = [];

      // "Discord" alanını bul
      let dcField = e0.fields.find(f => (f.name || "").toLowerCase() === "discord");
      if (!dcField) {
        e0.fields.push({ name: "Discord", value: discordFieldValue, inline: false });
      } else {
        // varsa ama boşsa doldur
        if (!String(dcField.value || "").trim()) {
          dcField.value = discordFieldValue;
        }
      }

      // (Opsiyonel) Başlık yoksa oluşturalım
      if (!e0.title) e0.title = `${character} @ ${realm}`;

      // (Opsiyonel) Footer yoksa set edelim
      if (!e0.footer || !e0.footer.text) e0.footer = { text: "TWWMP Apply" };

      // (Opsiyonel) RIO/WCL alanları eksikse ekleyelim
      const hasRio = e0.fields.some(f => (f.name || "").toLowerCase().includes("raider.io"));
      const hasWcl = e0.fields.some(f => (f.name || "").toLowerCase().includes("warcraft logs"));
      if (!hasRio) e0.fields.push({ name: "Raider.IO", value: rio, inline: false });
      if (!hasWcl) e0.fields.push({ name: "Warcraft Logs", value: wcl, inline: false });

      // İçerik yoksa default content
      if (!content) {
        content = `**New Guild Application** — ${character} @ ${realm}${meta?.ts ? `\nSubmitted: ${meta.ts}` : ""}`;
      }
    } else {
      // Legacy payload'tan embed üret
      content = `**New Guild Application** — ${character} @ ${realm}${meta?.ts ? `\nSubmitted: ${meta.ts}` : ""}`;
      embeds = [
        {
          title: `${character} @ ${realm}`,
          description: notes || "—",
          color: 0xF39C12,
          fields: [
            { name: "BattleTag",     value: btag, inline: true },
            { name: "Classes",       value: classes.length ? classes.join(", ") : "—", inline: true },
            { name: "Roles",         value: roles.length ? roles.join(", ") : "—", inline: true },
            { name: "Availability",  value: availability || "—", inline: false },
            { name: "Raider.IO",     value: rio, inline: false },
            { name: "Warcraft Logs", value: wcl, inline: false },
            { name: "Discord",       value: discordFieldValue || "—", inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "TWWMP Apply" }
        }
      ];
    }

    // ============= 4) Role mention + allowed_mentions =============
    const messagePayload = {
      content: `${ROLE_ID ? `<@&${ROLE_ID}> ` : ""}${content || "New application"}`,
      embeds: Array.isArray(embeds) ? embeds : [],
      allowed_mentions: ROLE_ID ? { parse: [], roles: [String(ROLE_ID)] } : { parse: [] }
    };

    // ============= 5) Send to Discord =============
    const discordResp = await fetch(WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TWWMP-Apply/1.0"
      },
      body: JSON.stringify(messagePayload)
    });

    if (!discordResp.ok) {
      const txt = await discordResp.text().catch(() => "");
      res.status(502).json({ ok: false, error: "Discord webhook failed", details: txt });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("apply api error:", err);
    res.status(500).json({ ok: false, error: "Unexpected server error" });
  }
};
