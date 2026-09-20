(()=>{
  let mode='all';
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
          items.push({kind:'task',date:t.deadline,title:t.text,meta:(t.assignee||'Bez przypisania')+' · '+p.name,projectId:p.id,taskId:t.id});
        }
      });
    });
    (tasks||[]).forEach(t=>{
      const date=t.scheduledFor||t.deadline;
      if(!t.done&&date&&mine(t.assignee)){
        items.push({kind:'task',date,title:t.text,meta:(t.assignee||'Bez przypisania')+' · Task osobisty',taskId:t.id,global:true});
      }
    });
    return items
      .filter(x=>mode==='all'||(mode==='projects'&&x.kind==='project')||(mode==='tasks'&&x.kind==='task'))
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  };
  const renderAgenda=()=>{
    const list=document.querySelector('#deadlineList');if(!list)return;
    const items=collect();
    list.innerHTML=items.length?items.map(x=>{
      const d=dateLabel(x.date);
      const type=x.kind==='project'?'PROJEKT':'ZADANIE';
      const action=x.kind==='project'?'Przejdź do projektu':'Przejdź do zadania';
      return '<article class="deadline-agenda-item '+x.kind+'">'+
        '<div class="datebox"><b>'+d.day+'</b><span>'+d.mon+'</span></div>'+
        '<div class="deadline-agenda-copy"><span class="deadline-agenda-type">'+type+'</span><h5>'+esc(x.title)+'</h5><p>'+esc(x.meta)+'</p></div>'+
        '<button type="button" class="deadline-agenda-open" data-agenda-kind="'+x.kind+'" data-agenda-project="'+esc(x.projectId||'')+'" data-agenda-task="'+esc(x.taskId||'')+'" data-agenda-date="'+esc(x.date)+'">'+action+' <span>→</span></button>'+
      '</article>';
    }).join(''):'<div class="empty deadline-agenda-empty">Brak przypisanych terminów.</div>';
    list.querySelectorAll('.deadline-agenda-open').forEach(btn=>btn.onclick=()=>{
      const kind=btn.dataset.agendaKind,projectId=btn.dataset.agendaProject,taskId=btn.dataset.agendaTask,date=btn.dataset.agendaDate;
      if(kind==='project'){window.openProjectDetail?.(projectId);return}
      if(projectId){window.perekoOpenDeepLink?.({projectId,taskId});return}
      window.perekoOpenTaskCalendar?.(date,taskId);
    });
  };
  const bind=()=>{
    document.querySelectorAll('[data-deadline-filter]').forEach(btn=>btn.onclick=()=>{
      mode=btn.dataset.deadlineFilter;
      document.querySelectorAll('[data-deadline-filter]').forEach(x=>x.classList.toggle('active',x===btn));
      renderAgenda();
    });
  };
  const baseRender=render;
  render=function(){baseRender();renderAgenda()};
  document.addEventListener('pereko:data-refreshed',renderAgenda);
  document.addEventListener('pereko:user-ready',renderAgenda);
  bind();renderAgenda();
})();