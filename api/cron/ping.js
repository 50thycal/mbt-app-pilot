import webpush from 'web-push';
import { upstash } from '../_upstash.js';

const PROMPTS = [
  { title: 'Notice', body: 'Where is your attention right now?' },
  { title: 'Pause', body: 'Are you present, or running automatically?' },
  { title: 'A moment', body: 'Take a brief moment to notice.' },
  { title: 'Check in', body: 'What is your mind doing right now?' },
  { title: 'Breath', body: 'One conscious breath.' },
  { title: 'Bell', body: 'Notice the state you are in.' }
];

function pickPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  return header === `Bearer ${expected}`;
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  webpush.setVapidDetails(subject, pub, priv);

  let subs = [];
  try {
    const r = await upstash(['SMEMBERS', 'awareness:subs']);
    subs = (r && r.result) || [];
  } catch (err) {
    console.error('upstash read', err);
    return res.status(500).json({ error: 'Storage unavailable' });
  }

  if (subs.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0, dropped: 0 });
  }

  const prompt = pickPrompt();
  const payload = JSON.stringify({ ...prompt, url: '/' });

  let sent = 0, failed = 0, dropped = 0;
  for (const raw of subs) {
    let sub;
    try { sub = JSON.parse(raw); } catch (_) { continue; }
    try {
      await webpush.sendNotification(sub, payload, { TTL: 60 });
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        try {
          await upstash(['SREM', 'awareness:subs', raw]);
          dropped++;
        } catch (_) {}
      } else {
        console.error('push failed', err.statusCode, err.body);
      }
    }
  }

  res.status(200).json({ sent, failed, dropped, total: subs.length });
}
