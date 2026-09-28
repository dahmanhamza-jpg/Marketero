import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, CalendarDays, MoreHorizontal, TimerReset, Radar } from 'lucide-react';
import { LeadGenerationPage } from '../features/LeadGenerationPage';

export function BottomNav(){
  const location=useLocation();
  const navigate=useNavigate();
  const goTop=()=>window.scrollTo({top:0,left:0,behavior:'auto'});
  const leadGenOpen=location.pathname==='/clienti'&&new URLSearchParams(location.search).get('leadgen')==='1';
  const inClients=location.pathname.startsWith('/clienti');

  return <>
    {inClients&&!leadGenOpen&&<button
      type="button"
      aria-label="Apri Lead Generation"
      onClick={()=>navigate('/clienti?leadgen=1')}
      style={{position:'fixed',left:'16px',bottom:'calc(94px + env(safe-area-inset-bottom))',zIndex:1050,border:'1px solid rgba(23,21,19,.10)',borderRadius:'999px',padding:'10px 13px',background:'rgba(238,233,227,.96)',boxShadow:'0 12px 28px rgba(31,24,17,.14)',display:'inline-flex',alignItems:'center',gap:'7px',fontWeight:800,color:'#2a231f'}}>
      <Radar size={17}/><span>Lead Generation</span>
    </button>}
    {leadGenOpen&&createPortal(<div style={{position:'fixed',inset:0,zIndex:2500,overflowY:'auto',WebkitOverflowScrolling:'touch',background:'#e9e4de'}}><LeadGenerationPage/></div>,document.body)}
    <nav className="bottom-nav">
      <NavLink to="/" onClick={goTop}><Home/><span>Oggi</span></NavLink>
      <NavLink to="/clienti" onClick={goTop}><Users/><span>Clienti</span></NavLink>
      <NavLink to="/focus" onClick={goTop}><TimerReset/><span>Focus</span></NavLink>
      <NavLink to="/calendario" onClick={goTop}><CalendarDays/><span>Calendario</span></NavLink>
      <NavLink to="/altro" onClick={goTop}><MoreHorizontal/><span>Altro</span></NavLink>
    </nav>
  </>;
}
