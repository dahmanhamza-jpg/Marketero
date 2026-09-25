import type { Script } from '../types/models';
export const workflowKeys=['recorded','edited','scheduled','published'] as const;
export type WorkflowFlag=typeof workflowKeys[number];
export const workflowMeta={
  recorded:{label:'Registrazione',short:'Registrati',points:10},
  edited:{label:'Montaggio',short:'Montati',points:15},
  scheduled:{label:'Programmazione',short:'Programmati',points:10},
  published:{label:'Pubblicato',short:'Pubblicati',points:15}
} as const;
export function scriptProgress(s:Script){const done=1+workflowKeys.filter(k=>!!s[k]).length;return Math.round(done/5*100);}
export function workflowSummary(scripts:Script[]){const active=scripts.filter(s=>!s.deletedAt);const total=active.length;const counts=Object.fromEntries(workflowKeys.map(k=>[k,active.filter(s=>!!s[k]).length])) as Record<WorkflowFlag,number>;const completedSteps=total+Object.values(counts).reduce((a,b)=>a+b,0);return {total,counts,progress:total?Math.round(completedSteps/(total*5)*100):0};}
export function missingPrevious(s:Script,key:WorkflowFlag){const i=workflowKeys.indexOf(key);if(i<=0)return [];return workflowKeys.slice(0,i).filter(k=>!s[k]);}
