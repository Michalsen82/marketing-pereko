(()=>{
  const defaults=[
    {name:'Michał Bukowski',role:'Marketing Manager',email:'michal.bukowski@pereko.pl'},
    {name:'Wiktoria Adamczyk',role:'Marketing Specialist',email:'wiktoria.adamczyk@pereko.pl'},
    {name:'Łukasz Drozdowski',role:'Creative Content & Design Specialist',email:'lukasz.drozdowski@pereko.pl'},
    {name:'Paweł Chaja',role:'AI Implementation Specialist',email:''},
    {name:'Piotr Chaja',role:'AI Transformation & Implementation Specialist',email:'piotr.haja@pereko.pl'}
  ];
  let team=JSON.parse(localStorage.getItem('pereko_team')||'null')||defaults;
  // Migracja wcześniejszych zapisów lokalnych po korekcie nazwisk i przywróceniu Piotra Haja.
  team=team.map(p=>{
    const name=p.name==='Łukasz Drzodowski'?'Łukasz Drozdowski':p.name==='Paweł Haja'?'Paweł Chaja':p.name==='Piotr Haja'?'Piotr Chaja':p.name;
    const knownEmails={
      'Michał Bukowski':'michal.bukowski@pereko.pl',
      'Wiktoria Adamczyk':'wiktoria.adamczyk@pereko.pl',
      'Łukasz Drozdowski':'lukasz.drozdowski@pereko.pl',
      'Piotr Chaja':'piotr.haja@pereko.pl'
    };
    return {
      ...p,
      name,
      role:(p.name==='Piotr Haja'||p.name==='Piotr Chaja')?'AI Transformation & Implementation Specialist':p.role,
      email:(typeof p.email==='string'&&p.email.trim())?p.email.trim():(knownEmails[name]||'')
    };
  });
  if(!team.some(p=>p.name==='Piotr Chaja')) team.push({name:'Piotr Chaja',role:'AI Transformation & Implementation Specialist',email:'piotr.haja@pereko.pl'});
  localStorage.setItem('pereko_team',JSON.stringify(team));
  const initials=name=>name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const escHtml=v=>String(v||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const grid=document.querySelector('.team-grid');
  if(!grid)return;
  const module=grid.closest('.module');
  const head=module?.querySelector('.module-head');

  function save(){localStorage.setItem('pereko_team',JSON.stringify(team))}
  function render(){
    grid.innerHTML=team.map((p,i)=>`
      <div class="person team-person">
        <div class="avatar">${initials(p.name)}</div>
        <div class="team-person-copy"><strong>${p.name}</strong><span>${p.role}</span><small>${p.email?escHtml(p.email):'Brak adresu e-mail'}</small></div>
        <div class="team-person-actions"><button class="team-edit" type="button" data-team-edit="${i}">Edytuj</button><button class="team-remove" type="button" data-team-remove="${i}" aria-label="Usuń współpracownika">×</button></div>
      </div>`).join('');
    grid.querySelectorAll('[data-team-remove]').forEach(btn=>btn.onclick=()=>{
      if(!confirm('Usunąć tego współpracownika z listy?')) return;
      team.splice(+btn.dataset.teamRemove,1);save();render();
    });
    grid.querySelectorAll('[data-team-edit]').forEach(btn=>btn.onclick=()=>{
      const i=+btn.dataset.teamEdit;
      const p=team[i];
      const name=prompt('Imię i nazwisko:',p.name);
      if(name===null)return;
      const role=prompt('Stanowisko:',p.role);
      if(role===null)return;
      const email=prompt('Adres e-mail:',p.email||'');
      if(email===null)return;
      p.name=name.trim();
      p.role=role.trim();
      p.email=email.trim();
      save();render();
    });
  }

  if(head && !head.querySelector('.team-add-btn')){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='team-add-btn';
    btn.innerHTML='<span>+</span> Dodaj współpracownika';
    btn.onclick=()=>document.querySelector('#teamModal')?.classList.add('open');
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
  const close=()=>modal.classList.remove('open');
  modal.querySelector('.team-modal-close').onclick=close;
  modal.querySelector('.team-cancel').onclick=close;
  modal.onclick=e=>{if(e.target===modal)close()};
  modal.querySelector('#teamForm').onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    team.push({name:String(f.get('name')).trim(),role:String(f.get('role')).trim(),email:String(f.get('email')).trim()});
    save();render();e.currentTarget.reset();close();
  };
  render();
})();