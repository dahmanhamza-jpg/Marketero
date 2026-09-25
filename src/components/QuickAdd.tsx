import { useState } from 'react';
import { CalendarPlus, CircleDollarSign, FileText, Lightbulb, ListTodo, Plus, Sparkles, UserPlus, Users, X } from 'lucide-react';

const actions=[
  {key:'client',title:'Cliente',desc:'Crea una nuova scheda',icon:Users,tone:'orange'},
  {key:'appointment',title:'Appuntamento',desc:'Scegli lavoro o personale',icon:CalendarPlus,tone:'dark'},
  {key:'task',title:'Task',desc:'Aggiungi una cosa da fare',icon:ListTodo,tone:'warm'},
  {key:'lead',title:'Lead',desc:'Salva un potenziale cliente',icon:UserPlus,tone:'neutral'},
  {key:'script',title:'Script',desc:'Inizia un nuovo contenuto',icon:FileText,tone:'orange'},
  {key:'idea',title:'Idea',desc:'Cattura uno spunto',icon:Lightbulb,tone:'light'},
  {key:'payment',title:'Pagamento',desc:'Registra una scadenza',icon:CircleDollarSign,tone:'neutral'},
  {key:'content',title:'Produzione',desc:'Aggiungi attività contenuto',icon:Sparkles,tone:'warm'}
] as const;

export function QuickAdd({onSelect}:{onSelect:(v:string)=>void}){
  const [open,setOpen]=useState(false);
  return <>
    <button className="quick" aria-label="Apri azioni rapide" onClick={()=>setOpen(true)}><Plus/></button>
    {open&&<div className="sheet-backdrop" onClick={()=>setOpen(false)}>
      <div className="sheet quick-sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-head">
          <div><span className="eyebrow">AZIONI RAPIDE</span><h2>Crea</h2></div>
          <button className="icon" aria-label="Chiudi" onClick={()=>setOpen(false)}><X/></button>
        </div>
        <div className="quick-grid">
          {actions.map(a=>{const Icon=a.icon;return <button key={a.key} className={'quick-action '+a.tone} onClick={()=>{setOpen(false);onSelect(a.key)}}>
            <span className="quick-icon"><Icon/></span>
            <span><strong>{a.title}</strong><small>{a.desc}</small></span>
          </button>})}
        </div>
      </div>
    </div>}
  </>
}
