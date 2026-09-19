const PROJECT_PREFIX='projects/';
const TRASH_PREFIX='trash/';
const MAX_FILE_BYTES=5*1024*1024;
const FREE_STORAGE_BYTES=10*1000*1000*1000;

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const cleanId=v=>String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,120);

async function requireExistingAuth(context){
  const auth=context.request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return false;
  const probeUrl=new URL('/api/project-files',context.request.url);
  probeUrl.searchParams.set('projectId','__authcheck');
  const probe=await fetch(new Request(probeUrl.toString(),{
    method:'GET',
    headers:{'Authorization':auth,'Accept':'application/json'}
  }));
  return probe.status!==401;
}

async function forwardToExisting(context){
  const target=new URL('/api/project-files',context.request.url);
  target.search=new URL(context.request.url).search;
  const forwarded=new Request(target.toString(),context.request);
  return fetch(forwarded);
}

async function listAll(bucket,prefix,max=50000){
  const objects=[];let cursor;
  do{
    const page=await bucket.list({prefix,limit:1000,cursor});
    objects.push(...page.objects);
    if(objects.length>=max)return {objects:objects.slice(0,max),truncated:true};
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  return {objects,truncated:false};
}

export async function onRequest(context){
  try{
    const url=new URL(context.request.url);
    const action=url.searchParams.get('action')||'list';
    const bucket=context.env.PROJECT_FILES;

    if(action==='usage'||action==='purge'){
      if(!bucket)return json({error:'Magazyn plików R2 nie jest jeszcze podłączony. Wymagany binding PROJECT_FILES.'},503);
      if(!(await requireExistingAuth(context)))return json({error:'Brak autoryzacji'},401);
    }

    if(action==='usage'){
      const listed=await listAll(bucket,PROJECT_PREFIX);
      const usedBytes=listed.objects.reduce((sum,obj)=>sum+(Number(obj.size)||0),0);
      const percent=FREE_STORAGE_BYTES?usedBytes/FREE_STORAGE_BYTES*100:0;
      return json({
        usedBytes,
        freeBytes:Math.max(0,FREE_STORAGE_BYTES-usedBytes),
        limitBytes:FREE_STORAGE_BYTES,
        percent,
        level:percent>=95?'critical':percent>=85?'high':percent>=70?'warning':'ok',
        objectCount:listed.objects.length,
        truncated:listed.truncated
      });
    }

    if(action==='purge'){
      if(context.request.method!=='POST')return json({error:'Niedozwolona metoda'},405);
      const body=await context.request.json();
      const projectId=cleanId(body.projectId),assetId=cleanId(body.assetId);
      if(!projectId||!assetId)return json({error:'Brak danych pliku'},400);
      const listed=await listAll(bucket,`${PROJECT_PREFIX}${projectId}/${assetId}/`);
      const keys=listed.objects.map(o=>o.key);
      const freedBytes=listed.objects.reduce((sum,o)=>sum+(Number(o.size)||0),0);
      for(let i=0;i<keys.length;i+=1000){
        await bucket.delete(keys.slice(i,i+1000));
      }
      await bucket.delete(`${TRASH_PREFIX}${projectId}/${assetId}.json`);
      return json({ok:true,deletedObjects:keys.length,freedBytes});
    }

    if(action==='begin'&&context.request.method==='POST'){
      const body=await context.request.clone().json().catch(()=>({}));
      const size=Number(body.size)||0;
      if(size<=0)return json({error:'Nieprawidłowy rozmiar pliku'},400);
      if(size>MAX_FILE_BYTES)return json({error:'Maksymalny rozmiar pojedynczego pliku to 5 MB.'},413);
    }

    if(action==='upload-part'&&context.request.method==='PUT'){
      const length=Number(context.request.headers.get('content-length'))||0;
      if(length>MAX_FILE_BYTES)return json({error:'Maksymalny rozmiar pojedynczego pliku to 5 MB.'},413);
    }

    return forwardToExisting(context);
  }catch(error){
    return json({error:error?.message||String(error)},500);
  }
}
