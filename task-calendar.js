(()=>{
  let selectedTaskDate='';
  let taskHistoryOpen=false;
  const isoToday=()=>{
    const d=new Date();
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const addDays=(iso,delta)=>{
    const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+delta);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const niceDate=iso=>new Date(iso+'T12:00:00').toLocaleDateString('pl-PL',{weekday:'long',day:'2-digit',month:'long'});
  const shortDate=iso=>new Date(iso+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'});
  const nowISO=()=>new Date().toISOString();
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
      if(t.done&&!t.completedOn){t.completedOn=t.scheduledFor||today;t.completedAt=t.completedAt||nowISO();addHistory(t,'done','Zadanie zamknięte',t.completedOn);changed=true}
    });
    tasks.forEach(t=>{
      if(!t.done&&t.scheduledFor<today){
        const from=t.scheduledFor;
        t.scheduledFor=today;
        addHistory(t,'rollover',`Przeniesiono automatycznie z ${shortDate(from)}`,today);
        changed=true;
      }
    });
    if(changed){saveLocal();if(cloudSyncEnabled)queueMicrotask(()=>pushRemote())}
  };

  function buildTaskUI(){
    const list=document.querySelector('#taskList');if(!list)return;
    const module=list.closest('.module');if(!module||module.dataset.calendarReady==='1')return;
    module.dataset.calendarReady='1';
    module.classList.add('task-calendar-module');
    const head=module.querySelector('.module-head');
    head.innerHTML=`<div><span class="module-label">TERAZ</span><h2>Zadania</h2></div><div class="task-head-actions"><button type="button" class="task-glass-btn" id="taskHistoryBtn">Historia</button><button type="button" class="task-glass-btn accent" id="taskAddBtn">+ Zadanie</button></div>`;
    list.insertAdjacentHTML('beforebegin',`
      <div class="task-date-nav">
        <button type="button" class="task-nav-arrow" id="taskPrevDay" aria-label="Poprzedni dzień">‹</button>
        <button type="button" class="task-date-main" id="taskTodayJump"><span id="taskDateLabel"></span><small id="taskDateHint"></small></button>
        <button type="button" class="task-nav-arrow" id="taskNextDay" aria-label="Następny dzień">›</button>
      </div>
      <div class="task-add-form" id="taskAddForm">
        <input id="taskNewText" type="text" placeholder="Nazwa zadania">
        <input id="taskNewDate" type="date">
        <button type="button" class="task-save-btn" id="taskSaveNew">Dodaj</button>
      </div>`);
    list.insertAdjacentHTML('afterend',`<div class="task-closed-wrap" id="taskClosedWrap"></div><div class="task-history-panel" id="taskHistoryPanel"></div>`);
    document.querySelector('#taskPrevDay').onclick=()=>{selectedTaskDate=addDays(selectedTaskDate,-1);renderTaskCalendar()};
    document.querySelector('#taskNextDay').onclick=()=>{selectedTaskDate=addDays(selectedTaskDate,1);renderTaskCalendar()};
    document.querySelector('#taskTodayJump').onclick=()=>{selectedTaskDate=isoToday();renderTaskCalendar()};
    document.querySelector('#taskAddBtn').onclick=()=>{
      const form=document.querySelector('#taskAddForm');
      form.classList.toggle('open');
      document.querySelector('#taskNewDate').value=selectedTaskDate<isoToday()?isoToday():selectedTaskDate;
      if(form.classList.contains('open'))document.querySelector('#taskNewText').focus();
    };
    document.querySelector('#taskHistoryBtn').onclick=()=>{taskHistoryOpen=!taskHistoryOpen;renderTaskHistory()};
    document.querySelector('#taskSaveNew').onclick=addGlobalTask;
    document.querySelector('#taskNewText').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addGlobalTask()}});
  }

  function addGlobalTask(){
    const text=document.querySelector('#taskNewText').value.trim();if(!text)return;
    const date=document.querySelector('#taskNewDate').value||isoToday();
    const t={id:crypto.randomUUID(),text,done:false,createdAt:nowISO(),scheduledFor:date,completedAt:null,completedOn:null,history:[]};
    addHistory(t,'created',`Utworzono zadanie na ${shortDate(date)}`,date);
    tasks.push(t);
    document.querySelector('#taskNewText').value='';
    document.querySelector('#taskAddForm').classList.remove('open');
    save();renderTaskCalendar();
  }

  function visibleOpenTasks(){
    const today=isoToday();
    if(selectedTaskDate<today)return [];
    if(selectedTaskDate===today)return tasks.filter(t=>!t.done&&t.scheduledFor<=today);
    return tasks.filter(t=>!t.done&&t.scheduledFor===selectedTaskDate);
  }
  function visibleClosedTasks(){return tasks.filter(t=>t.done&&t.completedOn===selectedTaskDate)}

  function toggleTaskDone(id,checked){
    const t=tasks.find(x=>x.id===id);if(!t)return;
    if(checked){
      t.done=true;t.completedAt=nowISO();t.completedOn=selectedTaskDate;
      addHistory(t,'done','Zadanie oznaczono jako wykonane',selectedTaskDate);
    }else{
      t.done=false;t.completedAt=null;t.completedOn=null;t.scheduledFor=isoToday();
      addHistory(t,'reopen','Zadanie ponownie otwarte i przeniesione na dziś',isoToday());
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
    list.innerHTML=open.length?open.map(t=>`<label class="task task-calendar-item"><input type="checkbox" data-calendar-task="${t.id}"><span><strong>${esc(t.text)}</strong><small>${t.scheduledFor===today?'Na dziś':`Zaplanowane: ${esc(shortDate(t.scheduledFor))}`}</small></span></label>`).join(''):`<div class="task-day-empty">${selectedTaskDate<today?'Brak otwartych zadań — niezakończone zostały przeniesione dalej.':selectedTaskDate===today?'Brak otwartych zadań na dziś.':'Brak zaplanowanych zadań na ten dzień.'}</div>`;
    document.querySelectorAll('[data-calendar-task]').forEach(el=>el.onchange=()=>toggleTaskDone(el.dataset.calendarTask,el.checked));
    const closed=visibleClosedTasks(),wrap=document.querySelector('#taskClosedWrap');
    if(wrap)wrap.innerHTML=closed.length?`<div class="task-closed-head"><span>ZAMKNIĘTE</span><strong>${closed.length}</strong></div>${closed.map(t=>`<label class="task task-calendar-item done archived"><input type="checkbox" data-calendar-closed="${t.id}" checked><span><strong>${esc(t.text)}</strong><small>Zamknięte ${new Date(t.completedAt||nowISO()).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</small></span></label>`).join('')}`:'';
    document.querySelectorAll('[data-calendar-closed]').forEach(el=>el.onchange=()=>toggleTaskDone(el.dataset.calendarClosed,el.checked));
    const dateInput=document.querySelector('#taskNewDate');if(dateInput&&!dateInput.value)dateInput.value=selectedTaskDate<today?today:selectedTaskDate;
    renderTaskHistory();
  }

  function renderTaskHistory(){
    const panel=document.querySelector('#taskHistoryPanel');if(!panel)return;
    const events=[];
    tasks.forEach(t=>(t.history||[]).forEach(h=>events.push({...h,taskText:t.text})));
    events.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    panel.classList.toggle('open',taskHistoryOpen);
    panel.innerHTML=taskHistoryOpen?`<div class="task-history-head"><span>HISTORIA ZADAŃ</span><small>ostatnie ${Math.min(events.length,20)} zdarzeń</small></div><div class="task-history-list">${events.slice(0,20).map(e=>`<div class="task-history-event ${esc(e.type)}"><i></i><div><strong>${esc(e.taskText)}</strong><span>${esc(e.text)}</span><small>${esc(e.date)} · ${new Date(e.createdAt).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div></div>`).join('')||'<div class="task-day-empty">Historia jest jeszcze pusta.</div>'}</div>`:'';
    const btn=document.querySelector('#taskHistoryBtn');if(btn)btn.classList.toggle('active',taskHistoryOpen);
  }

  const baseRender=render;
  render=function(){baseRender();renderTaskCalendar()};
  const baseLoadRemote=loadRemote;
  loadRemote=async function(){const out=await baseLoadRemote();normalizeTasks();renderTaskCalendar();return out};
  selectedTaskDate=isoToday();
  normalizeTasks();
  renderTaskCalendar();
})();