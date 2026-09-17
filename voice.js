(()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const form=document.querySelector('#assistantForm');
  const input=document.querySelector('#assistantInput');
  if(!form||!input)return;

  const controls=document.createElement('div');
  controls.className='voice-controls';
  controls.innerHTML=`
    <button type="button" class="voice-btn" id="voiceBtn" aria-label="Dyktuj polecenie" title="Dyktuj polecenie">
      <span class="voice-mic">🎤</span>
    </button>
    <button type="button" class="voice-confirm" id="voiceConfirm" aria-label="Zatwierdź dyktowanie" title="Zatwierdź i wykonaj">✓</button>
    <span class="voice-status" id="voiceStatus"></span>
  `;
  form.insertAdjacentElement('afterend',controls);

  const mic=document.querySelector('#voiceBtn');
  const confirm=document.querySelector('#voiceConfirm');
  const status=document.querySelector('#voiceStatus');

  if(!SpeechRecognition){
    mic.disabled=true;
    status.textContent='Dyktowanie nie jest obsługiwane w tej przeglądarce.';
    controls.classList.add('unsupported');
    return;
  }

  const recognition=new SpeechRecognition();
  recognition.lang='pl-PL';
  recognition.continuous=false;
  recognition.interimResults=true;
  recognition.maxAlternatives=1;

  let finalText='';
  let listening=false;

  const setListening=(value)=>{
    listening=value;
    mic.classList.toggle('listening',value);
    mic.setAttribute('aria-pressed',value?'true':'false');
    status.textContent=value?'Słucham… mów teraz.':'';
  };

  mic.addEventListener('click',()=>{
    if(listening){
      recognition.stop();
      return;
    }
    finalText='';
    try{
      recognition.start();
    }catch(e){
      status.textContent='Mikrofon jest już uruchomiony.';
    }
  });

  recognition.onstart=()=>{
    setListening(true);
    confirm.classList.remove('visible');
  };

  recognition.onresult=(event)=>{
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      const text=event.results[i][0].transcript;
      if(event.results[i].isFinal) finalText+=text;
      else interim+=text;
    }
    input.value=(finalText+interim).trim();
    input.focus();
  };

  recognition.onend=()=>{
    setListening(false);
    if(input.value.trim()){
      status.textContent='Sprawdź tekst i kliknij ✓, aby wykonać polecenie.';
      confirm.classList.add('visible');
    }
  };

  recognition.onerror=(event)=>{
    setListening(false);
    const map={
      'not-allowed':'Brak dostępu do mikrofonu. Zezwól stronie na użycie mikrofonu.',
      'service-not-allowed':'Rozpoznawanie mowy jest zablokowane przez przeglądarkę.',
      'no-speech':'Nie wykryłem mowy. Spróbuj jeszcze raz.',
      'audio-capture':'Nie znaleziono mikrofonu.',
      'network':'Usługa rozpoznawania mowy jest chwilowo niedostępna.'
    };
    status.textContent=map[event.error]||'Nie udało się rozpoznać mowy.';
  };

  confirm.addEventListener('click',()=>{
    if(!input.value.trim())return;
    confirm.classList.remove('visible');
    status.textContent='';
    form.requestSubmit();
  });

  input.addEventListener('input',()=>{
    if(input.value.trim())confirm.classList.add('visible');
    else confirm.classList.remove('visible');
  });
})();
