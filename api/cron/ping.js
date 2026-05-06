import webpush from 'web-push';
import { upstash } from '../_upstash.js';
import { logEvent, readLogs, subCount } from '../_log.js';
import { commitFile } from '../_github.js';

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

async function snapshotToGitHub(outcome) {
  const snapshot = {
    ts: new Date().toISOString(),
    subs: await subCount(),
    lastPing: outcome,
    env: {
      hasVapid: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
      hasStorage: !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL),
      hasGitHub: !!process.env.GH_TOKEN,
      hasCronSecret: !!process.env.CRON_SECRET
    },
    recentLogs: await readLogs(50)
  };
  const content = JSON.stringify(snapshot, null, 2) + '\n';
  const message = `state: ${snapshot.subs} subs · sent ${outcome.sent}/${outcome.total} · ${snapshot.ts}`;
  try {
    const r = await commitFile('state.json', content, message);
    if (r.skipped) return;
    await logEvent('info', 'snapshot committed', { path: 'state.json' });
  } catch (err) {
    await logEvent('error', 'snapshot commit failed', { error: String(err.message || err) });
  }
}

export default async function handler(req, res) {
  if (!authorized(req)) {
    await logEvent('warn', 'cron ping unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const subject = process.env.VAPID_SUBJECT;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !pub || !priv) {
    await logEvent('error', 'cron ping missing VAPID config');
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  webpush.setVapidDetails(subject, pub, priv);

  let subs = [];
  try {
    const r = await upstash(['SMEMBERS', 'awareness:subs']);
    subs = (r && r.result) || [];
  } catch (err) {
    await logEvent('error', 'cron ping storage read failed', { error: String(err.message || err) });
    return res.status(500).json({ error: 'Storage unavailable' });
  }

  if (subs.length === 0) {
    const outcome = { sent: 0, failed: 0, dropped: 0, total: 0 };
    await logEvent('info', 'cron ping: no subscriptions');
    await snapshotToGitHub(outcome);
    return res.status(200).json(outcome);
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
        await logEvent('warn', 'pruned dead subscription', { status: err.statusCode });
      } else {
        await logEvent('error', 'push delivery failed', {
          status: err.statusCode,
          body: err.body ? String(err.body).slice(0, 200) : null
        });
      }
    }
  }

  const outcome = { sent, failed, dropped, total: subs.length, prompt };
  await logEvent('info', 'cron ping complete', outcome);
  await snapshotToGitHub(outcome);

  res.status(200).json(outcome);
}
