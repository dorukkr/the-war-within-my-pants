/* apply.js — başvuru formunu Discord Webhook'a gönderir
   Görünen metinler: İngilizce, açıklamalar: Türkçe
*/
(() => {
  const form = document.getElementById('applyForm');
  if (!form) return;

  // TODO: Kendi webhook URL'ni buraya koy (Discord → Integrations → Webhooks)
  const WEBHOOK_URL = "https://discord.com/api/webhooks/XXXX/XXXX"; // <-- DEĞİŞTİR

  const statusEl  = document.getElementById('applyStatus');
  const submitBtn = document.getElementById('applySubmit');

  // — küçük yardımcılar —
  const setStatus = (text, ok=false) => {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.color = ok ? '#4ade80' : '#ffd36b';
  };
  const validURL = (v) => {
    if (!v) return true;
    try { new URL(v); return true; } catch { return false; }
  };
  const getRoles = () =>
    Array.from(form.querySelectorAll('input[name="roles"]:checked')).map(x=>x.value);

  // — form submit —
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot (bot yakalama)
    if ((form.website && form.website.value.trim() !== "")) return;

    // Alanları topla
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

    // Basit doğrulama
    if (!character || !realm || !btag || !clazz || roles.length===0 || !availability || !consent) {
      setStatus("Please fill in all required fields (*) and agree to the consent box.");
      return;
    }
    if (!validURL(rio) || !validURL(wcl)) {
      setStatus("Please provide valid URLs for Raider.IO / Warcraft Logs (or leave empty).");
      return;
    }

    // UI kilitle
    submitBtn.disabled = true;
    submitBtn.style.opacity = .7;
    setStatus("Submitting…");

    // Discord içeriği (embed'li, temiz ve okunaklı)
    const content = `**New Guild Application** — ${character} @ ${realm}`;
    const embed = {
      title: `${character} @ ${realm}`,
      description: notes || "—",
      color: 0xF39C12, // turuncu/gold
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
        // Webhook'a direkt embed gönderiyoruz
        body: JSON.stringify({ content, embeds: [embed] })
      });

      if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);

      // Başarılıysa teşekkür sayfasına yönlendir
      window.location.href = "thank-you.html";
    } catch (err) {
      console.error(err);
      setStatus("Submission failed. Please check the webhook URL or your connection.");
      submitBtn.disabled = false;
      submitBtn.style.opacity = 1;
    }
  });
})();
