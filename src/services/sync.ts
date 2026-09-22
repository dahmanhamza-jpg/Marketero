import { db } from '../lib/db';
const tables=['clients','ideas','scripts','tasks','events','leads','payments','followers','strategies','settings'] as const;
export async function ensureSyncToken(){
  const s=await db.settings.get('settings'); if(!s) throw new Error('Impostazioni mancanti');
  if(s.syncToken) return s.syncToken;
  const bytes=crypto.getRandomValues(new Uint8Array(32)); const token=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  await db.settings.update('settings',{syncToken:token,updatedAt:new Date().toISOString()}); return token;
}
export async function exportAll(){ const out:any={schemaVersion:1,exportDate:new Date().toISOString(),data:{}}; for(const t of tables) out.data[t]=await (db as any)[t].toArray(); return out; }
export async function importAll(payload:any){ if(payload?.schemaVersion!==1||!payload.data) throw new Error('Backup non valido'); for(const t of tables){ if(payload.data[t]) await (db as any)[t].bulkPut(payload.data[t]); } }
export async function syncRemote(){
  const endpoint=import.meta.env.VITE_SYNC_ENDPOINT as string|undefined; if(!endpoint) return {ok:false,message:'Sync remoto non configurato'};
  const token=await ensureSyncToken(); const payload=await exportAll();
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify(payload)});
  if(!r.ok) throw new Error('Sincronizzazione non riuscita'); const merged=await r.json(); if(merged?.data) await importAll(merged); return {ok:true};
}
