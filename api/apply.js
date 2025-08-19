// /api/apply.js  (Vercel Serverless - CommonJS)
// Bu endpoint client'tan gelen başvuruyu Discord Webhook'a iletir.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const {
      character = '', realm = '', btag = '',
      classes = [], roles = [],
      rio = '', wcl = '', availability = '', notes = '',
      consent = false,
      website = '', // honeypot
      meta = {}
    } = body;

    // Bot tuzağı: doldurulduysa sükunetle OK dön
    if (website) { res.status(200).json({ ok: true }); return; }

    // Zorunlu alanlar (senin isteğine göre RIO/WCL dahil)
    if (!character || !realm || !btag || !availability || !rio || !wcl) {
      res.status(400).json({ ok: false, error: 'Missing required fields' });
      return;
    }
    // İsteğe bağlı: consent zorunlu kılmak istersen aç:
    if (!consent) {
      res.status(400).json({ ok: false, error: 'Consent is required' });
      return;
    }

    // URL kontrolü
    const isUrl = (u) => { try { new URL(u); return true; } catch { return false; } };
    if (!isUrl(rio) || !isUrl(wcl)) {
      res.status(400).json({ ok: false, error: 'Invalid URL' });
      return;
    }

    // Discord mesajını hazırla (embed'li)
    const embed = {
      title: `${character} @ ${realm}`,
      description: notes || '—',
      color: 0xF39C12,
      fields: [
        { name: 'BattleTag', value: btag, inline: true },
        { name: 'Classes', value: classes.length ? classes.join(', ') : '—', inline: true },
        { name: 'Roles', value: roles.length ? roles.join(', ') : '—', inline: true },
        { name: 'Availability', value: availability || '—', inline: false },
        { name: 'Raider.IO', value: rio, inline: false },
        { name: 'Warcraft Logs', value: wcl, inline: false },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'TWWMP Apply' }
    };

    const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
    if (!WEBHOOK) {
      res.status(500).json({ ok:false, error:'Missing DISCORD_WEBHOOK_URL' });
      return;
    }

    // Discord'a gönder
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**New Guild Application** — ${character} @ ${realm}\n${meta?.ts ? `Submitted: ${meta.ts}` : ''}`,
        embeds: [embed]
      })
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('apply api error:', err);
    res.status(500).json({ ok: false, error: 'Unexpected error' });
  }
};
