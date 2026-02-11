export default async function handler(req, res) {
  const RAID_HELPER_API_KEY = process.env.RAID_HELPER_API_KEY;
  const SERVER_ID = process.env.DISCORD_SERVER_ID;

  if (!RAID_HELPER_API_KEY || !SERVER_ID) {
    return res.status(500).json({ error: 'API key or Server ID not configured' });
  }

  try {
    // Server-wide events endpoint (tüm member'ların event'leri)
    const response = await fetch(
      `https://raid-helper.dev/api/v3/servers/${SERVER_ID}/events`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RAID_HELPER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Raid-Helper] API Error:', response.status, errorText);
      throw new Error(`Raid-Helper API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Raid-Helper] API response:', data);
    
    // Data validation
    if (!data.events || !Array.isArray(data.events)) {
      console.warn('[Raid-Helper] No events array found');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 's-maxage=300');
      return res.status(200).json({ event: null });
    }
    
    // En yakın event'i bul
    const now = new Date();
    const upcomingEvents = data.events
      .filter(event => new Date(event.start_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const closestEvent = upcomingEvents[0] || null;
    
    if (closestEvent) {
      console.log('[Raid-Helper] Closest event:', closestEvent.title);
    } else {
      console.log('[Raid-Helper] No upcoming events found');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json({ event: closestEvent });
  } catch (error) {
    console.error('[Raid-Helper] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch events',
      details: error.message 
    });
  }
}
