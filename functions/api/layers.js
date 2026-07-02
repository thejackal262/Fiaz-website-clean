export async function onRequestGet() {
  return Response.json({ ok: true });
}

export async function onRequestPost(context) {
  try {
    const password = context.request.headers.get("X-Admin-Password");
    if (password !== context.env.ADMIN_PASSWORD) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = context.env.GITHUB_TOKEN;
    const ownerRepo = context.env.GITHUB_REPO || "thejackal262/Fiaz-website-clean";
    const branch = context.env.GITHUB_BRANCH || "main";
    const path = "content/layers.json";
    const body = await context.request.text();

    const getRes = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}?ref=${branch}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "jackal-layer-builder",
        "Accept": "application/vnd.github+json"
      }
    });

    let sha = null;
    if (getRes.ok) {
      const current = await getRes.json();
      sha = current.sha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${ownerRepo}/contents/${path}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "jackal-layer-builder",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Update layer builder website",
        content: btoa(unescape(encodeURIComponent(body))),
        branch,
        ...(sha ? { sha } : {})
      })
    });

    if (!putRes.ok) {
      return new Response(await putRes.text(), { status: putRes.status });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return new Response(err.message || "Server error", { status: 500 });
  }
}
