(()=>{
  let mode='all';
  let expanded=false;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const current=()=>window.perekoLoggedPerson||{};
  const mine=who=>{
    const a=norm(who),p=current(),full=norm(p.name),email=norm(p.email),first=full.split(' ')[0];
    return !!a&&(a===full||a===email||(first&&a===first));
  };
  const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusTextLocal={work:'W realizacji',plan:'Planowany',done:'Zakończony'};
  const dateLabel=iso=>{
    const d=new Date(String(iso).slice(0,10)+'T12:00:00');
    return {day:String(d.getDate()).padStart(2,'0'),mon:d.toLocaleString('pl-PL',{month:'short'}).replace('.','').toUpperCase()};
  };
  const projectAssigned=p=>mine(p.owner)||(Array.isArray(p.members)&&p.members.some(mine));
  const collect=()=>{
    const items=[];
    (projects||[]).forEach(p=>{
      if(p.status!=='done'&&p.deadline&&projectAssigned(p)){
        items.push({kind:'project',date:p.deadline,title:p.name,meta:(p.owner||'—')+' · '+(statusTextLocal[p.status]||'—'),projectId:p.id});
      }
      (Array.isArray(p.projectTasks)?p.projectTasks:[]).forEach(t=>{
        if(!t.done&&t.deadline&&mine(t.assignee)){
          items.push({kind:'project-task',date:t.deadline,title:t.text,meta:(t.assignee||'Bez przypisania')+' · '+p.name,projectId:p.id,taskId:t.id});
        }
      });
    });
    return items
      .filter(x=>
        mode==='all' ||
        (mode==='projects'&&x.kind==='project') ||
        (mode==='project-tasks'&&x.kind==='project-task')
      )
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  };
  const syncToggle=()=>{
    const btn=document.querySelector('#deadlineAgendaToggle');
    if(!btn)return;
    btn.classList.toggle('active',expanded);
    btn.setAttribute('aria-expanded',expanded?'true':'false');
    const label=btn.querySelector('.deadline-agenda-toggle-label');
    if(label)label.textContent=expanded?'Ukryj terminy':'Pokaż terminy';
  };
  const renderAgenda=()=>{
    const list=document.querySelector('#deadlineList');if(!list)return;
    syncToggle();
    list.hidden=!expanded;
    list.setAttribute('aria-hidden',expanded?'false':'true');
    if(!expanded){list.innerHTML='';return}
    const items=collect();
    list.innerHTML=items.length?items.map(x=>{
      const d=dateLabel(x.date);
      const type=x.kind==='project'?'PROJEKT':'ZADANIE';
      const action=x.kind==='project'?'Przejdź do projektu':'Przejdź do zadania';
      const itemClass=x.kind==='project'?'is-project':'is-project-task';
      return '<article class="deadline-agenda-item '+itemClass+'">'+
        '<div class="datebox"><b>'+d.day+'</b><span>'+d.mon+'</span></div>'+
        '<div class="deadline-agenda-copy"><span class="deadline-agenda-type">'+type+'</span><h5>'+esc(x.title)+'</h5><p>'+esc(x.meta)+'</p></div>'+
        '<button type="button" class="deadline-agenda-open" data-agenda-kind="'+x.kind+'" data-agenda-project="'+esc(x.projectId||'')+'" data-agenda-task="'+esc(x.taskId||'')+'">'+action+' <span>→</span></button>'+
      '</article>';
    }).join(''):'<div class="empty deadline-agenda-empty">Brak przypisanych terminów.</div>';
    list.querySelectorAll('.deadline-agenda-open').forEach(btn=>btn.onclick=()=>{
      const kind=btn.dataset.agendaKind,projectId=btn.dataset.agendaProject,taskId=btn.dataset.agendaTask;
      if(kind==='project'){window.openProjectDetail?.(projectId);return}
      if(kind==='project-task'&&projectId)window.perekoOpenDeepLink?.({projectId,taskId});
    });
  };
  const bind=()=>{
    document.querySelector('#deadlineAgendaToggle')?.addEventListener('click',()=>{
      expanded=!expanded;
      renderAgenda();
    });
    document.querySelectorAll('[data-deadline-filter]').forEach(btn=>btn.onclick=()=>{
      mode=btn.dataset.deadlineFilter;
      document.querySelectorAll('[data-deadline-filter]').forEach(x=>x.classList.toggle('active',x===btn));
      if(!expanded)expanded=true;
      renderAgenda();
    });
  };
  const baseRender=render;
  render=function(){baseRender();renderAgenda()};
  document.addEventListener('pereko:data-refreshed',renderAgenda);
  document.addEventListener('pereko:user-ready',renderAgenda);
  bind();renderAgenda();
})();