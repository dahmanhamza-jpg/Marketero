import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, Check, ChevronRight, CircleDollarSign, Cloud, CloudOff, RefreshCw, Search, Sparkles, Target, UserRound, X } from 'lucide-react';
import { db, now } from '../lib/db';
import { daysUntil, nextClientDeadline, paymentStatus, toDateOnly } from '../lib/logic';
import { workflowSummary } from '../lib/workflow';
import { queueSync } from '../services/sync';
import type { CalendarEvent, Client, Lead, Payment, Script, Settings } from '../types/models';
import { EnhancedCalendar } from '../features/EnhancedCalendar';

type SyncState='idle'|'syncing'|'synced'|'offline'|'error';
type Reminder={id:string;title:string;text:string;route:string;level:'normal'|'important'|'urgent'};
type SearchItem={id:string;kind:string;title:string;subtitle:string;route:string;keywords:string};

const monthKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const money=(n:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const norm=(v:string)=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

export function SmartLayer(){
  const location=useLocation();
  const navigate=useNavigate();
  const settings=useLiveQuery(()=>db.settings.get('settings'),[]);
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const tasks=useLiveQuery(()=>db.tasks.toArray(),[])||[];
  const scripts=useLiveQuery(()=>db.scripts.toArray(),[])||[];
  const events=useLiveQuery(()=>db.events.toArray(),[])||[];
  const payments=useLiveQuery(()=>db.payments.toArray(),[])||[];
  const ideas=useLiveQuery(()=>db.ideas.toArray(),[])||[];
  const leads=useLiveQuery(()=>db.leads.toArray(),[])||[];
  const [syncState,setSyncState]=useState<SyncState>(()=>navigator.onLine?'idle':'offline');
  const [searchOpen,setSearchOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [remindersOpen,setRemindersOpen]=useState(false);
  const [assistantOpen,setAssistantOpen]=useState(false);
  const [goalDismissed,setGoalDismissed]=useState(false);

  useEffect(()=>{
    const onSync=(e:Event)=>{const detail=(e as CustomEvent<{state:SyncState}>).detail;if(detail?.state)setSyncState(detail.state)};
    const online=()=>setSyncState('syncing');
    const offline=()=>setSyncState('offline');
    window.addEventListener('marketero:sync',onSync as EventListener);
    window.addEventListener('online',online);window.addEventListener('offline',offline);
    return()=>{window.removeEventListener('marketero:sync',onSync as EventListener);window.removeEventListener('online',online);window.removeEventListener('offline',offline)};
  },[]);

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null;
      const typing=target?.matches('input,textarea,select,[contenteditable="true"]');
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true);return;}
      if(e.key==='/'&&!typing){e.preventDefault();setSearchOpen(true);}
      if(e.key==='Escape'){setSearchOpen(false);setRemindersOpen(false);setAssistantOpen(false);}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);

  const activeClients=clients.filter(c=>!c.deletedAt);
  const activeEvents=events.filter(e=>!e.deletedAt);
  const activePayments=payments.filter(p=>!p.deletedAt);
  const activeLeads=leads.filter(l=>!l.deletedAt);

  const reminders=useMemo(()=>buildReminders(settings,activeClients,scripts,activeEvents,activePayments,activeLeads),[settings,activeClients,scripts,activeEvents,activePayments,activeLeads]);
  const assistant=useMemo(()=>buildAssistantInsight(activeClients,scripts,activeEvents,activePayments),[activeClients,scripts,activeEvents,activePayments]);
  const searchItems=useMemo<SearchItem[]>(()=>{
    const clientName=(id?:string)=>activeClients.find(c=>c.id===id)?.name||'';
    return [
      ...activeClients.map(c=>({id:'c:'+c.id,kind:'Cliente',title:c.name,subtitle:c.niche||'Cliente',route:'/clienti/'+c.id,keywords:[c.name,c.niche,c.description||''].join(' ')})),
      ...tasks.filter(x=>!x.deletedAt).map(t=>({id:'t:'+t.id,kind:'Task',title:t.title,subtitle:[clientName(t.clientId),t.stage,t.dueAt?`Scadenza ${new Date(t.dueAt).toLocaleDateString('it-IT')}`:''].filter(Boolean).join(' · '),route:'/focus?task='+t.id+'&label='+encodeURIComponent(t.title),keywords:[t.title,clientName(t.clientId),t.stage||'',t.notes||''].join(' ')})),
      ...scripts.filter(x=>!x.deletedAt).map(s=>({id:'s:'+s.id,kind:'Script',title:s.title,subtitle:[clientName(s.clientId),s.status,s.platform].filter(Boolean).join(' · '),route:'/clienti/'+s.clientId,keywords:[s.title,clientName(s.clientId),s.body||'',s.hook||'',s.cta||''].join(' ')})),
      ...activeEvents.map(e=>({id:'e:'+e.id,kind:'Appuntamento',title:e.title,subtitle:[clientName(e.clientId),new Date(e.startAt).toLocaleString('it-IT',{day:'2-digit',month:'short',hour:e.allDay?undefined:'2-digit',minute:e.allDay?undefined:'2-digit'}),e.kind].filter(Boolean).join(' · '),route:'/calendario?date='+toDateOnly(new Date(e.startAt)),keywords:[e.title,clientName(e.clientId),e.category,e.kind,e.notes||''].join(' ')})),
      ...activePayments.map(p=>({id:'p:'+p.id,kind:'Pagamento',title:clientName(p.clientId)||'Pagamento',subtitle:`${paymentStatus(p)} · ${new Date(p.dueDate).toLocaleDateString('it-IT')}`,route:'/pagamenti',keywords:[clientName(p.clientId),p.note||'',paymentStatus(p)].join(' ')})),
      ...ideas.filter(x=>!x.deletedAt).map(i=>({id:'i:'+i.id,kind:'Idea',title:i.title,subtitle:[clientName(i.clientId),i.platform,i.format].filter(Boolean).join(' · '),route:i.clientId?'/clienti/'+i.clientId:'/',keywords:[i.title,i.note||'',clientName(i.clientId),i.platform,i.format].join(' ')}))
    ];
  },[activeClients,tasks,scripts,activeEvents,activePayments,ideas]);

  const results=useMemo(()=>{
    const q=norm(query);
    if(!q)return searchItems.slice(0,12);
    const parts=q.split(/\s+/).filter(Boolean);
    return searchItems.map(item=>{const hay=norm(`${item.title} ${item.subtitle} ${item.kind} ${item.keywords}`);const score=parts.reduce((s,p)=>s+(hay.includes(p)?1:0),0)+(norm(item.title).startsWith(q)?2:0);return {item,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,20).map(x=>x.item);
  },[query,searchItems]);

  useEffect(()=>{
    if(!settings?.notificationsEnabled||!('Notification' in window)||Notification.permission!=='granted')return;
    const today=toDateOnly(new Date());
    for(const r of reminders.filter(x=>x.level!=='normal').slice(0,3)){
      const key=`marketero:notify:${today}:${r.id}`;
      try{if(localStorage.getItem(key))continue;new Notification(r.title,{body:r.text,tag:r.id});localStorage.setItem(key,'1')}catch{}
    }
  },[reminders,settings?.notificationsEnabled]);

  const currentMonth=monthKey();
  const needsGoal=!!settings?.onboardingComplete&&!!settings.monthlyGoalMonth&&settings.monthlyGoalMonth!==currentMonth&&!goalDismissed;
  const showOnboarding=!!settings&&settings.onboardingComplete!==true;

  function openResult(item:SearchItem){setSearchOpen(false);setQuery('');navigate(item.route);window.scrollTo({top:0,behavior:'auto'});}

  return <>
    {location.pathname==='/calendario'&&createPortal(<EnhancedCalendar/>,document.body)}

    <div className="smart-tools" aria-label="Strumenti rapidi">
      <button className="smart-search-trigger" onClick={()=>setSearchOpen(true)} aria-label="Ricerca globale"><Search/></button>
      <button className={'smart-reminder-trigger '+(reminders.length?'has-items':'')} onClick={()=>setRemindersOpen(true)} aria-label={`${reminders.length} promemoria`}><Bell/>{reminders.length>0&&<span>{Math.min(9,reminders.length)}</span>}</button>
      <SyncPill state={syncState} lastSyncAt={settings?.lastSyncAt}/>
    </div>

    {location.pathname==='/'&&assistant&&<button className="smart-insight-pill" onClick={()=>setAssistantOpen(true)}><Sparkles/><span><b>Marketero suggerisce</b><small>{assistant.short}</small></span><ChevronRight/></button>}

    {searchOpen&&createPortal(<SearchOverlay query={query} setQuery={setQuery} results={results} close={()=>{setSearchOpen(false);setQuery('')}} openResult={openResult}/>,document.body)}
    {remindersOpen&&createPortal(<ReminderPanel reminders={reminders} close={()=>setRemindersOpen(false)} go={route=>{setRemindersOpen(false);navigate(route)}}/>,document.body)}
    {assistantOpen&&assistant&&createPortal(<AssistantPanel insight={assistant} settings={settings} payments={activePayments} close={()=>setAssistantOpen(false)}/>,document.body)}
    {showOnboarding&&createPortal(<Onboarding settings={settings} close={()=>{}}/>,document.body)}
    {needsGoal&&createPortal(<MonthlyGoalPrompt settings={settings!} payments={activePayments} close={()=>setGoalDismissed(true)}/>,document.body)}
  </>;
}

function SyncPill({state,lastSyncAt}:{state:SyncState;lastSyncAt?:string}){
  const effective=!navigator.onLine?'offline':state;
  const cfg=effective==='syncing'?{label:'Sincronizzazione…',icon:<RefreshCw className="spin"/>}:effective==='offline'?{label:'Offline',icon:<CloudOff/>}:effective==='error'?{label:'Sync da verificare',icon:<CloudOff/>}:{label:'Sincronizzato',icon:<Check/>};
  return <span className={'smart-sync '+effective} title={lastSyncAt?`Ultimo sync ${new Date(lastSyncAt).toLocaleString('it-IT')}`:cfg.label}>{cfg.icon}<span>{cfg.label}</span></span>;
}

function SearchOverlay({query,setQuery,results,close,openResult}:{query:string;setQuery:(v:string)=>void;results:SearchItem[];close:()=>void;openResult:(v:SearchItem)=>void}){
  return <div className="smart-overlay search-overlay" onClick={close}><section className="spotlight" onClick={e=>e.stopPropagation()}>
    <div className="spotlight-input"><Search/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca cliente, task, script, appuntamento…"/><button onClick={close}><X/></button></div>
    <div className="spotlight-results">{results.map(r=><button key={r.id} onClick={()=>openResult(r)}><span className="spotlight-kind">{r.kind}</span><span><b>{r.title}</b><small>{r.subtitle||'Apri'}</small></span><ChevronRight/></button>)}{!results.length&&<div className="smart-empty"><Search/><b>Nessun risultato</b><span>Prova con un altro nome o termine.</span></div>}</div>
    <footer><span>⌘/Ctrl + K</span><span>Ricerca in tutto Marketero</span></footer>
  </section></div>;
}

function ReminderPanel({reminders,close,go}:{reminders:Reminder[];close:()=>void;go:(route:string)=>void}){
  return <div className="smart-overlay" onClick={close}><section className="smart-panel" onClick={e=>e.stopPropagation()}>
    <header><div><span className="eyebrow">PROMEMORIA UTILI</span><h2>Cosa richiede attenzione</h2></div><button className="smart-close" onClick={close}><X/></button></header>
    <div className="smart-reminder-list">{reminders.map(r=><button key={r.id} className={r.level} onClick={()=>go(r.route)}><span className="smart-reminder-dot"/><span><b>{r.title}</b><small>{r.text}</small></span><ChevronRight/></button>)}{!reminders.length&&<div className="smart-empty"><Check/><b>Tutto sotto controllo</b><span>Nessun promemoria importante in questo momento.</span></div>}</div>
  </section></div>;
}

function AssistantPanel({insight,settings,payments,close}:{insight:ReturnType<typeof buildAssistantInsight>;settings?:Settings;payments:Payment[];close:()=>void}){
  if(!insight)return null;
  const current=monthKey();
  const actual=payments.filter(p=>p.paidAt&&p.paidAt.slice(0,7)===current).reduce((s,p)=>s+p.amount,0);
  const goal=settings?.monthlyRevenueGoal||0;
  const percent=goal?Math.min(999,Math.round(actual/goal*100)):0;
  const history=(settings?.monthlyGoalHistory||[]).slice(-6).reverse();
  return <div className="smart-overlay" onClick={close}><section className="smart-panel assistant-panel" onClick={e=>e.stopPropagation()}>
    <header><div><span className="eyebrow">ASSISTENTE OPERATIVO</span><h2>Marketero interpreta i dati</h2></div><button className="smart-close" onClick={close}><X/></button></header>
    <div className="assistant-hero"><Sparkles/><div><b>{insight.title}</b><p>{insight.text}</p></div></div>
    <div className="goal-progress"><div><span>Obiettivo del mese</span><b>{money(actual)} / {money(goal)}</b></div><strong>{percent}%</strong><div className="goal-bar"><span style={{width:`${Math.min(100,percent)}%`}}/></div></div>
    {history.length>0&&<div className="goal-history"><span className="eyebrow">ULTIMI MESI</span>{history.map(h=><div key={h.month}><span>{new Date(h.month+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'})}</span><b>{h.percent}%</b><small>{money(h.actual)} / {money(h.goal)}</small></div>)}</div>}
  </section></div>;
}

function Onboarding({settings}:{settings:Settings;close:()=>void}){
  const [step,setStep]=useState(1);
  const [name,setName]=useState(settings.profileName||'');
  const [goal,setGoal]=useState(String(settings.monthlyRevenueGoal||5000));
  const [clientGoal,setClientGoal]=useState(String(settings.clientGoal||10));
  const [workDays,setWorkDays]=useState<number[]>(settings.workDays||[1,2,3,4,5]);
  const [notifications,setNotifications]=useState(settings.notificationsEnabled!==false);
  const days=[['Lun',1],['Mar',2],['Mer',3],['Gio',4],['Ven',5],['Sab',6],['Dom',0]] as const;
  const toggle=(d:number)=>setWorkDays(v=>v.includes(d)?v.filter(x=>x!==d):[...v,d]);
  async function finish(){
    if(notifications&&'Notification' in window&&Notification.permission==='default'){try{await Notification.requestPermission()}catch{}}
    await db.settings.update('settings',{profileName:name.trim(),monthlyRevenueGoal:Number(goal||0),clientGoal:Number(clientGoal||0),workDays,notificationsEnabled:notifications,appointmentReminders:notifications,clientReminders:notifications,paymentReminders:notifications,followUpReminders:notifications,smartReminders:true,onboardingComplete:true,monthlyGoalMonth:monthKey(),monthlyGoalHistory:settings.monthlyGoalHistory||[],updatedAt:now()});
    queueSync();
  }
  return <div className="smart-overlay onboarding-overlay"><section className="onboarding-card">
    <div className="onboarding-brand"><span>M</span><div><b>Marketero</b><small>Configurazione iniziale · {step}/3</small></div></div>
    <div className="onboarding-progress"><span style={{width:`${step/3*100}%`}}/></div>
    {step===1&&<div className="onboarding-step"><span className="eyebrow">IL TUO SPAZIO</span><h1>Partiamo da te.</h1><p>Marketero userà queste informazioni per rendere le priorità più utili.</p><label>Come ti chiami?<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Nome"/></label></div>}
    {step===2&&<div className="onboarding-step"><span className="eyebrow">OBIETTIVI</span><h1>Cosa vuoi raggiungere?</h1><p>A fine mese Marketero calcolerà la percentuale raggiunta e ti chiederà il nuovo obiettivo.</p><label>Obiettivo entrate mensile (€)<input type="number" inputMode="decimal" value={goal} onChange={e=>setGoal(e.target.value)}/></label><label>Numero clienti obiettivo<input type="number" inputMode="numeric" value={clientGoal} onChange={e=>setClientGoal(e.target.value)}/></label></div>}
    {step===3&&<div className="onboarding-step"><span className="eyebrow">RITMO DI LAVORO</span><h1>Quando lavori?</h1><p>Serve per evitare suggerimenti inutili nei giorni in cui normalmente non lavori.</p><div className="work-days">{days.map(([label,d])=><button key={d} className={workDays.includes(d)?'active':''} onClick={()=>toggle(d)}>{label}</button>)}</div><label className="notification-choice"><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)}/><span><b>Notifiche utili</b><small>Appuntamenti, pagamenti, follow-up e clienti da recuperare. Niente spam.</small></span></label></div>}
    <div className="onboarding-actions">{step>1?<button className="btn ghost" onClick={()=>setStep(s=>s-1)}>Indietro</button>:<span/>}{step<3?<button className="btn primary" disabled={step===1&&!name.trim()} onClick={()=>setStep(s=>s+1)}>Continua</button>:<button className="btn primary" disabled={!workDays.length} onClick={finish}>Inizia a usare Marketero</button>}</div>
  </section></div>;
}

function MonthlyGoalPrompt({settings,payments,close}:{settings:Settings;payments:Payment[];close:()=>void}){
  const [goal,setGoal]=useState(String(settings.monthlyRevenueGoal||0));
  const previous=settings.monthlyGoalMonth||monthKey(new Date(new Date().getFullYear(),new Date().getMonth()-1,1));
  const actual=payments.filter(p=>p.paidAt&&p.paidAt.slice(0,7)===previous).reduce((s,p)=>s+p.amount,0);
  const oldGoal=settings.monthlyRevenueGoal||0;
  const percent=oldGoal?Math.round(actual/oldGoal*100):0;
  async function save(){
    const history=[...(settings.monthlyGoalHistory||[])];
    if(!history.some(h=>h.month===previous))history.push({month:previous,goal:oldGoal,actual,percent});
    await db.settings.update('settings',{monthlyGoalHistory:history.slice(-24),monthlyRevenueGoal:Number(goal||0),monthlyGoalMonth:monthKey(),updatedAt:now()});queueSync();close();
  }
  return <div className="smart-overlay goal-prompt-overlay" onClick={close}><section className="goal-prompt" onClick={e=>e.stopPropagation()}>
    <div className="goal-prompt-icon"><Target/></div><span className="eyebrow">NUOVO MESE</span><h2>Com’è andato {new Date(previous+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long'})}?</h2><div className="goal-result"><strong>{percent}%</strong><span>{money(actual)} raggiunti su {money(oldGoal)}</span></div><p>Imposta ora l’obiettivo entrate per questo mese. Lo confronteremo automaticamente a fine mese.</p><label>Nuovo obiettivo (€)<input autoFocus type="number" inputMode="decimal" value={goal} onChange={e=>setGoal(e.target.value)}/></label><div className="goal-actions"><button className="btn ghost" onClick={close}>Più tardi</button><button className="btn primary" onClick={save}>Salva obiettivo</button></div>
  </section></div>;
}

function buildReminders(settings:Settings|undefined,clients:Client[],scripts:Script[],events:CalendarEvent[],payments:Payment[],leads:Lead[]):Reminder[]{
  if(!settings?.smartReminders&&settings?.smartReminders!==undefined)return [];
  const out:Reminder[]=[];const nowDate=new Date();const in60=new Date(+nowDate+60*60*1000);const today=toDateOnly(nowDate);
  if(settings?.appointmentReminders!==false){
    events.filter(e=>!e.deletedAt&&!e.allDay&&new Date(e.startAt)>=nowDate&&new Date(e.startAt)<=in60).forEach(e=>out.push({id:'event:'+e.id,title:'Appuntamento vicino',text:`${e.title} · ${new Date(e.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`,route:'/calendario?date='+toDateOnly(new Date(e.startAt)),level:'important'}));
  }
  if(settings?.paymentReminders!==false){
    payments.filter(p=>!p.deletedAt&&!p.paidAt&&p.dueDate<today).slice(0,3).forEach(p=>{const c=clients.find(x=>x.id===p.clientId);out.push({id:'pay:'+p.id,title:'Pagamento scaduto',text:`${c?.name||'Cliente'} · scadenza ${new Date(p.dueDate+'T12:00:00').toLocaleDateString('it-IT')}`,route:'/pagamenti',level:'urgent'})});
  }
  if(settings?.followUpReminders!==false){
    leads.filter(l=>!l.deletedAt&&l.nextFollowUpAt&&new Date(l.nextFollowUpAt)<=new Date(nowDate.getFullYear(),nowDate.getMonth(),nowDate.getDate(),23,59,59)&&!['Acquisito','Perso'].includes(l.status)).slice(0,3).forEach(l=>out.push({id:'lead:'+l.id,title:'Follow-up da fare',text:l.name,route:'/clienti',level:'important'}));
  }
  if(settings?.clientReminders!==false){
    for(const c of clients.filter(x=>!x.deletedAt)){
      const deadline=nextClientDeadline(c);if(!deadline)continue;const left=daysUntil(deadline);const summary=workflowSummary(scripts.filter(s=>s.clientId===c.id));
      if(left<=3&&summary.total>0&&summary.progress<75)out.push({id:'late:'+c.id,title:'Cliente da recuperare',text:`${c.name}: ${summary.progress}% del workflow, scadenza tra ${Math.max(0,left)} giorni.`,route:'/clienti/'+c.id,level:left<=0?'urgent':'important'});
      const upcomingRecording=events.some(e=>e.clientId===c.id&&!e.deletedAt&&e.kind==='Lavoro'&&e.category.toLowerCase().includes('registr')&&new Date(e.startAt)>=nowDate&&new Date(e.startAt)<=deadline);
      if(left>=0&&left<=7&&!upcomingRecording)out.push({id:'record:'+c.id,title:'Registrazione da pianificare',text:`${c.name}: il prossimo ciclo è vicino e non vedo una registrazione pianificata.`,route:'/calendario?date='+toDateOnly(nowDate),level:'normal'});
    }
  }
  const rank={urgent:0,important:1,normal:2};return out.sort((a,b)=>rank[a.level]-rank[b.level]).slice(0,12);
}

function buildAssistantInsight(clients:Client[],scripts:Script[],events:CalendarEvent[],payments:Payment[]){
  const nowDate=new Date();const day=nowDate.getDate();const daysInMonth=new Date(nowDate.getFullYear(),nowDate.getMonth()+1,0).getDate();
  const candidates=clients.filter(c=>!c.deletedAt&&c.contentTarget>0).map(c=>{
    const cs=scripts.filter(s=>!s.deletedAt&&s.clientId===c.id);const published=cs.filter(s=>s.published).length;const target=c.contentTarget;const projected=day>=5?Math.round(published/Math.max(1,day)*daysInMonth):published;return {c,published,target,projected,gap:target-published};
  }).filter(x=>x.gap>0).sort((a,b)=>(a.projected-a.target)-(b.projected-b.target));
  const risk=candidates.find(x=>day>=5&&x.projected<x.target);
  if(risk)return {title:`${risk.c.name} rischia di chiudere sotto target`,short:`${risk.published}/${risk.target} pubblicati`,text:`Hai pubblicato ${risk.published} contenuti su ${risk.target}. Al ritmo attuale la proiezione è circa ${risk.projected}/${risk.target}. Pianifica una sessione di registrazione o accelera il workflow.`};
  const overdue=payments.filter(p=>!p.deletedAt&&!p.paidAt&&paymentStatus(p)==='Scaduto');if(overdue.length)return {title:'Ci sono entrate da recuperare',short:`${overdue.length} pagamenti scaduti`,text:`Vedo ${overdue.length} pagamenti scaduti. Conviene gestirli prima di aggiungere altro lavoro amministrativo.`};
  const next=events.filter(e=>!e.deletedAt&&new Date(e.startAt)>nowDate).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt))[0];if(next)return {title:'Agenda sotto controllo',short:`Prossimo: ${next.title}`,text:`Il prossimo impegno è “${next.title}” ${new Date(next.startAt).toLocaleString('it-IT',{weekday:'short',day:'numeric',hour:next.allDay?undefined:'2-digit',minute:next.allDay?undefined:'2-digit'})}. Non vedo criticità più urgenti dai dati attuali.`};
  return {title:'Spazio operativo disponibile',short:'Nessuna criticità forte',text:'Non emergono urgenze forti. Puoi usare questo spazio per preparare contenuti, strategie o anticipare il lavoro dei clienti.'};
}
