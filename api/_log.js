import { upstash } from './_upstash.js';

const KEY = 'awareness:logs';
const CAP = 200;

export async function logEvent(level, message, meta = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  });
  try {
    await upstash(['LPUSH', KEY, entry]);
    await upstash(['LTRIM', KEY, '0', String(CAP - 1)]);
  } catch (_) {
    // Logging must never throw
  }
}

export async function readLogs(limit = 50) {
  try {
    const r = await upstash(['LRANGE', KEY, '0', String(limit - 1)]);
    const arr = (r && r.result) || [];
    return arr.map(s => {
      try { return JSON.parse(s); } catch (_) { return { raw: s }; }
    });
  } catch (_) {
    return [];
  }
}

export async function subCount() {
  try {
    const r = await upstash(['SCARD', 'awareness:subs']);
    return (r && typeof r.result === 'number') ? r.result : 0;
  } catch (_) {
    return 0;
  }
}
