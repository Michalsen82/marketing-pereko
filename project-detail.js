(()=>{
  const TEAM=['Michał Bukowski','Wiktoria Adamczyk','Łukasz Drozdowski','Paweł Chaja','Andrzej Guzera','Randomowy User'];
  const getTeamNames=()=>{
    let local=[];
    try{local=JSON.parse(localStorage.getItem('pereko_team')||'[]')}catch{}
    return [...new Set([...TEAM,...local.map(p=>p?.name),window.perekoLoggedPerson?.name].filter(Boolean))];
  };
  let currentProjectId=null;
  const normPerson=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const isLoggedAssignee=assignee=>{
    const person=window.perekoLoggedPerson||{};
    const assigned=normPerson(assignee);
    if(!assigned)return false;
    const full=normPerson(person.name);
    const email=normPerson(person.email);
    const first=full.split(' ')[0];
    return assigned===full||assigned===email||(first&&assigned===first);
  };

  const ensureProjectData=p=>{
    if(!Array.isArray(p.members)) p.members=p.owner?[p.owner]:[];
    if(!Array.isArray(p.projectTasks)) p.projectTasks=[];
    if(!Array.isArray(p.comments)) p.comments=[];
    if(typeof p.desc!=='string') p.desc='';
    return p;
  };

  const formatDateTime=value=>{
    try{return new Date(value).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return value||''}
  };
  const formatDate=value=>{
    if(!value)return 'Brak';
    try{return new Date(value+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return value}
  };
  const deadlineInfo=(value,status)=>{
    if(!value)return {text:'Brak terminu',state:'none'};
    if(status==='done')return {text:'Projekt zakończony',state:'done'};
    const today=new Date();today.setHours(0,0,0,0);
    const end=new Date(value+'T00:00:00');end.setHours(0,0,0,0);
    const diff=Math.round((end-today)/86400000);
    if(diff<0)return {text:Math.abs(diff)+' dni po terminie',state:'overdue'};
    if(diff===0)return {text:'Dzisiaj',state:'today'};
    if(diff===1)return {text:'1 dzień',state:'soon'};
    return {text:diff+' dni',state:diff<=7?'soon':'normal'};
  };
  const enableDatePicker=input=>{
    if(!input||input.dataset.pickerReady==='1')return;
    input.dataset.pickerReady='1';
    input.addEventListener('click',()=>{
      if(typeof input.showPicker==='function'){
        try{input.showPicker()}catch{}
      }
    });
    input.addEventListener('keydown',e=>{
      if((e.key==='Enter'||e.key===' ')&&typeof input.showPicker==='function'){
        e.preventDefault();
        try{input.showPicker()}catch{}
      }
    });
  };

  function buildModal(){
    if(document.querySelector('#projectDetailModal'))return;
    const modal=document.createElement('div');
    modal.className='project-detail-modal';
    modal.id='projectDetailModal';
    modal.innerHTML=`
      <div class="project-detail-card">
        <div class="project-detail-top">
          <div>
            <span class="project-detail-kicker">PROJEKT MARKETINGOWY</span>
            <h2 id="pdTitle">Projekt</h2>
            <p id="pdSubtitle">Szczegóły, zespół, zadania i komentarze w jednym miejscu.</p>
          </div>
          <button class="pd-icon-btn" id="pdClose" type="button" aria-label="Zamknij">×</button>
        </div>

        <div class="project-detail-grid">
          <section class="pd-main">
            <div class="pd-card pd-overview-card">
              <div class="pd-card-head"><div><span>USTAWIENIA</span><h3>Parametry projektu</h3></div></div>
              <div class="pd-form-grid">
                <label class="pd-field"><span>Status</span><select id="pdStatus"><option value="plan">Planowany</option><option value="work">W realizacji</option><option value="done">Zakończony</option></select></label>
                <label class="pd-field"><span>Termin</span><input id="pdDeadline" type="date"></label>
                <label class="pd-field"><span>Osoba odpowiedzialna</span><input id="pdOwner" type="text" placeholder="np. Michał"></label>
                <label class="pd-field"><span>Postęp</span><div class="pd-progress-control pd-progress-readonly"><div class="pd-progress-bar"><span id="pdProgressBar"></span></div><strong id="pdProgressValue">0%</strong></div><small id="pdProgressHint" class="pd-progress-hint"></small></label>
                <label class="pd-field pd-full"><span>Opis projektu</span><textarea id="pdDesc" rows="4" placeholder="Zakres, cel, najważniejsze informacje..."></textarea></label>
              </div>
            </div>

            <div class="pd-card">
              <div class="pd-card-head">
                <div><span>ZADANIA</span><h3>Zadania projektu</h3></div>
                <button class="pd-glass-btn" id="pdAddTask" type="button">+ Dodaj zadanie</button>
              </div>
              <div class="pd-task-form" id="pdTaskForm">
                <input id="pdTaskText" type="text" placeholder="Nazwa zadania">
                <select id="pdTaskAssignee"><option value="">Bez przypisania</option></select>
                <input id="pdTaskDeadline" type="date">
                <button class="pd-accent-btn" id="pdTaskSave" type="button">Dodaj</button>
              </div>
              <div class="pd-task-list" id="pdTaskList"></div>
            </div>

            <div class="pd-card">
              <div class="pd-card-head"><div><span>KOMENTARZE</span><h3>Notatki i ustalenia</h3></div></div>
              <div class="pd-comment-form">
                <textarea id="pdCommentText" rows="3" placeholder="Dodaj komentarz, ustalenie lub notatkę do projektu..."></textarea>
                <button class="pd-accent-btn" id="pdCommentSave" type="button">Dodaj komentarz</button>
              </div>
              <div class="pd-comments" id="pdComments"></div>
            </div>
          </section>

          <aside class="pd-side">
            <div class="pd-card">
              <div class="pd-card-head"><div><span>ZESPÓŁ</span><h3>Osoby w projekcie</h3></div></div>
              <div class="pd-members" id="pdMembers"></div>
              <div class="pd-member-add">
                <select id="pdMemberSelect"></select>
                <button class="pd-glass-btn" id="pdMemberAdd" type="button">+ Przypisz</button>
              </div>
            </div>

            <div class="pd-card pd-summary">
              <div class="pd-card-head"><div><span>PODSUMOWANIE</span><h3>Stan projektu</h3></div></div>
              <div class="pd-summary-row"><span>Status</span><strong id="pdSummaryStatus">—</strong></div>
              <div class="pd-summary-row"><span>Termin</span><strong id="pdSummaryDeadline">—</strong></div>
              <div class="pd-summary-row"><span>Do końca</span><strong id="pdSummaryRemaining">—</strong></div>
              <div class="pd-summary-row"><span>Postęp</span><strong id="pdSummaryProgress">—</strong></div>
              <div class="pd-summary-row"><span>Zadania</span><strong id="pdSummaryTasks">0</strong></div>
              <div class="pd-summary-row"><span>Otwarte zadania</span><strong id="pdSummaryOpenTasks">0</strong></div>
              <div class="pd-summary-row"><span>Zespół</span><strong id="pdSummaryMembers">0</strong></div>
              <div class="pd-danger-zone"><button type="button" id="pdDeleteProject">Usuń projekt</button></div>
            </div>
          </aside>
        </div>
      </div>`;
    document.body.appendChild(modal);

    $('#pdClose').onclick=closeProjectDetail;
    modal.addEventListener('click',e=>{if(e.target===modal)closeProjectDetail()});
    $('#pdAddTask').onclick=()=>$('#pdTaskText').focus();
    $('#pdTaskSave').onclick=addProjectTask;
    $('#pdCommentSave').onclick=addProjectComment;
    $('#pdMemberAdd').onclick=addMember;

    ['#pdStatus','#pdDeadline','#pdOwner','#pdDesc'].forEach(sel=>$(sel).addEventListener('change',persistOverview));
    enableDatePicker($('#pdDeadline'));
    enableDatePicker($('#pdTaskDeadline'));
    $('#pdDeleteProject').onclick=deleteCurrentProject;
  }

  function getCurrent(){return projects.find(p=>p.id===currentProjectId)||null}

  function syncProjectProgress(p){
    ensureProjectData(p);
    const total=p.projectTasks.length;
    const done=p.projectTasks.filter(t=>t.done).length;
    p.progress=total?Math.round(done/total*100):0;
    if(total&&done===total)p.status='done';
    else if(total&&p.status==='done')p.status='work';
    return {total,done,progress:p.progress};
  }

  function deleteCurrentProject(){
    const p=getCurrent();if(!p)return;
    if(!confirm(`Usunąć projekt „${p.name}”? Tej operacji nie można cofnąć.`))return;
    projects=projects.filter(x=>x.id!==p.id);
    currentProjectId=null;
    save();
    render();
    closeProjectDetail();
    if(typeof pushRemote==='function'&&cloudSyncEnabled)pushRemote(true);
  }

  function openProjectDetail(id){
    buildModal();
    currentProjectId=id;
    const p=getCurrent();
    if(!p)return;
    ensureProjectData(p);
    fillDetail(p);
    $('#projectDetailModal').classList.add('open');
    document.body.classList.add('detail-open');
  }

  function closeProjectDetail(){
    $('#projectDetailModal')?.classList.remove('open');
    document.body.classList.remove('detail-open');
  }

  function fillDetail(p){
    $('#pdTitle').textContent=p.name;
    $('#pdStatus').value=p.status||'plan';
    $('#pdDeadline').value=p.deadline||'';
    $('#pdOwner').value=p.owner||'';
    const prog=syncProjectProgress(p);
    $('#pdProgressValue').textContent=prog.total?prog.progress+'%':'—';
    $('#pdProgressBar').style.width=prog.total?prog.progress+'%':'0%';
    $('#pdProgressHint').textContent=prog.total?`${prog.done}/${prog.total} zadań zakończonych`:'Podłącz zadania, aby liczyć postęp';
    $('#pdDesc').value=p.desc||'';

    const memberSelect=$('#pdMemberSelect');
    const assigneeSelect=$('#pdTaskAssignee');
    const choices=[...new Set([...getTeamNames(),...p.members,p.owner].filter(Boolean))];
    memberSelect.innerHTML='<option value="">Wybierz osobę</option>'+choices.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    assigneeSelect.innerHTML='<option value="">Bez przypisania</option>'+choices.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    renderMembers(p);
    renderProjectTasks(p);
    renderComments(p);
    renderSummary(p);
  }

  function persistOverview(){
    const p=getCurrent();if(!p)return;
    p.status=$('#pdStatus').value;
    p.deadline=$('#pdDeadline').value;
    p.owner=$('#pdOwner').value.trim();
    p.desc=$('#pdDesc').value.trim();
    syncProjectProgress(p);
    if(p.owner&&!p.members.includes(p.owner))p.members.unshift(p.owner);
    save();
    render();
    fillDetail(p);
  }

  function renderMembers(p){
    $('#pdMembers').innerHTML=p.members.length?p.members.map((m,i)=>`<div class="pd-member"><div class="pd-avatar">${esc(m.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div><div><strong>${esc(m)}</strong><span>${m===p.owner?'Osoba odpowiedzialna':'Zespół projektu'}</span></div><button type="button" data-remove-member="${i}" aria-label="Usuń">×</button></div>`).join(''):'<div class="pd-empty">Brak przypisanych osób.</div>';
    $$('[data-remove-member]').forEach(btn=>btn.onclick=()=>{
      const idx=+btn.dataset.removeMember;
      p.members.splice(idx,1);
      save();renderMembers(p);renderSummary(p);
    });
  }

  function addMember(){
    const p=getCurrent();if(!p)return;
    const val=$('#pdMemberSelect').value.trim();if(!val)return;
    if(!p.members.includes(val))p.members.push(val);
    save();fillDetail(p);
  }

  function renderProjectTasks(p){
    const list=$('#pdTaskList');
    list.innerHTML=p.projectTasks.length?p.projectTasks.map((t,i)=>{
      const canClose=isLoggedAssignee(t.assignee);
      const lockText=!t.assignee?'Najpierw przypisz zadanie do osoby':`Tylko ${esc(t.assignee)} może zmienić status tego zadania`;
      return `<div class="pd-task ${t.done?'done':''} ${canClose?'':'locked'}">
        <label title="${canClose?'':lockText}">
          <input type="checkbox" data-pd-task-done="${i}" ${t.done?'checked':''} ${canClose?'':'disabled'}>
          <span>
            <strong>${esc(t.text)}</strong>
            <small>${esc(t.assignee||'Bez przypisania')}${t.deadline?' · '+esc(t.deadline):''}</small>
            ${canClose?'':`<em class="pd-task-lock">${lockText}</em>`}
          </span>
        </label>
        <button type="button" data-pd-task-remove="${i}" aria-label="Usuń">×</button>
      </div>`;
    }).join(''):'<div class="pd-empty">Nie ma jeszcze zadań w tym projekcie.</div>';

    $('[data-pd-task-done]').forEach(el=>el.onchange=()=>{
      const task=p.projectTasks[+el.dataset.pdTaskDone];
      if(!task||!isLoggedAssignee(task.assignee)){
        el.checked=!!task?.done;
        return;
      }
      task.done=el.checked;
      if(el.checked){
        task.completedAt=new Date().toISOString();
        task.completedOn=new Date().toISOString().slice(0,10);
      }else{
        task.completedAt=null;
        task.completedOn=null;
      }
      syncProjectProgress(p);
      save();
      render();
      fillDetail(p);
    });
    $('[data-pd-task-remove]').forEach(el=>el.onclick=()=>{p.projectTasks.splice(+el.dataset.pdTaskRemove,1);syncProjectProgress(p);save();render();fillDetail(p)});
  }

  function addProjectTask(){
    const p=getCurrent();if(!p)return;
    const text=$('#pdTaskText').value.trim();if(!text)return;
    p.projectTasks.unshift({id:crypto.randomUUID(),text,assignee:$('#pdTaskAssignee').value,deadline:$('#pdTaskDeadline').value,done:false});
    $('#pdTaskText').value='';$('#pdTaskDeadline').value='';$('#pdTaskAssignee').value='';
    syncProjectProgress(p);save();render();fillDetail(p);
  }

  function renderComments(p){
    $('#pdComments').innerHTML=p.comments.length?p.comments.map(c=>{const author=c.author||'Użytkownik';const initials=author.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();return `<div class="pd-comment"><div class="pd-comment-avatar">${esc(initials)}</div><div><div class="pd-comment-meta"><strong>${esc(author)}</strong><span>${esc(formatDateTime(c.createdAt))}</span></div><p>${esc(c.text)}</p></div></div>`}).join(''):'<div class="pd-empty">Brak komentarzy i notatek.</div>';
  }

  function addProjectComment(){
    const p=getCurrent();if(!p)return;
    const text=$('#pdCommentText').value.trim();if(!text)return;
    p.comments.unshift({id:crypto.randomUUID(),text,author:window.perekoLoggedPerson?.name||'Użytkownik',createdAt:new Date().toISOString()});
    $('#pdCommentText').value='';
    save();renderComments(p);
  }

  function renderSummary(p){
    const prog=syncProjectProgress(p);
    const dInfo=deadlineInfo(p.deadline,p.status);
    $('#pdSummaryStatus').textContent=statusText[p.status]||'—';
    $('#pdSummaryDeadline').textContent=formatDate(p.deadline);
    $('#pdSummaryRemaining').textContent=dInfo.text;
    $('#pdSummaryRemaining').dataset.state=dInfo.state;
    $('#pdSummaryProgress').textContent=prog.total?prog.progress+'%':'—';
    $('#pdSummaryTasks').textContent=prog.done+'/'+prog.total;
    $('#pdSummaryOpenTasks').textContent=String(Math.max(0,prog.total-prog.done));
    $('#pdSummaryMembers').textContent=p.members.length;
  }

  const baseRender=render;
  render=function(){
    baseRender();
    const visible=activeFilter==='all'?projects:projects.filter(p=>p.status===activeFilter);
    $$('.project').forEach((el,i)=>{
      const p=visible[i];if(!p)return;
      ensureProjectData(p);
      let actions=el.querySelector('.project-actions');
      if(!actions){
        actions=document.createElement('div');
        actions.className='project-actions';
        actions.innerHTML=`<button type="button" class="project-open-btn">Otwórz projekt <span>→</span></button>`;
        el.querySelector('div')?.appendChild(actions);
      }
      actions.querySelector('.project-open-btn').onclick=()=>openProjectDetail(p.id);
    });
  };

  window.openProjectDetail=openProjectDetail;
  render();
})();