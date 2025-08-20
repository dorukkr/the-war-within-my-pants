// /api/apply.js — Vercel Serverless (CommonJS)
// - Cloudflare Turnstile verification
// - Discord Webhook send
// - Supports both new (content+embeds) and legacy field payloads
// - Mentions officers role via OFFICERS_ROLE_ID env
// - Ensures "Discord" field always exists
// - (Optional) Resolves @handle -> ID and writes as plain text (no mention)

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
        discord = "", // legacy: Discord handle
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
            { name: "BattleTag",    value: btag,                                      inline: true  },
            { name: "Discord",      value: normalizeHandle(discord) || "—",           inline: true  }, // always present
            { name: "Class(es)",    value: classes.length ? classes.join(", ") : "—", inline: true  },
            { name: "Roles",        value: roles.length   ? roles.join(", ")   : "—", inline: true  },
            { name: "Availability", value: availability || "—",                       inline: false },
            { name: "Raider.IO",    value: rio,                                       inline: false },
            { name: "Warcraft Logs",value: wcl,                                       inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "TWWMP Apply" }
        }
      ];
    }

    // --- Always ensure 'Discord' field exists (plain text) & (optionally) enrich with ID ---
    (await (async function ensureDiscordFieldAndMaybeId() {
      if (!Array.isArray(embeds) || !embeds[0]) return;
      const emb = embeds[0];

      // Ensure fields array
      emb.fields = Array.isArray(emb.fields) ? emb.fields : [];

      // 1) ApplicantHandle from description (client yeni ise)
      let handleFromDesc = "";
      if (typeof emb.description === "string") {
        const m = emb.description.match(/ApplicantHandle:(@[^\s]+)/i);
        if (m) handleFromDesc = m[1];
      }

      // 2) Existing Discord field (if any)
      let idx = emb.fields.findIndex(f => String(f?.name || "").toLowerCase().includes("discord"));
      let discordVal = idx >= 0 ? String(emb.fields[idx].value || "").trim() : "";

      // 3) Legacy body fallback
      const rawFromBody = (typeof (body?.discord) === "string") ? body.discord : "";

      // 4) Decide final handle
      let finalHandle = handleFromDesc || discordVal || rawFromBody || "";
      finalHandle = normalizeHandle(finalHandle); // -> "@toxarica"

      // 5) Optional: try to resolve ID (no mention), only if env present
      const BOT_TOKEN = process.env.DISCORD_TOKEN;
      const GUILD_ID  = process.env.DISCORD_GUILD_ID;
      let discordId   = null;

      if (BOT_TOKEN && GUILD_ID && finalHandle) {
        discordId = await resolveDiscordId({ handle: finalHandle, guildId: GUILD_ID, botToken: BOT_TOKEN });
      }

      // 6) Write back as plain text
      const newValue = finalHandle ? (discordId ? `${finalHandle} • ID: ${discordId}` : finalHandle) : "—";
      if (idx >= 0) emb.fields[idx].value = newValue;
      else emb.fields.push({ name: "Discord", value: newValue, inline: true });
    })());

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

// ---------- helpers ----------

function normalizeHandle(raw) {
  if (!raw) return "";
  let h = String(raw).trim().replace(/\s+/g, " ");
  h = h.replace(/^@+/, "@").replace(/\s*@+\s*/g, "@");
  if (h && !h.startsWith("@")) h = "@" + h;
  return h;
}

// @handle -> id (Discord Guild Member Search; plain text only)
async function resolveDiscordId({ handle, guildId, botToken }) {
  try {
    // 1) mention format? <@123...> / <@!123...>
    const m = String(handle).match(/<@!?(\d{17,20})>/);
    if (m) return m[1];

    // 2) normalize
    let q = String(handle).trim();
    if (q.startsWith('@')) q = q.slice(1);

    // 3) discriminator form name#1234 (legacy)
    const discr = q.match(/^(.+?)#(\d{4})$/);
    const query = discr ? discr[1] : q;

    // Discord API: members search
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=5`;
    const resp = await fetch(url, { headers: { Authorization: `Bot ${botToken}` }});
    if (!resp.ok) return null;

    const members = await resp.json(); // [{ user:{ id, username, global_name }, nick, ... }]

    const norm = s => (s || '').toLowerCase();
    const h = norm(q);
    const keys = (m) => [norm(m.user?.global_name), norm(m.user?.username), norm(m.nick)];

    // exact -> startswith -> contains
    let cand = members.find(m => keys(m).includes(h))
           || members.find(m => keys(m).some(k => k && k.startsWith(h)))
           || members.find(m => keys(m).some(k => k && k.includes(h)));

    // discriminator varsa (#1234)
    if (!cand && discr) {
      const d4 = discr[2];
      cand = members.find(m => String(m.user?.discriminator || '') === d4);
    }

    return cand?.user?.id ? String(cand.user.id) : null;
  } catch {
    return null;
  }
}
