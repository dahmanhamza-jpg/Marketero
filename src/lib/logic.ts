import type { CalendarEvent, Client, Payment, Script, Task } from '../types/models';

export function eventEnd(e:{startAt:string;endAt?:string;allDay?:boolean}){
  if(e.endAt) return new Date(e.endAt);
  const d=new Date(e.startAt);
  if(e.allDay) d.setHours(23,59,59,999); else d.setMinutes(d.getMinutes()+60);
  return d;
}
export function overlaps(a:{startAt:string;endAt?:string;allDay?:boolean}, b:{startAt:string;endAt?:string;allDay?:boolean}){
  return new Date(a.startAt) < eventEnd(b) && new Date(b.startAt) < eventEnd(a);
}
export function getConflicts(candidate: CalendarEvent, events: CalendarEvent[]){ return events.filter(e=>e.id!==candidate.id && !e.deletedAt && overlaps(candidate,e)); }
export function taskScore(t:Task, nowDate=new Date()){
  if(t.completed) return -9999; let s=0;
  if(t.urgent) s+=120;
  if(t.dueAt){ const diff=(new Date(t.dueAt).getTime()-nowDate.getTime())/3600000; if(diff<0)s+=150; else if(diff<6)s+=100; else if(diff<24)s+=70; else if(diff<72)s+=25; }
  if(t.stage==='Script') s+=18; if(t.stage==='Registrazione') s+=15; if(t.stage==='Montaggio') s+=12;
  return s;
}
export function nextTask(tasks:Task[], freeMinutes=240){
  return tasks.filter(t=>!t.completed && !t.deletedAt && t.durationMin<=freeMinutes).sort((a,b)=>taskScore(b)-taskScore(a))[0];
}
export function paymentStatus(p:Payment){ if(p.paidAt)return 'Pagato'; return new Date(p.dueDate)<new Date()?'Scaduto':'In attesa'; }
export function clientHealth(client:Client, payments:Payment[], scripts:Script[]){
  const p=payments.filter(x=>x.clientId===client.id&&!x.deletedAt); if(p.some(x=>paymentStatus(x)==='Scaduto')) return {state:'Critico' as const, reason:'Pagamento scaduto'};
  const sc=scripts.filter(x=>x.clientId===client.id&&!x.deletedAt); if(sc.length && sc.filter(x=>x.status==='Pronto').length<Math.min(client.contentTarget,sc.length)) return {state:'Attenzione' as const,reason:'Script ancora da completare'};
  const deadline=nextClientDeadline(client);
  if(deadline){ const d=daysUntil(deadline); if(d<=7 && d>=0) return {state:'Attenzione' as const,reason:`Ciclo contenuti in scadenza tra ${d} giorni`}; }
  return {state:'Regolare' as const,reason:'Tutto sotto controllo'};
}
export function freeMinutesUntil(events:CalendarEvent[], at=new Date()){
  const future=events.filter(e=>new Date(e.startAt)>at&&!e.deletedAt).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt))[0];
  return future?Math.max(0,Math.floor((+new Date(future.startAt)-+at)/60000)):240;
}
export function toDateOnly(d:Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function parseLocalDate(v:string){ const [y,m,d]=v.slice(0,10).split('-').map(Number); return new Date(y,m-1,d); }
export function addMonthsClamped(date:Date,months:number){
  const d=new Date(date); const day=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+months);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(day,last)); return d;
}
export function firstClientDeadline(client:Client){
  if(!client.startDate) return undefined;
  const d=addMonthsClamped(parseLocalDate(client.startDate),1); d.setDate(d.getDate()+7); return d;
}
export function nextClientDeadline(client:Client, from=new Date()){
  const first=firstClientDeadline(client); if(!first) return undefined;
  const target=new Date(from.getFullYear(),from.getMonth(),from.getDate());
  let d=new Date(first); let guard=0;
  while(d<target && guard<120){ d=addMonthsClamped(d,1); guard++; }
  return d;
}
export function clientDeadlinesInRange(client:Client,start:Date,end:Date){
  const first=firstClientDeadline(client); if(!first) return [] as Date[];
  const out:Date[]=[]; let d=new Date(first); let guard=0;
  while(d<start && guard<120){ d=addMonthsClamped(d,1); guard++; }
  while(d<=end && guard<180){ out.push(new Date(d)); d=addMonthsClamped(d,1); guard++; }
  return out;
}
export function daysUntil(date:Date,from=new Date()){
  const a=new Date(from.getFullYear(),from.getMonth(),from.getDate()).getTime();
  const b=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
  return Math.ceil((b-a)/86400000);
}
