import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Users, CalendarDays, MoreHorizontal, TimerReset, Eye, EyeOff } from 'lucide-react';
import { SmartLayer } from './SmartLayer';

const REVENUE_VISIBILITY_KEY='marketero:revenue-visible';

export function BottomNav(){
  const location=useLocation();
  const goTop=()=>window.scrollTo({top:0,left:0,behavior:'auto'});
  const clientsOverview=location.pathname==='/clienti';
  const [revenueHost,setRevenueHost]=useState<HTMLElement|null>(null);
  const [revenueVisible,setRevenueVisible]=useState(()=>{
    try{return localStorage.getItem(REVENUE_VISIBILITY_KEY)==='1'}catch{return false}
  });

  useEffect(()=>{
    document.documentElement.classList.toggle('revenue-visible',revenueVisible);
    try{localStorage.setItem(REVENUE_VISIBILITY_KEY,revenueVisible?'1':'0')}catch{}
  },[revenueVisible]);

  useEffect(()=>{
    if(!clientsOverview){setRevenueHost(null);return;}
    let cancelled=false;
    let frame=0;
    let tries=0;
    const find=()=>{
      if(cancelled)return;
      const host=document.querySelector('.revenue-link-card') as HTMLElement|null;
      if(host){setRevenueHost(host);return;}
      if(tries++<20)frame=requestAnimationFrame(find);
    };
    frame=requestAnimationFrame(find);
    return()=>{cancelled=true;cancelAnimationFrame(frame)};
  },[clientsOverview]);

  const toggleRevenue=(e:{preventDefault:()=>void;stopPropagation:()=>void})=>{
    e.preventDefault();e.stopPropagation();setRevenueVisible(v=>!v);
  };

  return <>
    <SmartLayer/>
    {clientsOverview&&revenueHost&&createPortal(<span
      className="revenue-privacy-toggle"
      role="button"
      tabIndex={0}
      aria-label={revenueVisible?'Nascondi importi':'Mostra importi'}
      title={revenueVisible?'Nascondi importi':'Mostra importi'}
      onClick={toggleRevenue}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setRevenueVisible(v=>!v)}}}>
      {revenueVisible?<EyeOff size={17}/>:<Eye size={17}/>}<span>{revenueVisible?'Nascondi':'Mostra'}</span>
    </span>,revenueHost)}
    <nav className="bottom-nav">
      <NavLink to="/" onClick={goTop}><Home/><span>Oggi</span></NavLink>
      <NavLink to="/clienti" onClick={goTop}><Users/><span>Clienti</span></NavLink>
      <NavLink to="/focus" onClick={goTop}><TimerReset/><span>Focus</span></NavLink>
      <NavLink to="/calendario" onClick={goTop}><CalendarDays/><span>Calendario</span></NavLink>
      <NavLink to="/altro" onClick={goTop}><MoreHorizontal/><span>Altro</span></NavLink>
    </nav>
  </>;
}
