const defaultProjects=[{id:'p1',name:'Centrum Partnera PEREKO',owner:'Michał',status:'work',progress:55,deadline:'2026-10-15',desc:'Rozwój platformy B2B, materiały dla partnerów i narzędzia sprzedażowe.'},{id:'p2',name:'Targi HVAC 2027',owner:'Michał',status:'plan',progress:15,deadline:'2027-03-01',desc:'Plan targów, harmonogram, ekspozycja, materiały i komunikacja.'},{id:'p3',name:'Upominki świąteczne',owner:'Wiktoria',status:'plan',progress:10,deadline:'2026-11-20',desc:'Koncepcja, budżet, lista odbiorców, zamówienie i dystrybucja upominków.'},{id:'p4',name:'Świat Kominków — Targi 2027',owner:'Michał',status:'plan',progress:8,deadline:'2027-02-15',desc:'Przygotowanie obecności targowej, materiałów, komunikacji i ekspozycji.'},{id:'p5',name:'Świat Kominków — materiały do gazety',owner:'Michał',status:'work',progress:25,deadline:'2026-10-05',desc:'Artykuły, reklamy, materiały produktowe i terminy publikacji.'}];
const defaultTasks=[{text:'Ustalić najbliższe terminy dla wszystkich projektów',done:false},{text:'Rozpisać kolejne etapy Centrum Partnera PEREKO',done:false},{text:'Przygotować założenia do upominków świątecznych',done:false},{text:'Ustalić zakres materiałów do Świata Kominków',done:false}];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let projects=JSON.parse(localStorage.getItem('pereko_projects')||'null')||structuredClone(defaultProjects),tasks=JSON.parse(localStorage.getItem('pereko_tasks')||'null')||structuredClone(defaultTasks),activeFilter='all',cloudSyncEnabled=localStorage.getItem('pereko_cloud_sync')==='1',syncTimer=null;
const statusText={work:'W realizacji',plan:'Planowany',done:'Zakończony'};
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setSyncStatus=(state,title,text)=>{const c=$('#syncCard');if(!c)return;c.dataset.state=state;$('#syncTitle').textContent=title;$('#syncText').textContent=text};
const saveLocal=()=>{localStorage.setItem('pereko_projects',JSON.stringify(projects));localStorage.setItem('pereko_tasks',JSON.stringify(tasks));localStorage.setItem('pereko_dashboard_version','4')};
async function pushRemote(manual=false){if(!cloudSyncEnabled&&!manual)return false;setSyncStatus('syncing','Zapisywanie…','Synchronizacja zmian');try{const r=await fetch('/api/dashboard',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({projects,tasks})}),p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||`HTTP ${r.status}`);cloudSyncEnabled=true;localStorage.setItem('pereko_cloud_sync','1');setSyncStatus('ok','Zsynchronizowano','Dane zapisane centralnie');return true}catch(e){setSyncStatus('error','Błąd synchronizacji',e.message);return false}}
function save(){saveLocal();if(cloudSyncEnabled){clearTimeout(syncTimer);syncTimer=setTimeout(()=>pushRemote(),600)}}
async function loadRemote(){if(!cloudSyncEnabled){setSyncStatus('local','Dane lokalne','Kliknij „Synchronizuj dane”');return false}try{const r=await fetch('/api/dashboard',{cache:'no-store'}),p=await r.json();if(!r.ok)throw new Error(p.error||`HTTP ${r.status}`);if(Array.isArray(p.projects))projects=p.projects;if(Array.isArray(p.tasks))tasks=p.tasks;saveLocal();render();setSyncStatus('ok','Synchronizacja aktywna','Dane wspólne są aktualne');return true}catch(e){setSyncStatus('error','Błąd synchronizacji',e.message);return false}}
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
      <div class="project-deadline-status">
        <div class="deadline-edit"><label>Termin</label><div class="deadline-date-shell"><span class="deadline-date-value">${p.deadline?new Date(p.deadline+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}):'Brak daty'}</span><input type="date" data-deadline="${p.id}" value="${esc(p.deadline)}"></div></div>
        <span class="status ${p.status}">${statusText[p.status]}</span>
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
  $('#taskList').innerHTML=tasks.map((t,i)=>`<label class="task ${t.done?'done':''}"><input type="checkbox" data-task="${i}" ${t.done?'checked':''}><span>${esc(t.text)}</span></label>`).join('');
  $$('[data-task]').forEach(x=>x.onchange=()=>{tasks[+x.dataset.task].done=x.checked;save();render()});
  $$('[data-deadline]').forEach(x=>x.onchange=()=>{const p=projects.find(y=>y.id===x.dataset.deadline);if(p){p.deadline=x.value;save();render()}})
}
$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFilter=b.dataset.filter;render()});
function applyStatsVisibility(){
  const grid=$('.stats-grid'),btn=$('#toggleStats');if(!grid||!btn)return;
  const hidden=localStorage.getItem('pereko_stats_hidden')==='1';
  grid.classList.toggle('is-hidden',hidden);
  const label=btn.querySelector('span');
  if(label)label.textContent=hidden?'Pokaż kafelki':'Ukryj kafelki';
  btn.setAttribute('aria-expanded',hidden?'false':'true');
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
$('#addProject').onclick=()=>{refreshNewProjectOwners();$('#modal').classList.add('open')};$('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modal').classList.remove('open');$('#projectForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);projects.unshift({id:crypto.randomUUID(),name:f.get('name'),owner:f.get('owner'),status:f.get('status'),progress:+f.get('progress'),deadline:f.get('deadline'),desc:f.get('desc')});save();render();e.currentTarget.reset();$('#modal').classList.remove('open')};$('#syncNow').onclick=async()=>{if(await pushRemote(true))alert('Dane zapisane centralnie.')};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function findProject(q){q=norm(q);let p=projects.find(x=>norm(x.name)===q);if(p)return p;return projects.find(x=>norm(x.name).includes(q)||q.includes(norm(x.name)))||null}
function parseDate(s){s=norm(s);let m=s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;m=s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;const mo={stycznia:1,lutego:2,marca:3,kwietnia:4,maja:5,czerwca:6,lipca:7,sierpnia:8,wrzesnia:9,pazdziernika:10,listopada:11,grudnia:12};m=s.match(/(\d{1,2})\s+([a-z]+)\s+(20\d{2})/);return m&&mo[m[2]]?`${m[3]}-${String(mo[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`:null}
function msg(kind,text,state=''){const el=document.createElement('div');el.className=`assistant-msg ${kind} ${state}`;el.innerHTML=`<strong>${kind==='user'?'Ty':'Asystent'}</strong><span>${esc(text)}</span>`;$('#assistantMessages').appendChild(el);$('#assistantMessages').scrollTop=999999}
async function commit(text){saveLocal();render();msg('bot',(await pushRemote(true))?text:'Zmiana lokalna zapisana, ale zapis centralny się nie udał.',cloudSyncEnabled?'success':'error')}
async function runCommand(raw){const n=norm(raw);if(/^(pomoc|help|co potrafisz)/.test(n)){msg('bot','Komendy: „Dodaj zadanie: …”, „Zmień termin NAZWA na 20 października 2026”, „Ustaw NAZWA na 60%”, „Ustaw status NAZWA na w realizacji”, „Przypisz NAZWA do Wiktorii”, „Pokaż projekty”, „Pokaż zadania”, „Pokaż najbliższe terminy”, „Odśwież dane”.');return}if(n.includes('odswiez')){msg('bot',(await loadRemote())?'Pobrałem najnowsze dane.':'Nie udało się pobrać danych.');return}if(n.includes('pokaz projekty')){msg('bot',projects.map(p=>`${p.name} — ${p.progress||0}%`).join(' | '));return}if(n.includes('pokaz zadania')){msg('bot',tasks.map(t=>`${t.done?'✓':'○'} ${t.text}`).join(' | '));return}if(n.includes('najblizsze terminy')){msg('bot',[...projects].filter(p=>p.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline)).slice(0,6).map(p=>`${p.deadline} — ${p.name}`).join(' | '));return}let m=raw.match(/^\s*dodaj\s+zadanie\s*:?\s*(.+)$/i);if(m){tasks.push({text:m[1].trim(),done:false});await commit(`Dodałem zadanie: ${m[1].trim()}`);return}m=norm(raw).match(/ustaw\s+(.+?)\s+na\s+(\d{1,3})\s*%/);if(m){const p=findProject(m[1]);if(!p){msg('bot','Nie znalazłem projektu.','error');return}p.progress=Math.max(0,Math.min(100,+m[2]));await commit(`Ustawiłem postęp „${p.name}” na ${p.progress}%.`);return}if(n.includes('termin')){const d=parseDate(raw),left=raw.split(/\s+na\s+/i)[0].replace(/^.*?termin\s+(projektu\s+)?/i,'').trim(),p=findProject(left);if(!d||!p){msg('bot','Nie rozpoznałem projektu lub daty.','error');return}p.deadline=d;await commit(`Termin „${p.name}” ustawiony na ${d}.`);return}m=norm(raw).match(/ustaw\s+status\s+(.+?)\s+na\s+(.+)/);if(m){const p=findProject(m[1]);if(!p){msg('bot','Nie znalazłem projektu.','error');return}const s=m[2];p.status=s.includes('realiz')?'work':s.includes('plan')?'plan':s.includes('zakon')?'done':p.status;await commit(`Status „${p.name}” zmieniony na ${statusText[p.status]}.`);return}m=raw.match(/^\s*przypisz\s+(.+?)\s+do\s+(.+)$/i);if(m){const p=findProject(m[1]);if(!p){msg('bot','Nie znalazłem projektu.','error');return}p.owner=m[2].trim();await commit(`Projekt „${p.name}” przypisałem do ${p.owner}.`);return}msg('bot','Nie rozpoznałem polecenia. Napisz „Pomoc”.','error')}
$('#assistantFab').onclick=()=>{$('#assistantPanel').classList.toggle('open');if($('#assistantPanel').classList.contains('open'))$('#assistantInput').focus()};$('#assistantClose').onclick=()=>$('#assistantPanel').classList.remove('open');$$('[data-assistant-example]').forEach(b=>b.onclick=()=>{$('#assistantInput').value=b.dataset.assistantExample;$('#assistantInput').focus()});$('#assistantForm').onsubmit=async e=>{e.preventDefault();const i=$('#assistantInput'),v=i.value.trim();if(!v)return;msg('user',v);i.value='';await runCommand(v)};$('#assistantInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#assistantForm').requestSubmit()}});
const now=new Date();$('#todayBox').innerHTML=`<strong>${now.toLocaleDateString('pl-PL',{weekday:'long',day:'2-digit',month:'long'})}</strong><span>${now.getFullYear()}</span>`;saveLocal();render();loadRemote();