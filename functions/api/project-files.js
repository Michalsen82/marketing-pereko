const SUPABASE_URL = 'https://gtzbjpgpxopccauicumz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';
const PROJECT_PREFIX = 'projects/';
const TRASH_PREFIX = 'trash/';

async function requireUser(request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': authorization, 'apikey': SUPABASE_KEY }
  });
  if (!response.ok) return null;
  return response.json();
}

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const safeSegment=v=>String(v||'file')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,180)||'file';
const cleanId=v=>String(v||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,120);
const isProjectKey=key=>typeof key==='string'&&key.startsWith(PROJECT_PREFIX)&&!key.includes('..');

function bucketOrError(context){
  const bucket=context.env.PROJECT_FILES;
  if(!bucket)return {error:json({error:'Magazyn plików R2 nie jest jeszcze podłączony. Wymagany binding PROJECT_FILES.'},503)};
  return {bucket};
}

async function listAll(bucket,prefix,include=['customMetadata','httpMetadata'],max=10000){
  const objects=[];let cursor;
  do{
    const page=await bucket.list({prefix,limit:1000,cursor,include});
    objects.push(...page.objects);
    if(objects.length>=max)return {objects:objects.slice(0,max),truncated:true};
    cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
  return {objects,truncated:false};
}

function versionFromObject(obj){
  const meta=obj.customMetadata||{};
  const byMeta=Number(meta.version);
  if(Number.isInteger(byMeta)&&byMeta>0)return byMeta;
  const m=obj.key.match(/\/v(\d{4})\//);
  return m?Number(m[1]):1;
}

function objectToVersion(obj){
  const meta=obj.customMetadata||{};
  return {
    key:obj.key,
    version:versionFromObject(obj),
    originalName:meta.originalName||obj.key.split('/').pop()||'plik',
    projectId:meta.projectId||'',
    projectNumber:meta.projectNumber||'',
    projectName:meta.projectName||'',
    uploaderName:meta.uploaderName||meta.uploaderEmail||'Użytkownik',
    uploaderEmail:meta.uploaderEmail||'',
    uploadedAt:meta.uploadedAt||(obj.uploaded?new Date(obj.uploaded).toISOString():''),
    contentType:obj.httpMetadata?.contentType||meta.contentType||'application/octet-stream',
    size:Number(obj.size)||0
  };
}

function groupAssets(objects,trashedSet=new Set()){
  const map=new Map();
  for(const obj of objects){
    const meta=obj.customMetadata||{};
    const assetId=meta.assetId||obj.key.split('/')[2]||obj.key;
    if(!map.has(assetId))map.set(assetId,{assetId,versions:[]});
    map.get(assetId).versions.push(objectToVersion(obj));
  }
  const items=[];
  for(const asset of map.values()){
    asset.versions.sort((a,b)=>b.version-a.version||String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
    const latest=asset.versions[0];
    items.push({
      assetId:asset.assetId,
      originalName:latest.originalName,
      projectId:latest.projectId,
      projectNumber:latest.projectNumber,
      projectName:latest.projectName,
      uploaderName:latest.uploaderName,
      uploaderEmail:latest.uploaderEmail,
      uploadedAt:latest.uploadedAt,
      contentType:latest.contentType,
      size:latest.size,
      latestVersion:latest.version,
      latestKey:latest.key,
      trashed:trashedSet.has(asset.assetId),
      versions:asset.versions
    });
  }
  return items.sort((a,b)=>String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

async function trashSetForProject(bucket,projectId){
  const listed=await listAll(bucket,`${TRASH_PREFIX}${projectId}/`,[]);
  return new Set(listed.objects.map(o=>(o.key.split('/').pop()||'').replace(/\.json$/,'')));
}

async function allTrashSet(bucket){
  const listed=await listAll(bucket,TRASH_PREFIX,[]);
  return new Set(listed.objects.map(o=>(o.key.split('/').pop()||'').replace(/\.json$/,'')));
}

async function authenticated(request){
  const user=await requireUser(request);
  return user||null;
}

export async function onRequestGet(context){
  try{
    const user=await authenticated(context.request);
    if(!user)return json({error:'Brak autoryzacji'},401);
    const {bucket,error}=bucketOrError(context);if(error)return error;
    const url=new URL(context.request.url);
    const action=url.searchParams.get('action')||'list';

    if(action==='download'){
      const key=url.searchParams.get('key')||'';
      if(!isProjectKey(key))return json({error:'Nieprawidłowy klucz pliku'},400);
      const range=context.request.headers.get('Range');
      const object=await bucket.get(key,range?{range:context.request.headers}:undefined);
      if(!object)return json({error:'Nie znaleziono pliku'},404);
      const headers=new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag',object.httpEtag);
      headers.set('Cache-Control','private, no-store');
      headers.set('Accept-Ranges','bytes');
      const name=(object.customMetadata?.originalName||key.split('/').pop()||'plik').replace(/[\r\n"]/g,'');
      const disposition=url.searchParams.get('disposition')==='attachment'?'attachment':'inline';
      headers.set('Content-Disposition',`${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
      let status=200;
      if(range&&object.range){
        const start=object.range.offset||0;
        const length=object.range.length||object.size;
        headers.set('Content-Range',`bytes ${start}-${start+length-1}/${object.size}`);
        headers.set('Content-Length',String(length));
        status=206;
      }else{
        headers.set('Content-Length',String(object.size));
      }
      return new Response(object.body,{status,headers});
    }

    if(action==='search'){
      const q=normalize(url.searchParams.get('q')||'');
      if(!q)return json({items:[]});
      const listed=await listAll(bucket,PROJECT_PREFIX,['customMetadata','httpMetadata']);
      const trashed=await allTrashSet(bucket);
      const items=groupAssets(listed.objects,trashed)
        .filter(x=>!x.trashed)
        .filter(x=>normalize([x.originalName,x.projectNumber,x.projectName,x.uploaderName,x.contentType].join(' ')).includes(q))
        .slice(0,60);
      return json({items,truncated:listed.truncated});
    }

    const projectId=cleanId(url.searchParams.get('projectId'));
    if(!projectId)return json({error:'Brak identyfikatora projektu'},400);
    const listed=await listAll(bucket,`${PROJECT_PREFIX}${projectId}/`,['customMetadata','httpMetadata']);
    const trashed=await trashSetForProject(bucket,projectId);
    const items=groupAssets(listed.objects,trashed);
    return json({
      items,
      truncated:listed.truncated,
      activeCount:items.filter(x=>!x.trashed).length,
      activeBytes:items.filter(x=>!x.trashed).reduce((sum,x)=>sum+x.size,0)
    });
  }catch(error){
    return json({error:error?.message||String(error)},500);
  }
}

export async function onRequestPost(context){
  try{
    const user=await authenticated(context.request);
    if(!user)return json({error:'Brak autoryzacji'},401);
    const {bucket,error}=bucketOrError(context);if(error)return error;
    const url=new URL(context.request.url);
    const action=url.searchParams.get('action')||'';

    if(action==='begin'){
      const body=await context.request.json();
      const projectId=cleanId(body.projectId);
      if(!projectId||!body.fileName)return json({error:'Brak projektu lub nazwy pliku'},400);
      const assetId=cleanId(body.assetId)||crypto.randomUUID();
      const existing=await listAll(bucket,`${PROJECT_PREFIX}${projectId}/${assetId}/`,['customMetadata']);
      const maxVersion=existing.objects.reduce((m,o)=>Math.max(m,versionFromObject(o)),0);
      const version=maxVersion+1;
      const fileName=String(body.fileName).slice(0,400);
      const key=`${PROJECT_PREFIX}${projectId}/${assetId}/v${String(version).padStart(4,'0')}/${safeSegment(fileName)}`;
      const uploadedAt=new Date().toISOString();
      const uploaderName=String(body.uploaderName||user.user_metadata?.full_name||user.email||'Użytkownik').slice(0,180);
      const uploaderEmail=String(user.email||'').slice(0,180);
      const contentType=String(body.contentType||'application/octet-stream').slice(0,180);
      const upload=await bucket.createMultipartUpload(key,{
        httpMetadata:{contentType},
        customMetadata:{
          assetId,
          projectId,
          projectNumber:String(body.projectNumber||'').slice(0,40),
          projectName:String(body.projectName||'').slice(0,220),
          originalName:fileName,
          uploaderName,
          uploaderEmail,
          uploadedAt,
          version:String(version),
          contentType
        }
      });
      return json({key,uploadId:upload.uploadId,assetId,version,uploadedAt});
    }

    if(action==='complete'){
      const body=await context.request.json();
      const key=String(body.key||''),uploadId=String(body.uploadId||'');
      if(!isProjectKey(key)||!uploadId||!Array.isArray(body.parts))return json({error:'Nieprawidłowe dane zakończenia uploadu'},400);
      const upload=bucket.resumeMultipartUpload(key,uploadId);
      const parts=body.parts.map(p=>({partNumber:Number(p.partNumber),etag:String(p.etag)}))
        .filter(p=>Number.isInteger(p.partNumber)&&p.partNumber>0&&p.etag);
      const object=await upload.complete(parts);
      return json({ok:true,key:object.key,size:object.size,etag:object.etag});
    }

    if(action==='abort'){
      const body=await context.request.json();
      const key=String(body.key||''),uploadId=String(body.uploadId||'');
      if(!isProjectKey(key)||!uploadId)return json({error:'Nieprawidłowe dane uploadu'},400);
      await bucket.resumeMultipartUpload(key,uploadId).abort();
      return json({ok:true});
    }

    if(action==='trash'){
      const body=await context.request.json();
      const projectId=cleanId(body.projectId),assetId=cleanId(body.assetId);
      if(!projectId||!assetId)return json({error:'Brak danych pliku'},400);
      const marker={
        assetId,projectId,
        trashedAt:new Date().toISOString(),
        trashedBy:user.email||'użytkownik'
      };
      await bucket.put(`${TRASH_PREFIX}${projectId}/${assetId}.json`,JSON.stringify(marker),{
        httpMetadata:{contentType:'application/json'}
      });
      return json({ok:true});
    }

    if(action==='restore'){
      const body=await context.request.json();
      const projectId=cleanId(body.projectId),assetId=cleanId(body.assetId);
      if(!projectId||!assetId)return json({error:'Brak danych pliku'},400);
      await bucket.delete(`${TRASH_PREFIX}${projectId}/${assetId}.json`);
      return json({ok:true});
    }

    return json({error:'Nieznana operacja'},400);
  }catch(error){
    return json({error:error?.message||String(error)},500);
  }
}

export async function onRequestPut(context){
  try{
    const user=await authenticated(context.request);
    if(!user)return json({error:'Brak autoryzacji'},401);
    const {bucket,error}=bucketOrError(context);if(error)return error;
    const url=new URL(context.request.url);
    if(url.searchParams.get('action')!=='upload-part')return json({error:'Nieznana operacja'},400);
    const key=url.searchParams.get('key')||'';
    const uploadId=url.searchParams.get('uploadId')||'';
    const partNumber=Number(url.searchParams.get('partNumber'));
    if(!isProjectKey(key)||!uploadId||!Number.isInteger(partNumber)||partNumber<1||!context.request.body){
      return json({error:'Nieprawidłowa część uploadu'},400);
    }
    const upload=bucket.resumeMultipartUpload(key,uploadId);
    const part=await upload.uploadPart(partNumber,context.request.body);
    return json({partNumber:part.partNumber,etag:part.etag});
  }catch(error){
    return json({error:error?.message||String(error)},500);
  }
}
