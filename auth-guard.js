(()=>{
  const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
  const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      storage:window.localStorage,
      storageKey:'pereko-marketing-auth'
    }
  });
  window.perekoSupabase=client;
  window.perekoAuthReady=(async()=>{
    const firstSession=await client.auth.getSession().catch(()=>({data:{session:null},error:null}));
    let session=firstSession.data?.session||null;
    let error=firstSession.error||null;

    if(!session){
      const refreshed=await client.auth.refreshSession().catch(err=>({data:{session:null},error:err}));
      session=refreshed?.data?.session||null;
      error=refreshed?.error||error;
    }

    if(!session){
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
    if(nameEl){
      const parts=String(displayName||'Użytkownik').trim().split(/\s+/).filter(Boolean);
      const first=parts.shift()||'Użytkownik';
      const last=parts.join(' ');
      const firstEl=document.createElement('span');
      firstEl.className='user-name-part user-first-name';
      firstEl.textContent=first;
      nameEl.replaceChildren(firstEl);
      if(last){
        nameEl.append(document.createTextNode(' '));
        const lastEl=document.createElement('span');
        lastEl.className='user-name-part user-last-name';
        lastEl.textContent=last;
        nameEl.append(lastEl);
      }
      nameEl.setAttribute('aria-label',displayName);
      nameEl.title=displayName;
    }
    document.body.style.visibility='visible';
    document.dispatchEvent(new CustomEvent('pereko:user-ready',{detail:window.perekoLoggedPerson}));
    return session;
  })();

  window.perekoAuthFetch=async(url,options={})=>{
    await window.perekoAuthReady;
    const {data:{session},error}=await client.auth.getSession();
    if(error||!session)throw error||new Error('Brak aktywnej sesji');
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${session.access_token}`);
    return fetch(url,{...options,headers});
  };

  document.addEventListener('click',async e=>{
    const btn=e.target.closest('#logoutBtn');
    if(!btn)return;
    e.preventDefault();
    btn.style.pointerEvents='none';
    try{
      if(typeof window.perekoFlushSync==='function')await window.perekoFlushSync();
    }catch{}
    try{
      if(typeof window.perekoPushUnregister==='function')await window.perekoPushUnregister();
    }catch{}
    await client.auth.signOut();
    window.location.replace('login.html');
  });
})();