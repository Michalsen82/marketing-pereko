(()=>{
  const formatToday=()=>{
    const box=document.querySelector('#todayBox');
    if(!box)return;
    const d=new Date();
    const weekday=d.toLocaleDateString('pl-PL',{weekday:'long'});
    const month=d.toLocaleDateString('pl-PL',{month:'long'});
    box.innerHTML=`<div class="date-daynum">${String(d.getDate()).padStart(2,'0')}</div><div class="date-copy"><span class="date-weekday">${weekday}</span><strong>${month}</strong><span>${d.getFullYear()}</span></div>`;
  };

  const bindProjectControls=()=>{
    const visible=activeFilter==='all'?projects:projects.filter(p=>p.status===activeFilter);
    document.querySelectorAll('.project').forEach((card,i)=>{
      const p=visible[i];
      if(!p)return;
      let actions=card.querySelector('.project-actions');
      if(!actions){
        actions=document.createElement('div');
        actions.className='project-actions';
        card.querySelector('div')?.appendChild(actions);
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