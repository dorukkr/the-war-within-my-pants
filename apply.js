/* apply.js — client (Tarayıcı)
   - Zorunlu alan ve URL kontrolü (Discord alanı dahil)
   - Cloudflare Turnstile token kontrolü
   - Başarılı olursa /api/apply'a POST ve /thank-you yönlendirme
*/
(() => {
  const form = document.getElementById('applyForm');
  if (!form) return;

  const statusEl  = document.getElementById('applyStatus');
  const submitBtn = document.getElementById('applySubmit');
  const capErrEl  = document.getElementById('captchaError');

  // Turnstile token'ı burada tutacağız
  let turnstileToken = "";

  // Turnstile callback'leri (HTML'de data-callback ile bağlı)
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
    try { new URL(v); return true; } catch { return false; }
  };

  // Discord girişi normalize et: mention/ID/username
  function normalizeDiscordInput(raw) {
    const s = (raw || '').trim();

    // <@123>, <@!123> -> ID
    const m1 = s.match(/<@!?(\d{15,25})>/);
    if (m1) return { raw: s, id: m1[1], username: null };

    // Sadece rakam (ID gibi)
    const m2 = s.match(/^(\d{15,25})$/);
    if (m2) return { raw: s, id: m2[1], username: null };

    // @username -> username
    if (s.startsWith('@')) return { raw: s, id: null, username: s.slice(1) };

    // düz yazılan username
    return { raw: s, id: null, username: s || null };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (submitBtn?.disabled) return; // çifte tıklamayı engelle

    // Honeypot (varsa)
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

    // Turnstile zorunlu
    if (!turnstileToken) {
      if (capErrEl) capErrEl.style.display = 'inline';
      setStatus("Please complete the verification.");
      return;
    }

    // UI kilitle
    submitBtn.disabled = true;
    submitBtn.style.opacity = .7;
    setStatus("Submitting…");

    // Discord'a gidecek embed (server proxy’si direkt forward ediyorsa)
    const content = `**New Guild Application** — ${character} @ ${realm}`;
    const embed = {
      title: `${character} @ ${realm}`,
      description: notes || "—",
      color: 0xF39C12,
      fields: [
        { name: "BattleTag",   value: btag, inline: true },
        { name: "Class(es)",   value: (classes.length ? classes.join(", ") : "—"), inline: true },
        { name: "Roles",       value: (roles.length ? roles.join(", ") : "—"), inline: true },
        { name: "Availability",value: availability || "—", inline: false },
        { name: "Raider.IO",   value: rio, inline: false },
        { name: "Warcraft Logs", value: wcl, inline: false },
        { name: "Discord",     value: discordNorm.id ? `<@${discordNorm.id}>` : (discordNorm.username ? `@${discordNorm.username}` : discordRaw), inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "TWWMP Apply" }
    };

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Cloudflare Turnstile
          turnstileToken,

          // Raw alanları da gönder (backend doğrulama / bot için işimize yarar)
          character, realm, btag,
          classes, roles,
          rio, wcl, availability, notes,
          consent,
          discord: discordRaw,
          discord_id_guess: discordNorm.id || null,
          discord_username_guess: discordNorm.username || null,

          // Webhook forward kullanıyorsan bunlar da kalsın:
          content,
          embeds: [embed],

          meta: { ts: new Date().toISOString() }
        })
      });
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);

      setStatus("Application received. Redirecting…", true);
      window.location.href = "/thank-you";
    } catch (err) {
      console.error(err);
      setStatus("Submission failed. Please try again later.");
      submitBtn.disabled = false;
      submitBtn.style.opacity = 1;
      // Tokeni sıfırla ki yeniden çözebilsin
      if (window.turnstile) window.turnstile.reset();
      turnstileToken = "";
    }
  });
})();
