(() => {
  const form = document.getElementById('applyForm');
  if (!form) return;

  const WEBHOOK_URL = "https://discord.com/api/webhooks/1407331789961297940/-xUYG37U297lCJSxm8-GkN2ukG3ta2utK3lnBaxtwm3Fh2_XMkACsAgxzCD-SAtSDZCC"; // your webhook

  const statusEl  = document.getElementById('applyStatus');
  const submitBtn = document.getElementById('applySubmit');

  function setStatus(text, ok=false){
    statusEl.textContent = text || '';
    statusEl.style.color = ok ? '#4ade80' : '#ffd36b';
  }

  function getRoles(){
    return Array.from(form.querySelectorAll('input[name="roles"]:checked')).map(x=>x.value);
  }

  function validURL(v){
    if (!v) return true;
    try { new URL(v); return true; } catch { return false; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if ((form.website && form.website.value.trim() !== "")) return; // honeypot

    const character = form.character.value.trim();
    const realm     = form.realm.value.trim();
    const btag      = form.btag.value.trim();
    const clazz     = form.clazz.value;
    const roles     = getRoles();
    const rio       = form.rio.value.trim();
    const wcl       = form.wcl.value.trim();
    const availability = form.availability.value.trim();
    const notes     = form.notes.value.trim();
    const consent   = form.consent.checked;

    if (!character || !realm || !btag || !clazz || roles.length===0 || !availability || !consent) {
      setStatus("Please fill in all required fields (*) and agree to the consent box.");
      return;
    }
    if (!validURL(rio) || !validURL(wcl)) {
      setStatus("Please provide valid URLs for Raider.IO / Warcraft Logs (or leave empty).");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.style.opacity = .7;
    setStatus("Submitting…");

    const content = `**New Guild Application** — ${character} @ ${realm}`;
    const embed = {
      title: `${character} @ ${realm}`,
      description: notes || "—",
      color: 0xF39C12,
      fields: [
        { name: "BattleTag", value: btag, inline: true },
        { name: "Class", value: clazz, inline: true },
        { name: "Roles", value: roles.join(", "), inline: true },
        { name: "Availability", value: availability || "—", inline: false },
        ...(rio ? [{ name: "Raider.IO", value: rio, inline: false }] : []),
        ...(wcl ? [{ name: "Warcraft Logs", value: wcl, inline: false }] : []),
      ],
      timestamp: new Date().toISOString(),
      footer: { text: "TWWMP Apply" }
    };

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, embeds: [embed] })
      });
      if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
      window.location.href = "thank-you.html";
    } catch (err) {
      console.error(err);
      setStatus("Submission failed. Please check the webhook URL or your connection.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.style.opacity = 1;
    }
  });
})();
