import type { Script } from '../types/models';
export function scriptText(s:Script){ return `${s.title}\n\nHOOK\n${s.hook||''}\n\nTESTO\n${s.body||''}\n\nCTA\n${s.cta||''}\n\nNOTE REGISTRAZIONE\n${s.recordingNotes||''}`.trim(); }
export function downloadText(name:string,text:string,type='text/plain'){ const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
