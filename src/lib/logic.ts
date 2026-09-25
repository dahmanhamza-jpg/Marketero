import type { CalendarEvent, Client, Payment, Script, Task } from '../types/models';

const DAY=86400000;
export function dateOnly(value:Date|string){const d=typeof value==='string'?new Date(value):new Date(value);const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
export function localDate(value:string){if(/^\d{4}-\d{2}-\d{2}$/.test(value)){const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d);}return new Date(value);}
export function addMonthsClamped(input:Date,months:number){const d=new Date(input);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d;}
export function firstClientDeadline(startDate:string){const start=localDate(startDate);const d=addMonthsClamped(start,1);d.setDate(d.getDate()+7);return d;}
export function clientDeadlineForCycle(client:Client,cycle:number){if(!client.startDate)return null;return addMonthsClamped(firstClientDeadline(client.startDate),Math.max(0,cycle));}
export function nextClientDeadline(client:Client,from=new Date()){if(!client.startDate)return null;let d=firstClientDeadline(client.startDate);let guard=0;const today=new Date(from.getFullYear(),from.getMonth(),from.getDate());while(d<today&&guard<240){d=addMonthsClamped(d,1);guard++;}return d;}
export function clientDeadlinesBetween(client:Client,start:Date,end:Date){if(!client.startDate)return [] as Date[];const out:Date[]=[];let d=firstClientDeadline(client.startDate);let guard=0;while(d<start&&guard<240){d=addMonthsClamped(d,1);guard++;}while(d<=end&&guard<260){out.push(new Date(d));d=addMonthsClamped(d,1);guard++;}return out;}
export function daysUntil(date:Date,from=new Date()){const a=new Date(from.getFullYear(),from.getMonth(),from.getDate()).getTime();const b=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();return Math.round((b-a)/DAY);}
export function clientDeadlineAlerts(clients:Client[],events:CalendarEvent[],from=new Date()){
 return clients.filter(c=>!c.deletedAt&&c.startDate).map(client=>{
  const deadline=nextClientDeadline(client,from);if(!deadline)return null;const remaining=daysUntil(deadline,from);if(![10,7,3,0].includes(remaining))return null;
  const nextMonth=new Date(deadline);nextMonth.setMonth(nextMonth.getMonth()+1);
  const hasRecording=events.some(e=>!e.deletedAt&&e.clientId===client.id&&/registr/i.test(`${e.category} ${e.title}`)&&localDate(e.startAt)>from&&localDate(e.startAt)<=nextMonth);
  if(hasRecording&&remaining!==0)return null;
  return {client,deadline,days:remaining,message:remaining===0?`Oggi termina il ciclo contenuti di ${client.name}. Verifica consegna e pianifica il mese successivo.`:`Tra ${remaining} giorni termina il ciclo contenuti di ${client.name}. È il momento di programmare la registrazione dei contenuti del prossimo mese.`};
 }).filter(Boolean) as {client:Client;deadline:Date;days:number;message:string}[];
}
export function overlaps(a:{startAt:string;endAt?:string},b:{startAt:string;endAt?:string}){const aStart=localDate(a.startAt).getTime();const bStart=localDate(b.startAt).getTime();const aEnd=a.endAt?localDate(a.endAt).getTime():aStart+3600000;const bEnd=b.endAt?localDate(b.endAt).getTime():bStart+3600000;return aStart<bEnd&&bStart<aEnd;}
export function getConflicts(candidate:CalendarEvent,events:CalendarEvent[]){if(candidate.allDay)return [];return events.filter(e=>e.id!==candidate.id&&!e.deletedAt&&!e.allDay&&overlaps(candidate,e));}
export function taskScore(t:Task,nowDate=new Date()){if(t.completed)return -9999;let s=0;if(t.urgent)s+=120;if(t.dueAt){const diff=(localDate(t.dueAt).getTime()-nowDate.getTime())/3600000;if(diff<0)s+=150;else if(diff<6)s+=100;else if(diff<24)s+=70;else if(diff<72)s+=25;}if(t.stage==='Script')s+=18;if(t.stage==='Registrazione')s+=15;if(t.stage==='Montaggio')s+=12;return s;}
export function nextTask(tasks:Task[],freeMinutes=240){return tasks.filter(t=>!t.completed&&!t.deletedAt&&t.durationMin<=freeMinutes).sort((a,b)=>taskScore(b)-taskScore(a))[0];}
export function paymentStatus(p:Payment){if(p.paidAt)return 'Pagato';return localDate(p.dueDate)<new Date()?'Scaduto':'In attesa';}
export function clientHealth(client:Client,payments:Payment[],scripts:Script[]){const p=payments.filter(x=>x.clientId===client.id&&!x.deletedAt);if(p.some(x=>paymentStatus(x)==='Scaduto'))return {state:'Critico' as const,reason:'Pagamento scaduto'};const deadline=nextClientDeadline(client);if(deadline&&daysUntil(deadline)<=7)return {state:'Attenzione' as const,reason:`Ciclo in scadenza tra ${Math.max(0,daysUntil(deadline))} giorni`};const sc=scripts.filter(x=>x.clientId===client.id&&!x.deletedAt);if(sc.length&&sc.filter(x=>x.status==='Pronto').length<Math.min(client.contentTarget,sc.length))return {state:'Attenzione' as const,reason:'Script ancora da completare'};return {state:'Regolare' as const,reason:'Tutto sotto controllo'};}
export function freeMinutesUntil(events:CalendarEvent[],at=new Date()){const future=events.filter(e=>!e.allDay&&localDate(e.startAt)>at&&!e.deletedAt).sort((a,b)=>+localDate(a.startAt)-+localDate(b.startAt))[0];return future?Math.max(0,Math.floor((+localDate(future.startAt)-+at)/60000)):240;}
export function greetingForHour(hour=new Date().getHours()){if(hour<12)return 'Buongiorno';if(hour<18)return 'Buon pomeriggio';return 'Buonasera';}
