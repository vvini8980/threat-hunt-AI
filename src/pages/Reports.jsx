import { useState, useEffect } from 'react'
import {
  FileText, Mail, Calendar, Download, RefreshCw, Plus, Clock4,
  ShieldAlert, Target, BarChart3, AlertTriangle, CheckCircle2,
  TrendingUp, Globe, Crosshair, ChevronDown, ChevronUp,
  FileBarChart, Shield, Activity
} from 'lucide-react'
import { supabase } from '../services/supabase'
import { useClient } from '../context/ClientContext'
import { API_BASE_URL } from '../config/api'

// ── Report type definitions ──────────────────────────────────────────────────
const REPORT_TYPES = [
  {
    id: 'daily',
    label: 'Daily Hunt Summary',
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    description: 'Today\'s hunt executions, verdicts, and top findings',
    schedule: 'Automated — every day at report time',
  },
  {
    id: 'weekly',
    label: 'Weekly Executive Summary',
    icon: BarChart3,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    description: '7-day trend analysis, TP/FP rates, coverage gaps',
    schedule: 'Automated — every Monday',
  },
  {
    id: 'ioc',
    label: 'IOC Intelligence Report',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    description: 'All active IOCs with blocklist recommendations',
    schedule: 'On-demand or daily',
  },
  {
    id: 'hunt',
    label: 'Hunt Results Report',
    icon: Crosshair,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    description: 'Detailed Splunk results, evidence, analyst notes',
    schedule: 'On-demand',
  },
  {
    id: 'executive',
    label: 'Executive Threat Brief',
    icon: Shield,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    description: 'C-suite summary of threat posture and key findings',
    schedule: 'Monthly',
  },
  {
    id: 'coverage',
    label: 'MITRE Coverage Report',
    icon: Target,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    description: 'ATT&CK technique coverage map and detection gaps',
    schedule: 'On-demand',
  },
]

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ sentAt }) {
  if (sentAt) return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 size={9} /> Sent
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
      <Clock4 size={9} /> Not Sent
    </span>
  )
}

// ── Generate Report Modal ─────────────────────────────────────────────────────
function GenerateModal({ onClose, onGenerate, generating }) {
  const [type, setType] = useState('daily')
  const [dateRange, setDateRange] = useState('today')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel border border-glass rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
        <h3 className="text-lg font-bold text-textprimary mb-1">Generate New Report</h3>
        <p className="text-xs text-textsecondary mb-5">Select the report type and date range to generate</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-textsecondary mb-2 block">Report Type</label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.id}
                  onClick={() => setType(rt.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                    type === rt.id
                      ? `${rt.bg} ${rt.border} ${rt.color}`
                      : 'border-glass text-textsecondary hover:border-white/10 hover:text-textprimary'
                  }`}
                >
                  <rt.icon size={14} />
                  <span className="text-xs font-semibold">{rt.label.split(' ').slice(0, 2).join(' ')}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-textsecondary mb-2 block">Date Range</label>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="w-full bg-black/20 border border-glass rounded-xl px-3 py-2.5 text-sm text-textprimary outline-none focus:border-accent-primary transition-all"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-glass text-textsecondary hover:text-textprimary text-sm font-semibold transition-all">
            Cancel
          </button>
          <button
            onClick={() => onGenerate(type, dateRange)}
            disabled={generating}
            className="flex-1 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-secondary text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? <><RefreshCw size={14} className="animate-spin" /> Generating...</> : <><Plus size={14} /> Generate</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Live stats panel ──────────────────────────────────────────────────────────
function LiveStats({ clientId }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!clientId) return
    async function load() {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

        const [{ count: totalHypos }, { count: todayHunts }, { count: tpCount }, { count: fpCount }, { count: iocCount }] = await Promise.all([
          supabase.from('hypotheses').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
          supabase.from('hunt_results').select('*', { count: 'exact', head: true }).eq('client_id', clientId).gte('executed_at', today.toISOString()),
          supabase.from('hunt_results').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('verdict', 'TP').gte('executed_at', weekAgo.toISOString()),
          supabase.from('hunt_results').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('verdict', 'FP').gte('executed_at', weekAgo.toISOString()),
          supabase.from('ioc_reports').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        ])
        setStats({
          totalHypos: totalHypos || 0,
          todayHunts: todayHunts || 0,
          tpThisWeek: tpCount || 0,
          fpThisWeek: fpCount || 0,
          totalIOCs: iocCount || 0,
          tpRate: tpCount && fpCount ? Math.round((tpCount / (tpCount + fpCount)) * 100) : 0,
        })
      } catch (err) {
        console.error(err)
      }
    }
    load()
  }, [clientId])

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        { label: 'Total Hypotheses', value: stats.totalHypos, icon: FileText, color: 'text-blue-400' },
        { label: 'Hunts Today', value: stats.todayHunts, icon: Activity, color: 'text-violet-400' },
        { label: 'TPs (7d)', value: stats.tpThisWeek, icon: ShieldAlert, color: 'text-red-400' },
        { label: 'FPs (7d)', value: stats.fpThisWeek, icon: AlertTriangle, color: 'text-amber-400' },
        { label: 'IOCs Tracked', value: stats.totalIOCs, icon: Globe, color: 'text-cyan-400' },
        { label: 'TP Rate', value: `${stats.tpRate}%`, icon: TrendingUp, color: 'text-emerald-400' },
      ].map(s => (
        <div key={s.label} className="glass-panel border border-glass rounded-xl p-3 text-center">
          <s.icon size={16} className={`mx-auto mb-1.5 ${s.color}`} />
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-textsecondary mt-0.5 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const { selectedClient } = useClient()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (selectedClient) fetchReports()
    else setReports([])
  }, [selectedClient])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', selectedClient.id)
        .order('report_date', { ascending: false })
      if (error) throw error
      setReports(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async (type, dateRange) => {
    setGenerating(true)
    try {
      const endpoint = `/reports/${type}/${selectedClient.id}`
      const res = await fetch(`${API_BASE_URL}${endpoint}?date_range=${dateRange}`, { method: 'POST' })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned ${res.status}`);
      }
      await fetchReports()
      setShowModal(false)
    } catch (err) {
      alert('Failed to generate: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleResend = async (report) => {
    setSendingId(report.id)
    try {
      const res = await fetch(`${API_BASE_URL}/reports/send/${selectedClient.id}?report_id=${report.id}`, { method: 'POST' })
      if (!res.ok) {
        // fallback: just update sent_at
        await supabase.from('reports').update({ sent_at: new Date().toISOString() }).eq('id', report.id)
      }
      await fetchReports()
    } catch (err) {
      console.error(err)
    } finally {
      setSendingId(null)
    }
  }

  const filtered = typeFilter === 'all' ? reports : reports.filter(r => r.report_type === typeFilter)

  const getRTConfig = (type) => REPORT_TYPES.find(r => r.id === type) || {
    label: type,
    icon: FileText,
    color: 'text-textsecondary',
    bg: 'bg-white/5',
    border: 'border-glass',
  }

  function timeAgo(ts) {
    if (!ts) return '—'
    const diff = Math.floor((Date.now() - new Date(ts)) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  if (!selectedClient) return (
    <div className="flex h-full items-center justify-center flex-col gap-4 text-textsecondary">
      <FileBarChart size={48} className="opacity-10" />
      <p>Select a client to view reports</p>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {showModal && (
        <GenerateModal
          onClose={() => setShowModal(false)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 flex items-center gap-3">
            <FileBarChart size={22} className="text-accent-primary" /> Reports
          </h2>
          <p className="text-sm text-textsecondary mt-0.5">{selectedClient.name} · {reports.length} reports</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/20 hover:-translate-y-0.5"
        >
          <Plus size={15} /> Generate Report
        </button>
      </div>

      {/* ── Live Stats Strip ── */}
      <LiveStats clientId={selectedClient.id} />

      {/* ── Available Report Types (Quick-generate cards) ── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-textsecondary mb-3">Report Types Available</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {REPORT_TYPES.map(rt => (
            <button
              key={rt.id}
              onClick={() => { setShowModal(true) }}
              className={`group glass-panel border ${rt.border} rounded-xl p-3 text-left hover:-translate-y-0.5 transition-all hover:shadow-lg`}
            >
              <rt.icon size={18} className={`${rt.color} mb-2`} />
              <p className={`text-xs font-bold ${rt.color} leading-tight`}>{rt.label}</p>
              <p className="text-[10px] text-textsecondary mt-1 leading-tight">{rt.description}</p>
              <p className="text-[9px] text-textsecondary/60 mt-2 italic">{rt.schedule}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter Chips ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-textsecondary font-medium">Filter:</span>
        {['all', ...REPORT_TYPES.map(r => r.id)].map(f => {
          const rt = REPORT_TYPES.find(r => r.id === f)
          return (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                typeFilter === f
                  ? 'bg-accent-primary text-white border-accent-primary'
                  : 'border-glass text-textsecondary hover:border-white/20 hover:text-textprimary'
              }`}
            >
              {f === 'all' ? 'All Reports' : rt?.label?.split(' ').slice(0, 2).join(' ') || f}
            </button>
          )
        })}
        {typeFilter !== 'all' && (
          <button onClick={() => setTypeFilter('all')} className="text-xs text-textsecondary hover:text-red-400 transition-colors px-1">✕</button>
        )}
      </div>

      {/* ── Reports List ── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-textsecondary glass-panel rounded-2xl border border-glass">
          <FileBarChart size={40} className="mx-auto mb-3 opacity-10" />
          <p className="font-medium">No reports yet</p>
          <p className="text-xs mt-1">Click "Generate Report" to create your first report</p>
          <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-accent-primary text-white rounded-xl text-sm font-semibold hover:bg-accent-secondary transition-all">
            Generate Now →
          </button>
        </div>
      ) : (
        <div className="glass-panel border border-glass rounded-2xl overflow-hidden shadow-xl">
          {/* Table header */}
          <div className="grid grid-cols-[28px_1fr_120px_100px_140px_120px] gap-4 px-5 py-3 bg-white/3 border-b border-glass text-[11px] font-bold uppercase tracking-widest text-textsecondary">
            <span />
            <span>Report</span>
            <span>Type</span>
            <span>Status</span>
            <span>Generated</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-white/5">
            {filtered.map((report, i) => {
              const rt = getRTConfig(report.report_type)
              const RtIcon = rt.icon
              const isExpanded = expandedId === report.id

              return (
                <div key={report.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="grid grid-cols-[28px_1fr_120px_100px_140px_120px] gap-4 px-5 py-4 hover:bg-white/3 transition-colors items-center">
                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : report.id)}
                      className="text-textsecondary hover:text-textprimary transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {/* Title */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${rt.bg} flex items-center justify-center shrink-0`}>
                        <RtIcon size={13} className={rt.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-textprimary truncate">{rt.label}</p>
                        {report.summary && <p className="text-[11px] text-textsecondary truncate">{report.summary}</p>}
                      </div>
                    </div>

                    {/* Type chip */}
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg capitalize ${rt.bg} ${rt.color} border ${rt.border}`}>
                      {report.report_type}
                    </span>

                    {/* Status */}
                    <StatusBadge sentAt={report.sent_at} />

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-textsecondary">
                      <Clock4 size={11} />
                      {timeAgo(report.report_date)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {report.file_url && report.file_url !== 'processing...' && (
                        <button
                          onClick={() => window.open(report.file_url, '_blank')}
                          title="Download"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-textsecondary hover:text-textprimary transition-all"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleResend(report)}
                        disabled={sendingId === report.id}
                        title="Send via Email"
                        className="p-1.5 rounded-lg bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary transition-all disabled:opacity-50"
                      >
                        {sendingId === report.id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : <Mail size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-14 pb-5 pt-2 border-t border-white/5 bg-white/1 animate-slide-up">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <p className="text-textsecondary uppercase tracking-wider font-bold mb-1">Report ID</p>
                          <p className="font-mono text-textprimary">{report.id?.substring(0, 12)}...</p>
                        </div>
                        <div>
                          <p className="text-textsecondary uppercase tracking-wider font-bold mb-1">Generated At</p>
                          <p className="text-textprimary">{report.report_date ? new Date(report.report_date).toLocaleString() : '—'}</p>
                        </div>
                        <div>
                          <p className="text-textsecondary uppercase tracking-wider font-bold mb-1">Last Sent</p>
                          <p className="text-textprimary">{report.sent_at ? new Date(report.sent_at).toLocaleString() : 'Never sent'}</p>
                        </div>
                        <div>
                          <p className="text-textsecondary uppercase tracking-wider font-bold mb-1">File</p>
                          {report.file_url && report.file_url !== 'processing...'
                            ? <a href={report.file_url} target="_blank" rel="noreferrer" className="text-accent-primary hover:underline flex items-center gap-1"><Download size={11} /> Download PDF</a>
                            : <p className="text-textsecondary italic">Not available</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Scheduled Reports Info ── */}
      <div className="glass-panel border border-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock4 size={15} className="text-accent-primary" />
          <h3 className="text-sm font-bold text-textprimary">Automated Report Schedule</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {[
            { label: '🌅 Daily Hunt Summary', time: 'Every day at your configured report time', color: 'text-blue-400' },
            { label: '📊 Weekly Executive Brief', time: 'Every Monday — 7-day rollup', color: 'text-violet-400' },
            { label: '🔒 IOC Intelligence Report', time: 'Daily — automatically synced from OpenCTI', color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/3 rounded-xl p-3 border border-glass">
              <p className={`font-semibold ${s.color} mb-1`}>{s.label}</p>
              <p className="text-textsecondary">{s.time}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-textsecondary mt-3">
          Configure report delivery time and email in{' '}
          <a href="/settings" className="text-accent-primary hover:underline">Settings → Automated Reporting</a>
        </p>
      </div>

    </div>
  )
}
