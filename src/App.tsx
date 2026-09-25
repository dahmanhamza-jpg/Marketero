import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureSettings } from './lib/db';
import { startAutoSync } from './services/sync';
import { startNotificationChecks } from './services/notifications';
import { BottomNav } from './components/BottomNav';
import { QuickAdd } from './components/QuickAdd';
import { LockGate } from './components/LockGate';
import { ClientForm, EventForm, IdeaForm, LeadForm, PaymentForm, ScriptForm, TaskForm } from './components/Forms';
import { Home } from './pages/Home';
import { Clients, ClientPage } from './pages/Clients';
import { CalendarPage } from './pages/Calendar';
import { PaymentsPage } from './pages/Payments';
import { SettingsPage } from './pages/Settings';
import './styles.css';

function AppShell(){
 const nav=useNavigate();const [modal,setModal]=useState<string|null>(null);
 useEffect(()=>{const stop=startNotificationChecks();return stop},[]);
 return <div className="app-shell"><Routes>
  <Route path="/" element={<Home/>}/>
  <Route path="/clienti" element={<Clients/>}/>
  <Route path="/clienti/:id" element={<ClientPage/>}/>
  <Route path="/calendario" element={<CalendarPage/>}/>
  <Route path="/pagamenti" element={<PaymentsPage/>}/>
  <Route path="/altro" element={<SettingsPage/>}/>
 </Routes><BottomNav/><QuickAdd onSelect={setModal}/>{modal&&<QuickModal type={modal} close={()=>setModal(null)} nav={nav}/>}</div>;
}

function QuickModal({type,close,nav}:{type:string;close:()=>void;nav:(p:string)=>void}){
 if(type==='idea')return <IdeaForm close={close}/>;
 if(type==='client')return <ClientForm close={close} after={id=>nav('/clienti/'+id)}/>;
 if(type==='work'||type==='personal')return <EventForm kind={type==='work'?'Lavoro':'Personale'} close={close}/>;
 if(type==='task')return <TaskForm close={close}/>;
 if(type==='script')return <ScriptForm close={close}/>;
 if(type==='lead')return <LeadForm close={close}/>;
 if(type==='payment')return <PaymentForm close={close}/>;
 return null;
}

export default function App(){
 const settings=useLiveQuery(()=>db.settings.get('settings'),[]);
 useEffect(()=>{let stop:(()=>void)|undefined;ensureSettings().then(()=>{stop=startAutoSync()});return()=>stop?.()},[]);
 useEffect(()=>{document.documentElement.dataset.theme=settings?.darkMode?'dark':'light'},[settings?.darkMode]);
 return <BrowserRouter><LockGate><AppShell/></LockGate></BrowserRouter>;
}
