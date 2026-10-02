import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Pencil, Save, Trash2, X } from 'lucide-react';
import { db, now } from '../lib/db';
import { queueSync } from '../services/sync';
import type { Client, Platform } from '../types/models';

export function ClientManager(){
  const location=useLocation();
  const navigate=useNavigate();
  const match=location.pathname.match(/^\/clienti\/([^/]+)$/);
  const clientId=match?.[1];
  const client=useLiveQuery(()=>clientId?db.clients.get(clientId):undefined,[clientId]);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    setOpen(false);
    if(!clientId){setHost(null);return;}
    let cancelled=false;
    let frame=0;
    let tries=0;
    const findHost=()=>{
      if(cancelled)return;
      const el=document.querySelector('.client-hero') as HTMLElement|null;
      if(el){setHost(el);return;}
      if(tries++<30)frame=requestAnimationFrame(findHost);
    };
    frame=requestAnimationFrame(findHost);
    return()=>{cancelled=true;cancelAnimationFrame(frame)};
  },[clientId]);

  if(!client||client.deletedAt)return null;

  return <>
    {host&&createPortal(<button className="client-manage-trigger" type="button" onClick={()=>setOpen(true)} aria-label="Modifica cliente" title="Modifica cliente"><Pencil/></button>,host)}
    {open&&createPortal(<ClientEditor client={client} close={()=>setOpen(false)} afterDelete={()=>navigate('/clienti')}/>,document.body)}
  </>;
}

function ClientEditor({client,close,afterDelete}:{client:Client;close:()=>void;afterDelete:()=>void}){
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [saving,setSaving]=useState(false);
  const [v,setV]=useState({
    name:client.name||'',
    niche:client.niche||'',
    email:client.email||'',
    phone:client.phone||'',
    instagram:client.instagram||'',
    tiktok:client.tiktok||'',
    monthlyFee:String(client.monthlyFee||0),
    contentTarget:String(client.contentTarget||0),
    startDate:client.startDate||'',
    objective:client.objective||'',
    tone:client.tone||'',
    metaAds:!!client.metaAds
  });

  async function save(e:React.FormEvent){
    e.preventDefault();
    if(!v.name.trim())return;
    setSaving(true);
    const platforms:Platform[]=[];
    if(v.instagram.trim())platforms.push('Instagram');
    if(v.tiktok.trim())platforms.push('TikTok');
    await db.clients.update(client.id,{
      name:v.name.trim(),niche:v.niche.trim()||'Altro',email:v.email.trim()||undefined,phone:v.phone.trim()||undefined,
      instagram:v.instagram.trim()||undefined,tiktok:v.tiktok.trim()||undefined,monthlyFee:Number(v.monthlyFee||0),
      contentTarget:Number(v.contentTarget||0),startDate:v.startDate||undefined,objective:v.objective.trim()||undefined,
      tone:v.tone.trim()||undefined,metaAds:v.metaAds,platforms,updatedAt:now()
    });
    queueSync();
    setSaving(false);
    close();
  }

  async function removeClient(){
    const stamp=now();
    setSaving(true);
    await db.clients.update(client.id,{deletedAt:stamp,updatedAt:stamp});
    for(const table of ['scripts','ideas','tasks','events','payments','followers','strategies'] as const){
      await (db as any)[table].where('clientId').equals(client.id).modify({deletedAt:stamp,updatedAt:stamp});
    }
    queueSync();
    setSaving(false);
    close();
    afterDelete();
  }

  return <div className="client-editor-overlay" onClick={close}>
    <section className="client-editor" onClick={e=>e.stopPropagation()}>
      <header className="client-editor-head"><div><span className="eyebrow">GESTIONE CLIENTE</span><h2>{client.name}</h2><p>Modifica i dati principali oppure elimina il cliente dal tuo spazio.</p></div><button className="client-editor-close" type="button" onClick={close}><X/></button></header>
      <form className="client-editor-form" onSubmit={save}>
        <div className="client-editor-grid">
          <label>Nome cliente<input required value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label>
          <label>Settore / nicchia<input value={v.niche} onChange={e=>setV({...v,niche:e.target.value})}/></label>
          <label>Email<input type="email" value={v.email} onChange={e=>setV({...v,email:e.target.value})} placeholder="email@cliente.it"/></label>
          <label>Telefono<input inputMode="tel" value={v.phone} onChange={e=>setV({...v,phone:e.target.value})} placeholder="Telefono"/></label>
          <label>Compenso mensile (€)<input type="number" inputMode="decimal" min="0" value={v.monthlyFee} onChange={e=>setV({...v,monthlyFee:e.target.value})}/></label>
          <label>Target contenuti / mese<input type="number" inputMode="numeric" min="0" value={v.contentTarget} onChange={e=>setV({...v,contentTarget:e.target.value})}/></label>
          <label>Data inizio<input type="date" value={v.startDate} onChange={e=>setV({...v,startDate:e.target.value})}/></label>
          <label>Instagram<input value={v.instagram} onChange={e=>setV({...v,instagram:e.target.value})} placeholder="@profilo"/></label>
          <label>TikTok<input value={v.tiktok} onChange={e=>setV({...v,tiktok:e.target.value})} placeholder="@profilo"/></label>
          <label className="client-editor-check"><input type="checkbox" checked={v.metaAds} onChange={e=>setV({...v,metaAds:e.target.checked})}/><span><b>Meta Ads</b><small>Cliente con campagne Meta attive</small></span></label>
        </div>
        <label>Obiettivo<input value={v.objective} onChange={e=>setV({...v,objective:e.target.value})} placeholder="Obiettivo principale"/></label>
        <label>Tono di voce<input value={v.tone} onChange={e=>setV({...v,tone:e.target.value})} placeholder="Es. diretto e professionale"/></label>
        <div className="client-editor-actions"><button type="button" className="btn ghost" onClick={close}>Annulla</button><button type="submit" className="btn primary" disabled={saving||!v.name.trim()}><Save/> Salva modifiche</button></div>
      </form>

      <div className="client-danger-zone">
        {!confirmDelete?<button type="button" className="client-delete-button" onClick={()=>setConfirmDelete(true)}><Trash2/><span><b>Elimina cliente</b><small>Rimuove anche contenuti, eventi e pagamenti collegati dalla vista operativa.</small></span></button>:
        <div className="client-delete-confirm"><AlertTriangle/><div><b>Eliminare {client.name}?</b><p>Cliente e dati collegati verranno rimossi da Marketero. Il backup resta il modo più sicuro per recuperare dati cancellati.</p><div><button type="button" className="btn ghost" onClick={()=>setConfirmDelete(false)}>Annulla</button><button type="button" className="btn danger" disabled={saving} onClick={removeClient}>Elimina definitivamente</button></div></div></div>}
      </div>
    </section>
  </div>;
}
