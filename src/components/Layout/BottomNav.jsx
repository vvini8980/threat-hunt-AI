import { NavLink } from 'react-router-dom';
import { Home, List, Map, Calendar, Plus } from 'lucide-react';

export default function BottomNav() {
  const navItems = [
    { to: '/', icon: <Home size={20} />, label: 'Dashboard', end: true },
    { to: '/hypotheses', icon: <List size={20} />, label: 'Hypotheses' },
    { to: '/coverage', icon: <Map size={20} />, label: 'Coverage' },
    { to: '/campaigns', icon: <Calendar size={20} />, label: 'Monthly' },
  ];

  const navClass = ({ isActive }) => 
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-indigo-500' : 'text-gray-500 hover:text-gray-300'}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-t border-[#2a2d3e] bg-[#1a1d27] px-2 md:hidden">
      {navItems.slice(0, 2).map(item => (
        <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
          {item.icon}
          <span className="text-[10px] font-medium">{item.label}</span>
        </NavLink>
      ))}

      {/* Center Add Button */}
      <NavLink
        to="/add"
        className="flex h-12 w-12 shrink-0 -translate-y-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
      >
        <Plus size={24} />
      </NavLink>

      {navItems.slice(2).map(item => (
        <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
          {item.icon}
          <span className="text-[10px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
