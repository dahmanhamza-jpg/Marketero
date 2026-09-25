import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, TimerReset } from 'lucide-react';
import { db, now } from '../lib/db';
import { award } from '../lib/rewards';
import { missingPrevious, scriptProgress, workflowKeys, workflowMeta, workflowSummary, type WorkflowFlag } from '../lib/workflow';
import { queueSync } from '../services/sync';
import type { Client, Script } from '../types/models';
import { Card, ProgressRing, RewardToast, Stat } from './UI';

export function WorkflowBoard({client,scripts}:{client:Client;scripts:Script[]}){
  const [hint,setHint]=useState('');
  const [reward,setReward]=useState(0);
  const summary=workflowSummary(scripts);
  async function toggle(script:Script,key:WorkflowFlag){
    const next=!script[key];
    if(next){const missing=missingPrevious(script,key);if(missing.length)setHint(workflowMeta[key].label+' completato prima di '+missing.map(k=>workflowMeta[k].label).join(', ')+'. Stato salvato comunque.');}
    await db.scripts.update(script.id,{[key]:next,updatedAt:now()});
    if(next){const r=await award('workflow:'+script.id+':'+key,workflowMeta[key].points,'workflow',workflowMeta[key].label+' · '+script.title);if(r.awarded){setReward(r.points);window.setTimeout(()=>setReward(0),1600);}}
    queueSync();
  }
  return <div className='workflow-board'>
    {reward>0&&<RewardToast points={reward}/>}    <Card className='workflow-overview premium-surface'>
      <div className='workflow-overview-main'><div><span className='eyebrow'>PRODUZIONE · {client.name}</span><h2>{summary.total?summary.progress+'% completato':'Nessuno script ancora'}</h2><p>Ogni contenuto avanza con un solo tap. Nessun campo duplicato.</p></div><ProgressRing value={summary.progress} label='mese'/></div>
      <div className='workflow-stats'><Stat value={summary.total} label='Script'/><Stat value={summary.counts.recorded+'/'+summary.total} label='Registrati'/><Stat value={summary.counts.edited+'/'+summary.total} label='Montati'/><Stat value={summary.counts.scheduled+'/'+summary.total} label='Programmati'/><Stat value={summary.counts.published+'/'+summary.total} label='Pubblicati'/></div>
      <div className='workflow-segments' aria-label={'Avanzamento '+summary.progress+'%'}><span style={{width:summary.progress+'%'}}/></div>
      {hint&&<button className='inline-hint' onClick={()=>setHint('')}>{hint} <b>×</b></button>}
    </Card>
    <div className='script-workflow-grid'>
      {scripts.filter(s=>!s.deletedAt).map((s,idx)=><Card className='script-production-card' key={s.id}>
        <div className='script-card-head'><div><span className='script-index'>VIDEO {String(idx+1).padStart(2,'0')}</span><h3>{s.title}</h3><p>{s.platform} · {s.format}</p></div><ProgressRing value={scriptProgress(s)} size={66}/></div>
        <div className='stepper'><div className='workflow-step done'><Check/><span>Script</span></div>{workflowKeys.map(key=><button key={key} className={'workflow-step '+(s[key]?'done':'')} onClick={()=>toggle(s,key)} aria-pressed={!!s[key]}>{s[key]?<Check/>:<Circle/>}<span>{workflowMeta[key].label}</span></button>)}</div>
        <div className='script-card-actions'><Link className='btn soft' to={'/focus?script='+s.id+'&stage=Montaggio&label='+encodeURIComponent('Montaggio · '+s.title)}><TimerReset/> Focus 25</Link></div>
      </Card>)}
    </div>
  </div>;
}
