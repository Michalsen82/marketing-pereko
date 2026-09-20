(()=>{
const fmt=v=>{if(!v)return null;const s=String(v).slice(0,10),d=new Date(s+'T12:00:00');return isNaN(d)?null:d};
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const days=(a,b)=>Math.max(0,Math.round((b-a)/86400000));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const escG=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const samePerson=(a,b)=>{const x=norm(a),y=norm(b);if(!x||!y)return false;return x===y||x.split(' ')[0]===y||y.split(' ')[0]===x};
const taskNo=t=>window.perekoTaskNumberLabel?.(t)||'Z-—';
let viewMode='all';
let personFilter='all';
let scopedProjectId=null;

function people(){
  const set=new Set();
  try{(JSON.parse(localStorage.getItem('pereko_team')||'[]')||[]).forEach(p=>p?.name&&set.add(String(p.name)))}catch{}
  (projects||[]).forEach(p=>{
    if(p?.owner)set.add(String(p.owner));
    (p?.members||[]).forEach(x=>x&&set.add(String(x)));
    (p?.projectTasks||[]).forEach(t=>t?.assignee&&set.add(String(t.assignee)));
  });
  return [...set].sort((a,b)=>a.localeCompare(b,'pl'));
}
function build(){
  if(document.querySelector('#ganttModal'))return;
  const m=document.createElement('div');
  m.id='ganttModal';m.className='gantt-modal';
  m.innerHTML=`
    <div class="gantt-shell">
      <div class="gantt-head">
        <div><span class="gantt-kicker" id="ganttKicker">PORTFEL PROJEKTÓW</span><h2 id="ganttTitle">Wykres Gantta</h2><p id="ganttSubtitle">Projekty, zadania, odpowiedzialni i terminy na jednej osi czasu.</p></div>
        <button class="gantt-close" id="ganttClose" type="button" aria-label="Zamknij">×</button>
      </div>
      <div class="gantt-controls">
        <div class="gantt-view-switch" role="group" aria-label="Zakres wykresu">
          <button type="button" class="gantt-view-btn active" data-gantt-view="all">Wszystko</button>
          <button type="button" class="gantt-view-btn" data-gantt-view="projects">Projekty</button>
          <button type="button" class="gantt-view-btn" data-gantt-view="tasks">Zadania</button>
        </div>
        <label class="gantt-person-filter"><span>Pracownik</span><select id="ganttPersonFilter"><option value="all">Wszyscy pracownicy</option></select></label>
      </div>
      <div class="gantt-toolbar">
        <div class="gantt-legend">
          <span><i></i>Projekt / postęp</span>
          <span><i class="task-line"></i>Zadanie w toku</span>
          <span><i class="task-done"></i>Zadanie zakończone</span>
        </div>
        <div class="gantt-range" id="ganttRange"></div>
      </div>
      <div class="gantt-body" id="ganttBody"></div>
    </div>`;
  document.body.appendChild(m);
  document.querySelector('#ganttClose').onclick=closeG;
  m.onclick=e=>{if(e.target===m)closeG()};
  m.querySelectorAll('[data-gantt-view]').forEach(b=>b.addEventListener('click',()=>{
    viewMode=b.dataset.ganttView;
    m.querySelectorAll('[data-gantt-view]').forEach(x=>x.classList.toggle('active',x===b));
    render();
  }));
  document.querySelector('#ganttPersonFilter').addEventListener('change',e=>{personFilter=e.target.value;render()});
}
function refreshPeople(){
  const s=document.querySelector('#ganttPersonFilter');if(!s)return;
  const current=personFilter;
  s.innerHTML='<option value="all">Wszyscy pracownicy</option>'+people().map(n=>'<option value="'+escG(n)+'">'+escG(n)+'</option>').join('');
  if([...s.options].some(o=>o.value===current))s.value=current;else{personFilter='all';s.value='all'}
}
function projectMatchesPerson(p){
  if(personFilter==='all')return true;
  if(samePerson(p.owner,personFilter))return true;
  if((p.members||[]).some(x=>samePerson(x,personFilter)))return true;
  return (p.projectTasks||[]).some(t=>samePerson(t.assignee,personFilter));
}
function tasksFor(p){
  let ts=Array.isArray(p.projectTasks)?p.projectTasks:[];
  if(!scopedProjectId&&personFilter!=='all')ts=ts.filter(t=>samePerson(t.assignee,personFilter));
  return ts;
}
function visibleProjects(){
  if(scopedProjectId)return (projects||[]).filter(p=>String(p.id)===String(scopedProjectId));
  return (projects||[]).filter(p=>{
    if(personFilter==='all')return true;
    if(viewMode==='projects')return projectMatchesPerson(p);
    return projectMatchesPerson(p)&&tasksFor(p).length>0;
  });
}
function range(ps){
  const ds=[new Date()];
  ps.forEach(p=>{
    if(scopedProjectId||viewMode!=='tasks'){const d=fmt(p.deadline);if(d)ds.push(d)}
    tasksFor(p).forEach(t=>{const d=fmt(t.deadline),s=fmt(t.createdAt);if(d)ds.push(d);if(s)ds.push(s)});
  });
  let min=new Date(Math.min(...ds.map(d=>d.getTime()))),max=new Date(Math.max(...ds.map(d=>d.getTime())));
  min=add(min,-14);max=add(max,14);
  return{min,max,total:Math.max(1,days(min,max))}
}
function months(r){
  const out=[];let c=new Date(r.min.getFullYear(),r.min.getMonth(),1,12);
  while(c<=r.max){const n=new Date(c.getFullYear(),c.getMonth()+1,1,12),s=c<r.min?r.min:c,e=n>r.max?r.max:n;out.push({l:clamp(days(r.min,s)/r.total*100,0,100),w:clamp(days(s,e)/r.total*100,1,100),t:c.toLocaleDateString('pl-PL',{month:'short',year:'numeric'}).replace('.','')});c=n}
  return out
}
function projectStart(p,r,ts){
  const taskDates=ts.map(t=>fmt(t.createdAt)||fmt(t.deadline)).filter(Boolean);
  if(taskDates.length)return new Date(Math.min(...taskDates.map(d=>d.getTime())));
  return r.min
}
function render(){
  build();refreshPeople();
  const body=document.querySelector('#ganttBody');
  const ps=visibleProjects();
  if(!ps.length){body.innerHTML='<div class="gantt-empty">Brak danych dla wybranego filtra.</div>';document.querySelector('#ganttRange').textContent='';return}
  const r=range(ps),today=new Date();today.setHours(12,0,0,0);
  document.querySelector('#ganttRange').textContent=r.min.toLocaleDateString('pl-PL')+' — '+r.max.toLocaleDateString('pl-PL');
  const th=clamp(days(r.min,today)/r.total*100,0,100);
  const mh=months(r).map(m=>'<div class="gantt-month" style="left:'+m.l+'%;width:'+m.w+'%">'+escG(m.t)+'</div>').join('');
  const showProjects=scopedProjectId?true:viewMode!=='tasks',showTasks=scopedProjectId?true:viewMode!=='projects';

  const rows=ps.map(p=>{
    const ts=showTasks?tasksFor(p):[];
    const allTasks=Array.isArray(p.projectTasks)?p.projectTasks:[];
    const done=allTasks.filter(t=>t.done).length;
    const prog=allTasks.length?Math.round(done/allTasks.length*100):(p.progress||0);
    const end=fmt(p.deadline)||r.max,start=projectStart(p,r,allTasks);
    const l=clamp(days(r.min,start)/r.total*100,0,100),w=clamp(days(start,end)/r.total*100,1,100-l);
    const headerH=showProjects?72:46,taskH=34,rowH=headerH+(showTasks?Math.max(1,ts.length)*taskH:0);

    const summary='<div class="gantt-project-summary '+(showProjects?'':'tasks-only')+'"><strong>'+escG(p.name)+'</strong><small>'+escG(p.owner||'Brak właściciela')+' · '+escG(statusText[p.status]||'—')+' · termin '+escG(p.deadline||'brak')+'</small>'+(showProjects?'<div class="gantt-progress-meta"><div class="gantt-progress-mini"><span style="width:'+prog+'%"></span></div><b>'+prog+'%</b><small>'+done+'/'+allTasks.length+' zadań</small></div>':'')+'</div>';

    const taskList=showTasks?(ts.length?'<div class="gantt-task-list">'+ts.map(t=>'<div class="gantt-task-info '+(t.done?'done':'')+'"><div class="gantt-task-main"><strong>'+escG(t.text)+'</strong><span>'+escG(taskNo(t))+' · '+escG(t.assignee||'Bez przypisania')+'</span></div><small>'+escG(t.deadline||'brak terminu')+'</small></div>').join('')+'</div>':'<div class="gantt-task-list empty"><div class="gantt-task-info"><div class="gantt-task-main"><strong>Brak zadań</strong><span>—</span></div><small>—</small></div></div>'):'';

    const projectBar=showProjects?'<div class="gantt-bar" style="left:'+l+'%;width:'+w+'%"><div class="gantt-bar-fill" style="width:'+prog+'%"></div><div class="gantt-bar-label">'+escG(p.name)+'</div></div>':'';

    const taskLines=showTasks?ts.map((t,i)=>{
      const d=fmt(t.deadline);if(!d)return'';
      const s=fmt(t.createdAt)||add(d,-7);
      const sx=clamp(days(r.min,s)/r.total*100,0,100),x=clamp(days(r.min,d)/r.total*100,0,100);
      const left=Math.min(sx,x),width=Math.max(.35,Math.abs(x-sx));
      const y=headerH+i*taskH+taskH/2;
      const title=escG(t.text)+' · '+escG(t.assignee||'Bez przypisania')+' · termin '+escG(t.deadline||'brak');
      return '<div class="gantt-task-line '+(t.done?'done':'')+'" style="top:'+(y-1.5)+'px;left:'+left+'%;width:'+width+'%" title="'+title+'"></div><div class="gantt-task-end '+(t.done?'done':'')+'" style="top:'+(y-4.5)+'px;left:calc('+x+'% - 4px)" title="'+title+'"></div>';
    }).join(''):'';

    return '<div class="gantt-row" style="--gantt-row-h:'+rowH+'px;--gantt-header-h:'+headerH+'px;--gantt-task-h:'+taskH+'px"><div class="gantt-project-info">'+summary+taskList+'</div><div class="gantt-track" style="min-height:'+rowH+'px"><div class="gantt-today" style="left:'+th+'%"></div>'+projectBar+taskLines+'</div></div>';
  }).join('');

  body.innerHTML='<div class="gantt-table"><div class="gantt-months"><div class="gantt-left-head">PROJEKT / ZADANIE / ODPOWIEDZIALNY</div><div class="gantt-month-grid">'+mh+'<div class="gantt-today" style="left:'+th+'%"></div></div></div>'+rows+'</div>';
}
function setScopeUi(){
  const controls=document.querySelector('.gantt-controls');
  const p=scopedProjectId?(projects||[]).find(x=>String(x.id)===String(scopedProjectId)):null;
  if(controls)controls.hidden=!!p;
  const kicker=document.querySelector('#ganttKicker');
  const title=document.querySelector('#ganttTitle');
  const subtitle=document.querySelector('#ganttSubtitle');
  if(p){
    if(kicker)kicker.textContent='PROJEKT';
    if(title)title.textContent='Gantt · '+p.name;
    if(subtitle)subtitle.textContent='Projekt, wszystkie zadania, odpowiedzialni i terminy na jednej osi czasu.';
  }else{
    if(kicker)kicker.textContent='PORTFEL PROJEKTÓW';
    if(title)title.textContent='Wykres Gantta';
    if(subtitle)subtitle.textContent='Projekty, zadania, odpowiedzialni i terminy na jednej osi czasu.';
  }
}
function openG(){
  scopedProjectId=null;viewMode='all';personFilter='all';
  build();refreshPeople();
  document.querySelectorAll('[data-gantt-view]').forEach(x=>x.classList.toggle('active',x.dataset.ganttView==='all'));
  const s=document.querySelector('#ganttPersonFilter');if(s)s.value='all';
  setScopeUi();render();
  document.querySelector('#ganttModal').classList.add('open');document.body.classList.add('gantt-open')
}
function openProjectGantt(projectId){
  scopedProjectId=projectId;viewMode='all';personFilter='all';
  build();setScopeUi();render();
  document.querySelector('#ganttModal').classList.add('open');document.body.classList.add('gantt-open')
}
window.openProjectGantt=openProjectGantt;
function closeG(){document.querySelector('#ganttModal')?.classList.remove('open');document.body.classList.remove('gantt-open')}
document.addEventListener('click',e=>{
  if(e.target.closest('#openGantt'))openG();
  const projectBtn=e.target.closest('[data-project-gantt]');
  if(projectBtn)openProjectGantt(projectBtn.dataset.projectGantt);
});
})();