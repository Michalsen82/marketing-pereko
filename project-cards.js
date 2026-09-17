(()=>{
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
    if(n.includes('zum')||n.includes('lista')||n.includes('oświadc')||n.includes('oswiad'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 2H6v16h12V8h-4V4Zm2 1.4V6h.6L16 5.4ZM8 11h8v2H8v-2Zm0 4h5v2H8v-2Z"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4V4Zm2 2v3h3V6H6Zm7-2h7v7h-7V4Zm2 2v3h3V6h-3ZM4 13h7v7H4v-7Zm2 2v3h3v-3H6Zm7-2h7v7h-7v-7Zm2 2v3h3v-3h-3Z"/></svg>';
  };

  const bindProjectControls=()=>{
    const visible=activeFilter==='all'?projects:projects.filter(p=>p.status===activeFilter);
    document.querySelectorAll('.project').forEach((card,i)=>{
      const p=visible[i];
      if(!p)return;

      const main=card.querySelector('div');
      if(main && !main.querySelector('.project-title-row')){
        const h4=main.querySelector('h4');
        if(h4){
          const row=document.createElement('div');
          row.className='project-title-row';
          const icon=document.createElement('div');
          icon.className='project-topic-icon';
          icon.innerHTML=iconForProject(p.name);
          h4.parentNode.insertBefore(row,h4);
          row.appendChild(icon);
          row.appendChild(h4);
        }
      }

      let actions=card.querySelector('.project-actions');
      if(!actions){
        actions=document.createElement('div');
        actions.className='project-actions';
        main?.appendChild(actions);
      }
      if(!actions.querySelector('.project-open-btn')){
        const open=document.createElement('button');
        open.type='button';
        open.className='project-open-btn';
        open.innerHTML='Otwórz projekt <span>→</span>';
        open.onclick=()=>window.openProjectDetail?.(p.id);
        actions.appendChild(open);
      }
      if(!actions.querySelector('.project-delete-btn')){
        const del=document.createElement('button');
        del.type='button';
        del.className='project-delete-btn';
        del.textContent='Usuń projekt';
        del.onclick=async()=>{
          if(!confirm(`Usunąć projekt „${p.name}”? Tej operacji nie można cofnąć.`))return;
          projects=projects.filter(x=>x.id!==p.id);
          save();
          render();
          if(typeof pushRemote==='function' && cloudSyncEnabled) await pushRemote(true);
        };
        actions.appendChild(del);
      }
    });
  };

  const previousRender=render;
  render=function(){
    previousRender();
    bindProjectControls();
    formatToday();
  };

  const sub=document.querySelector('.support-sub');
  if(sub)sub.remove();
  formatToday();
  bindProjectControls();
})();