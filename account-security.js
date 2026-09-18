(()=>{
  const client=window.perekoSupabase;
  if(!client)return;
  let modal;
  function build(){
    if(modal)return;
    modal=document.createElement('div');
    modal.className='password-modal';
    modal.id='passwordModal';
    modal.innerHTML='<div class="password-card"><div class="password-head"><div><span>BEZPIECZEŃSTWO KONTA</span><h3>Zmień hasło</h3><p>Potwierdź obecne hasło i ustaw nowe.</p></div><button class="password-close" type="button" aria-label="Zamknij">×</button></div><form class="password-form" id="passwordForm"><label><span>Obecne hasło</span><input id="currentPassword" type="password" autocomplete="current-password" required></label><label><span>Nowe hasło</span><input id="newPassword" type="password" autocomplete="new-password" minlength="8" required></label><label><span>Powtórz nowe hasło</span><input id="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><div class="password-message" id="passwordMessage" role="status" aria-live="polite"></div><div class="password-actions"><button class="password-cancel" type="button">Anuluj</button><button class="password-save" type="submit">Zmień hasło</button></div></form></div>';
    document.body.appendChild(modal);
    const close=()=>{modal.classList.remove('open');document.querySelector('#passwordForm').reset();document.querySelector('#passwordMessage').textContent='';document.querySelector('#passwordMessage').className='password-message'};
    modal.querySelector('.password-close').onclick=close;
    modal.querySelector('.password-cancel').onclick=close;
    modal.onclick=e=>{if(e.target===modal)close()};
    modal.querySelector('#passwordForm').onsubmit=async e=>{
      e.preventDefault();
      const msg=modal.querySelector('#passwordMessage'),saveBtn=modal.querySelector('.password-save');
      const current=modal.querySelector('#currentPassword').value;
      const next=modal.querySelector('#newPassword').value;
      const confirm=modal.querySelector('#confirmPassword').value;
      msg.className='password-message';
      if(next.length<8){msg.textContent='Nowe hasło musi mieć co najmniej 8 znaków.';msg.classList.add('error');return}
      if(next!==confirm){msg.textContent='Nowe hasła nie są identyczne.';msg.classList.add('error');return}
      if(current===next){msg.textContent='Nowe hasło musi różnić się od obecnego.';msg.classList.add('error');return}
      saveBtn.disabled=true;saveBtn.textContent='Zapisywanie…';
      const {data:{session}}=await client.auth.getSession();
      const email=session?.user?.email;
      const auth=await client.auth.signInWithPassword({email,password:current});
      if(auth.error){msg.textContent='Obecne hasło jest nieprawidłowe.';msg.classList.add('error');saveBtn.disabled=false;saveBtn.textContent='Zmień hasło';return}
      const upd=await client.auth.updateUser({password:next});
      if(upd.error){msg.textContent='Nie udało się zmienić hasła. Spróbuj ponownie.';msg.classList.add('error');saveBtn.disabled=false;saveBtn.textContent='Zmień hasło';return}
      msg.textContent='Hasło zostało zmienione.';msg.classList.add('success');
      saveBtn.textContent='Zmieniono';
      setTimeout(close,1200);
    };
  }
  document.addEventListener('click',e=>{if(e.target.closest('#changePasswordBtn')){build();modal.classList.add('open');setTimeout(()=>modal.querySelector('#currentPassword').focus(),0)}});
})();