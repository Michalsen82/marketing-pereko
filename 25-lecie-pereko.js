(()=>{
  const CHECK_KEY='pereko_25ann_checklist_v2';
  const PLAN_KEY='pereko_25ann_plan_v1';
  const NOTE_KEY='pereko_25ann_notes_v2';
  const DETAIL_KEY='pereko_25ann_details_v1';
  const BUDGET_KEY='pereko_25ann_budget_v1';
  const ALERT_KEY='pereko_25ann_alerts_v1';

  const checklist=document.querySelector('#annChecklist');
  const progress=document.querySelector('#annProgress');
  const bar=document.querySelector('#annProgressBar');
  const doneCount=document.querySelector('#annDoneCount');
  const allCount=document.querySelector('#annAllCount');
  const notes=document.querySelector('#annNotes');
  const saveNote=document.querySelector('#annSaveNote');
  const addPlanItem=document.querySelector('#addPlanItem');
  const openDetails=document.querySelector('#openProjectDetails');
  const closeDetails=document.querySelector('#closeProjectDetails');
  const detailsPanel=document.querySelector('#projectDetailsPanel');
  const openSuppliers=document.querySelector('#openSuppliers');
  const closeSuppliers=document.querySelector('#closeSuppliers');
  const supplierModal=document.querySelector('#supplierModal');
  const openAlerts=document.querySelector('#openAlerts');
  const closeAlerts=document.querySelector('#closeAlerts');
  const alertModal=document.querySelector('#alertModal');
  const alertList=document.querySelector('#alertList');
  const activeAlertCount=document.querySelector('#activeAlertCount');
  const activeAlertHint=document.querySelector('#activeAlertHint');

  const defaultRows=[
    'Noclegi',
    'Śniadania',
    'Lunche',
    'Kolacja dzień 1',
    'Kolacja galowa dzień 2',
    'Alkohol',
    'Sala / bankiet',
    'Atrakcje hotelowe / SPA',
    'Muzyka na żywo',
    'Atrakcja sceniczna',
    'STAR-y / transport lokalny',
    'Materiały / dekoracje',
    'Inne'
  ];

  const state={
    budgets:{
      europa:{reserve:0,rows:defaultRows.map(name=>({name,value:0}))},
      manor:{reserve:0,rows:defaultRows.map(name=>({name,value:0}))}
    }
  };

  const money=n=>new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',maximumFractionDigits:0}).format(Number(n)||0);
  const num=v=>Math.max(0,Number(String(v??'').replace(',','.'))||0);
  const defaultPlanItems=[
    {id:'europa-mail',title:'Wysłać zapytanie do Hotelu Europa',desc:'noclegi, pełne wyżywienie, 2 kolacje, alkohol, sala, atrakcje',done:true},
    {id:'manor-mail',title:'Wysłać zapytanie do Manor House',desc:'noclegi, pełne wyżywienie, 2 kolacje, alkohol, sala, atrakcje',done:true},
    {id:'europa-offer',title:'Otrzymać i wpisać ofertę Hotelu Europa',desc:'uzupełnić kosztorys poniżej',done:false},
    {id:'manor-offer',title:'Otrzymać i wpisać ofertę Manor House',desc:'uzupełnić kosztorys poniżej',done:false},
    {id:'hotel-compare',title:'Porównać oferty i wybrać hotel',desc:'koszt całkowity + program + logistyka',done:false},
    {id:'guests',title:'Przygotować listę 30 dystrybutorów',desc:'30 osób + osoby towarzyszące',done:false},
    {id:'stars',title:'Zorganizować przejazd STAR-ami',desc:'zapytania ofertowe wysłane do 17 podmiotów; kolejne kroki: odpowiedzi, wybór pojazdów, kierowcy, trasa, liczba kursów',done:true},
    {id:'factory',title:'Przygotować program zwiedzania fabryki PEREKO',desc:'trasa, prowadzący, grupy, BHP',done:false},
    {id:'parallel',title:'Przygotować program równoległy w hotelu',desc:'SPA / atrakcje dla osób nieuczestniczących w części technicznej',done:false},
    {id:'live-music',title:'Wybrać zespół / muzykę na żywo',desc:'drugi wieczór',done:false},
    {id:'stage-attraction',title:'Wybrać atrakcję sceniczną',desc:'stand-up / iluzjonista / inna opcja',done:false},
    {id:'menu',title:'Ustalić menu i alkohol na oba wieczory',desc:'kolacja dzień 1 + gala dzień 2',done:false},
    {id:'transport',title:'Zamknąć transport i logistykę',desc:'hotel ↔ fabryka ↔ atrakcje',done:false},
    {id:'invites',title:'Przygotować zaproszenia jubileuszowe',desc:'projekt, lista, wysyłka, RSVP',done:false},
    {id:'schedule',title:'Zamknąć finalny harmonogram 3 dni',desc:'godzina po godzinie',done:false},
    {id:'budget',title:'Zatwierdzić budżet końcowy',desc:'wybrany wariant + rezerwa',done:false}
  ];

  let planItems=[];
  let specialProgressSyncTimer=null;
  let lastSpecialProgressSignature='';

  function uid(){
    return 'plan-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  }

  function migrateStarTaskStatus(){
    const idx=planItems.findIndex(item=>item.id==='stars');
    if(idx<0)return false;
    let changed=false;
    const wantedDesc='zapytania ofertowe wysłane do 17 podmiotów; kolejne kroki: odpowiedzi, wybór pojazdów, kierowcy, trasa, liczba kursów';
    if(planItems[idx].desc!==wantedDesc){planItems[idx].desc=wantedDesc;changed=true}
    if(!planItems[idx].done){planItems[idx].done=true;changed=true}
    return changed;
  }

  function loadPlan(){
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(PLAN_KEY)||'null')}catch{}
    if(Array.isArray(saved)&&saved.length){
      planItems=saved
        .map(x=>({id:String(x.id||uid()),title:String(x.title||'').trim(),desc:String(x.desc||''),done:!!x.done}))
        .filter(x=>x.title);
      if(!planItems.length)planItems=defaultPlanItems.map(item=>({...item}));
    }else{
      let old={};
      try{old=JSON.parse(localStorage.getItem(CHECK_KEY)||'{}')||{}}catch{}
      planItems=defaultPlanItems.map(item=>({
        ...item,
        done:Object.prototype.hasOwnProperty.call(old,item.id)?!!old[item.id]:item.done
      }));
      savePlan();
    }
    if(migrateStarTaskStatus())savePlan();
    renderPlan();
  }

  function savePlan(){
    localStorage.setItem(PLAN_KEY,JSON.stringify(planItems));
  }

  function renderPlan(){
    if(!checklist)return;
    checklist.innerHTML=planItems.map((item,index)=>
      '<div class="plan-item '+(item.done?'done':'')+'" data-plan-id="'+escapeAttr(item.id)+'">'+
        '<input class="plan-check" type="checkbox" '+(item.done?'checked':'')+' aria-label="Oznacz jako wykonane">'+
        '<div class="plan-copy"><b>'+(index+1)+'. '+escapeHtml(item.title)+'</b><small>'+escapeHtml(item.desc||'')+'</small></div>'+
        '<div class="plan-actions">'+
          '<button class="plan-edit-btn" type="button" title="Edytuj wpis">Edytuj</button>'+
          '<button class="plan-delete-btn" type="button" title="Usuń wpis">Usuń</button>'+
        '</div>'+
      '</div>'
    ).join('');

    checklist.querySelectorAll('.plan-item').forEach(row=>{
      const id=row.dataset.planId;
      const item=planItems.find(x=>x.id===id);
      row.querySelector('.plan-check')?.addEventListener('change',e=>{
        if(!item)return;
        item.done=e.target.checked;
        savePlan();
        renderPlan();
      });
      row.querySelector('.plan-edit-btn')?.addEventListener('click',()=>{
        if(!item)return;
        const title=prompt('Nazwa wpisu:',item.title);
        if(title===null)return;
        const cleanTitle=title.trim();
        if(!cleanTitle)return;
        const desc=prompt('Krótki opis / szczegóły:',item.desc||'');
        if(desc===null)return;
        item.title=cleanTitle;
        item.desc=desc.trim();
        savePlan();
        renderPlan();
      });
      row.querySelector('.plan-delete-btn')?.addEventListener('click',()=>{
        if(!item)return;
        if(!confirm('Usunąć wpis „'+item.title+'”?'))return;
        planItems=planItems.filter(x=>x.id!==item.id);
        savePlan();
        renderPlan();
      });
    });
    refreshProgress();
  }

  function syncSpecialProgress(pct,done,total){
    const signature=[pct,done,total].join('|');
    if(signature===lastSpecialProgressSignature)return;
    clearTimeout(specialProgressSyncTimer);
    specialProgressSyncTimer=setTimeout(async()=>{
      try{
        if(typeof window.perekoAuthFetch!=='function')return;
        const response=await window.perekoAuthFetch('/api/dashboard',{
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            projectId:'pereko-25-lecie-2027',
            progress:pct,
            done,
            total
          })
        });
        if(!response.ok)throw new Error('HTTP '+response.status);
        lastSpecialProgressSignature=signature;
      }catch(error){
        console.warn('Synchronizacja postępu P-003:',error);
      }
    },450);
  }

  function refreshProgress(){
    const done=planItems.filter(x=>x.done).length;
    const total=planItems.length;
    const pct=total?Math.round(done/total*100):0;
    if(progress)progress.textContent=pct+'%';
    if(bar)bar.style.width=pct+'%';
    if(doneCount)doneCount.textContent=String(done);
    if(allCount)allCount.textContent=String(total);
    syncSpecialProgress(pct,done,total);
  }

  addPlanItem?.addEventListener('click',()=>{
    const title=prompt('Nazwa nowego wpisu:');
    if(title===null)return;
    const cleanTitle=title.trim();
    if(!cleanTitle)return;
    const desc=prompt('Krótki opis / szczegóły:','');
    if(desc===null)return;
    planItems.push({id:uid(),title:cleanTitle,desc:desc.trim(),done:false});
    savePlan();
    renderPlan();
  });

  function escapeHtml(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function loadNotes(){
    if(!notes)return;
    notes.value=localStorage.getItem(NOTE_KEY)||'';
    let timer;
    notes.addEventListener('input',()=>{
      clearTimeout(timer);
      if(saveNote)saveNote.textContent='Zapisywanie…';
      timer=setTimeout(()=>{
        localStorage.setItem(NOTE_KEY,notes.value);
        if(saveNote)saveNote.textContent='Zmiany zapisane automatycznie.';
      },220);
    });
  }

  function loadDetails(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(DETAIL_KEY)||'{}')||{}}catch{}
    document.querySelectorAll('[data-detail]').forEach(el=>{
      const key=el.dataset.detail;
      if(Object.prototype.hasOwnProperty.call(saved,key))el.value=saved[key];
      el.addEventListener('input',saveDetails);
      el.addEventListener('change',saveDetails);
    });
  }
  function saveDetails(){
    const saved={};
    document.querySelectorAll('[data-detail]').forEach(el=>saved[el.dataset.detail]=el.value);
    localStorage.setItem(DETAIL_KEY,JSON.stringify(saved));
  }

  function loadBudgets(){
    try{
      const saved=JSON.parse(localStorage.getItem(BUDGET_KEY)||'null');
      if(saved?.europa&&saved?.manor){
        state.budgets.europa={reserve:num(saved.europa.reserve),rows:Array.isArray(saved.europa.rows)?saved.europa.rows:[]};
        state.budgets.manor={reserve:num(saved.manor.reserve),rows:Array.isArray(saved.manor.rows)?saved.manor.rows:[]};
      }
    }catch{}
    ['europa','manor'].forEach(renderBudget);
  }

  function renderBudget(key){
    const box=document.querySelector('[data-budget="'+key+'"]');
    if(!box)return;
    const rowsBox=box.querySelector('.budget-rows');
    const budget=state.budgets[key];
    rowsBox.innerHTML=budget.rows.map((row,i)=>
      '<div class="budget-row">'+
        '<input class="cost-name" data-budget-name="'+i+'" value="'+escapeAttr(row.name)+'" placeholder="Pozycja">'+
        '<input class="cost-value" data-budget-value="'+i+'" type="number" min="0" step="100" value="'+(Number(row.value)||'')+'" placeholder="0">'+
        '<button class="budget-remove" type="button" data-remove-cost="'+i+'" aria-label="Usuń">×</button>'+
      '</div>'
    ).join('');

    const reserve=box.querySelector('[data-reserve]');
    if(reserve)reserve.value=budget.reserve||'';

    rowsBox.querySelectorAll('[data-budget-name]').forEach(input=>input.addEventListener('input',e=>{
      budget.rows[+e.target.dataset.budgetName].name=e.target.value;
      saveBudgets();
    }));
    rowsBox.querySelectorAll('[data-budget-value]').forEach(input=>input.addEventListener('input',e=>{
      budget.rows[+e.target.dataset.budgetValue].value=num(e.target.value);
      saveBudgets();refreshBudgetTotals();
    }));
    rowsBox.querySelectorAll('[data-remove-cost]').forEach(btn=>btn.addEventListener('click',()=>{
      budget.rows.splice(+btn.dataset.removeCost,1);
      saveBudgets();renderBudget(key);
    }));
    reserve?.addEventListener('input',e=>{
      budget.reserve=num(e.target.value);
      saveBudgets();refreshBudgetTotals();
    });
    refreshBudgetTotals();
  }

  function refreshBudgetTotals(){
    ['europa','manor'].forEach(key=>{
      const budget=state.budgets[key];
      const total=budget.rows.reduce((sum,row)=>sum+num(row.value),0);
      const grand=total+num(budget.reserve);
      const title=document.querySelector('#'+key+'Total');
      const grandEl=document.querySelector('#'+key+'Grand');
      const top=document.querySelector('#'+key+'TotalTop');
      if(title)title.textContent=money(total);
      if(grandEl)grandEl.textContent=money(grand);
      if(top)top.textContent=money(grand);
    });
  }

  function saveBudgets(){
    localStorage.setItem(BUDGET_KEY,JSON.stringify(state.budgets));
  }

  function escapeAttr(v){
    return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  document.querySelectorAll('[data-add-cost]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.addCost;
    state.budgets[key].rows.push({name:'Nowa pozycja',value:0});
    saveBudgets();renderBudget(key);
  }));

  openDetails?.addEventListener('click',()=>{
    if(!detailsPanel)return;
    detailsPanel.hidden=!detailsPanel.hidden;
    if(!detailsPanel.hidden)detailsPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  closeDetails?.addEventListener('click',()=>{if(detailsPanel)detailsPanel.hidden=true});

  function loadAlertState(){
    try{return JSON.parse(localStorage.getItem(ALERT_KEY)||'{}')||{}}catch{return {}}
  }

  function saveAlertState(stateValue){
    localStorage.setItem(ALERT_KEY,JSON.stringify(stateValue));
  }

  function correspondenceEntries(){
    return [...document.querySelectorAll('.correspondence-item[data-offer-id]')].map(el=>({
      id:el.dataset.offerId,
      sentAt:el.dataset.sentAt,
      replied:el.dataset.replied==='true',
      title:el.querySelector('.document-type')?.textContent?.trim()||'Zapytanie ofertowe',
      subject:el.querySelector('.document-main h3')?.textContent?.trim()||''
    }));
  }

  function dueAt(entry){
    const sent=new Date(entry.sentAt);
    return new Date(sent.getTime()+3*24*60*60*1000);
  }

  function activeAlerts(){
    const now=Date.now();
    const stateValue=loadAlertState();
    return correspondenceEntries().filter(entry=>{
      if(entry.replied)return false;
      const itemState=stateValue[entry.id]||{};
      if(itemState.disabled)return false;
      const snoozeUntil=itemState.snoozeUntil?new Date(itemState.snoozeUntil).getTime():0;
      return now>=dueAt(entry).getTime() && now>=snoozeUntil;
    });
  }

  function formatDateTime(value){
    const d=new Date(value);
    return d.toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function renderAlerts(){
    const alerts=activeAlerts();
    if(activeAlertCount)activeAlertCount.textContent=String(alerts.length);
    if(activeAlertHint)activeAlertHint.textContent=alerts.length
      ? (alerts.length===1?'1 firma bez odpowiedzi':'Firmy bez odpowiedzi: '+alerts.length)
      : 'Brak zaległych odpowiedzi';
    openAlerts?.classList.toggle('has-alerts',alerts.length>0);

    if(!alertList)return;
    if(!alerts.length){
      alertList.innerHTML='<div class="alert-empty"><b>Brak aktywnych alertów.</b><span>System pilnuje wysłanej korespondencji i pokaże tutaj brak odpowiedzi po 3 dniach.</span></div>';
      return;
    }

    alertList.innerHTML=alerts.map(entry=>
      '<article class="alert-item" data-alert-id="'+escapeAttr(entry.id)+'">'+
        '<div class="alert-item-head"><span>BRAK ODPOWIEDZI</span><strong>'+escapeHtml(entry.title)+'</strong></div>'+
        '<p>'+escapeHtml(entry.subject)+'</p>'+
        '<small>Wysłano: '+formatDateTime(entry.sentAt)+' · termin alertu: '+formatDateTime(dueAt(entry))+'</small>'+
        '<div class="alert-actions">'+
          '<select class="alert-snooze-select" aria-label="Odrocz alert">'+
            '<option value="1">Odrocz o 1 dzień</option>'+
            '<option value="3">Odrocz o 3 dni</option>'+
            '<option value="7">Odrocz o 7 dni</option>'+
            '<option value="14">Odrocz o 14 dni</option>'+
          '</select>'+
          '<button class="alert-snooze-btn" type="button">Odrocz</button>'+
          '<button class="alert-disable-btn" type="button">Wyłącz alert</button>'+
        '</div>'+
      '</article>'
    ).join('');

    alertList.querySelectorAll('.alert-item').forEach(row=>{
      const id=row.dataset.alertId;
      row.querySelector('.alert-snooze-btn')?.addEventListener('click',()=>{
        const days=Number(row.querySelector('.alert-snooze-select')?.value||1);
        const stateValue=loadAlertState();
        stateValue[id]={...(stateValue[id]||{}),snoozeUntil:new Date(Date.now()+days*24*60*60*1000).toISOString(),disabled:false};
        saveAlertState(stateValue);
        renderAlerts();
      });
      row.querySelector('.alert-disable-btn')?.addEventListener('click',()=>{
        if(!confirm('Wyłączyć ten alert? Nie pojawi się ponownie, dopóki nie zresetujemy jego ustawienia.'))return;
        const stateValue=loadAlertState();
        stateValue[id]={...(stateValue[id]||{}),disabled:true};
        saveAlertState(stateValue);
        renderAlerts();
      });
    });
  }

  function setAlertModal(open){
    if(!alertModal)return;
    if(open)renderAlerts();
    alertModal.classList.toggle('open',open);
    alertModal.setAttribute('aria-hidden',open?'false':'true');
    document.body.style.overflow=open?'hidden':'';
  }

  openAlerts?.addEventListener('click',()=>setAlertModal(true));
  closeAlerts?.addEventListener('click',()=>setAlertModal(false));
  alertModal?.addEventListener('click',e=>{if(e.target===alertModal)setAlertModal(false)});

  function markContactedStarSuppliers(){
    const sentEmails=new Set([
      'info@militarymonkeys.pl','kontaktzgraczykiem@gmail.com','kontakt@muzeumgryf.pl','info@dzwig-trans.pl',
      'podnosnikiszczecinek@gmail.com','marcin.dzwig@interia.eu','dzwig@onet.eu','biuro@liftstar.pl',
      'marcinfilusz@gmail.com','uslugidzwig.krzys@wp.pl','p.w.kowalczyk@wp.pl','piotr.adamczyk@starsanduo.pl',
      'lukasz.glica@starsanduo.pl','sylwia@starsanduo.pl','damian.banasik@starsanduo.pl','biuro@motodemont.com.pl',
      'rmr@rmrhandel.pl'
    ]);
    document.querySelectorAll('.supplier-card').forEach(card=>{
      const emails=[...card.querySelectorAll('a[href^="mailto:"]')].map(a=>a.getAttribute('href').slice(7).toLowerCase());
      if(!emails.some(email=>sentEmails.has(email)))return;
      card.classList.add('supplier-contacted');
      if(card.querySelector('.supplier-contact-status'))return;
      const status=document.createElement('div');
      status.className='supplier-contact-status';
      status.textContent='Zapytanie wysłane · 23.09.2026 · oczekuje na odpowiedź';
      card.appendChild(status);
    });
  }

  function setSupplierModal(open){
    if(!supplierModal)return;
    supplierModal.classList.toggle('open',open);
    supplierModal.setAttribute('aria-hidden',open?'false':'true');
    document.body.style.overflow=open?'hidden':'';
  }
  openSuppliers?.addEventListener('click',()=>setSupplierModal(true));
  closeSuppliers?.addEventListener('click',()=>setSupplierModal(false));
  supplierModal?.addEventListener('click',e=>{if(e.target===supplierModal)setSupplierModal(false)});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(supplierModal?.classList.contains('open'))setSupplierModal(false);
    if(alertModal?.classList.contains('open'))setAlertModal(false);
  });

  loadPlan();
  try{loadNotes()}catch(error){console.error(error)}
  try{loadDetails()}catch(error){console.error(error)}
  try{loadBudgets()}catch(error){console.error(error)}
  try{renderAlerts()}catch(error){console.error(error)}
  try{markContactedStarSuppliers()}catch(error){console.error(error)}
})();