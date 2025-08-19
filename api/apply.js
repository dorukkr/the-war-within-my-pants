// /api/apply.js — Vercel Serverless (CommonJS)
// - Cloudflare Turnstile doğrulaması
// - Discord Webhook'a iletim
// - Hem yeni "content+embeds" payload'ını, hem de eski alan bazlı payload'ı destekler

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
    const CF_SECRET = process.env.CF_TURNSTILE_SECRET;

    if (!WEBHOOK || !CF_SECRET) {
      res.status(500).json({ ok: false, error: "Server not configured" });
      return;
    }

    const body = req.body || {};

    // 1) Turnstile token (client tarafında apply.html -> turnstileToken gönderiyoruz)
    const turnstileToken =
      body.turnstileToken ||
      body["cf-turnstile-response"] || // fallback (form name default'u)
      "";

    if (!turnstileToken) {
      res.status(400).json({ ok: false, error: "Missing Turnstile token" });
      return;
    }

    // İstemci IP (opsiyonel ama önerilir)
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();

    // 2) Turnstile doğrulaması
    const verifyRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: CF_SECRET,
          response: String(turnstileToken),
          ...(ip ? { remoteip: ip } : {})
        })
      }
    );
    const verify = await verifyRes.json();

    if (!verify.success) {
      res.status(400).json({
        ok: false,
        error: "Turnstile verification failed",
        details: verify["error-codes"] || []
      });
      return;
    }

    // 3) Payload'ı hazırla
    let content = body.content;
    let embeds = body.embeds;

    // Eğer embed gelmemişse, eski alanları kullanarak embed oluştur
    if (!embeds) {
      const {
        character = "", realm = "", btag = "",
        classes = [], roles = [],
        rio = "", wcl = "", availability = "", notes = "",
        consent = false,
        website = "", // honeypot
        meta = {}
      } = body;

      // Honeypot: doluysa sessizce OK
      if (website) { res.status(200).json({ ok: true }); return; }

      // Zorunlu alanlar (RIO/WCL dahil)
      const isUrl = (u) => { try { new URL(u); return true; } catch { return false; } };
      if (!character || !realm || !btag || !availability || !rio || !wcl) {
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

      content = `**New Guild Application** — ${character} @ ${realm}\n${meta?.ts ? `Submitted: ${meta.ts}` : ""}`;
      embeds = [
        {
          title: `${character} @ ${realm}`,
          description: notes || "—",
          color: 0xF39C12,
          fields: [
            { name: "BattleTag", value: btag, inline: true },
            { name: "Class(es)", value: classes.length ? classes.join(", ") : "—", inline: true },
            { name: "Roles", value: roles.length ? roles.join(", ") : "—", inline: true },
            { name: "Availability", value: availability || "—", inline: false },
            { name: "Raider.IO", value: rio, inline: false },
            { name: "Warcraft Logs", value: wcl, inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "TWWMP Apply" }
        }
      ];
    }

    // 4) Discord'a gönder
    const discordResp = await fetch(WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TWWMP-Apply/1.0"
      },
      body: JSON.stringify({
        content: content || "New application",
        embeds: Array.isArray(embeds) ? embeds : []
      })
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
