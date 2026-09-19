const PEOPLE=[
  ['Michał Bukowski','michal.bukowski@pereko.pl',['michal']],
  ['Wiktoria Adamczyk','wiktoria.adamczyk@pereko.pl',['wiktoria']],
  ['Łukasz Drozdowski','lukasz.drozdowski@pereko.pl',['lukasz','łukasz']],
  ['Paweł Chaja','pawel.chaja@pereko.pl',['pawel','paweł']],
  ['Andrzej Guzera','andrzej.guzera@pereko.pl',['andrzej']],
  ['Randomowy User','bukowski82@gmail.com',['randomowy']]
];
const enc=new TextEncoder();
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export function emailForPerson(value){
  const n=normalize(value);
  if(!n)return '';
  if(n.includes('@'))return n;
  for(const [name,email,aliases] of PEOPLE){
    const full=normalize(name);
    if(n===full||aliases.some(a=>n===normalize(a)))return email;
  }
  return '';
}
export function displayNameForEmail(email){
  const n=normalize(email);
  return PEOPLE.find(x=>normalize(x[1])===n)?.[0]||String(email||'Użytkownik').split('@')[0];
}
function b64url(bytes){
  let s='';for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(value){
  const pad='='.repeat((4-value.length%4)%4);
  const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function concat(...arrays){
  const len=arrays.reduce((n,a)=>n+a.length,0),out=new Uint8Array(len);let offset=0;
  for(const a of arrays){out.set(a,offset);offset+=a.length}
  return out;
}
async function hmac(keyBytes,data){
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,data));
}
async function hkdfExtract(salt,ikm){return hmac(salt,ikm)}
async function hkdfExpand(prk,info,length){
  const block=await hmac(prk,concat(info,new Uint8Array([1])));
  return block.slice(0,length);
}
async function encryptPayload(subscription,payload){
  const clientPub=fromB64url(subscription.keys.p256dh);
  const auth=fromB64url(subscription.keys.auth);
  const clientKey=await crypto.subtle.importKey('raw',clientPub,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const serverPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const serverPub=new Uint8Array(await crypto.subtle.exportKey('raw',serverPair.publicKey));
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:clientKey},serverPair.privateKey,256));
  const prkKey=await hkdfExtract(auth,shared);
  const keyInfo=concat(enc.encode('WebPush: info\0'),clientPub,serverPub);
  const ikm=await hkdfExpand(prkKey,keyInfo,32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const prk=await hkdfExtract(salt,ikm);
  const cek=await hkdfExpand(prk,enc.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdfExpand(prk,enc.encode('Content-Encoding: nonce\0'),12);
  const plaintext=concat(enc.encode(JSON.stringify(payload)),new Uint8Array([2]));
  const aesKey=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']);
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aesKey,plaintext));
  const rs=new Uint8Array(4);new DataView(rs.buffer).setUint32(0,4096);
  return concat(salt,rs,new Uint8Array([serverPub.length]),serverPub,ciphertext);
}
function publicKeyFromJwk(jwk){
  const x=fromB64url(jwk.x),y=fromB64url(jwk.y);
  return b64url(concat(new Uint8Array([4]),x,y));
}
async function vapidHeaders(env,endpoint){
  const jwk=JSON.parse(env.PUSH_VAPID_PRIVATE_JWK||'null');
  if(!jwk?.d)throw new Error('Brak PUSH_VAPID_PRIVATE_JWK');
  const publicKey=env.PUSH_VAPID_PUBLIC_KEY||publicKeyFromJwk(jwk);
  const aud=new URL(endpoint).origin;
  const now=Math.floor(Date.now()/1000);
  const header=b64url(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const payload=b64url(enc.encode(JSON.stringify({aud,exp:now+60*60*12,sub:env.PUSH_VAPID_SUBJECT||'mailto:michal.bukowski@pereko.pl'})));
  const unsigned=header+'.'+payload;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned)));
  return {authorization:'vapid t='+unsigned+'.'+b64url(signature)+', k='+publicKey,publicKey};
}
async function sendOne(env,record,payload,key){
  const sub=record.subscription;
  if(!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth)return {ok:false,status:0,error:'Niepełna subskrypcja urządzenia'};
  const headers=await vapidHeaders(env,sub.endpoint);
  const body=await encryptPayload(sub,payload);
  const response=await fetch(sub.endpoint,{method:'POST',headers:{TTL:'86400',Urgency:'normal','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','Authorization':headers.authorization},body});
  const details=response.ok?'':String(await response.text().catch(()=>'' )).slice(0,300);
  if((response.status===404||response.status===410)&&env.PUSH_SUBSCRIPTIONS&&key)await env.PUSH_SUBSCRIPTIONS.delete(key);
  return {ok:response.ok,status:response.status,error:details||''};
}

export async function sendUserNotification(env,email,payload,type){
  const store=env.PUSH_SUBSCRIPTIONS;
  if(!store||!env.PUSH_VAPID_PRIVATE_JWK)return {ready:false,sent:0,attempted:0,subscriptions:0,failures:[]};
  const target=String(email||'').toLowerCase();
  if(!target)return {ready:true,sent:0,attempted:0,subscriptions:0,failures:[]};
  let cursor=undefined,sent=0,attempted=0,subscriptions=0;
  const failures=[];
  do{
    const page=await store.list({prefix:'sub:'+target+':',cursor});
    for(const item of page.keys){
      const record=await store.get(item.name,'json');
      if(!record)continue;
      subscriptions++;
      if(type&&record.preferences?.[type]===false)continue;
      attempted++;
      try{
        const result=await sendOne(env,record,payload,item.name);
        if(result.ok)sent++;
        else failures.push({status:result.status||0,error:result.error||'Usługa push odrzuciła wiadomość'});
      }catch(error){
        failures.push({status:0,error:String(error?.message||error||'Nieznany błąd').slice(0,300)});
      }
    }
    cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  return {ready:true,sent,attempted,subscriptions,failures:failures.slice(0,5)};
}
