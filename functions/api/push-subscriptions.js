const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
async function requireUser(request){
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return null;
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:SUPABASE_KEY}});
  return response.ok?response.json():null;
}
const safeId=value=>String(value||'').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,120);
const keyFor=(email,deviceId)=>`sub:${String(email||'').toLowerCase()}:${safeId(deviceId)}`;

export async function onRequestGet(context){
  const user=await requireUser(context.request);
  if(!user)return Response.json({error:'Brak autoryzacji'},{status:401});
  const store=context.env.PUSH_SUBSCRIPTIONS;
  if(!store)return Response.json({error:'Brak bindingu PUSH_SUBSCRIPTIONS',ready:false},{status:503});
  const deviceId=new URL(context.request.url).searchParams.get('deviceId')||'';
  if(!deviceId)return Response.json({error:'Brak deviceId'},{status:400});
  const value=await store.get(keyFor(user.email,deviceId),'json');
  return Response.json({ready:true,subscribed:!!value,device:value||null},{headers:{'Cache-Control':'no-store'}});
}

export async function onRequestPost(context){
  const user=await requireUser(context.request);
  if(!user)return Response.json({error:'Brak autoryzacji'},{status:401});
  const store=context.env.PUSH_SUBSCRIPTIONS;
  if(!store)return Response.json({error:'Brak bindingu PUSH_SUBSCRIPTIONS',ready:false},{status:503});
  const body=await context.request.json().catch(()=>({}));
  const deviceId=safeId(body.deviceId);
  if(!deviceId)return Response.json({error:'Brak deviceId'},{status:400});
  const key=keyFor(user.email,deviceId);

  if(body.action==='unsubscribe'){
    await store.delete(key);
    return Response.json({ok:true,subscribed:false});
  }

  if(body.action==='preferences'){
    const current=await store.get(key,'json');
    if(!current)return Response.json({error:'Urządzenie nie ma aktywnej subskrypcji'},{status:404});
    current.preferences={...(current.preferences||{}),...(body.preferences||{})};
    current.updatedAt=new Date().toISOString();
    await store.put(key,JSON.stringify(current));
    return Response.json({ok:true,subscribed:true});
  }

  if(body.action!=='subscribe'||!body.subscription?.endpoint){
    return Response.json({error:'Nieprawidłowa subskrypcja'},{status:400});
  }
  const record={
    email:String(user.email||'').toLowerCase(),
    userId:user.id||null,
    deviceId,
    subscription:body.subscription,
    preferences:body.preferences||{},
    device:body.device||{},
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  await store.put(key,JSON.stringify(record));
  return Response.json({ok:true,subscribed:true});
}
