(()=>{
  const syncBtn=document.querySelector('#footerSyncNow');
  const statusBtn=document.querySelector('#footerSyncStatus');
  const statusText=document.querySelector('#footerSyncText');
  const syncCard=document.querySelector('#syncCard');
  const syncTitle=document.querySelector('#syncTitle');

  const mirror=()=>{
    if(!statusBtn||!statusText||!syncCard)return;
    const state=syncCard.dataset.state||'local';
    statusBtn.dataset.state=state;
    statusText.textContent=syncTitle?.textContent||'Status synchronizacji';
  };

  if(syncBtn){
    syncBtn.addEventListener('click',()=>document.querySelector('#syncNow')?.click());
  }

  if(syncCard){
    mirror();
    new MutationObserver(mirror).observe(syncCard,{attributes:true,attributeFilter:['data-state'],subtree:true,childList:true,characterData:true});
  }
})();
