import {sendUserNotification,emailForPerson,displayNameForEmail} from '../_lib/push.js';

const OWNER = 'Michalsen82';
const REPO = 'marketing-pereko';
const FILE_PATH = 'data/dashboard.json';
const BRANCH = 'main';
const PRODUCTION_DASHBOARD_API = 'https://marketing-pereko.pages.dev/api/dashboard';
const SUPABASE_URL = 'https://gtzbjpgpxopccauicumz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rwjSZQl6PhkENNfflgh60w_4r-a-tzw';

async function requireUser(request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': authorization,
      'apikey': SUPABASE_KEY
    }
  });
  if (!response.ok) return null;
  return response.json();
}

const ghHeaders = token => ({
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'pereko-marketing-dashboard'
});

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function getCurrentFile(token) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const response = await fetch(url, { headers: ghHeaders(token) });
  if (!response.ok) throw new Error(`GitHub GET failed: ${response.status}`);
  return response.json();
}

const itemKey=item=>String(item?.id||[item?.taskYear||'',item?.taskNumber||'',item?.text||''].join('|'));
const commentKey=item=>String(item?.id||[item?.createdAt||'',item?.author||'',item?.text||''].join('|'));
const twoYear=year=>String(Number(year)||new Date().getFullYear()).slice(-2).padStart(2,'0');
const taskLabel=t=>{
  const n=Number(t?.taskNumber);
  return Number.isInteger(n)&&n>0?`Z-${String(n).padStart(3,'0')}/${twoYear(t?.taskYear)}`:'zadanie';
};
const projectLabel=p=>{
  const n=Number(p?.projectNumber);
  return Number.isInteger(n)&&n>0?`P-${String(n).padStart(3,'0')}/${twoYear(p?.projectYear)}`:'projekt';
};
const unique=values=>[...new Set(values.filter(Boolean))];

function projectRecipients(project,actorEmail){
  const names=[project?.owner,...(Array.isArray(project?.members)?project.members:[])];
  return unique(names.map(emailForPerson)).filter(email=>email&&email!==String(actorEmail||'').toLowerCase());
}

function buildPushEvents(previous,next,user){
  const events=[];
  const actorEmail=String(user?.email||'').toLowerCase();
  const actorName=displayNameForEmail(actorEmail);

  const previousGlobal=new Map((previous?.tasks||[]).map(t=>[itemKey(t),t]));
  for(const task of next?.tasks||[]){
    const old=previousGlobal.get(itemKey(task));
    if((!old||old.assignee!==task.assignee)&&task.assignee){
      const target=emailForPerson(task.assignee);
      if(target&&target!==actorEmail){
        events.push({
          email:target,type:'assignment',
          payload:{
            title:'Nowe zadanie — PEREKO',
            body:`${actorName} przypisał(a) Ci ${taskLabel(task)}: ${task.text||'Bez nazwy'}`,
            icon:'/icons/pereko-marketing-v3-192.png',badge:'/icons/badge-96.png',
            tag:'assignment-'+itemKey(task),url:'/?search=1',badgeCount:1
          }
        });
      }
    }
  }

  const previousProjects=new Map((previous?.projects||[]).map(p=>[String(p.id),p]));
  for(const project of next?.projects||[]){
    const oldProject=previousProjects.get(String(project.id))||{projectTasks:[],comments:[]};
    const oldTasks=new Map((oldProject.projectTasks||[]).map(t=>[itemKey(t),t]));
    const recipients=projectRecipients(project,actorEmail);

    for(const task of project.projectTasks||[]){
      const old=oldTasks.get(itemKey(task));

      if((!old||old.assignee!==task.assignee)&&task.assignee){
        const target=emailForPerson(task.assignee);
        if(target&&target!==actorEmail){
          events.push({
            email:target,type:'assignment',
            payload:{
              title:'Nowe zadanie w projekcie',
              body:`${actorName} przypisał(a) Ci ${taskLabel(task)} w ${projectLabel(project)}: ${task.text||'Bez nazwy'}`,
              icon:'/icons/pereko-marketing-v3-192.png',badge:'/icons/badge-96.png',
              tag:'assignment-'+itemKey(task),
              url:`/?projectId=${encodeURIComponent(project.id)}&taskId=${encodeURIComponent(task.id||'')}`,
              projectId:project.id,taskId:task.id||null,badgeCount:1
            }
          });
        }
      }

      if(old&&!old.done&&task.done){
        for(const email of recipients){
          events.push({
            email,type:'taskDone',
            payload:{
              title:'Zadanie zakończone',
              body:`${actorName} zakończył(a) ${taskLabel(task)} w ${projectLabel(project)}: ${task.text||'Bez nazwy'}`,
              icon:'/icons/pereko-marketing-v3-192.png',badge:'/icons/badge-96.png',
              tag:'done-'+itemKey(task),
              url:`/?projectId=${encodeURIComponent(project.id)}&taskId=${encodeURIComponent(task.id||'')}`,
              projectId:project.id,taskId:task.id||null,badgeCount:1
            }
          });
        }
      }
    }

    const oldComments=new Set((oldProject.comments||[]).map(commentKey));
    const added=(project.comments||[]).filter(c=>!oldComments.has(commentKey(c)));
    for(const comment of added){
      for(const email of recipients){
        events.push({
          email,type:'comments',
          payload:{
            title:'Nowy komentarz w projekcie',
            body:`${comment.author||actorName} dodał(a) komentarz w ${projectLabel(project)}: ${String(comment.text||'').slice(0,120)}`,
            icon:'/icons/pereko-marketing-v3-192.png',badge:'/icons/badge-96.png',
            tag:'comment-'+commentKey(comment),
            url:`/?projectId=${encodeURIComponent(project.id)}`,
            projectId:project.id,badgeCount:1
          }
        });
      }
    }
  }

  const dedupe=new Map();
  for(const event of events){
    const key=[event.email,event.type,event.payload.tag].join('|');
    dedupe.set(key,event);
  }
  return [...dedupe.values()];
}

async function dispatchPushEvents(context,events){
  if(!events.length)return;
  const job=Promise.allSettled(events.map(event=>sendUserNotification(context.env,event.email,event.payload,event.type)));
  if(typeof context.waitUntil==='function')context.waitUntil(job);
  else await job;
}

export async function onRequestGet(context) {
  try {
    const user = await requireUser(context.request);
    if (!user) return Response.json({ error: 'Brak autoryzacji' }, { status: 401 });
    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      const authorization = context.request.headers.get('Authorization') || '';
      const response = await fetch(PRODUCTION_DASHBOARD_API, {
        headers: { 'Authorization': authorization, 'Cache-Control': 'no-store' }
      });
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }
    const file = await getCurrentFile(token);
    const data = JSON.parse(decodeBase64Utf8(file.content));
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  try {
    const user = await requireUser(context.request);
    if (!user) return Response.json({ error: 'Brak autoryzacji' }, { status: 401 });
    const token = context.env.GITHUB_TOKEN;
    if (!token) {
      const authorization = context.request.headers.get('Authorization') || '';
      const rawBody = await context.request.text();
      const response = await fetch(PRODUCTION_DASHBOARD_API, {
        method: 'PUT',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        },
        body: rawBody
      });
      const responseBody = await response.text();
      return new Response(responseBody, {
        status: response.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    const body = await context.request.json();
    if (!Array.isArray(body.projects) || !Array.isArray(body.tasks)) {
      return Response.json({ error: 'Nieprawidłowy format danych' }, { status: 400 });
    }

    const current = await getCurrentFile(token);
    let previous={projects:[],tasks:[]};
    try{previous=JSON.parse(decodeBase64Utf8(current.content))}catch{}
    const payload = {
      projects: body.projects,
      tasks: body.tasks,
      updatedAt: new Date().toISOString()
    };

    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Aktualizacja danych z dashboardu marketingowego',
        content: encodeBase64Utf8(JSON.stringify(payload, null, 2) + '\n'),
        sha: current.sha,
        branch: BRANCH
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`GitHub PUT failed: ${response.status} ${details}`);
    }

    try{
      const events=buildPushEvents(previous,payload,user);
      await dispatchPushEvents(context,events);
    }catch{}

    return Response.json({ ok: true, ...payload }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
