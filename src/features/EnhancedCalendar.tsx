import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Clock3, MapPin, Plus, UserRound, X } from 'lucide-react';
import { db, now, uid } from '../lib/db';
import { getConflicts, toDateOnly } from '../lib/logic';
import { queueSync } from '../services/sync';
import type { CalendarEvent, Client, EventKind } from '../types/models';

type ViewMode='Mese'|'Settimana'|'Giorno';

const sameDay=(a:string|Date,b:string|Date)=>toDateOnly(typeof a==='string'?new Date(a):a)===toDateOnly(typeof b==='string'?new Date(b):b);
const dayLabel=(d:Date)=>new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'numeric',month:'short'}).format(d);
const fullDayLabel=(d:Date)=>new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long'}).format(d);
const monthLabel=(d:Date)=>new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(d);
const timeLabel=(e:CalendarEvent)=>e.allDay?'Tutto il giorno':new Date(e.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});

function startOfWeek(value:Date){const d=new Date(value);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;}
function tone(e:CalendarEvent){return e.kind==='Personale'?'personal':'work';}

export function EnhancedCalendar(){
  const events=useLiveQuery(()=>db.events.toArray(),[])||[];
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const [mode,setMode]=useState<ViewMode>('Mese');
  const [filter,setFilter]=useState<'Tutto'|EventKind>('Tutto');
  const [cursor,setCursor]=useState(()=>{
    const q=new URLSearchParams(location.search).get('date');
    const d=q?new Date(q+'T12:00:00'):new Date();
    return Number.isNaN(+d)?new Date():d;
  });
  const [selectedDay,setSelectedDay]=useState<Date|null>(null);
  const [editing,setEditing]=useState<CalendarEvent|null>(null);
  const [creatingDate,setCreatingDate]=useState<Date|null>(null);

  useEffect(()=>{
    const q=new URLSearchParams(location.search).get('date');
    if(!q)return;
    const d=new Date(q+'T12:00:00');
    if(!Number.isNaN(+d)){setCursor(d);setSelectedDay(d);}
  },[]);

  const visible=events.filter(e=>!e.deletedAt&&(filter==='Tutto'||e.kind===filter));
  const range=useMemo(()=>{
    if(mode==='Giorno')return [new Date(cursor)];
    if(mode==='Settimana'){const s=startOfWeek(cursor);return Array.from({length:7},(_,i)=>{const d=new Date(s);d.setDate(s.getDate()+i);return d});}
    return [] as Date[];
  },[mode,cursor]);

  function shift(delta:number){
    const d=new Date(cursor);
    if(mode==='Mese')d.setMonth(d.getMonth()+delta);
    else if(mode==='Settimana')d.setDate(d.getDate()+delta*7);
    else d.setDate(d.getDate()+delta);
    setCursor(d);
  }

  return <div className="mk-calendar-layer">
    <main className="mk-calendar-page">
      <header className="mk-calendar-header">
        <div><span className="eyebrow">TEMPO E PRIORITÀ</span><h1>Calendario</h1><p>Più leggibile da iPhone, collegato ai clienti.</p></div>
        <button className="btn primary" onClick={()=>setCreatingDate(new Date())}><Plus size={17}/> Evento</button>
      </header>

      <section className="mk-calendar-toolbar card">
        <div className="mk-period-nav">
          <button className="mk-icon-btn" aria-label="Periodo precedente" onClick={()=>shift(-1)}><ChevronLeft/></button>
          <button className="mk-period-label" onClick={()=>setCursor(new Date())}><small>PERIODO</small><strong>{mode==='Mese'?monthLabel(cursor):mode==='Settimana'?`Settimana · ${dayLabel(startOfWeek(cursor))}`:fullDayLabel(cursor)}</strong></button>
          <button className="mk-icon-btn" aria-label="Periodo successivo" onClick={()=>shift(1)}><ChevronRight/></button>
        </div>
        <div className="mk-calendar-actions">
          <div className="mk-segment">{(['Giorno','Settimana','Mese'] as ViewMode[]).map(x=><button key={x} className={mode===x?'active':''} onClick={()=>setMode(x)}>{x}</button>)}</div>
          <button className="btn ghost" onClick={()=>setCursor(new Date())}>Oggi</button>
        </div>
        <div className="mk-kind-filter">
          {(['Tutto','Lavoro','Personale'] as const).map(x=><button key={x} className={filter===x?'active '+x.toLowerCase():''} onClick={()=>setFilter(x)}>{x}</button>)}
        </div>
      </section>

      {mode==='Mese'?<MonthView cursor={cursor} events={visible} clients={clients} onDay={d=>{setSelectedDay(d);setCursor(d)}} onEvent={setEditing}/>:<AgendaRange days={range} events={visible} clients={clients} onEvent={setEditing} onCreate={setCreatingDate}/>} 
    </main>

    {selectedDay&&createPortal(<DayDrawer date={selectedDay} events={visible} clients={clients} close={()=>setSelectedDay(null)} onEdit={e=>{setSelectedDay(null);setEditing(e)}} onCreate={d=>{setSelectedDay(null);setCreatingDate(d)}}/>,document.body)}
    {(editing||creatingDate)&&createPortal(<EventComposer event={editing||undefined} initialDate={creatingDate||undefined} clients={clients} allEvents={events} close={()=>{setEditing(null);setCreatingDate(null)}}/>,document.body)}
  </div>;
}

function MonthView({cursor,events,clients,onDay,onEvent}:{cursor:Date;events:CalendarEvent[];clients:Client[];onDay:(d:Date)=>void;onEvent:(e:CalendarEvent)=>void}){
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);
  const start=startOfWeek(first);
  const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
  return <section className="mk-month card">
    <div className="mk-month-head">{['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(x=><b key={x}>{x}</b>)}</div>
    <div className="mk-month-grid">{days.map(d=>{
      const es=events.filter(e=>sameDay(e.startAt,d)).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
      const muted=d.getMonth()!==cursor.getMonth();
      const today=sameDay(d,new Date());
      return <div key={d.toISOString()} className={'mk-day '+(muted?'muted ':'')+(today?'today':'')}>
        <button className="mk-day-hit" onClick={()=>onDay(new Date(d))} aria-label={fullDayLabel(d)}>
          <span>{d.getDate()}</span>{es.length>0&&<small>{es.length}</small>}
        </button>
        <div className="mk-day-events">{es.slice(0,2).map(e=>{const c=clients.find(x=>x.id===e.clientId);return <button key={e.id} className={'mk-mini-event '+tone(e)} onClick={ev=>{ev.stopPropagation();onEvent(e)}} title={`${timeLabel(e)} · ${e.title}`}><i/><span>{e.title}</span>{c&&<small>{c.name}</small>}</button>})}{es.length>2&&<button className="mk-more" onClick={()=>onDay(new Date(d))}>+{es.length-2}</button>}</div>
      </div>;
    })}</div>
  </section>;
}

function AgendaRange({days,events,clients,onEvent,onCreate}:{days:Date[];events:CalendarEvent[];clients:Client[];onEvent:(e:CalendarEvent)=>void;onCreate:(d:Date)=>void}){
  return <section className="mk-agenda-range">{days.map(d=>{
    const es=events.filter(e=>sameDay(e.startAt,d)).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
    return <div className="mk-agenda-day card" key={d.toISOString()}>
      <div className="mk-agenda-day-head"><div><span className="eyebrow">{sameDay(d,new Date())?'OGGI':'GIORNO'}</span><h3>{fullDayLabel(d)}</h3></div><button className="mk-icon-btn" onClick={()=>onCreate(d)} aria-label="Aggiungi evento"><Plus/></button></div>
      <div className="mk-agenda-list">{es.map(e=><AgendaItem key={e.id} event={e} client={clients.find(c=>c.id===e.clientId)} onClick={()=>onEvent(e)}/>)}{!es.length&&<p className="mk-free-day">Nessun impegno. Tocca + per aggiungerne uno.</p>}</div>
    </div>;
  })}</section>;
}

function AgendaItem({event,client,onClick}:{event:CalendarEvent;client?:Client;onClick:()=>void}){
  return <button className={'mk-agenda-item '+tone(event)} onClick={onClick}><span className="mk-time">{timeLabel(event)}</span><span className="mk-agenda-copy"><b>{event.title}</b><small>{event.category}{client?' · '+client.name:''}</small></span><span className="mk-kind-badge">{event.kind}</span></button>;
}

function DayDrawer({date,events,clients,close,onEdit,onCreate}:{date:Date;events:CalendarEvent[];clients:Client[];close:()=>void;onEdit:(e:CalendarEvent)=>void;onCreate:(d:Date)=>void}){
  const list=events.filter(e=>sameDay(e.startAt,date)).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
  return <div className="mk-overlay" onClick={close}><section className="mk-drawer" onClick={e=>e.stopPropagation()}>
    <header className="mk-drawer-head"><div><span className="eyebrow">AGENDA</span><h2>{fullDayLabel(date)}</h2></div><button className="mk-close" onClick={close}><X/></button></header>
    <button className="btn primary mk-add-day" onClick={()=>onCreate(date)}><Plus size={17}/> Aggiungi evento</button>
    <div className="mk-agenda-list">{list.map(e=><AgendaItem key={e.id} event={e} client={clients.find(c=>c.id===e.clientId)} onClick={()=>onEdit(e)}/>)}{!list.length&&<div className="mk-empty"><Clock3/><b>Giornata libera</b><span>Nessun appuntamento o attività.</span></div>}</div>
  </section></div>;
}

function EventComposer({event,initialDate,clients,allEvents,close}:{event?:CalendarEvent;initialDate?:Date;clients:Client[];allEvents:CalendarEvent[];close:()=>void}){
  const initial=new Date(event?.startAt||initialDate||new Date());
  const [kind,setKind]=useState<EventKind>(event?.kind||'Lavoro');
  const [title,setTitle]=useState(event?.title||'');
  const [date,setDate]=useState(toDateOnly(initial));
  const [time,setTime]=useState(event&&!event.allDay?new Date(event.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'');
  const [clientId,setClientId]=useState(event?.clientId||'');
  const [category,setCategory]=useState(event?.category||(event?.kind==='Personale'?'Personale':'Appuntamento'));
  const [notes,setNotes]=useState(event?.notes||'');
  const workCategories=['Appuntamento','Registrazione','Montaggio','Programmazione','Pubblicazione'];

  function chooseKind(next:EventKind){setKind(next);if(next==='Personale'){setClientId('');setCategory('Personale')}else if(category==='Personale')setCategory('Appuntamento');}
  async function save(e:React.FormEvent){
    e.preventDefault();
    const t=now();
    const startAt=time?new Date(`${date}T${time}:00`).toISOString():new Date(`${date}T00:00:00`).toISOString();
    const candidate:CalendarEvent={id:event?.id||uid(),title:title.trim(),kind,category:kind==='Personale'?'Personale':category,startAt,allDay:!time,clientId:kind==='Lavoro'&&clientId?clientId:undefined,notes:notes||undefined,createdAt:event?.createdAt||t,updatedAt:t};
    const conflicts=getConflicts(candidate,allEvents.filter(x=>x.id!==candidate.id));
    if(time&&conflicts.length&&!confirm(`Conflitto con: ${conflicts.map(x=>x.kind==='Personale'?'Fascia occupata':x.title).join(', ')}. Salvare comunque?`))return;
    await db.events.put(candidate);queueSync();close();
  }
  async function remove(){if(!event)return;if(confirm('Eliminare questo evento?')){await db.events.update(event.id,{deletedAt:now(),updatedAt:now()});queueSync();close();}}

  return <div className="mk-overlay mk-event-overlay" onClick={close}><section className="mk-event-composer" onClick={e=>e.stopPropagation()}>
    <header className="mk-drawer-head"><div><span className="eyebrow">{event?'MODIFICA':'NUOVO EVENTO'}</span><h2>{event?'Aggiorna appuntamento':'Aggiungi in pochi secondi'}</h2></div><button className="mk-close" onClick={close}><X/></button></header>
    <form onSubmit={save} className="mk-event-form">
      <div className="mk-kind-switch"><button type="button" className={kind==='Lavoro'?'active work':''} onClick={()=>chooseKind('Lavoro')}>Lavoro</button><button type="button" className={kind==='Personale'?'active personal':''} onClick={()=>chooseKind('Personale')}>Personale</button></div>
      <label>Titolo<input autoFocus required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Es. Registrazione Club House"/></label>
      <div className="mk-form-row"><label>Data<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Ora <small>opzionale</small><input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></div>
      {kind==='Lavoro'&&<label>Cliente <small>opzionale ma consigliato</small><select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Nessun cliente</option>{clients.filter(c=>!c.deletedAt).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      {kind==='Lavoro'&&<fieldset><legend>Categoria</legend><div className="mk-category-chips">{workCategories.map(x=><button type="button" key={x} className={category===x?'active':''} onClick={()=>setCategory(x)}>{x}</button>)}</div></fieldset>}
      <details className="mk-event-more"><summary>Note e dettagli</summary><label>Note<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Dettagli utili…"/></label></details>
      <button className="btn primary mk-save-event" type="submit">Salva evento</button>
      {event&&<button className="btn danger-quiet" type="button" onClick={remove}>Elimina evento</button>}
    </form>
  </section></div>;
}
