export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);

  if (url.pathname !== '/' || !response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }

  const html = await response.text();
  const syncScript = `
<script>
(function(){
  function liveTaskSync(){
    if (document.hidden) return;
    if (typeof syncTasksFromCloud === 'function') {
      syncTasksFromCloud(true);
    }
  }
  setTimeout(liveTaskSync, 800);
  setInterval(liveTaskSync, 3000);
  window.addEventListener('focus', liveTaskSync);
  window.addEventListener('online', liveTaskSync);
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) liveTaskSync();
  });
})();
</script>`;

  const body = html.includes('</body>')
    ? html.replace('</body>', syncScript + '\n</body>')
    : html + syncScript;

  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('pragma', 'no-cache');
  headers.delete('content-length');

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
