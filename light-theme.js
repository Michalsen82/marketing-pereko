(()=>{
  const KEY='pereko_theme';
  const root=document.documentElement;
  const btn=document.getElementById('themeToggle');
  const meta=document.querySelector('meta[name="theme-color"]');

  const getTheme=()=>{
    try{return localStorage.getItem(KEY)==='light'?'light':'dark'}catch{return 'dark'}
  };

  const apply=(theme,persist=true)=>{
    const next=theme==='light'?'light':'dark';
    root.dataset.theme=next;
    root.style.colorScheme=next;
    if(persist){
      try{localStorage.setItem(KEY,next)}catch{}
    }
    if(meta)meta.setAttribute('content',next==='light'?'#ffffff':'#050505');
    if(btn){
      const light=next==='light';
      btn.setAttribute('aria-pressed',light?'true':'false');
      btn.setAttribute('aria-label',light?'Przełącz na ciemny motyw':'Przełącz na jasny motyw');
      btn.setAttribute('data-tooltip',light?'Tryb ciemny':'Tryb jasny');
      btn.title=light?'Tryb ciemny':'Tryb jasny';
    }
    window.dispatchEvent(new CustomEvent('pereko:theme-changed',{detail:{theme:next}}));
  };

  apply(getTheme(),false);

  btn?.addEventListener('click',()=>{
    root.classList.add('theme-transition');
    apply(root.dataset.theme==='light'?'dark':'light',true);
    window.setTimeout(()=>root.classList.remove('theme-transition'),240);
  });
})();