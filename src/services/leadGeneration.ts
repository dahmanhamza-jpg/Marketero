import { db, now, uid } from '../lib/db';
import { queueSync } from './sync';
import type { Lead } from '../types/models';

export type LeadDiscoveryResponse={configured:boolean;provider?:string;message?:string;error?:string;checkedAt?:string;leads?:Partial<Lead>[];partialErrors?:number};

function normalize(value=''){return value.toLowerCase().replace(/\s+/g,' ').trim();}
function fingerprint(lead:Partial<Lead>){return lead.externalId||lead.fingerprint||[normalize(lead.businessName||lead.name||''),normalize(lead.address||''),normalize(lead.mobile||lead.phone||''),normalize(lead.website||'')].join('|');}

export async function discoverLeads(radiusKm=30):Promise<{response:LeadDiscoveryResponse;created:number;updated:number}> {
  const r=await fetch(`/api/lead-generation/search?radius=${Math.max(1,Math.min(30,radiusKm))}`);
  const response:LeadDiscoveryResponse=await r.json().catch(()=>({configured:false,message:'Risposta provider non valida'}));
  if(!r.ok)throw new Error(response.error||response.message||`Ricerca non riuscita (${r.status})`);
  if(!response.configured||!response.leads?.length)return {response,created:0,updated:0};
  const existing=await db.leads.toArray();
  let created=0,updated=0;const t=now();
  for(const incoming of response.leads){
    const fp=fingerprint(incoming);
    const old=existing.find(x=>x.externalId&&x.externalId===incoming.externalId)||existing.find(x=>fingerprint(x)===fp);
    if(old){
      const keep={salesStatus:old.salesStatus,statusHistory:old.statusHistory,notes:old.notes,followUpDate:old.followUpDate,followUpNote:old.followUpNote,convertedClientId:old.convertedClientId,createdAt:old.createdAt,discoveredAt:old.discoveredAt||old.createdAt,status:old.status,contacted:old.contacted,outcome:old.outcome,lastContactAt:old.lastContactAt,nextFollowUpAt:old.nextFollowUpAt};
      await db.leads.put({...old,...incoming,...keep,id:old.id,monthlyValue:old.monthlyValue||0,fingerprint:fp,updatedAt:t,lastCheckedAt:incoming.lastCheckedAt||t} as Lead);updated++;
    }else{
      const lead:Lead={id:uid(),name:incoming.businessName||incoming.name||'Attività',businessName:incoming.businessName||incoming.name||'Attività',monthlyValue:0,status:'Da contattare',salesStatus:'Da valutare',statusHistory:[{status:'Da valutare',at:t}],createdAt:t,updatedAt:t,discoveredAt:t,lastCheckedAt:incoming.lastCheckedAt||t,fingerprint:fp,...incoming} as Lead;
      await db.leads.put(lead);created++;
    }
  }
  queueSync();
  return {response,created,updated};
}
