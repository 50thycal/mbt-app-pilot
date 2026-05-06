const REPO_OWNER = '50thycal';
const REPO_NAME = 'mbt-app-pilot';
const LOGS_BRANCH = 'logs';

async function gh(path, opts = {}) {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('GH_TOKEN not set');
  const r = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'awareness-app-logger',
      ...(opts.headers || {})
    }
  });
  return r;
}

async function ensureLogsBranch() {
  const probe = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/branches/${LOGS_BRANCH}`);
  if (probe.status === 200) return;
  if (probe.status !== 404) {
    const text = await probe.text();
    throw new Error(`branches probe ${probe.status}: ${text}`);
  }

  const head = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`);
  if (!head.ok) {
    const text = await head.text();
    throw new Error(`main HEAD lookup ${head.status}: ${text}`);
  }
  const headData = await head.json();

  const create = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${LOGS_BRANCH}`,
      sha: headData.object.sha
    })
  });
  if (!create.ok && create.status !== 422) {
    const text = await create.text();
    throw new Error(`branch create ${create.status}: ${text}`);
  }
}

export async function commitFile(path, content, message) {
  if (!process.env.GH_TOKEN) return { skipped: true, reason: 'GH_TOKEN not set' };

  await ensureLogsBranch();

  const probe = await gh(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${LOGS_BRANCH}`
  );
  let sha;
  if (probe.status === 200) {
    const data = await probe.json();
    sha = data.sha;
  } else if (probe.status !== 404) {
    const text = await probe.text();
    throw new Error(`contents probe ${probe.status}: ${text}`);
  }

  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: LOGS_BRANCH,
    ...(sha ? { sha } : {})
  };
  const r = await gh(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    { method: 'PUT', body: JSON.stringify(body) }
  );
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`commit ${r.status}: ${text}`);
  }
  return { skipped: false };
}
