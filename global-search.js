(()=>{
  const panel=document.querySelector('#globalSearchPanel');
  const fab=document.querySelector('#globalSearchFab');
  const close=document.querySelector('#globalSearchClose');
  const input=document.querySelector('#globalSearchInput');
  const clear=document.querySelector('#globalSearchClear');
  const results=document.querySelector('#globalSearchResults');
  if(!panel||!fab||!input||!results)return;

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const escHtml=window.esc||((v)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const projectLabel=p=>window.perekoProjectNumberLabel?.(p)||'P-—';
  const taskLabel=t=>window.perekoTaskNumberLabel?.(t)||'Z-—';
  const numberNorm=v=>String(v||'').toUpperCase().replace(/\s+/g,'').replace('#','-');

  const matches=(label,text,query)=>{
    const q=norm(query);
    if(!q)return true;
    const words=q.split(' ').filter(Boolean);
    const body=norm(text);
    const textHit=body.includes(q)||(words.length>1&&words.every(w=>body.includes(w)));
    const qn=numberNorm(query);
    const ln=numberNorm(label);
    const digits=qn.replace(/^[PZ]-?/,'');
    const numberHit=ln===qn||ln.startsWith(qn)||(
      /^[0-9]{1,3}(?:\/[0-9]{2})?$/.test(digits)&&
      ln.replace(/^[PZ]-?/,'').startsWith(digits.padStart(digits.includes('/')?digits.length:3,'0'))
    );
    return textHit||numberHit;
  };

  const taskRows=()=>{
    const out=[];
    (Array.isArray(tasks)?tasks:[]).forEach(t=>out.push({task:t,project:null,source:'global'}));
    (Array.isArray(projects)?projects:[]).forEach(p=>(Array.isArray(p.projectTasks)?p.projectTasks:[]).forEach(t=>out.push({task:t,project:p,source:'project'})));
    return out;
  };

  const openPanel=()=>{
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>input.focus());
    render();
  };
  const closePanel=()=>{
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
  };

  function render(){
    const q=input.value.trim();
    clear.classList.toggle('visible',!!q);
    if(!q){
      results.innerHTML='<div class="global-search-empty"><strong>Wpisz numer lub frazę</strong><span>Możesz szukać np. P-001/26, Z-001/26 albo fragmentu nazwy projektu lub zadania.</span></div>';
      return;
    }

    const projectHits=(Array.isArray(projects)?projects:[]).filter(p=>matches(projectLabel(p),p.name,q));
    const taskHits=taskRows().filter(x=>matches(taskLabel(x.task),x.task.text,q));
    const projectHtml=projectHits.map(p=>`
      <button class="global-search-result" type="button" data-search-project="${escHtml(p.id)}">
        <span class="global-search-number">${escHtml(projectLabel(p))}</span>
        <span class="global-search-copy"><strong>${escHtml(p.name)}</strong><small>Projekt · ${escHtml(statusText?.[p.status]||'')}</small></span>
        <span class="global-search-arrow">→</span>
      </button>`).join('');
    const taskHtml=taskHits.map(x=>`
      <button class="global-search-result" type="button" data-search-task="${escHtml(x.task.id||'')}" data-search-source="${x.source}" data-search-project="${escHtml(x.project?.id||'')}">
        <span class="global-search-number">${escHtml(taskLabel(x.task))}</span>
        <span class="global-search-copy"><strong>${escHtml(x.task.text)}</strong><small>${x.project?'Zadanie · projekt: '+escHtml(x.project.name):'Zadanie'+(x.task.scheduledFor?' · '+escHtml(x.task.scheduledFor):'')}</small></span>
        <span class="global-search-arrow">→</span>
      </button>`).join('');

    results.innerHTML=
      (projectHits.length?`<div class="global-search-group"><div class="global-search-group-head"><span>PROJEKTY</span><b>${projectHits.length}</b></div>${projectHtml}</div>`:'')+
      (taskHits.length?`<div class="global-search-group"><div class="global-search-group-head"><span>ZADANIA</span><b>${taskHits.length}</b></div>${taskHtml}</div>`:'')+
      (!projectHits.length&&!taskHits.length?'<div class="global-search-empty"><strong>Brak wyników</strong><span>Spróbuj innego numeru lub krótszej frazy.</span></div>':'');

    results.querySelectorAll('[data-search-project]').forEach(btn=>btn.addEventListener('click',()=>{
      const projectId=btn.dataset.searchProject;
      if(btn.dataset.searchSource==='global'&&!projectId){
        closePanel();
        document.querySelector('#taskList')?.closest('.module')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      if(projectId){
        closePanel();
        window.openProjectDetail?.(projectId);
      }
    }));
  }

  fab.addEventListener('click',()=>panel.classList.contains('open')?closePanel():openPanel());
  close?.addEventListener('click',closePanel);
  input.addEventListener('input',render);
  clear?.addEventListener('click',()=>{input.value='';input.focus();render()});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&panel.classList.contains('open'))closePanel();
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPanel()}
  });
  document.addEventListener('click',e=>{
    if(!panel.classList.contains('open'))return;
    if(panel.contains(e.target)||fab.contains(e.target))return;
    closePanel();
  });
  render();
})();