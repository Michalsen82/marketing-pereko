(()=>{
  const form=document.querySelector('#loginForm');
  const password=document.querySelector('#loginPassword');
  const toggle=document.querySelector('#togglePassword');
  const message=document.querySelector('#loginMessage');
  toggle?.addEventListener('click',()=>{
    const show=password.type==='password';
    password.type=show?'text':'password';
    toggle.setAttribute('aria-label',show?'Ukryj hasło':'Pokaż hasło');
  });
  form?.addEventListener('submit',e=>{
    e.preventDefault();
    message.textContent='Bezpieczne uwierzytelnianie podłączymy w następnym kroku.';
  });
  document.querySelector('#forgotPassword')?.addEventListener('click',()=>{
    message.textContent='Reset hasła zostanie uruchomiony razem z systemem logowania.';
  });
})();