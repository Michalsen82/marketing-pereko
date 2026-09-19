// Redeploy marker: Web Push Cloudflare bindings active
const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';

async function requireUser(request){
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return null;
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:SUPABASE_KEY}});
  return response.ok?response.json():null;
}
function bytesToB64Url(bytes){
  let raw='';for(const b of bytes)raw+=String.fromCharCode(b);
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64UrlToBytes(value){
  const pad='='.repeat((4-value.length%4)%4);
  const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function publicKeyFromJwk(jwk){
  if(!jwk?.x||!jwk?.y)return '';
  const x=b64UrlToBytes(jwk.x),y=b64UrlToBytes(jwk.y);
  const key=new Uint8Array(1+x.length+y.length);key[0]=4;key.set(x,1);key.set(y,1+x.length);
  return bytesToB64Url(key);
}

export async function onRequestGet(context){
  const user=await requireUser(context.request);
  if(!user)return Response.json({error:'Brak autoryzacji'},{status:401});
  let publicKey=context.env.PUSH_VAPID_PUBLIC_KEY||'';
  let privateReady=false;
  try{
    const jwk=JSON.parse(context.env.PUSH_VAPID_PRIVATE_JWK||'null');
    privateReady=!!jwk?.d;
    if(!publicKey)publicKey=publicKeyFromJwk(jwk);
  }catch{}
  const storageReady=!!context.env.PUSH_SUBSCRIPTIONS;
  return Response.json({ready:!!publicKey&&privateReady&&storageReady,publicKey,storageReady,privateReady},{headers:{'Cache-Control':'no-store'}});
}
