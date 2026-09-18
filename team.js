(async()=>{
  try{if(window.perekoAuthReady)await window.perekoAuthReady}catch{return}
  const defaults=[
    {name:'Michał Bukowski',role:'Marketing Manager',email:'michal.bukowski@pereko.pl'},
    {name:'Wiktoria Adamczyk',role:'Marketing Specialist',email:'wiktoria.adamczyk@pereko.pl'},
    {name:'Łukasz Drozdowski',role:'Creative Content & Design Specialist',email:'lukasz.drozdowski@pereko.pl'},
    {name:'Paweł Chaja',role:'AI Implementation Specialist',email:'pawel.chaja@pereko.pl'},
    {name:'Andrzej Guzera',role:'Kierownik Handlowy',email:'andrzej.guzera@pereko.pl'}
  ];
  let team;
  try{team=JSON.parse(localStorage.getItem('pereko_team')||'null')}catch{}
  if(!Array.isArray(team))team=defaults;
  const admin=String(window.perekoLoggedPerson?.email||'').trim().toLowerCase()==='michal.bukowski@pereko.pl';
  const initials=name=>String(name||'').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const escHtml=v=>String(v||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const grid=document.querySelector('.team-grid');
  if(!grid)return;
  const module=grid.closest('.module');
  const head=module?.querySelector('.module-head');
  let editingIndex=null;
  const save=()=>localStorage.setItem('pereko_team',JSON.stringify(team));

  function render(){
    grid.innerHTML=team.map((p,i)=>`
      <div class="person team-person">
        <div class="avatar">${initials(p.name)}</div>
        <div class="team-person-copy"><strong>${escHtml(p.name)}</strong><span>${escHtml(p.role)}</span><small>${p.email?escHtml(p.email):'Brak adresu e-mail'}</small></div>
        ${admin?`<div class="team-person-actions"><button class="team-edit" type="button" data-team-edit="${i}">Edytuj</button><button class="team-remove" type="button" data-team-remove="${i}" aria-label="Usuń współpracownika">×</button></div>`:''}
      </div>`).join('');
    if(!admin)return;
    grid.querySelectorAll('[data-team-remove]').forEach(btn=>btn.onclick=()=>{
      if(!confirm('Usunąć tego współpracownika z listy?'))return;
      team.splice(+btn.dataset.teamRemove,1);save();render();
    });
    grid.querySelectorAll('[data-team-edit]').forEach(btn=>btn.onclick=()=>openTeamModal(+btn.dataset.teamEdit));
  }

  function openTeamModal(index=null){
    if(!admin)return;
    editingIndex=index;
    const modal=document.querySelector('#teamModal');
    const form=modal?.querySelector('#teamForm');
    if(!modal||!form)return;
    const kicker=modal.querySelector('.team-modal-head span');
    const title=modal.querySelector('.team-modal-head h3');
    const saveBtn=modal.querySelector('.team-save');
    if(index===null){
      form.reset();
      kicker.textContent='NOWY WSPÓŁPRACOWNIK';
      title.textContent='Dodaj osobę do zespołu';
      saveBtn.textContent='Dodaj';
    }else{
      const p=team[index];if(!p)return;
      form.elements.name.value=p.name||'';
      form.elements.role.value=p.role||'';
      form.elements.email.value=p.email||'';
      kicker.textContent='EDYCJA WSPÓŁPRACOWNIKA';
      title.textContent='Edytuj dane osoby';
      saveBtn.textContent='Zapisz zmiany';
    }
    modal.classList.add('open');
    setTimeout(()=>form.elements.name?.focus(),0);
  }

  render();
  if(!admin)return;

  if(head&&!head.querySelector('.team-add-btn')){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='team-add-btn';
    btn.innerHTML='<span>+</span> Dodaj współpracownika';
    btn.onclick=()=>openTeamModal(null);
    head.appendChild(btn);
  }

  const modal=document.createElement('div');
  modal.className='team-modal';
  modal.id='teamModal';
  modal.innerHTML=`
    <div class="team-modal-card">
      <div class="team-modal-head">
        <div><span>NOWY WSPÓŁPRACOWNIK</span><h3>Dodaj osobę do zespołu</h3></div>
        <button type="button" class="team-modal-close">×</button>
      </div>
      <form id="teamForm">
        <label>Imię i nazwisko<input name="name" required placeholder="np. Jan Kowalski"></label>
        <label>Stanowisko<input name="role" required placeholder="np. Marketing Specialist"></label>
        <label>Adres e-mail<input name="email" type="email" required placeholder="np. jan.kowalski@pereko.pl"></label>
        <div class="team-modal-actions">
          <button type="button" class="team-cancel">Anuluj</button>
          <button type="submit" class="team-save">Dodaj</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  const close=()=>{editingIndex=null;modal.classList.remove('open')};
  modal.querySelector('.team-modal-close').onclick=close;
  modal.querySelector('.team-cancel').onclick=close;
  modal.onclick=e=>{if(e.target===modal)close()};
  modal.querySelector('#teamForm').onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const person={name:String(f.get('name')).trim(),role:String(f.get('role')).trim(),email:String(f.get('email')).trim()};
    if(editingIndex===null)team.push(person);else team[editingIndex]={...team[editingIndex],...person};
    save();render();e.currentTarget.reset();close();
  };
})();