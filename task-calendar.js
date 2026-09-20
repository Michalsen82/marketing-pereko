(async()=>{
  try{if(window.perekoAuthReady)await window.perekoAuthReady}catch{return}
  let selectedTaskDate='';
  let taskHistoryOpen=false;
  const legacyOwner='Michał Bukowski';
  const currentPerson=()=>window.perekoLoggedPerson||{};
  const normPerson=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const isMine=assignee=>{
    const p=currentPerson(),a=normPerson(assignee),full=normPerson(p.name),email=normPerson(p.email),first=full.split(' ')[0];
    return !!a&&(a===full||a===email||(first&&a===first));
  };
  const isoToday=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const addDays=(iso,delta)=>{
    const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+delta);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const niceDate=iso=>new Date(iso+'T12:00:00').toLocaleDateString('pl-PL',{weekday:'long',day:'2-digit',month:'long'});
  const shortDate=iso=>new Date(iso+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'});
  const nowISO=()=>new Date().toISOString();
  const taskNumberLabel=t=>window.perekoTaskNumberLabel?.(t)||'Z-—';
  const addHistory=(task,type,text,date=isoToday())=>{
    if(!Array.isArray(task.history))task.history=[];
    task.history.unshift({id:crypto.randomUUID(),type,text,date,createdAt:nowISO()});
  };

  const normalizeTasks=()=>{
    const today=isoToday();let changed=false;
    tasks.forEach(t=>{
      if(!t.id){t.id=crypto.randomUUID();changed=true}
      if(!t.createdAt){t.createdAt=nowISO();changed=true}
      if(!t.scheduledFor){t.scheduledFor=t.done?(t.completedOn||today):today;changed=true}
      if(!Array.isArray(t.history)){t.history=[];changed=true}
      if(!t.assignee){t.assignee=legacyOwner;changed=true}
      if(t.done&&!t.completedOn){t.completedOn=t.scheduledFor||today;t.completedAt=t.completedAt||nowISO();addHistory(t,'done','Task zamknięty',t.completedOn);changed=true}
    });
    tasks.forEach(t=>{
      if(!t.done&&t.scheduledFor<today){
        const from=t.scheduledFor;
        t.scheduledFor=today;
        addHistory(t,'rollover',`Przeniesiono automatycznie z ${shortDate(from)}`,today);
        changed=true;
      }
    });
    if(changed)save();
  };

  function personalProjectTasks(){
    const out=[];
    projects.forEach(p=>(Array.isArray(p.projectTasks)?p.projectTasks:[]).forEach(t=>{
      if(isMine(t.assignee))out.push({...t,_source:'project',_projectId:p.id,_projectName:p.name});
    }));
    return out;
  }

  function buildTaskUI(){
    const list=document.querySelector('#taskList');if(!list)return;
    const module=list.closest('.module');if(!module||module.dataset.calendarReady==='1')return;
    module.dataset.calendarReady='1';
    module.classList.add('task-calendar-module');
    const head=module.querySelector('.module-head');
    head.innerHTML=`<div><span class="module-label">DZIŚ</span><h2>TASKI NA DZIŚ</h2></div><div class="task-head-actions"><button type="button" class="task-glass-btn" id="taskHistoryBtn">Historia</button><button type="button" class="task-glass-btn accent" id="taskAddBtn">+ Task</button></div>`;
    list.insertAdjacentHTML('beforebegin',`
      <div class="task-date-nav">
        <button type="button" class="task-nav-arrow" id="taskPrevDay" aria-label="Poprzedni dzień">‹</button>
        <button type="button" class="task-date-main" id="taskTodayJump"><span id="taskDateLabel"></span><small id="taskDateHint"></small></button>
        <button type="button" class="task-nav-arrow" id="taskNextDay" aria-label="Następny dzień">›</button>
      </div>
      <div class="task-add-form" id="taskAddForm">
        <input id="taskNewText" type="text" placeholder="Nazwa taska">
        <label class="task-date-field" for="taskNewDate">
          <span class="task-date-value" id="taskNewDateValue">Wybierz datę</span>
          <span class="task-date-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm12 8H5v9h14v-9ZM5 8h14V6H5v2Z"/></svg></span>
          <input id="taskNewDate" type="date" aria-label="Termin taska">
        </label>
        <button type="button" class="task-save-btn" id="taskSaveNew">Dodaj</button>
      </div>`);
    list.insertAdjacentHTML('afterend','<div class="task-closed-wrap" id="taskClosedWrap"></div><div class="task-history-panel" id="taskHistoryPanel"></div>');
    document.querySelector('#taskPrevDay').onclick=()=>{selectedTaskDate=addDays(selectedTaskDate,-1);renderTaskCalendar()};
    document.querySelector('#taskNextDay').onclick=()=>{selectedTaskDate=addDays(selectedTaskDate,1);renderTaskCalendar()};
    document.querySelector('#taskTodayJump').onclick=()=>{selectedTaskDate=isoToday();renderTaskCalendar()};
    const taskDateInput=document.querySelector('#taskNewDate');
    const taskDateValue=document.querySelector('#taskNewDateValue');
    const syncTaskDateValue=()=>{
      if(!taskDateInput||!taskDateValue)return;
      const v=taskDateInput.value;
      taskDateValue.textContent=v?new Date(v+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}):'Wybierz datę';
      taskDateValue.classList.toggle('has-value',!!v);
    };
    taskDateInput?.addEventListener('change',syncTaskDateValue);
    taskDateInput?.addEventListener('input',syncTaskDateValue);

    document.querySelector('#taskAddBtn').onclick=()=>{
      const form=document.querySelector('#taskAddForm');
      form.classList.toggle('open');
      taskDateInput.value=selectedTaskDate<isoToday()?isoToday():selectedTaskDate;
      syncTaskDateValue();
      if(form.classList.contains('open'))document.querySelector('#taskNewText').focus();
    };
    document.querySelector('#taskHistoryBtn').onclick=()=>{taskHistoryOpen=!taskHistoryOpen;renderTaskHistory()};
    document.querySelector('#taskSaveNew').onclick=addGlobalTask;
    document.querySelector('#taskNewText').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addGlobalTask()}});
  }

  function addGlobalTask(){
    const text=document.querySelector('#taskNewText').value.trim();if(!text)return;
    const date=document.querySelector('#taskNewDate').value||isoToday();
    const who=currentPerson().name||currentPerson().email||legacyOwner;
    const identity=window.perekoNextTaskIdentity?.()||{taskNumber:1,taskYear:new Date().getFullYear()};
    const t={id:crypto.randomUUID(),...identity,text,assignee:who,done:false,createdAt:nowISO(),scheduledFor:date,completedAt:null,completedOn:null,history:[]};
    addHistory(t,'created',`Utworzono task na ${shortDate(date)}`,date);
    tasks.push(t);
    document.querySelector('#taskNewText').value='';
    document.querySelector('#taskAddForm').classList.remove('open');
    save();renderTaskCalendar();
  }

  function visibleOpenTasks(){
    const today=isoToday();
    if(selectedTaskDate<today)return [];
    const globals=tasks
      .filter(t=>isMine(t.assignee)&&!t.done&&(selectedTaskDate===today?t.scheduledFor<=today:t.scheduledFor===selectedTaskDate))
      .map(t=>({...t,_source:'global'}));
    const projectOnes=personalProjectTasks()
      .filter(t=>!t.done&&t.deadline&&(selectedTaskDate===today?t.deadline<=today:t.deadline===selectedTaskDate));
    return [...globals,...projectOnes];
  }

  function visibleClosedTasks(){
    /* Zamknięte zadania projektowe pozostają w projekcie i nie dublują się
       w bocznym module „Taski na dziś”. Ten moduł archiwizuje wyłącznie
       taski utworzone bezpośrednio w kalendarzu. */
    return tasks
      .filter(t=>isMine(t.assignee)&&t.done&&t.completedOn===selectedTaskDate)
      .map(t=>({...t,_source:'global'}));
  }

  function toggleTaskDone(id,checked,source='global',projectId=''){
    if(source==='project'){
      const p=projects.find(x=>x.id===projectId);if(!p)return;
      const t=(p.projectTasks||[]).find(x=>x.id===id);if(!t)return;
      t.done=checked;
      if(checked){t.completedAt=nowISO();t.completedOn=selectedTaskDate}
      else{t.completedAt=null;t.completedOn=null}
      save();renderTaskCalendar();return;
    }
    const t=tasks.find(x=>x.id===id);if(!t)return;
    if(checked){
      t.done=true;t.completedAt=nowISO();t.completedOn=selectedTaskDate;
      addHistory(t,'done','Task oznaczono jako wykonany',selectedTaskDate);
    }else{
      t.done=false;t.completedAt=null;t.completedOn=null;t.scheduledFor=isoToday();
      addHistory(t,'reopen','Task ponownie otwarty i przeniesiony na dziś',isoToday());
      selectedTaskDate=isoToday();
    }
    save();renderTaskCalendar();
  }

  function renderTaskCalendar(){
    normalizeTasks();buildTaskUI();
    if(!selectedTaskDate)selectedTaskDate=isoToday();
    const today=isoToday(),label=document.querySelector('#taskDateLabel'),hint=document.querySelector('#taskDateHint');
    if(label)label.textContent=niceDate(selectedTaskDate);
    if(hint)hint.textContent=selectedTaskDate===today?'Dzisiaj':selectedTaskDate<today?'Archiwum dnia':'Zaplanowane';
    const list=document.querySelector('#taskList');if(!list)return;
    const open=visibleOpenTasks();
    list.innerHTML=open.length?open.map(t=>`<label class="task task-calendar-item"><input type="checkbox" data-calendar-task="${t.id}" data-task-source="${t._source||'global'}" data-project-id="${t._projectId||''}"><span><b class="task-number">${esc(taskNumberLabel(t))}</b><strong>${esc(t.text)}</strong><small>${t._source==='project'?`Projekt: ${esc(t._projectName||'')}`:(t.scheduledFor===today?'Na dziś':`Zaplanowane: ${esc(shortDate(t.scheduledFor))}`)}</small></span></label>`).join(''):`<div class="task-day-empty">${selectedTaskDate<today?'Brak otwartych tasków — niezakończone zostały przeniesione dalej.':selectedTaskDate===today?'Brak Twoich otwartych tasków na dziś.':'Brak Twoich tasków zaplanowanych na ten dzień.'}</div>`;
    document.querySelectorAll('[data-calendar-task]').forEach(el=>el.onchange=()=>toggleTaskDone(el.dataset.calendarTask,el.checked,el.dataset.taskSource,el.dataset.projectId));
    const closed=visibleClosedTasks(),wrap=document.querySelector('#taskClosedWrap');
    if(wrap)wrap.innerHTML=closed.length?`<div class="task-closed-head"><span>ZAMKNIĘTE</span><strong>${closed.length}</strong></div>${closed.map(t=>`<label class="task task-calendar-item done archived"><input type="checkbox" data-calendar-closed="${t.id}" data-task-source="${t._source||'global'}" data-project-id="${t._projectId||''}" checked><span><b class="task-number">${esc(taskNumberLabel(t))}</b><strong>${esc(t.text)}</strong><small>${t._source==='project'?`Projekt: ${esc(t._projectName||'')}`:`Zamknięte ${new Date(t.completedAt||nowISO()).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}`}</small></span></label>`).join('')}`:''; 
    document.querySelectorAll('[data-calendar-closed]').forEach(el=>el.onchange=()=>toggleTaskDone(el.dataset.calendarClosed,el.checked,el.dataset.taskSource,el.dataset.projectId));
    const dateInput=document.querySelector('#taskNewDate');
    if(dateInput&&!dateInput.value)dateInput.value=selectedTaskDate<today?today:selectedTaskDate;
    const dateValue=document.querySelector('#taskNewDateValue');
    if(dateInput&&dateValue){
      dateValue.textContent=dateInput.value?new Date(dateInput.value+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}):'Wybierz datę';
      dateValue.classList.toggle('has-value',!!dateInput.value);
    }
    renderTaskHistory();
  }

  function renderTaskHistory(){
    const panel=document.querySelector('#taskHistoryPanel');if(!panel)return;
    const events=[];
    tasks.filter(t=>isMine(t.assignee)).forEach(t=>(t.history||[]).forEach(h=>events.push({...h,taskText:t.text})));
    events.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    panel.classList.toggle('open',taskHistoryOpen);
    panel.innerHTML=taskHistoryOpen?`<div class="task-history-head"><span>HISTORIA TASKÓW</span><small>ostatnie ${Math.min(events.length,20)} zdarzeń</small></div><div class="task-history-list">${events.slice(0,20).map(e=>`<div class="task-history-event ${esc(e.type)}"><i></i><div><strong>${esc(e.taskText)}</strong><span>${esc(e.text)}</span><small>${esc(e.date)} · ${new Date(e.createdAt).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')||'<div class="task-day-empty">Historia jest jeszcze pusta.</div>'}</div>`:'';
    const btn=document.querySelector('#taskHistoryBtn');if(btn)btn.classList.toggle('active',taskHistoryOpen);
  }

  const baseRender=render;
  render=function(){baseRender();renderTaskCalendar()};
  const baseLoadRemote=loadRemote;
  loadRemote=async function(...args){const out=await baseLoadRemote(...args);if(out){normalizeTasks();renderTaskCalendar()}return out};
  selectedTaskDate=isoToday();
  normalizeTasks();
  renderTaskCalendar();

  window.perekoOpenTaskCalendar=(date,taskId)=>{
    selectedTaskDate=date||isoToday();
    renderTaskCalendar();
    const module=document.querySelector('#taskList')?.closest('.module');
    module?.scrollIntoView({behavior:'smooth',block:'start'});
    if(taskId){
      setTimeout(()=>{
        const target=[...document.querySelectorAll('[data-calendar-task]')].find(el=>String(el.dataset.calendarTask)===String(taskId))?.closest('.task-calendar-item');
        if(!target)return;
        target.classList.add('pwa-deep-link-target');
        target.scrollIntoView({behavior:'smooth',block:'center'});
        setTimeout(()=>target.classList.remove('pwa-deep-link-target'),2600);
      },120);
    }
  };
})();