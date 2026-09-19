(()=>{
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];

  function openGlobalSearch(){
    q('#globalSearchFab')?.click();
  }

  function openTeam(){
    q('#teamTopBtn')?.click();
  }

  function scrollToId(id){
    const el=document.getElementById(id);
    if(!el)return;
    const offset=88;
    const top=el.getBoundingClientRect().top+window.scrollY-offset;
    window.scrollTo({top,behavior:'smooth'});
  }

  function setActive(btn){
    qa('.blue-nav-btn').forEach(x=>x.classList.toggle('active',x===btn));
  }

  qa('.blue-nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const action=btn.dataset.blueAction;
      if(action==='team'){openTeam();return}
      if(action==='search'){openGlobalSearch();return}
      const target=btn.dataset.blueTarget;
      if(target){
        setActive(btn);
        scrollToId(target);
      }
    });
  });

  q('#blueTopSearch')?.addEventListener('click',openGlobalSearch);

  const tracked=[
    ['dashboardTop','[data-blue-target="dashboardTop"]'],
    ['projectsSection','[data-blue-target="projectsSection"]'],
    ['tasksSection','[data-blue-target="tasksSection"]'],
    ['deadlinesSection','[data-blue-target="deadlinesSection"]'],
    ['r2GlobalModule','[data-blue-target="r2GlobalModule"]']
  ].map(([id,selector])=>({el:document.getElementById(id),btn:q(selector)})).filter(x=>x.el&&x.btn);

  if('IntersectionObserver'in window&&tracked.length){
    const observer=new IntersectionObserver(entries=>{
      const visible=entries
        .filter(e=>e.isIntersecting)
        .sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      const found=tracked.find(x=>x.el===visible.target);
      if(found)setActive(found.btn);
    },{rootMargin:'-90px 0px -68% 0px',threshold:[0,.08,.2,.4]});
    tracked.forEach(x=>observer.observe(x.el));
  }
})();