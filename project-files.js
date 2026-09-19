(()=>{
  const API='/api/project-files-gateway';
  const MAX_FILE_BYTES=5*1024*1024;
  const FREE_STORAGE_BYTES=10*1000*1000*1000;
  const CHUNK_SIZE=MAX_FILE_BYTES;
  let currentProject=null;
  let storageUsage=null;
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

  function ensureStorageUi(){
    const e=cardEls();if(!e.card)return null;
    let el=e.card.querySelector('#pdFilesStorage');
    if(el)return el;
    el=document.createElement('div');
    el.id='pdFilesStorage';
    el.className='pf-storage';
    if(e.drop)e.drop.before(el);else e.card.appendChild(el);
    return el;
  }

  function renderStorageUsage(){
    const el=ensureStorageUi();if(!el)return;
    if(!storageUsage){
      el.innerHTML='<span class="pf-storage-label">R2</span><strong>Oczekiwanie na dane magazynu…</strong>';
      el.className='pf-storage';
      return;
    }
    const percent=Math.max(0,Number(storageUsage.percent)||0);
    const width=Math.min(100,percent);
    const level=storageUsage.level||'ok';
    const free=Math.max(0,Number(storageUsage.freeBytes)||0);
    let message='Wykorzystanie magazynu jest bezpieczne.';
    if(level==='warning')message='Uwaga: wykorzystano co najmniej 70% bezpłatnego progu 10 GB.';
    if(level==='high')message='Wysokie wykorzystanie: przekroczono 85% bezpłatnego progu 10 GB.';
    if(level==='critical')message=percent>=100?'Przekroczono orientacyjny bezpłatny próg 10 GB.':'Krytycznie: wykorzystano co najmniej 95% bezpłatnego progu 10 GB.';
    el.className='pf-storage '+level;
    el.innerHTML=
      '<div class="pf-storage-top"><span class="pf-storage-label">CLOUDFLARE R2</span><strong>'+
      formatStorageGB(storageUsage.usedBytes)+' / 10 GB · '+percent.toFixed(1).replace('.',',')+'%</strong></div>'+
      '<div class="pf-storage-bar"><i style="width:'+width+'%"></i></div>'+
      '<div class="pf-storage-bottom"><span>'+message+'</span><small>Wolne: '+formatStorageGB(free)+' · maks. 5 MB na plik</small></div>';

    let global=document.querySelector('#r2StorageWarning');
    if(level==='ok'){
      global?.remove();
      return;
    }
    if(!global){
      global=document.createElement('div');
      global.id='r2StorageWarning';
      document.body.appendChild(global);
    }
    global.className='r2-storage-warning '+level;
    global.textContent=message+' R2: '+percent.toFixed(1).replace('.',',')+'% wykorzystania.';
  }

  async function refreshStorageUsage(){
    try{
      storageUsage=await request(`${API}?action=usage`);
      renderStorageUsage();
    }catch{}
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
      renderFiles();
    }catch(error){
      items=[];
      if(el)el.innerHTML=`<div class="pf-error"><strong>Magazyn plików nie jest jeszcze aktywny.</strong><span>${escHtml(error.message)}</span></div>`;
      const summary=cardEls().summary;if(summary)summary.textContent='R2 niepodłączone';
    }
  }

  function renderFiles(){
    const {list,search,summary,trash}=cardEls();if(!list)return;
    renderStorageUsage();
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
    try{
      await request(`${API}?action=trash`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:currentProject.id,assetId})});
      setStatus('Plik przeniesiony do kosza. Nadal zajmuje miejsce w R2; aby zwolnić przestrzeń, użyj „Usuń trwale”.','success');
      await loadProjectFiles();
    }catch(error){setStatus(error.message,'error')}
  }

  async function restoreFile(assetId){
    if(!currentProject||!assetId)return;
    try{
      await request(`${API}?action=restore`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:currentProject.id,assetId})});
      setStatus('Plik przywrócony.','success');
      await loadProjectFiles();
    }catch(error){setStatus(error.message,'error')}
  }

  async function purgeFile(assetId){
    if(!currentProject||!assetId)return;
    const item=items.find(x=>x.assetId===assetId);
    const name=item?.originalName||'ten plik';
    if(!window.confirm(`Usunąć trwale „${name}”? Zostaną skasowane wszystkie wersje z aplikacji i Cloudflare R2. Tej operacji nie można cofnąć.`))return;
    try{
      const result=await request(`${API}?action=purge`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({projectId:currentProject.id,assetId})
      });
      setStatus(`Usunięto trwale z aplikacji i Cloudflare R2. Zwolniono ${formatBytes(result.freedBytes||0)}.`,'success');
      await loadProjectFiles();
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
    await loadProjectFiles();
  }

  function bindCard(){
    const e=cardEls();if(!e.card||e.card.dataset.filesReady==='1')return;
    e.card.dataset.filesReady='1';
    const dropHint=e.drop?.querySelector('span');
    if(dropHint&&!dropHint.textContent.includes('5 MB'))dropHint.textContent=(dropHint.textContent.trim()?dropHint.textContent.trim()+' · ':'')+'Maksymalnie 5 MB na plik';
    ensureStorageUi();
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

  setTimeout(()=>{if(window.perekoAuthFetch)refreshStorageUsage()},1800);
  window.addEventListener('beforeunload',()=>objectUrls.forEach(url=>URL.revokeObjectURL(url)));
})();