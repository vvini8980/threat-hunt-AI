import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, Building2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useClient } from '../../context/ClientContext'

const pageNames = [
  { match: (pathname) => pathname === '/', name: 'Dashboard' },
  { match: (pathname) => pathname === '/clients', name: 'Clients' },
  { match: (pathname) => pathname === '/ai-hub', name: 'Proactive Threat Intel' },
  { match: (pathname) => pathname === '/hypotheses', name: 'Hypotheses' },
  { match: (pathname) => pathname === '/results', name: 'Hunt Results' },
  { match: (pathname) => pathname === '/ioc-reports', name: 'IOC Reports' },
  { match: (pathname) => pathname === '/reports', name: 'Reports' },
  { match: (pathname) => pathname === '/pipeline', name: 'Pipeline Health' },
  { match: (pathname) => pathname === '/settings', name: 'Settings' },
]

function TopBar({ toggleSidebar }) {
  const { pathname } = useLocation()
  const { clients, selectedClient, setSelectedClient, loading } = useClient()

  const pageName =
    pageNames.find((item) => item.match(pathname))?.name ?? 'ThreatHunt AI'

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  )

  return (
    <header className="fixed left-0 md:left-[260px] right-0 top-0 z-10 flex h-[84px] items-center justify-between border-b border-glass glass-panel px-4 md:px-8 gap-4 transition-all">
      
      {/* Left side: Hamburger + Page Name */}
      <div className="flex items-center gap-4 shrink-0 min-w-0 animate-fade-in">
        <button
          type="button"
          className="md:hidden text-textsecondary hover:text-white shrink-0 transition-colors"
          onClick={toggleSidebar}
        >
          <Menu size={24} />
        </button>
        <h1 className="text-2xl font-semibold text-textprimary hidden md:block shrink-0 whitespace-nowrap truncate tracking-tight">
          {pageName}
        </h1>
      </div>

      {/* Center: Global Client Selector */}
      <div className="flex-1 flex justify-end md:justify-center max-w-[400px] animate-slide-right">
        {!loading && clients.length > 0 ? (
          <div className="relative flex items-center w-full max-w-[280px] group">
            <Building2 className="absolute left-3.5 w-4 h-4 text-accent-primary pointer-events-none transition-transform group-hover:scale-110" />
            <select
              value={selectedClient?.id || ''}
              onChange={(e) => {
                const client = clients.find(c => c.id === e.target.value)
                setSelectedClient(client)
              }}
              className="w-full appearance-none bg-white/5 border border-glass focus:border-accent-primary focus:ring-1 focus:ring-accent-primary rounded-xl py-2.5 pl-11 pr-10 text-sm font-medium text-textprimary outline-none cursor-pointer hover:bg-white/10 transition-all shadow-lg"
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 pointer-events-none text-textsecondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        ) : loading ? (
          <div className="text-sm text-textsecondary animate-pulse">Loading clients...</div>
        ) : (
          <div className="text-sm text-textsecondary">No clients found</div>
        )}
      </div>

      {/* Right side: Date */}
      <time className="text-sm text-textsecondary hidden lg:block shrink-0 font-medium">
        {currentDate}
      </time>
    </header>
  )
}

export default TopBar
