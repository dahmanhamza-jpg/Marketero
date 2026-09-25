import { db } from '../lib/db';

const entityTables = ['clients','ideas','scripts','tasks','events','leads','payments','followers','strategies'] as const;
const SYNC_CODE_RE=/^[a-f0-9]{64}$/;
let syncing=false;
let queued:number|undefined;

export async function ensureSyncToken(){
  const s=await db.settings.get('settings');
  if(!s) throw new Error('Impostazioni mancanti');
  if(s.syncToken&&SYNC_CODE_RE.test(s.syncToken)) return s.syncToken;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  await db.settings.update('settings',{syncToken:token,updatedAt:new Date().toISOString()});
  return token;
}
export async function getSyncCode(){ return ensureSyncToken(); }
export async function setSyncCode(code:string){
  const clean=code.trim().toLowerCase();
  if(!SYNC_CODE_RE.test(clean)) throw new Error('Codice sincronizzazione non valido. Deve contenere 64 caratteri.');
  const s=await db.settings.get('settings'); if(!s) throw new Error('Impostazioni mancanti');
  await db.settings.update('settings',{syncToken:clean,updatedAt:new Date().toISOString()});
}
export async function exportAll(){
  const out:any={schemaVersion:2,exportDate:new Date().toISOString(),data:{}};
  for(const t of entityTables) out.data[t]=await (db as any)[t].toArray();
  const settings=await db.settings.get('settings');
  out.data.settings=settings?[{...settings,syncToken:undefined}]:[];
  return out;
}
export async function importAll(payload:any){
  if(![1,2].includes(payload?.schemaVersion)||!payload.data) throw new Error('Dati di sincronizzazione non validi');
  for(const t of entityTables) if(Array.isArray(payload.data[t])) await (db as any)[t].bulkPut(payload.data[t]);
  const remote=payload.data.settings?.[0];
  if(remote){
    const local=await db.settings.get('settings');
    if(local) await db.settings.put({...local,...remote,id:'settings',key:'singleton',syncToken:local.syncToken});
  }
}
export async function syncRemote(){
  if(syncing) return {ok:true};
  syncing=true;
  try{
    const token=await ensureSyncToken();
    const payload=await exportAll();
    let r:Response;
    try{
      r=await fetch('/api/sync',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify(payload)});
    }catch{ throw new Error('Nessuna connessione al server di sincronizzazione'); }
    if(!r.ok){ const detail=(await r.text()).trim(); throw new Error(detail?`Sincronizzazione non riuscita (${r.status}): ${detail}`:`Sincronizzazione non riuscita (${r.status})`); }
    const merged=await r.json(); if(merged?.data) await importAll(merged);
    await db.settings.update('settings',{lastSyncAt:new Date().toISOString()});
    return {ok:true};
  }finally{ syncing=false; }
}
export function queueSync(delay=700){
  if(queued) window.clearTimeout(queued);
  queued=window.setTimeout(()=>syncRemote().catch(()=>{}),delay);
}
export async function resetRemote(){
  const token=await ensureSyncToken();
  const r=await fetch('/api/sync',{method:'DELETE',headers:{'authorization':`Bearer ${token}`}});
  if(!r.ok) throw new Error('Reset remoto non riuscito');
}
export function startAutoSync(){
  syncRemote().catch(()=>{});
  const interval=window.setInterval(()=>syncRemote().catch(()=>{}),15000);
  const visibilityHandler=()=>{if(document.visibilityState==='visible')syncRemote().catch(()=>{});};
  const onlineHandler=()=>syncRemote().catch(()=>{});
  document.addEventListener('visibilitychange',visibilityHandler); window.addEventListener('online',onlineHandler);
  return ()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',visibilityHandler);window.removeEventListener('online',onlineHandler);};
}
