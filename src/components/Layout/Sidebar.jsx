import { X, LayoutDashboard, Users, FileSearch, Target, AlertTriangle, FileText, Settings as SettingsIcon, Shield } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/hypotheses', label: 'Hypotheses', icon: FileSearch },
  { to: '/results', label: 'Hunt Results', icon: Target },
  { to: '/ioc-reports', label: 'IOC Reports', icon: AlertTriangle },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function Sidebar({ isOpen, onClose }) {
  const { pathname } = useLocation()
  const { logout } = useAuth()

  const navClassName = (isActive) =>
    [
      'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300',
      isActive
        ? 'bg-accent-primary/10 text-accent-primary shadow-[inset_4px_0_0_0_var(--accent-primary)]'
        : 'text-textsecondary hover:bg-white/5 hover:text-textprimary',
    ].join(' ')

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-glass glass-panel transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[84px] items-center justify-between px-6">
          <div className="flex items-center gap-3 text-xl font-bold tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary shadow-lg shadow-accent-glow">
              <Shield size={18} className="text-white" />
            </div>
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              ThreatHunt AI
            </span>
          </div>
          <button className="text-textsecondary hover:text-white md:hidden" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {navItems.map((item) => {
            const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={navClassName(isActive)}
                onClick={onClose}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <button
            onClick={() => logout()}
            className="w-full rounded-md px-4 py-2 text-sm font-medium text-textsecondary hover:bg-red-500/10 hover:text-red-500 transition-colors text-left"
          >
            Log Out
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
