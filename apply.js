/* apply.js — client (Tarayıcı)
   - Zorunlu alan ve URL kontrolü (Discord alanı dahil)
   - Cloudflare Turnstile token kontrolü
   - Başarılı olursa /api/apply'a POST ve /thank-you yönlendirme
*/
(() => {
  const form = document.getElementById('applyForm');
  if (!form) return;

  const statusEl  = document.getElementById('applyStatus');
  const submitBtn = document.getElementById('applySubmit') || form.querySelector('button[type="submit"]');
  const capErrEl  = document.getElementById('captchaError');

  let turnstileToken = "";

  // Turnstile callback'leri
  window.onTurnstileSuccess = (token) => {
    turnstileToken = token || "";
    if (capErrEl) capErrEl.style.display = 'none';
  };
  window.onTurnstileError = () => {
    turnstileToken = "";
    if (capErrEl) capErrEl.style.display = 'inline';
  };
  window.onTurnstileExpired = () => {
    turnstileToken = "";
    if (capErrEl) capErrEl.style.display = 'inline';
  };

  const setStatus = (text, ok = false) => {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.color = ok ? '#4ade80' : '#ffd36b';
  };

  const getClasses = () => {
    const sel = form.querySelector('#class');
    if (!sel) return [];
    return Array.from(sel.selectedOptions).map(o => o.value);
  };

  const getRoles = () =>
    Array.from(form.querySelectorAll('input[name="role"]:checked')).map(x => x.value);

  const validURL = (v) => {
    try { new URL(v); return /^https?:/i.test(v); } catch { return false; }
  };

  // Discord girişi normalize et: mention/ID/username
  function normalizeDiscordInput(raw) {
    const s = (raw || '').trim();
    const m1 = s.match(/<@!?(\d{15,25})>/);      // <@123> / <@!123>
    if (m1) return { raw: s, id: m1[1], username: null };
    const m2 = s.match(/^(\d{15,25})$/);         // 123…
    if (m2) return { raw: s, id: m2[1], username: null };
    if (s.startsWith('@')) return { raw: s, id: null, username: s.slice(1) }; // @name
    return { raw: s, id: null, username: s || null };                          // düz yazı
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn && submitBtn.disabled) return;

    // Honeypot
    if (form.website && form.website.value.trim() !== "") return;

    // Zorunlu alanlar
    const character    = form.character?.value.trim();
    const realm        = form.realm?.value.trim();
    const btag         = form.btag?.value.trim();
    const rio          = form.rio?.value.trim();
    const wcl          = form.wcl?.value.trim();
    const availability = form.availability?.value.trim();
    const consent      = form.consent?.checked;
    const classes      = getClasses();
    const roles        = getRoles();
    const notes        = form.notes?.value.trim() || "";
    const discordRaw   = form.discord?.value.trim() || "";
    const discordNorm  = normalizeDiscordInput(discordRaw);

    if (!character || !realm || !btag || !availability || !rio || !wcl || !discordRaw) {
      setStatus("Please fill all required fields (Character, Realm, BattleTag, Availability, Raider.IO, Warcraft Logs, Discord).");
      return;
    }
    if (!validURL(rio) || !validURL(wcl)) {
      setStatus("Please provide valid URLs for Raider.IO and Warcraft Logs.");
      return;
    }
    if (!consent) {
      setStatus("Please agree to share your answers with the officers on Discord.");
      return;
    }
    if (!turnstileToken) {
      if (capErrEl) capErrEl.style.display = 'inline';
      setStatus("Please complete the verification.");
      return;
    }

    // UI kilitle
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = .7; }
    setStatus("Submitting…");

    const content = `**New Guild Application** — ${character} @ ${realm}`;
    const embed = {
      title: `${character} @ ${realm}`,
      description: notes || "—",
      color: 0xF39C12,
      fields: [
        { name: "BattleTag",       value: btag, inline: true },
        { name: "Class(es)",       value: (classes.length ? classes.join(", ") : "—"), inline: true },
        { name: "Roles",           value: (roles.length ? roles.join(", ") : "—"), inline: true },
        { name: "Availability",    value: availability || "—", inline: false },
        { name: "Raider.IO",       value: rio, inline: false },
        { name: "Warcraft Logs",   value: wcl, inline: false },
        // Embed içindeki mention ping yapmaz; bot results’ta pingleyecek.
        { name: "Discord",         value: discordNorm.id ? `<@${discordNorm.id}>`
                                                         : (discordNorm.username ? `@${discordNorm.username}` : discordRaw),
          inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "TWWMP Apply" }
    };

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken,
          character, realm, btag,
          classes, roles,
          rio, wcl, availability, notes,
          consent,
          discord: discordRaw,
          discord_id_guess: discordNorm.id || null,
          discord_username_guess: discordNorm.username || null,
          content,
          embeds: [embed],
          meta: { ts: new Date().toISOString() }
        })
      });

      // --- Detaylı hata gösterimi ---
      const ct = res.headers.get("content-type") || "";
      let payloadText = "";
      let payloadJson = null;
      try {
        if (ct.includes("application/json")) {
          payloadJson = await res.json();
          payloadText = JSON.stringify(payloadJson);
        } else {
          payloadText = await res.text();
        }
      } catch {
        // parse edilmeyen gövde
      }

      if (!res.ok) {
        const msgFromJson = payloadJson?.error || payloadJson?.message || "";
        const extra = Array.isArray(payloadJson?.details) && payloadJson.details.length
          ? ` — ${payloadJson.details.join(", ")}`
          : (!msgFromJson && payloadText ? ` — ${payloadText.slice(0, 300)}` : "");
        setStatus(`Submission failed (HTTP ${res.status})${msgFromJson ? `: ${msgFromJson}` : ""}${extra}`);
        // Konsola ham yanıtı dökelim:
        console.error("Apply API error:", { status: res.status, headers: Object.fromEntries(res.headers), body: payloadText });
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = 1; }
        if (window.turnstile) window.turnstile.reset();
        turnstileToken = "";
        return;
      }

      setStatus("Application received. Redirecting…", true);
      window.location.href = "/thank-you";
    } catch (err) {
      // gerçek network hatası / CORS / DNS vs.
      console.error("Apply fetch failed:", err);
      setStatus(`Network error: ${err?.message || err}`);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = 1; }
      if (window.turnstile) window.turnstile.reset();
      turnstileToken = "";
    }
  });
})();
