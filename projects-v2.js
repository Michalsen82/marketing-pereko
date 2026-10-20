(function(){
  const projects=[
    ['198/26','Ogłoszenia o pracę','/projekty/198-2026/'],
    ['197/26','Portal dokumentów','/projekty/197-2026/'],
    ['196/26','Targi PEREKO','/projekty/196-2026/'],
    ['195/26','Karta gwarancyjna','/projekty/195-2026/'],
    ['194/26','25-lecie PEREKO','/projekty/194-2026/']
  ];
  const path=location.pathname.replace(/\/+$/,'/') || '/';
  const side=document.createElement('aside');
  side.className='p2-sidebar';
  side.innerHTML='<div class="p2-brand"><div class="p2-mark">P</div><div><strong>PEREKO</strong><span>Centrum projektów</span></div></div>'+
    '<nav class="p2-nav"><a href="/" data-path="/">⌂ <span>Panel główny</span></a>'+
    '<div class="p2-nav-section">Projekty</div>'+
    projects.map(p=>'<a href="'+p[2]+'" data-path="'+p[2]+'"><strong>'+p[0]+'</strong><span>'+p[1]+'</span></a>').join('')+
    '<div class="p2-nav-section">Narzędzia</div>'+
    '<a href="https://cp-b2b.pages.dev/" target="_blank" rel="noopener">↗ <span>Centrum Partnera B2B</span></a>'+
    '</nav><div class="p2-sidebar-foot">System projektowy<strong>Marketing PEREKO</strong></div>';
  document.body.prepend(side);
  const btn=document.createElement('button');btn.className='p2-mobile';btn.type='button';btn.textContent='☰ Projekty';btn.onclick=()=>document.body.classList.add('p2-nav-open');document.body.prepend(btn);
  const back=document.createElement('button');back.className='p2-backdrop';back.type='button';back.setAttribute('aria-label','Zamknij menu');back.onclick=()=>document.body.classList.remove('p2-nav-open');document.body.prepend(back);
  side.querySelectorAll('a[data-path]').forEach(a=>{const p=a.dataset.path;if((p==='/'&&path==='/')||(p!=='/'&&path.startsWith(p)))a.classList.add('active')});
  side.addEventListener('click',e=>{if(e.target.closest('a'))document.body.classList.remove('p2-nav-open')});
})();