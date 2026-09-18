(()=>{
  const defaults=[
    {name:'Michał Bukowski',role:'Marketing Manager'},
    {name:'Wiktoria Adamczyk',role:'Marketing Specialist'},
    {name:'Łukasz Drozdowski',role:'Creative Content & Design Specialist'},
    {name:'Paweł Chaja',role:'AI Implementation Specialist'},
    {name:'Piotr Chaja',role:'AI Transformation & Implementation Specialist'}
  ];
  let team=JSON.parse(localStorage.getItem('pereko_team')||'null')||defaults;
  // Migracja wcześniejszych zapisów lokalnych po korekcie nazwisk i przywróceniu Piotra Haja.
  team=team.map(p=>({
    ...p,
    name:p.name==='Łukasz Drzodowski'?'Łukasz Drozdowski':p.name==='Paweł Haja'?'Paweł Chaja':p.name==='Piotr Haja'?'Piotr Chaja':p.name,
    role:(p.name==='Piotr Haja'||p.name==='Piotr Chaja')?'AI Transformation & Implementation Specialist':p.role
  }));
  if(!team.some(p=>p.name==='Piotr Chaja')) team.push({name:'Piotr Chaja',role:'AI Transformation & Implementation Specialist'});
  localStorage.setItem('pereko_team',JSON.stringify(team));
  const initials=name=>name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const grid=document.querySelector('.team-grid');
  if(!grid)return;
  const module=grid.closest('.module');
  const head=module?.querySelector('.module-head');

  function save(){localStorage.setItem('pereko_team',JSON.stringify(team))}
  function render(){
    grid.innerHTML=team.map((p,i)=>`
      <div class="person team-person">
        <div class="avatar">${initials(p.name)}</div>
        <div class="team-person-copy"><strong>${p.name}</strong><span>${p.role}</span></div>
        <button class="team-remove" type="button" data-team-remove="${i}" aria-label="Usuń współpracownika">×</button>
      </div>`).join('');
    grid.querySelectorAll('[data-team-remove]').forEach(btn=>btn.onclick=()=>{
      if(!confirm('Usunąć tego współpracownika z listy?')) return;
      team.splice(+btn.dataset.teamRemove,1);save();render();
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
    team.push({name:String(f.get('name')).trim(),role:String(f.get('role')).trim()});
    save();render();e.currentTarget.reset();close();
  };
  render();
})();