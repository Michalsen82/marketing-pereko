(()=>{
  const CHECK_KEY='pereko_25ann_checklist_v1';
  const NOTE_KEY='pereko_25ann_notes_v1';
  const checklist=document.querySelector('#annChecklist');
  const progress=document.querySelector('#annProgress');
  const bar=document.querySelector('#annProgressBar');
  const notes=document.querySelector('#annNotes');
  const saveNote=document.querySelector('#annSaveNote');

  function loadChecks(){
    let state={};
    try{state=JSON.parse(localStorage.getItem(CHECK_KEY)||'{}')||{}}catch{}
    checklist?.querySelectorAll('[data-task]').forEach(input=>{
      input.checked=!!state[input.dataset.task];
      input.closest('label')?.classList.toggle('done',input.checked);
    });
    refreshProgress();
  }
  function saveChecks(){
    const state={};
    checklist?.querySelectorAll('[data-task]').forEach(input=>state[input.dataset.task]=input.checked);
    localStorage.setItem(CHECK_KEY,JSON.stringify(state));
    refreshProgress();
  }
  function refreshProgress(){
    const all=[...(checklist?.querySelectorAll('[data-task]')||[])];
    const done=all.filter(x=>x.checked).length;
    const pct=all.length?Math.round(done/all.length*100):0;
    if(progress)progress.textContent=pct+'%';
    if(bar)bar.style.width=pct+'%';
    all.forEach(input=>input.closest('label')?.classList.toggle('done',input.checked));
  }
  checklist?.addEventListener('change',e=>{if(e.target.matches('[data-task]'))saveChecks()});

  if(notes){
    notes.value=localStorage.getItem(NOTE_KEY)||'';
    let timer;
    notes.addEventListener('input',()=>{
      clearTimeout(timer);
      if(saveNote)saveNote.textContent='Zapisywanie…';
      timer=setTimeout(()=>{
        localStorage.setItem(NOTE_KEY,notes.value);
        if(saveNote)saveNote.textContent='Notatki zapisane na tym urządzeniu.';
      },250);
    });
  }
  loadChecks();
})();