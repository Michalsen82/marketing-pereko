(()=>{
  const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
  const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  window.perekoSupabase=client;
  window.perekoAuthReady=(async()=>{
    const {data:{session},error}=await client.auth.getSession();
    if(error||!session){
      window.location.replace('login.html');
      throw error||new Error('Brak aktywnej sesji');
    }
    window.perekoCurrentUser=session.user;
    const email=String(session.user?.email||'').trim().toLowerCase();
    let localTeam=[];
    try{localTeam=JSON.parse(localStorage.getItem('pereko_team')||'[]')}catch{}
    const known={
      'michal.bukowski@pereko.pl':'Michał Bukowski',
      'wiktoria.adamczyk@pereko.pl':'Wiktoria Adamczyk',
      'lukasz.drozdowski@pereko.pl':'Łukasz Drozdowski',
      'pawel.chaja@pereko.pl':'Paweł Chaja',
      'andrzej.guzera@pereko.pl':'Andrzej Guzera',
      'bukowski82@gmail.com':'Randomowy User'
    };
    const localPerson=localTeam.find(p=>String(p?.email||'').trim().toLowerCase()===email);
    const displayName=localPerson?.name||known[email]||session.user?.user_metadata?.full_name||email.split('@')[0]||'Użytkownik';
    window.perekoLoggedPerson={email,name:displayName};
    const nameEl=document.querySelector('#loggedUserName');
    if(nameEl) nameEl.textContent=displayName;
    document.body.style.visibility='visible';
    document.dispatchEvent(new CustomEvent('pereko:user-ready',{detail:window.perekoLoggedPerson}));
    return session;
  })();

  window.perekoAuthFetch=async(url,options={})=>{
    const session=await window.perekoAuthReady;
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${session.access_token}`);
    return fetch(url,{...options,headers});
  };

  document.addEventListener('click',async e=>{
    const btn=e.target.closest('#logoutBtn');
    if(!btn)return;
    e.preventDefault();
    await client.auth.signOut();
    localStorage.removeItem('pereko_projects');
    localStorage.removeItem('pereko_tasks');
    window.location.replace('login.html');
  });
})();