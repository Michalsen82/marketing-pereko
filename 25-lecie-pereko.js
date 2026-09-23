(()=>{
  const CHECK_KEY='pereko_25ann_checklist_v2';
  const NOTE_KEY='pereko_25ann_notes_v2';
  const DETAIL_KEY='pereko_25ann_details_v1';
  const BUDGET_KEY='pereko_25ann_budget_v1';

  const checklist=document.querySelector('#annChecklist');
  const progress=document.querySelector('#annProgress');
  const bar=document.querySelector('#annProgressBar');
  const doneCount=document.querySelector('#annDoneCount');
  const allCount=document.querySelector('#annAllCount');
  const notes=document.querySelector('#annNotes');
  const saveNote=document.querySelector('#annSaveNote');

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

  function loadChecks(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem(CHECK_KEY)||'{}')||{}}catch{}
    const defaults={europa-mail:true,manor-mail:true};
    checklist?.querySelectorAll('[data-task]').forEach(input=>{
      const key=input.dataset.task;
      input.checked=Object.prototype.hasOwnProperty.call(saved,key)?!!saved[key]:!!defaults[key];
      input.closest('label')?.classList.toggle('done',input.checked);
    });
    if(!localStorage.getItem(CHECK_KEY)){
      const initial={};
      checklist?.querySelectorAll('[data-task]').forEach(input=>initial[input.dataset.task]=input.checked);
      localStorage.setItem(CHECK_KEY,JSON.stringify(initial));
    }
    refreshProgress();
  }
  function saveChecks(){
    const saved={};
    checklist?.querySelectorAll('[data-task]').forEach(input=>saved[input.dataset.task]=input.checked);
    localStorage.setItem(CHECK_KEY,JSON.stringify(saved));
    refreshProgress();
  }
  function refreshProgress(){
    const all=[...(checklist?.querySelectorAll('[data-task]')||[])];
    const done=all.filter(x=>x.checked).length;
    const pct=all.length?Math.round(done/all.length*100):0;
    if(progress)progress.textContent=pct+'%';
    if(bar)bar.style.width=pct+'%';
    if(doneCount)doneCount.textContent=String(done);
    if(allCount)allCount.textContent=String(all.length);
    all.forEach(input=>input.closest('label')?.classList.toggle('done',input.checked));
  }
  checklist?.addEventListener('change',e=>{if(e.target.matches('[data-task]'))saveChecks()});

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

  loadChecks();
  loadNotes();
  loadDetails();
  loadBudgets();
})();