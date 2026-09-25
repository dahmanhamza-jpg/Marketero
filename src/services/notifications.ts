import { db } from '../lib/db';
import { clientDeadlineAlerts, localDate } from '../lib/logic';

function supported(){return typeof window!=='undefined'&&'Notification' in window&&'serviceWorker' in navigator;}
export async function requestNotificationPermission(){if(!supported())return 'unsupported' as const;return Notification.requestPermission();}
async function show(title:string,body:string,tag:string){
 if(!supported()||Notification.permission!=='granted')return;
 const day=new Date().toISOString().slice(0,10);const key=`marketero-notify:${day}:${tag}`;
 if(localStorage.getItem(key))return;
 const reg=await navigator.serviceWorker.ready;
 await reg.showNotification(title,{body,tag,icon:'/icon.svg'});
 localStorage.setItem(key,'1');
}
export async function checkNotifications(){
 const settings=await db.settings.get('settings');
 if(!settings?.notificationsEnabled||Notification.permission!=='granted')return;
 const [clients,events]=await Promise.all([db.clients.toArray(),db.events.toArray()]);
 if(settings.notificationDeadlines!==false){
  for(const a of clientDeadlineAlerts(clients,events))await show('Scadenza cliente',a.message,`deadline-${a.client.id}-${a.days}`);
 }
 if(settings.notificationAppointments!==false){
  const now=Date.now();
  for(const e of events.filter(x=>!x.deletedAt&&!x.allDay&&localDate(x.startAt).getTime()>now)){
   const diff=localDate(e.startAt).getTime()-now;
   if(diff<=3600000)await show('Appuntamento tra meno di 1 ora',e.title,`event-1h-${e.id}`);
   else if(diff<=86400000)await show('Appuntamento nelle prossime 24 ore',e.title,`event-24h-${e.id}`);
  }
 }
}
export function startNotificationChecks(){
 checkNotifications().catch(()=>{});
 const interval=window.setInterval(()=>checkNotifications().catch(()=>{}),30*60*1000);
 const foreground=()=>{if(document.visibilityState==='visible')checkNotifications().catch(()=>{})};
 document.addEventListener('visibilitychange',foreground);
 return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',foreground)};
}
