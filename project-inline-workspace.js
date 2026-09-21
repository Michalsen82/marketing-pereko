(()=>{
  const taskModes=new Map();
  const materialCache=new Map();
  const FILE_API='/api/project-files-gateway';
  const MAX_FILE_BYTES=5*1024*1024;
  const CHUNK_SIZE=MAX_FILE_BYTES;
  const statusTextLocal={work:'W realizacji',plan:'Planowany',done:'Zakończony'};

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const currentPerson=()=>window.perekoLoggedPerson||{};
  const mine=who=>{
    const a=norm(who),p=currentPerson(),full=norm(p.name),email=norm(p.email),first=full.split(' ')[0];
    return !!a&&(a===full||a===email||(first&&a===first));
  };
  const initials=name=>String(name||'Użytkownik').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const fmtDate=v=>{
    if(!v)return 'Brak';
    try{return new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return String(v)}
  };
  const fmtDateTime=v=>{
    if(!v)return '';
    try{return new Date(v).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return String(v)}
  };
  const fmtBytes=n=>{
    n=Number(n)||0;if(!n)return '0 B';
    const u=['B','KB','MB','GB'];let i=0,v=n;
    while(v>=1024&&i<u.length-1){v/=1024;i++}
    return (i? v.toFixed(v>=10?1:2):String(Math.round(v)))+' '+u[i];
  };
  const ensure=p=>{
    if(!Array.isArray(p.members))p.members=p.owner?[p.owner]:[];
    if(!Array.isArray(p.projectTasks))p.projectTasks=[];
    if(!Array.isArray(p.comments))p.comments=[];
    if(typeof p.desc!=='string')p.desc='';
    return p;
  };
  const projectProgress=p=>{
    ensure(p);
    const total=p.projectTasks.length,done=p.projectTasks.filter(t=>t.done).length;
    p.progress=total?Math.round(done/total*100):0;
    if(total&&done===total)p.status='done';
    else if(total&&p.status==='done')p.status='work';
    return {total,done,open:Math.max(0,total-done),progress:p.progress};
  };
  const deadlineText=p=>{
    if(!p.deadline)return 'Brak terminu';
    if(p.status==='done')return 'Projekt zakończony';
    const today=new Date();today.setHours(0,0,0,0);
    const end=new Date(p.deadline+'T00:00:00');end.setHours(0,0,0,0);
    const diff=Math.round((end-today)/86400000);
    if(diff<0)return Math.abs(diff)+' dni po terminie';
    if(diff===0)return 'Dzisiaj';
    if(diff===1)return '1 dzień';
    return diff+' dni';
  };
  const teamNames=()=>{
    let local=[];
    try{local=JSON.parse(localStorage.getItem('pereko_team')||'[]')||[]}catch{}
    const src=Array.isArray(window.perekoTeam)&&window.perekoTeam.length?window.perekoTeam:local;
    const names=src.map(x=>x?.name).filter(Boolean);
    if(currentPerson().name)names.push(currentPerson().name);
    return [...new Set(names)];
  };
  const saveAndRender=()=>{
    save();
    render();
  };

  function visibleTasks(p){
    const mode=taskModes.get(p.id)||'mine';
    if(mode==='done')return p.projectTasks.filter(t=>t.done);
    if(mode==='all')return p.projectTasks.filter(t=>!t.done);
    return p.projectTasks.filter(t=>!t.done&&mine(t.assignee));
  }

  function workspaceHtml(p){
    ensure(p);
    const prog=projectProgress(p);
    const mode=taskModes.get(p.id)||'mine';
    const tasks=visibleTasks(p);
    const taskRows=tasks.map(t=>{
      const idx=p.projectTasks.indexOf(t);
      const canClose=mine(t.assignee);
      return '<div class="piw-task-row '+(t.done?'done':'')+'" data-piw-task-id="'+esc(t.id||'')+'">'+
        '<input class="piw-task-check" type="checkbox" data-piw-task-done="'+idx+'" '+(t.done?'checked':'')+' '+(canClose?'':'disabled')+' title="'+esc(canClose?'':('Tylko '+(t.assignee||'przypisana osoba')+' może zmienić status'))+'">'+
        '<div class="piw-task-copy"><small>'+esc(window.perekoTaskNumberLabel?.(t)||'Z-—')+'</small><strong>'+esc(t.text)+'</strong><small>'+esc(t.assignee||'Bez przypisania')+(t.deadline?' · '+esc(fmtDate(t.deadline)):' · brak terminu')+'</small></div>'+
        '<div class="piw-task-actions"><button class="piw-btn" type="button" data-piw-task-edit="'+idx+'">Edytuj</button><button class="piw-icon-btn" type="button" data-piw-task-remove="'+idx+'" aria-label="Usuń zadanie">×</button></div>'+
      '</div>';
    }).join('');

    const comments=p.comments.map((c,i)=>
      '<div class="piw-comment-row">'+
        '<div class="piw-avatar">'+esc(initials(c.author))+'</div>'+
        '<div class="piw-comment-copy"><strong>'+esc(c.author||'Użytkownik')+'</strong><small>'+esc(fmtDateTime(c.createdAt))+(c.editedAt?' · edytowano':'')+'</small><p>'+esc(c.text)+'</p></div>'+
        '<div class="piw-row-actions"><button class="piw-btn" type="button" data-piw-comment-edit="'+i+'">Edytuj</button><button class="piw-icon-btn" type="button" data-piw-comment-remove="'+i+'" aria-label="Usuń komentarz">×</button></div>'+
      '</div>'
    ).join('');

    const members=p.members.map((m,i)=>
      '<div class="piw-member"><div class="piw-avatar">'+esc(initials(m))+'</div><div class="piw-member-copy"><strong>'+esc(m)+'</strong><span>'+(m===p.owner?'Osoba odpowiedzialna':'Zespół projektu')+'</span></div><button class="piw-icon-btn" type="button" data-piw-member-remove="'+i+'" aria-label="Usuń osobę">×</button></div>'
    ).join('');

    return '<div class="piw-workspace">'+
      '<div class="piw-main">'+
        '<section class="piw-card">'+
          '<div class="piw-card-head"><div><span class="piw-kicker">ZADANIA</span><h4>Zadania projektu</h4></div><button class="piw-btn primary" type="button" data-piw-add-task>+ Dodaj zadanie</button></div>'+
          '<div class="piw-task-toolbar"><div class="piw-task-filters">'+
            '<button class="piw-filter '+(mode==='mine'?'active':'')+'" type="button" data-piw-task-mode="mine">Moje zadania</button>'+
            '<button class="piw-filter '+(mode==='all'?'active':'')+'" type="button" data-piw-task-mode="all">Wszystkie zadania</button>'+
            '<button class="piw-filter '+(mode==='done'?'active':'')+'" type="button" data-piw-task-mode="done">Wykonane</button>'+
          '</div><span class="piw-kicker" style="margin:0">'+tasks.length+' widocznych</span></div>'+
          '<div class="piw-task-list">'+(taskRows||'<div class="piw-empty">Brak zadań w wybranym widoku.</div>')+'</div>'+
        '</section>'+
        '<section class="piw-card">'+
          '<div class="piw-card-head"><div><span class="piw-kicker">KOMENTARZE</span><h4>Notatki i ustalenia</h4></div><button class="piw-btn primary" type="button" data-piw-add-comment>+ Dodaj komentarz</button></div>'+
          '<div class="piw-comment-list">'+(comments||'<div class="piw-empty">Brak komentarzy i notatek.</div>')+'</div>'+
        '</section>'+
        '<section class="piw-card">'+
          '<div class="piw-card-head"><div><span class="piw-kicker">PLIKI I MATERIAŁY</span><h4>Materiały projektu</h4></div><button class="piw-btn primary" type="button" data-piw-add-material>+ Dodaj materiał</button></div>'+
          '<div class="piw-material-list" data-piw-material-list><div class="piw-empty">Ładowanie materiałów…</div></div>'+
          '<div class="piw-material-status" data-piw-material-status></div>'+
        '</section>'+
      '</div>'+
      '<aside class="piw-side">'+
        '<section class="piw-card">'+
          '<div class="piw-card-head"><div><span class="piw-kicker">ZESPÓŁ</span><h4>Osoby w projekcie</h4></div><button class="piw-btn" type="button" data-piw-add-member>+ Przypisz</button></div>'+
          '<div class="piw-member-list">'+(members||'<div class="piw-empty">Brak przypisanych osób.</div>')+'</div>'+
        '</section>'+
        '<section class="piw-card">'+
          '<div class="piw-card-head"><div><span class="piw-kicker">PODSUMOWANIE</span><h4>Stan projektu</h4></div></div>'+
          '<div class="piw-summary">'+
            '<div class="piw-summary-row"><span>Status</span><strong>'+esc(statusTextLocal[p.status]||'—')+'</strong></div>'+
            '<div class="piw-summary-row"><span>Termin</span><strong>'+esc(fmtDate(p.deadline))+'</strong></div>'+
            '<div class="piw-summary-row"><span>Do końca</span><strong>'+esc(deadlineText(p))+'</strong></div>'+
            '<div class="piw-summary-row"><span>Postęp</span><strong>'+(prog.total?prog.progress+'%':'—')+'</strong></div>'+
            '<div class="piw-summary-row"><span>Zadania</span><strong>'+prog.done+'/'+prog.total+'</strong></div>'+
            '<div class="piw-summary-row"><span>Otwarte zadania</span><strong>'+prog.open+'</strong></div>'+
            '<div class="piw-summary-row"><span>Zespół</span><strong>'+p.members.length+'</strong></div>'+
          '</div>'+
          '<div class="piw-summary-actions"><button class="piw-btn" type="button" data-piw-edit-project>Edytuj projekt</button><button class="piw-btn" type="button" data-project-gantt="'+esc(p.id)+'">Wykres Gantta</button></div>'+
          '<div class="piw-danger-zone"><button class="piw-btn danger" type="button" data-piw-delete-project>Usuń projekt</button></div>'+
        '</section>'+
      '</aside>'+
    '</div>';
  }

  function renderWorkspace(card,p){
    const preview=card.querySelector('.project-preview');if(!preview)return;
    preview.innerHTML=workspaceHtml(p);
    preview.classList.add('piw-preview');
    card.querySelector('.project-open-btn')?.remove();

    preview.querySelectorAll('[data-piw-task-mode]').forEach(btn=>btn.onclick=()=>{
      taskModes.set(p.id,btn.dataset.piwTaskMode);
      render();
    });
    preview.querySelector('[data-piw-add-task]')?.addEventListener('click',()=>openTaskModal(p));
    preview.querySelectorAll('[data-piw-task-edit]').forEach(btn=>btn.onclick=()=>openTaskModal(p,+btn.dataset.piwTaskEdit));
    preview.querySelectorAll('[data-piw-task-remove]').forEach(btn=>btn.onclick=()=>{
      const idx=+btn.dataset.piwTaskRemove,t=p.projectTasks[idx];if(!t)return;
      if(!confirm('Usunąć zadanie „'+t.text+'”?'))return;
      p.projectTasks.splice(idx,1);projectProgress(p);saveAndRender();
    });
    preview.querySelectorAll('[data-piw-task-done]').forEach(box=>box.onchange=()=>{
      const t=p.projectTasks[+box.dataset.piwTaskDone];if(!t||!mine(t.assignee)){box.checked=!!t?.done;return}
      t.done=box.checked;
      if(t.done){t.completedAt=new Date().toISOString();t.completedOn=new Date().toISOString().slice(0,10)}
      else{t.completedAt=null;t.completedOn=null}
      projectProgress(p);saveAndRender();
    });

    preview.querySelector('[data-piw-add-comment]')?.addEventListener('click',()=>openCommentModal(p));
    preview.querySelectorAll('[data-piw-comment-edit]').forEach(btn=>btn.onclick=()=>openCommentModal(p,+btn.dataset.piwCommentEdit));
    preview.querySelectorAll('[data-piw-comment-remove]').forEach(btn=>btn.onclick=()=>{
      const idx=+btn.dataset.piwCommentRemove;if(!p.comments[idx])return;
      if(!confirm('Usunąć ten komentarz?'))return;
      p.comments.splice(idx,1);saveAndRender();
    });

    preview.querySelector('[data-piw-add-member]')?.addEventListener('click',()=>openMemberModal(p));
    preview.querySelectorAll('[data-piw-member-remove]').forEach(btn=>btn.onclick=()=>{
      const idx=+btn.dataset.piwMemberRemove;
      p.members.splice(idx,1);saveAndRender();
    });

    preview.querySelector('[data-piw-edit-project]')?.addEventListener('click',()=>openProjectEditModal(p));
    preview.querySelector('[data-piw-delete-project]')?.addEventListener('click',()=>openDeleteModal(p));
    preview.querySelector('[data-piw-add-material]')?.addEventListener('click',()=>openMaterialModal(p));
    loadMaterialsInto(p,preview.querySelector('[data-piw-material-list]'),preview.querySelector('[data-piw-material-status]'));
  }

  function enhance(){
    document.querySelectorAll('.project.expanded').forEach(card=>{
      const p=projects.find(x=>String(x.id)===String(card.dataset.projectId));if(!p)return;
      ensure(p);renderWorkspace(card,p);
    });
    document.querySelectorAll('.project-open-btn').forEach(btn=>btn.remove());
  }

  function buildModal(id){
    let modal=document.querySelector('#'+id);
    if(modal)return modal;
    modal=document.createElement('div');modal.id=id;modal.className='piw-modal';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')});
    return modal;
  }
  const closeModal=modal=>modal?.classList.remove('open');

  function openTaskModal(p,index=null){
    ensure(p);
    const edit=index!==null&&p.projectTasks[index],modal=buildModal('piwTaskModal');
    const choices=[...new Set([...teamNames(),...p.members,p.owner].filter(Boolean))];
    modal.innerHTML='<div class="piw-modal-card"><div class="piw-modal-head"><div><span class="piw-kicker">'+(edit?'EDYCJA ZADANIA':'NOWE ZADANIE')+'</span><h3>'+(edit?'Edytuj zadanie':'Dodaj zadanie')+'</h3><p>Po zapisaniu okno zostanie zamknięte, a zadanie pojawi się w projekcie.</p></div><button class="piw-icon-btn" type="button" data-close>×</button></div>'+
      '<div class="piw-form"><label class="piw-field"><span>Nazwa zadania</span><input data-task-text value="'+esc(edit?.text||'')+'" placeholder="Co trzeba zrobić?"></label>'+
      '<label class="piw-field"><span>Osoba odpowiedzialna</span><select data-task-assignee><option value="">Bez przypisania</option>'+choices.map(x=>'<option value="'+esc(x)+'" '+(edit?.assignee===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>'+
      '<label class="piw-field"><span>Termin</span><input data-task-deadline type="date" value="'+esc(edit?.deadline||'')+'"></label></div>'+
      '<div class="piw-modal-actions"><button class="piw-btn" type="button" data-cancel>Anuluj</button><button class="piw-btn primary" type="button" data-save>Zapisz</button></div></div>';
    modal.querySelector('[data-close]').onclick=modal.querySelector('[data-cancel]').onclick=()=>closeModal(modal);
    modal.querySelector('[data-save]').onclick=()=>{
      const text=modal.querySelector('[data-task-text]').value.trim();if(!text)return;
      const payload={text,assignee:modal.querySelector('[data-task-assignee]').value,deadline:modal.querySelector('[data-task-deadline]').value};
      if(edit)p.projectTasks[index]={...p.projectTasks[index],...payload};
      else{
        const identity=window.perekoNextTaskIdentity?.()||{taskNumber:1,taskYear:new Date().getFullYear()};
        p.projectTasks.unshift({id:crypto.randomUUID(),...identity,createdAt:new Date().toISOString(),...payload,done:false});
      }
      projectProgress(p);closeModal(modal);saveAndRender();
    };
    modal.classList.add('open');setTimeout(()=>modal.querySelector('[data-task-text]')?.focus(),50);
  }

  function openCommentModal(p,index=null){
    const edit=index!==null&&p.comments[index],modal=buildModal('piwCommentModal');
    modal.innerHTML='<div class="piw-modal-card"><div class="piw-modal-head"><div><span class="piw-kicker">'+(edit?'EDYCJA KOMENTARZA':'NOWY KOMENTARZ')+'</span><h3>'+(edit?'Edytuj komentarz':'Dodaj komentarz')+'</h3><p>Dodaj notatkę lub ustalenie do projektu.</p></div><button class="piw-icon-btn" type="button" data-close>×</button></div>'+
      '<label class="piw-field"><span>Treść komentarza</span><textarea data-comment-text placeholder="Wpisz komentarz…">'+esc(edit?.text||'')+'</textarea></label>'+
      '<div class="piw-modal-actions"><button class="piw-btn" type="button" data-cancel>Anuluj</button><button class="piw-btn primary" type="button" data-save>Zapisz</button></div></div>';
    modal.querySelector('[data-close]').onclick=modal.querySelector('[data-cancel]').onclick=()=>closeModal(modal);
    modal.querySelector('[data-save]').onclick=()=>{
      const text=modal.querySelector('[data-comment-text]').value.trim();if(!text)return;
      if(edit)p.comments[index]={...p.comments[index],text,editedAt:new Date().toISOString()};
      else p.comments.unshift({id:crypto.randomUUID(),text,author:currentPerson().name||'Użytkownik',createdAt:new Date().toISOString()});
      closeModal(modal);saveAndRender();
    };
    modal.classList.add('open');setTimeout(()=>modal.querySelector('[data-comment-text]')?.focus(),50);
  }

  function openMemberModal(p){
    ensure(p);
    const modal=buildModal('piwMemberModal');
    const available=teamNames().filter(x=>!p.members.includes(x));
    modal.innerHTML='<div class="piw-modal-card"><div class="piw-modal-head"><div><span class="piw-kicker">ZESPÓŁ PROJEKTU</span><h3>Przypisz osobę</h3><p>Wybierz współpracownika, który ma dołączyć do projektu.</p></div><button class="piw-icon-btn" type="button" data-close>×</button></div>'+
      '<label class="piw-field"><span>Osoba</span><select data-member><option value="">Wybierz osobę</option>'+available.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</select></label>'+
      '<div class="piw-modal-actions"><button class="piw-btn" type="button" data-cancel>Anuluj</button><button class="piw-btn primary" type="button" data-save '+(!available.length?'disabled':'')+'>Przypisz</button></div></div>';
    modal.querySelector('[data-close]').onclick=modal.querySelector('[data-cancel]').onclick=()=>closeModal(modal);
    modal.querySelector('[data-save]').onclick=()=>{
      const name=modal.querySelector('[data-member]').value;if(!name)return;
      if(!p.members.includes(name))p.members.push(name);
      closeModal(modal);saveAndRender();
    };
    modal.classList.add('open');
  }

  function openProjectEditModal(p){
    const modal=buildModal('piwProjectEditModal');
    const owners=[...new Set([...teamNames(),...p.members,p.owner].filter(Boolean))];
    modal.innerHTML='<div class="piw-modal-card"><div class="piw-modal-head"><div><span class="piw-kicker">DANE PROJEKTU</span><h3>Edytuj projekt</h3><p>Najważniejsze informacje dostępne wcześniej w otwartym widoku projektu.</p></div><button class="piw-icon-btn" type="button" data-close>×</button></div>'+
      '<div class="piw-form"><label class="piw-field"><span>Status</span><select data-status><option value="work" '+(p.status==='work'?'selected':'')+'>W realizacji</option><option value="plan" '+(p.status==='plan'?'selected':'')+'>Planowany</option><option value="done" '+(p.status==='done'?'selected':'')+'>Zakończony</option></select></label>'+
      '<label class="piw-field"><span>Termin projektu</span><input type="date" data-deadline value="'+esc(p.deadline||'')+'"></label>'+
      '<label class="piw-field"><span>Osoba odpowiedzialna</span><select data-owner><option value="">Brak</option>'+owners.map(x=>'<option value="'+esc(x)+'" '+(p.owner===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>'+
      '<label class="piw-field"><span>Opis projektu</span><textarea data-desc>'+esc(p.desc||'')+'</textarea></label></div>'+
      '<div class="piw-modal-actions"><button class="piw-btn" type="button" data-cancel>Anuluj</button><button class="piw-btn primary" type="button" data-save>Zapisz zmiany</button></div></div>';
    modal.querySelector('[data-close]').onclick=modal.querySelector('[data-cancel]').onclick=()=>closeModal(modal);
    modal.querySelector('[data-save]').onclick=()=>{
      p.status=modal.querySelector('[data-status]').value;
      p.deadline=modal.querySelector('[data-deadline]').value;
      p.owner=modal.querySelector('[data-owner]').value;
      p.desc=modal.querySelector('[data-desc]').value.trim();
      if(p.owner&&!p.members.includes(p.owner))p.members.unshift(p.owner);
      projectProgress(p);closeModal(modal);saveAndRender();
    };
    modal.classList.add('open');
  }

  function openDeleteModal(p){
    const modal=buildModal('piwDeleteModal');
    const renderStep=step=>{
      modal.innerHTML='<div class="piw-modal-card"><div class="piw-modal-head"><div><span class="piw-kicker">USUWANIE PROJEKTU</span><h3>'+(step===1?'Czy na pewno?':'Potwierdź usunięcie')+'</h3></div><button class="piw-icon-btn" type="button" data-close>×</button></div>'+
        '<div class="piw-delete-step">'+(step===1
          ?'<p>Zamierzasz usunąć projekt <strong>„'+esc(p.name)+'”</strong>. Projekt, jego zadania i komentarze znikną z dashboardu.</p><p>To jest pierwszy etap potwierdzenia.</p>'
          :'<p><strong>Ostatnie potwierdzenie.</strong> Operacji nie będzie można cofnąć z poziomu dashboardu.</p><p>Jeżeli jesteś pewien, wybierz „Usuń projekt”.</p>')+'</div>'+
        '<div class="piw-modal-actions"><button class="piw-btn" type="button" data-cancel>Anuluj</button>'+(step===1?'<button class="piw-btn danger" type="button" data-next>Dalej</button>':'<button class="piw-btn danger" type="button" data-final>Usuń projekt</button>')+'</div></div>';
      modal.querySelector('[data-close]').onclick=modal.querySelector('[data-cancel]').onclick=()=>closeModal(modal);
      modal.querySelector('[data-next]')?.addEventListener('click',()=>renderStep(2));
      modal.querySelector('[data-final]')?.addEventListener('click',()=>{
        projects=projects.filter(x=>x.id!==p.id);
        closeModal(modal);saveAndRender();
        if(typeof pushRemote==='function'&&cloudSyncEnabled)pushRemote(true);
      });
    };
    renderStep(1);modal.classList.add('open');
  }

  async function fileRequest(url,options={}){
    const r=await window.perekoAuthFetch(url,options);
    const type=r.headers.get('content-type')||'';
    const body=type.includes('application/json')?await r.json():null;
    if(!r.ok)throw new Error(body?.error||('HTTP '+r.status));
    return body;
  }
  async function fetchMaterials(p,force=false){
    const cached=materialCache.get(p.id);
    if(!force&&cached&&Date.now()-cached.at<15000)return cached.items;
    const data=await fileRequest(FILE_API+'?projectId='+encodeURIComponent(p.id));
    const items=(Array.isArray(data.items)?data.items:[]).filter(x=>!x.trashed);
    materialCache.set(p.id,{at:Date.now(),items});
    return items;
  }
  async function loadMaterialsInto(p,list,status){
    if(!list)return;
    try{
      const items=await fetchMaterials(p);
      if(!list.isConnected)return;
      list.innerHTML=items.length?items.map(item=>
        '<div class="piw-material-row"><div class="piw-file-icon">'+esc((String(item.originalName||'').split('.').pop()||'FILE').slice(0,4).toUpperCase())+'</div><div class="piw-material-copy"><strong>'+esc(item.originalName||'Plik')+'</strong><span>'+esc(fmtBytes(item.size))+' · '+esc(fmtDateTime(item.uploadedAt))+' · '+esc(item.uploaderName||'Użytkownik')+'</span></div></div>'
      ).join(''):'<div class="piw-empty">Brak przypiętych materiałów.</div>';
      if(status)status.textContent=items.length?(items.length+' '+(items.length===1?'materiał':'materiały')):'';
    }catch(error){
      list.innerHTML='<div class="piw-empty">Nie udało się pobrać materiałów.</div>';
      if(status){status.textContent=error.message||'Błąd magazynu plików';status.classList.add('error')}
    }
  }
  async function uploadMaterialFiles(p,fileList,statusCb){
    const files=[...fileList].filter(Boolean);
    for(let i=0;i<files.length;i++){
      const file=files[i];let begin=null;
      if(file.size>MAX_FILE_BYTES)throw new Error(file.name+': maksymalny rozmiar pliku to 5 MB.');
      try{
        statusCb?.('Przygotowanie '+file.name+'…');
        begin=await fileRequest(FILE_API+'?action=begin',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            projectId:p.id,projectNumber:window.perekoProjectNumberLabel?.(p)||'',projectName:p.name,
            fileName:file.name,contentType:file.type||'application/octet-stream',size:file.size,
            uploaderName:currentPerson().name||''
          })
        });
        const parts=[],count=Math.max(1,Math.ceil(file.size/CHUNK_SIZE));
        for(let part=0;part<count;part++){
          const chunk=file.slice(part*CHUNK_SIZE,Math.min(file.size,(part+1)*CHUNK_SIZE));
          statusCb?.('Wysyłanie '+file.name+' · '+Math.round(part/count*100)+'%');
          const r=await window.perekoAuthFetch(FILE_API+'?action=upload-part&key='+encodeURIComponent(begin.key)+'&uploadId='+encodeURIComponent(begin.uploadId)+'&partNumber='+(part+1),{
            method:'PUT',body:chunk,headers:{'Content-Type':'application/octet-stream'}
          });
          const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Błąd wysyłki');
          parts.push({partNumber:data.partNumber,etag:data.etag});
        }
        await fileRequest(FILE_API+'?action=complete',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({key:begin.key,uploadId:begin.uploadId,parts})
        });
      }catch(error){
        if(begin?.key&&begin?.uploadId){
          try{await fileRequest(FILE_API+'?action=abort',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:begin.key,uploadId:begin.uploadId})})}catch{}
        }
        throw error;
      }
    }
    materialCache.delete(p.id);
  }
  function openMaterialModal(p){
    const modal=buildModal('piwMaterialModal');
    modal.innerHTML='<div class="piw-modal-card"><div class="piw-modal-head"><div><span class="piw-kicker">MATERIAŁY PROJEKTU</span><h3>Dodaj plik</h3><p>Możesz dodać kilka plików. Maksymalny rozmiar pojedynczego pliku: 5 MB.</p></div><button class="piw-icon-btn" type="button" data-close>×</button></div>'+
      '<label class="piw-field"><span>Wybierz pliki</span><input type="file" multiple data-files></label><div class="piw-file-picked" data-picked></div><div class="piw-material-status" data-upload-status></div>'+
      '<div class="piw-modal-actions"><button class="piw-btn" type="button" data-cancel>Anuluj</button><button class="piw-btn primary" type="button" data-save>Dodaj pliki</button></div></div>';
    const input=modal.querySelector('[data-files]'),picked=modal.querySelector('[data-picked]'),status=modal.querySelector('[data-upload-status]'),saveBtn=modal.querySelector('[data-save]');
    input.onchange=()=>{picked.innerHTML=[...input.files].map(f=>'<span>'+esc(f.name)+' · '+esc(fmtBytes(f.size))+'</span>').join('')};
    modal.querySelector('[data-close]').onclick=modal.querySelector('[data-cancel]').onclick=()=>closeModal(modal);
    saveBtn.onclick=async()=>{
      if(!input.files.length)return;
      saveBtn.disabled=true;
      try{
        await uploadMaterialFiles(p,input.files,text=>status.textContent=text);
        status.textContent='Pliki dodane.';
        closeModal(modal);
        enhance();
      }catch(error){
        status.textContent=error.message||'Nie udało się dodać plików.';status.classList.add('error');saveBtn.disabled=false;
      }
    };
    modal.classList.add('open');
  }

  function openInlineProject(projectId,taskId){
    if(!projectId)return false;
    let card=document.querySelector('.project[data-project-id="'+CSS.escape(String(projectId))+'"]');
    if(!card){
      activeFilter='all';
      document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));
      render();
      card=document.querySelector('.project[data-project-id="'+CSS.escape(String(projectId))+'"]');
    }
    if(!card)return false;
    if(!card.classList.contains('expanded'))card.querySelector('.project-expand-btn')?.click();
    setTimeout(()=>{
      const fresh=document.querySelector('.project[data-project-id="'+CSS.escape(String(projectId))+'"]');
      fresh?.scrollIntoView({behavior:'smooth',block:'start'});
      if(taskId){
        const row=[...document.querySelectorAll('[data-piw-task-id]')].find(x=>String(x.dataset.piwTaskId)===String(taskId));
        row?.classList.add('pwa-deep-link-target');
        row?.scrollIntoView({behavior:'smooth',block:'center'});
        setTimeout(()=>row?.classList.remove('pwa-deep-link-target'),2600);
      }
    },120);
    return true;
  }

  const baseRender=render;
  render=function(){baseRender();enhance()};

  window.openProjectDetail=id=>openInlineProject(id);
  window.perekoOpenDeepLink=({projectId,taskId}={})=>openInlineProject(projectId,taskId);
  window.addEventListener('pereko:data-refreshed',enhance);
  document.addEventListener('pereko:user-ready',enhance);
  document.addEventListener('pereko:team-changed',enhance);
  enhance();
})();
