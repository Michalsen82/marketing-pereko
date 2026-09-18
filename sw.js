const CACHE_NAME='pereko-marketing-pwa-v2';
const APP_SHELL=[
  '/',
  '/index.html',
  '/login.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/pereko-marketing-v2-192.png',
  '/icons/pereko-marketing-v2-512.png',
  '/icons/pereko-marketing-v2-512.png',
  '/icons/pereko-marketing-v2-apple.png',
  '/styles.css',
  '/project-detail.css',
  '/task-calendar.css',
  '/readability.css',
  '/dashboard-polish.css',
  '/footer.css',
  '/layout-v2.css',
  '/dark-glass.css',
  '/team.css',
  '/user-avatar.css',
  '/project-card-v2.css',
  '/gantt.css',
  '/account-security.css',
  '/global-search.css',
  '/project-files.css',
  '/mobile-responsive.css',
  '/pwa.css',
  '/sharp-corners.css',
  '/pwa.js',
  '/auth-guard.js',
  '/app.js',
  '/project-detail.js',
  '/task-calendar.js',
  '/project-cards.js',
  '/global-search.js',
  '/project-files.js',
  '/footer.js',
  '/team.js',
  '/user-avatar.js',
  '/gantt.js',
  '/account-security.js',
  '/login.js',
  '/reset-password.js'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE_NAME&&key.startsWith('pereko-marketing-pwa-')).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        const cache=await caches.open(CACHE_NAME);
        cache.put(request,response.clone()).catch(()=>{});
        return response;
      }catch{
        return (await caches.match(request))||(await caches.match('/offline.html'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached){
      fetch(request).then(async response=>{
        if(response&&response.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put(request,response.clone());
        }
      }).catch(()=>{});
      return cached;
    }
    try{
      const response=await fetch(request);
      if(response&&response.ok){
        const cache=await caches.open(CACHE_NAME);
        cache.put(request,response.clone()).catch(()=>{});
      }
      return response;
    }catch{
      return new Response('',{status:503,statusText:'Offline'});
    }
  })());
});

self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};
    try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text()||''}}
    const title=data.title||'PEREKO — Centrum Marketingowe';
    const options={
      body:data.body||'Masz nową aktywność w Centrum Marketingowym.',
      icon:data.icon||'/icons/pereko-marketing-v2-192.png',
      badge:data.badge||'/icons/badge-96.png',
      tag:data.tag||'pereko-marketing',
      renotify:data.renotify!==false,
      data:{
        url:data.url||'/',
        projectId:data.projectId||null,
        taskId:data.taskId||null,
        notificationId:data.notificationId||null
      },
      actions:Array.isArray(data.actions)?data.actions:[]
    };
    await self.registration.showNotification(title,options);
    const count=Number(data.badgeCount);
    try{
      if(Number.isFinite(count)&&self.navigator&&'setAppBadge' in self.navigator){
        await self.navigator.setAppBadge(Math.max(0,count));
      }
    }catch{}
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const data=event.notification.data||{};
  const target=data.url||'/';
  event.waitUntil((async()=>{
    try{
      if(self.navigator&&'clearAppBadge' in self.navigator)await self.navigator.clearAppBadge();
    }catch{}
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      try{
        const current=new URL(client.url);
        const wanted=new URL(target,self.location.origin);
        if(current.origin===wanted.origin){
          await client.focus();
          client.postMessage({type:'PEREKO_DEEP_LINK',url:wanted.href});
          return;
        }
      }catch{}
    }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='SKIP_WAITING')self.skipWaiting();
  if(data.type==='SHOW_TEST_NOTIFICATION'){
    event.waitUntil(self.registration.showNotification('PEREKO — Centrum Marketingowe',{
      body:'Powiadomienia działają poprawnie na tym urządzeniu.',
      icon:'/icons/pereko-marketing-v2-192.png',
      badge:'/icons/badge-96.png',
      tag:'pereko-test',
      data:{url:'/'}
    }));
  }
});
