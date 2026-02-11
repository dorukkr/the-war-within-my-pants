// api/raid-events.js
export default async function handler(req, res) {
  const RAID_HELPER_API_KEY = process.env.RAID_HELPER_API_KEY;
  const SERVER_ID = process.env.DISCORD_SERVER_ID;

  try {
    const response = await fetch(
      `https://raid-helper.dev/api/v3/servers/${SERVER_ID}/events`,
      {
        headers: {
          'Authorization': `Bearer ${RAID_HELPER_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Raid-Helper API error');
    }

    const data = await response.json();
    
    // En yakın event'i bul (gelecekteki, en yakın tarihli)
    const now = new Date();
    const upcomingEvents = data.events
      .filter(event => new Date(event.start_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const closestEvent = upcomingEvents[0] || null;

    // CORS header'ları ekle
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300'); // 5 dakika cache

    res.status(200).json({ event: closestEvent });
  } catch (error) {
    console.error('Error fetching raid events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}
