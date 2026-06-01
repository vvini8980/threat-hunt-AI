import { useState, useEffect } from 'react'
import { Building2, FileSearch, Clock, Target, FileText, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useClient } from '../context/ClientContext'

function StatCard({ title, value, icon: Icon, colorClass }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-glass glass-panel p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-accent-primary/10">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent opacity-50 blur-2xl transition-all group-hover:scale-150 group-hover:opacity-100" />
      <div className="relative z-10 flex items-center gap-5">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${colorClass} shadow-inner transition-transform group-hover:scale-110`}>
          <Icon size={26} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-textsecondary uppercase">{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-textprimary">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { clients, loading: clientsLoading } = useClient()
  const [stats, setStats] = useState({
    activeClients: 0,
    hypothesesToday: 0,
    pendingApproval: 0,
    tpThisWeek: 0,
    reportsToday: 0
  })
  const [clientStats, setClientStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardStats() {
      try {
        setLoading(true)
        
        // 1. Active Clients (Count from clients context or DB)
        const activeClientsCount = clients.length

        // 2. Hypotheses Today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const { count: hypothesesToday } = await supabase
          .from('hypotheses')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString())

        // 3. Pending Approval Count
        const { count: pendingApproval } = await supabase
          .from('hypotheses')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'draft')

        // 4. TP Found This Week
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        
        const { count: tpThisWeek } = await supabase
          .from('hunt_results')
          .select('*', { count: 'exact', head: true })
          .eq('verdict', 'TP')
          .gte('executed_at', oneWeekAgo.toISOString())

        // 5. Reports Sent Today
        const { count: reportsToday } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', today.toISOString())

        setStats({
          activeClients: activeClientsCount,
          hypothesesToday: hypothesesToday || 0,
          pendingApproval: pendingApproval || 0,
          tpThisWeek: tpThisWeek || 0,
          reportsToday: reportsToday || 0
        })

        // Fetch per-client summaries
        if (clients.length > 0) {
          const clientIds = clients.map(c => c.id)
          
          // Get hypotheses per client
          const { data: clientHypos } = await supabase
            .from('hypotheses')
            .select('client_id, status')
            .in('client_id', clientIds)

          const { data: clientResults } = await supabase
            .from('hunt_results')
            .select('client_id, verdict')
            .in('client_id', clientIds)

          const mergedStats = clients.map(client => {
            const hypos = clientHypos?.filter(h => h.client_id === client.id) || []
            const results = clientResults?.filter(r => r.client_id === client.id) || []
            
            return {
              id: client.id,
              name: client.name,
              totalHypos: hypos.length,
              pending: hypos.filter(h => h.status === 'draft').length,
              active: hypos.filter(h => h.status === 'running').length,
              truePositives: results.filter(r => r.verdict === 'TP').length
            }
          })
          
          setClientStats(mergedStats)
        }
      } catch (err) {
        console.error("Failed to load dashboard stats", err)
      } finally {
        setLoading(false)
      }
    }

    if (!clientsLoading) {
      fetchDashboardStats()
    }
  }, [clients, clientsLoading])

  if (loading || clientsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Dashboard Overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Active Clients"
          value={stats.activeClients}
          icon={Building2}
          colorClass="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          title="Hypotheses (Today)"
          value={stats.hypothesesToday}
          icon={FileSearch}
          colorClass="bg-indigo-500/10 text-indigo-500"
        />
        <StatCard
          title="Pending Approval"
          value={stats.pendingApproval}
          icon={Clock}
          colorClass="bg-yellow-500/10 text-yellow-500"
        />
        <StatCard
          title="TPs (This Week)"
          value={stats.tpThisWeek}
          icon={Target}
          colorClass="bg-red-500/10 text-red-500"
        />
        <StatCard
          title="Reports Sent (Today)"
          value={stats.reportsToday}
          icon={FileText}
          colorClass="bg-green-500/10 text-green-500"
        />
      </div>

      <div>
        <h3 className="text-xl font-semibold tracking-tight text-textprimary mb-6 animate-fade-in">Client Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clientStats.map((client, i) => (
            <div key={client.id} className="group relative glass-panel border border-glass rounded-2xl p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-accent-primary/40 hover:shadow-xl animate-slide-right" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-2xl pointer-events-none" />
              <h4 className="relative z-10 text-xl font-bold text-textprimary mb-6 flex items-center justify-between">
                {client.name}
                {client.truePositives > 0 && (
                  <span className="text-xs font-bold uppercase tracking-wider bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                    <AlertTriangle size={14} /> Action Needed
                  </span>
                )}
              </h4>
              <div className="relative z-10 grid grid-cols-2 gap-y-6 gap-x-4">
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wider text-textsecondary mb-1">Total Hypotheses</span>
                  <span className="text-2xl font-bold text-textprimary">{client.totalHypos}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wider text-textsecondary mb-1">Running</span>
                  <span className="text-2xl font-bold text-accent-primary drop-shadow-sm">{client.active}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wider text-textsecondary mb-1">Pending</span>
                  <span className="text-2xl font-bold text-yellow-500 drop-shadow-sm">{client.pending}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wider text-textsecondary mb-1">True Positives</span>
                  <span className="text-2xl font-bold text-red-500 drop-shadow-sm">{client.truePositives}</span>
                </div>
              </div>
            </div>
          ))}
          {clientStats.length === 0 && (
            <div className="col-span-full py-12 text-center text-textsecondary glass-panel rounded-2xl border border-glass animate-fade-in">
              <div className="mb-3 flex justify-center opacity-50"><Building2 size={48} /></div>
              <p className="text-lg">No clients available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
