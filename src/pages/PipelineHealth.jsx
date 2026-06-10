import { useState, useEffect, useRef } from 'react'
import {
  Activity, Server, TerminalSquare, Search, FileText,
  CheckCircle2, XCircle, Play, ShieldAlert, AlertTriangle,
  RefreshCw, Power
} from 'lucide-react'
import { API_BASE_URL } from '../config/api'

export default function PipelineHealth() {
  const [logs, setLogs] = useState([])
  const [metrics, setMetrics] = useState({
    total: 0, draft: 0, approved: 0, rejected: 0, complete: 0,
    total_hunts: 0, tp_count: 0, fp_count: 0
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('all')
  const [isLive, setIsLive] = useState(true)
  const terminalEndRef = useRef(null)
  const terminalContainerRef = useRef(null)

  useEffect(() => {
    fetchData()
    let interval;
    if (isLive) {
      interval = setInterval(fetchData, 8000)
    }
    return () => clearInterval(interval)
  }, [timeRange, isLive])

  useEffect(() => {
    // Only auto-scroll if we are close to the bottom to avoid overriding user scrolling
    if (terminalContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = terminalContainerRef.current
      if (scrollHeight - scrollTop - clientHeight < 100) {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [logs])

  const fetchData = async () => {
    try {
      const [logsRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/reports/health?time_range=${timeRange}`),
        fetch(`${API_BASE_URL}/reports/metrics?time_range=${timeRange}`)
      ])
      
      const logsData = await logsRes.json()
      const metricsData = await metricsRes.json()

      if (logsData.status === 'success') {
        setLogs((logsData.logs || []).reverse())
      }
      
      if (metricsData.status === 'success' && metricsData.metrics) {
        setMetrics(metricsData.metrics)
      }
    } catch (err) {
      console.error('Failed to fetch pipeline data:', err)
    } finally {
      setLoading(false)
    }
  }

  const renderTerminalLine = (log, index) => {
    const timestamp = new Date(log.run_date).toLocaleTimeString('en-US', { hour12: false })
    let colorClass = 'text-blue-400'
    let prefix = '[INFO]'
    let bgHover = 'hover:bg-blue-500/10'
    
    if (log.status === 'success') {
      colorClass = 'text-emerald-400'
      prefix = '[SUCCESS]'
      bgHover = 'hover:bg-emerald-500/10'
    } else if (log.status === 'failed' || log.status === 'error') {
      colorClass = 'text-red-400'
      prefix = '[ERROR]'
      bgHover = 'hover:bg-red-500/10'
    } else if (log.status === 'started') {
      colorClass = 'text-amber-400'
      prefix = '[START]'
      bgHover = 'hover:bg-amber-500/10'
    }

    return (
      <div key={log.id || index} className={`font-mono text-[13px] leading-relaxed tracking-tight group px-3 py-1 -mx-3 rounded-lg transition-colors ${bgHover}`}>
        <span className="text-gray-500/80 w-[75px] inline-block select-none">{timestamp}</span>
        <span className={`${colorClass} font-bold w-[90px] inline-block`}>{prefix}</span>
        <span className="text-gray-300">
          Agent <span className="text-indigo-400 font-semibold">{log.crew_type}</span> for client <span className="text-amber-200/80">{log.client_id?.substring(0,8) || 'SYSTEM'}...</span> {log.status}.
        </span>
        {log.error_msg && (
          <div className="text-red-400/90 mt-1.5 ml-[175px] whitespace-pre-wrap bg-red-500/5 p-2 rounded border border-red-500/10 font-mono text-xs">
            {log.error_msg}
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 flex items-center gap-3">
            <Activity size={24} className="text-accent-primary" /> God's Eye View
          </h2>
          <p className="text-sm text-textsecondary mt-0.5">Global pipeline observability & execution streams</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-black/20 border border-glass rounded-xl px-4 py-2 text-sm text-textprimary outline-none focus:border-accent-primary transition-all cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="all">All Time</option>
          </select>
          
          <button 
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border transition-all ${
              isLive 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                : 'bg-black/20 text-textsecondary border-glass hover:text-textprimary'
            }`}
          >
            {isLive ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />}
            {isLive ? 'Live Sync' : 'Paused'}
          </button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Hypotheses', val: metrics.total, icon: Server, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
          { label: 'Draft', val: metrics.draft, icon: FileText, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
          { label: 'Approved', val: metrics.approved, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          { label: 'Rejected', val: metrics.rejected, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { label: 'Hunts Run', val: metrics.total_hunts, icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'TP Findings', val: metrics.tp_count, icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
          { label: 'FP Findings', val: metrics.fp_count, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: 'Hunts Done', val: metrics.complete, icon: Play, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
        ].map((kpi, i) => (
          <div key={i} className={`glass-panel border ${kpi.border} rounded-xl p-4 relative overflow-hidden group transition-all hover:-translate-y-0.5 hover:shadow-lg`}>
            <div className={`absolute -right-6 -top-6 w-20 h-20 ${kpi.bg} rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`}></div>
            <kpi.icon size={18} className={`${kpi.color} mb-3`} />
            <p className="text-2xl font-bold text-white mb-1 leading-none">{kpi.val}</p>
            <p className="text-[10px] text-textsecondary uppercase tracking-wider font-bold">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Live Terminal Window ── */}
      <div className="rounded-2xl overflow-hidden shadow-2xl relative border border-white/10 bg-[#0a0a0c]">
        {/* Terminal Header */}
        <div className="px-4 py-3 bg-[#111116] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[0_0_5px_rgba(255,95,86,0.3)]"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_5px_rgba(255,189,46,0.3)]"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[0_0_5px_rgba(39,201,63,0.3)]"></div>
            </div>
            <div className="h-4 w-px bg-white/10"></div>
            <h3 className="font-mono text-xs text-textsecondary flex items-center gap-2">
              <TerminalSquare size={14} className="text-accent-primary"/> 
              ~/system/threat_hunt_orchestrator.sh
            </h3>
          </div>
          
          {isLive && (
            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">Streaming</span>
            </div>
          )}
        </div>
        
        {/* Terminal Body */}
        <div 
          ref={terminalContainerRef}
          className="p-5 h-[450px] overflow-y-auto font-mono text-sm relative custom-scrollbar bg-[#050505]"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 100%)' }}
        >
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-textsecondary opacity-50 space-y-4">
              <RefreshCw size={32} className="animate-spin text-accent-primary" />
              <p className="font-mono text-xs uppercase tracking-widest">Establishing secure link...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-gray-500 font-mono text-xs">No execution logs found for the selected time range.</div>
          ) : (
            <div className="space-y-1">
              <div className="text-accent-primary mb-5 opacity-60 font-mono text-xs flex flex-col gap-1">
                <span>[SYSTEM] Connected to AITH Threat Hunt Orchestrator...</span>
                <span>[SYSTEM] Session started at {new Date().toISOString()}</span>
                <span>[SYSTEM] Polling interval: 8000ms</span>
              </div>
              {logs.map((log, idx) => renderTerminalLine(log, idx))}
              <div ref={terminalEndRef} className="h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
