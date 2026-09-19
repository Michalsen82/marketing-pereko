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

async function listAll(bucket,prefix,max=50000,include=[]){
  const objects=[];let cursor;
  do{
    const page=await bucket.list({prefix,limit:1000,cursor,include});
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

    if(action==='usage'||action==='purge'||action==='global-trash'){
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

    if(action==='global-trash'){
      const [trash,files]=await Promise.all([
        listAll(bucket,TRASH_PREFIX,50000),
        listAll(bucket,PROJECT_PREFIX,50000,['customMetadata','httpMetadata'])
      ]);
      const trashed=new Map();
      for(const marker of trash.objects){
        const parts=String(marker.key||'').split('/');
        const projectId=cleanId(parts[1]),assetId=cleanId((parts[2]||'').replace(/\.json$/,''));
        if(projectId&&assetId)trashed.set(projectId+':'+assetId,{projectId,assetId,trashedAt:marker.uploaded?new Date(marker.uploaded).toISOString():''});
      }
      const grouped=new Map();
      for(const obj of files.objects){
        const parts=String(obj.key||'').split('/');
        const projectId=cleanId(parts[1]),assetId=cleanId(parts[2]);
        const groupKey=projectId+':'+assetId;
        if(!trashed.has(groupKey))continue;
        const meta=obj.customMetadata||{};
        if(!grouped.has(groupKey))grouped.set(groupKey,{
          projectId,assetId,
          projectNumber:meta.projectNumber||'',
          projectName:meta.projectName||'',
          originalName:meta.originalName||parts[parts.length-1]||'plik',
          uploaderName:meta.uploaderName||meta.uploaderEmail||'Użytkownik',
          uploadedAt:meta.uploadedAt||(obj.uploaded?new Date(obj.uploaded).toISOString():''),
          latestSize:Number(obj.size)||0,
          totalBytes:0,
          versions:0,
          latestUploaded:obj.uploaded?new Date(obj.uploaded).getTime():0,
          trashedAt:trashed.get(groupKey).trashedAt
        });
        const item=grouped.get(groupKey);
        item.totalBytes+=Number(obj.size)||0;
        item.versions++;
        const uploadedMs=obj.uploaded?new Date(obj.uploaded).getTime():0;
        if(uploadedMs>=item.latestUploaded){
          item.latestUploaded=uploadedMs;
          item.originalName=meta.originalName||item.originalName;
          item.projectNumber=meta.projectNumber||item.projectNumber;
          item.projectName=meta.projectName||item.projectName;
          item.uploaderName=meta.uploaderName||meta.uploaderEmail||item.uploaderName;
          item.uploadedAt=meta.uploadedAt||item.uploadedAt;
          item.latestSize=Number(obj.size)||item.latestSize;
        }
      }
      const items=[...grouped.values()]
        .map(({latestUploaded,...item})=>item)
        .sort((a,b)=>String(b.trashedAt||b.uploadedAt).localeCompare(String(a.trashedAt||a.uploadedAt)));
      return json({items,truncated:trash.truncated||files.truncated});
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
