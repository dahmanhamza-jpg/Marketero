import { db, now, uid } from '../lib/db';
import { queueSync } from './sync';
import type { Lead } from '../types/models';

export type LeadDiscoveryResponse={configured:boolean;provider?:string;message?:string;error?:string;checkedAt?:string;leads?:Partial<Lead>[];partialErrors?:number;learningApplied?:boolean;learningSamples?:number};
export type LeadLearningProfile={samples:number;overallRate:number;typeWeights:Record<string,number>;categoryWeights:Record<string,number>;serviceWeights:Record<string,number>};

function normalize(value=''){return value.toLowerCase().replace(/\s+/g,' ').trim();}
function fingerprint(lead:Partial<Lead>){return lead.externalId||lead.fingerprint||[normalize(lead.businessName||lead.name||''),normalize(lead.address||''),normalize(lead.mobile||lead.phone||''),normalize(lead.website||'')].join('|');}
function outcome(lead:Lead){
  const status=lead.salesStatus||(lead.status==='Acquisito'?'Acquisito':lead.status==='Perso'?'Scartato':undefined);
  return status==='Acquisito'?1:status==='Scartato'?0:null;
}
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}
function groupWeights(leads:Lead[],getter:(lead:Lead)=>string|undefined,overall:number){
  const groups=new Map<string,{wins:number,total:number}>();
  for(const lead of leads){
    const result=outcome(lead);const raw=getter(lead);if(result===null||!raw)continue;
    const key=normalize(raw);if(!key)continue;
    const g=groups.get(key)||{wins:0,total:0};g.total++;g.wins+=result;groups.set(key,g);
  }
  const weights:Record<string,number>={};
  for(const [key,g] of groups){
    if(g.total<2)continue;
    const smoothed=(g.wins+overall*3)/(g.total+3);
    const confidence=Math.min(1,g.total/6);
    const bonus=Math.round(clamp((smoothed-overall)*30*confidence,-6,6)*10)/10;
    if(Math.abs(bonus)>=.5)weights[key]=bonus;
  }
  return Object.fromEntries(Object.entries(weights).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,24));
}

export function buildLeadLearningProfile(leads:Lead[]):LeadLearningProfile{
  const labeled=leads.filter(l=>!l.deletedAt&&outcome(l)!==null);
  const wins=labeled.reduce((s,l)=>s+(outcome(l)||0),0);
  const overallRate=(wins+2)/(labeled.length+4);
  if(labeled.length<3)return {samples:labeled.length,overallRate,typeWeights:{},categoryWeights:{},serviceWeights:{}};
  return {
    samples:labeled.length,
    overallRate,
    typeWeights:groupWeights(labeled,l=>l.leadType,overallRate),
    categoryWeights:groupWeights(labeled,l=>l.category,overallRate),
    serviceWeights:groupWeights(labeled,l=>l.recommendedService,overallRate)
  };
}

export async function discoverLeads(radiusKm=30):Promise<{response:LeadDiscoveryResponse;created:number;updated:number}> {
  const existing=await db.leads.toArray();
  const learning=buildLeadLearningProfile(existing);
  const params=new URLSearchParams({radius:String(Math.max(1,Math.min(30,radiusKm)))});
  if(learning.samples>=3)params.set('learning',JSON.stringify(learning));
  const r=await fetch(`/api/lead-generation/search?${params.toString()}`);
  const response:LeadDiscoveryResponse=await r.json().catch(()=>({configured:false,message:'Risposta provider non valida'}));
  if(!r.ok)throw new Error(response.error||response.message||`Ricerca non riuscita (${r.status})`);
  if(!response.configured||!response.leads?.length)return {response,created:0,updated:0};
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
