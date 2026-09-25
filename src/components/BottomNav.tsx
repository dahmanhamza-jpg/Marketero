import { NavLink } from 'react-router-dom';
import { Home, Users, CalendarDays, MoreHorizontal, TimerReset } from 'lucide-react';
export function BottomNav(){
  return <nav className="bottom-nav">
    <NavLink to="/"><Home/><span>Oggi</span></NavLink>
    <NavLink to="/clienti"><Users/><span>Clienti</span></NavLink>
    <NavLink to="/focus"><TimerReset/><span>Focus</span></NavLink>
    <NavLink to="/calendario"><CalendarDays/><span>Calendario</span></NavLink>
    <NavLink to="/altro"><MoreHorizontal/><span>Altro</span></NavLink>
  </nav>
}
