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
  const topBtn=document.querySelector('#teamTopBtn');
  if(!topBtn)return;

  const initials=name=>String(name||'').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const escHtml=v=>String(v||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let editingIndex=null;
  let managerModal=null;
  let editorModal=null;

  const save=()=>{
    localStorage.setItem('pereko_team',JSON.stringify(team));
    window.perekoTeam=team.map(x=>({...x}));
    window.dispatchEvent(new CustomEvent('pereko:team-changed',{detail:{team:window.perekoTeam}}));
  };

  function buildManager(){
    if(managerModal)return;
    managerModal=document.createElement('div');
    managerModal.className='modal team-manager-modal';
    managerModal.id='teamManagerModal';
    managerModal.innerHTML=`
      <div class="modal-card team-manager-card">
        <div class="modal-head team-manager-head">
          <div>
            <span class="module-label">ZESPÓŁ PEREKO</span>
            <h3>Współpracownicy</h3>
            <p>Lista osób dostępnych w Centrum Marketingowym.</p>
          </div>
          <button class="icon-close team-manager-close" type="button" aria-label="Zamknij">×</button>
        </div>
        <div class="team-manager-toolbar">
          <label class="team-manager-search field">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 19.6-5.2-5.2a7 7 0 1 0-1.4 1.4L19.6 21 21 19.6ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"/></svg>
            <input id="teamManagerSearch" type="search" autocomplete="off" placeholder="Szukaj po imieniu, stanowisku lub e-mailu…">
          </label>
          <div class="team-manager-toolbar-right">
            <span class="team-manager-count" id="teamManagerCount">0 osób</span>
            ${admin?'<button class="btn primary team-manager-add" type="button"><span>+</span> Dodaj współpracownika</button>':''}
          </div>
        </div>
        <div class="team-manager-list" id="teamManagerList"></div>
      </div>`;
    document.body.appendChild(managerModal);

    managerModal.querySelector('.team-manager-close').onclick=closeManager;
    managerModal.onclick=e=>{if(e.target===managerModal)closeManager()};
    managerModal.querySelector('#teamManagerSearch').oninput=renderManager;
    managerModal.querySelector('.team-manager-add')?.addEventListener('click',()=>openEditor(null));
  }

  function buildEditor(){
    if(editorModal)return;
    editorModal=document.createElement('div');
    editorModal.className='modal team-modal';
    editorModal.id='teamModal';
    editorModal.innerHTML=`
      <div class="modal-card team-modal-card">
        <div class="modal-head team-modal-head">
          <div><span class="module-label">NOWY WSPÓŁPRACOWNIK</span><h3>Dodaj osobę do zespołu</h3></div>
          <button type="button" class="icon-close team-modal-close" aria-label="Zamknij">×</button>
        </div>
        <form id="teamForm">
          <div class="form-grid">
            <div class="field full"><label>Imię i nazwisko</label><input name="name" required placeholder="np. Jan Kowalski"></div>
            <div class="field full"><label>Stanowisko</label><input name="role" required placeholder="np. Marketing Specialist"></div>
            <div class="field full"><label>Adres e-mail</label><input name="email" type="email" required placeholder="np. jan.kowalski@pereko.pl"></div>
          </div>
          <div class="modal-actions team-modal-actions">
            <div class="spacer"></div>
            <button type="button" class="btn secondary team-cancel">Anuluj</button>
            <button type="submit" class="btn primary team-save">Dodaj</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(editorModal);

    const close=()=>{editingIndex=null;editorModal.classList.remove('open')};
    editorModal.querySelector('.team-modal-close').onclick=close;
    editorModal.querySelector('.team-cancel').onclick=close;
    editorModal.onclick=e=>{if(e.target===editorModal)close()};
    editorModal.querySelector('#teamForm').onsubmit=e=>{
      e.preventDefault();
      const fd=new FormData(e.currentTarget);
      const person={
        name:String(fd.get('name')||'').trim(),
        role:String(fd.get('role')||'').trim(),
        email:String(fd.get('email')||'').trim()
      };
      if(!person.name||!person.role||!person.email)return;
      if(editingIndex===null)team.push(person);
      else team[editingIndex]={...team[editingIndex],...person};
      save();
      renderManager();
      e.currentTarget.reset();
      close();
    };
  }

  function renderManager(){
    buildManager();
    const list=managerModal.querySelector('#teamManagerList');
    const q=String(managerModal.querySelector('#teamManagerSearch')?.value||'').trim().toLowerCase();
    const visible=team.map((person,index)=>({person,index})).filter(({person})=>{
      if(!q)return true;
      return [person.name,person.role,person.email].join(' ').toLowerCase().includes(q);
    });
    const count=managerModal.querySelector('#teamManagerCount');
    if(count)count.textContent=`${team.length} ${team.length===1?'osoba':team.length>=2&&team.length<=4?'osoby':'osób'}`;

    if(!visible.length){
      list.innerHTML='<div class="team-manager-empty">Brak współpracowników pasujących do wyszukiwania.</div>';
      return;
    }

    list.innerHTML=visible.map(({person,index})=>`
      <article class="team-manager-person">
        <div class="team-manager-avatar">${escHtml(initials(person.name))}</div>
        <div class="team-manager-copy">
          <strong>${escHtml(person.name)}</strong>
          <span>${escHtml(person.role||'Brak stanowiska')}</span>
          <small>${escHtml(person.email||'Brak adresu e-mail')}</small>
        </div>
        ${admin?`<div class="team-manager-actions">
          <button class="btn secondary" type="button" data-team-edit="${index}">Edytuj</button>
          <button class="btn secondary danger" type="button" data-team-remove="${index}">Usuń</button>
        </div>`:''}
      </article>`).join('');

    if(admin){
      list.querySelectorAll('[data-team-edit]').forEach(btn=>btn.onclick=()=>openEditor(+btn.dataset.teamEdit));
      list.querySelectorAll('[data-team-remove]').forEach(btn=>btn.onclick=()=>{
        const index=+btn.dataset.teamRemove;
        const person=team[index];if(!person)return;
        if(!confirm(`Usunąć współpracownika „${person.name}” z listy?`))return;
        team.splice(index,1);
        save();
        renderManager();
      });
    }
  }

  function openManager(){
    buildManager();
    renderManager();
    managerModal.classList.add('open');
    topBtn.classList.add('active');
    topBtn.setAttribute('aria-expanded','true');
    setTimeout(()=>managerModal.querySelector('#teamManagerSearch')?.focus(),0);
  }

  function closeManager(){
    managerModal?.classList.remove('open');
    topBtn.classList.remove('active');
    topBtn.setAttribute('aria-expanded','false');
  }

  function openEditor(index=null){
    if(!admin)return;
    buildEditor();
    editingIndex=index;
    const form=editorModal.querySelector('#teamForm');
    const kicker=editorModal.querySelector('.team-modal-head span');
    const title=editorModal.querySelector('.team-modal-head h3');
    const saveBtn=editorModal.querySelector('.team-save');

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
    editorModal.classList.add('open');
    setTimeout(()=>form.elements.name?.focus(),0);
  }

  topBtn.setAttribute('aria-expanded','false');
  topBtn.onclick=openManager;
  window.perekoTeam=team.map(x=>({...x}));
})();