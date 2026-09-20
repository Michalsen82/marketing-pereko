(()=>{
  const statusEl=document.querySelector('#footerSyncStatus');
  const statusText=document.querySelector('#footerSyncText');
  const syncCard=document.querySelector('#syncCard');
  const syncTitle=document.querySelector('#syncTitle');

  const mirror=()=>{
    if(!statusEl||!statusText||!syncCard)return;
    const state=syncCard.dataset.state||'local';
    statusEl.dataset.state=state;
    statusText.textContent=syncTitle?.textContent||'Status synchronizacji';
  };

  if(syncCard){
    mirror();
    new MutationObserver(mirror).observe(syncCard,{
      attributes:true,
      attributeFilter:['data-state'],
      subtree:true,
      childList:true,
      characterData:true
    });
  }


  async function initVersionInfo(){
    const actions=document.querySelector('.footer-actions');
    if(!actions)return;
    const wrap=document.createElement('div');
    wrap.className='footer-version-wrap';
    wrap.innerHTML='<span class="footer-version-badge">Wersja <b>2.0</b></span><button class="footer-whats-new" type="button">Co nowego?</button>';
    actions.prepend(wrap);
    try{
      const r=await fetch('/app-version.json?t='+Date.now(),{cache:'no-store'});
      const info=r.ok?await r.json():null;
      if(info?.version){
        wrap.querySelector('.footer-version-badge').innerHTML='Wersja <b>'+String(info.version).replace(/\.0$/,'')+'</b>';
      }
    }catch{}
    wrap.querySelector('.footer-whats-new').onclick=()=>{
      if(typeof window.perekoOpenChangelog==='function')window.perekoOpenChangelog();
    };
  }

  initVersionInfo();
})();