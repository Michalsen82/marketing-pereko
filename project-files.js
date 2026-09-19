(()=>{
  const API='/api/project-files-gateway';
  const MAX_FILE_BYTES=5*1024*1024;
  const FREE_STORAGE_BYTES=10*1000*1000*1000;
  const CHUNK_SIZE=MAX_FILE_BYTES;
  const DEMO_PROJECT_ID='p1';
  const DEMO_FILE_BYTES=Math.round(1.5*1024*1024);
  const DEMO_ASSET_ID='demo-r2-1500kb';
  let demoState='active';
  let currentProject=null;
  let storageUsage=null;
  let globalTrashItems=[];
  let globalTrashOpen=false;
  let items=[];
  let showTrash=false;
  let versionAssetId='';
  let globalTimer=null;
  let globalSearchSeq=0;
  const objectUrls=new Set();

  const escHtml=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatBytes=n=>{
    n=Number(n)||0;if(!n)return '0 B';
    const units=['B','KB','MB','GB','TB'];let i=0,v=n;
    while(v>=1024&&i<units.length-1){v/=1024;i++}
    return (i? v.toFixed(v>=10||i<2?1:2):String(Math.round(v)))+' '+units[i];
  };
  const formatDate=v=>{
    if(!v)return '—';
    try{return new Date(v).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return v}
  };
  const projectNumber=p=>window.perekoProjectNumberLabel?.(p)||'';

  function demoFile(){
    const now='2026-09-19T21:20:00.000Z';
    return {
      demo:true,
      assetId:DEMO_ASSET_ID,
      originalName:'Plik testowy R2 — 1,5 MB.pdf',
      projectId:DEMO_PROJECT_ID,
      projectNumber:'P-001/26',
      projectName:'Centrum Partnera PEREKO',
      uploaderName:'Test systemowy',
      uploaderEmail:'',
      uploadedAt:now,
      contentType:'application/pdf',
      size:DEMO_FILE_BYTES,
      latestVersion:1,
      latestKey:'',
      trashed:demoState==='trash',
      versions:[{
        demo:true,key:'',version:1,originalName:'Plik testowy R2 — 1,5 MB.pdf',
        projectId:DEMO_PROJECT_ID,projectNumber:'P-001/26',projectName:'Centrum Partnera PEREKO',
        uploaderName:'Test systemowy',uploadedAt:now,contentType:'application/pdf',size:DEMO_FILE_BYTES
      }],
      totalBytes:DEMO_FILE_BYTES
    };
  }

  function demoUsage(){
    const usedBytes=demoState==='deleted'?0:DEMO_FILE_BYTES;
    const percent=usedBytes/FREE_STORAGE_BYTES*100;
    return {
      demo:true,
      usedBytes,
      freeBytes:Math.max(0,FREE_STORAGE_BYTES-usedBytes),
      limitBytes:FREE_STORAGE_BYTES,
      percent,
      level:'ok',
      objectCount:usedBytes?1:0,
      truncated:false
    };
  }

  async function request(url,options={}){
    const r=await window.perekoAuthFetch(url,options);
    const type=r.headers.get('content-type')||'';
    const body=type.includes('application/json')?await r.json():null;
    if(!r.ok)throw new Error(body?.error||`HTTP ${r.status}`);
    return body;
  }

  function cardEls(){
    return {
      card:document.querySelector('#pdFilesCard'),
      add:document.querySelector('#pdFilesAdd'),
      input:document.querySelector('#pdFilesInput'),
      search:document.querySelector('#pdFilesSearch'),
      summary:document.querySelector('#pdFilesSummary'),
      drop:document.querySelector('#pdFilesDropzone'),
      status:document.querySelector('#pdFilesUploadStatus'),
      list:document.querySelector('#pdFilesList'),
      trash:document.querySelector('#pdFilesTrashToggle')
    };
  }

  function typeKind(item){
    const t=String(item.contentType||'').toLowerCase();
    const n=String(item.originalName||'').toLowerCase();
    if(t.startsWith('image/'))return 'image';
    if(t==='application/pdf'||n.endsWith('.pdf'))return 'pdf';
    if(t.startsWith('video/'))return 'video';
    if(t.startsWith('audio/'))return 'audio';
    if(/\.(zip|rar|7z)$/i.test(n))return 'archive';
    if(/\.(xls|xlsx|csv)$/i.test(n))return 'sheet';
    if(/\.(doc|docx|odt|txt)$/i.test(n))return 'doc';
    return 'file';
  }

  function iconFor(kind){
    return {image:'IMG',pdf:'PDF',video:'VID',audio:'AUD',archive:'ZIP',sheet:'XLS',doc:'DOC',file:'FILE'}[kind]||'FILE';
  }

  function setStatus(text,state=''){
    const el=cardEls().status;if(!el)return;
    el.className='pf-upload-status'+(state?' '+state:'');
    el.textContent=text||'';
  }

  const formatStorageGB=bytes=>{
    const value=(Number(bytes)||0)/1000000000;
    return (value>=10?value.toFixed(1):value.toFixed(2)).replace('.',',')+' GB';
  };

  function globalR2Els(){
    return {
      module:document.querySelector('#r2GlobalModule'),
      used:document.querySelector('#r2GlobalUsed'),
      free:document.querySelector('#r2GlobalFree'),
      percent:document.querySelector('#r2GlobalPercent'),
      level:document.querySelector('#r2GlobalLevel'),
      bar:document.querySelector('#r2GlobalProgressBar'),
      status:document.querySelector('#r2GlobalStatus'),
      toggle:document.querySelector('#r2GlobalTrashToggle'),
      count:document.querySelector('#r2GlobalTrashCount'),
      panel:document.querySelector('#r2GlobalTrashPanel'),
      search:document.querySelector('#r2GlobalTrashSearch'),
      list:document.querySelector('#r2GlobalTrashList')
    };
  }

  function storageMessage(level,percent){
    if(level==='critical')return percent>=100?'Przekroczono orientacyjny bezpłatny próg 10 GB.':'Krytycznie: wykorzystano co najmniej 95% bezpłatnego progu 10 GB.';
    if(level==='high')return 'Wysokie wykorzystanie: przekroczono 85% bezpłatnego progu 10 GB.';
    if(level==='warning')return 'Uwaga: wykorzystano co najmniej 70% bezpłatnego progu 10 GB.';
    return 'Wykorzystanie magazynu jest bezpieczne.';
  }

  function renderGlobalStorage(){
    const e=globalR2Els();if(!e.module)return;
    const warning=document.querySelector('#r2StorageWarning');
    if(!storageUsage){
      e.module.dataset.state='offline';
      if(e.used)e.used.textContent='—';
      if(e.free)e.free.textContent='—';
      if(e.percent)e.percent.textContent='—';
      if(e.level)e.level.textContent='R2 oczekuje na podłączenie';
      if(e.bar)e.bar.style.width='0%';
      if(e.status)e.status.textContent='Magazyn R2 nie jest jeszcze podłączony do aplikacji.';
      warning?.remove();
      return;
    }
    const percent=Math.max(0,Number(storageUsage.percent)||0);
    const level=storageUsage.level||'ok';
    const isDemo=!!storageUsage.demo;
    e.module.dataset.state=level;
    e.module.classList.toggle('is-demo',isDemo);
    if(e.used)e.used.textContent=formatBytes(storageUsage.usedBytes);
    if(e.free)e.free.textContent=formatStorageGB(storageUsage.freeBytes);
    if(e.percent)e.percent.textContent=(percent<0.1&&percent>0?percent.toFixed(2):percent.toFixed(1)).replace('.',',')+'%';
    if(e.level)e.level.textContent=isDemo?'podgląd testowy':level==='ok'?'bezpieczny poziom':level==='warning'?'zbliżamy się do limitu':level==='high'?'wysokie wykorzystanie':'krytyczne wykorzystanie';
    if(e.bar)e.bar.style.width=Math.min(100,percent)+'%';
    const message=isDemo
      ?(demoState==='deleted'
        ?'Podgląd testowy: plik został trwale usunięty, więc zajęcie spadło do 0 B. Odśwież stronę, aby przywrócić demonstrację.'
        :demoState==='trash'
          ?'Podgląd testowy: plik 1,5 MB jest w koszu. Nadal zajmuje miejsce do chwili trwałego usunięcia.'
          :'Podgląd testowy: plik 1,5 MB znajduje się w projekcie Centrum Partnera PEREKO. Po podłączeniu R2 pojawią się dane rzeczywiste.')
      :storageMessage(level,percent);
    if(e.status)e.status.textContent=message;

    if(level==='ok'||isDemo){
      warning?.remove();
    }else{
      const global=warning||document.body.appendChild(Object.assign(document.createElement('div'),{id:'r2StorageWarning'}));
      global.className='r2-storage-warning '+level;
      global.textContent=message+' R2: '+percent.toFixed(1).replace('.',',')+'% wykorzystania.';
    }
  }

  async function refreshStorageUsage(){
    try{
      storageUsage=await request(`${API}?action=usage`);
    }catch{
      storageUsage=demoUsage();
    }
    renderGlobalStorage();
  }

  function renderGlobalTrash(){
    const e=globalR2Els();if(!e.list)return;
    const q=String(e.search?.value||'').trim().toLowerCase();
    const visible=globalTrashItems.filter(item=>{
      if(!q)return true;
      return [item.originalName,item.projectName,item.projectNumber,item.uploaderName].join(' ').toLowerCase().includes(q);
    });
    if(e.count)e.count.textContent=String(globalTrashItems.length);
    if(!visible.length){
      e.list.innerHTML='<div class="r2-global-empty">'+(globalTrashItems.length?'Brak plików pasujących do wyszukiwania.':'Kosz jest pusty.')+'</div>';
      return;
    }
    e.list.innerHTML=visible.map(item=>`
      <article class="r2-trash-item">
        <div class="r2-trash-icon">R2</div>
        <div class="r2-trash-copy">
          <strong>${escHtml(item.originalName)}</strong>
          <span>${escHtml(item.projectNumber||'Projekt')} · ${escHtml(item.projectName||'Bez nazwy')}</span>
          <small>${item.versions||1} ${Number(item.versions)===1?'wersja':'wersje'} · ${formatBytes(item.totalBytes||item.latestSize||0)} · dodał: ${escHtml(item.uploaderName||'Użytkownik')}</small>
        </div>
        <div class="r2-trash-actions">
          <button type="button" data-r2-restore="${escHtml(item.assetId)}" data-r2-project="${escHtml(item.projectId)}">Przywróć</button>
          <button class="danger" type="button" data-r2-purge="${escHtml(item.assetId)}" data-r2-project="${escHtml(item.projectId)}" data-r2-name="${escHtml(item.originalName)}">Usuń trwale</button>
        </div>
      </article>`).join('');
    e.list.querySelectorAll('[data-r2-restore]').forEach(btn=>btn.onclick=()=>restoreGlobalFile(btn.dataset.r2Project,btn.dataset.r2Restore));
    e.list.querySelectorAll('[data-r2-purge]').forEach(btn=>btn.onclick=()=>purgeGlobalFile(btn.dataset.r2Project,btn.dataset.r2Purge,btn.dataset.r2Name));
  }

  async function loadGlobalTrash(){
    const e=globalR2Els();
    try{
      const data=await request(`${API}?action=global-trash`);
      globalTrashItems=Array.isArray(data.items)?data.items:[];
      renderGlobalTrash();
    }catch(error){
      globalTrashItems=demoState==='trash'?[demoFile()]:[];
      renderGlobalTrash();
      if(e.list&&!globalTrashItems.length)e.list.innerHTML='<div class="r2-global-empty">Kosz testowy jest pusty. Plik demonstracyjny znajduje się teraz w projekcie Centrum Partnera PEREKO.</div>';
    }
  }

  async function restoreGlobalFile(projectId,assetId){
    if(projectId===DEMO_PROJECT_ID&&assetId===DEMO_ASSET_ID){
      demoState='active';
      storageUsage=demoUsage();
      await Promise.all([loadGlobalTrash(),currentProject?.id===DEMO_PROJECT_ID?loadProjectFiles():Promise.resolve()]);
      renderGlobalStorage();
      return;
    }
    try{
      await request(`${API}?action=restore`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId,assetId})
      });
      await Promise.all([loadGlobalTrash(),refreshStorageUsage()]);
      if(currentProject?.id===projectId)await loadProjectFiles();
    }catch(error){
      const e=globalR2Els();if(e.list)e.list.insertAdjacentHTML('afterbegin',`<div class="r2-global-error">${escHtml(error.message)}</div>`);
    }
  }

  async function purgeGlobalFile(projectId,assetId,name){
    if(!window.confirm(`Usunąć trwale „${name||'ten plik'}”? Wszystkie wersje zostaną skasowane z Cloudflare R2. Tej operacji nie można cofnąć.`))return;
    if(projectId===DEMO_PROJECT_ID&&assetId===DEMO_ASSET_ID){
      demoState='deleted';
      storageUsage=demoUsage();
      await Promise.all([loadGlobalTrash(),currentProject?.id===DEMO_PROJECT_ID?loadProjectFiles():Promise.resolve()]);
      renderGlobalStorage();
      return;
    }
    try{
      await request(`${API}?action=purge`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId,assetId})
      });
      await Promise.all([loadGlobalTrash(),refreshStorageUsage()]);
      if(currentProject?.id===projectId)await loadProjectFiles();
    }catch(error){
      const e=globalR2Els();if(e.list)e.list.insertAdjacentHTML('afterbegin',`<div class="r2-global-error">${escHtml(error.message)}</div>`);
    }
  }

  function bindGlobalR2Ui(){
    const e=globalR2Els();if(!e.module||e.module.dataset.ready==='1')return;
    e.module.dataset.ready='1';
    e.toggle?.addEventListener('click',async()=>{
      globalTrashOpen=!globalTrashOpen;
      e.toggle.setAttribute('aria-expanded',globalTrashOpen?'true':'false');
      if(e.panel)e.panel.hidden=!globalTrashOpen;
      e.toggle.classList.toggle('active',globalTrashOpen);
      if(globalTrashOpen)await loadGlobalTrash();
    });
    e.search?.addEventListener('input',renderGlobalTrash);
    renderGlobalStorage();
  }

  async function loadProjectFiles(){
    if(!currentProject)return;
    const el=cardEls().list;
    if(el)el.innerHTML='<div class="pd-empty">Ładowanie materiałów…</div>';
    try{
      const [data,usage]=await Promise.all([
        request(`${API}?projectId=${encodeURIComponent(currentProject.id)}`),
        request(`${API}?action=usage`).catch(()=>null)
      ]);
      items=Array.isArray(data.items)?data.items:[];
      if(usage)storageUsage=usage;
      renderGlobalStorage();
      renderFiles();
    }catch(error){
      const isDemoProject=String(currentProject?.id||'')===DEMO_PROJECT_ID||String(currentProject?.name||'').toLowerCase()==='centrum partnera pereko';
      if(isDemoProject){
        storageUsage=demoUsage();
        items=demoState==='deleted'?[]:[demoFile()];
        renderGlobalStorage();
        renderFiles();
        setStatus(demoState==='deleted'
          ?'Tryb testowy: plik demonstracyjny został trwale usunięty. Odśwież stronę, aby rozpocząć demonstrację od nowa.'
          :'Tryb testowy R2: pokazujemy plik demonstracyjny 1,5 MB. Nie zajmuje on jeszcze realnej przestrzeni Cloudflare.','success');
        return;
      }
      items=[];
      if(el)el.innerHTML=`<div class="pf-error"><strong>Magazyn plików nie jest jeszcze aktywny.</strong><span>${escHtml(error.message)}</span></div>`;
      const summary=cardEls().summary;if(summary)summary.textContent='R2 niepodłączone';
    }
  }

  function renderFiles(){
    const {list,search,summary,trash}=cardEls();if(!list)return;
    const q=String(search?.value||'').trim().toLowerCase();
    const visible=items.filter(x=>Boolean(x.trashed)===showTrash).filter(x=>{
      if(!q)return true;
      return [x.originalName,x.uploaderName,x.projectNumber,x.contentType].join(' ').toLowerCase().includes(q);
    });
    const active=items.filter(x=>!x.trashed);
    if(summary)summary.textContent=`${active.length} ${active.length===1?'plik':'plików'} · ${formatBytes(active.reduce((s,x)=>s+(Number(x.size)||0),0))}`;
    if(trash){
      const trashCount=items.filter(x=>x.trashed).length;
      trash.textContent=showTrash?`Pliki aktywne`:`Kosz${trashCount?' ('+trashCount+')':''}`;
      trash.classList.toggle('active',showTrash);
    }
    if(!visible.length){
      list.innerHTML=`<div class="pd-empty">${showTrash?'Kosz jest pusty.':'Brak materiałów pasujących do wyszukiwania.'}</div>`;
      return;
    }
    list.innerHTML=visible.map(item=>{
      const kind=typeKind(item),versions=Array.isArray(item.versions)?item.versions:[];
      const versionRows=versions.map(v=>`
        <div class="pf-version-row">
          <span>v${v.version}</span>
          <div><strong>${escHtml(v.originalName)}</strong><small>${formatDate(v.uploadedAt)} · ${escHtml(v.uploaderName||'Użytkownik')} · ${formatBytes(v.size)}</small></div>
          <button type="button" data-pf-download="${escHtml(v.key)}" data-pf-name="${escHtml(v.originalName)}">Pobierz</button>
        </div>`).join('');
      return `
        <article class="pf-item ${item.trashed?'trashed':''}" data-asset-id="${escHtml(item.assetId)}">
          <button class="pf-file-type ${kind}" type="button" data-pf-preview="${escHtml(item.latestKey)}" data-pf-name="${escHtml(item.originalName)}" data-pf-kind="${kind}">
            <span>${iconFor(kind)}</span>
          </button>
          <div class="pf-file-copy">
            <strong>${escHtml(item.originalName)}</strong>
            <span>${formatBytes(item.size)} · v${item.latestVersion} · ${formatDate(item.uploadedAt)}</span>
            <small>Dodał: ${escHtml(item.uploaderName||'Użytkownik')}</small>
            ${versions.length>1?`<details class="pf-versions"><summary>Historia wersji (${versions.length})</summary><div>${versionRows}</div></details>`:''}
          </div>
          <div class="pf-file-actions">
            ${item.trashed
              ?`<button type="button" data-pf-restore="${escHtml(item.assetId)}">Przywróć</button>
                 <button class="danger" type="button" data-pf-purge="${escHtml(item.assetId)}">Usuń trwale</button>`
              :item.demo
                ?`<span class="pf-demo-badge">TEST 1,5 MB</span>
                   <button class="danger" type="button" data-pf-trash="${escHtml(item.assetId)}">Do kosza</button>`
                :`<button type="button" data-pf-preview="${escHtml(item.latestKey)}" data-pf-name="${escHtml(item.originalName)}" data-pf-kind="${kind}">Podgląd</button>
                   <button type="button" data-pf-download="${escHtml(item.latestKey)}" data-pf-name="${escHtml(item.originalName)}">Pobierz</button>
                   <button type="button" data-pf-version="${escHtml(item.assetId)}">Nowa wersja</button>
                   <button class="danger" type="button" data-pf-trash="${escHtml(item.assetId)}">Do kosza</button>`}
          </div>
        </article>`;
    }).join('');
    bindFileActions();
    hydrateThumbnails(visible);
  }

  function bindFileActions(){
    document.querySelectorAll('[data-pf-preview]').forEach(btn=>btn.onclick=()=>previewFile(btn.dataset.pfPreview,btn.dataset.pfName,btn.dataset.pfKind));
    document.querySelectorAll('[data-pf-download]').forEach(btn=>btn.onclick=()=>downloadFile(btn.dataset.pfDownload,btn.dataset.pfName));
    document.querySelectorAll('[data-pf-version]').forEach(btn=>btn.onclick=()=>{
      versionAssetId=btn.dataset.pfVersion||'';
      const input=cardEls().input;if(!input)return;
      input.multiple=false;input.value='';input.click();
    });
    document.querySelectorAll('[data-pf-trash]').forEach(btn=>btn.onclick=()=>moveToTrash(btn.dataset.pfTrash));
    document.querySelectorAll('[data-pf-restore]').forEach(btn=>btn.onclick=()=>restoreFile(btn.dataset.pfRestore));
    document.querySelectorAll('[data-pf-purge]').forEach(btn=>btn.onclick=()=>purgeFile(btn.dataset.pfPurge));
  }

  async function fetchBlob(key,disposition='inline'){
    const r=await window.perekoAuthFetch(`${API}?action=download&key=${encodeURIComponent(key)}&disposition=${disposition}`);
    if(!r.ok){
      const data=await r.json().catch(()=>({}));
      throw new Error(data.error||`HTTP ${r.status}`);
    }
    return r.blob();
  }

  async function previewFile(key,name,kind){
    try{
      setStatus('Otwieranie podglądu…');
      const blob=await fetchBlob(key,'inline');
      const url=URL.createObjectURL(blob);objectUrls.add(url);
      window.open(url,'_blank','noopener');
      setTimeout(()=>{URL.revokeObjectURL(url);objectUrls.delete(url)},120000);
      setStatus('');
    }catch(error){setStatus(error.message,'error')}
  }

  async function downloadFile(key,name){
    try{
      setStatus('Przygotowywanie pobierania…');
      const blob=await fetchBlob(key,'attachment');
      const url=URL.createObjectURL(blob);objectUrls.add(url);
      const a=document.createElement('a');a.href=url;a.download=name||'plik';document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>{URL.revokeObjectURL(url);objectUrls.delete(url)},120000);
      setStatus('');
    }catch(error){setStatus(error.message,'error')}
  }

  async function hydrateThumbnails(visible){
    const images=visible.filter(x=>typeKind(x)==='image'&&Number(x.size)<10*1024*1024).slice(0,10);
    for(const item of images){
      const btn=document.querySelector(`.pf-item[data-asset-id="${CSS.escape(item.assetId)}"] .pf-file-type.image`);
      if(!btn||btn.querySelector('img'))continue;
      try{
        const blob=await fetchBlob(item.latestKey,'inline');
        const url=URL.createObjectURL(blob);objectUrls.add(url);
        btn.innerHTML=`<img alt="" src="${url}">`;
      }catch{}
    }
  }

  async function moveToTrash(assetId){
    if(!currentProject||!assetId)return;
    if(assetId===DEMO_ASSET_ID&&String(currentProject.id||'')===DEMO_PROJECT_ID){
      demoState='trash';
      storageUsage=demoUsage();
      items=[demoFile()];
      renderFiles();renderGlobalStorage();await loadGlobalTrash();
      setStatus('Plik testowy przeniesiono do kosza. Nadal zajmuje 1,5 MB — miejsce zwolni się dopiero po trwałym usunięciu.','success');
      return;
    }
    try{
      await request(`${API}?action=trash`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:currentProject.id,assetId})});
      setStatus('Plik przeniesiony do kosza. Nadal zajmuje miejsce w R2; aby zwolnić przestrzeń, użyj „Usuń trwale”.','success');
      await loadProjectFiles();
      await loadGlobalTrash();
    }catch(error){setStatus(error.message,'error')}
  }

  async function restoreFile(assetId){
    if(!currentProject||!assetId)return;
    if(assetId===DEMO_ASSET_ID&&String(currentProject.id||'')===DEMO_PROJECT_ID){
      demoState='active';
      storageUsage=demoUsage();
      items=[demoFile()];
      renderFiles();renderGlobalStorage();await loadGlobalTrash();
      setStatus('Plik testowy przywrócono do projektu.','success');
      return;
    }
    try{
      await request(`${API}?action=restore`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:currentProject.id,assetId})});
      setStatus('Plik przywrócony.','success');
      await loadProjectFiles();
      await loadGlobalTrash();
    }catch(error){setStatus(error.message,'error')}
  }

  async function purgeFile(assetId){
    if(!currentProject||!assetId)return;
    const item=items.find(x=>x.assetId===assetId);
    const name=item?.originalName||'ten plik';
    if(!window.confirm(`Usunąć trwale „${name}”? Zostaną skasowane wszystkie wersje z aplikacji i Cloudflare R2. Tej operacji nie można cofnąć.`))return;
    if(assetId===DEMO_ASSET_ID&&String(currentProject.id||'')===DEMO_PROJECT_ID){
      demoState='deleted';
      storageUsage=demoUsage();
      items=[];
      renderFiles();renderGlobalStorage();await loadGlobalTrash();
      setStatus('Plik testowy usunięto trwale. Zajęcie spadło z 1,5 MB do 0 B. Odśwież stronę, aby przywrócić demonstrację.','success');
      return;
    }
    try{
      const result=await request(`${API}?action=purge`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId:currentProject.id,assetId})
      });
      setStatus(`Usunięto trwale z aplikacji i Cloudflare R2. Zwolniono ${formatBytes(result.freedBytes||0)}.`,'success');
      await Promise.all([loadProjectFiles(),loadGlobalTrash(),refreshStorageUsage()]);
    }catch(error){setStatus(error.message,'error')}
  }

  async function uploadFiles(fileList,assetId=''){
    if(!currentProject)return;
    const files=[...fileList].filter(Boolean);if(!files.length)return;
    for(let index=0;index<files.length;index++){
      const file=files[index];
      let uploadInfo=null;
      if(Number(file.size)>MAX_FILE_BYTES){
        setStatus(`Nie można dodać ${file.name}: maksymalny rozmiar pojedynczego pliku to 5 MB.`,'error');
        if(assetId)break;
        continue;
      }
      try{
        setStatus(`Przygotowanie ${file.name} (${index+1}/${files.length})…`);
        uploadInfo=await request(`${API}?action=begin`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            projectId:currentProject.id,
            projectNumber:projectNumber(currentProject),
            projectName:currentProject.name,
            fileName:file.name,
            contentType:file.type||'application/octet-stream',
            size:file.size,
            assetId:assetId||undefined,
            uploaderName:window.perekoLoggedPerson?.name||''
          })
        });
        const partCount=Math.max(1,Math.ceil(file.size/CHUNK_SIZE));
        const parts=[];
        for(let part=0;part<partCount;part++){
          const from=part*CHUNK_SIZE,to=Math.min(file.size,from+CHUNK_SIZE);
          const chunk=file.slice(from,to);
          const percent=Math.round((part/partCount)*100);
          setStatus(`Wysyłanie ${file.name}: ${percent}% · część ${part+1}/${partCount}`);
          const r=await window.perekoAuthFetch(`${API}?action=upload-part&key=${encodeURIComponent(uploadInfo.key)}&uploadId=${encodeURIComponent(uploadInfo.uploadId)}&partNumber=${part+1}`,{
            method:'PUT',body:chunk,headers:{'Content-Type':'application/octet-stream'}
          });
          const data=await r.json().catch(()=>({}));
          if(!r.ok)throw new Error(data.error||`Błąd części ${part+1}`);
          parts.push({partNumber:data.partNumber,etag:data.etag});
        }
        await request(`${API}?action=complete`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({key:uploadInfo.key,uploadId:uploadInfo.uploadId,parts})
        });
        setStatus(`${file.name}: 100% · zapisano`,'success');
      }catch(error){
        if(uploadInfo?.key&&uploadInfo?.uploadId){
          try{await request(`${API}?action=abort`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:uploadInfo.key,uploadId:uploadInfo.uploadId})})}catch{}
        }
        setStatus(`Nie udało się wysłać ${file.name}: ${error.message}`,'error');
        if(assetId)break;
      }
      if(assetId)break;
    }
    versionAssetId='';
    const input=cardEls().input;if(input){input.multiple=true;input.value=''}
    await Promise.all([loadProjectFiles(),refreshStorageUsage()]);
  }

  function bindCard(){
    const e=cardEls();if(!e.card||e.card.dataset.filesReady==='1')return;
    e.card.dataset.filesReady='1';
    const dropHint=e.drop?.querySelector('span');
    if(dropHint&&!dropHint.textContent.includes('5 MB'))dropHint.textContent=(dropHint.textContent.trim()?dropHint.textContent.trim()+' · ':'')+'Maksymalnie 5 MB na plik';
    e.add.onclick=()=>{versionAssetId='';e.input.multiple=true;e.input.value='';e.input.click()};
    e.input.onchange=()=>uploadFiles(e.input.files,versionAssetId);
    e.search.oninput=renderFiles;
    e.trash.onclick=()=>{showTrash=!showTrash;renderFiles()};
    ['dragenter','dragover'].forEach(type=>e.drop.addEventListener(type,ev=>{ev.preventDefault();e.drop.classList.add('dragover')}));
    ['dragleave','drop'].forEach(type=>e.drop.addEventListener(type,ev=>{ev.preventDefault();e.drop.classList.remove('dragover')}));
    e.drop.addEventListener('drop',ev=>uploadFiles(ev.dataTransfer?.files||[]));
  }

  window.perekoProjectFilesOpen=p=>{
    currentProject=p;
    showTrash=false;
    versionAssetId='';
    bindCard();
    const search=cardEls().search;if(search)search.value='';
    setStatus('');
    loadProjectFiles();
  };

  // Globalna wyszukiwarka plików
  const globalInput=document.querySelector('#globalSearchInput');
  const globalResults=document.querySelector('#globalSearchResults');
  if(globalInput&&globalResults){
    globalInput.addEventListener('input',()=>{
      clearTimeout(globalTimer);
      const q=globalInput.value.trim();
      document.querySelector('.global-search-files-group')?.remove();
      if(q.length<2)return;
      const seq=++globalSearchSeq;
      globalTimer=setTimeout(async()=>{
        try{
          const data=await request(`${API}?action=search&q=${encodeURIComponent(q)}`);
          if(seq!==globalSearchSeq||globalInput.value.trim()!==q)return;
          const found=Array.isArray(data.items)?data.items:[];
          document.querySelector('.global-search-files-group')?.remove();
          if(!found.length)return;
          globalResults.querySelector('.global-search-empty')?.remove();
          const group=document.createElement('div');
          group.className='global-search-group global-search-files-group';
          group.innerHTML=`<div class="global-search-group-head"><span>PLIKI</span><b>${found.length}</b></div>`+found.map(file=>`
            <button class="global-search-result" type="button" data-global-file-key="${escHtml(file.latestKey)}" data-global-file-name="${escHtml(file.originalName)}">
              <span class="global-search-number">${escHtml(file.projectNumber||'PLIK')}</span>
              <span class="global-search-copy"><strong>${escHtml(file.originalName)}</strong><small>${escHtml(file.projectName||'Projekt')} · Dodał: ${escHtml(file.uploaderName||'Użytkownik')} · ${formatBytes(file.size)}</small></span>
              <span class="global-search-arrow">→</span>
            </button>`).join('');
          globalResults.appendChild(group);
          group.querySelectorAll('[data-global-file-key]').forEach(btn=>btn.onclick=()=>{
            previewFile(btn.dataset.globalFileKey,btn.dataset.globalFileName,typeKind({originalName:btn.dataset.globalFileName}));
          });
        }catch{}
      },320);
    });
  }

  bindGlobalR2Ui();
  setTimeout(()=>{
    if(window.perekoAuthFetch){
      refreshStorageUsage();
      loadGlobalTrash();
    }
  },1800);
  window.addEventListener('beforeunload',()=>objectUrls.forEach(url=>URL.revokeObjectURL(url)));
})();