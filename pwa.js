(()=>{
  const LS={
    deviceId:'pereko_pwa_device_id',
    prefs:'pereko_push_preferences',
    installDismissed:'pereko_pwa_install_dismissed',
    notifyDismissed:'pereko_pwa_notify_dismissed'
  };
  const DEFAULT_PREFS={assignment:true,taskDone:true,comments:true,deadline:true,files:true};
  let deferredPrompt=null;
  let registration=null;
  let settingsModal=null;
  let onboarding=null;

  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid=()=>/android/i.test(navigator.userAgent);
  const isMobile=()=>isIOS()||isAndroid()||matchMedia('(max-width:760px)').matches;
  const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const hasNotifications=()=>('Notification' in window);
  const deviceId=()=>{
    let id=localStorage.getItem(LS.deviceId);
    if(!id){id=crypto.randomUUID?.()||('dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(LS.deviceId,id)}
    return id;
  };
  const getPrefs=()=>{try{return {...DEFAULT_PREFS,...JSON.parse(localStorage.getItem(LS.prefs)||'{}')}}catch{return {...DEFAULT_PREFS}}};
  const setPrefs=p=>localStorage.setItem(LS.prefs,JSON.stringify(p));
  const platformName=()=>isIOS()?'iPhone / iOS':isAndroid()?'Android':'Komputer';

  function installMeta(){
    return isStandalone()
      ?{title:'Zainstalowana',detail:'Uruchamiasz Centrum Marketingowe jak aplikację.'}
      :{title:'Niezainstalowana',detail:isIOS()?'Dodaj stronę do ekranu początkowego w Safari.':'Możesz zainstalować aplikację z tej przeglądarki.'};
  }
  function notificationMeta(){
    if(!hasNotifications())return {title:'Niedostępne',detail:'Ta przeglądarka nie obsługuje powiadomień webowych.'};
    if(Notification.permission==='granted')return {title:'Dozwolone',detail:'Urządzenie może wyświetlać powiadomienia systemowe.'};
    if(Notification.permission==='denied')return {title:'Zablokowane',detail:'Zmień zgodę na powiadomienia w ustawieniach systemu/przeglądarki.'};
    return {title:'Wyłączone',detail:'Włącz je jednym przyciskiem po zalogowaniu.'};
  }

  async function registerSW(){
    if(!('serviceWorker' in navigator))return null;
    try{
      registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
      await navigator.serviceWorker.ready;
      return registration;
    }catch(e){
      console.warn('PWA Service Worker:',e);
      return null;
    }
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    refreshAll();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    localStorage.removeItem(LS.installDismissed);
    refreshAll();
  });

  function iosGuide(){
    return '<div class="pwa-guide"><strong>Instalacja na iPhonie:</strong><ol><li>Otwórz stronę w Safari.</li><li>Stuknij ikonę Udostępnij.</li><li>Wybierz „Dodaj do ekranu początkowego”.</li><li>Potwierdź „Dodaj” i uruchom aplikację z ikony PEREKO.</li><li>Zaloguj się w aplikacji.</li><li>Wejdź w „Aplikacja i powiadomienia” i kliknij „Włącz powiadomienia” lub „Połącz powiadomienia”.</li><li>Zaakceptuj zgodę systemową na powiadomienia.</li></ol></div>';
  }
  function androidGuide(){
    return '<div class="pwa-guide"><strong>Instalacja na Androidzie:</strong><ol><li>Użyj przycisku „Zainstaluj aplikację”.</li><li>Jeśli systemowy przycisk nie pojawi się, otwórz menu przeglądarki.</li><li>Wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.</li><li>Uruchom aplikację z ikony PEREKO i zaloguj się.</li><li>Wejdź w „Aplikacja i powiadomienia” i kliknij „Włącz powiadomienia” lub „Połącz powiadomienia”.</li><li>Zaakceptuj zgodę systemową na powiadomienia.</li></ol></div>';
  }
  function loginPlatformGuide(){
    return '<div class="pwa-login-guide"><div><strong>iPhone / iOS</strong><span>Safari → Udostępnij → Dodaj do ekranu początkowego → uruchom aplikację → zaloguj się → Aplikacja i powiadomienia → Włącz/Połącz powiadomienia.</span></div><div><strong>Android</strong><span>Zainstaluj aplikację → uruchom ją z ikony PEREKO → zaloguj się → Aplikacja i powiadomienia → Włącz/Połącz powiadomienia.</span></div></div>';
  }

  async function installApp(){
    if(isStandalone())return true;
    if(deferredPrompt){
      deferredPrompt.prompt();
      const choice=await deferredPrompt.userChoice.catch(()=>null);
      if(choice?.outcome==='accepted')localStorage.removeItem(LS.installDismissed);
      deferredPrompt=null;
      refreshAll();
      return choice?.outcome==='accepted';
    }
    showInstallHelp();
    return false;
  }
  function showInstallHelp(){
    const loginPanel=document.querySelector('#pwaLoginPanel');
    if(loginPanel&&!window.perekoLoggedPerson){
      const box=loginPanel.querySelector('.pwa-login-help');
      if(box)box.innerHTML=loginPlatformGuide();
      return;
    }
    ensureSettings();
    settingsModal.classList.add('open');
    const guide=settingsModal.querySelector('#pwaInstallGuide');
    if(guide){
      guide.innerHTML=isIOS()?iosGuide():androidGuide();
      guide.hidden=false;
    }
  }

  function buildLoginPanel(){
    if(!document.querySelector('#loginForm')||document.querySelector('#pwaLoginPanel'))return;
    const wrap=document.querySelector('.login-minimal-wrap');
    if(!wrap)return;
    const panel=document.createElement('section');
    panel.className='pwa-login-panel';
    panel.id='pwaLoginPanel';
    panel.innerHTML='<strong>Centrum Marketingowe także jako aplikacja</strong><p>Zainstaluj je na telefonie, a po pierwszym uruchomieniu zaloguj się i koniecznie włącz/połącz powiadomienia w sekcji „Aplikacja i powiadomienia”.</p><div class="pwa-login-actions"><button class="install" type="button">Zainstaluj aplikację</button><button class="help" type="button">Jak to działa?</button></div><div class="pwa-login-help"></div>';
    wrap.appendChild(panel);
    panel.querySelector('.install').onclick=installApp;
    panel.querySelector('.help').onclick=()=>{
      const box=panel.querySelector('.pwa-login-help');
      const open=box.dataset.open==='1';
      box.innerHTML=open?'':loginPlatformGuide();
      box.dataset.open=open?'0':'1';
    };
    if(isStandalone())panel.hidden=true;
  }

  function addSettingsButton(){
    if(!document.querySelector('.topbar-actions')||document.querySelector('#pwaSettingsBtn'))return;
    const btn=document.createElement('button');
    btn.className='pwa-settings-btn';
    btn.id='pwaSettingsBtn';
    btn.type='button';
    btn.title='Aplikacja i powiadomienia';
    btn.setAttribute('aria-label','Aplikacja i powiadomienia');
    btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 8a5 5 0 0 0-10 0c0 5-2 5.5-2 7h14c0-1.5-2-2-2-7Zm-7 9h4a2 2 0 0 1-4 0ZM12 1a7 7 0 0 1 7 7c0 3.58 1.12 4.64 1.67 5.17.45.42.83.79.83 1.83v2H2.5v-2c0-1.04.38-1.41.83-1.83C3.88 12.64 5 11.58 5 8a7 7 0 0 1 7-7Z"/></svg><span class="pwa-mini-dot"></span>';
    const password=document.querySelector('#changePasswordBtn');
    password?.before(btn);
    btn.onclick=()=>openSettings();
  }

  function ensureSettings(){
    if(settingsModal)return;
    settingsModal=document.createElement('div');
    settingsModal.className='pwa-modal';
    settingsModal.id='pwaSettingsModal';
    settingsModal.innerHTML='<div class="pwa-card"><div class="pwa-head"><div><span class="pwa-kicker">APLIKACJA PEREKO</span><h3>Aplikacja i powiadomienia</h3><p>Instalacja, status urządzenia i preferencje powiadomień.</p></div><button class="pwa-close" type="button" aria-label="Zamknij">×</button></div><div class="pwa-content"><div class="pwa-status-grid"><div class="pwa-status-card"><span>APLIKACJA</span><strong id="pwaInstallStatus">—</strong><small id="pwaInstallDetail">—</small></div><div class="pwa-status-card"><span>POWIADOMIENIA</span><strong id="pwaNotifyStatus">—</strong><small id="pwaNotifyDetail">—</small></div></div><section class="pwa-section"><div class="pwa-section-head"><div><span>INSTALACJA</span><h4>Centrum Marketingowe na urządzeniu</h4></div></div><p>Po instalacji aplikacja działa w osobnym oknie i ma własną ikonę. Aby odbierać powiadomienia także po zamknięciu aplikacji, po zalogowaniu kliknij „Włącz powiadomienia” lub „Połącz powiadomienia” w sekcji poniżej.</p><div class="pwa-actions"><button class="pwa-primary" id="pwaInstallBtn" type="button">Zainstaluj aplikację</button><button class="pwa-secondary" id="pwaInstallHelpBtn" type="button">Instrukcja</button></div><div id="pwaInstallGuide" hidden></div><div class="pwa-qr-wrap" id="pwaQrWrap"><img src="/icons/install-qr.png" alt="Kod QR do Centrum Marketingowego"><div><strong>Otwórz na telefonie</strong><p>Zeskanuj kod aparatem, zaloguj się i dodaj aplikację do ekranu głównego.</p></div></div></section><section class="pwa-section"><div class="pwa-section-head"><div><span>POWIADOMIENIA</span><h4>Co ma trafiać na telefon</h4></div></div><p>Powiadomienia są wysyłane tylko dla zdarzeń związanych z Twoją pracą. Preferencje są zapisywane osobno dla tego urządzenia.</p><div class="pwa-actions"><button class="pwa-primary" id="pwaEnableNotifications" type="button">Włącz powiadomienia</button><button class="pwa-secondary" id="pwaTestNotification" type="button">Test powiadomienia</button></div><div class="pwa-prefs" id="pwaPrefs"></div><div class="pwa-message" id="pwaMessage"></div></section><section class="pwa-section"><div class="pwa-section-head"><div><span>URZĄDZENIE</span><h4 id="pwaDeviceTitle">To urządzenie</h4></div></div><p id="pwaDeviceInfo"></p></section></div></div>';
    document.body.appendChild(settingsModal);
    settingsModal.querySelector('.pwa-close').onclick=closeSettings;
    settingsModal.onclick=e=>{if(e.target===settingsModal)closeSettings()};
    settingsModal.querySelector('#pwaInstallBtn').onclick=installApp;
    settingsModal.querySelector('#pwaInstallHelpBtn').onclick=()=>{
      const g=settingsModal.querySelector('#pwaInstallGuide');
      g.innerHTML=isIOS()?iosGuide():androidGuide();g.hidden=!g.hidden;
    };
    settingsModal.querySelector('#pwaEnableNotifications').onclick=enableNotifications;
    settingsModal.querySelector('#pwaTestNotification').onclick=testNotification;
    renderPrefs();
  }
  function closeSettings(){settingsModal?.classList.remove('open')}
  function openSettings(){ensureSettings();refreshSettings();settingsModal.classList.add('open')}

  function renderPrefs(){
    if(!settingsModal)return;
    const labels={
      assignment:['Przypisano mi zadanie','Nowe zadanie lub zmiana osoby odpowiedzialnej.'],
      taskDone:['Zakończono zadanie w moim projekcie','Informacja, gdy członek zespołu zamknie zadanie projektowe.'],
      comments:['Nowy komentarz','Komentarz lub ustalenie w projekcie, w którym uczestniczysz.'],
      deadline:['Zbliżający się termin','Przypomnienia o zadaniach i projektach wymagających uwagi.'],
      files:['Nowe materiały i wersje plików','Zmiany w materiałach projektu po uruchomieniu magazynu R2.']
    };
    const prefs=getPrefs();
    settingsModal.querySelector('#pwaPrefs').innerHTML=Object.entries(labels).map(([key,val])=>'<label class="pwa-pref"><input type="checkbox" data-pwa-pref="'+key+'" '+(prefs[key]?'checked':'')+'><span><strong>'+val[0]+'</strong><span>'+val[1]+'</span></span></label>').join('');
    settingsModal.querySelectorAll('[data-pwa-pref]').forEach(input=>input.onchange=async()=>{
      const next=getPrefs();next[input.dataset.pwaPref]=input.checked;setPrefs(next);await syncPreferences();
    });
  }

  async function getPushConfig(){
    if(!window.perekoAuthFetch)return {ready:false};
    try{
      const r=await window.perekoAuthFetch('/api/push-config',{cache:'no-store'});
      return await r.json();
    }catch{return {ready:false}}
  }
  function b64ToBytes(value){
    const padding='='.repeat((4-value.length%4)%4);
    const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);
    return Uint8Array.from(raw,c=>c.charCodeAt(0));
  }
  async function subscribePush(){
    if(!registration)await registerSW();
    if(!registration?.pushManager)return {ok:false,serverReady:false};
    const config=await getPushConfig();
    if(!config.ready||!config.publicKey)return {ok:false,serverReady:false};
    let sub=await registration.pushManager.getSubscription();
    if(!sub){
      sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(config.publicKey)});
    }
    const response=await window.perekoAuthFetch('/api/push-subscriptions',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'subscribe',deviceId:deviceId(),subscription:sub.toJSON(),preferences:getPrefs(),device:{platform:platformName(),userAgent:navigator.userAgent,standalone:isStandalone()}})
    });
    if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Nie udało się zapisać subskrypcji');
    return {ok:true,serverReady:true,subscription:sub};
  }

  async function enableNotifications(){
    ensureSettings();
    const msg=settingsModal.querySelector('#pwaMessage');
    if(!hasNotifications()){msg.textContent='Ta przeglądarka nie obsługuje powiadomień.';msg.className='pwa-message error';return}
    if(isIOS()&&!isStandalone()){
      msg.textContent='Na iPhonie najpierw dodaj aplikację do ekranu początkowego i uruchom ją z ikony PEREKO.';
      msg.className='pwa-message warn';
      return;
    }
    let permission=Notification.permission;
    if(permission==='default')permission=await Notification.requestPermission();
    if(permission!=='granted'){
      msg.textContent='Powiadomienia nie zostały dozwolone. Zmień zgodę w ustawieniach systemu lub przeglądarki.';
      msg.className='pwa-message error';refreshAll();return;
    }
    msg.textContent='Włączam kanał powiadomień…';msg.className='pwa-message';
    try{
      const result=await subscribePush();
      if(result.serverReady){
        msg.textContent='Powiadomienia systemowe są aktywne na tym urządzeniu.';
        msg.className='pwa-message ok';
      }else{
        msg.textContent='Zgoda systemowa jest aktywna. Kanał Web Push czeka jeszcze na konfigurację serwerową w Cloudflare.';
        msg.className='pwa-message warn';
      }
    }catch(e){
      msg.textContent=e.message||'Nie udało się uruchomić kanału push.';
      msg.className='pwa-message error';
    }
    localStorage.removeItem(LS.notifyDismissed);
    refreshAll();
  }

  async function syncPreferences(){
    if(!window.perekoAuthFetch||!registration?.pushManager)return;
    try{
      const sub=await registration.pushManager.getSubscription();
      if(!sub)return;
      await window.perekoAuthFetch('/api/push-subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preferences',deviceId:deviceId(),preferences:getPrefs()})});
    }catch{}
  }

  async function testNotification(){
    ensureSettings();
    const msg=settingsModal.querySelector('#pwaMessage');
    if(!hasNotifications()){
      msg.textContent='Ta przeglądarka nie obsługuje powiadomień.';
      msg.className='pwa-message error';
      return;
    }

    let permission=Notification.permission;
    if(permission==='default'){
      try{permission=await Notification.requestPermission()}catch{}
    }
    if(permission!=='granted'){
      msg.textContent='Powiadomienia są zablokowane. Włącz je w ustawieniach aplikacji lub telefonu.';
      msg.className='pwa-message error';
      refreshAll();
      return;
    }

    msg.textContent='Wysyłam lokalne powiadomienie testowe…';
    msg.className='pwa-message';

    try{
      if(!('serviceWorker' in navigator))throw new Error('Brak obsługi Service Workera');
      if(!registration)await registerSW();
      const ready=await navigator.serviceWorker.ready;
      registration=ready;

      await ready.showNotification('PEREKO — Centrum Marketingowe',{
        body:'Powiadomienia działają poprawnie na tym urządzeniu.',
        icon:'/icons/pereko-marketing-v3-192.png',
        badge:'/icons/badge-96.png',
        tag:'pereko-local-test-'+Date.now(),
        renotify:true,
        data:{url:'/'}
      });

      msg.textContent='Test lokalny działa. Sprawdzam teraz prawdziwy Web Push z serwera…';
      msg.className='pwa-message';

      if(window.perekoAuthFetch){
        try{
          const serverResponse=await window.perekoAuthFetch('/api/push-test',{method:'POST'});
          const serverData=await serverResponse.json().catch(()=>({}));
          if(serverResponse.ok&&serverData.sent>0){
            msg.textContent='Web Push serwerowy działa. Wiadomość została wysłana do '+serverData.sent+' '+(Number(serverData.sent)===1?'urządzenia':'urządzeń')+'.';
            msg.className='pwa-message ok';
          }else{
            const failure=Array.isArray(serverData.failures)&&serverData.failures[0]?serverData.failures[0]:null;
            const reason=failure?.error||serverData.error||'Serwer nie wysłał wiadomości.';
            const status=failure?.status?' Kod '+failure.status+'.':'';
            msg.textContent='Web Push serwerowy nie przeszedł testu.'+status+' '+reason+' Subskrypcje: '+Number(serverData.subscriptions||0)+', próby wysyłki: '+Number(serverData.attempted||0)+'.';
            msg.className='pwa-message error';
          }
        }catch(e){
          msg.textContent='Test lokalny działa, ale test serwerowego Web Push nie powiódł się: '+(e?.message||'nieznany błąd')+'.';
          msg.className='pwa-message error';
        }
      }else{
        msg.textContent='Test lokalny działa, ale nie można uruchomić testu serwerowego bez aktywnej sesji.';
        msg.className='pwa-message warn';
      }
    }catch(e){
      console.error('PWA notification test:',e);
      msg.textContent='Nie udało się wyświetlić testu: '+(e?.message||'nieznany błąd')+'. Sprawdź uprawnienia powiadomień aplikacji w Androidzie.';
      msg.className='pwa-message error';
    }
  }

  async function unregisterPush(){
    try{
      if(!registration)await registerSW();
      const sub=await registration?.pushManager?.getSubscription();
      if(sub&&window.perekoAuthFetch){
        await window.perekoAuthFetch('/api/push-subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'unsubscribe',deviceId:deviceId()})}).catch(()=>{});
      }
      await sub?.unsubscribe().catch(()=>{});
    }catch{}
  }
  window.perekoPushUnregister=unregisterPush;

  function refreshSettings(){
    if(!settingsModal)return;
    const inst=installMeta(),note=notificationMeta();
    settingsModal.querySelector('#pwaInstallStatus').textContent=inst.title;
    settingsModal.querySelector('#pwaInstallDetail').textContent=inst.detail;
    settingsModal.querySelector('#pwaNotifyStatus').textContent=note.title;
    settingsModal.querySelector('#pwaNotifyDetail').textContent=note.detail;
    settingsModal.querySelector('#pwaInstallBtn').disabled=isStandalone();
    settingsModal.querySelector('#pwaInstallBtn').textContent=isStandalone()?'Aplikacja zainstalowana':'Zainstaluj aplikację';
    settingsModal.querySelector('#pwaEnableNotifications').disabled=!hasNotifications();
    settingsModal.querySelector('#pwaEnableNotifications').textContent=hasNotifications()&&Notification.permission==='granted'?'Połącz powiadomienia':'Włącz powiadomienia';
    settingsModal.querySelector('#pwaDeviceTitle').textContent=platformName();
    settingsModal.querySelector('#pwaDeviceInfo').textContent=(isStandalone()?'Tryb aplikacji · ':'Tryb przeglądarki · ')+(navigator.onLine?'online':'offline')+'. Identyfikator urządzenia: '+deviceId().slice(0,8)+'…';
    settingsModal.querySelector('#pwaQrWrap').hidden=isMobile();
  }
  function refreshAttention(){
    const btn=document.querySelector('#pwaSettingsBtn');
    if(!btn)return;
    const needsInstall=isMobile()&&!isStandalone();
    const needsNotify=isStandalone()&&hasNotifications()&&Notification.permission!=='granted';
    btn.classList.toggle('has-attention',needsInstall||needsNotify);
  }
  function refreshAll(){refreshSettings();refreshAttention();const login=document.querySelector('#pwaLoginPanel');if(login&&isStandalone())login.hidden=true}

  function ensureOnboarding(){
    if(onboarding)return;
    onboarding=document.createElement('div');
    onboarding.className='pwa-onboarding';
    onboarding.innerHTML='<div class="pwa-onboarding-card"><div class="mark">P</div><span id="pwaOnboardKicker">APLIKACJA PEREKO</span><h3 id="pwaOnboardTitle">Centrum Marketingowe na telefonie</h3><p id="pwaOnboardText"></p><div id="pwaOnboardGuide"></div><div class="pwa-onboarding-actions"><button class="primary" id="pwaOnboardPrimary" type="button">Zainstaluj</button><button class="later" id="pwaOnboardLater" type="button">Później</button></div></div>';
    document.body.appendChild(onboarding);
  }
  function showInstallOnboarding(){
    ensureOnboarding();
    onboarding.querySelector('#pwaOnboardTitle').textContent='Zainstaluj Centrum Marketingowe';
    onboarding.querySelector('#pwaOnboardText').textContent='Po instalacji uruchom aplikację z ikony PEREKO, zaloguj się i wejdź w „Aplikacja i powiadomienia”, aby włączyć/połączyć powiadomienia systemowe.';
    onboarding.querySelector('#pwaOnboardGuide').innerHTML=isIOS()?iosGuide():'';
    const primary=onboarding.querySelector('#pwaOnboardPrimary');
    primary.textContent=isIOS()?'Pokaż instrukcję':'Zainstaluj aplikację';
    primary.onclick=()=>{if(isIOS())showInstallHelp();else installApp();onboarding.classList.remove('open')};
    onboarding.querySelector('#pwaOnboardLater').onclick=()=>{localStorage.setItem(LS.installDismissed,'1');onboarding.classList.remove('open')};
    onboarding.classList.add('open');
  }
  function showNotifyOnboarding(){
    ensureOnboarding();
    onboarding.querySelector('#pwaOnboardTitle').textContent='Włącz powiadomienia';
    onboarding.querySelector('#pwaOnboardText').textContent='Otrzymuj na telefonie informacje o przypisanych zadaniach, komentarzach i zmianach w projektach.';
    onboarding.querySelector('#pwaOnboardGuide').innerHTML='';
    const primary=onboarding.querySelector('#pwaOnboardPrimary');
    primary.textContent='Włącz powiadomienia';
    primary.onclick=async()=>{onboarding.classList.remove('open');openSettings();await enableNotifications()};
    onboarding.querySelector('#pwaOnboardLater').onclick=()=>{localStorage.setItem(LS.notifyDismissed,'1');onboarding.classList.remove('open')};
    onboarding.classList.add('open');
  }
  function maybeOnboard(){
    if(!isMobile())return;
    if(!isStandalone()&&!localStorage.getItem(LS.installDismissed)){showInstallOnboarding();return}
    if(isStandalone()&&hasNotifications()&&Notification.permission==='default'&&!localStorage.getItem(LS.notifyDismissed))showNotifyOnboarding();
  }

  function handleDeepLink(urlValue){
    let url;
    try{url=new URL(urlValue||location.href,location.origin)}catch{return}
    if(url.searchParams.get('search')==='1'){
      setTimeout(()=>document.querySelector('#globalSearchFab')?.click(),450);
    }
    const projectId=url.searchParams.get('projectId');
    const taskId=url.searchParams.get('taskId');
    if(projectId){
      let tries=0;
      const timer=setInterval(()=>{
        tries++;
        if(typeof window.perekoOpenDeepLink==='function'){
          clearInterval(timer);
          window.perekoOpenDeepLink({projectId,taskId});
        }else if(tries>30)clearInterval(timer);
      },180);
    }
  }

  navigator.serviceWorker?.addEventListener('message',event=>{
    if(event.data?.type==='PEREKO_DEEP_LINK'){
      const url=new URL(event.data.url,location.origin);
      history.replaceState(null,'',url.pathname+url.search+url.hash);
      handleDeepLink(url.href);
    }
  });

  document.addEventListener('pereko:user-ready',()=>{
    addSettingsButton();
    refreshAll();
    setTimeout(maybeOnboard,750);
    handleDeepLink(location.href);
    if(hasNotifications()&&Notification.permission==='granted'){
      setTimeout(()=>subscribePush().catch(()=>{}),1100);
    }
  });
  window.addEventListener('online',refreshAll);
  window.addEventListener('offline',refreshAll);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      refreshAll();
      try{navigator.clearAppBadge?.()}catch{}
    }
  });
  window.addEventListener('focus',()=>{try{navigator.clearAppBadge?.()}catch{}});

  registerSW();
  buildLoginPanel();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{buildLoginPanel();addSettingsButton();refreshAll();handleDeepLink(location.href)});
  else{addSettingsButton();refreshAll();handleDeepLink(location.href)}
})();
