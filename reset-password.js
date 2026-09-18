(()=>{
  const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
  const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const form=document.querySelector('#resetForm'),p1=document.querySelector('#resetPassword'),p2=document.querySelector('#resetPassword2'),msg=document.querySelector('#resetMessage'),btn=form.querySelector('.login-submit');
  let recoveryReady=false;
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'||session) recoveryReady=true;
  });
  client.auth.getSession().then(({data:{session}})=>{if(session)recoveryReady=true});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const a=p1.value,b=p2.value;
    if(a.length<8){msg.textContent='Hasło musi mieć co najmniej 8 znaków.';return}
    if(a!==b){msg.textContent='Hasła nie są identyczne.';return}
    btn.disabled=true;btn.textContent='Zapisywanie…';msg.textContent='';
    const {data:{session}}=await client.auth.getSession();
    if(!recoveryReady&&!session){msg.textContent='Link do zmiany hasła jest nieważny lub wygasł. Poproś o nowy link na stronie logowania.';btn.disabled=false;btn.textContent='Ustaw nowe hasło';return}
    const {error}=await client.auth.updateUser({password:a});
    if(error){msg.textContent='Nie udało się ustawić hasła. Link mógł wygasnąć — poproś o nowy.';btn.disabled=false;btn.textContent='Ustaw nowe hasło';return}
    msg.textContent='Hasło zostało zmienione. Za chwilę przejdziemy do panelu.';
    setTimeout(()=>window.location.replace('index.html'),1200);
  });
})();