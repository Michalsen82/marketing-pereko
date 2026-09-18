(()=>{
  const expanded=new Set();
  const normPerson=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const taskForLoggedUser=t=>{
    const person=window.perekoLoggedPerson;
    if(!person||!t||t.done)return false;
    const assignee=normPerson(t.assignee);
    if(!assignee)return false;
    const full=normPerson(person.name);
    const email=normPerson(person.email);
    const first=full.split(' ')[0];
    return assignee===full||assignee===email||(first&&assignee===first);
  };
  const myOpenTasks=p=>(Array.isArray(p.projectTasks)?p.projectTasks:[]).filter(taskForLoggedUser);

  const formatToday=()=>{
    const box=document.querySelector('#todayBox');
    if(!box)return;
    const d=new Date();
    const weekday=d.toLocaleDateString('pl-PL',{weekday:'long'});
    const month=d.toLocaleDateString('pl-PL',{month:'long'});
    box.innerHTML=`<div class="date-daynum">${String(d.getDate()).padStart(2,'0')}</div><div class="date-copy"><span class="date-weekday">${weekday}</span><strong>${month}</strong><span>${d.getFullYear()}</span></div>`;
  };

  const iconForProject=name=>{
    const n=String(name||'').toLowerCase();
    if(n.includes('targ')||n.includes('expo')||n.includes('heating')||n.includes('hvac'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-9l8-5 8 5v9h-5v-6H9v6H4Zm2-2h1v-6.1l5-3.1 5 3.1V19h1v-6l-6-3.8L6 13v6Z"/><path d="M8 7V3h8v4l-2-1.25V5h-4v.75L8 7Z"/></svg>';
    if(n.includes('świąt')||n.includes('swia')||n.includes('upom')||n.includes('prezent'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-2.18A3 3 0 0 0 12 5.9 3 3 0 0 0 6.18 7H4a2 2 0 0 0-2 2v3h2v9h16v-9h2V9a2 2 0 0 0-2-2ZM15 5a1 1 0 1 1-2 0c0-.55.45-1 1-1s1 .45 1 1ZM9 4c.55 0 1 .45 1 1a1 1 0 1 1-1-1Zm1 15H6v-7h4v7Zm0-9H4V9h6v1Zm4 9h-2V9h2v10Zm4 0h-2v-7h2v7Zm2-9h-4V9h4v1Z"/></svg>';
    if(n.includes('gazet')||n.includes('artyku')||n.includes('materiał')||n.includes('material'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h12a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2Zm0 2v12a2 2 0 0 0 4 0V5H4Zm6 0v12c0 .73-.2 1.41-.54 2H20V8h-2v9a2 2 0 0 1-2 2h-6.54c.34-.59.54-1.27.54-2V5H10Zm2 2h4v2h-4V7Zm0 4h4v2h-4v-2Zm0 4h4v2h-4v-2Z"/></svg>';
    if(n.includes('partner')||n.includes('b2b')||n.includes('centrum'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM4 20v-2a6 6 0 0 1 12 0v2h-2v-2a4 4 0 0 0-8 0v2H4Zm13.5-9.5 1.5-1.5 3 3-3 3-1.5-1.5L19 12l-1.5-1.5Z"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4V4Zm2 2v3h3V6H6Zm7-2h7v7h-7V4Zm2 2v3h3V6h-3ZM4 13h7v7H4v-7Zm2 2v3h3v-3H6Zm7-2h7v7h-7v-7Zm2 2v3h3v-3h-3Z"/></svg>';
  };

  const closeInfo=deadline=>{
    if(!deadline)return {days:'—',label:'dni',text:'Brak terminu zamknięcia projektu',state:'none'};
    const today=new Date();today.setHours(0,0,0,0);
    const end=new Date(deadline+'T00:00:00');end.setHours(0,0,0,0);
    const diff=Math.round((end-today)/86400000);
    if(diff<0)return {days:String(Math.abs(diff)),label:'dni',text:'Projekt przeterminowany · '+Math.abs(diff)+' dni po terminie',state:'overdue'};
    if(diff===0)return {days:'0',label:'dni',text:'Dziś należy zamknąć projekt',state:'today'};
    if(diff===1)return {days:'1',label:'dzień',text:'Pozostał 1 dzień do zamknięcia projektu',state:'soon'};
    return {days:String(diff),label:'dni',text:'Pozostało '+diff+' dni do zamknięcia projektu',state:diff<=7?'soon':'normal'};
  };

  const previewHtml=p=>{
    const list=Array.isArray(p.projectTasks)?p.projectTasks:[];
    const tasks=list.slice(0,5).map(t=>{const due=closeInfo(t.deadline);return `<div class="project-preview-task ${t.done?'done':''}"><span class="project-preview-check">${t.done?'✓':''}</span><div class="project-preview-task-copy"><strong>${esc(t.text)}</strong><small>${esc(t.assignee||'Bez przypisania')}${t.deadline?' · '+esc(t.deadline):''}</small>${t.done?'':`<em>${t.deadline?due.text:'Brak terminu zadania'}</em>`}</div>${t.done?'':`<span class="project-preview-days ${due.state}"><strong>${due.days}</strong><small>${due.label}</small></span>`}</div>`}).join('');
    const remaining=Math.max(0,list.length-5);
    const projectDue=closeInfo(p.deadline);
    return `<div class="project-preview">
      <div class="project-preview-grid">
        <div class="project-preview-block">
          <span class="project-preview-label">ZADANIA</span>
          ${list.length?tasks+' '+(remaining?`<div class="project-preview-more">+${remaining} kolejnych zadań</div>`:''):'<div class="project-preview-empty">Brak zadań. Dodaj je wewnątrz projektu.</div>'}
        </div>
        <div class="project-preview-block">
          <span class="project-preview-label">PODSUMOWANIE</span>
          <div class="project-preview-fact"><span>Termin</span><strong>${esc(p.deadline||'Brak')}</strong></div>
          <div class="project-preview-fact"><span>Odpowiedzialny</span><strong>${esc(p.owner||'—')}</strong></div>
          <div class="project-preview-fact"><span>Status</span><strong>${esc(statusText[p.status]||'—')}</strong></div>
          <div class="project-preview-fact"><span>Koniec projektu</span><strong>${projectDue.state==='none'?'Brak terminu':projectDue.days+' '+(projectDue.days==='1'?'dzień':'dni')}</strong></div>
          <div class="project-preview-fact"><span>Taski</span><strong>${list.filter(t=>t.done).length}/${list.length}</strong></div>
        </div>
      </div>
    </div>`;
  };

  const decorate=()=>{
    const visible=window.getVisibleProjects?window.getVisibleProjects():(activeFilter==='all'?projects:projects.filter(p=>p.status===activeFilter));
    document.querySelectorAll('.project').forEach((card,i)=>{
      const p=visible[i]; if(!p)return;
      card.dataset.projectId=p.id;
      const myTasks=myOpenTasks(p);
      card.classList.toggle('has-my-tasks',myTasks.length>0);

      const main=card.querySelector('.project-main')||card.firstElementChild;
      const h4=main?.querySelector('h4');
      if(main&&h4&&!main.querySelector('.project-title-row')){
        const row=document.createElement('div');
        row.className='project-title-row';
        const icon=document.createElement('div');
        icon.className='project-topic-icon';
        icon.innerHTML=iconForProject(p.name);
        h4.parentNode.insertBefore(row,h4);
        row.appendChild(icon);
        const copy=document.createElement('div');
        copy.className='project-title-copy';
        row.appendChild(copy);
        copy.appendChild(h4);
        const desc=main.querySelector('.project-desc');
        if(desc)copy.appendChild(desc);
      }
      const titleCopy=main?.querySelector('.project-title-copy');
      let mine=titleCopy?.querySelector('.project-my-task-badge');
      if(myTasks.length){
        if(!mine){
          mine=document.createElement('div');
          mine.className='project-my-task-badge';
          titleCopy?.appendChild(mine);
        }
        mine.textContent=myTasks.length===1?'1 zadanie przypisane do Ciebie':myTasks.length+' zadania przypisane do Ciebie';
      }else if(mine){
        mine.remove();
      }

      const ownerText=String(p.owner||'Brak właściciela').trim();
      let ownerBadge=card.querySelector('.project-owner-badge');
      if(!ownerBadge){
        ownerBadge=document.createElement('div');
        ownerBadge.className='project-owner-badge';
        card.appendChild(ownerBadge);
      }
      ownerBadge.innerHTML='<span>Właściciel projektu</span><strong>'+esc(ownerText)+'</strong>';
      const oldOwner=main?.querySelector('.project-owner');
      if(oldOwner) oldOwner.style.display='none';

      let controls=card.querySelector('.project-card-controls');
      if(!controls){
        controls=document.createElement('div');
        controls.className='project-card-controls';
        const info=closeInfo(p.deadline);
        controls.innerHTML='<div class="project-close-info '+info.state+'"><div class="project-close-badge"><strong>'+info.days+'</strong><span>'+info.label+'</span></div><div class="project-close-copy">'+info.text+'</div></div><div class="project-card-actions"><button type="button" class="project-open-btn">Otwórz projekt <span>→</span></button><button type="button" class="project-expand-btn" aria-label="Rozwiń podgląd projektu"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.7 9.3 5.3 5.3 5.3-5.3 1.4 1.4-6.7 6.7-6.7-6.7 1.4-1.4Z"/></svg></span></button></div>';
        card.appendChild(controls);
      }

      const infoNow=closeInfo(p.deadline);
      const infoBox=controls.querySelector('.project-close-info');
      if(infoBox){
        infoBox.className='project-close-info '+infoNow.state;
        infoBox.querySelector('.project-close-badge strong').textContent=infoNow.days;
        infoBox.querySelector('.project-close-badge span').textContent=infoNow.label;
        infoBox.querySelector('.project-close-copy').textContent=infoNow.text;
      }
      controls.querySelector('.project-open-btn').onclick=()=>window.openProjectDetail?.(p.id);
      const expand=controls.querySelector('.project-expand-btn');
      expand.classList.toggle('open',expanded.has(p.id));
      expand.onclick=()=>{
        expanded.has(p.id)?expanded.delete(p.id):expanded.add(p.id);
        render();
      };

      if(expanded.has(p.id)){
        card.classList.add('expanded');
        card.insertAdjacentHTML('beforeend',previewHtml(p));
      }

      card.querySelectorAll('.project-delete-btn').forEach(x=>x.remove());
      const oldActions=card.querySelector('.project-actions');
      if(oldActions)oldActions.remove();
    });
  };

  const previousRender=render;
  render=function(){
    previousRender();
    decorate();
    formatToday();
  };

  document.addEventListener('pereko:user-ready',()=>decorate());
  formatToday();
  decorate();
})();