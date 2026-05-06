import { upstash } from './_upstash.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sub = req.body;
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    const value = JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
    });
    try {
      await upstash(['SADD', 'awareness:subs', value]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Storage unavailable' });
    }
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    try {
      const all = await upstash(['SMEMBERS', 'awareness:subs']);
      const members = (all && all.result) || [];
      for (const m of members) {
        try {
          const parsed = JSON.parse(m);
          if (parsed.endpoint === endpoint) {
            await upstash(['SREM', 'awareness:subs', m]);
          }
        } catch (_) {}
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Storage unavailable' });
    }
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
