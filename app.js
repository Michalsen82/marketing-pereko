const defaultProjects=[
{id:'p1',name:'Centrum Partnera PEREKO',owner:'Michał',status:'work',progress:55,deadline:'2026-10-15',desc:'Rozwój platformy B2B, materiały dla partnerów i narzędzia sprzedażowe.'},
{id:'p2',name:'Targi HVAC 2027',owner:'Michał',status:'plan',progress:15,deadline:'2027-03-01',desc:'Plan targów, harmonogram, ekspozycja, materiały i komunikacja.'},
{id:'p3',name:'Upominki świąteczne',owner:'Wiktoria',status:'plan',progress:10,deadline:'2026-11-20',desc:'Koncepcja, budżet, lista odbiorców, zamówienie i dystrybucja upominków.'},
{id:'p4',name:'Świat Kominków — Targi 2027',owner:'Michał',status:'plan',progress:8,deadline:'2027-02-15',desc:'Przygotowanie obecności targowej, materiałów, komunikacji i ekspozycji.'},
{id:'p5',name:'Świat Kominków — materiały do gazety',owner:'Michał',status:'work',progress:25,deadline:'2026-10-05',desc:'Artykuły, reklamy, materiały produktowe i terminy publikacji.'}
];
const defaultTasks=[
{text:'Ustalić najbliższe terminy dla wszystkich projektów',done:false},
{text:'Rozpisać kolejne etapy Centrum Partnera PEREKO',done:false},
{text:'Przygotować założenia do upominków świątecznych',done:false},
{text:'Ustalić zakres materiałów do Świata Kominków',done:false}
];
const VERSION='2';
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
let storedVersion=localStorage.getItem('pereko_dashboard_version');
let projects=storedVersion===VERSION?JSON.parse(localStorage.getItem('pereko_projects')||'null'):null;
let tasks=storedVersion===VERSION?JSON.parse(localStorage.getItem('pereko_tasks')||'null'):null;
projects=projects||structuredClone(defaultProjects);
tasks=tasks||structuredClone(defaultTasks);
let activeFilter='all';
const save=()=>{localStorage.setItem('pereko_dashboard_version',VERSION);localStorage.setItem('pereko_projects',JSON.stringify(projects));localStorage.setItem('pereko_tasks',JSON.stringify(tasks));};
save();
const statusText={work:'W realizacji',plan:'Planowany',done:'Zakończony'};
function render(){
 const visible=activeFilter==='all'?projects:projects.filter(p=>p.status===activeFilter);
 $('#projectList').innerHTML=visible.length?visible.map(p=>`<article class="project">
  <div><h4>${esc(p.name)}</h4><p>${esc(p.owner)}<br>${esc(p.desc)}</p><div class="project-meta"><span class="status ${p.status}">${statusText[p.status]}</span></div></div>
  <div class="deadline-edit"><label>Termin</label><input type="date" data-deadline="${p.id}" value="${esc(p.deadline||'')}"></div>
  <div class="progress-wrap"><div class="progress"><span style="width:${Math.min(100,Math.max(0,p.progress))}%"></span></div><small>${p.progress}%</small></div>
 </article>`).join(''):'<div class="empty">Brak projektów w tej kategorii.</div>';
 const work=projects.filter(p=>p.status==='work').length, plan=projects.filter(p=>p.status==='plan').length, avg=Math.round(projects.reduce((a,p)=>a+p.progress,0)/(projects.length||1));
 $('#kpiProjects').textContent=projects.length; $('#kpiActive').textContent=work; $('#kpiPlan').textContent=plan; $('#kpiProgress').textContent=avg+'%';
 const sorted=[...projects].filter(p=>p.status!=='done'&&p.deadline).sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,5);
 $('#deadlineList').innerHTML=sorted.length?sorted.map(p=>{let d=new Date(p.deadline+'T12:00:00');return `<div class="deadline"><div class="datebox"><b>${String(d.getDate()).padStart(2,'0')}</b><span>${d.toLocaleString('pl-PL',{month:'short'}).replace('.','')}</span></div><div><h5>${esc(p.name)}</h5><p>${esc(p.owner)} · ${statusText[p.status]}</p></div></div>`}).join(''):'<div class="empty">Brak ustawionych terminów.</div>';
 $('#taskList').innerHTML=tasks.map((t,i)=>`<label class="task ${t.done?'done':''}"><input type="checkbox" data-task="${i}" ${t.done?'checked':''}><span>${esc(t.text)}</span></label>`).join('');
 $$('[data-task]').forEach(el=>el.onchange=()=>{tasks[+el.dataset.task].done=el.checked;save();render();});
 $$('[data-deadline]').forEach(el=>el.onchange=()=>{const p=projects.find(x=>x.id===el.dataset.deadline);if(p){p.deadline=el.value;save();render();}});
}
function esc(v=''){return String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))}
$$('[data-filter]').forEach(btn=>btn.onclick=()=>{$$('[data-filter]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeFilter=btn.dataset.filter;render();});
$('#addProject').onclick=()=>$('#modal').classList.add('open'); $('#closeModal').onclick=()=>$('#modal').classList.remove('open');
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.remove('open')};
$('#projectForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);projects.unshift({id:crypto.randomUUID(),name:f.get('name'),owner:f.get('owner'),status:f.get('status'),progress:+f.get('progress'),deadline:f.get('deadline'),desc:f.get('desc')});save();render();e.currentTarget.reset();$('#modal').classList.remove('open');};
$('#resetDemo').onclick=()=>{if(confirm('Przywrócić projekty startowe?')){projects=structuredClone(defaultProjects);tasks=structuredClone(defaultTasks);save();render();}};
render();
