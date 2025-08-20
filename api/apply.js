// /api/apply.js — Vercel Serverless (CommonJS)
// - Cloudflare Turnstile verification (timeout’lu, detaylı hata)
// - Discord Webhook send (detaylı hata)
// - content+embeds veya legacy alanlardan embed üretir
// - Officers rol mention (env: OFFICERS_ROLE_ID)
// - DEBUG: Vercel env DEBUG_MODE=1 (veya ?debug=1) ile Discord’a göndermeden debug çıktısı döner

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // ---- Config / ENV
  const WEBHOOK   = process.env.DISCORD_WEBHOOK_URL;
  const CF_SECRET = process.env.CF_TURNSTILE_SECRET;
  const ROLE_ID   = process.env.OFFICERS_ROLE_ID || "";
  const DEBUG     = process.env.DEBUG_MODE === "1" || req.query?.debug === "1";

  // ---- Body güvenli parse
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // ---- Hızlı env kontrol
  if (!WEBHOOK || !CF_SECRET) {
    return res.status(500).json({
      ok: false,
      stage: "env",
      error: "Server not configured",
      missing: {
        DISCORD_WEBHOOK_URL: !WEBHOOK,
        CF_TURNSTILE_SECRET: !CF_SECRET
      }
    });
  }

  // ---- 1) Turnstile token
  const turnstileToken =
    body.turnstileToken ||
    body["cf-turnstile-response"] ||
    "";

  if (!turnstileToken) {
    return res.status(400).json({
      ok: false,
      stage: "turnstile",
      error: "Missing Turnstile token"
    });
  }

  // İstemci IP (opsiyonel)
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();

  // ---- 2) Turnstile verify (timeout’lu)
  let verify;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);

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

    clearTimeout(timeout);
    verify = await verifyRes.json();
  } catch (e) {
    return res.status(502).json({
      ok: false,
      stage: "turnstile",
      error: "Turnstile verification network error",
      details: String(e)
    });
  }

  if (!verify?.success) {
    return res.status(400).json({
      ok: false,
      stage: "turnstile",
      error: "Turnstile verification failed",
      details: verify?.["error-codes"] || []
    });
  }

  // ---- 3) Mesajı kur (öncelik: content+embeds)
  let { content, embeds } = body;

  // content+embeds gelmişse Discord alanı boş mu kontrol et
  if (embeds && Array.isArray(embeds) && embeds[0] && Array.isArray(embeds[0].fields)) {
    const dcField = embeds[0].fields.find(f => (f.name || "").toLowerCase() === "discord");
    if (!dcField || !String(dcField.value || "").trim()) {
      return res.status(400).json({ ok: false, stage: "validation", error: "Discord handle is required in embed" });
    }
  }

  // Legacy alandan embed üret
  if (!embeds) {
    const {
      character = "", realm = "", btag = "",
      classes = [], roles = [],
      rio = "", wcl = "", availability = "", notes = "",
      consent = false, website = "", meta = {},
      discord = ""
    } = body;

    // Honeypot doluysa sessiz OK
    if (website) return res.status(200).json({ ok: true });

    const isUrl = (u) => { try { new URL(u); return true; } catch { return false; } };
    if (!character || !realm || !btag || !availability || !rio || !wcl || !discord) {
      return res.status(400).json({
        ok: false, stage: "validation", error: "Missing required fields"
      });
    }
    if (!isUrl(rio) || !isUrl(wcl)) {
      return res.status(400).json({ ok: false, stage: "validation", error: "Invalid URL" });
    }
    if (!consent) {
      return res.status(400).json({ ok: false, stage: "validation", error: "Consent is required" });
    }

    content = `**New Guild Application** — ${character} @ ${realm}${meta?.ts ? `\nSubmitted: ${meta.ts}` : ""}`;
    embeds = [{
      title: `${character} @ ${realm}`,
      description: notes || "—",
      color: 0xF39C12,
      fields: [
        { name: "BattleTag", value: btag, inline: true },
        { name: "Classes", value: classes.length ? classes.join(", ") : "—", inline: true },
        { name: "Roles", value: roles.length ? roles.join(", ") : "—", inline: true },
        { name: "Availability", value: availability || "—", inline: false },
        { name: "Raider.IO", value: rio, inline: false },
        { name: "Warcraft Logs", value: wcl, inline: false },
        { name: "Discord", value: discord || "—", inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "TWWMP Apply" }
    }];
  }

  // ---- 4) Discord payload
  const payload = {
    content: `${ROLE_ID ? `<@&${ROLE_ID}> ` : ""}${content || "New application"}`,
    embeds: Array.isArray(embeds) ? embeds : [],
    allowed_mentions: ROLE_ID ? { parse: [], roles: [String(ROLE_ID)] } : { parse: [] }
  };

  // ---- DEBUG MODE: Göndermeden önce payload’ı geri döndür
  if (DEBUG) {
    return res.status(200).json({
      ok: true,
      stage: "debug-ready",
      note: "DEBUG_MODE aktif: Discord’a gönderilmedi.",
      payload
    });
  }

  // ---- 5) Discord’a gönder
  let discordText = "";
  try {
    const discordResp = await fetch(WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TWWMP-Apply/1.0"
      },
      body: JSON.stringify(payload)
    });

    discordText = await discordResp.text().catch(() => "");

    if (!discordResp.ok) {
      return res.status(502).json({
        ok: false,
        stage: "discord",
        error: "Discord webhook failed",
        details: discordText.slice(0, 500)
      });
    }
  } catch (e) {
    return res.status(502).json({
      ok: false,
      stage: "discord",
      error: "Discord fetch threw",
      details: String(e)
    });
  }

  return res.status(200).json({ ok: true, stage: "done" });
};
