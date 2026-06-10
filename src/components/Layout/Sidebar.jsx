import { X, LayoutDashboard, Users, FileSearch, Target, AlertTriangle, FileText, Settings as SettingsIcon, Shield, Activity, LogOut, ChevronRight, Search, BrainCircuit } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useClient } from '../../context/ClientContext'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'

const navItems = [
  { to: '/',           label: 'Dashboard',      icon: LayoutDashboard, section: 'main' },
  { to: '/clients',    label: 'Clients',         icon: Users,           section: 'main' },
  { to: '/ai-hub',     label: 'Proactive Intel', icon: BrainCircuit,    section: 'hunting' },
  { to: '/hypotheses', label: 'Hypotheses',      icon: FileSearch,      section: 'hunting', badge: 'pending' },
  { to: '/query-checker', label: 'Query Checker', icon: Search,         section: 'hunting' },
  { to: '/results',    label: 'Hunt Results',    icon: Search,          section: 'hunting' },
  { to: '/coverage',   label: 'MITRE Coverage',  icon: Target,          section: 'hunting' },
  { to: '/ioc-reports',label: 'IOC Reports',     icon: AlertTriangle,   section: 'hunting' },
  { to: '/reports',    label: 'Reports',         icon: FileText,        section: 'platform' },
  { to: '/pipeline',   label: 'Pipeline',        icon: Activity,        section: 'platform' },
  { to: '/settings',   label: 'Settings',        icon: SettingsIcon,    section: 'platform' },
]

const sectionLabels = { main: 'Overview', hunting: 'Threat Hunting', platform: 'Platform' }

const CLIENT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

function Sidebar({ isOpen, onClose }) {
  const { pathname } = useLocation()
  const { logout } = useAuth()
  const { selectedClient } = useClient()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (selectedClient) {
      supabase.from('hypotheses').select('*', { count: 'exact', head: true })
        .eq('client_id', selectedClient.id).eq('status', 'draft')
        .then(({ count }) => setPendingCount(count || 0))
    } else {
      setPendingCount(0)
    }
  }, [selectedClient, pathname])

  // Pick a deterministic color for the client dot
  const clientColor = selectedClient
    ? CLIENT_COLORS[selectedClient.name.charCodeAt(0) % CLIENT_COLORS.length]
    : '#3b82f6'

  const sections = ['main', 'hunting', 'platform']

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-glass glass-panel transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Logo */}
        <div className="flex h-[84px] items-center justify-between px-5">
          <div className="flex items-center gap-3 text-xl font-bold tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary shadow-lg shadow-accent-primary/30">
              <Shield size={19} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent text-base font-bold">ThreatHunt</span>
              <span className="text-[10px] font-semibold tracking-[0.2em] text-accent-primary/70 uppercase">AI Platform</span>
            </div>
          </div>
          <button className="text-textsecondary hover:text-white md:hidden transition-colors" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Active Client Indicator */}
        {selectedClient && (
          <div className="mx-4 mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/4 border border-white/6">
            <div className="w-2 h-2 rounded-full shrink-0 animate-pulse-slow" style={{ backgroundColor: clientColor, boxShadow: `0 0 6px ${clientColor}` }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-textprimary truncate">{selectedClient.name}</p>
              <p className="text-[9px] text-textsecondary uppercase tracking-wider">Active Client</p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {sections.map(section => {
            const items = navItems.filter(n => n.section === section)
            return (
              <div key={section}>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-textsecondary/60 px-3 mb-2">{sectionLabels[section]}</p>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
                    const Icon = item.icon
                    const showBadge = item.badge === 'pending' && pendingCount > 0
                    return (
                      <Link key={item.to} to={item.to}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-accent-primary/12 text-accent-primary shadow-[inset_3px_0_0_0_var(--accent-primary)]'
                            : 'text-textsecondary hover:bg-white/5 hover:text-textprimary'
                        }`}
                        onClick={onClose}
                      >
                        <Icon size={16} className={isActive ? 'text-accent-primary' : 'text-textsecondary group-hover:text-textprimary'} />
                        <span className="flex-1">{item.label}</span>
                        {showBadge && (
                          <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                            {pendingCount}
                          </span>
                        )}
                        {isActive && <ChevronRight size={13} className="opacity-50" />}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-glass p-4">
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-textsecondary hover:bg-red-500/10 hover:text-red-400 transition-all group"
          >
            <LogOut size={16} className="group-hover:text-red-400 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
