(()=>{
  const oldRunCommand=window.runCommand;
  const monthMap={stycznia:1,lutego:2,marca:3,kwietnia:4,maja:5,czerwca:6,lipca:7,sierpnia:8,wrzesnia:9,pazdziernika:10,listopada:11,grudnia:12};

  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[„”"]/g,'').replace(/\s+/g,' ').trim();
  const titleCase=s=>String(s||'').trim().replace(/^./,c=>c.toUpperCase());
  const same=(a,b)=>clean(a)===clean(b);

  const statusFrom=s=>{
    const n=clean(s);
    if(n.includes('realiz')||n.includes('aktywn'))return 'work';
    if(n.includes('plan'))return 'plan';
    if(n.includes('zakon')||n.includes('gotow'))return 'done';
    return null;
  };

  const dateFrom=s=>{
    const n=clean(s);
    let m=n.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
    if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m=n.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/);
    if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    m=n.match(/(\d{1,2})\s+([a-z]+)\s+(20\d{2})/);
    if(m&&monthMap[m[2]])return `${m[3]}-${String(monthMap[m[2]]).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return null;
  };

  const projectNameFromCreate=s=>{
    let raw=String(s||'').trim();
    raw=raw.replace(/^.*?(?:dodaj|utworz|utwórz|stworz|stwórz)(?:\s+mi)?(?:\s+nowy)?\s+projekt\s*/i,'');
    raw=raw.replace(/^(?:(?:pod\s+)?tytułem|(?:pod\s+)?tytulem|o\s+nazwie|nazwa|nazwie)\s*/i,'');
    const stop=/(?:\s*,?\s+)(?:w\s+projekcie|dla\s+projektu|zmien|zmień|ustaw|z\s+terminem|termin(?:em)?|na\s+dzien|na\s+dzień|jako\s+|ze\s+statusem|status(?:em)?|z\s+postepem|z\s+postępem|postep(?:em)?|postęp(?:em)?|przypisz|dla\s+)/i;
    raw=raw.split(stop)[0].trim();
    return raw.replace(/[,.]+$/,'').trim();
  };

  const projectNameFromTarget=s=>{
    const raw=String(s||'');
    let m=raw.match(/(?:w\s+projekcie|dla\s+projektu)\s+(.+?)(?=\s+(?:zmien|zmień|ustaw|z\s+terminem|termin|date|datę|data|na\s+\d|$))/i);
    if(m)return m[1].trim().replace(/[,.]+$/,'');
    m=raw.match(/(?:zmien|zmień|ustaw)\s+(?:date|datę|date\s+projektu|termin(?:\s+projektu)?)\s+(.+?)\s+(?:na|do)\s+/i);
    return m?m[1].trim():'';
  };

  const taskNameFromCreate=s=>{
    let raw=String(s||'').trim();
    raw=raw.replace(/^.*?(?:dodaj|utworz|utwórz|stworz|stwórz)(?:\s+mi)?(?:\s+nowe|\s+nowy)?\s+zadanie\s*/i,'');
    raw=raw.replace(/^(?:o\s+)?(?:nazwie|nazwa|tytule|tytułem|tytulem)\s*/i,'');
    raw=raw.replace(/^[:\-–—]\s*/,'').trim();
    return raw;
  };

  const ownerFrom=s=>{
    const m=String(s||'').match(/(?:przypisz\s+(?:go\s+)?do|odpowiedzialn(?:y|a)\s+(?:ma\s+byc|ma\s+być)?|wlasciciel(?:em)?|właściciel(?:em)?)\s+([A-ZĄĆĘŁŃÓŚŹŻ][\p{L}-]*(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][\p{L}-]*)?)/iu);
    return m?m[1].trim():null;
  };

  const descriptionFrom=s=>{
    const m=String(s||'').match(/(?:opis(?:em)?|opis\s*:|z\s+opisem)\s+(.+)$/i);
    return m?m[1].trim():'';
  };

  const findExactOrLoose=name=>{
    if(!name)return null;
    return projects.find(p=>same(p.name,name))||findProject(name);
  };

  async function enhancedRunCommand(raw){
    const n=clean(raw);

    if(/(?:dodaj|utworz|stworz).*zadanie/.test(n)){
      const text=taskNameFromCreate(raw);
      if(text&&text.length>=2){
        tasks.push({text,done:false});
        await commit(`Dodałem zadanie: ${text}`);
        return;
      }
    }

    if(/(?:dodaj|utworz|stworz).*projekt/.test(n)){
      const name=projectNameFromCreate(raw);
      if(name&&name.length>=2){
        const deadline=dateFrom(raw)||'';
        const pm=n.match(/(?:postep(?:em)?|na)\s*(\d{1,3})\s*%/);
        const progress=pm?Math.max(0,Math.min(100,+pm[1])):0;
        const parsedStatus=statusFrom(raw);
        const status=parsedStatus||'plan';
        const owner=ownerFrom(raw)||'Michał';
        const desc=descriptionFrom(raw);

        let p=projects.find(x=>same(x.name,name));
        let created=false;
        if(!p){
          p={id:crypto.randomUUID(),name:titleCase(name),owner,status,progress,deadline,desc};
          projects.unshift(p);
          created=true;
        }else{
          if(deadline)p.deadline=deadline;
          if(parsedStatus)p.status=parsedStatus;
          if(pm)p.progress=progress;
          if(ownerFrom(raw))p.owner=owner;
          if(desc)p.desc=desc;
        }

        const targetName=projectNameFromTarget(raw);
        const target=targetName?findExactOrLoose(targetName):p;
        const asksDate=/(zmien|zmień|ustaw).*(date|datę|termin)|(?:date|datę|termin).*(na|do)/i.test(raw);
        if(asksDate&&deadline&&target)target.deadline=deadline;

        const action=created?'Dodałem':'Zaktualizowałem istniejący';
        const details=[`projekt „${p.name}”`,`status: ${statusText[p.status]}`,`postęp: ${p.progress||0}%`];
        if(p.deadline)details.push(`termin: ${p.deadline}`);
        details.push(`osoba: ${p.owner}`);
        await commit(`${action} ${details.join(', ')}.`);
        return;
      }
    }

    if(/(?:zmien|zmień|ustaw).*(?:date|datę|termin)|(?:date|datę|termin).*(?:na|do)/i.test(raw)){
      const d=dateFrom(raw);
      const targetName=projectNameFromTarget(raw)||String(raw).replace(/^.*?(?:zmien|zmień|ustaw)\s+(?:date|datę|termin(?:\s+projektu)?)\s*/i,'').split(/\s+(?:na|do)\s+/i)[0].trim();
      const p=findExactOrLoose(targetName);
      if(d&&p){
        p.deadline=d;
        await commit(`Termin projektu „${p.name}” ustawiłem na ${d}.`);
        return;
      }
    }

    if(/usun.*projekt/.test(n)){
      const candidate=String(raw).replace(/^.*?usun(?:\s+projekt)?\s*/i,'').trim();
      const p=findProject(candidate);
      if(p){
        projects=projects.filter(x=>x.id!==p.id);
        await commit(`Usunąłem projekt „${p.name}”.`);
        return;
      }
    }

    if(/zmien.*opis|ustaw.*opis/.test(n)){
      const m=String(raw).match(/(?:zmien|zmień|ustaw)\s+opis\s+(.+?)\s+(?:na|:)\s*(.+)/i);
      if(m){
        const p=findProject(m[1]);
        if(p){p.desc=m[2].trim();await commit(`Zmieniłem opis projektu „${p.name}”.`);return;}
      }
    }

    if(typeof oldRunCommand==='function')return oldRunCommand(raw);
  }

  window.runCommand=enhancedRunCommand;
})();
