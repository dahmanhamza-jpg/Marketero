import { NavLink } from 'react-router-dom';
import { Home, Users, CalendarDays, MoreHorizontal, TimerReset } from 'lucide-react';

export function BottomNav(){
  const goTop=()=>window.scrollTo({top:0,left:0,behavior:'auto'});

  return <nav className="bottom-nav">
    <NavLink to="/" onClick={goTop}><Home/><span>Oggi</span></NavLink>
    <NavLink to="/clienti" onClick={goTop}><Users/><span>Clienti</span></NavLink>
    <NavLink to="/focus" onClick={goTop}><TimerReset/><span>Focus</span></NavLink>
    <NavLink to="/calendario" onClick={goTop}><CalendarDays/><span>Calendario</span></NavLink>
    <NavLink to="/altro" onClick={goTop}><MoreHorizontal/><span>Altro</span></NavLink>
  </nav>
}
