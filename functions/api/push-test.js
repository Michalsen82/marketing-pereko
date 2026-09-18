import {sendUserNotification} from '../_lib/push.js';
const SUPABASE_URL='https://gtzbjpgpxopccauicumz.supabase.co';
const SUPABASE_KEY='sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
async function requireUser(request){
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return null;
  const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:SUPABASE_KEY}});
  return response.ok?response.json():null;
}
export async function onRequestPost(context){
  const user=await requireUser(context.request);
  if(!user)return Response.json({error:'Brak autoryzacji'},{status:401});
  if(!context.env.PUSH_SUBSCRIPTIONS||!context.env.PUSH_VAPID_PRIVATE_JWK)return Response.json({error:'Web Push nie jest jeszcze skonfigurowany',ready:false},{status:503});
  const result=await sendUserNotification(context.env,user.email,{
    title:'PEREKO — Centrum Marketingowe',
    body:'Test Web Push działa poprawnie na tym urządzeniu.',
    icon:'/icons/pereko-marketing-v3-192.png',
    badge:'/icons/badge-96.png',
    tag:'pereko-server-test',
    url:'/',
    badgeCount:1
  },null);
  return Response.json({ok:result.sent>0,...result},{status:result.sent>0?200:404});
}
