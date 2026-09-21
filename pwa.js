(()=>{
  const LS={
    deviceId:'pereko_pwa_device_id',
    prefs:'pereko_push_preferences',
    installDismissed:'pereko_pwa_install_dismissed',
    notifyDismissed:'pereko_pwa_notify_dismissed'
  };
  const DEFAULT_PREFS={assignment:true,taskDone:true,comments:true,deadline:true,files:true};
  const APP_VERSION='2.1.1';
  const VERSION_URL='/app-version.json';
  let latestPublishedVersion=null;
  let updateBanner=null;
  let updateCheckTimer=null;
  let deferredPrompt=window.__perekoInstallPrompt||null;
  let registration=null;
  let settingsModal=null;
  let onboarding=null;
  const pageOpenedAt=Date.now();

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

  function versionCmp(a,b){
    const pa=String(a||'').split(/[^0-9]+/).filter(Boolean).map(Number);
    const pb=String(b||'').split(/[^0-9]+/).filter(Boolean).map(Number);
    const len=Math.max(pa.length,pb.length);
    for(let i=0;i<len;i++){
      const x=pa[i]||0,y=pb[i]||0;
      if(x!==y)return x>y?1:-1;
    }
    return 0;
  }

  function removeUpdateBanner(){
    updateBanner?.remove();
    updateBanner=null;
  }

  function ensureUpdateBanner(info){
    if(!info||versionCmp(info.version,APP_VERSION)<=0){removeUpdateBanner();return}
    latestPublishedVersion=info;
    if(!updateBanner){
      updateBanner=document.createElement('aside');
      updateBanner.className='pwa-update-banner';
      updateBanner.setAttribute('role','status');
      updateBanner.setAttribute('aria-live','polite');
      document.body.appendChild(updateBanner);
    }
    updateBanner.innerHTML=
      '<div class="pwa-update-icon" aria-hidden="true">↻</div>'+
      '<div class="pwa-update-copy"><strong>'+(info.title||'Dostępna aktualizacja aplikacji')+'</strong>'+
      '<span>'+(info.message||'Opublikowaliśmy nową wersję Centrum Marketingowego.')+'</span>'+
      '<small>Wersja '+String(info.version||'')+'</small></div>'+
      '<div class="pwa-update-actions"><button type="button" class="pwa-update-now">Aktualizuj aplikację</button>'+
      '<button type="button" class="pwa-update-later">Później</button></div>';
    updateBanner.querySelector('.pwa-update-now').onclick=()=>forceAppUpdate(info.version);
    updateBanner.querySelector('.pwa-update-later').onclick=()=>removeUpdateBanner();
  }

  async function fetchPublishedVersion(){
    try{
      const response=await fetch(VERSION_URL+'?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!response.ok)return null;
      return await response.json();
    }catch{return null}
  }

  async function checkPublishedVersion(showFeedback=false){
    const info=await fetchPublishedVersion();
    if(info&&versionCmp(info.version,APP_VERSION)>0){
      ensureUpdateBanner(info);
      return {update:true,info};
    }
    if(showFeedback){
      const msg=document.querySelector('#pwaMessage');
      if(msg){
        msg.textContent='Masz najnowszą wersję aplikacji ('+APP_VERSION+').';
        msg.className='pwa-message success';
      }
    }
    return {update:false,info};
  }

  async function forceAppUpdate(targetVersion){
    const button=updateBanner?.querySelector('.pwa-update-now');
    if(button){button.disabled=true;button.textContent='Aktualizuję…'}
    try{
      if('caches' in window){
        const keys=await caches.keys();
        await Promise.all(keys.filter(key=>key.startsWith('pereko-marketing-pwa-')).map(key=>caches.delete(key)));
      }
      const regs=await navigator.serviceWorker?.getRegistrations?.()||[];
      for(const reg of regs){
        try{
          await reg.update();
          if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
        }catch{}
      }
      sessionStorage.setItem('pereko_force_version',String(targetVersion||'latest'));
      const url=new URL(location.href);
      url.searchParams.set('app-update',Date.now().toString());
      setTimeout(()=>location.replace(url.href),450);
    }catch(e){
      console.warn('PWA manual update:',e);
      if(button){button.disabled=false;button.textContent='Spróbuj ponownie'}
    }
  }

  function addManualUpdateControl(){
    ensureSettings();
    if(!settingsModal||settingsModal.querySelector('#pwaManualUpdateSection'))return;
    const section=document.createElement('section');
    section.className='pwa-section';
    section.id='pwaManualUpdateSection';
    section.innerHTML='<div class="pwa-section-head"><div><span>AKTUALIZACJE</span><h4>Wersja aplikacji</h4></div></div>'+
      '<p>Aktualna wersja: <b>'+APP_VERSION+'</b>. Aplikacja sprawdza nowe wydania automatycznie, ale możesz też wymusić sprawdzenie ręcznie.</p>'+
      '<div class="pwa-actions"><button class="pwa-secondary" id="pwaCheckUpdateBtn" type="button">Sprawdź aktualizacje</button>'+
      '<button class="pwa-secondary" id="pwaWhatsNewBtn" type="button">Co nowego?</button>'+
      '<button class="pwa-primary" id="pwaForceUpdateBtn" type="button">Odśwież aplikację</button></div>';
    settingsModal.querySelector('.pwa-content')?.appendChild(section);
    section.querySelector('#pwaCheckUpdateBtn').onclick=async()=>{
      const result=await checkPublishedVersion(true);
      if(result.update)openSettings();
    };
    section.querySelector('#pwaWhatsNewBtn').onclick=openChangelog;
    section.querySelector('#pwaForceUpdateBtn').onclick=()=>forceAppUpdate(latestPublishedVersion?.version||'latest');
  }


  async function getReleaseInfo(){
    if(latestPublishedVersion)return latestPublishedVersion;
    latestPublishedVersion=await fetchPublishedVersion();
    return latestPublishedVersion;
  }

  async function openChangelog(){
    ensureSettings();
    let modal=document.querySelector('#pwaChangelogModal');
    if(!modal){
      modal=document.createElement('div');
      modal.className='pwa-modal';
      modal.id='pwaChangelogModal';
      modal.innerHTML='<div class="pwa-card pwa-changelog-card"><div class="pwa-head"><div><span class="pwa-kicker">CO NOWEGO</span><h3>Historia zmian</h3><p>Najważniejsze zmiany w Centrum Marketingowym PEREKO.</p></div><button class="pwa-close" type="button" aria-label="Zamknij">×</button></div><div class="pwa-content"><div class="pwa-changelog-loading">Ładowanie informacji o wersji…</div></div></div>';
      document.body.appendChild(modal);
      modal.querySelector('.pwa-close').onclick=()=>modal.classList.remove('open');
      modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};
    }
    modal.classList.add('open');
    const content=modal.querySelector('.pwa-content');
    const info=await getReleaseInfo();
    if(!info){
      content.innerHTML='<div class="pwa-message warn">Nie udało się pobrać informacji o wersji.</div>';
      return;
    }
    const changes=Array.isArray(info.changes)?info.changes:[];
    content.innerHTML='<section class="pwa-section pwa-changelog-release">'+
      '<div class="pwa-changelog-version-row"><div><span>AKTUALNA WERSJA</span><strong>v'+String(info.version||APP_VERSION)+'</strong></div>'+
      '<small>'+(info.releasedLabel||'')+'</small></div>'+
      '<h4>'+(info.releaseName||'Centrum Marketingowe PEREKO')+'</h4>'+
      '<p>'+(info.releaseSummary||info.message||'')+'</p>'+
      (changes.length?'<ul class="pwa-changelog-list">'+changes.map(x=>'<li><span>✓</span><div><strong>'+String(x.title||x)+'</strong>'+(x.detail?'<small>'+String(x.detail)+'</small>':'')+'</div></li>').join('')+'</ul>':'')+
      '</section>';
  }
  window.perekoOpenChangelog=openChangelog;


  function addAppVersionCard(){
    ensureSettings();
    const content=settingsModal?.querySelector('.pwa-content');
    if(!content||content.querySelector('#pwaAppVersionCard'))return;
    const card=document.createElement('section');
    card.className='pwa-app-version-card';
    card.id='pwaAppVersionCard';
    card.innerHTML='<div class="pwa-app-version-mark">P</div>'+
      '<div class="pwa-app-version-copy"><span>AKTUALNA WERSJA APLIKACJI</span><strong>Centrum Marketingowe PEREKO <b>2.0</b></strong><small>Wersja techniczna '+APP_VERSION+'</small></div>'+
      '<button class="pwa-app-version-more" type="button">Co nowego?</button>';
    content.prepend(card);
    card.querySelector('.pwa-app-version-more').onclick=openChangelog;
  }

  async function maybeShowReleaseWelcome(){
    if(!isStandalone())return;
    const key='pereko_release_seen_'+APP_VERSION;
    if(localStorage.getItem(key)==='1')return;
    const info=await getReleaseInfo();
    let modal=document.querySelector('#pwaReleaseWelcome');
    if(!modal){
      modal=document.createElement('div');
      modal.className='pwa-modal pwa-release-welcome';
      modal.id='pwaReleaseWelcome';
      modal.innerHTML='<div class="pwa-onboarding-card pwa-release-welcome-card">'+
        '<div class="mark">P</div>'+
        '<span>NOWA WERSJA</span>'+
        '<h3>Centrum Marketingowe PEREKO 2.0</h3>'+
        '<p>'+(info?.releaseSummary||'Aplikacja została zaktualizowana do nowej wersji.')+'</p>'+
        '<div class="pwa-release-version">Wersja '+APP_VERSION+'</div>'+
        '<div class="pwa-onboarding-actions"><button class="primary" id="pwaReleaseWhatsNew" type="button">Zobacz co nowego</button><button class="later" id="pwaReleaseOk" type="button">OK</button></div>'+
        '</div>';
      document.body.appendChild(modal);
      modal.querySelector('#pwaReleaseWhatsNew').onclick=()=>{
        localStorage.setItem(key,'1');
        modal.classList.remove('open');
        openChangelog();
      };
      modal.querySelector('#pwaReleaseOk').onclick=()=>{
        localStorage.setItem(key,'1');
        modal.classList.remove('open');
      };
    }
    modal.classList.add('open');
  }

  function installMeta(){
    if(isStandalone())return {title:'Zainstalowana',detail:'Uruchamiasz Centrum Marketingowe jak aplikację.'};
    if(!isIOS()&&!isAndroid())return {title:'Wersja przeglądarkowa',detail:'Na komputerze korzystaj z Centrum Marketingowego bezpośrednio w przeglądarce.'};
    return {title:'Niezainstalowana',detail:isIOS()?'Dodaj stronę do ekranu początkowego w Safari.':'Możesz zainstalować aplikację na tym urządzeniu.'};
  }
  function notificationMeta(){
    if(!hasNotifications())return {title:'Niedostępne',detail:'Ta przeglądarka nie obsługuje powiadomień webowych.'};
    if(Notification.permission==='granted')return {title:'Dozwolone',detail:'Urządzenie może wyświetlać powiadomienia systemowe.'};
    if(Notification.permission==='denied')return {title:'Zablokowane',detail:'Zmień zgodę na powiadomienia w ustawieniach systemu/przeglądarki.'};
    return {title:'Wyłączone',detail:'Włącz je jednym przyciskiem po zalogowaniu.'};
  }

  let swRefreshInProgress=false;
  let swUpdateTimer=null;

  function activateWaitingWorker(reg){
    try{
      if(reg?.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
    }catch(e){
      console.warn('PWA activate waiting worker:',e);
    }
  }

  async function checkForAppUpdate(){
    if(!registration)return null;
    try{
      await registration.update();
      activateWaitingWorker(registration);
      return registration;
    }catch(e){
      console.warn('PWA update check:',e);
      return registration;
    }
  }

  async function registerSW(){
    if(!('serviceWorker' in navigator))return null;
    try{
      registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});

      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(swRefreshInProgress)return;
        swRefreshInProgress=true;
        setTimeout(()=>location.reload(),250);
      });

      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            activateWaitingWorker(registration);
          }
        });
      });

      await navigator.serviceWorker.ready;
      await checkForAppUpdate();

      clearInterval(swUpdateTimer);
      swUpdateTimer=setInterval(()=>checkForAppUpdate(),5*60*1000);

      return registration;
    }catch(e){
      console.warn('PWA Service Worker:',e);
      return null;
    }
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    window.__perekoInstallPrompt=event;
    refreshAll();
  });
  window.addEventListener('pereko:install-prompt-ready',()=>{
    deferredPrompt=window.__perekoInstallPrompt||deferredPrompt;
    refreshAll();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    window.__perekoInstallPrompt=null;
    localStorage.removeItem(LS.installDismissed);
    refreshAll();
  });

  function iosGuide(){
    return '<div class="pwa-guide"><strong>iPhone / iPad — instalacja przez Safari</strong><ol><li><b>Otwórz Centrum Marketingowe w Safari.</b> Na iOS/iPadOS instalację wykonujemy z przeglądarki Safari.</li><li><b>Stuknij Udostępnij → „Dodaj do ekranu początkowego” → „Dodaj”.</b> Następnie uruchom aplikację z nowej ikony PEREKO.</li><li><b>Zaloguj się i aktywuj Web Push.</b> Wejdź w „Aplikacja i powiadomienia” → „Włącz/Połącz powiadomienia” → zaakceptuj zgodę systemową. Wtedy powiadomienia będą przychodziły także przy zamkniętej aplikacji.</li></ol><small>Instalację i połączenie powiadomień wykonuje się osobno na każdym nowym urządzeniu mobilnym.</small></div>';
  }
  function androidGuide(){
    return '<div class="pwa-guide"><strong>Android — instalacja przez Google Chrome</strong><ol><li><b>Otwórz Centrum Marketingowe bezpośrednio w Google Chrome.</b> To ważne — do instalacji aplikacji na Androidzie korzystamy z Chrome. Jeżeli link otworzył się w innej aplikacji lub przeglądarce, wybierz „Otwórz w Chrome”.</li><li><b>Kliknij „Zainstaluj aplikację”.</b> Chrome wyświetli systemowe okno instalacji — potwierdź instalację. Jeżeli przycisk nie jest jeszcze dostępny, otwórz menu ⋮ Chrome i wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.</li><li><b>Uruchom PEREKO z nowej ikony, zaloguj się i połącz powiadomienia.</b> Wejdź w „Aplikacja i powiadomienia” → „Włącz/Połącz powiadomienia” → zaakceptuj zgodę systemową. Wtedy Web Push będzie działał także przy zamkniętej aplikacji.</li></ol><small>Instalację i połączenie powiadomień wykonuje się osobno na każdym nowym smartfonie lub tablecie.</small></div>';
  }
  function desktopGuide(){
    return '<div class="pwa-guide"><strong>Aplikacja mobilna PEREKO</strong><p>Instalację aplikacji przewidujemy na smartfonach i tabletach z systemem <b>Android</b> lub <b>iOS/iPadOS</b>. Na komputerze nie musisz nic instalować — Centrum Marketingowe działa normalnie bezpośrednio w przeglądarce.</p><small>Aby zainstalować aplikację na telefonie lub tablecie, otwórz tę stronę na urządzeniu mobilnym i skorzystaj z instrukcji dla iOS lub Androida.</small></div>';
  }

  function installPromptEvent(){
    return deferredPrompt||window.__perekoInstallPrompt||null;
  }

  function waitForInstallPrompt(timeout=2200){
    const existing=installPromptEvent();
    if(existing)return Promise.resolve(existing);
    return new Promise(resolve=>{
      let done=false;
      const finish=value=>{
        if(done)return;
        done=true;
        window.removeEventListener('beforeinstallprompt',onPrompt);
        window.removeEventListener('pereko:install-prompt-ready',onReady);
        clearTimeout(timer);
        resolve(value||installPromptEvent());
      };
      const onPrompt=event=>finish(event);
      const onReady=()=>finish(installPromptEvent());
      window.addEventListener('beforeinstallprompt',onPrompt,{once:true});
      window.addEventListener('pereko:install-prompt-ready',onReady,{once:true});
      const timer=setTimeout(()=>finish(null),timeout);
    });
  }

  function loginPlatformGuide(){
    return '<div class="pwa-login-guide"><div><strong>iPhone / iPad — Safari</strong><ol><li><b>Otwórz stronę w Safari.</b></li><li><b>Udostępnij → Dodaj do ekranu początkowego → Dodaj.</b> Uruchom aplikację z ikony PEREKO i zaloguj się.</li><li><b>Włącz Web Push:</b> Aplikacja i powiadomienia → Włącz/Połącz powiadomienia → zaakceptuj zgodę systemową.</li></ol></div><div><strong>Android — Google Chrome</strong><ol><li><b>Otwórz stronę bezpośrednio w Chrome.</b> Do instalacji na Androidzie używamy Google Chrome.</li><li><b>Kliknij „Zainstaluj aplikację” i potwierdź instalację.</b> Potem uruchom PEREKO z nowej ikony i zaloguj się.</li><li><b>Włącz Web Push:</b> Aplikacja i powiadomienia → Włącz/Połącz powiadomienia → zaakceptuj zgodę systemową.</li></ol></div><p class="pwa-login-guide-note">Na komputerze instalacja nie jest potrzebna — korzystaj z wersji przeglądarkowej. Powiadomienia mobilne trzeba połączyć osobno na każdym urządzeniu.</p></div>';
  }

  async function installApp(){
    if(isStandalone())return true;
    if(!isIOS()&&!isAndroid()){
      showInstallHelp(true);
      return false;
    }

    if(!installPromptEvent()&&!isIOS()){
      await registerSW();
      const prompt=await waitForInstallPrompt();
      if(prompt)deferredPrompt=prompt;
    }

    const prompt=installPromptEvent();
    if(prompt){
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice.catch(()=>null);
        if(choice?.outcome==='accepted')localStorage.removeItem(LS.installDismissed);
        deferredPrompt=null;
        window.__perekoInstallPrompt=null;
        refreshAll();
        return choice?.outcome==='accepted';
      }catch(e){
        console.warn('PWA install prompt:',e);
      }
    }

    showInstallHelp(true);
    return false;
  }

  async function desktopInstallChecks(){
    const checks={https:location.protocol==='https:',manifest:false,icons:false,serviceWorker:false};
    try{
      const link=document.querySelector('link[rel="manifest"]');
      if(link){
        const response=await fetch(link.href,{cache:'no-store'});
        const manifest=response.ok?await response.json():null;
        checks.manifest=!!(manifest&&(manifest.name||manifest.short_name)&&manifest.start_url&&(manifest.display||manifest.display_override));
        const sizes=(manifest?.icons||[]).map(icon=>String(icon.sizes||''));
        checks.icons=sizes.some(x=>x.includes('192x192'))&&sizes.some(x=>x.includes('512x512'));
      }
    }catch{}
    try{
      const reg=await navigator.serviceWorker?.getRegistration('/');
      checks.serviceWorker=!!reg;
    }catch{}
    return checks;
  }

  async function showDesktopInstallWaiting(){
    const loginPanel=document.querySelector('#pwaLoginPanel');
    const elapsed=Math.max(0,Math.round((Date.now()-pageOpenedAt)/1000));
    const checks=await desktopInstallChecks();
    const allTechnical=checks.https&&checks.manifest&&checks.icons&&checks.serviceWorker;
    const technical='<span class="pwa-install-checks">'+
      'HTTPS: <b>'+(checks.https?'OK':'BŁĄD')+'</b> · '+
      'manifest: <b>'+(checks.manifest?'OK':'BŁĄD')+'</b> · '+
      'ikony: <b>'+(checks.icons?'OK':'BŁĄD')+'</b> · '+
      'Service Worker: <b>'+(checks.serviceWorker?'OK':'BŁĄD')+'</b></span>';
    const text=allTechnical
      ?'<strong>Chrome jeszcze nie udostępnił instalatora.</strong><p>Od strony technicznej PWA jest gotowa. Chrome może uruchomić instalację dopiero po spełnieniu własnych warunków aktywności użytkownika. Pozostaw tę kartę otwartą przez około 30 sekund, wykonaj co najmniej jedno kliknięcie na stronie i kliknij „Zainstaluj aplikację” ponownie. Gdy Chrome udostępni instalator, pojawi się natywne okno instalacji.</p>'
      :'<strong>Przeglądarka nie uznała jeszcze strony za gotową do instalacji.</strong><p>Sprawdzam podstawowe elementy PWA poniżej. Jeśli któryś ma status BŁĄD, instalator Chrome nie zostanie udostępniony.</p>';
    if(loginPanel&&!window.perekoLoggedPerson){
      const box=loginPanel.querySelector('.pwa-login-help');
      if(box){
        box.innerHTML='<div class="pwa-guide pwa-install-wait">'+text+technical+'<small>Czas od otwarcia tej strony: '+elapsed+' s. Przycisk instalacji nie powinien już otwierać instrukcji iOS/Android.</small></div>';
        box.dataset.open='1';
      }
      return;
    }
    ensureSettings();
    settingsModal.classList.add('open');
    const guide=settingsModal.querySelector('#pwaInstallGuide');
    if(guide){
      guide.innerHTML='<div class="pwa-guide pwa-install-wait">'+text+technical+'<small>Czas od otwarcia tej strony: '+elapsed+' s.</small></div>';
      guide.hidden=false;
    }
  }

  function setLoginHelpExpanded(open){
    if(!document.querySelector('.login-minimal-page'))return;
    document.body.classList.toggle('login-pwa-expanded',!!open);
  }

  function closeLoginHelp(box){
    if(!box)return;
    box.innerHTML='';
    box.dataset.open='0';
    setLoginHelpExpanded(false);
  }

  function openLoginHelp(box,html){
    if(!box)return;
    box.innerHTML='<div class="pwa-login-help-content">'+html+'<div class="pwa-login-help-close-row"><button class="pwa-login-help-close" type="button">Zapoznałem się</button></div></div>';
    box.dataset.open='1';
    setLoginHelpExpanded(true);
    box.querySelector('.pwa-login-help-close')?.addEventListener('click',()=>closeLoginHelp(box));
  }

  function showInstallHelp(fromInstallButton=false){
    const loginPanel=document.querySelector('#pwaLoginPanel');
    if(loginPanel&&!window.perekoLoggedPerson){
      const box=loginPanel.querySelector('.pwa-login-help');
      if(box){
        openLoginHelp(
          box,
          fromInstallButton
            ?(isIOS()?iosGuide():isAndroid()?androidGuide():desktopGuide())
            :loginPlatformGuide()
        );
      }
      return;
    }
    ensureSettings();
    settingsModal.classList.add('open');
    const guide=settingsModal.querySelector('#pwaInstallGuide');
    if(guide){
      guide.innerHTML=isIOS()?iosGuide():isAndroid()?androidGuide():desktopGuide();
      guide.hidden=false;
    }
  }

  function buildLoginPanel(){
    if(!document.querySelector('#loginForm')||document.querySelector('#pwaLoginPanel'))return;
    const wrap=document.querySelector('.login-minimal-wrap');
    const loginPanel=document.querySelector('.login-panel-minimal');
    if(!wrap||!loginPanel)return;
    document.body.classList.add('login-pwa-static');
    const panel=document.createElement('section');
    panel.className='pwa-login-panel';
    panel.id='pwaLoginPanel';
    const desktop=!isIOS()&&!isAndroid();
    panel.innerHTML='<strong>Centrum Marketingowe także jako aplikacja</strong><p>'+(desktop?'Aplikację instalujemy na smartfonach i tabletach. Android: otwórz stronę w Google Chrome. iPhone/iPad: otwórz stronę w Safari. Na komputerze korzystaj bezpośrednio z wersji przeglądarkowej.':isAndroid()?'Na Androidzie otwórz Centrum Marketingowe w Google Chrome, kliknij „Zainstaluj aplikację”, uruchom PEREKO z nowej ikony, zaloguj się i połącz powiadomienia.':'Na iPhone/iPad otwórz stronę w Safari, wybierz Udostępnij → Dodaj do ekranu początkowego, uruchom aplikację, zaloguj się i połącz powiadomienia.')+'</p><div class="pwa-login-actions"><button class="install" type="button">'+(desktop?'Android / iOS':'Zainstaluj aplikację')+'</button><button class="help" type="button">Jak to działa?</button></div><div class="pwa-login-help"></div>';
    loginPanel.appendChild(panel);
    panel.querySelector('.install').onclick=desktop?()=>showInstallHelp(true):installApp;
    panel.querySelector('.help').onclick=()=>{
      const box=panel.querySelector('.pwa-login-help');
      const open=box.dataset.open==='1';
      if(open)closeLoginHelp(box);
      else openLoginHelp(box,loginPlatformGuide());
    };
    if(isStandalone())panel.hidden=true;
  }

  function addSettingsButton(){
    if(!document.querySelector('.topbar-actions')||document.querySelector('#pwaSettingsBtn'))return;
    const btn=document.createElement('button');
    btn.className='pwa-settings-btn top-action-icon';
    btn.id='pwaSettingsBtn';
    btn.type='button';
    btn.dataset.tooltip='Aplikacja i powiadomienia';
    btn.setAttribute('aria-label','Aplikacja i powiadomienia');
    btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 8a5 5 0 0 0-10 0c0 5-2 5.5-2 7h14c0-1.5-2-2-2-7Zm-7 9h4a2 2 0 0 1-4 0ZM12 1a7 7 0 0 1 7 7c0 3.58 1.12 4.64 1.67 5.17.45.42.83.79.83 1.83v2H2.5v-2c0-1.04.38-1.41.83-1.83C3.88 12.64 5 11.58 5 8a7 7 0 0 1 7-7Z"/></svg><span class="pwa-mini-dot"></span>';
    const team=document.querySelector('#teamTopBtn');
    const password=document.querySelector('#changePasswordBtn');
    (team||password)?.before(btn);
    btn.onclick=()=>openSettings();
  }

  function ensureSettings(){
    if(settingsModal)return;
    settingsModal=document.createElement('div');
    settingsModal.className='pwa-modal';
    settingsModal.id='pwaSettingsModal';
    settingsModal.innerHTML='<div class="pwa-card"><div class="pwa-head"><div><span class="pwa-kicker">APLIKACJA PEREKO</span><h3>Aplikacja i powiadomienia</h3><p>Instalacja, status urządzenia i preferencje powiadomień.</p></div><button class="pwa-close" type="button" aria-label="Zamknij">×</button></div><div class="pwa-content"><div class="pwa-status-grid"><div class="pwa-status-card"><span>APLIKACJA</span><strong id="pwaInstallStatus">—</strong><small id="pwaInstallDetail">—</small></div><div class="pwa-status-card"><span>POWIADOMIENIA</span><strong id="pwaNotifyStatus">—</strong><small id="pwaNotifyDetail">—</small></div></div><section class="pwa-section"><div class="pwa-section-head"><div><span>INSTALACJA</span><h4>Centrum Marketingowe na urządzeniu</h4></div></div><p id="pwaInstallIntro">Po instalacji wykonaj 3 kroki: uruchom aplikację z ikony PEREKO, zaloguj się, a następnie włącz/połącz powiadomienia systemowe. Bez ostatniego kroku Web Push nie będzie działał przy zamkniętej aplikacji.</p><div class="pwa-actions"><button class="pwa-primary" id="pwaInstallBtn" type="button">Zainstaluj aplikację</button><button class="pwa-secondary" id="pwaInstallHelpBtn" type="button">Instrukcja iOS / Android</button></div><div id="pwaInstallGuide" hidden></div><div class="pwa-qr-wrap" id="pwaQrWrap"><img src="/icons/install-qr.png" alt="Kod QR do Centrum Marketingowego"><div><strong>Otwórz na telefonie</strong><p>Zeskanuj kod aparatem, zaloguj się i dodaj aplikację do ekranu głównego.</p></div></div></section><section class="pwa-section"><div class="pwa-section-head"><div><span>POWIADOMIENIA</span><h4>Co ma trafiać na telefon</h4></div></div><p>Powiadomienia są wysyłane tylko dla zdarzeń związanych z Twoją pracą. Preferencje są zapisywane osobno dla tego urządzenia.</p><div class="pwa-actions"><button class="pwa-primary" id="pwaEnableNotifications" type="button">Włącz powiadomienia</button><button class="pwa-secondary" id="pwaTestNotification" type="button">Test powiadomienia</button></div><div class="pwa-prefs" id="pwaPrefs"></div><div class="pwa-message" id="pwaMessage"></div></section><section class="pwa-section"><div class="pwa-section-head"><div><span>URZĄDZENIE</span><h4 id="pwaDeviceTitle">To urządzenie</h4></div></div><p id="pwaDeviceInfo"></p></section></div></div>';
    document.body.appendChild(settingsModal);
    settingsModal.querySelector('.pwa-close').onclick=closeSettings;
    settingsModal.onclick=e=>{if(e.target===settingsModal)closeSettings()};
    settingsModal.querySelector('#pwaInstallBtn').onclick=installApp;
    settingsModal.querySelector('#pwaInstallHelpBtn').onclick=()=>{
      const g=settingsModal.querySelector('#pwaInstallGuide');
      g.innerHTML=isIOS()?iosGuide():isAndroid()?androidGuide():desktopGuide();g.hidden=!g.hidden;
    };
    settingsModal.querySelector('#pwaEnableNotifications').onclick=enableNotifications;
    settingsModal.querySelector('#pwaTestNotification').onclick=testNotification;

    const isAdmin=String(window.perekoLoggedPerson?.email||'').trim().toLowerCase()==='michal.bukowski@pereko.pl';
    if(isAdmin){
      const adminSection=document.createElement('section');
      adminSection.className='pwa-section pwa-admin-sync';
      adminSection.innerHTML='<div class="pwa-section-head"><div><span>ADMINISTRACJA</span><h4>Synchronizacja danych</h4></div></div><p>Dane zapisują się automatycznie. Ten przycisk służy wyłącznie do ręcznego wymuszenia zapisu centralnego przez administratora.</p><div class="pwa-actions"><button class="pwa-secondary" id="pwaAdminSyncBtn" type="button">Synchronizuj teraz</button></div><div class="pwa-message" id="pwaAdminSyncMessage"></div>';
      settingsModal.querySelector('.pwa-content')?.appendChild(adminSection);
      adminSection.querySelector('#pwaAdminSyncBtn').onclick=async()=>{
        const btn=adminSection.querySelector('#pwaAdminSyncBtn');
        const msg=adminSection.querySelector('#pwaAdminSyncMessage');
        btn.disabled=true;btn.textContent='Synchronizowanie…';
        msg.textContent='Wymuszam zapis danych centralnych…';msg.className='pwa-message';
        try{
          const ok=typeof window.perekoFlushSync==='function'&&await window.perekoFlushSync();
          msg.textContent=ok?'Dane zostały zsynchronizowane centralnie.':'Synchronizacja nie jest jeszcze gotowa. Spróbuj za chwilę.';
          msg.className='pwa-message '+(ok?'ok':'warn');
        }catch(e){
          msg.textContent='Nie udało się zsynchronizować danych: '+(e?.message||'nieznany błąd')+'.';
          msg.className='pwa-message error';
        }finally{
          btn.disabled=false;btn.textContent='Synchronizuj teraz';
        }
      };
    }
    renderPrefs();
  }
  function closeSettings(){settingsModal?.classList.remove('open')}
  function openSettings(){ensureSettings();addAppVersionCard();refreshSettings();settingsModal.classList.add('open')}

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
    const desktop=!isIOS()&&!isAndroid();
    settingsModal.querySelector('#pwaInstallBtn').disabled=isStandalone();
    settingsModal.querySelector('#pwaInstallBtn').textContent=isStandalone()
      ?'Aplikacja zainstalowana'
      :desktop?'Android / iOS'
      :isIOS()?'Instrukcja instalacji'
      :installPromptEvent()?'Zainstaluj aplikację':'Jak zainstalować na Androidzie';
    settingsModal.querySelector('#pwaInstallIntro').textContent=desktop
      ?'Aplikację instalujemy na smartfonach i tabletach. Android: otwórz Centrum Marketingowe w Google Chrome. iPhone/iPad: użyj Safari. Na komputerze korzystaj bezpośrednio z wersji przeglądarkowej — instalacja nie jest potrzebna.'
      :isAndroid()
        ?'Android: instalację wykonaj w Google Chrome. Kliknij „Zainstaluj aplikację”, uruchom PEREKO z nowej ikony, zaloguj się, a potem włącz/połącz powiadomienia systemowe.'
        :'iPhone/iPad: otwórz stronę w Safari → Udostępnij → Dodaj do ekranu początkowego. Uruchom aplikację, zaloguj się, a potem włącz/połącz powiadomienia systemowe.';
    settingsModal.querySelector('#pwaEnableNotifications').disabled=!hasNotifications();
    settingsModal.querySelector('#pwaEnableNotifications').textContent=hasNotifications()&&Notification.permission==='granted'?'Połącz powiadomienia':'Włącz powiadomienia';
    settingsModal.querySelector('#pwaDeviceTitle').textContent=platformName();
    settingsModal.querySelector('#pwaDeviceInfo').textContent=(isStandalone()?'Tryb aplikacji · ':'Tryb przeglądarki · ')+(navigator.onLine?'online':'offline')+'. Identyfikator urządzenia: '+deviceId().slice(0,8)+'…';
    settingsModal.querySelector('#pwaQrWrap').hidden=isMobile();
  }
  function ensureMobileInstallCta(){
    let cta=document.querySelector('#pwaMobileInstallCta');
    if(!isMobile()||isStandalone()){
      cta?.remove();
      return null;
    }

    const onLogin=!!document.querySelector('#loginForm');
    const host=onLogin
      ?document.querySelector('#loginForm')
      :document.querySelector('.page-shell');
    if(!host)return null;

    if(!cta){
      cta=document.createElement('button');
      cta.id='pwaMobileInstallCta';
      cta.className='pwa-mobile-install-cta '+(onLogin?'pwa-mobile-install-login':'pwa-mobile-install-dashboard');
      cta.type='button';
      cta.setAttribute('aria-label','Zainstaluj aplikację PEREKO');
      cta.innerHTML='<span class="pwa-mobile-install-mark" aria-hidden="true">P</span><span class="pwa-mobile-install-copy"><strong>Zainstaluj aplikację PEREKO</strong><small>PEREKO na telefonie</small></span><span class="pwa-mobile-install-action">Zainstaluj</span>';
      cta.addEventListener('click',installApp);

      if(onLogin){
        const loginSubmit=host.querySelector('.login-submit');
        if(loginSubmit)loginSubmit.insertAdjacentElement('afterend',cta);
        else host.appendChild(cta);
      }else{
        host.insertAdjacentElement('afterbegin',cta);
      }
    }

    cta.classList.toggle('pwa-mobile-install-login',onLogin);
    cta.classList.toggle('pwa-mobile-install-dashboard',!onLogin);
    const small=cta.querySelector('small');
    const action=cta.querySelector('.pwa-mobile-install-action');
    if(isIOS()){
      if(small)small.textContent='iPhone / iPad — instalacja przez Safari';
      if(action)action.textContent='Instrukcja';
    }else if(isAndroid()){
      if(small)small.textContent=installPromptEvent()?'Android — aplikacja gotowa do instalacji':'Android — instalacja w Google Chrome';
      if(action)action.textContent=installPromptEvent()?'Zainstaluj':'Jak zainstalować';
    }else{
      if(small)small.textContent='Aplikacja mobilna PEREKO';
      if(action)action.textContent='Zainstaluj';
    }
    cta.dataset.ready=installPromptEvent()?'1':'0';
    return cta;
  }

  function refreshAttention(){
    const btn=document.querySelector('#pwaSettingsBtn');
    if(!btn)return;
    const needsInstall=isMobile()&&!isStandalone();
    const needsNotify=isStandalone()&&hasNotifications()&&Notification.permission!=='granted';
    btn.classList.toggle('has-attention',needsInstall||needsNotify);
  }
  function refreshInstallUi(){
    const ready=!!installPromptEvent();
    document.querySelectorAll('#pwaLoginPanel .install,#pwaInstallBtn').forEach(btn=>{
      if(isStandalone()){
        btn.textContent='Aplikacja zainstalowana';
        btn.disabled=true;
        btn.dataset.installReady='1';
        return;
      }
      btn.disabled=false;
      btn.dataset.installReady=ready?'1':'0';
      if(isAndroid()){
        btn.textContent=ready?'Zainstaluj aplikację':'Jak zainstalować na Androidzie';
        btn.title=ready?'Otwórz instalator aplikacji PEREKO':'Chrome nie udostępnił automatycznego instalatora — pokaż instrukcję instalacji z menu przeglądarki.';
      }else if(isIOS()){
        btn.textContent='Instrukcja instalacji';
        btn.title='Na iOS aplikację dodaje się przez Safari → Udostępnij → Dodaj do ekranu początkowego.';
      }else{
        btn.textContent='Android / iOS';
        btn.title='Aplikację instalujemy na smartfonach i tabletach. Na komputerze korzystaj z wersji przeglądarkowej.';
      }
    });
  }
  function refreshAll(){refreshSettings();refreshAttention();refreshInstallUi();ensureMobileInstallCta();const login=document.querySelector('#pwaLoginPanel');if(login&&isStandalone())login.hidden=true}

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
    addManualUpdateControl();
    addAppVersionCard();
    refreshAll();
    setTimeout(maybeOnboard,750);
    setTimeout(maybeShowReleaseWelcome,1200);
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
      checkForAppUpdate();
      checkPublishedVersion();
      try{navigator.clearAppBadge?.()}catch{}
    }
  });
  window.addEventListener('focus',()=>{
    checkForAppUpdate();
    checkPublishedVersion();
    try{navigator.clearAppBadge?.()}catch{}
  });

  registerSW();
  checkPublishedVersion();
  clearInterval(updateCheckTimer);
  updateCheckTimer=setInterval(()=>checkPublishedVersion(),5*60*1000);
  buildLoginPanel();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{buildLoginPanel();addSettingsButton();refreshAll();handleDeepLink(location.href)});
  else{addSettingsButton();refreshAll();handleDeepLink(location.href)}
})();
