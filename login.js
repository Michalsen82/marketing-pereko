(()=>{
  const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
  const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  const form=document.querySelector('#loginForm');
  const email=document.querySelector('#loginEmail');
  const password=document.querySelector('#loginPassword');
  const toggle=document.querySelector('#togglePassword');
  const message=document.querySelector('#loginMessage');
  const submit=form?.querySelector('.login-submit');

  client.auth.getSession().then(({data:{session}})=>{
    if(session) window.location.replace('index.html');
  });

  toggle?.addEventListener('click',()=>{
    const show=password.type==='password';
    password.type=show?'text':'password';
    toggle.setAttribute('aria-label',show?'Ukryj hasło':'Pokaż hasło');
  });

  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const mail=email.value.trim();
    const pass=password.value;
    if(!mail||!pass){
      message.textContent='Wpisz adres e-mail i hasło.';
      return;
    }
    submit.disabled=true;
    submit.textContent='Logowanie…';
    message.textContent='';
    const {error}=await client.auth.signInWithPassword({email:mail,password:pass});
    if(error){
      message.textContent='Nieprawidłowy e-mail lub hasło.';
      submit.disabled=false;
      submit.textContent='Zaloguj się';
      return;
    }
    window.location.replace('index.html');
  });

  document.querySelector('#forgotPassword')?.addEventListener('click',()=>{
    message.textContent='Reset hasła skonfigurujemy w kolejnym kroku.';
  });
})();