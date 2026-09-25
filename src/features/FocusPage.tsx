import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pause, Play, Square, TimerReset } from 'lucide-react';
import { db, now, uid } from '../lib/db';
import { award, focusReward, levelFor, rewardTotal } from '../lib/rewards';
import { queueSync } from '../services/sync';
import type { WorkflowStage } from '../types/models';
import { Card, Chip, PageHeader, PrimaryButton, ProgressRing, RewardToast, Stat } from '../components/UI';

const durations=[5,10,15,20,25,30,35,40,45];
export function FocusPage(){
  const [params]=useSearchParams();
  const tasks=useLiveQuery(()=>db.tasks.toArray(),[])||[];
  const sessions=useLiveQuery(()=>db.focusSessions.toArray(),[])||[];
  const rewards=useLiveQuery(()=>db.rewards.toArray(),[])||[];
  const [minutes,setMinutes]=useState(25);const [taskId,setTaskId]=useState(params.get('task')||'');const [running,setRunning]=useState(false);const [paused,setPaused]=useState(false);const [remaining,setRemaining]=useState(25*60);const [startedAt,setStartedAt]=useState('');const [earned,setEarned]=useState(0);const [finished,setFinished]=useState(false);
  const scriptId=params.get('script')||undefined;const workflowStage=(params.get('stage')||undefined) as FocusStage|undefined;const label=params.get('label')||tasks.find(t=>t.id===taskId)?.title||'Sessione Focus';
  useEffect(()=>{if(!running||paused)return;const id=window.setInterval(()=>setRemaining(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(id)},[running,paused]);
  useEffect(()=>{if(running&&remaining===0)finish(true)},[remaining,running]);
  useEffect(()=>{if(!running)setRemaining(minutes*60)},[minutes,running]);
  const total=rewardTotal(rewards),level=levelFor(total);
  const today=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return sessions.filter(s=>new Date(s.startedAt)>=d&&!s.deletedAt).reduce((a,s)=>a+s.completedMinutes,0)},[sessions]);
  const week=useMemo(()=>{const d=new Date();d.setDate(d.getDate()-6);d.setHours(0,0,0,0);return sessions.filter(s=>new Date(s.startedAt)>=d&&!s.deletedAt).reduce((a,s)=>a+s.completedMinutes,0)},[sessions]);
  function start(){setStartedAt(now());setRemaining(minutes*60);setRunning(true);setPaused(false);setFinished(false);setEarned(0)}
  async function finish(natural=false){if(!running&&!natural)return;const completed=Math.max(0,Math.round((minutes*60-remaining)/60));const id=uid(),t=now();await db.focusSessions.put({id,plannedMinutes:minutes,completedMinutes:completed,startedAt:startedAt||t,endedAt:t,taskId:taskId||undefined,scriptId,workflowStage,label,createdAt:t,updatedAt:t});const pts=focusReward(completed);if(pts){const r=await award('focus:'+id,pts,'focus',label);if(r.awarded)setEarned(pts)}queueSync();setRunning(false);setPaused(false);setFinished(true)}
  async function completeLinked(){if(scriptId&&workflowStage){const field=workflowStage==='Registrazione'?'recorded':workflowStage==='Montaggio'?'edited':workflowStage==='Programmazione'?'scheduled':'published';await db.scripts.update(scriptId,{[field]:true,updatedAt:now()} as any);queueSync()}if(taskId){await db.tasks.update(taskId,{completed:true,updatedAt:now()});queueSync()}setFinished(false)}
  if(running)return <main className='page focus-page focus-active'><div className='focus-orb'/><div className='focus-stage'><span className='eyebrow'>FOCUS IN CORSO</span><div className='focus-clock'>{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</div><h2>{label}</h2><div className='focus-progress'><span style={{width:(100-remaining/(minutes*60)*100)+'%'}}/></div><div className='focus-controls'><button className='btn soft' onClick={()=>setPaused(!paused)}>{paused?<><Play/>Riprendi</>:<><Pause/>Pausa</>}</button><button className='btn dark' onClick={()=>finish(false)}><Square/>Termina</button></div></div></main>;
  return <main className='page focus-page'><PageHeader eyebrow='TEMPO PROTETTO' title='Focus' description='Una cosa alla volta, con il tempo sempre visibile.'/><div className='focus-layout'><Card className='focus-launch premium-surface'><div className='focus-launch-top'><div><span className='eyebrow'>SESSIONE</span><h2>{minutes} minuti</h2></div><TimerReset/></div><div className='chips focus-duration'>{durations.map(m=><Chip key={m} active={minutes===m} onClick={()=>setMinutes(m)}>{m}</Chip>)}</div><label className='focus-task'>Attività opzionale<select value={taskId} onChange={e=>setTaskId(e.target.value)}><option value=''>Focus libero</option>{tasks.filter(t=>!t.completed&&!t.deletedAt).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><PrimaryButton className='focus-start' onClick={start}>Inizia Focus</PrimaryButton></Card><Card className='level-card'><div className='row spread'><div><span className='eyebrow'>DOPAMINA · PUNTI SIMBOLICI</span><h2>Livello {level.level} · {level.name}</h2></div><ProgressRing value={Math.round(level.current/level.needed*100)} size={84}/></div><p><b>{total}</b> punti totali · {level.remaining} al prossimo livello</p></Card><div className='focus-stats'><Stat value={today+' min'} label='Oggi'/><Stat value={Math.floor(week/60)+'h '+week%60+'m'} label='Ultimi 7 giorni'/></div></div>{earned>0&&<RewardToast points={earned}/>} {finished&&<Card className='focus-finished'><span className='eyebrow'>SESSIONE SALVATA</span><h2>Focus completato</h2><p>{earned?('+'+earned+' Dopamina · '):''}progressi registrati senza penalità.</p>{(taskId||scriptId)&&<div className='row'><PrimaryButton onClick={completeLinked}>Segna attività completata</PrimaryButton><button className='btn soft' onClick={()=>setFinished(false)}>Non ancora</button></div>}</Card>}</main>;
}
type FocusStage=Extract<WorkflowStage,'Registrazione'|'Montaggio'|'Programmazione'|'Pubblicato'>;
