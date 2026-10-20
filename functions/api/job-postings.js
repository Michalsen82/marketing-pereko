const KEY = 'project-198-job-postings';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'pragma': 'no-cache'
    }
  });
}

function getStore(env) {
  return env.TASKS || env.TASKS_KV || env.PEREKO_TASKS || null;
}

async function readAll(store) {
  const raw = await store.get(KEY);
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (_) {
    return {};
  }
}

export async function onRequestGet({ env }) {
  const store = getStore(env);
  if (!store) return json({ error: 'TASKS_KV_NOT_CONFIGURED' }, 503);
  const postings = await readAll(store);
  return json({ ok: true, postings, serverTime: new Date().toISOString() });
}

export async function onRequestPut({ request, env }) {
  const store = getStore(env);
  if (!store) return json({ error: 'TASKS_KV_NOT_CONFIGURED' }, 503);

  let body;
  try { body = await request.json(); }
  catch (_) { return json({ error: 'INVALID_JSON' }, 400); }

  const id = String(body?.id || '');
  const html = String(body?.html || '');
  if (!/^job[1-9][0-9]*$/.test(id)) return json({ error: 'INVALID_ID' }, 400);
  if (!html || html.length > 50000) return json({ error: 'INVALID_HTML' }, 400);

  const postings = await readAll(store);
  postings[id] = {
    html,
    updatedAt: new Date().toISOString()
  };
  await store.put(KEY, JSON.stringify(postings));

  return json({ ok: true, id, posting: postings[id] });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
