(function(){
  const path=location.pathname.replace(/\/+$/,'/')||'/';
  const isHome=path==='/';
  const projects=[
    ['198/26','Ogłoszenia o pracę','/projekty/198-2026/'],
    ['197/26','Portal dokumentów','/projekty/197-2026/'],
    ['196/26','Targi PEREKO','/projekty/196-2026/'],
    ['195/26','Karta gwarancyjna','/projekty/195-2026/'],
    ['194/26','25-lecie PEREKO','/projekty/194-2026/']
  ];

  const header=document.createElement('header');
  header.className='pv-header';
  header.innerHTML='<div class="pv-head">'+
    '<a class="pv-brand" href="/"><span class="pv-logo">PEREKO</span><span class="pv-brand-copy"><strong>Centrum Projektów</strong><span>projekty i zadania Marketing PEREKO</span></span></a>'+
    '<nav class="pv-nav">'+
      '<a href="/" class="'+(isHome?'active':'')+'">Start</a>'+
      '<a href="/#projekty" class="'+(!isHome?'active':'')+'">Projekty</a>'+
      '<a href="/#taski">Taski</a>'+
      '<a href="https://cp-b2b.pages.dev/" target="_blank" rel="noopener">Centrum Partnera B2B</a>'+
    '</nav>'+
    '<div class="pv-user"><div class="pv-avatar">MB</div><div class="pv-user-copy"><strong>Michał Bukowski</strong><span>Marketing PEREKO</span></div><button class="pv-menu-btn" type="button">Menu</button></div>'+
  '</div>';
  document.body.prepend(header);
  const menu=header.querySelector('.pv-menu-btn');if(menu)menu.onclick=()=>header.classList.toggle('open');

  if(isHome){
    const hero=document.querySelector('header.hero');
    if(hero){
      hero.innerHTML='<div class="wrap pv-home-hero"><div><span class="pv-home-kicker">PEREKO / TWOJA PRZESTRZEŃ PROJEKTOWA</span><h1>Wszystkie projekty w jednym miejscu.</h1><p>Projekty marketingowe PEREKO, bieżące zadania, dokumenty i informacje — uporządkowane w jednym panelu roboczym.</p><div class="pv-search"><input id="projectSearch" type="search" placeholder="Czego szukasz?" oninput="filterProjects()"><small>Wyszukaj projekt po numerze, nazwie albo słowie kluczowym.</small></div></div><aside class="pv-quick"><span>ROZPOCZNIJ PRACĘ</span>'+
        projects.slice(0,4).map((p,i)=>'<a href="'+p[2]+'"><i>'+(i===0?'▤':i===1?'□':i===2?'↗':'○')+'</i><span>'+p[1]+'</span><b>↗</b></a>').join('')+
        '</aside></div>';
    }
    const projectsPane=document.querySelector('.projects-pane');if(projectsPane)projectsPane.id='projekty';
    const tasksPane=document.querySelector('.tasks-pane');if(tasksPane)tasksPane.id='taski';
  }else{
    const active=projects.find(p=>path.startsWith(p[2]));
    if(active){
      const nav=header.querySelector('.pv-nav');
      const current=document.createElement('a');current.href=active[2];current.className='active';current.textContent=active[0];
      nav.insertBefore(current,nav.children[2]||null);
    }
  }
})();