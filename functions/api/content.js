const OWNER = 'thejackal262';
const REPO = 'Fiaz-website-clean';
const BRANCH = 'main';
const FILE_PATH = 'content/site.json';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }); }
function check(request, env) { return env.ADMIN_PASSWORD && request.headers.get('X-Admin-Password') === env.ADMIN_PASSWORD; }
async function gh(path, env, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'fiaz-admin-panel', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function onRequestGet({ request, env }) {
  if (!check(request, env)) return json({ error: 'Unauthorized' }, 401);
  const file = await gh(`/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, env);
  const text = atob(file.content.replace(/\n/g, ''));
  return json({ data: JSON.parse(text), sha: file.sha });
}
export async function onRequestPost({ request, env }) {
  if (!check(request, env)) return json({ error: 'Unauthorized' }, 401);
  const data = await request.json();
  const current = await gh(`/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, env);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  await gh(`/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, env, { method: 'PUT', body: JSON.stringify({ message: 'Update website content from admin', content, sha: current.sha, branch: BRANCH }) });
  return json({ ok: true });
}
