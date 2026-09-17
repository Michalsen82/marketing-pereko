(()=>{
  const oldRunCommand=window.runCommand;
  const monthMap={stycznia:1,lutego:2,marca:3,kwietnia:4,maja:5,czerwca:6,lipca:7,sierpnia:8,wrzesnia:9,pazdziernika:10,listopada:11,grudnia:12};

  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[„”"]/g,'').replace(/\s+/g,' ').trim();
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
    raw=raw.replace(/^.*?dodaj(?:\s+mi)?(?:\s+nowy)?\s+projekt\s*/i,'');
    raw=raw.replace(/^(?:pod\s+)?(?:tytulem|tytułem|nazwa|nazwie)\s*/i,'');
    const stop=/\s+(?:z\s+terminem|termin(?:em)?|na\s+dzien|na\s+dzień|jako\s+|ze\s+statusem|status(?:em)?|z\s+postepem|z\s+postępem|postep(?:em)?|postęp(?:em)?|przypisz|dla\s+)/i;
    raw=raw.split(stop)[0].trim();
    raw=raw.replace(/^(?:pod\s+)?(?:tytulem|tytułem)\s*/i,'').trim();
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

  async function enhancedRunCommand(raw){
    const n=clean(raw);

    if(/dodaj.*projekt/.test(n)){
      const name=projectNameFromCreate(raw);
      if(name&&name.length>=2){
        const deadline=dateFrom(raw)||'';
        const pm=n.match(/(?:postep(?:em)?|postęp(?:em)?|na)\s*(\d{1,3})\s*%/);
        const progress=pm?Math.max(0,Math.min(100,+pm[1])):0;
        const status=statusFrom(raw)||'plan';
        const owner=ownerFrom(raw)||'Michał';
        const desc=descriptionFrom(raw);
        projects.unshift({id:crypto.randomUUID(),name,owner,status,progress,deadline,desc});
        const details=[`projekt „${name}”`,`status: ${statusText[status]}`,`postęp: ${progress}%`];
        if(deadline)details.push(`termin: ${deadline}`);
        details.push(`osoba: ${owner}`);
        await commit(`Dodałem ${details.join(', ')}.`);
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
      const m=String(raw).match(/(?:zmien|zmień|ustaw)\s+opis\s+(.+?)\s+(?:na|:) ?(.+)/i);
      if(m){
        const p=findProject(m[1]);
        if(p){p.desc=m[2].trim();await commit(`Zmienilem opis projektu „${p.name}”.`);return;}
      }
    }

    if(typeof oldRunCommand==='function')return oldRunCommand(raw);
  }

  window.runCommand=enhancedRunCommand;
})();
