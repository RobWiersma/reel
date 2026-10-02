const { app } = require('@azure/functions');

// A search costs 100 of the 10,000 daily quota units (plus 1 for the details lookup),
// so repeat queries are cached for 10 minutes.
const cache = new Map();
const TTL = 10 * 60 * 1000;

const decode = (s = '') =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ISO 8601 duration (PT4M13S) to seconds
const seconds = (iso = '') => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
};

app.http('search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'search',
  handler: async (request) => {
    const q = (request.query.get('q') || '').trim().slice(0, 100);
    if (!q) return { status: 400, jsonBody: { error: 'Type something to search for.' } };

    const key = process.env.YOUTUBE_API_KEY;
    if (!key || key === 'PASTE_YOUR_KEY_HERE') {
      return { status: 500, jsonBody: { error: 'Search isn’t set up yet: add YOUTUBE_API_KEY to the API settings.' } };
    }

    const cacheKey = q.toLowerCase();
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL) return { jsonBody: hit.data };

    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.search = new URLSearchParams({
      part: 'snippet', type: 'video', videoCategoryId: '10', // Music
      videoEmbeddable: 'true', maxResults: '12', q, key,
    });

    const res = await fetch(url);
    if (!res.ok) {
      const quota = res.status === 403;
      return {
        status: 502,
        jsonBody: { error: quota ? 'Daily search limit reached. Try again tomorrow, or paste a link instead.' : 'YouTube search failed.' },
      };
    }
    const items = (await res.json()).items || [];

    // Second call (1 quota unit) for length and view counts. Search still works if it fails.
    const details = {};
    try {
      const u2 = new URL('https://www.googleapis.com/youtube/v3/videos');
      u2.search = new URLSearchParams({
        part: 'contentDetails,statistics', id: items.map((i) => i.id.videoId).join(','), key,
      });
      const r2 = await fetch(u2);
      if (r2.ok) {
        for (const v of (await r2.json()).items || []) {
          details[v.id] = { duration: seconds(v.contentDetails?.duration), views: Number(v.statistics?.viewCount) || 0 };
        }
      }
    } catch { /* keep going without details */ }

    const data = items.map((i) => ({
      id: i.id.videoId,
      title: decode(i.snippet.title),
      artist: decode(i.snippet.channelTitle),
      description: decode(i.snippet.description),
      published: i.snippet.publishedAt,
      duration: details[i.id.videoId]?.duration ?? 0,
      views: details[i.id.videoId]?.views ?? 0,
    }));
    cache.set(cacheKey, { at: Date.now(), data });
    return { jsonBody: data };
  },
});
