import type { CalendarEvent, Client, Payment, Script, Task } from '../types/models';

export function overlaps(a:{startAt:string;endAt:string}, b:{startAt:string;endAt:string}){
  return new Date(a.startAt) < new Date(b.endAt) && new Date(b.startAt) < new Date(a.endAt);
}
export function getConflicts(candidate: CalendarEvent, events: CalendarEvent[]){ return events.filter(e=>e.id!==candidate.id && !e.deletedAt && overlaps(candidate,e)); }
export function taskScore(t:Task, nowDate=new Date()){
  if(t.completed) return -9999; let s=0;
  if(t.urgent) s+=120;
  if(t.dueAt){ const diff=(new Date(t.dueAt).getTime()-nowDate.getTime())/3600000; if(diff<0)s+=150; else if(diff<6)s+=100; else if(diff<24)s+=70; else if(diff<72)s+=25; }
  if(t.stage==='Script') s+=18; if(t.stage==='Registrazione') s+=15; if(t.stage==='Montaggio') s+=12;
  return s;
}
export function nextTask(tasks:Task[], freeMinutes=240, energy:'Bassa'|'Media'|'Alta'='Media'){
  const cap = energy==='Bassa'?60:energy==='Media'?120:240;
  return tasks.filter(t=>!t.completed && !t.deletedAt && t.durationMin<=Math.min(freeMinutes,cap)).sort((a,b)=>taskScore(b)-taskScore(a))[0];
}
export function paymentStatus(p:Payment){ if(p.paidAt)return 'Pagato'; return new Date(p.dueDate)<new Date()?'Scaduto':'In attesa'; }
export function clientHealth(client:Client, payments:Payment[], scripts:Script[]){
  const p=payments.filter(x=>x.clientId===client.id&&!x.deletedAt); if(p.some(x=>paymentStatus(x)==='Scaduto')) return {state:'Critico' as const, reason:'Pagamento scaduto'};
  const sc=scripts.filter(x=>x.clientId===client.id&&!x.deletedAt); if(sc.length && sc.filter(x=>x.status==='Pronto').length<Math.min(client.contentTarget,sc.length)) return {state:'Attenzione' as const,reason:'Script ancora da completare'};
  return {state:'Regolare' as const,reason:'Tutto sotto controllo'};
}
export function freeMinutesUntil(events:CalendarEvent[], at=new Date()){
  const future=events.filter(e=>new Date(e.startAt)>at&&!e.deletedAt).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt))[0];
  return future?Math.max(0,Math.floor((+new Date(future.startAt)-+at)/60000)):240;
}
