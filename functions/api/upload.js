const OWNER = 'thejackal262';
const REPO = 'Fiaz-website-clean';
const BRANCH = 'main';
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }); }
function check(request, env) { return env.ADMIN_PASSWORD && request.headers.get('X-Admin-Password') === env.ADMIN_PASSWORD; }
async function gh(path, env, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'fiaz-admin-panel', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function onRequestPost({ request, env }) {
  if (!check(request, env)) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const ext = (body.name || 'image.png').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'') || 'png';
  const safe = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const path = `images/uploads/${safe}`;
  await gh(`/repos/${OWNER}/${REPO}/contents/${path}`, env, { method: 'PUT', body: JSON.stringify({ message: `Upload ${safe} from admin`, content: body.data, branch: BRANCH }) });
  return json({ ok: true, path: `/${path}` });
}
