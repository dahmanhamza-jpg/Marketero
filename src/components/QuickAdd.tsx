import { useState } from 'react';
import { Plus, X } from 'lucide-react';
export function QuickAdd({onSelect}:{onSelect:(v:string)=>void}){
 const [open,setOpen]=useState(false); const opts=[['task','☑️ Task'],['work','📅 Appuntamento lavoro'],['personal','👤 Appuntamento personale'],['content','📹 Contenuto'],['idea','💡 Idea'],['lead','🎯 Lead'],['payment','💰 Pagamento'],['client','👥 Cliente']];
 return <><button className="quick" aria-label="Aggiungi" onClick={()=>setOpen(true)}><Plus/></button>{open&&<div className="sheet-backdrop" onClick={()=>setOpen(false)}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="sheet-head"><strong>Nuovo</strong><button className="icon" onClick={()=>setOpen(false)}><X/></button></div><div className="quick-grid">{opts.map(([v,l])=><button key={v} onClick={()=>{setOpen(false);onSelect(v)}}>{l}</button>)}</div></div></div>}</>
}
