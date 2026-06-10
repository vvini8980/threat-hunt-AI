import { useState, useEffect } from 'react'
import { Building2, FileSearch, Target, FileText, AlertTriangle, ArrowRight, Crosshair, ShieldAlert, Clock4, Sparkles, CheckCircle2, Activity } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useClient } from '../context/ClientContext'
import { Link } from 'react-router-dom'

function StatCard({ title, value, icon: Icon, colorClass, glowColor, subtitle, linkTo }) {
  const card = (
    <div className={`group relative overflow-hidden rounded-2xl border glass-panel p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer`}
      style={{ borderColor: glowColor + '30', boxShadow: `0 0 0 0 ${glowColor}` }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{ background: `radial-gradient(circle at 80% 20%, ${glowColor}08 0%, transparent 70%)` }} />
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-textsecondary uppercase mb-2">{title}</p>
          <p className="text-4xl font-bold tracking-tight text-textprimary">{value}</p>
          {subtitle && <p className="text-xs text-textsecondary mt-2">{subtitle}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colorClass} transition-transform group-hover:scale-110`}>
          <Icon size={22} strokeWidth={2} />
        </div>
      </div>
    </div>
  )
  return linkTo ? <Link to={linkTo}>{card}</Link> : card
}

function ThreatLevelBadge({ truePositives }) {
  if (truePositives >= 3) return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20 animate-pulse-slow">🔴 Critical</span>
  if (truePositives >= 1) return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20">🟠 Elevated</span>
  return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">🟢 Normal</span>
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { clients, loading: clientsLoading } = useClient()
  const [stats, setStats] = useState({ activeClients: 0, hypothesesToday: 0, pendingApproval: 0, tpThisWeek: 0, reportsToday: 0 })
  const [clientStats, setClientStats] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientsLoading) fetchDashboardStats()
  }, [clients, clientsLoading])

  async function fetchDashboardStats() {
    try {
      setLoading(true)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const [{ count: hypothesesToday }, { count: pendingApproval }, { count: tpThisWeek }, { count: reportsToday }] = await Promise.all([
        supabase.from('hypotheses').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('hypotheses').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('hunt_results').select('*', { count: 'exact', head: true }).eq('verdict', 'TP').gte('executed_at', oneWeekAgo.toISOString()),
        supabase.from('reports').select('*', { count: 'exact', head: true }).gte('sent_at', today.toISOString()),
      ])

      setStats({ activeClients: clients.length, hypothesesToday: hypothesesToday || 0, pendingApproval: pendingApproval || 0, tpThisWeek: tpThisWeek || 0, reportsToday: reportsToday || 0 })

      if (clients.length > 0) {
        const clientIds = clients.map(c => c.id)
        const [{ data: clientHypos }, { data: clientResults }, { data: recent }] = await Promise.all([
          supabase.from('hypotheses').select('client_id, status').in('client_id', clientIds),
          supabase.from('hunt_results').select('client_id, verdict').in('client_id', clientIds),
          supabase.from('hypotheses').select('id, title, status, created_at, client_id').order('created_at', { ascending: false }).limit(8),
        ])

        setClientStats(clients.map(client => {
          const hypos = clientHypos?.filter(h => h.client_id === client.id) || []
          const results = clientResults?.filter(r => r.client_id === client.id) || []
          return {
            id: client.id, name: client.name,
            totalHypos: hypos.length,
            pending: hypos.filter(h => h.status === 'draft').length,
            active: hypos.filter(h => h.status === 'running').length,
            truePositives: results.filter(r => r.verdict === 'TP').length
          }
        }))

        setRecentActivity((recent || []).map(h => ({
          id: h.id, title: h.title, status: h.status, time: h.created_at,
          clientName: clients.find(c => c.id === h.client_id)?.name || 'Unknown'
        })))
      }
    } catch (err) {
      console.error('Dashboard fetch error', err)
    } finally {
      setLoading(false)
    }
  }

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts)) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return `${Math.floor(diff / 1440)}d ago`
  }

  const statusColors = {
    draft: 'bg-amber-500/15 text-amber-400',
    approved: 'bg-blue-500/15 text-blue-400',
    running: 'bg-violet-500/15 text-violet-400',
    complete: 'bg-emerald-500/15 text-emerald-400',
  }

  if (loading || clientsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-10 w-72 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-textsecondary mb-1">{getGreeting()}, Hunter 🎯</p>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60">
            Operations Overview
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-textsecondary bg-white/5 border border-glass px-3 py-2 rounded-xl">
          <Activity size={13} className="text-emerald-400 animate-pulse-slow" />
          System Active
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Active Clients" value={stats.activeClients} icon={Building2} colorClass="bg-blue-500/10 text-blue-400" glowColor="#3b82f6" linkTo="/clients" />
        <StatCard title="Hypotheses Today" value={stats.hypothesesToday} icon={Sparkles} colorClass="bg-violet-500/10 text-violet-400" glowColor="#8b5cf6" linkTo="/hypotheses" />
        <StatCard title="Pending Approval" value={stats.pendingApproval} icon={Clock4} colorClass="bg-amber-500/10 text-amber-400" glowColor="#f59e0b" linkTo="/hypotheses"
          subtitle={stats.pendingApproval > 0 ? 'Need your review →' : 'All clear'} />
        <StatCard title="True Positives" value={stats.tpThisWeek} icon={ShieldAlert} colorClass="bg-red-500/10 text-red-400" glowColor="#ef4444" linkTo="/results"
          subtitle="This week" />
        <StatCard title="Reports Sent" value={stats.reportsToday} icon={FileText} colorClass="bg-emerald-500/10 text-emerald-400" glowColor="#10b981" linkTo="/reports"
          subtitle="Today" />
      </div>

      {/* ── Quick Action Banner (when pending approvals exist) ── */}
      {stats.pendingApproval > 0 && (
        <Link to="/hypotheses" className="group flex items-center justify-between glass-panel border border-amber-500/20 rounded-2xl px-5 py-4 hover:border-amber-500/40 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/5 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Clock4 size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-textprimary text-sm">{stats.pendingApproval} hypotheses awaiting your approval</p>
              <p className="text-xs text-textsecondary">Review and approve to begin threat hunting</p>
            </div>
          </div>
          <ArrowRight size={18} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* ── Bottom Grid: Client Status + Recent Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Client Status Cards */}
        <div className="xl:col-span-2 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-textsecondary px-1">Client Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientStats.map((client, i) => (
              <div key={client.id} className="group relative glass-panel border border-glass rounded-2xl p-5 shadow transition-all duration-300 hover:-translate-y-1 hover:border-white/10 hover:shadow-lg animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                <div className="relative z-10 flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                      <Building2 size={15} className="text-accent-primary" />
                    </div>
                    <h4 className="font-bold text-textprimary">{client.name}</h4>
                  </div>
                  <ThreatLevelBadge truePositives={client.truePositives} />
                </div>
                <div className="relative z-10 grid grid-cols-4 gap-2">
                  {[
                    { label: 'Hunts', value: client.totalHypos, color: 'text-textprimary' },
                    { label: 'Running', value: client.active, color: 'text-accent-primary' },
                    { label: 'Pending', value: client.pending, color: 'text-amber-400' },
                    { label: 'TPs', value: client.truePositives, color: 'text-red-400' },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-white/3 rounded-xl py-2">
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-textsecondary mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {clientStats.length === 0 && (
              <div className="col-span-full py-12 text-center text-textsecondary glass-panel rounded-2xl border border-glass">
                <Building2 size={40} className="mx-auto mb-3 opacity-20" />
                <p>No clients yet. <Link to="/clients" className="text-accent-primary underline">Add one →</Link></p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold uppercase tracking-widest text-textsecondary">Recent Activity</h3>
            <Link to="/hypotheses" className="text-xs text-accent-primary hover:underline">View all →</Link>
          </div>
          <div className="glass-panel border border-glass rounded-2xl overflow-hidden">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-textsecondary text-sm">No activity yet</div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentActivity.map((item, i) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors animate-slide-up group" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Crosshair size={13} className="text-accent-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-textprimary truncate">{item.title}</p>
                      <p className="text-[10px] text-textsecondary mt-0.5">{item.clientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${statusColors[item.status] || 'bg-white/5 text-textsecondary'}`}>
                        {item.status}
                      </span>
                      <span className="text-[10px] text-textsecondary">{timeAgo(item.time)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
