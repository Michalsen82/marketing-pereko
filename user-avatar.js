(()=>{
  const init=async()=>{
    const input=document.getElementById('userAvatarInput');
    const img=document.getElementById('userAvatarImg');
    const placeholder=document.getElementById('userAvatarPlaceholder');
    const nameEl=document.getElementById('loggedUserName');
    if(!input||!img||!placeholder||!nameEl)return;

    try{if(window.perekoAuthReady)await window.perekoAuthReady}catch{return}
    const person=window.perekoLoggedPerson||{};
    const identity=String(person.email||person.name||nameEl.textContent||'user').trim().toLowerCase();
    const safe=identity.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9@._-]+/g,'-');
    const key='pereko_avatar_'+safe;

    const showAvatar=src=>{
      if(src){
        img.src=src;
        img.style.display='block';
        placeholder.style.display='none';
      }else{
        img.removeAttribute('src');
        img.style.display='none';
        placeholder.style.display='grid';
      }
    };

    let stored=localStorage.getItem(key);
    if(!stored&&person.name){
      const legacy='pereko_avatar_'+String(person.name).trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
      stored=localStorage.getItem(legacy);
    }
    showAvatar(stored);

    input.addEventListener('change',()=>{
      const file=input.files&&input.files[0];
      if(!file)return;
      if(!file.type.startsWith('image/')){
        alert('Wybierz plik graficzny.');
        input.value='';
        return;
      }
      if(file.size>5*1024*1024){
        alert('Zdjęcie jest za duże. Maksymalny rozmiar to 5 MB.');
        input.value='';
        return;
      }
      const reader=new FileReader();
      reader.onload=()=>{
        const src=String(reader.result||'');
        const temp=new Image();
        temp.onload=()=>{
          const canvas=document.createElement('canvas');
          const size=320;
          canvas.width=size;canvas.height=size;
          const ctx=canvas.getContext('2d');
          const scale=Math.max(size/temp.width,size/temp.height);
          const w=temp.width*scale,h=temp.height*scale;
          ctx.drawImage(temp,(size-w)/2,(size-h)/2,w,h);
          const optimized=canvas.toDataURL('image/jpeg',.86);
          localStorage.setItem(key,optimized);
          showAvatar(optimized);
          input.value='';
        };
        temp.src=src;
      };
      reader.readAsDataURL(file);
    });
  };
  init();
})();