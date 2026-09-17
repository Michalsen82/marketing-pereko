(()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const form=document.querySelector('#assistantForm');
  const input=document.querySelector('#assistantInput');
  if(!form||!input)return;

  const wrapper=document.createElement('div');
  wrapper.className='voice-input-wrap';
  input.parentNode.insertBefore(wrapper,input);
  wrapper.appendChild(input);

  const mic=document.createElement('button');
  mic.type='button';
  mic.className='voice-btn';
  mic.id='voiceBtn';
  mic.setAttribute('aria-label','Dyktuj polecenie');
  mic.setAttribute('title','Dyktuj polecenie');
  mic.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.6 3.6 0 0 0 3.6-3.6V6.6a3.6 3.6 0 1 0-7.2 0v4.8A3.6 3.6 0 0 0 12 15Zm6-3.8a1 1 0 0 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.92V20H8.8a1 1 0 1 0 0 2h6.4a1 1 0 1 0 0-2H13v-2.88A6 6 0 0 0 18 11.2Z"/></svg>`;

  const confirm=document.createElement('button');
  confirm.type='button';
  confirm.className='voice-confirm';
  confirm.id='voiceConfirm';
  confirm.setAttribute('aria-label','Zatwierdź dyktowanie');
  confirm.setAttribute('title','Zatwierdź i wykonaj');
  confirm.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 16.2-4.1-4.1a1.2 1.2 0 1 0-1.7 1.7l5 5c.47.47 1.23.47 1.7 0l10.5-10.5a1.2 1.2 0 1 0-1.7-1.7L9.2 16.2Z"/></svg>`;

  const status=document.createElement('div');
  status.className='voice-status';
  status.id='voiceStatus';

  const actions=document.createElement('div');
  actions.className='voice-actions';
  actions.append(mic,confirm);
  wrapper.appendChild(actions);
  form.insertAdjacentElement('afterend',status);

  if(!window.isSecureContext){
    mic.disabled=true;
    status.textContent='Dyktowanie wymaga bezpiecznego połączenia HTTPS.';
    status.classList.add('error');
    return;
  }

  if(!SpeechRecognition){
    mic.disabled=true;
    status.textContent='Ta przeglądarka nie obsługuje rozpoznawania mowy. Otwórz stronę w aktualnym Chrome lub Edge.';
    status.classList.add('error');
    return;
  }

  const recognition=new SpeechRecognition();
  recognition.lang='pl-PL';
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.maxAlternatives=1;

  let finalText='';
  let listening=false;
  let hadError=false;

  function setListening(value){
    listening=value;
    mic.classList.toggle('listening',value);
    mic.setAttribute('aria-pressed',value?'true':'false');
    if(value){
      status.textContent='Słucham… mów normalnie. Kliknij mikrofon ponownie, aby zakończyć.';
      status.classList.remove('error');
    }
  }

  async function ensureMicPermission(){
    if(!navigator.mediaDevices?.getUserMedia)return true;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(t=>t.stop());
      return true;
    }catch(err){
      status.textContent='Brak dostępu do mikrofonu. Kliknij ikonę kłódki przy adresie strony i ustaw Mikrofon → Zezwalaj.';
      status.classList.add('error');
      return false;
    }
  }

  mic.addEventListener('click',async()=>{
    if(listening){
      recognition.stop();
      return;
    }

    if(!(await ensureMicPermission()))return;

    finalText=input.value.trim();
    if(finalText) finalText+=' ';
    hadError=false;
    confirm.classList.remove('visible');

    try{
      recognition.start();
    }catch(err){
      status.textContent='Nie udało się uruchomić mikrofonu. Spróbuj ponownie za chwilę.';
      status.classList.add('error');
    }
  });

  recognition.onstart=()=>setListening(true);

  recognition.onresult=(event)=>{
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      const text=event.results[i][0].transcript;
      if(event.results[i].isFinal) finalText+=text+' ';
      else interim+=text;
    }
    input.value=(finalText+interim).trim();
    input.focus();
  };

  recognition.onerror=(event)=>{
    hadError=true;
    setListening(false);
    const map={
      'not-allowed':'Dostęp do mikrofonu jest zablokowany. Zezwól stronie na korzystanie z mikrofonu.',
      'service-not-allowed':'Rozpoznawanie mowy jest zablokowane przez przeglądarkę.',
      'no-speech':'Nie wykryłem mowy. Kliknij mikrofon i spróbuj ponownie.',
      'audio-capture':'Nie znaleziono aktywnego mikrofonu.',
      'network':'Przeglądarka nie mogła połączyć się z usługą rozpoznawania mowy.'
    };
    status.textContent=map[event.error]||`Błąd rozpoznawania mowy: ${event.error}`;
    status.classList.add('error');
  };

  recognition.onend=()=>{
    setListening(false);
    if(!hadError&&input.value.trim()){
      status.textContent='Gotowe. Sprawdź tekst i kliknij ✓, aby wykonać polecenie.';
      status.classList.remove('error');
      confirm.classList.add('visible');
    }
  };

  confirm.addEventListener('click',()=>{
    if(!input.value.trim())return;
    confirm.classList.remove('visible');
    status.textContent='';
    form.requestSubmit();
  });

  input.addEventListener('input',()=>{
    if(input.value.trim()&&!listening)confirm.classList.add('visible');
    else if(!input.value.trim())confirm.classList.remove('visible');
  });
})();