// /api/apply.js — Vercel Serverless (CommonJS)
// - Cloudflare Turnstile verification
// - Discord Webhook send
// - Supports both new (content+embeds) and legacy field payloads
// - Mentions officers role via OFFICERS_ROLE_ID env

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

    const body = req.body || {};

    // 1) Turnstile token (client: apply.html -> turnstileToken)
    const turnstileToken =
      body.turnstileToken ||
      body["cf-turnstile-response"] || // fallback
      "";
    if (!turnstileToken) {
      res.status(400).json({ ok: false, error: "Missing Turnstile token" });
      return;
    }

    // Optional: client IP for verification
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();

    // 2) Verify Turnstile
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: CF_SECRET,
        response: String(turnstileToken),
        ...(ip ? { remoteip: ip } : {})
      })
    });
    const verify = await verifyRes.json();
    if (!verify.success) {
      res.status(400).json({
        ok: false,
        error: "Turnstile verification failed",
        details: verify["error-codes"] || []
      });
      return;
    }

    // 3) Build message (prefer content+embeds if provided)
    let content = body.content;
    let embeds  = body.embeds;

    // If no embeds provided, construct from legacy fields
    if (!embeds) {
      const {
        character = "", realm = "", btag = "",
        classes = [], roles = [],
        rio = "", wcl = "", availability = "", notes = "",
        consent = false,
        website = "", // honeypot
        meta = {}
      } = body;

      // Honeypot: if filled, quietly OK
      if (website) { res.status(200).json({ ok: true }); return; }

      // Required fields (incl. RIO/WCL)
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

      content = `**New Guild Application** — ${character} @ ${realm}${meta?.ts ? `\nSubmitted: ${meta.ts}` : ""}`;
      embeds = [
        {
          title: `${character} @ ${realm}`,
          description: notes || "—",
          color: 0xF39C12,
          fields: [
            { name: "BattleTag",  value: btag,                                   inline: true  },
            { name: "Class(es)",  value: classes.length ? classes.join(", ") : "—", inline: true  },
            { name: "Roles",      value: roles.length   ? roles.join(", ")   : "—", inline: true  },
            { name: "Availability", value: availability || "—",                 inline: false },
            { name: "Raider.IO",    value: rio,                                  inline: false },
            { name: "Warcraft Logs",value: wcl,                                  inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "TWWMP Apply" }
        }
      ];
    }

    // 4) Role mention + allowed_mentions to restrict pings
    const messagePayload = {
      content: `${ROLE_ID ? `<@&${ROLE_ID}> ` : ""}${content || "New application"}`,
      embeds: Array.isArray(embeds) ? embeds : [],
      allowed_mentions: ROLE_ID ? { parse: [], roles: [ROLE_ID] } : { parse: [] }
    };

    // 5) Send to Discord
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
