const KEY = 'home-tasks';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function onRequestGet({ env }) {
  if (!env.TASKS) return json({ error: 'TASKS_KV_NOT_CONFIGURED' }, 503);
  const raw = await env.TASKS.get(KEY);
  let tasks = [];
  if (raw) {
    try { tasks = JSON.parse(raw); } catch (_) { tasks = []; }
  }
  return json({ tasks: Array.isArray(tasks) ? tasks : [] });
}

export async function onRequestPut({ request, env }) {
  if (!env.TASKS) return json({ error: 'TASKS_KV_NOT_CONFIGURED' }, 503);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'INVALID_JSON' }, 400); }
  const tasks = Array.isArray(body?.tasks) ? body.tasks.slice(0, 500) : null;
  if (!tasks) return json({ error: 'INVALID_TASKS' }, 400);
  await env.TASKS.put(KEY, JSON.stringify(tasks));
  return json({ ok: true, tasks });
}
