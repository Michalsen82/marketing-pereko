const OWNER = 'Michalsen82';
const REPO = 'marketing-pereko';
const FILE_PATH = 'data/dashboard.json';
const BRANCH = 'main';

const ghHeaders = token => ({
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'pereko-marketing-dashboard'
});

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function getCurrentFile(token) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const response = await fetch(url, { headers: ghHeaders(token) });
  if (!response.ok) throw new Error(`GitHub GET failed: ${response.status}`);
  return response.json();
}

export async function onRequestGet(context) {
  try {
    const token = context.env.GITHUB_TOKEN;
    if (!token) return Response.json({ error: 'Brak sekretu GITHUB_TOKEN' }, { status: 500 });
    const file = await getCurrentFile(token);
    const data = JSON.parse(decodeBase64Utf8(file.content));
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const token = context.env.GITHUB_TOKEN;
    if (!token) return Response.json({ error: 'Brak sekretu GITHUB_TOKEN' }, { status: 500 });

    const body = await context.request.json();
    if (!Array.isArray(body.projects) || !Array.isArray(body.tasks)) {
      return Response.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
    }

    const current = await getCurrentFile(token);
    const payload = {
      projects: body.projects,
      tasks: body.tasks,
      updatedAt: new Date().toISOString()
    };

    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Aktualizacja danych z dashboardu marketingowego',
        content: encodeBase64Utf8(JSON.stringify(payload, null, 2) + '\n'),
        sha: current.sha,
        branch: BRANCH
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`GitHub PUT failed: ${response.status} ${details}`);
    }

    return Response.json({ ok: true, ...payload }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
