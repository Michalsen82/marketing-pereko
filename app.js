const defaultProjects=[
{id:'p1',name:'QmPell Duo — kampania produktowa',owner:'Michał',status:'work',progress:78,deadline:'2026-09-30',desc:'Materiały produktowe, komunikacja digital, publikacje i wsparcie sprzedaży.'},
{id:'p2',name:'ENEX 2027 — przygotowanie targów',owner:'Wiktoria',status:'plan',progress:34,deadline:'2027-02-10',desc:'Stoisko, materiały, harmonogram, lista produktów i komunikacja.'},
{id:'p3',name:'Centrum Partnera PEREKO',owner:'Michał',status:'work',progress:62,deadline:'2026-10-15',desc:'Rozwój platformy B2B, materiały dla partnerów i narzędzia sprzedażowe.'},
{id:'p4',name:'InStream — optymalizacja leadów',owner:'Łukasz',status:'work',progress:48,deadline:'2026-09-25',desc:'Ocena jakości leadów, reklamacje i analiza skuteczności targetowania.'},
{id:'p5',name:'Biblioteka materiałów marketingowych',owner:'Wiktoria',status:'done',progress:100,deadline:'2026-09-12',desc:'Centralne miejsce do pobierania grafik, filmów i materiałów produktowych.'}
];
const defaultTasks=[
{text:'Zamknąć listę materiałów do QmPell Duo',done:false},
{text:'Przygotować zakres komunikacji ENEX 2027',done:false},
{text:'Zweryfikować leady do reklamacji w InStream',done:true},
{text:'Uzupełnić bibliotekę materiałów B2B',done:false}
];
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
let projects=JSON.parse(localStorage.getItem('pereko_projects')||'null')||defaultProjects;
let tasks=JSON.parse(localStorage.getItem('pereko_tasks')||'null')||defaultTasks;
let activeFilter='all';
const save=()=>{localStorage.setItem('pereko_projects',JSON.stringify(projects));localStorage.setItem('pereko_tasks',JSON.stringify(tasks));};
const statusText={work:'W realizacji',plan:'Planowany',done:'Zakończony'};
function render(){
 const visible=activeFilter==='all'?projects:projects.filter(p=>p.status===activeFilter);
 $('#projectList').innerHTML=visible.length?visible.map(p=>`<article class="project"><div><h4>${esc(p.name)}</h4><p>${esc(p.owner)} · termin ${fmt(p.deadline)}<br>${esc(p.desc)}</p></div><span class="status ${p.status}">${statusText[p.status]}</span><div class="progress-wrap"><div class="progress"><span style="width:${Math.min(100,Math.max(0,p.progress))}%"></span></div><small>${p.progress}%</small></div></article>`).join(''):'<div class="empty">Brak projektów w tej kategorii.</div>';
 const work=projects.filter(p=>p.status==='work').length, done=projects.filter(p=>p.status==='done').length, avg=Math.round(projects.reduce((a,p)=>a+p.progress,0)/(projects.length||1));
 $('#kpiProjects').textContent=projects.length; $('#kpiActive').textContent=work; $('#kpiDone').textContent=done; $('#kpiProgress').textContent=avg+'%';
 const sorted=[...projects].filter(p=>p.status!=='done').sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,4);
 $('#deadlineList').innerHTML=sorted.map(p=>{let d=new Date(p.deadline+'T12:00:00');return `<div class="deadline"><div class="datebox"><b>${String(d.getDate()).padStart(2,'0')}</b><span>${d.toLocaleString('pl-PL',{month:'short'}).replace('.','')}</span></div><div><h5>${esc(p.name)}</h5><p>${esc(p.owner)} · ${statusText[p.status]}</p></div></div>`}).join('');
 $('#taskList').innerHTML=tasks.map((t,i)=>`<label class="task ${t.done?'done':''}"><input type="checkbox" data-task="${i}" ${t.done?'checked':''}><span>${esc(t.text)}</span></label>`).join('');
 $$('[data-task]').forEach(el=>el.onchange=()=>{tasks[+el.dataset.task].done=el.checked;save();render();});
}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmt(s){return new Date(s+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'short',year:'numeric'}).replace('.','')}
$$('[data-filter]').forEach(btn=>btn.onclick=()=>{$$('[data-filter]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeFilter=btn.dataset.filter;render();});
$('#addProject').onclick=()=>$('#modal').classList.add('open'); $('#closeModal').onclick=()=>$('#modal').classList.remove('open');
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.remove('open')};
$('#projectForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);projects.unshift({id:crypto.randomUUID(),name:f.get('name'),owner:f.get('owner'),status:f.get('status'),progress:+f.get('progress'),deadline:f.get('deadline'),desc:f.get('desc')});save();render();e.currentTarget.reset();$('#modal').classList.remove('open');};
$('#resetDemo').onclick=()=>{if(confirm('Przywrócić dane przykładowe?')){projects=structuredClone(defaultProjects);tasks=structuredClone(defaultTasks);save();render();}};
render();
