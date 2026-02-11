// api/raid-events.js
export default async function handler(req, res) {
  const RAID_HELPER_API_KEY = process.env.RAID_HELPER_API_KEY;

  if (!RAID_HELPER_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Personal API Key endpoint (Authorization header gereksiz)
    const response = await fetch(
      `https://raid-helper.dev/api/v3/users/${RAID_HELPER_API_KEY}/events`
    );

    if (!response.ok) {
      console.error('[Raid-Helper] API response not OK:', response.status);
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
    
    // En yakın event'i bul (gelecekteki, en yakın tarihli)
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

    // CORS header'ları
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300'); // 5 dakika cache

    res.status(200).json({ event: closestEvent });
  } catch (error) {
    console.error('[Raid-Helper] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch events',
      details: error.message 
    });
  }
}
