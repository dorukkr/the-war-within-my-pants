// apply.js (CLIENT - tarayıcı)
// Bu dosya form verisini toplayıp /api/apply'a POST eder.
// apply.html'deki validation başarılı olduktan sonra:
//    await window.__sendApplicationToDiscord();
// ardından thank-you.html'e yönlendirebilirsin.

(() => {
  const form = document.getElementById('applyForm');
  if (!form) return;

  const statusEl  = document.getElementById('applyStatus');
  const submitBtn = document.getElementById('applySubmit');

  function setStatus(text, ok = false) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.color = ok ? '#4ade80' : '#ffd36b';
  }

  async function postJSON(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let t = '';
      try { t = await res.text(); } catch {}
      throw new Error(`Submit failed: ${res.status} ${t}`.trim());
    }
    try { return await res.json(); } catch { return {}; }
  }

  // Validation script'in çağıracağı fonksiyon
  window.__sendApplicationToDiscord = async () => {
    // Honeypot (botlar website alanını doldurabiliyor)
    const website = form.website?.value?.trim() || '';

    const classes = Array.from(form.querySelector('#class')?.selectedOptions || [])
      .map(o => o.value);

    const roles = Array.from(form.querySelectorAll('input[name="role"]:checked'))
      .map(i => i.value);

    const payload = {
      character:    form.character?.value?.trim()     || '',
      realm:        form.realm?.value?.trim()         || '',
      btag:         form.btag?.value?.trim()          || '',
      classes,
      roles,
      rio:          form.rio?.value?.trim()           || '',
      wcl:          form.wcl?.value?.trim()           || '',
      availability: form.availability?.value?.trim()  || '',
      notes:        form.notes?.value?.trim()         || '',
      consent:      !!form.consent?.checked,
      website, // honeypot
      meta: { ua: navigator.userAgent, ts: new Date().toISOString() }
    };

    // UI kilitle
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = .7; }
    setStatus('Sending to Discord…');

    await postJSON('/api/apply', payload);

    setStatus('Sent!', true);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = 1; }
  };
})();
