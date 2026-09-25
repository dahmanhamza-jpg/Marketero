import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db, now, uid } from '../lib/db';
import { award } from '../lib/rewards';
import { queueSync } from '../services/sync';
import { Card, Empty, PageHeader, PrimaryButton } from '../components/UI';

const dateKey=(d:Date)=>d.toISOString().slice(0,10);
export function HabitsPage(){
  const habits=useLiveQuery(()=>db.habits.toArray(),[])||[];const completions=useLiveQuery(()=>db.habitCompletions.toArray(),[])||[];const [name,setName]=useState('');const [msg,setMsg]=useState('');
  const active=habits.filter(h=>!h.archived&&!h.deletedAt);
  const days=useMemo(()=>Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d}),[]);
  const previous=useMemo(()=>Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(27-i));return d}),[]);
  async function add(){if(!name.trim())return;if(active.length>=5){setMsg('Mantieni poche abitudini: archivia una delle 5 attive prima di aggiungerne un’altra.');return}const t=now();await db.habits.put({id:uid(),name:name.trim(),createdAt:t,updatedAt:t});setName('');queueSync()}
  async function toggle(habitId:string,date:string){const id=habitId+':'+date;const existing=await db.habitCompletions.get(id);const next=!existing?.completed;const t=now();await db.habitCompletions.put({id,habitId,date,completed:next,createdAt:existing?.createdAt||t,updatedAt:t});if(next)await award('habit:'+habitId+':'+date,5,'habit','Abitudine completata');queueSync()}
  const rate=(habitId:string,range:Date[])=>Math.round(range.filter(d=>completions.some(c=>c.habitId===habitId&&c.date===dateKey(d)&&c.completed&&!c.deletedAt)).length/range.length*100);
  return <main className='page habits-page'><PageHeader eyebrow='CONTINUITÀ, NON PERFEZIONE' title='Abitudini' description='Massimo 5 abitudini attive. Saltare un giorno non azzera nulla.'/><Card className='habit-create'><div><h3>Nuova abitudine</h3><p>Scrivila in modo concreto e breve.</p></div><div className='row'><input value={name} onChange={e=>setName(e.target.value)} placeholder='Es. Pianifica la giornata'/><PrimaryButton onClick={add}><Plus/>Aggiungi</PrimaryButton></div>{msg&&<p className='inline-warning'>{msg}</p>}</Card><div className='habit-list'>{active.map(h=>{const current=rate(h.id,days),prev=rate(h.id,previous),count=Math.round(current/100*14);return <Card key={h.id} className='habit-card'><div className='row spread'><div><span className='eyebrow'>ULTIMI 14 GIORNI</span><h2>{h.name}</h2></div><div className='habit-rate'><strong>{current}%</strong><span>{count}/14 giorni</span></div></div><div className='habit-grid'>{days.map(d=>{const key=dateKey(d),done=completions.some(c=>c.habitId===h.id&&c.date===key&&c.completed&&!c.deletedAt);return <button key={key} className={done?'done':''} onClick={()=>toggle(h.id,key)} title={key}><small>{new Intl.DateTimeFormat('it-IT',{weekday:'narrow'}).format(d)}</small><span>{d.getDate()}</span></button>})}</div><div className='habit-trend'><span>Periodo precedente {prev}%</span><b className={current>=prev?'up':''}>{current>=prev?'↑':'↓'} {Math.abs(current-prev)}%</b><button className='text-btn' onClick={()=>db.habits.update(h.id,{archived:true,updatedAt:now()}).then(()=>queueSync())}>Archivia</button></div></Card>})}{!active.length&&<Empty title='Crea la tua prima abitudine' description='Poche abitudini visibili sono più facili da mantenere.'/>}</div></main>;
}
