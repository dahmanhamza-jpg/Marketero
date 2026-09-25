import { db, now, uid } from './db';
import { queueSync } from '../services/sync';

export const LEVELS=[
  {name:'Start',min:0},{name:'Builder',min:120},{name:'Momentum',min:300},{name:'Focused',min:600},{name:'Operator',min:1000},{name:'Mastery',min:1600}
];

export async function award(actionKey:string,points:number,source:'task'|'script'|'workflow'|'focus'|'habit',label?:string){
  const existing=await db.rewards.where('actionKey').equals(actionKey).first();
  if(existing) return {awarded:false,points:0};
  const t=now();
  await db.rewards.put({id:uid(),actionKey,points,source,label,createdAt:t,updatedAt:t});
  queueSync();
  return {awarded:true,points};
}
export function rewardTotal(entries:{points:number;deletedAt?:string|null}[]){return entries.filter(x=>!x.deletedAt).reduce((s,x)=>s+x.points,0);}
export function levelFor(points:number){let index=0;for(let i=0;i<LEVELS.length;i++)if(points>=LEVELS[i].min)index=i;const current=LEVELS[index],next=LEVELS[index+1];const base=current.min,cap=next?.min??current.min+600;return {level:index+1,name:current.name,current:points-base,needed:cap-base,total:points,nextName:next?.name??'—',remaining:Math.max(0,cap-points)};}
export function focusReward(minutes:number){if(minutes>=45)return 30;if(minutes>=25)return 20;if(minutes>=15)return 10;if(minutes>=5)return 5;return 0;}
