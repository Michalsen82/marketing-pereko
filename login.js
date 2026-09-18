(()=>{
  const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
  const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
  const REMEMBERED_EMAIL_KEY='pereko_remembered_email';
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      storage:window.localStorage,
      storageKey:'pereko-marketing-auth'
    }
  });
  const form=document.querySelector('#loginForm');
  const email=document.querySelector('#loginEmail');
  const password=document.querySelector('#loginPassword');
  const toggle=document.querySelector('#togglePassword');
  const message=document.querySelector('#loginMessage');
  const submit=form?.querySelector('.login-submit');

  const rememberedEmail=localStorage.getItem(REMEMBERED_EMAIL_KEY)||'';
  if(email&&rememberedEmail&&!email.value)email.value=rememberedEmail;

  (async()=>{
    let session=null;
    try{
      const current=await client.auth.getSession();
      session=current.data?.session||null;
      if(!session){
        const refreshed=await client.auth.refreshSession().catch(()=>null);
        session=refreshed?.data?.session||null;
      }
    }catch{}
    if(session)window.location.replace('index.html');
  })();

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
    localStorage.setItem(REMEMBERED_EMAIL_KEY,mail);
    try{
      if('PasswordCredential' in window&&navigator.credentials?.store){
        const credential=new PasswordCredential({id:mail,password:pass,name:mail});
        await navigator.credentials.store(credential);
      }
    }catch{}
    window.location.replace('index.html');
  });

  document.querySelector('#forgotPassword')?.addEventListener('click',async()=>{
    const mail=email.value.trim();
    if(!mail){
      message.textContent='Najpierw wpisz adres e-mail, dla którego chcesz zresetować hasło.';
      email.focus();
      return;
    }
    const btn=document.querySelector('#forgotPassword');
    btn.disabled=true;
    btn.textContent='Wysyłanie linku…';
    message.textContent='';
    const redirectTo=new URL('reset-password.html',window.location.href).href;
    const {error}=await client.auth.resetPasswordForEmail(mail,{redirectTo});
    if(error){
      message.textContent='Nie udało się wysłać wiadomości. Sprawdź adres e-mail i spróbuj ponownie.';
      btn.disabled=false;
      btn.textContent='Nie pamiętasz hasła?';
      return;
    }
    message.textContent='Wysłaliśmy link do ustawienia nowego hasła. Sprawdź skrzynkę e-mail.';
    btn.disabled=false;
    btn.textContent='Wyślij link ponownie';
  });
})();