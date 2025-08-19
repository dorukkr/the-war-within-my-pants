/* Apply form -> Discord Webhook */
(() => {
  const form = document.getElementById('applyForm');
  if (!form) return;

  // !!! BURAYA KENDİ WEBHOOK'UNU KOY !!!
  // Doğrudan webhook kullanırsan URL herkes tarafından görülebilir.
  // İstersen Vercel proxy ile gizleyebilirsin (aşağıda not var).
  const WEBHOOK_URL = "https://discord.com/api/webhooks/XXXXXXXX/XXXXXXXX"; // <- değiştir

  const statusEl  = document.getElementById('applyStatus');
  const submitBtn = document.getElementById('applySubmit');

  function setStatus(text, ok=false){
    if (!statusEl) return;
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

    // Honeypot
    if ((form.website && form.website.value.trim() !== "")) return;

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
      setStatus("Lütfen * zorunlu alanları doldurun ve onay kutusunu işaretleyin.");
      return;
    }
    if (!validURL(rio) || !validURL(wcl)) {
      setStatus("Lütfen geçerli bir Raider.IO / Warcraft Logs URL’si girin (veya boş bırakın).");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.style.opacity = .7;
    setStatus("Gönderiliyor…");

    const content = `**Yeni Guild Başvurusu** — ${character} @ ${realm}`;
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
      setStatus("Başvurun iletildi! Officer’lar en kısa sürede dönüş yapacak. ", true);
      form.reset();
      // İsteğe bağlı: basit bir “teşekkürler” anchor'ına kaydır
      // location.hash = "#apply";
    } catch (err) {
      console.error(err);
      setStatus("Gönderim başarısız oldu. Webhook URL’sini ve ağ bağlantını kontrol et.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.style.opacity = 1;
    }
  });
})();
