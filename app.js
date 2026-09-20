const defaultProjects=[{id:'p1',name:'Centrum Partnera PEREKO',owner:'Michał',status:'work',progress:55,deadline:'2026-10-15',desc:'Rozwój platformy B2B, materiały dla partnerów i narzędzia sprzedażowe.'},{id:'p2',name:'Targi HVAC 2027',owner:'Michał',status:'plan',progress:15,deadline:'2027-03-01',desc:'Plan targów, harmonogram, ekspozycja, materiały i komunikacja.'},{id:'p3',name:'Upominki świąteczne',owner:'Wiktoria',status:'plan',progress:10,deadline:'2026-11-20',desc:'Koncepcja, budżet, lista odbiorców, zamówienie i dystrybucja upominków.'},{id:'p4',name:'Świat Kominków — Targi 2027',owner:'Michał',status:'plan',progress:8,deadline:'2027-02-15',desc:'Przygotowanie obecności targowej, materiałów, komunikacji i ekspozycji.'},{id:'p5',name:'Świat Kominków — materiały do gazety',owner:'Michał',status:'work',progress:25,deadline:'2026-10-05',desc:'Artykuły, reklamy, materiały produktowe i terminy publikacji.'}];
const defaultTasks=[{text:'Ustalić najbliższe terminy dla wszystkich projektów',done:false},{text:'Rozpisać kolejne etapy Centrum Partnera PEREKO',done:false},{text:'Przygotować założenia do upominków świątecznych',done:false},{text:'Ustalić zakres materiałów do Świata Kominków',done:false}];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let projects=JSON.parse(localStorage.getItem('pereko_projects')||'null')||structuredClone(defaultProjects),tasks=JSON.parse(localStorage.getItem('pereko_tasks')||'null')||structuredClone(defaultTasks),activeFilter='all',cloudSyncEnabled=true,remoteReady=false,syncTimer=null,pendingLocalChanges=false,remotePushInFlight=false,remoteLoadInFlight=false,lastRemoteUpdatedAt='';
const currentNumberingYear=()=>new Date().getFullYear();
const itemYear=(item,key)=>{
  const raw=Number(item?.[key]);
  if(Number.isInteger(raw)&&raw>=2000&&raw<=9999)return raw;
  const created=item?.createdAt?new Date(item.createdAt):null;
  return created&&!Number.isNaN(created.getTime())?created.getFullYear():currentNumberingYear();
};
const allTaskObjects=()=>[
  ...tasks,
  ...projects.flatMap(p=>Array.isArray(p.projectTasks)?p.projectTasks:[])
];
const ensureProjectNumbers=()=>{
  let changed=false;
  const usedByYear=new Map();
  projects.forEach(p=>{
    const year=itemYear(p,'projectYear');
    if(p.projectYear!==year){p.projectYear=year;changed=true}
    if(!usedByYear.has(year))usedByYear.set(year,new Set());
    const used=usedByYear.get(year);
    const n=Number(p.projectNumber);
    if(Number.isInteger(n)&&n>0&&!used.has(n)){used.add(n);return}
    let next=1;while(used.has(next))next+=1;
    p.projectNumber=next;used.add(next);changed=true;
  });
  return changed;
};
const ensureTaskNumbers=()=>{
  let changed=false;
  const usedByYear=new Map();
  allTaskObjects().forEach(t=>{
    const year=itemYear(t,'taskYear');
    if(t.taskYear!==year){t.taskYear=year;changed=true}
    if(!usedByYear.has(year))usedByYear.set(year,new Set());
    const used=usedByYear.get(year);
    const n=Number(t.taskNumber);
    if(Number.isInteger(n)&&n>0&&!used.has(n)){used.add(n);return}
    let next=1;while(used.has(next))next+=1;
    t.taskNumber=next;used.add(next);changed=true;
  });
  return changed;
};
const nextProjectNumber=(year=currentNumberingYear())=>projects.reduce((m,p)=>{
  const n=Number(p?.projectNumber),y=itemYear(p,'projectYear');
  return y===year&&Number.isInteger(n)&&n>0?Math.max(m,n):m;
},0)+1;
const nextTaskIdentity=(year=currentNumberingYear())=>{
  const next=allTaskObjects().reduce((m,t)=>{
    const n=Number(t?.taskNumber),y=itemYear(t,'taskYear');
    return y===year&&Number.isInteger(n)&&n>0?Math.max(m,n):m;
  },0)+1;
  return {taskNumber:next,taskYear:year};
};
const numberYearSuffix=year=>String(Number(year)||currentNumberingYear()).slice(-2).padStart(2,'0');
window.perekoProjectNumberLabel=p=>{
  const n=Number(p?.projectNumber),year=itemYear(p,'projectYear');
  return Number.isInteger(n)&&n>0?`P-${String(n).padStart(3,'0')}/${numberYearSuffix(year)}`:'P-—';
};
window.perekoTaskNumberLabel=t=>{
  const n=Number(t?.taskNumber),year=itemYear(t,'taskYear');
  return Number.isInteger(n)&&n>0?`Z-${String(n).padStart(3,'0')}/${numberYearSuffix(year)}`:'Z-—';
};
window.perekoNextTaskIdentity=nextTaskIdentity;
ensureProjectNumbers();
ensureTaskNumbers();
const statusText={work:'W realizacji',plan:'Planowany',done:'Zakończony'};
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setSyncStatus=(state,title,text)=>{const c=$('#syncCard');if(!c)return;c.dataset.state=state;$('#syncTitle').textContent=title;$('#syncText').textContent=text};
const saveLocal=()=>{localStorage.setItem('pereko_projects',JSON.stringify(projects));localStorage.setItem('pereko_tasks',JSON.stringify(tasks));localStorage.setItem('pereko_dashboard_version','4')};
const ASSIGNMENT_SEEN_KEY='pereko_seen_assignments';
const normPerson=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const isMineAssignee=assignee=>{
  const person=window.perekoLoggedPerson||{};
  const assigned=normPerson(assignee);
  if(!assigned)return false;
  const full=normPerson(person.name);
  const email=normPerson(person.email);
  const first=full.split(' ')[0];
  return assigned===full||assigned===email||(first&&assigned===first);
};
const currentAssignedTaskEntries=()=>{
  const out=[];
  tasks.forEach(t=>{if(isMineAssignee(t.assignee))out.push({task:t,project:null})});
  projects.forEach(p=>(Array.isArray(p.projectTasks)?p.projectTasks:[]).forEach(t=>{
    if(isMineAssignee(t.assignee))out.push({task:t,project:p});
  }));
  return out;
};
const assignmentId=entry=>String(entry.task?.id||[entry.project?.id||'global',entry.task?.taskYear||'',entry.task?.taskNumber||'',entry.task?.text||''].join('|'));
const getSeenAssignments=()=>{
  try{return new Set(JSON.parse(localStorage.getItem(ASSIGNMENT_SEEN_KEY)||'[]'))}catch{return new Set()}
};
const rememberCurrentAssignments=()=>{
  try{localStorage.setItem(ASSIGNMENT_SEEN_KEY,JSON.stringify(currentAssignedTaskEntries().map(assignmentId)))}catch{}
};
async function notifyNewAssignments(previousSeen){
  const current=currentAssignedTaskEntries();
  const fresh=current.filter(entry=>!previousSeen.has(assignmentId(entry)));
  rememberCurrentAssignments();
  if(!fresh.length||!('Notification' in window)||Notification.permission!=='granted'||!('serviceWorker' in navigator))return;
  try{
    const reg=await navigator.serviceWorker.ready;
    for(const entry of fresh.slice(0,5)){
      const task=entry.task,project=entry.project;
      const label=window.perekoTaskNumberLabel?.(task)||'Nowe zadanie';
      const projectText=project?(window.perekoProjectNumberLabel?.(project)||project.name):'Zadanie ogólne';
      const url=project?('/?projectId='+encodeURIComponent(project.id)+'&taskId='+encodeURIComponent(task.id||'')):'/';
      await reg.showNotification('Nowe zadanie przypisane do Ciebie',{
        body:label+' · '+(task.text||'Bez nazwy')+' · '+projectText,
        icon:'/icons/pereko-marketing-v3-192.png',
        badge:'/icons/badge-96.png',
        tag:'assignment-local-'+assignmentId(entry),
        renotify:true,
        data:{url,projectId:project?.id||null,taskId:task.id||null}
      });
    }
  }catch(e){console.warn('Assignment notification:',e)}
}
rememberCurrentAssignments();
async function pushRemote(manual=false){
  if(!remoteReady){
    if(manual)setSyncStatus('syncing','Ładowanie danych…','Poczekaj na dane centralne');
    return false;
  }
  if(remotePushInFlight)return false;
  remotePushInFlight=true;
  setSyncStatus('syncing','Zapisywanie…','Synchronizacja zmian');
  try{
    const r=await window.perekoAuthFetch('/api/dashboard',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({projects,tasks})}),
      p=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(p.error||('HTTP '+r.status));
    pendingLocalChanges=false;
    lastRemoteUpdatedAt=p.updatedAt||lastRemoteUpdatedAt;
    localStorage.setItem('pereko_cloud_sync','1');
    setSyncStatus('ok','Zsynchronizowano','Dane zapisane centralnie');
    return true;
  }catch(e){
    setSyncStatus('error','Błąd synchronizacji',e.message);
    return false;
  }finally{
    remotePushInFlight=false;
  }
}
function save(){
  pendingLocalChanges=true;
  saveLocal();
  rememberCurrentAssignments();
  if(remoteReady){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>pushRemote(),350);
  }
}
async function loadRemote(options={}){
  const silent=!!options.silent;
  const auto=!!options.auto;
  const active=document.activeElement;
  const editing=active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
  if(auto&&(pendingLocalChanges||remotePushInFlight||remoteLoadInFlight||editing))return false;
  if(remoteLoadInFlight)return false;
  remoteLoadInFlight=true;
  const previousSeen=getSeenAssignments();
  if(!silent)setSyncStatus('syncing','Ładowanie…','Pobieranie danych centralnych');
  try{
    const r=await window.perekoAuthFetch('/api/dashboard',{cache:'no-store'}),
      p=await r.json();
    if(!r.ok)throw new Error(p.error||('HTTP '+r.status));
    const changed=!lastRemoteUpdatedAt||!p.updatedAt||p.updatedAt!==lastRemoteUpdatedAt;
    if(Array.isArray(p.projects))projects=p.projects;
    if(Array.isArray(p.tasks))tasks=p.tasks;
    const projectNumbersAdded=ensureProjectNumbers();
    const taskNumbersAdded=ensureTaskNumbers();
    remoteReady=true;
    window.perekoRemoteReady=true;
    lastRemoteUpdatedAt=p.updatedAt||lastRemoteUpdatedAt;
    localStorage.setItem('pereko_cloud_sync','1');
    saveLocal();
    render();
    window.dispatchEvent(new CustomEvent('pereko:data-refreshed',{detail:{updatedAt:p.updatedAt||null,changed,auto}}));
    await notifyNewAssignments(previousSeen);
    setSyncStatus('ok','Synchronizacja aktywna','Dane wspólne są aktualne');
    if(projectNumbersAdded||taskNumbersAdded)setTimeout(()=>pushRemote(),120);
    return true;
  }catch(e){
    if(!auto){
      remoteReady=false;
      window.perekoRemoteReady=false;
      setSyncStatus('error','Błąd synchronizacji',e.message);
    }
    return false;
  }finally{
    remoteLoadInFlight=false;
  }
}
window.perekoFlushSync=async()=>{
  if(!remoteReady)return false;
  clearTimeout(syncTimer);
  return pushRemote(true);
};
const projectProgressInfo=p=>{
  const list=Array.isArray(p.projectTasks)?p.projectTasks:[];
  if(!list.length)return {progress:0,done:0,total:0,hasTasks:false};
  const done=list.filter(t=>t.done).length;
  return {progress:Math.round(done/list.length*100),done,total:list.length,hasTasks:true};
};
function render(){
  const visible=activeFilter==='all'?projects:projects.filter(p=>p.status===activeFilter);
  $('#projectList').innerHTML=visible.length?visible.map(p=>{
    const pi=projectProgressInfo(p);
    p.progress=pi.progress;
    return `<article class="project" data-project-id="${p.id}">
      <div class="project-main">
        <h4>${esc(p.name)}</h4>
        <p class="project-desc">${esc(p.desc||'')}</p>
        <div class="project-owner">${esc(p.owner||'')}</div>
      </div>
      <div class="progress-wrap ${pi.hasTasks?'':'no-tasks'}">
        <div class="progress"><span style="width:${pi.progress}%"></span></div>
        <div class="project-progress-caption">${pi.hasTasks?`<strong>${pi.progress}%</strong><span>${pi.done}/${pi.total} zadań zakończonych</span>`:'<strong>—</strong><span>Podłącz zadania, aby liczyć postęp</span>'}</div>
      </div>
    </article>`;
  }).join(''):'<div class="empty">Brak projektów.</div>';
  $('#kpiProjects').textContent=projects.length;
  $('#kpiActive').textContent=projects.filter(p=>p.status==='work').length;
  $('#kpiPlan').textContent=projects.filter(p=>p.status==='plan').length;
  const progressValues=projects.map(p=>projectProgressInfo(p)).filter(x=>x.hasTasks).map(x=>x.progress);
  $('#kpiProgress').textContent=progressValues.length?Math.round(progressValues.reduce((a,b)=>a+b,0)/progressValues.length)+'%':'—';
  const sorted=[...projects].filter(p=>p.status!=='done'&&p.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,5);
  $('#deadlineList').innerHTML=sorted.map(p=>{const d=new Date(p.deadline+'T12:00:00');return `<div class="deadline"><div class="datebox"><b>${String(d.getDate()).padStart(2,'0')}</b><span>${d.toLocaleString('pl-PL',{month:'short'}).replace('.','')}</span></div><div><h5>${esc(p.name)}</h5><p>${esc(p.owner)} · ${statusText[p.status]}</p></div></div>`}).join('')||'<div class="empty">Brak terminów.</div>';
  $('#taskList').innerHTML=tasks.map((t,i)=>`<label class="task ${t.done?'done':''}"><input type="checkbox" data-task="${i}" ${t.done?'checked':''}><span><small class="task-number">${esc(window.perekoTaskNumberLabel?.(t)||'')}</small>${esc(t.text)}</span></label>`).join('');
  $$('[data-task]').forEach(x=>x.onchange=()=>{tasks[+x.dataset.task].done=x.checked;save();render()});
}
$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFilter=b.dataset.filter;render()});
function applyStatsVisibility(){
  const grid=$('.stats-grid'),btn=$('#toggleStats');if(!grid||!btn)return;
  const hidden=localStorage.getItem('pereko_stats_hidden')==='1';
  grid.classList.toggle('is-hidden',hidden);
  const label=btn.querySelector('span');
  if(label)label.textContent=hidden?'Pokaż statystyki':'Ukryj statystyki';
  btn.setAttribute('aria-expanded',hidden?'false':'true');
  btn.classList.toggle('is-active',!hidden);
  btn.title=hidden?'Pokaż kafelki podsumowania':'Ukryj kafelki podsumowania';
}
$('#toggleStats')?.addEventListener('click',()=>{
  const hidden=localStorage.getItem('pereko_stats_hidden')==='1';
  localStorage.setItem('pereko_stats_hidden',hidden?'0':'1');
  applyStatsVisibility();
});
applyStatsVisibility();
function refreshNewProjectOwners(){
  const select=$('#newProjectOwner');if(!select)return;
  let team=[];
  try{team=JSON.parse(localStorage.getItem('pereko_team')||'[]')}catch{}
  const names=[...new Set(team.map(p=>p&&p.name).filter(Boolean))];
  select.innerHTML='<option value="">Wybierz osobę</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
}
$('#addProject').onclick=()=>{refreshNewProjectOwners();$('#modal').classList.add('open')};$('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modal').classList.remove('open');$('#projectForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);projects.unshift({id:crypto.randomUUID(),projectNumber:nextProjectNumber(),projectYear:currentNumberingYear(),createdAt:new Date().toISOString(),name:f.get('name'),owner:f.get('owner'),status:f.get('status'),progress:+f.get('progress'),deadline:f.get('deadline'),desc:f.get('desc')});save();render();e.currentTarget.reset();$('#modal').classList.remove('open')};$('#syncNow').onclick=async()=>{if(await pushRemote(true))alert('Dane zapisane centralnie.')};
const now=new Date();const day=String(now.getDate()).padStart(2,'0');const weekday=now.toLocaleDateString('pl-PL',{weekday:'long'});const month=now.toLocaleDateString('pl-PL',{month:'long'});$('#todayBox').innerHTML=`<span class="date-calendar-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm11 8H6v10h12V10ZM6 6v2h12V6H6Z"/></svg></span><span class="date-copy"><span class="date-weekday">${weekday}</span><strong>${day} ${month}</strong><span>${now.getFullYear()}</span></span>`;
const autoRefreshRemote=()=>{
  if(document.visibilityState!=='visible'||!navigator.onLine)return;
  loadRemote({silent:true,auto:true});
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(autoRefreshRemote,180)});
window.addEventListener('focus',()=>setTimeout(autoRefreshRemote,120));
window.addEventListener('online',()=>setTimeout(autoRefreshRemote,120));
setInterval(autoRefreshRemote,15000);
render();
loadRemote();