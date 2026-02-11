// api/raid-events.js
export default async function handler(req, res) {
  const RAID_HELPER_API_KEY = process.env.RAID_HELPER_API_KEY;

  // Personal API Key kullanırken Authorization header gereksiz
  // URL formatı: /api/v3/users/{API_KEY}/events
  
  try {
    const response = await fetch(
      `https://raid-helper.dev/api/v3/users/${RAID_HELPER_API_KEY}/events`
    );

    
    console.log('[Raid-Helper] Response status:', response.status);

    if (!response.ok) {
      throw new Error('Raid-Helper API error');
    }

       const data = await response.json();
    console.log('[Raid-Helper] Total events received:', data.events?.length || 0);
    
    // Data validation
    if (!data.events || !Array.isArray(data.events)) {
      console.warn('[Raid-Helper] No events array found in response');
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
      console.log('[Raid-Helper] Closest event:', closestEvent.title, '|', new Date(closestEvent.start_time));
    } else {
      console.log('[Raid-Helper] No upcoming events found');
    }

    // CORS header'ları ekle
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300'); // 5 dakika cache

    res.status(200).json({ event: closestEvent });
    } catch (error) {
    console.error('[Raid-Helper] Error fetching raid events:', error.message);
    console.error('[Raid-Helper] Full error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch events',
      details: error.message 
    });
  }
}
