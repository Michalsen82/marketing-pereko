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
})();