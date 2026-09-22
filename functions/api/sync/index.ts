interface Env { DB: D1Database }
async function workspaceFromToken(token:string){ const bytes=new TextEncoder().encode(token); const digest=await crypto.subtle.digest('SHA-256',bytes); return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
const entityNames=['clients','ideas','scripts','tasks','events','leads','payments','followers','strategies','settings'];
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth=ctx.request.headers.get('authorization')||''; const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!/^[a-f0-9]{64}$/.test(token)) return new Response('Unauthorized',{status:401});
  const body:any=await ctx.request.json(); if(body?.schemaVersion!==1||!body.data) return new Response('Bad Request',{status:400});
  const workspace=await workspaceFromToken(token);
  const statements=[] as D1PreparedStatement[];
  for(const entity of entityNames){ for(const record of body.data[entity]||[]){ statements.push(ctx.env.DB.prepare(`INSERT INTO records(workspace,entity,record_id,updated_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(workspace,entity,record_id) DO UPDATE SET updated_at=excluded.updated_at,payload=excluded.payload WHERE excluded.updated_at >= records.updated_at`).bind(workspace,entity,record.id,record.updatedAt||new Date().toISOString(),JSON.stringify(record))); }}
  if(statements.length) await ctx.env.DB.batch(statements);
  const rows=await ctx.env.DB.prepare('SELECT entity,payload FROM records WHERE workspace=?').bind(workspace).all<{entity:string,payload:string}>();
  const data:any={}; for(const e of entityNames)data[e]=[]; for(const row of rows.results||[]){ try{data[row.entity].push(JSON.parse(row.payload))}catch{} }
  return Response.json({schemaVersion:1,exportDate:new Date().toISOString(),data});
};
