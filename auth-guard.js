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
    document.body.style.visibility='visible';
    window.perekoCurrentUser=session.user;
    const nameEl=document.querySelector('#loggedUserName');
    if(nameEl&&session.user?.email==='michal.bukowski@pereko.pl') nameEl.textContent='Michał Bukowski';
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