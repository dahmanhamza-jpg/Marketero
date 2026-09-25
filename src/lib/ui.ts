import type { WorkflowStage } from '../types/models';
import { localDate } from './logic';

export const WORKFLOW:WorkflowStage[]=['Lead','Script','Registrazione','Montaggio','Programmazione','Pubblicato'];
const pad=(n:number)=>String(n).padStart(2,'0');
export const inputDate=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const fmtDate=(v:string|Date,opts:Intl.DateTimeFormatOptions={day:'numeric',month:'short'})=>
  new Intl.DateTimeFormat('it-IT',opts).format(typeof v==='string'?localDate(v):v);
