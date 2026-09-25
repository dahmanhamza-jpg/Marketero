import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSettings, now, uid } from './lib/db';
import { makePinHash, verifyPin, verifyRecoveryCode } from './lib/security';
import { clientDeadlinesInRange, clientHealth, daysUntil, freeMinutesUntil, getConflicts, nextClientDeadline, nextTask, paymentStatus, toDateOnly } from './lib/logic';
import { hourlyMotivation } from './lib/motivation';
import { buildStrategy } from './services/strategy';
import { exportAll, importAll, resetRemote, startAutoSync, getSyncCode, setSyncCode, queueSync, syncRemote } from './services/sync';
import { downloadText, scriptText } from './lib/exportScript';
import { BottomNav } from './components/BottomNav';
import { QuickAdd } from './components/QuickAdd';
import { Card, Chip, Empty, PrimaryButton, ProgressRing, Stat } from './components/UI';
import { WorkflowBoard } from './components/WorkflowBoard';
import { FocusPage } from './features/FocusPage';
import { HabitsPage } from './features/HabitsPage';
import { award, levelFor, rewardTotal } from './lib/rewards';
import { workflowSummary } from './lib/workflow';
import type { CalendarEvent, Client, ContentFormat, Idea, Lead, Payment, Platform, Script, Task, WorkflowStage } from './types/models';
import './styles.css';

const stages:WorkflowStage[]=['Script','Registrazione','Montaggio','Programmazione','Pubblicato'];
const fmtDate=(v:string|Date)=>new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric'}).format(typeof v==='string'?new Date(v):v);
const sameDay=(a:string|Date,b:string|Date)=>toDateOnly(typeof a==='string'?new Date(a):a)===toDateOnly(typeof b==='string'?new Date(b):b);
const greeting=()=>{const h=new Date().getHours();return h<12?'Buongiorno':h<18?'Buon pomeriggio':'Buonasera'};

function AppShell(){
  const nav=useNavigate();
  const [modal,setModal]=useState<string|null>(null);
  useEffect(()=>{const stop=startAutoSync();return stop},[]);
  return <div className="app-shell"><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/clienti" element={<Clients/>}/>
    <Route path="/clienti/:id" element={<ClientPage/>}/>
    <Route path="/calendario" element={<CalendarPage/>}/>
    <Route path="/focus" element={<FocusPage/>}/>
    <Route path="/abitudini" element={<HabitsPage/>}/>
    <Route path="/pagamenti" element={<PaymentsPage/>}/>
    <Route path="/lead" element={<LeadsPage/>}/>
    <Route path="/altro" element={<MorePage/>}/>
  </Routes><BottomNav/><QuickAdd onSelect={setModal}/>{modal&&<QuickModal type={modal} close={()=>setModal(null)} nav={nav}/>}</div>
}

function QuickModal({type,close,nav}:{type:string;close:()=>void;nav:(p:string)=>void}){
  if(type==='idea') return <IdeaForm close={close}/>;
  if(type==='client') return <ClientForm close={close} after={id=>nav('/clienti/'+id)}/>;
  if(type==='work'||type==='personal') return <EventForm kind={type==='work'?'Lavoro':'Personale'} close={close}/>;
  if(type==='task') return <TaskForm close={close}/>;
  if(type==='content') return <TaskForm close={close} initialStage="Registrazione" title="Nuovo contenuto / attività"/>;
  if(type==='script') return <GlobalScriptForm close={close}/>;
  if(type==='lead') return <LeadForm close={close}/>;
  if(type==='payment') return <PaymentForm close={close}/>;
  return null;
}

function Home(){
  const tasks=useLiveQuery(()=>db.tasks.toArray(),[])||[];
  const events=useLiveQuery(()=>db.events.toArray(),[])||[];
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const payments=useLiveQuery(()=>db.payments.toArray(),[])||[];
  const scripts=useLiveQuery(()=>db.scripts.toArray(),[])||[];
  const rewards=useLiveQuery(()=>db.rewards.toArray(),[])||[];
  const [selectedDay,setSelectedDay]=useState<Date|null>(null);
  const [hourKey,setHourKey]=useState(()=>new Date().getHours());
  useEffect(()=>{const id=window.setInterval(()=>{const h=new Date().getHours();setHourKey(x=>x===h?x:h)},60000);return()=>window.clearInterval(id)},[]);
  const future=events.filter(e=>new Date(e.startAt)>new Date()&&!e.deletedAt).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
  const free=freeMinutesUntil(future);
  const next=nextTask(tasks,free);
  const nextEvent=future[0];
  const alerts=clients.map(c=>({c,h:clientHealth(c,payments,[]),d:nextClientDeadline(c)})).filter(x=>{const deadline=x.d;const due=!!deadline&&[10,7,3,0].includes(daysUntil(deadline));const planned=!!deadline&&events.some(e=>e.clientId===x.c.id&&!e.deletedAt&&e.category.toLowerCase().includes('registr')&&new Date(e.startAt)>=deadline);return x.h.state!=='Regolare'||(due&&!planned)}).slice(0,3);
  const focus=tasks.filter(t=>!t.completed&&!t.deletedAt).sort((a,b)=>(b.urgent?1:0)-(a.urgent?1:0)).slice(0,3);
  const quote=hourlyMotivation(new Date());
  const points=rewardTotal(rewards); const level=levelFor(points);
  const activeClientProgress=clients.filter(c=>!c.deletedAt).map(c=>({client:c,summary:workflowSummary(scripts.filter(x=>x.clientId===c.id))})).sort((a,b)=>a.summary.progress-b.summary.progress).slice(0,3);
  async function completeTask(id:string){await db.tasks.update(id,{completed:true,updatedAt:now()});await award('task:'+id,5,'task','Task completato');queueSync();}
  return <main className="page home"><header className="top"><div><h1>{greeting()} 👋</h1><p>{new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</p></div></header>
    <Card className="hero"><div className="hero-glow"/><span className="eyebrow light">PROSSIMA AZIONE</span>{next?<><h2>{next.title}</h2><p>{next.durationMin} min · {next.urgent?'Priorità alta':'Scelta dai dati di oggi'}</p><div className="row"><Link className="btn primary" to={'/focus?task='+next.id+'&label='+encodeURIComponent(next.title)}>Inizia Focus</Link><button className="btn hero-quiet" onClick={()=>completeTask(next.id)}>✓ Completa</button></div></>:<><h2>Spazio libero.</h2><p>Non ci sono attività urgenti compatibili con il tempo disponibile.</p><Link className="btn primary" to="/focus">Avvia Focus libero</Link></>}</Card>
    <div className="week-pulse"><div className="week-pulse-head"><span className="eyebrow">LA TUA SETTIMANA</span></div><div className="day-strip">{Array.from({length:5},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);const selected=selectedDay?sameDay(selectedDay,d):i===0;const today=sameDay(d,new Date());return <button className={(selected?'selected ':'')+(today?'today':'')} key={i} onClick={()=>setSelectedDay(new Date(d))}><span>{new Intl.DateTimeFormat('it-IT',{weekday:'short'}).format(d)}</span><strong>{d.getDate()}</strong><small>{today?'oggi':''}</small></button>})}</div></div>
    <section className="daily-note" key={hourKey}><span className="daily-note-accent"/><div><span className="eyebrow">{quote.type==='Spinta'?'NOTA DEL MOMENTO':quote.type}</span><blockquote>{quote.text}</blockquote>{quote.reference&&<small>{quote.reference}</small>}</div></section>
    <div className="bento">
      <Card className="span2"><span className="eyebrow">🎯 FOCUS</span>{focus.length?focus.map(t=><div className="line" key={t.id}><span>{t.title}</span><button aria-label="Completa" onClick={()=>completeTask(t.id)}>✓</button></div>):<p className="muted">Nessuna priorità aperta.</p>}</Card>
      <Card className="next-event-card"><span className="eyebrow">PROSSIMO</span><h3>{nextEvent?.title||'Nessun appuntamento'}</h3>{nextEvent&&<p>{new Date(nextEvent.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} · {nextEvent.kind}</p>}</Card>
      {alerts.length>0&&<Card className="attention span2"><span className="eyebrow">🚨 ATTENZIONE</span>{alerts.map(x=><p key={x.c.id}><strong>{x.c.name}</strong><br/>{x.d&&[10,7,3,0].includes(daysUntil(x.d))?`Tra ${Math.max(0,daysUntil(x.d))} giorni termina il ciclo contenuti. Pianifica la registrazione del mese successivo.`:x.h.reason}</p>)}</Card>}
      <Card className="dopamine-mini"><span className="eyebrow">MOMENTUM</span><h3>{points}</h3><p>Progressi · {level.name}</p><div className="mini-progress"><span style={{width:Math.min(100,Math.round(level.current/level.needed*100))+'%'}}/></div></Card>
      {activeClientProgress.length>0&&<Card className="span2 client-progress-home"><span className="eyebrow">AVANZAMENTO CLIENTI</span>{activeClientProgress.map(x=><Link to={'/clienti/'+x.client.id} key={x.client.id}><div><b>{x.client.name}</b><small>{x.summary.total} script</small></div><strong>{x.summary.progress}%</strong></Link>)}</Card>}
      <Link to="/abitudini" className="card card-link rhythm-mini"><span className="eyebrow">RITMO</span><h3>14 giorni</h3><p>Una vista semplice della tua continuità</p></Link>
    </div>
    {selectedDay&&<DaySheet date={selectedDay} close={()=>setSelectedDay(null)} events={events} tasks={tasks} clients={clients}/>}
  </main>
}

function LinkCard({to,title,value,note}:{to:string;title:string;value:string;note:string}){return <Link to={to} className="card card-link"><span className="eyebrow">{title}</span><h3>{value}</h3><p>{note}</p></Link>}

function DaySheet({date,close,events,tasks,clients}:{date:Date;close:()=>void;events:CalendarEvent[];tasks:Task[];clients:Client[]}){
  const dayEvents=events.filter(e=>!e.deletedAt&&sameDay(e.startAt,date));
  const dayTasks=tasks.filter(t=>!t.deletedAt&&t.dueAt&&sameDay(t.dueAt,date));
  const deadlines=clients.filter(c=>clientDeadlinesInRange(c,date,date).length);
  return <Modal title={new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long'}).format(date)} close={close}><div className="list compact">{dayEvents.map(e=><Card key={e.id}><b>{e.allDay?'Tutto il giorno':new Date(e.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} · {e.title}</b><p>{e.kind} · {e.category}</p></Card>)}{dayTasks.map(t=><Card key={t.id}><b>☑️ {t.title}</b><p>{t.stage||'Task'}{t.completed?' · completato':''}</p></Card>)}{deadlines.map(c=><Card key={c.id} className="attention"><b>⏳ Scadenza ciclo · {c.name}</b><p>Prepara i contenuti del mese successivo.</p></Card>)}{!dayEvents.length&&!dayTasks.length&&!deadlines.length&&<Empty title="Nessun impegno per questa giornata."/>}</div></Modal>
}

function Clients(){
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const payments=useLiveQuery(()=>db.payments.toArray(),[])||[];
  const scripts=useLiveQuery(()=>db.scripts.toArray(),[])||[];
  const [newClient,setNewClient]=useState(false);
  const nav=useNavigate();
  const nowDate=new Date();
  const monthPayments=payments.filter(p=>!p.deletedAt&&p.paidAt&&new Date(p.paidAt).getMonth()===nowDate.getMonth()&&new Date(p.paidAt).getFullYear()===nowDate.getFullYear());
  const monthRevenue=monthPayments.reduce((sum,p)=>sum+p.amount,0);
  const prevDate=new Date(nowDate.getFullYear(),nowDate.getMonth()-1,1);
  const prevRevenue=payments.filter(p=>!p.deletedAt&&p.paidAt&&new Date(p.paidAt).getMonth()===prevDate.getMonth()&&new Date(p.paidAt).getFullYear()===prevDate.getFullYear()).reduce((sum,p)=>sum+p.amount,0);
  const monthTrend=prevRevenue?Math.round((monthRevenue-prevRevenue)/prevRevenue*100):null;
  return <main className="page"><header className="page-title editorial-header"><div><span className="eyebrow">IN LAVORAZIONE</span><h1>I tuoi clienti</h1><p>Apri una card e capisci subito cosa manca.</p></div><PrimaryButton onClick={()=>setNewClient(true)}>+ Nuovo cliente</PrimaryButton></header><div className="client-grid">{clients.filter(c=>!c.deletedAt).map(c=>{const h=clientHealth(c,payments,scripts.filter(s=>s.clientId===c.id));const d=nextClientDeadline(c);const ws=workflowSummary(scripts.filter(s=>s.clientId===c.id));return <Link className="client-card client-card-2026" to={`/clienti/${c.id}`} key={c.id}><div className="avatar">{c.name.slice(0,2).toUpperCase()}</div><div className="client-main"><div className="row spread"><div><span className="eyebrow">{c.niche}</span><h3>{c.name}</h3></div><ProgressRing value={ws.progress} size={62}/></div><div className="client-kpis"><Stat value={ws.total} label="script"/><Stat value={ws.counts.edited} label="montati"/><Stat value={ws.counts.published} label="pubblicati"/></div>{d&&<div className="deadline-note">Scadenza <b>{fmtDate(d)}</b> · {Math.max(0,daysUntil(d))} giorni</div>}<div className="next-action">⚡ {ws.total&&ws.progress<100?'Continua il workflow':' '+h.reason}</div></div></Link>})}</div>{clients.length===0&&<Empty title="Nessun cliente ancora" description="Aggiungi il primo cliente per organizzare contenuti e scadenze." action={<PrimaryButton onClick={()=>setNewClient(true)}>Nuovo cliente</PrimaryButton>}/>}
  <Link to="/pagamenti" className="revenue-link-card">
    <div><span className="eyebrow">ENTRATE · MESE CORRENTE</span><h2>€ {monthRevenue.toLocaleString('it-IT')}</h2><p>{monthPayments.length} incassi registrati</p></div>
    <div className="revenue-link-side">{monthTrend!==null&&<span className={monthTrend>=0?'trend-up':'trend-down'}>{monthTrend>=0?'+':''}{monthTrend}%</span>}<b>Apri Entrate →</b></div>
  </Link>
  {newClient&&<ClientForm close={()=>setNewClient(false)} after={id=>nav("/clienti/"+id)}/>}</main>
}

function ClientPage(){
  const {id}=useParams();
  const client=useLiveQuery(()=>id?db.clients.get(id):undefined,[id]);
  const scripts=useLiveQuery(()=>id?db.scripts.where('clientId').equals(id).toArray():[],[id])||[];
  const ideas=useLiveQuery(()=>id?db.ideas.where('clientId').equals(id).toArray():[],[id])||[];
  const payments=useLiveQuery(()=>id?db.payments.where('clientId').equals(id).toArray():[],[id])||[];
  const strategies=useLiveQuery(()=>id?db.strategies.where('clientId').equals(id).toArray():[],[id])||[];
  const [tab,setTab]=useState<'overview'|'scripts'|'strategy'|'more'>('overview');
  const [newScript,setNewScript]=useState(false); const [editingScript,setEditingScript]=useState<Script|null>(null);
  if(!client)return <main className="page"><p>Caricamento…</p></main>;
  const h=clientHealth(client,payments,scripts); const ready=scripts.filter(s=>s.status==='Pronto').length; const deadline=nextClientDeadline(client); const ws=workflowSummary(scripts);
  const createStrategy=async()=>{const st=buildStrategy(client);await db.strategies.put(st);queueSync();setTab('strategy')};
  return <main className="page client-detail"><Link to="/clienti" className="back">← Clienti</Link><Card className="client-hero client-hero-2026"><div><span className="eyebrow">{client.niche}</span><h1>{client.name}</h1><p>{client.platforms.join(' + ')||'Nessuna piattaforma'} · € {client.monthlyFee}/mese</p>{deadline&&<p>Scadenza <b>{fmtDate(deadline)}</b> · {Math.max(0,daysUntil(deadline))} giorni</p>}</div><div className="client-score"><ProgressRing value={ws.progress} size={106} label="mese"/><span className={`status ${h.state.toLowerCase()}`}>{h.state}</span></div></Card>
    <Card className="next-client"><span className="eyebrow">PROSSIMA AZIONE</span><h2>{ws.total===0?'Crea il primo script':ws.counts.recorded<ws.total?`Registra ${ws.total-ws.counts.recorded} contenuti`:ws.counts.edited<ws.total?`Monta ${ws.total-ws.counts.edited} contenuti`:ws.counts.scheduled<ws.total?`Programma ${ws.total-ws.counts.scheduled} contenuti`:ws.counts.published<ws.total?`Pubblica ${ws.total-ws.counts.published} contenuti`:'Workflow completato'}</h2></Card>
    <div className="tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Panoramica</button><button className={tab==='scripts'?'active':''} onClick={()=>setTab('scripts')}>Script</button><button className={tab==='strategy'?'active':''} onClick={()=>setTab('strategy')}>Strategia</button><button className={tab==='more'?'active':''} onClick={()=>setTab('more')}>Altro</button></div>
    {tab==='overview'&&<><WorkflowBoard client={client} scripts={scripts}/><div className="bento client-secondary-stats"><Card><span className="eyebrow">IDEE</span><h3>{ideas.length}</h3><p>salvate</p></Card><Card><span className="eyebrow">SCRIPT PRONTI</span><h3>{ready}/{scripts.length||client.contentTarget}</h3><p>testi</p></Card><Card><span className="eyebrow">PAGAMENTO</span><h3>{payments.some(p=>paymentStatus(p)==='Scaduto')?'Scaduto':'Regolare'}</h3></Card></div></>}
    {tab==='scripts'&&<><div className="section-head"><div><h2>Script</h2><p>Qui scrivi il contenuto. Il workflow usa solo flag, senza testi duplicati.</p></div><PrimaryButton onClick={()=>setNewScript(true)}>+ Nuovo script</PrimaryButton></div><div className="list">{scripts.filter(x=>!x.deletedAt).map(sc=><Card key={sc.id} className="script-editor-card"><div className="row spread"><div><span className="eyebrow">{sc.platform} · {sc.format}</span><h3>{sc.title}</h3><p>{sc.status}</p></div><div className="row script-actions"><button className="btn soft" onClick={()=>setEditingScript(sc)}>Modifica</button><button className="btn soft" onClick={()=>navigator.clipboard.writeText(scriptText(sc))}>Copia</button><button className="btn soft" onClick={()=>downloadText(sc.title+'.txt',scriptText(sc))}>Esporta</button><button className="btn danger-quiet" onClick={()=>{if(confirm('Eliminare questo script?'))db.scripts.update(sc.id,{deletedAt:now(),updatedAt:now()}).then(()=>queueSync())}}>Elimina</button></div></div></Card>)}</div>{newScript&&<ScriptForm client={client} ideas={ideas} close={()=>setNewScript(false)}/>} {editingScript&&<ScriptForm client={client} ideas={ideas} edit={editingScript} close={()=>setEditingScript(null)}/>}</>}
    {tab==='strategy'&&<><div className="section-head"><div><h2>Strategia</h2><p>Motore deterministico, senza API a pagamento.</p></div><PrimaryButton onClick={createStrategy}>Crea strategia</PrimaryButton></div>{strategies.length?strategies.slice().reverse().map(s=><Card key={s.id}><h3>{s.objective}</h3><p>{s.summary}</p><div className="chips">{s.pillars.map(p=><Chip key={p.name}>{p.name} · {p.count}</Chip>)}</div><div className="strategy-ideas">{s.ideas.map((i,idx)=><div key={idx}><b>{idx+1}. {i.title}</b><span>{i.pillar} · {i.funnel}</span><small>{i.hook}</small></div>)}</div></Card>):<Empty title="Nessuna strategia ancora" action={<PrimaryButton onClick={createStrategy}>Crea strategia</PrimaryButton>}/>}</>}
    {tab==='more'&&<div className="bento"><Card><span className="eyebrow">TONO</span><h3>{client.tone||'Non impostato'}</h3></Card><Card><span className="eyebrow">DA EVITARE</span><p>{client.avoid?.join(', ')||'Nessuna regola'}</p></Card><Card><span className="eyebrow">META ADS</span><h3>{client.metaAds?'Sì':'No'}</h3></Card></div>}
  </main>
}

function calendarTone(category:string,kind:'Lavoro'|'Personale'){
  const c=category.toLowerCase();
  if(kind==='Personale')return 'personal';
  if(c.includes('registr'))return 'recording';
  if(c.includes('mont'))return 'editing';
  if(c.includes('programm'))return 'scheduling';
  if(c.includes('pubblic'))return 'publishing';
  if(c.includes('task'))return 'task';
  return 'appointment';
}
function calendarIcon(category:string,kind:'Lavoro'|'Personale'){
  const tone=calendarTone(category,kind);
  return tone==='recording'?'●':tone==='editing'?'◆':tone==='scheduling'?'▣':tone==='publishing'?'✓':tone==='personal'?'○':tone==='task'?'□':'•';
}

function CalendarPage(){
  const events=useLiveQuery(()=>db.events.toArray(),[])||[];
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const [filter,setFilter]=useState<'Tutto'|'Lavoro'|'Personale'>('Tutto');
  const [mode,setMode]=useState<'Giorno'|'Settimana'|'Mese'>('Mese');
  const [cursor,setCursor]=useState(new Date());
  const [editing,setEditing]=useState<CalendarEvent|null>(null);
  const [creating,setCreating]=useState(false);
  const [selectedDay,setSelectedDay]=useState<Date|null>(null);
  const visible=events.filter(e=>!e.deletedAt&&(filter==='Tutto'||e.kind===filter));
  const monthStart=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const monthEnd=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
  const deadlines=clients.flatMap(c=>clientDeadlinesInRange(c,monthStart,monthEnd).map(d=>({client:c,date:d})));
  const monthLabel=new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(cursor);
  function shift(delta:number){const d=new Date(cursor);if(mode==='Mese')d.setMonth(d.getMonth()+delta);else if(mode==='Settimana')d.setDate(d.getDate()+7*delta);else d.setDate(d.getDate()+delta);setCursor(d)}
  return <main className="page calendar-page">
    <header className="calendar-hero">
      <div><span className="eyebrow">TEMPO E PRIORITÀ</span><h1>La tua settimana</h1><p>Vedi subito dove sei pieno e dove hai spazio.</p></div>
      <PrimaryButton onClick={()=>setCreating(true)}>+ Evento</PrimaryButton>
    </header>
    <Card className="calendar-shell">
      <div className="calendar-titlebar">
        <div className="month-nav"><button className="icon-btn" aria-label="Periodo precedente" onClick={()=>shift(-1)}>←</button><div><span className="eyebrow">PERIODO</span><h2>{monthLabel}</h2></div><button className="icon-btn" aria-label="Periodo successivo" onClick={()=>shift(1)}>→</button></div>
        <div className="calendar-controls">
          <div className="segment-control">{(['Giorno','Settimana','Mese'] as const).map(x=><button className={mode===x?'active':''} onClick={()=>setMode(x)} key={x}>{x}</button>)}</div>
          <button className="btn today-btn" onClick={()=>setCursor(new Date())}>Oggi</button>
        </div>
      </div>
      <div className="calendar-filter">{(['Tutto','Lavoro','Personale'] as const).map(x=><button className={filter===x?'active':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div>
      {mode==='Mese'
        ?<MonthGrid cursor={cursor} events={visible} deadlines={deadlines} clients={clients} onEvent={setEditing} onDay={setSelectedDay}/>
        :<AgendaView mode={mode} cursor={cursor} events={visible} clients={clients} onEvent={setEditing}/>}
    </Card>
    {selectedDay&&<CalendarDaySheet date={selectedDay} events={visible} deadlines={deadlines} clients={clients} close={()=>setSelectedDay(null)} onEvent={e=>{setSelectedDay(null);setEditing(e)}}/>}
    {editing&&<EventForm kind={editing.kind} edit={editing} close={()=>setEditing(null)}/>}
    {creating&&<EventForm kind="Lavoro" close={()=>setCreating(false)}/>}
  </main>
}

function MonthGrid({cursor,events,deadlines,clients,onEvent,onDay}:{cursor:Date;events:CalendarEvent[];deadlines:{client:Client;date:Date}[];clients:Client[];onEvent:(e:CalendarEvent)=>void;onDay:(d:Date)=>void}){
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const start=new Date(first);start.setDate(1-((first.getDay()+6)%7));
  const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
  return <div className="month-wrap responsive-month">
    <div className="month-head">{['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(x=><b key={x}>{x}</b>)}</div>
    <div className="month-grid">{days.map(d=>{
      const es=events.filter(e=>sameDay(e.startAt,d));
      const ds=deadlines.filter(x=>sameDay(x.date,d));
      const busy=es.length+ds.length;
      return <div className={'month-day '+(d.getMonth()!==cursor.getMonth()?'muted-day ':'')+(sameDay(d,new Date())?'today ':'')} key={d.toISOString()}>
        <button className="day-number" onClick={()=>onDay(new Date(d))}><strong>{d.getDate()}</strong>{busy>0&&<span>{busy}</span>}</button>
        <div className="month-events">
          {es.slice(0,3).map(e=>{const client=clients.find(c=>c.id===e.clientId);return <button key={e.id} className={'event-card '+calendarTone(e.category,e.kind)} onClick={()=>onEvent(e)}>
            <span className="event-symbol">{calendarIcon(e.category,e.kind)}</span>
            <span className="event-copy"><b>{e.allDay?'Tutto il giorno':new Date(e.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</b><span>{e.title}</span>{client&&<small>{client.name}</small>}</span>
          </button>})}
          {ds.slice(0,1).map(x=><button className="event-card deadline" key={x.client.id} onClick={()=>onDay(new Date(d))}><span className="event-symbol">!</span><span className="event-copy"><b>Scadenza</b><span>{x.client.name}</span></span></button>)}
          {busy>4&&<button className="more-events" onClick={()=>onDay(new Date(d))}>+{busy-4} altri</button>}
        </div>
      </div>
    })}</div>
  </div>
}

function CalendarDaySheet({date,events,deadlines,clients,close,onEvent}:{date:Date;events:CalendarEvent[];deadlines:{client:Client;date:Date}[];clients:Client[];close:()=>void;onEvent:(e:CalendarEvent)=>void}){
  const dayEvents=events.filter(e=>sameDay(e.startAt,date)).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
  const dayDeadlines=deadlines.filter(x=>sameDay(x.date,date));
  return <Modal title={new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long'}).format(date)} close={close}>
    <div className="day-agenda">
      {dayEvents.map(e=>{const client=clients.find(c=>c.id===e.clientId);return <button key={e.id} className={'day-agenda-item '+calendarTone(e.category,e.kind)} onClick={()=>onEvent(e)}>
        <span className="agenda-time">{e.allDay?'—':new Date(e.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</span>
        <span><b>{e.title}</b><small>{e.category}{client?' · '+client.name:''}</small></span>
      </button>})}
      {dayDeadlines.map(x=><div className="day-agenda-item deadline" key={x.client.id}><span className="agenda-time">!</span><span><b>Scadenza cliente</b><small>{x.client.name}</small></span></div>)}
      {!dayEvents.length&&!dayDeadlines.length&&<Empty title="Giornata libera" description="Nessun impegno in calendario."/>}
    </div>
  </Modal>
}

function AgendaView({mode,cursor,events,clients,onEvent}:{mode:'Giorno'|'Settimana';cursor:Date;events:CalendarEvent[];clients:Client[];onEvent:(e:CalendarEvent)=>void}){
  const start=new Date(cursor);if(mode==='Settimana')start.setDate(start.getDate()-((start.getDay()+6)%7));
  const end=new Date(start);end.setDate(end.getDate()+(mode==='Settimana'?6:0));end.setHours(23,59,59,999);
  const list=events.filter(e=>{const d=new Date(e.startAt);return d>=start&&d<=end}).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
  return <div className="calendar-list">{list.map(e=>{const client=clients.find(c=>c.id===e.clientId);return <button className={'calendar-event '+calendarTone(e.category,e.kind)} key={e.id} onClick={()=>onEvent(e)}>
    <div className="time"><span>{new Date(e.startAt).toLocaleDateString('it-IT',{weekday:'short',day:'numeric'})}</span><strong>{e.allDay?'—':new Date(e.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</strong></div>
    <span className="event-symbol large">{calendarIcon(e.category,e.kind)}</span>
    <div><span className="eyebrow">{e.category}</span><h3>{e.title}</h3><p>{client?.name||e.kind}</p></div>
  </button>})}{!list.length&&<Empty title="Calendario libero" description="Nessun impegno in questo periodo."/>}</div>
}

function PaymentsPage(){
  const payments=useLiveQuery(()=>db.payments.toArray(),[])||[];
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const [range,setRange]=useState(6);
  const [newPayment,setNewPayment]=useState(false);
  const active=payments.filter(p=>!p.deletedAt);
  const paid=active.filter(p=>p.paidAt);
  const pending=active.filter(p=>!p.paidAt);
  const nowDate=new Date();
  const currentMonth=paid.filter(p=>{const d=new Date(p.paidAt!);return d.getMonth()===nowDate.getMonth()&&d.getFullYear()===nowDate.getFullYear()});
  const yearPaid=paid.filter(p=>new Date(p.paidAt!).getFullYear()===nowDate.getFullYear());
  const monthTotal=currentMonth.reduce((s,p)=>s+p.amount,0);
  const yearTotal=yearPaid.reduce((s,p)=>s+p.amount,0);
  const receivedTotal=paid.reduce((s,p)=>s+p.amount,0);
  const pendingTotal=pending.reduce((s,p)=>s+p.amount,0);
  const months=Array.from({length:range},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(range-1-i));return d});
  const series=months.map(d=>{
    const amount=paid.filter(p=>{const x=new Date(p.paidAt!);return x.getMonth()===d.getMonth()&&x.getFullYear()===d.getFullYear()}).reduce((s,p)=>s+p.amount,0);
    const prev=new Date(d);prev.setMonth(prev.getMonth()-range);
    const prevAmount=paid.filter(p=>{const x=new Date(p.paidAt!);return x.getMonth()===prev.getMonth()&&x.getFullYear()===prev.getFullYear()}).reduce((s,p)=>s+p.amount,0);
    return {label:new Intl.DateTimeFormat('it-IT',{month:'short'}).format(d),amount,prevAmount};
  });
  const max=Math.max(1,...series.flatMap(x=>[x.amount,x.prevAmount]));
  const points=series.map((x,i)=>({x:series.length===1?50:i/(series.length-1)*100,y:90-(x.amount/max)*72}));
  const prevPoints=series.map((x,i)=>({x:series.length===1?50:i/(series.length-1)*100,y:90-(x.prevAmount/max)*72}));
  const path=(pts:{x:number;y:number}[])=>pts.map((p,i)=>(i?'L':'M')+' '+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');
  const clientTotals=clients.filter(c=>!c.deletedAt).map(c=>({client:c,total:currentMonth.filter(p=>p.clientId===c.id).reduce((s,p)=>s+p.amount,0)})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const clientMax=Math.max(1,...clientTotals.map(x=>x.total));
  async function togglePaid(p:Payment){await db.payments.update(p.id,{paidAt:p.paidAt?undefined:now(),updatedAt:now()});queueSync();}
  return <main className="page revenue-page">
    <header className="page-title editorial-header"><div><span className="eyebrow">PANORAMICA FINANZIARIA</span><h1>Entrate</h1><p>Quanto hai incassato, cosa deve ancora arrivare e da chi.</p></div><PrimaryButton onClick={()=>setNewPayment(true)}>+ Pagamento</PrimaryButton></header>
    <section className="revenue-hero-grid">
      <Card className="revenue-primary"><span className="eyebrow">QUESTO MESE</span><h2>€ {monthTotal.toLocaleString('it-IT')}</h2><p>{currentMonth.length} incassi</p></Card>
      <Card className="revenue-dark"><span className="eyebrow">ANNO {nowDate.getFullYear()}</span><h2>€ {yearTotal.toLocaleString('it-IT')}</h2><p>totale incassato</p></Card>
      <Card className="revenue-glass"><span className="eyebrow">DA RICEVERE</span><h2>€ {pendingTotal.toLocaleString('it-IT')}</h2><p>{pending.filter(p=>paymentStatus(p)==='Scaduto').length} scaduti</p></Card>
      <Card className="revenue-glass"><span className="eyebrow">INCASSATO STORICO</span><h2>€ {receivedTotal.toLocaleString('it-IT')}</h2><p>{paid.length} pagamenti</p></Card>
    </section>
    <Card className="revenue-chart-card">
      <div className="section-head"><div><span className="eyebrow">ANDAMENTO</span><h2>Entrate nel tempo</h2><p>Periodo attuale in evidenza, periodo precedente più tenue.</p></div><div className="segment-control revenue-range">{[1,3,6,12].map(n=><button key={n} className={range===n?'active':''} onClick={()=>setRange(n)}>{n===1?'1 mese':n===12?'1 anno':n+' mesi'}</button>)}</div></div>
      <div className="line-chart-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Andamento entrate"><defs><linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9571b" stopOpacity=".34"/><stop offset="100%" stopColor="#c9571b" stopOpacity="0"/></linearGradient></defs><path d={path(prevPoints)} className="revenue-prev-line"/><path d={path(points)+' L 100 100 L 0 100 Z'} fill="url(#revArea)"/><path d={path(points)} className="revenue-line"/></svg></div>
      <div className="revenue-axis">{series.map((x,i)=><span key={i}>{x.label}</span>)}</div>
    </Card>
    <div className="revenue-lower-grid">
      <Card className="client-revenue-card"><span className="eyebrow">PER CLIENTE · MESE</span><div className="client-revenue-list">{clientTotals.map(x=><div key={x.client.id}><div className="row spread"><b>{x.client.name}</b><span>€ {x.total.toLocaleString('it-IT')}</span></div><div className="client-revenue-bar"><span style={{width:(x.total/clientMax*100)+'%'}}/></div></div>)}{!clientTotals.length&&<p className="muted">Nessun incasso nel mese corrente.</p>}</div></Card>
      <Card className="payment-summary"><span className="eyebrow">STATO PAGAMENTI</span><div className="donut" style={{'--paid':Math.round(receivedTotal/(receivedTotal+pendingTotal||1)*100)+'%'} as any}><div><strong>{Math.round(receivedTotal/(receivedTotal+pendingTotal||1)*100)}%</strong><span>incassato</span></div></div><p>€ {pendingTotal.toLocaleString('it-IT')} ancora da ricevere</p></Card>
    </div>
    <div className="list payment-list">{active.slice().sort((a,b)=>b.dueDate.localeCompare(a.dueDate)).map(p=>{const c=clients.find(x=>x.id===p.clientId);return <Card key={p.id} className="payment-row"><div className="row spread"><div><span className="eyebrow">{c?.name||'Cliente'}</span><h3>€ {p.amount.toLocaleString('it-IT')}</h3><p>Scadenza {fmtDate(p.dueDate)} · {paymentStatus(p)}</p></div><button className={'btn '+(p.paidAt?'ghost':'success')} onClick={()=>togglePaid(p)}>{p.paidAt?'Annulla incasso':'Segna incassato'}</button></div></Card>})}</div>
    {newPayment&&<PaymentForm close={()=>setNewPayment(false)}/>}
  </main>
}

function LeadsPage(){
  const leads=useLiveQuery(()=>db.leads.toArray(),[])||[];
  const [newLead,setNewLead]=useState(false);
  async function setStatus(lead:Lead,status:Lead['status']){await db.leads.update(lead.id,{status,updatedAt:now()});queueSync();}
  return <main className="page"><header className="page-title"><div><h1>Potenziali clienti</h1><p>Follow-up chiari, nessun lead dimenticato.</p></div><PrimaryButton onClick={()=>setNewLead(true)}>+ Lead</PrimaryButton></header><div className="list">{leads.filter(l=>!l.deletedAt).map(l=><Card key={l.id}><div className="row spread"><div><h3>{l.name}</h3><p>{l.contact||'Nessun contatto'} · € {l.monthlyValue.toLocaleString('it-IT')}/mese</p>{l.nextFollowUpAt&&<small className={new Date(l.nextFollowUpAt)<new Date()?'error':'muted'}>Follow-up: {fmtDate(l.nextFollowUpAt)}</small>}</div><select value={l.status} onChange={e=>setStatus(l,e.target.value as Lead['status'])}>{['Da contattare','Contattato','Appuntamento','Proposta inviata','Acquisito','Perso'].map(x=><option key={x}>{x}</option>)}</select></div></Card>)}{!leads.length&&<Empty title="Nessun lead ancora"/>}</div>{newLead&&<LeadForm close={()=>setNewLead(false)}/>}</main>
}

function MorePage(){
  const settings=useLiveQuery(()=>db.settings.get('settings'),[]); const [syncCode,setSyncCodeState]=useState(''); const [newSyncCode,setNewSyncCode]=useState(''); const [msg,setMsg]=useState(''); const [pinModal,setPinModal]=useState(false); const [resetOpen,setResetOpen]=useState(false);
  useEffect(()=>{getSyncCode().then(setSyncCodeState)},[]);
  const fileRef=async()=>{const p=await exportAll();downloadText(`marketero-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(p,null,2),'application/json')};
  async function copySyncCode(){const code=await getSyncCode();await navigator.clipboard.writeText(code);setMsg('Codice copiato ✓')}
  async function connectDevice(){if(!newSyncCode.trim())return;const old=await getSyncCode();try{await setSyncCode(newSyncCode);await syncRemote();setSyncCodeState(newSyncCode.trim().toLowerCase());setNewSyncCode('');setMsg('Dispositivo collegato ✓')}catch(e:any){await setSyncCode(old);setMsg(e?.message||'Collegamento non riuscito')}}
  async function updateSetting(patch:any){await db.settings.update('settings',{...patch,updatedAt:now()});queueSync()}
  return <main className="page"><header className="page-title"><div><span className="eyebrow">CONTROLLO</span><h1>Il tuo spazio</h1><p>Preferenze, sicurezza e dati in un unico posto.</p></div></header><div className="settings-grid"><Card><h3>App</h3><label className="setting-row"><span>Nome</span><input value={settings?.profileName||''} placeholder="Il tuo nome" onChange={e=>updateSetting({profileName:e.target.value})}/></label><div className="setting-row"><span>Tema</span><button className="btn ghost" onClick={()=>updateSetting({darkMode:!settings?.darkMode})}>{settings?.darkMode?'Tema chiaro':'Tema scuro'}</button></div></Card><Card><h3>Sicurezza</h3><p className="muted">Il PIN viene sincronizzato tra i dispositivi collegati.</p><PrimaryButton onClick={()=>setPinModal(true)}>Cambia PIN</PrimaryButton></Card><Card><h3>Notifiche</h3><label className="setting-row"><span>Notifiche</span><input type="checkbox" checked={settings?.notificationsEnabled!==false} onChange={e=>updateSetting({notificationsEnabled:e.target.checked})}/></label><button className="btn ghost" onClick={async()=>{if("Notification" in window){const p=await Notification.requestPermission();setMsg(p==="granted"?"Notifiche dispositivo abilitate ✓":"Permesso notifiche non concesso")}}}>Abilita notifiche dispositivo</button><label className="setting-row"><span>Scadenze clienti</span><input type="checkbox" checked={settings?.clientReminders!==false} onChange={e=>updateSetting({clientReminders:e.target.checked})}/></label><label className="setting-row"><span>Appuntamenti</span><input type="checkbox" checked={settings?.appointmentReminders!==false} onChange={e=>updateSetting({appointmentReminders:e.target.checked})}/></label></Card><Card><h3>Sincronizzazione</h3><p className="muted">Automatica all'apertura, in foreground, quando torni online, dopo i salvataggi e periodicamente.</p><p><b>Ultimo aggiornamento:</b> {settings?.lastSyncAt?new Date(settings.lastSyncAt).toLocaleString('it-IT'):'Non ancora disponibile'}</p><label>Codice dispositivo<input readOnly value={syncCode}/></label><PrimaryButton onClick={copySyncCode}>Copia codice</PrimaryButton><label>Collega questo dispositivo<input value={newSyncCode} onChange={e=>setNewSyncCode(e.target.value)} placeholder="Incolla codice condiviso"/></label><button className="btn ghost" onClick={connectDevice}>Collega dispositivo</button>{msg&&<p className="muted">{msg}</p>}</Card><Card><h3>Dati</h3><PrimaryButton onClick={fileRef}>Esporta backup</PrimaryButton><label className="file-btn">Ripristina backup<input type="file" accept="application/json" onChange={async e=>{const f=e.target.files?.[0];if(f){await importAll(JSON.parse(await f.text()));location.reload()}}}/></label><div className="danger-zone"><button className="btn danger" onClick={()=>setResetOpen(true)}>Resetta tutti i dati</button></div></Card><LinkCard to="/pagamenti" title="ENTRATE" value="Apri pagamenti" note="Grafico, incassi e scadenze"/><LinkCard to="/lead" title="LEAD" value="Apri potenziali clienti" note="Follow-up e pipeline"/><LinkCard to="/abitudini" title="RITMO" value="Apri Ritmo" note="Vista semplice degli ultimi 14 giorni"/></div>{pinModal&&<ChangePinModal close={()=>setPinModal(false)}/>} {resetOpen&&<ResetModal close={()=>setResetOpen(false)}/>}</main>
}

function ChangePinModal({close}:{close:()=>void}){const [pin,setPin]=useState('');const [confirmPin,setConfirmPin]=useState('');const [msg,setMsg]=useState('');async function save(){if(pin!==confirmPin||pin.length!==4){setMsg('I PIN non coincidono.');return}const hash=await makePinHash(pin);await db.settings.update('settings',{pinHash:hash,updatedAt:now()});await syncRemote().catch(()=>{});close()}return <Modal title="Cambia PIN" close={close}><div className="form"><label>Nuovo PIN<input inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label><label>Conferma PIN<input inputMode="numeric" maxLength={4} value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,''))}/></label>{msg&&<p className="error">{msg}</p>}<PrimaryButton onClick={save}>Salva PIN</PrimaryButton></div></Modal>}

function ResetModal({close}:{close:()=>void}){const settings=useLiveQuery(()=>db.settings.get('settings'),[]);const [pin,setPin]=useState('');const [confirmed,setConfirmed]=useState(false);const [msg,setMsg]=useState('');async function reset(){if(!confirmed){setMsg('Conferma esplicitamente la cancellazione.');return}if(!(await verifyPin(pin,settings?.pinHash))){setMsg('PIN non corretto.');return}await resetRemote();const tables=['clients','ideas','scripts','tasks','events','leads','payments','followers','strategies','focusSessions','habits','habitCompletions','rewards'] as const;for(const t of tables)await (db as any)[t].clear();close();location.reload()}return <Modal title="Resetta tutti i dati" close={close}><div className="form"><p className="error"><b>Questa azione elimina i dati locali e sincronizzati.</b></p><label>PIN<input inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Confermo di voler eliminare tutti i dati.</label>{msg&&<p className="error">{msg}</p>}<button className="btn danger" onClick={reset}>Elimina definitivamente</button></div></Modal>}

function IdeaForm({close}:{close:()=>void}){const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];const [title,setTitle]=useState('');const [clientId,setClientId]=useState('');const [platform,setPlatform]=useState<Platform>('Instagram');const [format,setFormat]=useState<ContentFormat>('Reel');const [url,setUrl]=useState('');async function save(e:any){e.preventDefault();const t=now();await db.ideas.put({id:uid(),title,clientId:clientId||undefined,platform,format,referenceUrls:url?[{url}]:[],status:'Idea',createdAt:t,updatedAt:t});queueSync();close()}return <Modal title="Nuova idea" close={close}><form onSubmit={save} className="form"><label>Titolo<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Cliente<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Nessuno</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><FieldChips title="Piattaforma" values={['Instagram','TikTok','Entrambi']} value={platform} setValue={setPlatform}/><FieldChips title="Formato" values={['Reel','TikTok Video','Post','Carousel','Story']} value={format} setValue={setFormat}/><label>URL riferimento<input type="url" placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/></label><PrimaryButton type="submit">Salva idea</PrimaryButton></form></Modal>}

function ClientForm({close,after}:{close:()=>void;after:(id:string)=>void}){const [step,setStep]=useState(1);const [v,setV]=useState({name:'',niche:'Ristorante',description:'',instagram:'',tiktok:'',monthlyFee:'',contentTarget:'',metaAds:false,objective:'',tone:'Diretto e professionale',startDate:toDateOnly(new Date())});async function save(){const id=uid(),t=now();await db.clients.put({id,name:v.name,niche:v.niche,description:v.description,instagram:v.instagram,tiktok:v.tiktok,monthlyFee:Number(v.monthlyFee||0),contentTarget:Number(v.contentTarget||0),metaAds:v.metaAds,objective:v.objective,tone:v.tone,avoid:[],startDate:v.startDate,platforms:[...(v.instagram?['Instagram' as Platform]:[]),...(v.tiktok?['TikTok' as Platform]:[])],createdAt:t,updatedAt:t});queueSync();close();after(id)}return <Modal title={`Nuovo cliente · ${step}/4`} close={close}><div className="progress"><span style={{width:`${step*25}%`}}/></div><div className="form">{step===1&&<><label>Nome<input value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label><label>Data inizio collaborazione<input type="date" value={v.startDate} onChange={e=>setV({...v,startDate:e.target.value})}/></label><label>Nicchia<select value={v.niche} onChange={e=>setV({...v,niche:e.target.value})}>{['Ristorante','Abbigliamento','Concessionaria','Beauty','Fitness','Immobiliare','Hospitality','Retail','Professionista','Dentista','Bar','Formazione','Servizi','E-commerce','Altro'].map(x=><option key={x}>{x}</option>)}</select></label><label>Descrizione<textarea value={v.description} onChange={e=>setV({...v,description:e.target.value})}/></label></>}{step===2&&<><label>Instagram<input value={v.instagram} onChange={e=>setV({...v,instagram:e.target.value})}/></label><label>TikTok<input value={v.tiktok} onChange={e=>setV({...v,tiktok:e.target.value})}/></label></>}{step===3&&<><label>Compenso mensile<input type="number" inputMode="decimal" placeholder="0" value={v.monthlyFee} onChange={e=>setV({...v,monthlyFee:e.target.value})}/></label><label className="check"><input type="checkbox" checked={v.metaAds} onChange={e=>setV({...v,metaAds:e.target.checked})}/> Meta Ads</label></>}{step===4&&<><label>Target contenuti/mese<input type="number" inputMode="numeric" placeholder="0" value={v.contentTarget} onChange={e=>setV({...v,contentTarget:e.target.value})}/></label><label>Obiettivo<input value={v.objective} onChange={e=>setV({...v,objective:e.target.value})}/></label><label>Tono di voce<input value={v.tone} onChange={e=>setV({...v,tone:e.target.value})}/></label></>}<div className="row spread sticky-actions">{step>1?<button className="btn ghost" onClick={()=>setStep(step-1)}>Indietro</button>:<span/>}{step<4?<PrimaryButton onClick={()=>setStep(step+1)}>Continua</PrimaryButton>:<PrimaryButton disabled={!v.name} onClick={save}>Crea cliente</PrimaryButton>}</div></div></Modal>}

function ScriptForm({client,ideas,close,edit}:{client:Client;ideas:Idea[];close:()=>void;edit?:Script}){
  const [v,setV]=useState({
    title:edit?.title||'',
    ideaId:edit?.ideaId||'',
    platform:(edit?.platform||'Instagram') as Platform,
    format:(edit?.format||'Reel') as ContentFormat,
    status:(edit?.status||'Da scrivere') as Script['status'],
    hook:edit?.hook||'',
    body:edit?.body||'',
    cta:edit?.cta||'',
    recordingNotes:edit?.recordingNotes||'',
    url:edit?.referenceUrls?.[0]?.url||'',
    urlNote:edit?.referenceUrls?.[0]?.note||''
  });
  useEffect(()=>{if(edit)return;const i=ideas.find(x=>x.id===v.ideaId);if(i)setV(o=>({...o,title:i.title,platform:i.platform,format:i.format,url:i.referenceUrls[0]?.url||''}))},[v.ideaId,edit,ideas]);
  async function save(e:any){
    e.preventDefault();
    const t=now(),id=edit?.id||uid();
    await db.scripts.put({
      id,clientId:client.id,ideaId:v.ideaId||undefined,title:v.title,platform:v.platform,format:v.format,status:v.status,
      hook:v.hook,body:v.body,cta:v.cta,recordingNotes:v.recordingNotes,referenceUrls:v.url?[{url:v.url,note:v.urlNote}]:[],
      recorded:edit?.recorded||false,edited:edit?.edited||false,scheduled:edit?.scheduled||false,published:edit?.published||false,
      createdAt:edit?.createdAt||t,updatedAt:t
    });
    if(v.status==='Pronto') await award('script:'+id+':ready',10,'script','Script pronto · '+v.title);
    queueSync();close();
  }
  return <Modal title={edit?'Modifica script':'Nuovo script'} close={close}><form className="form progressive-form" onSubmit={save}>
    {!edit&&<label>Da idea esistente<select value={v.ideaId} onChange={e=>setV({...v,ideaId:e.target.value})}><option value="">Nessuna</option>{ideas.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>}
    <label>Titolo<input required value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label>
    <label>Testo<textarea rows={9} value={v.body} onChange={e=>setV({...v,body:e.target.value})} placeholder="Scrivi qui il testo dello script..."/></label>
    <label>URL ispirazione<input type="url" value={v.url} onChange={e=>setV({...v,url:e.target.value})} placeholder="https://..."/></label>
    <details className="advanced-fields"><summary>Altre opzioni</summary><div className="form">
      <FieldChips title="Piattaforma" values={['Instagram','TikTok','Entrambi']} value={v.platform} setValue={(x:any)=>setV({...v,platform:x})}/>
      <FieldChips title="Formato" values={['Reel','TikTok Video','Post','Carousel','Story']} value={v.format} setValue={(x:any)=>setV({...v,format:x})}/>
      <FieldChips title="Stato script" values={['Da scrivere','In corso','Pronto']} value={v.status} setValue={(x:any)=>setV({...v,status:x})}/>
      <label>Hook<textarea value={v.hook} onChange={e=>setV({...v,hook:e.target.value})}/></label>
      <label>CTA<textarea value={v.cta} onChange={e=>setV({...v,cta:e.target.value})}/></label>
      <label>Note registrazione<textarea value={v.recordingNotes} onChange={e=>setV({...v,recordingNotes:e.target.value})}/></label>
    </div></details>
    <PrimaryButton type="submit">{edit?'Salva modifiche':'Salva script'}</PrimaryButton>
  </form></Modal>
}

function GlobalScriptForm({close}:{close:()=>void}){const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];const [clientId,setClientId]=useState('');const client=clients.find(c=>c.id===clientId);const ideas=useLiveQuery(()=>clientId?db.ideas.where('clientId').equals(clientId).toArray():[],[clientId])||[];if(client)return <ScriptForm client={client} ideas={ideas} close={close}/>;return <Modal title="Nuovo script" close={close}><div className="form"><label>Cliente<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Seleziona cliente</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label></div></Modal>}

function EventForm({kind,close,edit}:{kind:'Lavoro'|'Personale';close:()=>void;edit?:CalendarEvent}){const events=useLiveQuery(()=>db.events.toArray(),[])||[];const startDate=edit?toDateOnly(new Date(edit.startAt)):toDateOnly(new Date());const startTime=edit&&!edit.allDay?new Date(edit.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'';const [title,setTitle]=useState(edit?.title||'');const [date,setDate]=useState(startDate);const [time,setTime]=useState(startTime);const [category,setCategory]=useState(edit?.category||(kind==='Personale'?'Personale':'Appuntamento'));const [error,setError]=useState('');async function save(e:any){e.preventDefault();const t=now();const startAt=time?new Date(`${date}T${time}:00`).toISOString():new Date(`${date}T00:00:00`).toISOString();const candidate:CalendarEvent={id:edit?.id||uid(),title,kind,category,startAt,allDay:!time,createdAt:edit?.createdAt||t,updatedAt:t};const c=getConflicts(candidate,events);if(time&&c.length&&!confirm(`Conflitto con: ${c.map(x=>x.kind==='Personale'?'Fascia occupata':x.title).join(', ')}. Inserire comunque?`))return;await db.events.put(candidate);queueSync();close()}async function remove(){if(edit&&confirm('Eliminare questo evento?')){await db.events.update(edit.id,{deletedAt:now(),updatedAt:now()});queueSync();close()}}return <Modal title={edit?'Modifica evento':kind==='Personale'?'Nuovo impegno personale':'Nuovo appuntamento lavoro'} close={close}><form className="form" onSubmit={save}><label>Titolo<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Data<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Ora <span className="muted">(opzionale)</span><input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>Categoria<input value={category} onChange={e=>setCategory(e.target.value)}/></label>{error&&<p className="error">{error}</p>}<PrimaryButton type="submit">Salva</PrimaryButton>{edit&&<button type="button" className="btn danger" onClick={remove}>Elimina evento</button>}</form></Modal>}

function TaskForm({close,clientId,initialStage,title='Nuova attività'}:{close:()=>void;clientId?:string;initialStage?:WorkflowStage;title?:string}){
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const [name,setName]=useState('');const [duration,setDuration]=useState('');const [dueAt,setDueAt]=useState('');const [selectedClient,setSelectedClient]=useState(clientId||'');const [stage,setStage]=useState<WorkflowStage>(initialStage||'Script');
  async function save(e:any){e.preventDefault();const t=now();await db.tasks.put({id:uid(),title:name,clientId:selectedClient||undefined,dueAt:dueAt||undefined,durationMin:Number(duration||45),urgent:false,completed:false,stage,createdAt:t,updatedAt:t});queueSync();close()}
  return <Modal title={title} close={close}><form className="form progressive-form" onSubmit={save}>
    <label>Titolo<input required autoFocus value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Cliente<select value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}><option value="">Nessuno</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Data <span className="muted">(opzionale)</span><input type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>
    <details className="advanced-fields"><summary>Altre opzioni</summary><div className="form">
      <FieldChips title="Fase" values={stages} value={stage} setValue={setStage}/>
      <label>Durata stimata (min)<input type="number" placeholder="45" value={duration} onChange={e=>setDuration(e.target.value)}/></label>
    </div></details>
    <PrimaryButton type="submit">Salva attività</PrimaryButton>
  </form></Modal>
}

function LeadForm({close}:{close:()=>void}){const [v,setV]=useState({name:'',contact:'',monthlyValue:'',status:'Da contattare' as Lead['status'],nextFollowUpAt:''});async function save(e:any){e.preventDefault();const t=now();await db.leads.put({id:uid(),name:v.name,contact:v.contact,monthlyValue:Number(v.monthlyValue||0),status:v.status,nextFollowUpAt:v.nextFollowUpAt||undefined,createdAt:t,updatedAt:t});queueSync();close()}return <Modal title="Nuovo lead" close={close}><form className="form" onSubmit={save}><label>Nome<input required value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label><label>Contatto<input value={v.contact} onChange={e=>setV({...v,contact:e.target.value})}/></label><label>Valore mensile<input type="number" placeholder="0" value={v.monthlyValue} onChange={e=>setV({...v,monthlyValue:e.target.value})}/></label><label>Stato<select value={v.status} onChange={e=>setV({...v,status:e.target.value as Lead['status']})}>{['Da contattare','Contattato','Appuntamento','Proposta inviata','Acquisito','Perso'].map(x=><option key={x}>{x}</option>)}</select></label><label>Follow-up<input type="date" value={v.nextFollowUpAt} onChange={e=>setV({...v,nextFollowUpAt:e.target.value})}/></label><PrimaryButton type="submit">Salva lead</PrimaryButton></form></Modal>}

function PaymentForm({close}:{close:()=>void}){const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];const [clientId,setClientId]=useState('');const [amount,setAmount]=useState('');const [dueDate,setDueDate]=useState(toDateOnly(new Date()));const [note,setNote]=useState('');async function save(e:any){e.preventDefault();const t=now();await db.payments.put({id:uid(),clientId,amount:Number(amount||0),dueDate,note,createdAt:t,updatedAt:t});queueSync();close()}return <Modal title="Nuovo pagamento" close={close}><form className="form" onSubmit={save}><label>Cliente<select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Seleziona</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Importo<input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Scadenza<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label>Nota<input value={note} onChange={e=>setNote(e.target.value)}/></label><PrimaryButton type="submit">Salva pagamento</PrimaryButton></form></Modal>}

function FieldChips({title,values,value,setValue}:{title:string;values:readonly string[];value:string;setValue:(v:any)=>void}){return <fieldset><legend>{title}</legend><div className="chips">{values.map(v=><Chip key={v} active={value===v} onClick={()=>setValue(v)}>{v}</Chip>)}</div></fieldset>}
function Modal({title,close,children}:{title:string;close:()=>void;children:any}){return <div className="sheet-backdrop" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><div className="sheet-head"><h2>{title}</h2><button className="icon" onClick={close}>✕</button></div><div className="modal-scroll">{children}</div></div></div>}

function PinPad({value,onChange}:{value:string;onChange:(v:string)=>void}){const keys=['1','2','3','4','5','6','7','8','9','','0','⌫'];return <><div className="pin-dots">{[0,1,2,3].map(i=><span key={i} className={value.length>i?'filled':''}/>)}</div><div className="keypad">{keys.map((k,i)=>k?<button key={i} onClick={()=>k==='⌫'?onChange(value.slice(0,-1)):value.length<4&&onChange(value+k)}>{k}</button>:<span key={i}/>)}</div></>}

function LockGate(){
  const settings=useLiveQuery(()=>db.settings.get('settings'),[]); const [unlocked,setUnlocked]=useState(false); const [cinematic,setCinematic]=useState(false); const [mode,setMode]=useState<'unlock'|'setup'|'confirm'|'recovery'|'reset'>('unlock'); const [pin,setPin]=useState(''); const [firstPin,setFirstPin]=useState(''); const [msg,setMsg]=useState('');
  useEffect(()=>{ensureSettings().then(s=>setMode(s.pinHash?'unlock':'setup'))},[]);
  useEffect(()=>{if(pin.length!==4)return;const run=async()=>{setMsg('');if(mode==='unlock'){if(await verifyPin(pin,settings?.pinHash)){setCinematic(true);window.setTimeout(()=>setUnlocked(true),820)}else{setMsg('PIN non corretto');setPin('')}}else if(mode==='recovery'){if(await verifyRecoveryCode(pin)){setPin('');setMode('reset');setMsg('Codice accettato. Imposta un nuovo PIN.')}else{setMsg('Codice di recupero non valido');setPin('')}}else if(mode==='setup'||mode==='reset'){setFirstPin(pin);setPin('');setMode('confirm')}else if(mode==='confirm'){if(pin!==firstPin){setMsg('I PIN non coincidono. Riprova.');setPin('');setMode(settings?.pinHash?'reset':'setup');return}const hash=await makePinHash(pin);await db.settings.update('settings',{pinHash:hash,firstRunDone:true,updatedAt:now()});await syncRemote().catch(()=>{});setCinematic(true);window.setTimeout(()=>setUnlocked(true),820)}};run()},[pin,mode,settings?.pinHash,firstPin]);
  if(unlocked)return <AppShell/>;
  if(cinematic)return <div className="unlock-cinematic" aria-label="Accesso in corso"><div className="cinematic-core"><div className="cinematic-logo">M</div><span className="cinematic-line"/><div className="cinematic-orbit"/></div></div>;
  return <div className={`lock ${msg?'shake':''}`}><div className="lock-card"><div className="logo">M</div><h1>{mode==='unlock'?'Bentornato':mode==='recovery'?'Recupero accesso':mode==='confirm'?'Conferma PIN':'Crea un nuovo PIN'}</h1><p>{mode==='unlock'?'Inserisci il PIN a 4 cifre.':mode==='recovery'?'Inserisci il codice di recupero.':mode==='confirm'?'Ripeti il PIN scelto.':'Scegli un PIN di 4 cifre.'}</p><PinPad value={pin} onChange={setPin}/>{msg&&<p className="error">{msg}</p>}{mode==='unlock'&&<button className="text-btn" onClick={()=>{setPin('');setMode('recovery');setMsg('')}}>Recupero accesso</button>}{mode==='recovery'&&<button className="text-btn" onClick={()=>{setPin('');setMode('unlock');setMsg('')}}>Torna indietro</button>}</div></div>
}

export default function App(){useEffect(()=>{ensureSettings()},[]);const settings=useLiveQuery(()=>db.settings.get('settings'),[]);useEffect(()=>{document.documentElement.dataset.theme=settings?.darkMode?'dark':'light'},[settings?.darkMode]);return <BrowserRouter><LockGate/></BrowserRouter>}
