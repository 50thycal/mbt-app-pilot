import { upstash } from './_upstash.js';
import { logEvent } from './_log.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sub = req.body;
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      await logEvent('warn', 'subscribe rejected: invalid body');
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    const value = JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
    });
    try {
      await upstash(['SADD', 'awareness:subs', value]);
      await logEvent('info', 'subscribe stored', { endpoint: sub.endpoint.slice(0, 80) });
      return res.status(200).json({ ok: true });
    } catch (err) {
      await logEvent('error', 'subscribe storage failed', { error: String(err.message || err) });
      return res.status(500).json({ error: 'Storage unavailable' });
    }
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    try {
      const all = await upstash(['SMEMBERS', 'awareness:subs']);
      const members = (all && all.result) || [];
      let removed = 0;
      for (const m of members) {
        try {
          const parsed = JSON.parse(m);
          if (parsed.endpoint === endpoint) {
            await upstash(['SREM', 'awareness:subs', m]);
            removed++;
          }
        } catch (_) {}
      }
      await logEvent('info', 'subscribe removed', { removed });
      return res.status(200).json({ ok: true });
    } catch (err) {
      await logEvent('error', 'unsubscribe failed', { error: String(err.message || err) });
      return res.status(500).json({ error: 'Storage unavailable' });
    }
  }

  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
