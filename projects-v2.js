(function(){
  const path=location.pathname.replace(/\/+$/,'/')||'/';
  const isHome=path==='/';
  if(isHome) document.body.classList.add('home-dashboard');

  const header=document.createElement('header');
  header.className='pv-header';
  header.innerHTML='<div class="pv-head">'+
    '<a class="pv-brand" href="/"><img class="pv-logo-img" src="https://cp-b2b.pages.dev/pereko-logo-generation.png" alt="PEREKO"><span class="pv-brand-copy"><strong>Centrum Projektów</strong><span>projekty i zadania Marketing PEREKO</span></span></a>'+
    '<div class="pv-tools">'+
      '<a class="pv-tool" href="https://admin.motiveko.pl/Home/Login" target="_blank" rel="noopener"><span class="pv-tool-icon">M</span><span>Motiveco Admin</span></a>'+
      '<a class="pv-tool" href="https://cp-b2b.pages.dev/" target="_blank" rel="noopener"><span class="pv-tool-icon">B2B</span><span>Centrum Partnera</span></a>'+
      '<a class="pv-tool" href="https://zadania-mb.pages.dev/" target="_blank" rel="noopener"><span class="pv-tool-icon">ZP</span><span>Zadania premiowe</span></a>'+
      '<a class="pv-tool" href="https://admin.pereko.pl/Home/Login" target="_blank" rel="noopener"><span class="pv-tool-icon">S</span><span>Serwis PEREKO</span></a>'+
      '<a class="pv-tool chat" href="https://chatgpt.com/g/g-p-6ac4a386c1f481919dc5408ac4eaa089-projekty-marketing-pereko/c/6ac4a01e-f198-83ed-906a-264c6ddf46e8" target="_blank" rel="noopener noreferrer" title="ChatGPT · Projekty Marketing PEREKO"><span class="pv-tool-icon">GPT</span><span>ChatGPT</span></a>'+
    '</div>'+
  '</div>';
  document.body.prepend(header);

  if(isHome){
    const hero=document.querySelector('header.hero');
    if(hero) hero.remove();
    const projectsPane=document.querySelector('.projects-pane');if(projectsPane)projectsPane.id='projekty';
    const tasksPane=document.querySelector('.tasks-pane');if(tasksPane)tasksPane.id='taski';
  }
})();