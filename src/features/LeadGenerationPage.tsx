import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, ExternalLink, Filter, Flame, MapPin, Phone, Radar, RefreshCw, Rocket, SlidersHorizontal, Sparkles, UserRoundCheck, X } from 'lucide-react';
import { db, now, uid } from '../lib/db';
import { award } from '../lib/rewards';
import { queueSync } from '../services/sync';
import { discoverLeads } from '../services/leadGeneration';
import type { Client, Lead, LeadBudgetBand, LeadPriority, LeadSalesStatus, LeadType, Platform } from '../types/models';
import './LeadGenerationPage.css';

const SALES_STATUSES:LeadSalesStatus[]=['Da valutare','Salvato','Contattato','Ha risposto','Interessato','Appuntamento fissato','Preventivo inviato','Da richiamare','Acquisito','Scartato'];
const EXP:Partial<Record<LeadSalesStatus,number>>={'Contattato':10,'Ha risposto':20,'Interessato':40,'Appuntamento fissato':75,'Preventivo inviato':100,'Acquisito':300};
const BANDS:LeadBudgetBand[]=['BASSA','MEDIA','ALTA','MOLTO ALTA'];
const PRIORITIES:LeadPriority[]=['HOT','MEDIUM','LOW'];

function sameDate(value?:string,date=new Date()){if(!value)return false;const d=new Date(value);return d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate();}
function since(days:number){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(days-1));return d;}
function clampScore(v?:number){return typeof v==='number'?Math.max(0,Math.min(100,Math.round(v))):null;}
function budgetLabel(score?:number,band?:LeadBudgetBand){if(band)return band;if(score==null)return 'NON VERIFICATO';return score>=82?'MOLTO ALTA':score>=65?'ALTA':score>=45?'MEDIA':'BASSA';}
function priorityFor(lead:Lead):LeadPriority{if(lead.priority)return lead.priority;const s=lead.opportunityScore||0;return s>=80?'HOT':s>=60?'MEDIUM':'LOW';}
function legacyStatus(status:LeadSalesStatus):Lead['status']{if(status==='Acquisito')return 'Acquisito';if(status==='Scartato')return 'Perso';if(status==='Appuntamento fissato')return 'Appuntamento';if(status==='Preventivo inviato')return 'Proposta inviata';if(['Contattato','Ha risposto','Interessato','Da richiamare'].includes(status))return 'Contattato';return 'Da contattare';}
function phoneFor(lead:Lead){return lead.mobile||lead.phone||lead.contact||'';}
function cleanTel(v:string){return v.replace(/[^+\d]/g,'');}
function norm(v?:string){return (v||'').toLowerCase().trim();}
function salesLevel(total:number){const steps=[0,150,400,750,1200,1800,2600,3600];let i=0;for(let x=0;x<steps.length;x++)if(total>=steps[x])i=x;const start=steps[i],next=steps[i+1]??start+1200;return {level:i+1,current:total-start,needed:next-start,total,remaining:Math.max(0,next-total)};}

export function LeadGenerationPage(){
  const leads=useLiveQuery(()=>db.leads.toArray(),[])||[];
  const clients=useLiveQuery(()=>db.clients.toArray(),[])||[];
  const rewards=useLiveQuery(()=>db.rewards.toArray(),[])||[];
  const [radius,setRadius]=useState(30);
  const [loading,setLoading]=useState(false);
  const [providerMessage,setProviderMessage]=useState('');
  const [bestOnly,setBestOnly]=useState(true);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [detail,setDetail]=useState<Lead|null>(null);
  const [followUp,setFollowUp]=useState<Lead|null>(null);
  const [filters,setFilters]=useState({category:'',type:'' as ''|LeadType,priority:'' as ''|LeadPriority,budget:'' as ''|LeadBudgetBand,status:'' as ''|LeadSalesStatus,service:'',opening:'',web:'',social:'',contacted:'',sort:'opportunity'});

  const active=leads.filter(l=>!l.deletedAt);
  const leadRewards=rewards.filter(r=>!r.deletedAt&&r.source==='lead');
  const expTotal=leadRewards.reduce((s,r)=>s+r.points,0);const lvl=salesLevel(expTotal);
  const categories=[...new Set(active.map(x=>x.category).filter(Boolean) as string[])].sort();
  const services=[...new Set(active.map(x=>x.recommendedService).filter(Boolean) as string[])].sort();
  const todayNew=active.filter(l=>sameDate(l.discoveredAt||l.createdAt)).length;

  const shown=useMemo(()=>{
    let xs=active.slice();
    if(bestOnly)xs=xs.filter(l=>(l.opportunityScore||0)>=60&&!['Scartato','Acquisito'].includes(l.salesStatus||'Da valutare'));
    xs=xs.filter(l=>(l.distanceKm??999)<=radius);
    if(filters.category)xs=xs.filter(l=>l.category===filters.category);
    if(filters.type)xs=xs.filter(l=>l.leadType===filters.type);
    if(filters.priority)xs=xs.filter(l=>priorityFor(l)===filters.priority);
    if(filters.budget)xs=xs.filter(l=>budgetLabel(l.budgetScore,l.budgetBand)===filters.budget);
    if(filters.status)xs=xs.filter(l=>(l.salesStatus||'Da valutare')===filters.status);
    if(filters.service)xs=xs.filter(l=>l.recommendedService===filters.service);
    if(filters.opening==='new')xs=xs.filter(l=>l.isNewOpening);
    if(filters.opening==='soon')xs=xs.filter(l=>l.isOpeningSoon);
    if(filters.web==='missing')xs=xs.filter(l=>l.websiteStatus==='Assente'||!l.website);
    if(filters.web==='weak')xs=xs.filter(l=>['Debole','Da rifare'].includes(l.websiteStatus||''));
    if(filters.social==='missing')xs=xs.filter(l=>l.socialStatus==='Assenti');
    if(filters.social==='weak')xs=xs.filter(l=>['Deboli','Inattivi'].includes(l.socialStatus||''));
    if(filters.contacted==='yes')xs=xs.filter(l=>!!l.contacted||!['Da valutare','Salvato'].includes(l.salesStatus||'Da valutare'));
    if(filters.contacted==='no')xs=xs.filter(l=>!l.contacted&&['Da valutare','Salvato'].includes(l.salesStatus||'Da valutare'));
    xs.sort((a,b)=>filters.sort==='near'?(a.distanceKm??999)-(b.distanceKm??999):filters.sort==='far'?(b.distanceKm??0)-(a.distanceKm??0):filters.sort==='budget'?(b.budgetScore??0)-(a.budgetScore??0):filters.sort==='timing'?(b.timingScore??0)-(a.timingScore??0):filters.sort==='recent'?+new Date(b.discoveredAt||b.createdAt)-+new Date(a.discoveredAt||a.createdAt):(b.opportunityScore??0)-(a.opportunityScore??0));
    return xs;
  },[active,bestOnly,filters,radius]);

  function metrics(days:number){
    const start=since(days);
    const entries=active.flatMap(l=>(l.statusHistory||[]).map(h=>({...h,leadId:l.id}))).filter(x=>new Date(x.at)>=start);
    const unique=(status:LeadSalesStatus)=>new Set(entries.filter(x=>x.status===status).map(x=>x.leadId)).size;
    const newLeads=active.filter(l=>new Date(l.discoveredAt||l.createdAt)>=start).length;
    const acquired=unique('Acquisito'),contacted=unique('Contattato'),replies=unique('Ha risposto');
    const periodExp=leadRewards.filter(r=>new Date(r.createdAt)>=start).reduce((s,r)=>s+r.points,0);
    return {newLeads,contacted,replies,interested:unique('Interessato'),appointments:unique('Appuntamento fissato'),quotes:unique('Preventivo inviato'),acquired,rate:contacted?Math.round(acquired/contacted*100):0,exp:periodExp};
  }
  const today=metrics(1),week=metrics(7),month=metrics(30);

  async function runDiscovery(){
    setLoading(true);setProviderMessage('');
    try{const out=await discoverLeads(radius);setProviderMessage(out.response.configured?`${out.created} nuovi lead · ${out.updated} aggiornati${out.response.partialErrors?` · ${out.response.partialErrors} fonti parziali`:''}`:out.response.message||'Nessuna fonte Lead collegata');}
    catch(e:any){setProviderMessage(e?.message||'Ricerca non riuscita');}
    finally{setLoading(false);}
  }

  async function setStatus(lead:Lead,status:LeadSalesStatus){
    const t=now(),history=[...(lead.statusHistory||[]),{status,at:t}];
    const contacted=!['Da valutare','Salvato'].includes(status);
    await db.leads.update(lead.id,{salesStatus:status,status:legacyStatus(status),contacted,lastContactAt:contacted?(lead.lastContactAt||t):lead.lastContactAt,statusHistory:history,updatedAt:t});
    const points=EXP[status];if(points)await award(`lead:${lead.id}:sales:${status}`,points,'lead',`${status} · ${lead.businessName||lead.name}`);
    queueSync();
    if(status==='Da richiamare')setFollowUp({...lead,salesStatus:status,statusHistory:history});
    if(detail?.id===lead.id)setDetail({...lead,salesStatus:status,statusHistory:history,status:legacyStatus(status),contacted});
  }

  async function saveFollowUp(lead:Lead,date:string,time:string,note:string){
    if(!date)return;
    const t=now(),startAt=new Date(`${date}T${time||'09:00'}:00`).toISOString();
    await db.leads.update(lead.id,{followUpDate:startAt,followUpNote:note,nextFollowUpAt:startAt,updatedAt:t});
    const existing=await db.events.filter(e=>e.notes===`lead-followup:${lead.id}`&&!e.deletedAt).first();
    const event={id:existing?.id||uid(),title:`Richiama ${lead.businessName||lead.name}`,kind:'Lavoro' as const,category:'Follow-up lead',startAt,allDay:!time,notes:`lead-followup:${lead.id}${note?' · '+note:''}`,createdAt:existing?.createdAt||t,updatedAt:t};
    await db.events.put(event);queueSync();setFollowUp(null);
  }

  async function convert(lead:Lead){
    if(lead.convertedClientId){location.href=`/clienti/${lead.convertedClientId}`;return;}
    const duplicate=clients.find(c=>!c.deletedAt&&(c.leadSourceId===lead.id||norm(c.name)===norm(lead.businessName||lead.name)||(lead.email&&norm(c.email)===norm(lead.email))||(phoneFor(lead)&&cleanTel(c.phone||'')===cleanTel(phoneFor(lead)))));
    if(duplicate){await db.leads.update(lead.id,{convertedClientId:duplicate.id,updatedAt:now()});queueSync();location.href=`/clienti/${duplicate.id}`;return;}
    const t=now(),id=uid();const platforms:Platform[]=lead.instagram?['Instagram']:[];
    const client:Client={id,name:lead.businessName||lead.name,niche:lead.category||'Attività locale',description:[lead.aiAnalysis,lead.notes].filter(Boolean).join('\n\n'),email:lead.email,phone:phoneFor(lead)||undefined,instagram:lead.instagram,monthlyFee:0,contentTarget:0,startDate:t.slice(0,10),metaAds:lead.advertisingStatus==='Presente',objective:lead.recommendedService,tone:'Diretto e professionale',avoid:[],platforms,address:lead.address,website:lead.website,facebook:lead.facebook,leadSourceId:lead.id,requestedService:lead.recommendedService,createdAt:t,updatedAt:t};
    await db.clients.put(client);await db.leads.update(lead.id,{convertedClientId:id,updatedAt:t});queueSync();location.href=`/clienti/${id}`;
  }

  async function saveNotes(lead:Lead,notes:string){await db.leads.update(lead.id,{notes,updatedAt:now()});queueSync();setDetail({...lead,notes});}
  async function awardUpsell(lead:Lead){await award(`lead:${lead.id}:upsell`,150,'lead',`Upsell concluso · ${lead.businessName||lead.name}`);}

  return <main className="page lg-page">
    <header className="lg-header">
      <div><Link to="/clienti" className="lg-back"><ArrowLeft/> Clienti</Link><span className="eyebrow">AI SALES ASSISTANT</span><h1>Lead Generation</h1><p>Opportunità locali entro 30 km da Montespertoli, ordinate per potenziale commerciale reale.</p></div>
      <button className="btn primary lg-search-btn" onClick={runDiscovery} disabled={loading}>{loading?<><RefreshCw className="spin"/> Ricerca…</>:<><Radar/> Trova nuovi lead</>}</button>
    </header>

    <section className="lg-top-grid">
      <div className="lg-level card"><div><span className="eyebrow">LIVELLO COMMERCIALE</span><h2>Livello {lvl.level}</h2><p>{lvl.total} EXP totali</p></div><div className="lg-level-progress"><span style={{width:`${Math.min(100,lvl.current/lvl.needed*100)}%`}}/><small>{lvl.current} / {lvl.needed} EXP verso il prossimo livello</small></div></div>
      <div className="lg-today card"><span className="eyebrow">NUOVI OGGI</span><strong>{todayNew}</strong><p>lead trovati oggi</p></div>
    </section>

    {providerMessage&&<div className="lg-provider-note"><Sparkles/><span>{providerMessage}</span></div>}
    {!active.length&&!providerMessage&&<div className="lg-provider-note"><Radar/><span>Nessuna fonte Lead ancora utilizzata. Premi “Trova nuovi lead”. Se il provider non è configurato, Marketero te lo segnalerà senza inventare prospect.</span></div>}

    <section className="lg-stats">
      <Stats title="OGGI" m={today}/><Stats title="7 GIORNI" m={week}/><Stats title="30 GIORNI" m={month}/>
    </section>

    <div className="lg-toolbar">
      <button className={'lg-best '+(bestOnly?'active':'')} onClick={()=>setBestOnly(v=>!v)}><Flame/> MIGLIORI OPPORTUNITÀ</button>
      <label className="lg-radius"><MapPin/><span>entro</span><select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[5,10,15,20,30].map(x=><option key={x} value={x}>{x} km</option>)}</select></label>
      <button className="btn ghost lg-filter-btn" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal/> Filtri</button>
    </div>

    {filtersOpen&&<FilterPanel filters={filters} setFilters={setFilters} categories={categories} services={services}/>} 

    <div className="lg-list-head"><div><span className="eyebrow">PROSPECT</span><h2>{shown.length} opportunità</h2></div><select value={filters.sort} onChange={e=>setFilters(f=>({...f,sort:e.target.value}))}><option value="opportunity">Migliori opportunità</option><option value="near">Più vicini</option><option value="far">Più lontani</option><option value="budget">Budget likelihood</option><option value="timing">Timing</option><option value="recent">Più recenti</option></select></div>

    <section className="lg-leads">
      {shown.map(lead=><LeadCard key={lead.id} lead={lead} onDetail={()=>setDetail(lead)} onStatus={s=>setStatus(lead,s)}/>)}
      {!shown.length&&<div className="lg-empty card"><Radar/><h3>Nessun prospect in questa vista</h3><p>{active.length?'Prova a modificare filtri o distanza.':'Collega una fonte reale e avvia la ricerca. Nessuna attività viene inventata.'}</p></div>}
    </section>

    {detail&&<LeadDetail lead={detail} onClose={()=>setDetail(null)} onStatus={s=>setStatus(detail,s)} onConvert={()=>convert(detail)} onSaveNotes={n=>saveNotes(detail,n)} onUpsell={()=>awardUpsell(detail)}/>} 
    {followUp&&<FollowUpSheet lead={followUp} onClose={()=>setFollowUp(null)} onSave={(d,t,n)=>saveFollowUp(followUp,d,t,n)}/>} 
  </main>;
}

function Stats({title,m}:{title:string;m:{newLeads:number;contacted:number;replies:number;interested:number;appointments:number;quotes:number;acquired:number;rate:number;exp:number}}){return <article className="lg-stat-card card"><span className="eyebrow">{title}</span><div className="lg-stat-primary"><strong>{m.newLeads}</strong><span>nuovi lead</span></div><div className="lg-stat-mini"><span><b>{m.contacted}</b> contattati</span><span><b>{m.replies}</b> risposte</span><span><b>{m.appointments}</b> appunt.</span><span><b>{m.acquired}</b> acquisiti</span></div><div className="lg-stat-footer"><span>{m.rate}% conversione</span><b>+{m.exp} EXP</b></div></article>}

function LeadCard({lead,onDetail,onStatus}:{lead:Lead;onDetail:()=>void;onStatus:(s:LeadSalesStatus)=>void}){
  const p=priorityFor(lead),phone=phoneFor(lead),score=clampScore(lead.opportunityScore);
  return <article className="lg-lead-card card">
    <button className="lg-card-main" onClick={onDetail}>
      <div className="lg-card-title"><div><div className="lg-badges"><span className={'lg-priority '+p.toLowerCase()}>{p==='HOT'?'🔥 ':p==='MEDIUM'?'🟠 ':'⚪ '}{p}</span>{lead.isOpeningSoon&&<span className="lg-opening"><Rocket/> IN APERTURA</span>}{lead.isNewOpening&&<span className="lg-opening"><Flame/> NUOVA APERTURA</span>}<span className="lg-type">{lead.leadType||'LEAD'}</span></div><h3>{lead.businessName||lead.name}</h3><p><MapPin/> {lead.city||'Località non verificata'}{lead.distanceKm!=null?` · ${lead.distanceKm.toFixed(1)} km`:''}</p></div><div className={'lg-score '+p.toLowerCase()}><strong>{score??'—'}</strong><small>/100</small></div></div>
      <div className="lg-address">{lead.address||'Indirizzo non disponibile'}</div>
      <div className="lg-signals"><span>⭐ {lead.rating?.toFixed(1)||'—'} · {lead.reviewsCount??0} recensioni</span><span>🌐 {lead.websiteStatus||'Non verificato'}</span><span>📱 {lead.socialStatus||'Non verificato'}</span><span>💰 {budgetLabel(lead.budgetScore,lead.budgetBand)}</span></div>
      <div className="lg-service"><span>Servizio consigliato</span><strong>{lead.recommendedService||'Da valutare'}</strong></div>
    </button>
    <div className="lg-card-actions">{phone?<a className="btn primary" href={`tel:${cleanTel(phone)}`}><Phone/> CHIAMA</a>:<button className="btn ghost" disabled><Phone/> Nessun telefono</button>}<select value={lead.salesStatus||'Da valutare'} onChange={e=>onStatus(e.target.value as LeadSalesStatus)}>{SALES_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
  </article>;
}

function FilterPanel({filters,setFilters,categories,services}:{filters:any;setFilters:(f:any)=>void;categories:string[];services:string[]}){const set=(k:string,v:string)=>setFilters((f:any)=>({...f,[k]:v}));return <section className="lg-filters card"><div className="lg-filter-title"><Filter/><b>Filtri commerciali</b><button onClick={()=>setFilters((f:any)=>({...f,category:'',type:'',priority:'',budget:'',status:'',service:'',opening:'',web:'',social:'',contacted:''}))}>Azzera</button></div><div className="lg-filter-grid">
  <label>Categoria<select value={filters.category} onChange={e=>set('category',e.target.value)}><option value="">Tutte</option>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Priorità<select value={filters.priority} onChange={e=>set('priority',e.target.value)}><option value="">Tutte</option>{PRIORITIES.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Tipo<select value={filters.type} onChange={e=>set('type',e.target.value)}><option value="">WEB + SOCIAL</option><option>WEB-FIRST</option><option>SOCIAL-FIRST</option></select></label>
  <label>Budget<select value={filters.budget} onChange={e=>set('budget',e.target.value)}><option value="">Tutti</option>{BANDS.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Servizio<select value={filters.service} onChange={e=>set('service',e.target.value)}><option value="">Tutti</option>{services.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Stato<select value={filters.status} onChange={e=>set('status',e.target.value)}><option value="">Tutti</option>{SALES_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Apertura<select value={filters.opening} onChange={e=>set('opening',e.target.value)}><option value="">Tutte</option><option value="new">Nuova apertura</option><option value="soon">Prossima apertura</option></select></label>
  <label>Sito<select value={filters.web} onChange={e=>set('web',e.target.value)}><option value="">Qualsiasi</option><option value="missing">Senza sito</option><option value="weak">Sito debole/da rifare</option></select></label>
  <label>Social<select value={filters.social} onChange={e=>set('social',e.target.value)}><option value="">Qualsiasi</option><option value="missing">Social assenti</option><option value="weak">Social deboli/inattivi</option></select></label>
  <label>Contatto<select value={filters.contacted} onChange={e=>set('contacted',e.target.value)}><option value="">Tutti</option><option value="yes">Contattati</option><option value="no">Non contattati</option></select></label>
</div></section>}

function LeadDetail({lead,onClose,onStatus,onConvert,onSaveNotes,onUpsell}:{lead:Lead;onClose:()=>void;onStatus:(s:LeadSalesStatus)=>void;onConvert:()=>void;onSaveNotes:(n:string)=>void;onUpsell:()=>void}){
  const [notes,setNotes]=useState(lead.notes||'');const phone=phoneFor(lead);const score=clampScore(lead.opportunityScore);return <div className="lg-backdrop" onClick={onClose}><section className="lg-detail" onClick={e=>e.stopPropagation()}><header><div><span className="eyebrow">SCHEDA PROSPECT</span><h2>{lead.businessName||lead.name}</h2><p>{lead.category||'Attività locale'}{lead.distanceKm!=null?` · ${lead.distanceKm.toFixed(1)} km`:''}</p></div><button className="lg-close" onClick={onClose}><X/></button></header>
    <div className="lg-detail-scroll">
      <div className="lg-detail-hero"><div><span className={'lg-priority '+priorityFor(lead).toLowerCase()}>{priorityFor(lead)}</span><h3>{score??'—'}/100</h3><small>Opportunity Score</small></div><select value={lead.salesStatus||'Da valutare'} onChange={e=>onStatus(e.target.value as LeadSalesStatus)}>{SALES_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
      <div className="lg-contact-grid"><Info label="Indirizzo" value={lead.address}/><Info label="Titolare" value={lead.ownerName||'non identificato'}/><Info label="Telefono" value={phone}/><Info label="Email" value={lead.email}/></div>
      <div className="lg-contact-actions">{phone&&<a className="btn primary" href={`tel:${cleanTel(phone)}`}><Phone/> CHIAMA</a>}{lead.website&&<a className="btn ghost" href={lead.website} target="_blank" rel="noreferrer"><ExternalLink/> Sito</a>}{lead.instagram&&<a className="btn ghost" href={lead.instagram} target="_blank" rel="noreferrer">Instagram</a>}{lead.facebook&&<a className="btn ghost" href={lead.facebook} target="_blank" rel="noreferrer">Facebook</a>}</div>
      <section><span className="eyebrow">ANALISI COMMERCIALE</span><div className="lg-score-grid"><Score label="Fit" value={lead.fitScore}/><Score label="Need" value={lead.needScore}/><Score label="Budget" value={lead.budgetScore}/><Score label="Buying" value={lead.buyingScore}/><Score label="Timing" value={lead.timingScore}/></div></section>
      <section className="lg-analysis"><span className="eyebrow">PERCHÉ È STATO SCELTO</span><p>{lead.aiAnalysis||'Analisi non ancora disponibile. Nessuna informazione viene inventata.'}</p></section>
      <section className="lg-offer"><div><span>Servizio principale</span><strong>{lead.recommendedService||'Da valutare'}</strong></div><div><span>Possibile upsell</span><strong>{lead.upsellService||'—'}</strong></div></section>
      <section className="lg-digital"><Info label="Sito" value={lead.websiteStatus||'Non verificato'}/><Info label="Social" value={lead.socialStatus||'Non verificato'}/><Info label="Advertising" value={lead.advertisingStatus||'Non verificato'}/><Info label="Budget likelihood" value={budgetLabel(lead.budgetScore,lead.budgetBand)}/></section>
      <section><span className="eyebrow">NOTE PERSONALI</span><textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Note commerciali…"/><button className="btn ghost" onClick={()=>onSaveNotes(notes)}>Salva note</button></section>
      {lead.sources?.length?<section><span className="eyebrow">FONTI</span><div className="lg-sources">{lead.sources.map((s,i)=>s.url?<a href={s.url} target="_blank" rel="noreferrer" key={i}>{s.label} <ExternalLink/></a>:<span key={i}>{s.label}</span>)}</div></section>:null}
      {lead.salesStatus==='Acquisito'&&<div className="lg-convert"><UserRoundCheck/><div><b>Lead acquisito</b><p>Trasformalo in cliente e continua nel workflow Marketero.</p></div><button className="btn primary" onClick={onConvert}>{lead.convertedClientId?'APRI CLIENTE':'CONVERTI IN CLIENTE'}</button></div>}
      {lead.convertedClientId&&<button className="btn ghost" onClick={onUpsell}>+150 EXP · Upsell concluso</button>}
      <footer>Scoperto {new Date(lead.discoveredAt||lead.createdAt).toLocaleDateString('it-IT')} · Verificato {lead.lastCheckedAt?new Date(lead.lastCheckedAt).toLocaleDateString('it-IT'):'non disponibile'}</footer>
    </div></section></div>}

function Info({label,value}:{label:string;value?:string}){return <div className="lg-info"><span>{label}</span><b>{value||'Non disponibile'}</b></div>}
function Score({label,value}:{label:string;value?:number}){const v=clampScore(value);return <div><span>{label}</span><strong>{v??'—'}</strong><small>/100</small></div>}

function FollowUpSheet({lead,onClose,onSave}:{lead:Lead;onClose:()=>void;onSave:(d:string,t:string,n:string)=>void}){const initial=lead.followUpDate?new Date(lead.followUpDate):new Date(Date.now()+86400000);const [date,setDate]=useState(initial.toISOString().slice(0,10));const [time,setTime]=useState(lead.followUpDate?new Date(lead.followUpDate).toTimeString().slice(0,5):'09:00');const [note,setNote]=useState(lead.followUpNote||'');return <div className="lg-backdrop" onClick={onClose}><section className="lg-followup" onClick={e=>e.stopPropagation()}><header><div><span className="eyebrow">FOLLOW-UP</span><h2>Richiama {lead.businessName||lead.name}</h2></div><button className="lg-close" onClick={onClose}><X/></button></header><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Ora<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>Nota<textarea rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Es. interessato al sito, vuole parlarne con il socio"/></label><button className="btn primary" onClick={()=>onSave(date,time,note)}>Salva follow-up</button></section></div>}
