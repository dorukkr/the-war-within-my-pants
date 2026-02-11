/* apply.js — client (Tarayıcı)
   - Zorunlu alan ve URL kontrolü
   - Cloudflare Turnstile token kontrolü
   - Başarılı olursa /api/apply'a POST ve /thank-you yönlendirme
   - Discord handle'ını (@name) embed field + ApplicantHandle etiketi olarak ekler
   - Legacy fallback için body.discord da gönderilir
*/
(() => {
  const form = document.getElementById('applyForm');
  if (!form) return;

  const statusEl  = document.getElementById('applyStatus');
  const submitBtn = document.getElementById('applySubmit');
  const capErrEl  = document.getElementById('captchaError');

  let turnstileToken = "";

  // Turnstile callbacks
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
  const checkboxes = form.querySelectorAll('input[name="class"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
};

  const getRoles = () =>
    Array.from(form.querySelectorAll('input[name="role"]:checked')).map(x => x.value);

  const validURL = (v) => {
    try { new URL(v); return true; } catch { return false; }
  };

  // Discord handle normalize (@ koy, boşlukları düzelt)
  const normalizeHandle = (raw) => {
    if (!raw) return "";
    let h = String(raw).trim().replace(/\s+/g, " ");
    h = h.replace(/^@+/, "@").replace(/\s*@+\s*/g, "@");
    if (!h.startsWith("@")) h = "@" + h;
    return h;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

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

    // Discord (zorunlu yapmıyoruz; varsa alıyoruz)
    const discordRaw   = form.discord?.value ?? "";
    const discordHandle = normalizeHandle(discordRaw);

    if (!character || !realm || !btag || !availability || !rio || !wcl) {
      setStatus("Please fill all required fields (Character, Realm, BattleTag, Availability, Raider.IO, Warcraft Logs).");
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
    submitBtn.disabled = true;
    submitBtn.style.opacity = .7;
    setStatus("Submitting…");

    const content = `**New Guild Application** — ${character} @ ${realm}`;
    const handleTag = discordHandle ? `\nApplicantHandle:${discordHandle}` : "";

    const embed = {
      title: `${character} @ ${realm}`,
      description: (notes || "—") + handleTag,
      color: 0xF39C12,
      fields: [
        { name: "BattleTag", value: btag, inline: true },
        { name: "Discord",   value: (discordHandle || "—"), inline: true },
        { name: "Class(es)", value: (classes.length ? classes.join(", ") : "—"), inline: true },
        { name: "Roles",     value: (roles.length ? roles.join(", ") : "—"), inline: true },
        { name: "Availability", value: availability || "—", inline: false },
        { name: "Raider.IO", value: rio, inline: false },
        { name: "Warcraft Logs", value: wcl, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "TWWMP Apply" }
    };

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Turnstile
          turnstileToken,
          // Modern payload
          content,
          embeds: [embed],
          // Legacy fallback (serverless embeds oluşturmaya dönerse)
          character, realm, btag,
          classes, roles,
          rio, wcl, availability, notes,
          consent,
          discord: discordHandle, // ← legacy için ayrıca gönder
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
