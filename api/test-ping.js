import webpush from 'web-push';
import { upstash } from './_upstash.js';
import { logEvent } from './_log.js';

const PROMPTS = [
  { title: 'Test bell', body: 'This is a test reminder.' },
  { title: 'Notice', body: 'Where is your attention right now?' },
  { title: 'Pause', body: 'Are you present, or running automatically?' }
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint } = req.body || {};
  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Missing endpoint' });
  }

  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) {
    return res.status(500).json({ error: 'VAPID not configured' });
  }
  webpush.setVapidDetails(subject, pub, priv);

  let subs = [];
  try {
    const r = await upstash(['SMEMBERS', 'awareness:subs']);
    subs = (r && r.result) || [];
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Storage unavailable' });
  }

  let target = null;
  let raw = null;
  for (const m of subs) {
    try {
      const parsed = JSON.parse(m);
      if (parsed.endpoint === endpoint) {
        target = parsed;
        raw = m;
        break;
      }
    } catch (_) {}
  }

  if (!target) {
    return res.status(404).json({ error: 'Subscription not registered' });
  }

  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  const payload = JSON.stringify({ ...prompt, url: '/' });

  try {
    await webpush.sendNotification(target, payload, { TTL: 60 });
    await logEvent('info', 'test ping sent');
    return res.status(200).json({ ok: true, prompt });
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      try { await upstash(['SREM', 'awareness:subs', raw]); } catch (_) {}
      await logEvent('warn', 'test ping: subscription expired', { status: err.statusCode });
      return res.status(410).json({ error: 'Subscription expired; please re-subscribe' });
    }
    await logEvent('error', 'test ping delivery failed', {
      status: err.statusCode,
      body: err.body ? String(err.body).slice(0, 200) : null
    });
    return res.status(502).json({ error: 'Push delivery failed', status: err.statusCode });
  }
}
