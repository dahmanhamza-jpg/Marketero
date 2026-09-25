interface Env { DB: D1Database }

async function workspaceFromToken(token:string){
  const bytes=new TextEncoder().encode(token);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)]
    .map(b=>b.toString(16).padStart(2,'0'))
    .join('');
}

const entityNames=[
  'clients',
  'ideas',
  'scripts',
  'tasks',
  'events',
  'leads',
  'payments',
  'followers',
  'strategies'
];

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try{
    const auth=ctx.request.headers.get('authorization')||'';
    const token=auth.startsWith('Bearer ')?auth.slice(7).trim().toLowerCase():'';

    if(!/^[a-f0-9]{64}$/.test(token)){
      return Response.json({error:'Codice sincronizzazione non valido'},{status:401});
    }

    const body:any=await ctx.request.json();

    if(body?.schemaVersion!==1||!body.data){
      return Response.json({error:'Payload di sincronizzazione non valido'},{status:400});
    }

    const workspace=await workspaceFromToken(token);
    const statements:D1PreparedStatement[]=[];

    for(const entity of entityNames){
      for(const record of body.data[entity]||[]){
        if(!record?.id) continue;

        statements.push(
          ctx.env.DB.prepare(
            `INSERT INTO records(workspace,entity,record_id,updated_at,payload)
             VALUES(?,?,?,?,?)
             ON CONFLICT(workspace,entity,record_id)
             DO UPDATE SET
               updated_at=excluded.updated_at,
               payload=excluded.payload
             WHERE excluded.updated_at >= records.updated_at`
          ).bind(
            workspace,
            entity,
            record.id,
            record.updatedAt||new Date().toISOString(),
            JSON.stringify(record)
          )
        );
      }
    }

    // Keep batches small enough for D1 and larger datasets.
    for(let i=0;i<statements.length;i+=50){
      await ctx.env.DB.batch(statements.slice(i,i+50));
    }

    const rows=await ctx.env.DB
      .prepare('SELECT entity,payload FROM records WHERE workspace=?')
      .bind(workspace)
      .all<{entity:string,payload:string}>();

    const data:any={};
    for(const e of entityNames) data[e]=[];

    for(const row of rows.results||[]){
      if(!data[row.entity]) continue;
      try{
        data[row.entity].push(JSON.parse(row.payload));
      }catch{}
    }

    return Response.json({
      schemaVersion:1,
      exportDate:new Date().toISOString(),
      data
    });

  }catch(error:any){
    return Response.json({
      error:error?.message||'Errore interno di sincronizzazione'
    },{status:500});
  }
};
