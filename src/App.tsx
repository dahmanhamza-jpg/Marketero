import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSettings, now, uid } from './lib/db';
import { makePinHash, RECOVERY_CODE, verifyPin } from './lib/security';
import { clientHealth, freeMinutesUntil, getConflicts, nextTask, paymentStatus } from './lib/logic';
import { buildStrategy } from './services/strategy';
import {
  exportAll,
  importAll,
  syncRemote,
 startAutoSync,
getSyncCode,
setSyncCode
} from './services/sync';
import { downloadText, scriptText } from './lib/exportScript';
import { BottomNav } from './components/BottomNav';
import { QuickAdd } from './components/QuickAdd';
import { Card, Chip, Empty, PrimaryButton } from './components/UI';
import type { CalendarEvent, Client, ContentFormat, Idea, Platform, Script, Task } from './types/models';
import './styles.css';

function AppShell(){
  const nav=useNavigate();
  const [modal,setModal]=useState<string|null>(null);

  useEffect(() => {
    const stop = startAutoSync();
    return stop;
  }, []);

  return <div className="app-shell"><Routes>
    <Route path="/" element={<Home/>}/><Route path="/clienti" element={<Clients/>}/><Route path="/clienti/:id" element={<ClientPage/>}/><Route path="/calendario" element={<CalendarPage/>}/><Route path="/altro" element={<MorePage/>}/>
  </Routes><BottomNav/><QuickAdd onSelect={v=>setModal(v)}/>{modal&&<QuickModal type={modal} close={()=>setModal(null)} nav={nav}/>}</div>
}

function QuickModal({type,close,nav}:{type:string;close:()=>void;nav:(p:string)=>void}){
  if(type==='idea') return <IdeaForm close={close}/>;
  if(type==='client') return <ClientForm close={close} after={id=>nav('/clienti/'+id)}/>;
  if(type==='work'||type==='personal') return <EventForm kind={type==='work'?'Lavoro':'Personale'} close={close}/>;
  if(type==='task') return <TaskForm close={close}/>;
  return <div className="sheet-backdrop" onClick={close}><div className="sheet" onClick={e=>e.stopPropagation()}><h3>Funzione disponibile dalla relativa sezione</h3><p className="muted">Questa scorciatoia verrà collegata alla schermata dedicata senza duplicare la logica.</p><PrimaryButton onClick={close}>Chiudi</PrimaryButton></div></div>
}

function Home(){
  const tasks=useLiveQuery(()=>db.tasks.toArray(),[])||[]; const events=useLiveQuery(()=>db.events.toArray(),[])||[]; const clients=useLiveQuery(()=>db.clients.toArray(),[])||[]; const payments=useLiveQuery(()=>db.payments.toArray(),[])||[]; const settings=useLiveQuery(()=>db.settings.get('settings'),[]) ;
  const future=events.filter(e=>new Date(e.endAt)>new Date()&&!e.deletedAt).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
  const free=freeMinutesUntil(future); const next=nextTask(tasks,free,settings?.energy||'Media'); const nextEvent=future[0];
  const alerts=clients.map(c=>({c,h:clientHealth(c,payments,[])})).filter(x=>x.h.state!=='Regolare').slice(0,2);
  const focus=[...tasks].filter(t=>!t.completed&&!t.deletedAt).sort((a,b)=>(b.urgent?1:0)-(a.urgent?1:0)).slice(0,3);
  return <main className="page home"><header className="top"><div><span className="eyebrow">MARKETERO</span><h1>Buongiorno 👋</h1><p>{new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</p></div><div className="energy"><span>Energia</span>{(['Bassa','Media','Alta'] as const).map(v=><Chip key={v} active={settings?.energy===v} onClick={()=>db.settings.update('settings',{energy:v,updatedAt:now()})}>{v}</Chip>)}</div></header>
    <Card className="hero"><div className="hero-glow"/><span className="eyebrow light">⚡ ADESSO</span>{next?<><h2>{next.title}</h2><p>{next.durationMin} min · {next.urgent?'Priorità alta':'Miglior prossima azione'}</p><div className="row"><PrimaryButton onClick={()=>db.tasks.update(next.id,{completed:true,updatedAt:now()})}>▶ Inizia / Completa</PrimaryButton><button className="btn ghost">Perché?</button></div></>:<><h2>Sei in pari.</h2><p>Non ci sono attività urgenti compatibili con il tempo disponibile.</p></>}</Card>
    <div className="day-strip">{Array.from({length:5},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return <button className={i===0?'selected':''} key={i}><span>{new Intl.DateTimeFormat('it-IT',{weekday:'short'}).format(d)}</span><strong>{d.getDate()}</strong></button>})}</div>
    <div className="bento">
      <Card className="span2"><span className="eyebrow">🎯 FOCUS</span>{focus.length?focus.map(t=><div className="line" key={t.id}><span>{t.title}</span><button onClick={()=>db.tasks.update(t.id,{completed:true,updatedAt:now()})}>✓</button></div>):<p className="muted">Nessuna priorità aperta.</p>}</Card>
      <Card><span className="eyebrow">📅 PROSSIMO</span><h3>{nextEvent?.title||'Nessun appuntamento'}</h3>{nextEvent&&<p>{new Date(nextEvent.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} · {nextEvent.kind}</p>}</Card>
      <Card><span className="eyebrow">✨ TEMPO LIBERO</span><h3>{free>=60?`${Math.floor(free/60)}h ${free%60}m`:`${free} min`}</h3><p>Prima del prossimo impegno</p></Card>
      {alerts.length>0&&<Card className="attention"><span className="eyebrow">🚨 ATTENZIONE</span>{alerts.map(x=><p key={x.c.id}><strong>{x.c.name}</strong><br/>{x.h.reason}</p>)}</Card>}
      <Card><span className="eyebrow">💰 DA INCASSARE</span><h3>€ {payments.filter(p=>paymentStatus(p)!=='Pagato').reduce((s,p)=>s+p.amount,0).toLocaleString('it-IT')}</h3><p>{payments.filter(p=>paymentStatus(p)==='Scaduto').length} scaduti</p></Card>
      <Card><span className="eyebrow">🔥 MOMENTUM</span><h3>{tasks.filter(t=>t.completed).length}</h3><p>attività completate</p></Card>
    </div>
  </main>
}

function Clients(){ const clients=useLiveQuery(()=>db.clients.toArray(),[])||[]; const payments=useLiveQuery(()=>db.payments.toArray(),[])||[]; return <main className="page"><header className="page-title"><div><span className="eyebrow">CLIENTI</span><h1>Clienti attivi</h1><p>Tutto ciò che richiede attenzione, senza rumore.</p></div></header><div className="client-grid">{clients.filter(c=>!c.deletedAt).map(c=>{const h=clientHealth(c,payments,[]);return <Link className="client-card" to={`/clienti/${c.id}`} key={c.id}><div className="avatar">{c.name.slice(0,2).toUpperCase()}</div><div className="client-main"><div className="row spread"><h3>{c.name}</h3><span className={`status ${h.state.toLowerCase()}`}>{h.state}</span></div><p>{c.niche} · {c.platforms.join(' + ')||'—'}</p><div className="mini-grid"><span><b>{c.contentTarget}</b><small>contenuti/mese</small></span><span><b>€ {c.monthlyFee}</b><small>/mese</small></span></div><div className="next-action">⚡ {h.reason}</div></div></Link>})}</div>{clients.length===0&&<Empty title="Nessun cliente ancora"/>}</main> }

function ClientPage(){
  const {id}=useParams(); const client=useLiveQuery(()=>id?db.clients.get(id):undefined,[id]); const scripts=useLiveQuery(()=>id?db.scripts.where('clientId').equals(id).toArray():[],[id])||[]; const ideas=useLiveQuery(()=>id?db.ideas.where('clientId').equals(id).toArray():[],[id])||[]; const payments=useLiveQuery(()=>id?db.payments.where('clientId').equals(id).toArray():[],[id])||[]; const strategies=useLiveQuery(()=>id?db.strategies.where('clientId').equals(id).toArray():[],[id])||[];
  const [tab,setTab]=useState<'overview'|'scripts'|'strategy'|'more'>('overview'); const [newScript,setNewScript]=useState(false);
  if(!client) return <main className="page"><p>Caricamento…</p></main>;
  const h=clientHealth(client,payments,scripts); const ready=scripts.filter(s=>s.status==='Pronto').length;
  const createStrategy=async()=>{const s=buildStrategy(client);await db.strategies.put(s);setTab('strategy')};
  return <main className="page client-detail"><Link to="/clienti" className="back">← Clienti</Link><Card className="client-hero"><div><span className="eyebrow">{client.niche}</span><h1>{client.name}</h1><p>{client.platforms.join(' + ')||'Nessuna piattaforma'} · € {client.monthlyFee}/mese</p></div><div className="client-score"><span className={`status ${h.state.toLowerCase()}`}>{h.state}</span><strong>{ready}/{client.contentTarget}</strong><small>script pronti</small></div></Card>
    <Card className="next-client"><span className="eyebrow">⚡ PROSSIMA AZIONE</span><h2>{ready<client.contentTarget?`Completa ${Math.max(0,client.contentTarget-ready)} script prima della prossima registrazione`:'Workflow pronto per la fase successiva'}</h2></Card>
    <div className="tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>Panoramica</button><button className={tab==='scripts'?'active':''} onClick={()=>setTab('scripts')}>Script</button><button className={tab==='strategy'?'active':''} onClick={()=>setTab('strategy')}>Strategia</button><button className={tab==='more'?'active':''} onClick={()=>setTab('more')}>Altro</button></div>
    {tab==='overview'&&<div className="bento"><Card className="span2"><span className="eyebrow">WORKFLOW</span><div className="workflow">{['Script','Registrazione','Montaggio','Programmazione','Pubblicato'].map((x,i)=><div key={x}><span>{i===0?'📝':i===1?'📹':i===2?'🎬':i===3?'📆':'✅'}</span><b>{x}</b></div>)}</div></Card><Card><span className="eyebrow">💡 IDEE</span><h3>{ideas.length}</h3><p>salvate</p></Card><Card><span className="eyebrow">📝 SCRIPT</span><h3>{ready}/{scripts.length||client.contentTarget}</h3><p>pronti</p></Card><Card><span className="eyebrow">💰 PAGAMENTO</span><h3>{payments.some(p=>paymentStatus(p)==='Scaduto')?'Scaduto':'Regolare'}</h3></Card></div>}
    {tab==='scripts'&&<><div className="section-head"><div><h2>Script</h2><p>Idea → Script → Registrazione</p></div><PrimaryButton onClick={()=>setNewScript(true)}>+ Nuovo script</PrimaryButton></div><div className="list">{scripts.map(s=><Card key={s.id}><div className="row spread"><div><h3>{s.title}</h3><p>{s.platform} · {s.format} · {s.status}</p></div><div className="row"><button className="btn ghost" onClick={()=>navigator.clipboard.writeText(scriptText(s))}>Copia</button><button className="btn ghost" onClick={()=>downloadText(`${s.title}.txt`,scriptText(s))}>Esporta</button></div></div>{s.referenceUrls.length>0&&<div className="refs">{s.referenceUrls.map((r,i)=><a href={r.url} target="_blank" rel="noreferrer" key={i}>🔗 {r.note||'Riferimento'}</a>)}</div>}</Card>)}</div>{newScript&&<ScriptForm client={client} ideas={ideas} close={()=>setNewScript(false)}/>}</>}
    {tab==='strategy'&&<><div className="section-head"><div><h2>Strategia</h2><p>Funziona anche senza API AI.</p></div><PrimaryButton onClick={createStrategy}>Crea strategia</PrimaryButton></div>{strategies.length?strategies.slice().reverse().map(s=><Card key={s.id}><h3>{s.objective}</h3><p>{s.summary}</p><div className="chips">{s.pillars.map(p=><Chip key={p.name}>{p.name} · {p.count}</Chip>)}</div><div className="strategy-ideas">{s.ideas.map((i,idx)=><div key={idx}><b>{idx+1}. {i.title}</b><span>{i.pillar} · {i.funnel}</span><small>{i.hook}</small></div>)}</div></Card>):<Empty title="Nessuna strategia ancora" action={<PrimaryButton onClick={createStrategy}>Crea strategia</PrimaryButton>}/>}</>}
    {tab==='more'&&<div className="bento"><Card><span className="eyebrow">TONO</span><h3>{client.tone||'Non impostato'}</h3></Card><Card><span className="eyebrow">DA EVITARE</span><p>{client.avoid?.join(', ')||'Nessuna regola'}</p></Card><Card><span className="eyebrow">META ADS</span><h3>{client.metaAds?'Sì':'No'}</h3></Card></div>}
  </main>
}

function CalendarPage(){
 const events=useLiveQuery(()=>db.events.toArray(),[])||[]; const [filter,setFilter]=useState<'Tutto'|'Lavoro'|'Personale'>('Tutto'); const visible=events.filter(e=>!e.deletedAt&&(filter==='Tutto'||e.kind===filter)).sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt));
 return <main className="page"><header className="page-title"><div><span className="eyebrow">CALENDARIO</span><h1>Lavoro + Personale</h1><p>Un solo motore di disponibilità, due contesti distinti.</p></div></header><div className="chips">{(['Tutto','Lavoro','Personale'] as const).map(x=><Chip active={filter===x} onClick={()=>setFilter(x)} key={x}>{x}</Chip>)}</div><div className="calendar-list">{visible.map(e=><Card key={e.id} className={e.kind==='Personale'?'personal':''}><div className="time">{new Date(e.startAt).toLocaleDateString('it-IT',{weekday:'short',day:'numeric'})}<strong>{new Date(e.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}</strong></div><div><h3>{e.title}</h3><p>{e.kind} · {e.category}</p></div></Card>)}</div>{!visible.length&&<Empty title="Calendario libero"/>}</main>
}

function MorePage(){
  const settings=useLiveQuery(()=>db.settings.get('settings'),[]);
  const [syncCode,setSyncCodeState]=useState('');
  const [newSyncCode,setNewSyncCode]=useState('');
  const [syncMessage,setSyncMessage]=useState('');

  useEffect(()=>{
    getSyncCode().then(code=>setSyncCodeState(code));
  },[]);

  const fileRef=async()=>{
    const p=await exportAll();
    downloadText(
      `marketero-backup-${new Date().toISOString().slice(0,10)}.json`,
      JSON.stringify(p,null,2),
      'application/json'
    );
  };

  async function copySyncCode(){
    const code=await getSyncCode();
    await navigator.clipboard.writeText(code);
    setSyncCodeState(code);
    setSyncMessage('Codice copiato ✓');
  }

  async function connectDevice(){
    if(!newSyncCode.trim()){
      setSyncMessage('Inserisci il codice del dispositivo principale.');
      return;
    }

    const previousCode = await getSyncCode();

    try{
      const code = newSyncCode.trim().toLowerCase();
      await setSyncCode(code);
      await syncRemote();
      setSyncCodeState(code);
      setNewSyncCode('');
      setSyncMessage('Dispositivo collegato e sincronizzato ✓');

      setTimeout(()=>{
        location.reload();
      },800);
    }catch(error:any){
      await setSyncCode(previousCode).catch(()=>{});
      setSyncMessage('Errore: ' + (error?.message || 'Impossibile collegare il dispositivo'));
    }
  }

  return <main className="page">
    <header className="page-title">
      <div>
        <span className="eyebrow">ALTRO</span>
        <h1>Impostazioni</h1>
      </div>
    </header>

    <div className="bento">

      <Card>
        <span className="eyebrow">SYNC</span>
        <h3>iPhone ↔ Desktop</h3>

        <p className="muted">
          Collega i dispositivi una sola volta. Poi la sincronizzazione sarà automatica.
        </p>

        <label>
          Codice di questo dispositivo
          <input
            readOnly
            value={syncCode}
            placeholder="Generazione codice..."
          />
        </label>

        <PrimaryButton onClick={copySyncCode}>
          Copia codice
        </PrimaryButton>

        <div style={{height:16}} />

        <label>
          Collega questo dispositivo
          <input
            value={newSyncCode}
            onChange={e=>setNewSyncCode(e.target.value)}
            placeholder="Incolla il codice dell'altro dispositivo"
          />
        </label>

        <PrimaryButton onClick={connectDevice}>
          Collega dispositivo
        </PrimaryButton>

        <div style={{height:12}} />

        <button
          className="btn ghost"
          onClick={async()=>{
            try{
              await syncRemote();
              setSyncMessage('Sincronizzazione completata ✓');
            }catch{
              setSyncMessage('Sincronizzazione non riuscita');
            }
          }}
        >
          Sincronizza ora
        </button>

        {syncMessage&&<p className="muted">{syncMessage}</p>}
      </Card>

      <Card>
        <span className="eyebrow">BACKUP</span>
        <h3>I tuoi dati, portabili.</h3>

        <PrimaryButton onClick={fileRef}>
          Esporta backup
        </PrimaryButton>

        <label className="file-btn">
          Ripristina backup
          <input
            type="file"
            accept="application/json"
            onChange={async e=>{
              const f=e.target.files?.[0];
              if(f){
                await importAll(JSON.parse(await f.text()));
                location.reload();
              }
            }}
          />
        </label>
      </Card>

      <Card>
        <span className="eyebrow">SICUREZZA</span>
        <h3>PIN personale</h3>
        <p>
          Il codice 0000 avvia il reset del PIN e non viene usato come chiave del Vault.
        </p>
      </Card>

      <Card>
        <span className="eyebrow">TEMA</span>

        <button
          className="btn ghost"
          onClick={()=>
            settings&&db.settings.update('settings',{
              darkMode:!settings.darkMode,
              updatedAt:now()
            })
          }
        >
          {settings?.darkMode?'Usa tema chiaro':'Usa tema scuro'}
        </button>
      </Card>

    </div>
  </main>
}
function IdeaForm({close}:{close:()=>void}){ const clients=useLiveQuery(()=>db.clients.toArray(),[])||[]; const [title,setTitle]=useState(''); const [clientId,setClientId]=useState(''); const [platform,setPlatform]=useState<Platform>('Instagram'); const [format,setFormat]=useState<ContentFormat>('Reel'); const [url,setUrl]=useState(''); async function save(e:any){e.preventDefault(); const t=now(); await db.ideas.put({id:uid(),title,clientId:clientId||undefined,platform,format,referenceUrls:url?[{url}]:[],status:'Idea',createdAt:t,updatedAt:t});close()} return <Modal title="Nuova idea" close={close}><form onSubmit={save} className="form"><label>Titolo<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Cliente<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Nessuno</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><FieldChips title="Piattaforma" values={['Instagram','TikTok','Entrambi']} value={platform} setValue={setPlatform}/><FieldChips title="Formato" values={['Reel','TikTok Video','Post','Carousel','Story']} value={format} setValue={setFormat}/><label>URL riferimento<input type="url" placeholder="https://..." value={url} onChange={e=>setUrl(e.target.value)}/></label><PrimaryButton type="submit">Salva idea</PrimaryButton></form></Modal> }

function ClientForm({close,after}:{close:()=>void;after:(id:string)=>void}){ const [step,setStep]=useState(1); const [v,setV]=useState({name:'',niche:'Ristorante',description:'',instagram:'',tiktok:'',monthlyFee:0,contentTarget:10,metaAds:false,objective:'',tone:'Diretto e professionale'}); async function save(){const id=uid(),t=now();await db.clients.put({id,name:v.name,niche:v.niche,description:v.description,instagram:v.instagram,tiktok:v.tiktok,monthlyFee:Number(v.monthlyFee),contentTarget:Number(v.contentTarget),metaAds:v.metaAds,objective:v.objective,tone:v.tone,avoid:[],platforms:[...(v.instagram?['Instagram' as Platform]:[]),...(v.tiktok?['TikTok' as Platform]:[])],createdAt:t,updatedAt:t});close();after(id)} return <Modal title={`Nuovo cliente · ${step}/4`} close={close}><div className="progress"><span style={{width:`${step*25}%`}}/></div><div className="form">{step===1&&<><label>Nome<input value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label><label>Nicchia<select value={v.niche} onChange={e=>setV({...v,niche:e.target.value})}>{['Ristorante','Abbigliamento','Concessionaria','Beauty','Fitness','Immobiliare','Hospitality','Retail','Professionista','Dentista','Bar','Formazione','Servizi','E-commerce','Altro'].map(x=><option key={x}>{x}</option>)}</select></label><label>Descrizione<textarea value={v.description} onChange={e=>setV({...v,description:e.target.value})}/></label></>}{step===2&&<><label>Instagram<input value={v.instagram} onChange={e=>setV({...v,instagram:e.target.value})}/></label><label>TikTok<input value={v.tiktok} onChange={e=>setV({...v,tiktok:e.target.value})}/></label></>}{step===3&&<><label>Compenso mensile<input type="number" value={v.monthlyFee} onChange={e=>setV({...v,monthlyFee:+e.target.value})}/></label><label className="check"><input type="checkbox" checked={v.metaAds} onChange={e=>setV({...v,metaAds:e.target.checked})}/> Meta Ads</label></>}{step===4&&<><label>Target contenuti/mese<input type="number" value={v.contentTarget} onChange={e=>setV({...v,contentTarget:+e.target.value})}/></label><label>Obiettivo<input value={v.objective} onChange={e=>setV({...v,objective:e.target.value})}/></label><label>Tono di voce<input value={v.tone} onChange={e=>setV({...v,tone:e.target.value})}/></label></>}<div className="row spread sticky-actions">{step>1?<button className="btn ghost" onClick={()=>setStep(step-1)}>Indietro</button>:<span/>}{step<4?<PrimaryButton onClick={()=>setStep(step+1)}>Continua</PrimaryButton>:<PrimaryButton disabled={!v.name} onClick={save}>Crea cliente</PrimaryButton>}</div></div></Modal> }

function ScriptForm({client,ideas,close}:{client:Client;ideas:Idea[];close:()=>void}){ const [v,setV]=useState({title:'',ideaId:'',platform:'Instagram' as Platform,format:'Reel' as ContentFormat,status:'Da scrivere' as const,hook:'',body:'',cta:'',recordingNotes:'',url:'',urlNote:''}); useEffect(()=>{const i=ideas.find(x=>x.id===v.ideaId);if(i)setV(o=>({...o,title:i.title,platform:i.platform,format:i.format,url:i.referenceUrls[0]?.url||''}))},[v.ideaId]); async function save(e:any){e.preventDefault();const t=now();await db.scripts.put({id:uid(),clientId:client.id,ideaId:v.ideaId||undefined,title:v.title,platform:v.platform,format:v.format,status:v.status,hook:v.hook,body:v.body,cta:v.cta,recordingNotes:v.recordingNotes,referenceUrls:v.url?[{url:v.url,note:v.urlNote}]:[],createdAt:t,updatedAt:t});close()} return <Modal title="Nuovo script" close={close}><form className="form" onSubmit={save}><label>Da idea esistente<select value={v.ideaId} onChange={e=>setV({...v,ideaId:e.target.value})}><option value="">Nessuna</option>{ideas.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label><label>Titolo<input required value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label><FieldChips title="Piattaforma" values={['Instagram','TikTok','Entrambi']} value={v.platform} setValue={(x:any)=>setV({...v,platform:x})}/><FieldChips title="Formato" values={['Reel','TikTok Video','Post','Carousel','Story']} value={v.format} setValue={(x:any)=>setV({...v,format:x})}/><FieldChips title="Stato" values={['Da scrivere','In corso','Pronto']} value={v.status} setValue={(x:any)=>setV({...v,status:x})}/><label>Hook<textarea value={v.hook} onChange={e=>setV({...v,hook:e.target.value})}/></label><label>Testo<textarea rows={8} value={v.body} onChange={e=>setV({...v,body:e.target.value})}/></label><label>CTA<textarea value={v.cta} onChange={e=>setV({...v,cta:e.target.value})}/></label><label>Note registrazione<textarea value={v.recordingNotes} onChange={e=>setV({...v,recordingNotes:e.target.value})}/></label><label>URL Reel/TikTok di riferimento<input type="url" value={v.url} onChange={e=>setV({...v,url:e.target.value})}/></label><label>Nota URL<input value={v.urlNote} onChange={e=>setV({...v,urlNote:e.target.value})}/></label><PrimaryButton type="submit">Salva script</PrimaryButton></form></Modal> }

function EventForm({kind,close}:{kind:'Lavoro'|'Personale';close:()=>void}){ const events=useLiveQuery(()=>db.events.toArray(),[])||[]; const [title,setTitle]=useState(''); const [start,setStart]=useState(''); const [end,setEnd]=useState(''); const [error,setError]=useState(''); async function save(e:any){e.preventDefault();const t=now();const candidate:CalendarEvent={id:uid(),title,kind,category:kind==='Personale'?'Personale':'Appuntamento',startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),createdAt:t,updatedAt:t};const c=getConflicts(candidate,events);if(c.length&&!confirm(`Conflitto con: ${c.map(x=>x.kind==='Personale'?'Fascia occupata':x.title).join(', ')}. Inserire comunque?`))return;await db.events.put(candidate);close()} return <Modal title={kind==='Personale'?'Nuovo impegno personale':'Nuovo appuntamento lavoro'} close={close}><form className="form" onSubmit={save}><label>Titolo<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Inizio<input required type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Fine<input required type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>{error&&<p className="error">{error}</p>}<PrimaryButton type="submit">Salva appuntamento</PrimaryButton></form></Modal> }

function TaskForm({close}:{close:()=>void}){ const [title,setTitle]=useState('');const [duration,setDuration]=useState(45);async function save(e:any){e.preventDefault();const t=now();await db.tasks.put({id:uid(),title,durationMin:duration,urgent:false,completed:false,createdAt:t,updatedAt:t});close()}return <Modal title="Nuova attività" close={close}><form className="form" onSubmit={save}><label>Titolo<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Durata (min)<input type="number" value={duration} onChange={e=>setDuration(+e.target.value)}/></label><PrimaryButton type="submit">Salva attività</PrimaryButton></form></Modal>}

function FieldChips({title,values,value,setValue}:{title:string;values:string[];value:string;setValue:(v:any)=>void}){return <fieldset><legend>{title}</legend><div className="chips">{values.map(v=><Chip key={v} active={value===v} onClick={()=>setValue(v)}>{v}</Chip>)}</div></fieldset>}
function Modal({title,close,children}:{title:string;close:()=>void;children:any}){return <div className="sheet-backdrop" onClick={close}><div className="modal" onClick={e=>e.stopPropagation()}><div className="sheet-head"><h2>{title}</h2><button className="icon" onClick={close}>✕</button></div><div className="modal-scroll">{children}</div></div></div>}

function LockGate(){
 const settings=useLiveQuery(()=>db.settings.get('settings'),[]); const [unlocked,setUnlocked]=useState(false); const [mode,setMode]=useState<'unlock'|'setup'|'reset'>('unlock'); const [pin,setPin]=useState(''); const [confirmPin,setConfirmPin]=useState(''); const [msg,setMsg]=useState('');
 useEffect(()=>{ensureSettings().then(s=>setMode(s.pinHash?'unlock':'setup'))},[]); if(unlocked)return <AppShell/>;
 async function submit(){setMsg(''); if(mode==='setup'||mode==='reset'){if(pin!==confirmPin){setMsg('I PIN non coincidono.');return} const hash=await makePinHash(pin);await db.settings.update('settings',{pinHash:hash,firstRunDone:true,updatedAt:now()});setUnlocked(true);return;} if(pin===RECOVERY_CODE){setMode('reset');setPin('');setMsg('Codice di recupero accettato. Imposta un nuovo PIN.');return;} if(await verifyPin(pin,settings?.pinHash))setUnlocked(true);else setMsg('PIN non corretto.');}
 return <div className="lock"><div className="lock-card"><div className="logo">M</div><span className="eyebrow">MARKETERO</span><h1>{mode==='unlock'?'Bentornato':mode==='setup'?'Crea il tuo PIN':'Reimposta PIN'}</h1><p>{mode==='unlock'?'Inserisci il PIN a 4 cifre. Puoi usare 0000 solo per avviare il reset.':'Scegli un PIN personale di 4 cifre.'}</p><input className="pin" inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="••••"/>{mode!=='unlock'&&<input className="pin" inputMode="numeric" maxLength={4} value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,''))} placeholder="Conferma"/>}{msg&&<p className="error">{msg}</p>}<PrimaryButton disabled={pin.length!==4||(mode!=='unlock'&&confirmPin.length!==4)} onClick={submit}>{mode==='unlock'?'Sblocca':'Salva PIN'}</PrimaryButton></div></div>
}

export default function App(){ useEffect(()=>{ensureSettings()},[]); const settings=useLiveQuery(()=>db.settings.get('settings'),[]); useEffect(()=>{document.documentElement.dataset.theme=settings?.darkMode?'dark':'light'},[settings?.darkMode]); return <BrowserRouter><LockGate/></BrowserRouter> }
