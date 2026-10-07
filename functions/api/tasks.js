const KEY = 'home-tasks';

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

function clean(tasks) {
  return Array.isArray(tasks) ? tasks.slice(0, 500) : [];
}

export async function onRequestGet({ env }) {
  const store = getStore(env);
  if (!store) return json({ error: 'TASKS_KV_NOT_CONFIGURED' }, 503);
  const raw = await store.get(KEY);
  let tasks = [];
  if (raw) {
    try { tasks = JSON.parse(raw); } catch (_) { tasks = []; }
  }
  return json({ ok: true, backend: 'cloudflare-kv', tasks: clean(tasks), serverTime: new Date().toISOString() });
}

export async function onRequestPut({ request, env }) {
  const store = getStore(env);
  if (!store) return json({ error: 'TASKS_KV_NOT_CONFIGURED' }, 503);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'INVALID_JSON' }, 400); }
  if (!Array.isArray(body?.tasks)) return json({ error: 'INVALID_TASKS' }, 400);
  const tasks = clean(body.tasks);
  await store.put(KEY, JSON.stringify(tasks));
  return json({ ok: true, backend: 'cloudflare-kv', tasks, serverTime: new Date().toISOString() });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
