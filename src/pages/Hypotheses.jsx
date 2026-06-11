import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Check, X as XIcon, Plus, Play, CheckCircle2, Search, Copy, Trash2, ChevronUp, ChevronDown, Filter, Sparkles, Crosshair, Clock4, AlertTriangle, RefreshCw, Eye, EyeOff, Terminal, Zap, Target, Activity, FileSearch, SearchCheck, Upload, Download, Database, Shield, Edit2, CheckSquare, Square, Calendar } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { API_BASE_URL } from '../config/api'
import { useClient } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'
import { ConfidenceBadge, TriageQueryBlock, HuntingSteps, LogSourcesTable, IOCCard } from '../components/AIHub/AttackCard'
import AIChat from '../components/AIAssistant/AIChat'

// ──────────────────────────────────────────────────
// MITRE ATT&CK Tactics (common)
// ──────────────────────────────────────────────────
const MITRE_TACTICS = [
  'Reconnaissance', 'Resource Development', 'Initial Access', 'Execution',
  'Persistence', 'Privilege Escalation', 'Defense Evasion', 'Credential Access',
  'Discovery', 'Lateral Movement', 'Collection', 'Command and Control',
  'Exfiltration', 'Impact'
]

// ──────────────────────────────────────────────────
// Toast Notification System
// ──────────────────────────────────────────────────
const ToastContainer = ({ toasts, remove }) => (
  <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium backdrop-blur-md animate-slide-up pointer-events-auto max-w-sm ${
          t.type === 'error'   ? 'bg-red-950/90 border-red-500/30 text-red-200' :
          t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' :
          t.type === 'warning' ? 'bg-amber-950/90 border-amber-500/30 text-amber-200' :
          'bg-[#1a1d27]/95 border-white/10 text-white'
        }`}
      >
        <span className="text-lg flex-shrink-0">
          {t.type === 'error' ? '❌' : t.type === 'success' ? '✅' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
        </span>
        <span className="flex-1 leading-snug">{t.message}</span>
        <button onClick={() => remove(t.id)} className="text-current opacity-50 hover:opacity-100 transition-opacity ml-1">
          <XIcon size={14} />
        </button>
      </div>
    ))}
  </div>
)

function useToast() {
  const [toasts, setToasts] = useState([])
  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])
  return { toasts, show, remove }
}

// ──────────────────────────────────────────────────
// Utility: Copy text to clipboard
// ──────────────────────────────────────────────────
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).catch(() => {})
}

// ──────────────────────────────────────────────────
// Stat Mini Card
// ──────────────────────────────────────────────────
const StatMini = ({ label, value, icon: Icon, color }) => (
  <div className="flex items-center gap-3 bg-white/[0.03] border border-glass rounded-xl px-4 py-3 min-w-[150px]">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
      <Icon size={16} strokeWidth={2.5} />
    </div>
    <div>
      <p className="text-[11px] font-medium text-textsecondary uppercase tracking-wider leading-none">{label}</p>
      <p className="text-xl font-bold text-textprimary mt-0.5 leading-none">{value}</p>
    </div>
  </div>
)

// ──────────────────────────────────────────────────
// Status filter pill
// ──────────────────────────────────────────────────
const StatusPill = ({ label, count, active, onClick, color }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
      active
        ? `${color} shadow-sm`
        : 'bg-transparent border-glass text-textsecondary hover:text-textprimary hover:border-white/10'
    }`}
  >
    {label} <span className="ml-1 opacity-70">({count})</span>
  </button>
)

// ──────────────────────────────────────────────────
// Skeleton loader for loading state
// ──────────────────────────────────────────────────
const HypothesisSkeleton = () => (
  <div className="glass-panel border border-glass rounded-xl p-5 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-5 h-5 rounded bg-white/5" />
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-white/5 rounded-lg w-2/3" />
        <div className="h-3 bg-white/5 rounded w-1/4" />
      </div>
      <div className="h-6 w-16 bg-white/5 rounded-lg" />
    </div>
  </div>
)

// ──────────────────────────────────────────────────
// RowCard — ultra-compact 1-line row for 1000+ items
// ──────────────────────────────────────────────────
const RowCard = ({ hypo, isSelected, toggleSelection, handleApprove, updateStatus, handleDelete, handleToggleDaily, handleOpenEdit, handleTestSplunk, testingSplunkId }) => {
  const statusConfig = {
    draft:    { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Draft' },
    approved: { text: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/20',  label: 'Ready' },
    running:  { text: 'text-violet-400',bg: 'bg-violet-500/10',border: 'border-violet-500/20',label: 'Hunting' },
    complete: { text: 'text-emerald-400',bg:'bg-emerald-500/10',border:'border-emerald-500/20',label: 'Done' },
    error:    { text: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20',   label: 'Query Error' },
  }
  const sc = hypo.rejected_reason
    ? { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Rejected' }
    : (statusConfig[hypo.status] || statusConfig.draft)

  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all group ${
      isSelected ? 'bg-accent-primary/5 border-accent-primary/30' : 'border-glass hover:border-white/10 hover:bg-white/[0.02]'
    }`}>
      {/* Checkbox */}
      <button onClick={() => toggleSelection(hypo.id)} className="shrink-0">
        <div className={`w-[15px] h-[15px] rounded border flex items-center justify-center transition-all ${
          isSelected ? 'bg-accent-primary border-accent-primary' : 'border-white/20 bg-black/20'
        }`}>
          {isSelected && <Check size={10} className="text-white" />}
        </div>
      </button>

      {/* Daily Star */}
      <button
        onClick={() => handleToggleDaily(hypo.id, hypo.is_daily)}
        className={`shrink-0 text-sm leading-none transition-all ${
          hypo.is_daily ? 'text-amber-400' : 'text-white/10 hover:text-amber-400/50'
        }`}
      >★</button>

      {/* MITRE ID */}
      {hypo.mitre_id ? (
        <span className="shrink-0 font-mono text-[10px] text-amber-400/80 bg-black/40 px-1.5 py-0.5 rounded border border-amber-500/10 w-[80px] text-center truncate">
          {hypo.mitre_id}
        </span>
      ) : (
        <span className="shrink-0 w-[80px]" />
      )}

      {/* Title */}
      <span className="flex-1 text-[13px] font-medium text-textprimary truncate min-w-0">{hypo.title}</span>

      {/* Tactic */}
      {hypo.mitre_tactic && (
        <span className="hidden md:block shrink-0 text-[10px] text-textsecondary w-[120px] truncate">{hypo.mitre_tactic}</span>
      )}

      {/* Time ago */}
      <span className="shrink-0 text-[10px] text-textsecondary/60 w-[28px] text-right">{timeAgo(hypo.created_at)}</span>

      {/* Status badge */}
      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${sc.bg} ${sc.text} ${sc.border} w-[60px] text-center`}>
        {sc.label}
      </span>

      {/* Actions — visible on hover */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {hypo.status === 'draft' && !hypo.rejected_reason && (
          <button onClick={() => handleApprove(hypo.id)}
            className="text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 transition-all">
            Approve
          </button>
        )}
        {(hypo.splunk_query || hypo.sentinel_kql) && (
          <button
            onClick={() => handleTestSplunk(hypo.id)}
            disabled={testingSplunkId === hypo.id}
            className="text-[10px] font-semibold text-orange-400 hover:bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20 transition-all disabled:animate-pulse">
            {testingSplunkId === hypo.id ? '...' : 'Hunt'}
          </button>
        )}
        <button onClick={() => handleOpenEdit(hypo)}
          className="text-[10px] text-textsecondary hover:text-accent-primary hover:bg-accent-primary/5 px-2 py-1 rounded-lg border border-glass transition-all">
          Edit
        </button>
        <button onClick={() => handleDelete(hypo.id)}
          className="text-[10px] text-textsecondary hover:text-red-400 hover:bg-red-500/5 px-2 py-1 rounded-lg border border-glass transition-all">
          Del
        </button>
      </div>
    </div>
  )
}

const PAGE_SIZE = 25

// ──────────────────────────────────────────────────
// HypothesisCard Component
// ──────────────────────────────────────────────────
const HypothesisCard = ({
  hypo, activeTab, isExpanded, toggleExpand, index, handleApprove,
  setRejectingHypo, updateStatus, isSelected, toggleSelection,
  handleTestSplunk, testingSplunkId, splunkResults, handleDelete, handleToggleDaily, handleOpenEdit
}) => {
  const { selectedClient } = useClient() || {}
  const [siemTab, setSiemTab] = useState('splunk')
  const [copied, setCopied] = useState(false)
  const [showDescription, setShowDescription] = useState(true)

  const hasSplunk = selectedClient?.splunk_url
  const hasSentinel = selectedClient?.sentinel_workspace_id

  const tabs = [
    { key: 'splunk', label: 'Splunk SPL' },
    { key: 'qradar', label: 'QRadar AQL' },
    { key: 'sentinel', label: 'Sentinel KQL' },
  ]

  const filteredTabs = tabs.filter(tab => {
    if (hasSplunk && !hasSentinel) {
      return tab.key === 'splunk'
    }
    if (hasSentinel && !hasSplunk) {
      return tab.key === 'sentinel'
    }
    return true
  })

  const activeSiemTab = filteredTabs.some(t => t.key === siemTab)
    ? siemTab
    : (filteredTabs[0]?.key || 'splunk')

  const handleCopy = (text) => {
    copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusConfig = {
    draft:    { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', stripe: 'bg-amber-500', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.08)]', icon: Clock4, label: 'Draft' },
    approved: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', stripe: 'bg-blue-500', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.08)]', icon: Target, label: 'Ready to Hunt' },
    running:  { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', stripe: 'bg-violet-500', glow: 'shadow-[0_0_12px_rgba(139,92,246,0.08)]', icon: Activity, label: 'Hunting' },
    complete: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', stripe: 'bg-emerald-500', glow: '', icon: CheckCircle2, label: 'Hunted' },
    error:    { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', stripe: 'bg-red-500', glow: '', icon: AlertTriangle, label: 'Query Error' },
  }

  const isRejected = !!hypo.rejected_reason
  const sc = isRejected
    ? { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', stripe: 'bg-red-500', glow: '', icon: AlertTriangle, label: 'Rejected' }
    : (statusConfig[hypo.status] || statusConfig.draft)
  const StatusIcon = sc.icon
  const isDone = hypo.status === 'complete' && !isRejected

  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className={`relative group glass-panel border rounded-xl transition-all duration-300 animate-slide-up overflow-hidden ${
      isSelected ? 'border-accent-primary/40 shadow-[0_0_20px_rgba(59,130,246,0.08)]' : 'border-glass hover:border-white/10'
    } ${sc.glow} ${isDone ? 'opacity-60 hover:opacity-100' : ''}`} style={{ animationDelay: `${index * 40}ms` }}>
      {/* Colored Left Status Stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${sc.stripe} rounded-l-xl`} />
      {/* COMPLETED Watermark */}
      {isDone && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-xl">
          <span className="text-emerald-500/10 font-black text-[80px] tracking-[0.3em] uppercase select-none rotate-[-20deg] leading-none">
            DONE
          </span>
        </div>
      )}

      {/* ── Header Row ── */}
      <div className="flex items-center gap-3 p-4 pl-5 cursor-pointer" onClick={() => toggleExpand(hypo.id)}>
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleSelection(hypo.id); }}
          className="shrink-0 text-textsecondary hover:text-textprimary transition-colors"
        >
          <div className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-all ${
            isSelected ? 'bg-accent-primary border-accent-primary scale-110' : 'border-white/15 bg-black/30 hover:border-white/30'
          }`}>
            {isSelected && <Check size={12} className="text-white" />}
          </div>
        </button>

        {/* Expand chevron */}
        <button className="shrink-0 text-textsecondary group-hover:text-accent-primary transition-colors">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Title + Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold text-textprimary group-hover:text-white transition-colors truncate">
              {hypo.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {hypo.mitre_id && (
              <span className="text-[10px] font-mono font-bold tracking-widest bg-black/40 px-1.5 py-0.5 rounded text-amber-400/80 border border-amber-500/10">
                {hypo.mitre_id}
              </span>
            )}
            {hypo.mitre_tactic && (
              <span className="text-[10px] font-medium text-textsecondary">{hypo.mitre_tactic}</span>
            )}
            <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${
              hypo.source === 'ai'
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
            }`}>
              {hypo.source === 'ai' ? '🤖 AI Generated' : '👤 Analyst Created'}
            </span>
          </div>
        </div>

        {/* Right side: daily pin + hunt button + status + time */}
        <div className="flex items-center gap-2 shrink-0">
          {/* ⭐ Daily Pin Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleDaily(hypo.id, hypo.is_daily) }}
            title={hypo.is_daily ? 'Remove from daily schedule' : 'Pin to daily schedule (runs at 12 PM)'}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
              hypo.is_daily
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'text-textsecondary border-glass hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10'
            }`}
          >
            <span className="text-sm">{hypo.is_daily ? '⭐' : '☆'}</span>
          </button>
          {hypo.splunk_query && (
            <button
              onClick={(e) => { e.stopPropagation(); handleTestSplunk(hypo.id); }}
              disabled={testingSplunkId === hypo.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                testingSplunkId === hypo.id
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse cursor-wait'
                  : splunkResults && splunkResults[hypo.id]
                    ? splunkResults[hypo.id].error
                      ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/15'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:shadow-[0_0_12px_rgba(249,115,22,0.1)]'
              }`}
            >
              {testingSplunkId === hypo.id ? (
                <><RefreshCw size={11} className="animate-spin" /> Hunting...</>
              ) : splunkResults && splunkResults[hypo.id] ? (
                splunkResults[hypo.id].error
                  ? <><AlertTriangle size={11} /> Error</>
                  : <><CheckCircle2 size={11} /> {splunkResults[hypo.id].data?.length || 0} Results</>
              ) : (
                <><Crosshair size={11} /> Hunt in Logs</>
              )}
            </button>
          )}
          <span className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider w-[120px] ${sc.bg} ${sc.text} ${sc.border} border`}>
            <StatusIcon size={12} />
            {sc.label}
          </span>
          <span className="text-[11px] text-textsecondary hidden lg:block w-[50px] text-right">
            {timeAgo(hypo.created_at)}
          </span>
        </div>
      </div>


      {/* ── Expanded Content ── */}
      {isExpanded && (
        <div className="border-t border-glass animate-fade-in">

          {/* Toggle description */}
          <div className="px-5 pt-4 flex items-center gap-2">
            <button
              onClick={() => setShowDescription(p => !p)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-textsecondary hover:text-textprimary transition-colors uppercase tracking-wider"
            >
              {showDescription ? <EyeOff size={12} /> : <Eye size={12} />}
              {showDescription ? 'Hide' : 'Show'} Description
            </button>
          </div>

          {/* Description (collapsible) */}
          {showDescription && (
            <div className="px-5 pt-4">
              {(() => {
                let aiData = null;
                if (hypo.description?.startsWith('{')) {
                  try { aiData = JSON.parse(hypo.description); } catch (e) {}
                }

                if (aiData) {
                  return (
                    <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start text-left">
                      {/* Left Column (Intel & Context) */}
                      <div className="2xl:col-span-7 flex flex-col gap-6">
                        {/* Threat Actor & Meta Header */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Detected</span>
                            <p className="text-sm text-gray-200 mt-0.5">{aiData.lastSeen || 'Current'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Confidence</span>
                            <p className="mt-0.5"><ConfidenceBadge confidence={aiData.confidence || 'HIGH'} /></p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Source Feed</span>
                            <p className="text-sm text-gray-200 mt-0.5">{aiData.source || 'Proactive Intel'}</p>
                          </div>
                        </div>

                        {/* Threat Actor Profile (Rich Grid or Text) */}
                        {aiData.isRichFormat && aiData.threatActor ? (
                          <div className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Threat Actor Profile</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                              {[
                                ['Actor',          aiData.threatActor.actor],
                                ['Aliases',        aiData.threatActor.aliases],
                                ['Origin',         aiData.threatActor.origin],
                                ['Active Since',   aiData.threatActor.activeSince],
                                ['Targets',        aiData.threatActor.targets],
                                ['Dwell Time',     aiData.threatActor.dwellTime],
                                ['Sophistication', aiData.threatActor.sophistication],
                                ['CISA Alert',     aiData.threatActor.cisaAlert],
                                ['Confidence',     aiData.threatActor.confidence]
                              ].filter(([, v]) => v && v !== 'N/A' && v !== 'Unknown' && v !== 'None').map(([k, v]) => (
                                <div key={k}>
                                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{k}</span>
                                  <p className="text-sm text-gray-200 font-medium mt-0.5 break-words">{v}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : aiData.actorContext ? (
                          <div className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-orange-400">Threat Actor Profile</p>
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{aiData.actorContext}</p>
                          </div>
                        ) : null}

                        {/* Intel Summary */}
                        <div className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-indigo-400">Intel Summary & Attack Chain</p>
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">{aiData.intelSummary || aiData.description}</p>
                        </div>

                        {/* Log Sources Table */}
                        {aiData.logSources && aiData.logSources.length > 0 && (
                          <LogSourcesTable sources={aiData.logSources} />
                        )}

                        {/* Reference URLs */}
                        {aiData.references && aiData.references.length > 0 && (
                          <div className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Reference URLs</p>
                            <ul className="list-disc pl-4 space-y-1">
                              {aiData.references.map((url, i) => (
                                <li key={i}>
                                  <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline break-all">{url}</a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Right Column (Hunting & Operations) */}
                      <div className="2xl:col-span-5 flex flex-col gap-6">
                        {/* IOCs */}
                        {aiData.iocs && aiData.iocs.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Search className="w-4 h-4 text-orange-400" />
                              <p className="text-sm font-bold text-white">Indicators of Compromise</p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                {aiData.iocs.length} IOCs
                              </span>
                            </div>
                            <div className="flex flex-col gap-2">
                              {aiData.iocs.map((ioc, i) => (
                                <IOCCard key={i} ioc={ioc} clientId={hypo.client_id} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hunting Steps */}
                        {aiData.huntingSteps && aiData.huntingSteps.length > 0 ? (
                          <HuntingSteps steps={aiData.huntingSteps} />
                        ) : aiData.huntingLogic ? (
                          <div className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2 text-emerald-400">
                              <Target size={14} /> Hunting Steps & Logic
                            </p>
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{aiData.huntingLogic}</p>
                          </div>
                        ) : null}

                        {/* False Positives & True Positives */}
                        <div className="flex flex-col gap-4">
                          <div className="bg-[#1a150b] p-4 rounded-xl border border-yellow-900/50">
                            <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <AlertTriangle size={14}/> False Positive Guidance
                            </p>
                            <p className="text-sm text-yellow-200/80 leading-relaxed whitespace-pre-wrap">{aiData.falsePositives || aiData.falsePositiveRisk || 'Review organizational baseline before escalating.'}</p>
                          </div>
                          <div className="bg-[#1a0f0f] p-4 rounded-xl border border-red-900/50">
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                              <Shield size={14}/> True Positive Action
                            </p>
                            <p className="text-sm text-red-300 leading-relaxed whitespace-pre-wrap font-semibold">{aiData.truePositiveAction || 'Isolate host and escalate to Incident Response.'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="text-sm leading-relaxed text-textprimary bg-black/20 p-4 rounded-xl border border-glass overflow-hidden markdown-body max-h-[400px] overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {hypo.description || '*No description provided.*'}
                    </ReactMarkdown>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── SIEM Queries ── */}
          <div className="px-5 pt-4">
            <div className="bg-black/40 border border-glass rounded-xl overflow-hidden">
              {/* Tabs bar */}
              <div className="bg-white/[0.03] border-b border-glass flex items-center justify-between px-1">
                <div className="flex">
                  {filteredTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setSiemTab(tab.key)}
                      className={`px-4 py-2.5 text-[11px] font-semibold tracking-wider transition-all border-b-2 ${
                        activeSiemTab === tab.key
                          ? 'text-emerald-400 border-emerald-400 bg-white/[0.03]'
                          : 'text-textsecondary border-transparent hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 pr-1">
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(activeSiemTab === 'sentinel' ? (hypo.sentinel_kql || '') : (hypo.splunk_query || ''))}
                    className="px-2 py-1 text-textsecondary hover:text-emerald-400 transition-colors rounded"
                    title="Copy query"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>

                  {/* Test in Splunk */}
                  {activeSiemTab === 'splunk' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTestSplunk(hypo.id); }}
                      disabled={testingSplunkId === hypo.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold hover:bg-indigo-500/25 disabled:opacity-50 transition-all"
                    >
                      {testingSplunkId === hypo.id ? (
                        <><RefreshCw size={10} className="animate-spin" /> Running...</>
                      ) : (
                        <><Terminal size={10} /> Test in Splunk</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Query code block */}
              <div className="p-4 overflow-x-auto">
                {activeSiemTab === 'splunk' && (
                  <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                    {hypo.splunk_query || '// No Splunk SPL query — click Edit to add one.'}
                  </pre>
                )}
                {activeSiemTab === 'qradar' && (
                  <pre className="text-xs font-mono text-textsecondary whitespace-pre-wrap">
                    {'// QRadar AQL generation coming soon...'}
                  </pre>
                )}
                {activeSiemTab === 'sentinel' && (
                  <pre className="text-xs font-mono text-blue-300 whitespace-pre-wrap leading-relaxed">
                    {hypo.sentinel_kql || '// No Sentinel KQL query yet.\n// Configure Sentinel in Settings and click "Generate with Gemini" to create one.'}
                  </pre>
                )}
              </div>

              {/* Splunk results */}
              {splunkResults && splunkResults[hypo.id] && (
                <div className="border-t border-glass bg-black/60 p-4 max-h-72 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={12} className="text-indigo-400" />
                    <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Execution Results</h4>
                    {splunkResults[hypo.id].data && (
                      <span className="text-[10px] text-textsecondary">({splunkResults[hypo.id].data.length} results)</span>
                    )}
                  </div>
                  {splunkResults[hypo.id].error ? (
                    <div className="text-xs text-red-400 bg-red-500/5 p-3 rounded-lg border border-red-500/10 whitespace-pre-wrap">
                      {splunkResults[hypo.id].error}
                    </div>
                  ) : splunkResults[hypo.id].data && splunkResults[hypo.id].data.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-glass bg-black/40 mt-2 custom-scrollbar">
                      <table className="w-full text-xs text-left border-collapse table-auto">
                        <thead className="bg-white/[0.02] border-b border-glass text-[10px] font-bold text-textsecondary uppercase tracking-wider">
                          <tr>
                            <th className="py-2 px-3 text-textsecondary font-semibold border-b border-glass w-12 text-center">#</th>
                            {Object.keys(splunkResults[hypo.id].data[0] || {})
                              .filter(k => !k.startsWith('_') || k === '_time')
                              .slice(0, 10)
                              .map(k => (
                                <th key={k} className="py-2 px-3 text-textsecondary font-semibold border-b border-glass whitespace-nowrap">{k}</th>
                              ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-glass">
                          {splunkResults[hypo.id].data.slice(0, 50).map((ev, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2 px-3 text-textsecondary font-mono text-center">{i + 1}</td>
                              {Object.entries(ev)
                                .filter(([k]) => !k.startsWith('_') || k === '_time')
                                .slice(0, 10)
                                .map(([k, v]) => (
                                  <td key={k} title={String(v)}
                                    className="py-2 px-3 text-gray-300 font-mono whitespace-nowrap max-w-[250px] truncate">
                                    {v === null || v === undefined ? (
                                      <span className="text-textsecondary/30 italic">null</span>
                                    ) : typeof v === 'object' ? (
                                      JSON.stringify(v)
                                    ) : (
                                      String(v)
                                    )}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {splunkResults[hypo.id].data.length > 50 && (
                        <div className="text-center text-[10px] text-textsecondary/60 py-2 border-t border-glass bg-white/[0.01]">
                          Showing top 50 of {splunkResults[hypo.id].data.length} results.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-textsecondary bg-white/[0.01] p-4 rounded-xl border border-glass text-center italic">
                      Query executed successfully but returned 0 results.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rejected reason */}
          {hypo.rejected_reason && (
            <div className="px-5 pt-3">
              <div className="text-sm text-red-400 bg-red-500/5 p-4 rounded-xl border border-red-500/15 flex items-start justify-between gap-3">
                <div>
                  <strong className="font-semibold text-red-500 uppercase tracking-wider text-[11px] mr-2">❌ Rejected:</strong>
                  {hypo.rejected_reason}
                </div>
                <button
                  onClick={() => setRejectingHypo({ ...hypo, _unreject: true })}
                  className="shrink-0 text-[10px] font-semibold text-textsecondary hover:text-amber-400 hover:bg-amber-500/10 border border-glass hover:border-amber-500/20 px-2 py-1 rounded-lg transition-all"
                >
                  Reconsider
                </button>
              </div>
            </div>
          )}

          {/* ── Action Bar ── */}
          <div className="flex items-center justify-between gap-3 p-4 mt-1 border-t border-glass">
            {/* Left: Delete + Edit */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDelete(hypo.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all border border-transparent hover:border-red-500/10"
              >
                <Trash2 size={13} /> Delete
              </button>
              <button
                onClick={() => handleOpenEdit(hypo)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-textsecondary hover:text-accent-primary hover:bg-accent-primary/5 transition-all border border-transparent hover:border-accent-primary/15"
              >
                <Edit2 size={13} /> Edit
              </button>
            </div>

            {/* Right: Status actions */}
            <div className="flex items-center gap-2">
              {hypo.status === 'draft' && !hypo.rejected_reason && (
                <>
                  <button onClick={() => setRejectingHypo(hypo)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/15">
                    <XIcon size={14} /> Reject
                  </button>
                  <button onClick={() => handleApprove(hypo.id)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/15">
                    <Check size={14} /> Approve
                  </button>
                </>
              )}

              {hypo.status === 'approved' && (
                <button onClick={() => updateStatus(hypo.id, 'running')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-all border border-violet-500/15 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                  <Crosshair size={14} /> Start Hunt
                </button>
              )}

              {hypo.status === 'running' && (
                <button onClick={() => updateStatus(hypo.id, 'complete')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <CheckCircle2 size={14} /> Close Hunt
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════
// Main Hypotheses Page
// ══════════════════════════════════════════════════
export default function Hypotheses() {
  const { selectedClient } = useClient()
  const { user } = useAuth()
  const { toasts, show: showToast, remove: removeToast } = useToast()
  const [hypotheses, setHypotheses] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('today')
  const [expandedIds, setExpandedIds] = useState({})
  const [selectedIds, setSelectedIds] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [tacticFilter, setTacticFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(0)
  const [viewMode, setViewMode] = useState('rows') // 'cards' | 'rows'

  // Time range for hunt execution
  const [timeRange, setTimeRange] = useState('-30d')
  const TIME_RANGES = [
    { label: '7d',  value: '-7d' },
    { label: '14d', value: '-14d' },
    { label: '30d', value: '-30d' },
    { label: '90d', value: '-90d' },
  ]

  // Edit modal state
  const [editingHypo, setEditingHypo] = useState(null)

  // Day-wise navigation
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d
  })
  const [sliderEndDate, setSliderEndDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d
  })
  const isToday = selectedDate.toDateString() === new Date().toDateString()
  const fmtDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const navigateDay = (delta) => {
    setSelectedDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + delta); return d })
  }

  // Generate 10 continuous calendar days ending on sliderEndDate, sorted chronologically (oldest first)
  const displaySliderDates = useMemo(() => {
    const dates = []
    for (let i = 9; i >= 0; i--) {
      const d = new Date(sliderEndDate)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      dates.push(d)
    }
    return dates
  }, [sliderEndDate])

  // Get completed hunts count on a date
  const getDoneCountForDate = useCallback((date) => {
    const dateStr = date.toDateString()
    return hypotheses.filter(h => {
      if (h.status !== 'complete') return false
      const updDate = h.updated_at ? new Date(h.updated_at) : null
      return updDate && updDate.toDateString() === dateStr
    }).length
  }, [hypotheses])

  const fmtShortDate = (d) => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  // Select All / Deselect All
  const handleSelectAll = () => {
    if (selectedIds.length === displayHypos.length && displayHypos.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(displayHypos.map(h => h.id))
    }
  }


  // Form state
  const [isFormOpen, setIsFormOpen]   = useState(false)
  const [formTab, setFormTab]         = useState('general') // 'general' | 'actor' | 'iocs' | 'siem' | 'triage'
  const [formData, setFormData]       = useState({
    title: '', mitre_id: '', mitre_tactic: '', splunk_query: '', sentinel_kql: '',
    intelSummary: '',
    actorName: '',
    actorSophistication: 'Medium',
    actorActiveSince: '',
    actorTargets: '',
    actorDwellTime: '',
    falsePositives: '',
    truePositiveAction: 'Isolate host and escalate to Incident Response.',
    iocs: [],
    logSources: [],
    huntingSteps: [],
    references: []
  })

  // Dynamic Arrays Helpers
  const addIOC = () => {
    setFormData(prev => ({ ...prev, iocs: [...prev.iocs, { type: 'IP', value: '', description: '' }] }))
  }
  const removeIOC = (index) => {
    setFormData(prev => ({ ...prev, iocs: prev.iocs.filter((_, i) => i !== index) }))
  }
  const updateIOC = (index, field, value) => {
    setFormData(prev => {
      const newIocs = [...prev.iocs]
      newIocs[index] = { ...newIocs[index], [field]: value }
      return { ...prev, iocs: newIocs }
    })
  }

  const addLogSource = () => {
    setFormData(prev => ({ ...prev, logSources: [...prev.logSources, { source: '', indicator: '', query: '' }] }))
  }
  const removeLogSource = (index) => {
    setFormData(prev => ({ ...prev, logSources: prev.logSources.filter((_, i) => i !== index) }))
  }
  const updateLogSource = (index, field, value) => {
    setFormData(prev => {
      const newSources = [...prev.logSources]
      newSources[index] = { ...newSources[index], [field]: value }
      return { ...prev, logSources: newSources }
    })
  }

  const addHuntingStep = () => {
    setFormData(prev => ({ ...prev, huntingSteps: [...prev.huntingSteps, { step: '', description: '' }] }))
  }
  const removeHuntingStep = (index) => {
    setFormData(prev => ({ ...prev, huntingSteps: prev.huntingSteps.filter((_, i) => i !== index) }))
  }
  const updateHuntingStep = (index, field, value) => {
    setFormData(prev => {
      const newSteps = [...prev.huntingSteps]
      newSteps[index] = { ...newSteps[index], [field]: value }
      return { ...prev, huntingSteps: newSteps }
    })
  }

  const addReference = () => {
    setFormData(prev => ({ ...prev, references: [...prev.references, ''] }))
  }
  const removeReference = (index) => {
    setFormData(prev => ({ ...prev, references: prev.references.filter((_, i) => i !== index) }))
  }
  const updateReference = (index, value) => {
    setFormData(prev => {
      const newRefs = [...prev.references]
      newRefs[index] = value
      return { ...prev, references: newRefs }
    })
  }

  const [generatingQuery, setGeneratingQuery] = useState(false)
  const [queryTab, setQueryTab]               = useState('splunk')  // 'splunk' | 'sentinel'
  // Client SIEM config (fetched when form opens)
  const [clientSiemConfig, setClientSiemConfig] = useState({ hasSplunk: true, hasSentinel: false })

  const [generatingAI, setGeneratingAI] = useState(false)

  // Reject modal state
  const [rejectingHypo, setRejectingHypo] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Splunk testing state
  const [testingSplunkId, setTestingSplunkId] = useState(null)
  const [splunkResults, setSplunkResults] = useState({})
  const [huntingSelected, setHuntingSelected] = useState(false)
  const [huntProgress, setHuntProgress] = useState('')

  // Daily hunt state
  const [togglingDailyId, setTogglingDailyId] = useState(null)

  const handleToggleDaily = async (id, currentIsDaily) => {
    setTogglingDailyId(id)
    try {
      const res = await fetch(`${API_BASE_URL}/hypotheses/${id}/daily`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_daily: !currentIsDaily })
      })
      if (!res.ok) throw new Error('Failed to update daily status')
      showToast(!currentIsDaily ? '⭐ Added to daily schedule' : 'Removed from daily schedule', 'success')
      fetchHypotheses()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setTogglingDailyId(null)
    }
  }

  // Excel Import Mapping State
  const fileInputRef = useRef(null)
  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [importRawData, setImportRawData] = useState([])
  const [importHeaders, setImportHeaders] = useState([])
  const [columnMapping, setColumnMapping] = useState({
    title: '', description: '', mitre_id: '', mitre_tactic: '', splunk_query: ''
  })

  // Escape key closes any open modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (isFormOpen)        setIsFormOpen(false)
        if (rejectingHypo)    setRejectingHypo(null)
        if (mappingModalOpen) setMappingModalOpen(false)
        if (editingHypo)      setEditingHypo(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFormOpen, rejectingHypo, mappingModalOpen, editingHypo])
  
  const handleDownloadTemplate = () => {
    const templateData = [{
      "Hypothesis Name": "Hunt for Suspicious PowerShell Execution",
      "MITRE ID": "T1059.001",
      "Sub Technique": "",
      "Tactic": "Execution",
      "Month": "Jan 2024",
      "Description": "Look for execution of powershell.exe with hidden window and encoded command.",
      "Hunting Logic": "Analyze sysmon EventCode 1 for powershell.exe with -w hidden and -enc flags.",
      "Splunk Query": "index=windows sourcetype=XmlWinEventLog EventCode=1 Image=\"*powershell.exe\" CommandLine=\"*-w hidden*\" CommandLine=\"*-enc*\"",
      "Result (TP/FP/Neutral)": "TP"
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "ThreatHunt_Hypotheses_Template.xlsx");
  }

  const handleExportExcel = () => {
    if (displayHypos.length === 0) {
      showToast('No hypotheses available to export.', 'warning')
      return
    }

    const exportData = displayHypos.map(h => {
      let desc = h.description;
      if (desc && desc.startsWith('{')) {
        try {
          const parsed = JSON.parse(desc);
          desc = parsed.description || parsed.intelSummary || desc;
        } catch (e) {}
      }

      return {
        "Hypothesis Name": h.title || '',
        "MITRE ID": h.mitre_id || '',
        "Tactic": h.mitre_tactic || '',
        "Description": desc || '',
        "Splunk Query": h.splunk_query || '',
        "Sentinel KQL": h.sentinel_kql || '',
        "Source": h.source || '',
        "Status": h.status || ''
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hypotheses");
    XLSX.writeFile(wb, `ThreatHunt_Hypotheses_Export_${selectedClient.name.replace(/\s+/g, '_')}.xlsx`);
  }

  const handleImportExcel = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" })

      if (json.length === 0) {
        alert("The file is empty.")
        return
      }

      const headers = Object.keys(json[0])
      setImportHeaders(headers)
      setImportRawData(json)

      // Auto-map based on common names
      const autoMap = {
        title: headers.find(h => h.toLowerCase().includes('name') || h.toLowerCase() === 'title') || '',
        description: headers.find(h => h.toLowerCase().includes('desc')) || '',
        mitre_id: headers.find(h => h.toLowerCase().includes('mitre') && h.toLowerCase().includes('id')) || '',
        mitre_tactic: headers.find(h => h.toLowerCase().includes('tactic')) || '',
        splunk_query: headers.find(h => h.toLowerCase().includes('query') || h.toLowerCase().includes('splunk')) || ''
      }
      setColumnMapping(autoMap)
      setMappingModalOpen(true)

    } catch (err) {
      alert("Error parsing file: " + err.message)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    try {
      const mapped = importRawData.map(row => {
        let desc = row[columnMapping.description] || ''
        
        // Find all unmapped columns to push into extras
        const mappedCols = Object.values(columnMapping).filter(Boolean)
        const extras = []
        
        importHeaders.forEach(header => {
          if (!mappedCols.includes(header) && row[header]) {
            extras.push(`**${header}:**\n${row[header]}`)
          }
        })
        
        if (extras.length > 0) {
          desc += desc ? `\n\n---\n\n${extras.join('\n\n')}` : extras.join('\n\n')
        }

        return {
          client_id: selectedClient?.id || null,
          title: row[columnMapping.title] || 'Imported Hypothesis',
          description: desc,
          mitre_id: row[columnMapping.mitre_id] || '',
          mitre_tactic: row[columnMapping.mitre_tactic] || '',
          splunk_query: row[columnMapping.splunk_query] || '',
          status: 'draft',
          source: 'manual'
        }
      })

      const res = await fetch(`${API_BASE_URL}/hypotheses/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapped)
      })
      
      if (!res.ok) throw new Error('Failed to bulk import')
      
      showToast(`✅ Successfully imported ${mapped.length} hypotheses.`, 'success')
      setMappingModalOpen(false)
      fetchHypotheses()
    } catch (err) {
      showToast('Error during import: ' + err.message, 'error')
    }
  }

  // Hunt selected hypotheses one by one (sequential, not parallel)
  const handleHuntSelected = async () => {
    if (selectedIds.length === 0) return
    setHuntingSelected(true)
    const toHunt = selectedIds.filter(id => {
      const h = hypotheses.find(hyp => hyp.id === id)
      return h && (h.splunk_query || h.sentinel_kql)
    })

    if (toHunt.length === 0) {
      showToast('None of the selected hypotheses have a query to run.', 'warning')
      setHuntingSelected(false)
      return
    }

    const settingsRaw = localStorage.getItem(`settings_${selectedClient.id}`)
    let platform = 'splunk'
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw)
      platform = settings.primary_siem || 'splunk'
    }

    for (let i = 0; i < toHunt.length; i++) {
      const hypoId = toHunt[i]
      setHuntProgress(`${i + 1}/${toHunt.length}`)
      setTestingSplunkId(hypoId)
      try {
        const res = await fetch(`${API_BASE_URL}/hunt/execute/${hypoId}?client_id=${selectedClient.id}&earliest=${timeRange}&latest=now&platform=${platform}`, {
          method: 'POST'
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed')
        // Normalize: backend returns { events, total_events, ... }; card expects { data: [] }
        const events = data.events || data.data || []
        setSplunkResults(prev => ({ ...prev, [hypoId]: { data: events } }))
      } catch (err) {
        setSplunkResults(prev => ({ ...prev, [hypoId]: { error: err.message } }))
      }
      setTestingSplunkId(null)
    }
    setHuntingSelected(false)
    setHuntProgress('')
    showToast(`Hunt complete for ${toHunt.length} hypothesis${toHunt.length > 1 ? 'es' : ''}.`, 'success')
  }

  useEffect(() => {
    if (selectedClient) {
      fetchHypotheses()
    } else {
      setHypotheses([])
    }
  }, [selectedClient])

  const fetchHypotheses = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/hypotheses/${selectedClient.id}`)
      if (!res.ok) throw new Error('Failed to fetch hypotheses')
      const data = await res.json()
      setHypotheses(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAI = async () => {
    try {
      setGeneratingAI(true)
      showToast('🤖 AI is generating hypotheses from threat intel...', 'info', 0)
      
      const settingsRaw = localStorage.getItem(`settings_${selectedClient.id}`)
      let opencti_url = ''
      let opencti_token = ''
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw)
        opencti_url = settings.opencti_url || ''
        opencti_token = settings.opencti_token || ''
      }

      const res = await fetch(`${API_BASE_URL}/hypotheses/${selectedClient.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opencti_url, opencti_token })
      })
      if (!res.ok) throw new Error('Failed to generate AI hypotheses')
      showToast('✅ AI hypotheses generated successfully!', 'success')
      await fetchHypotheses()
    } catch (err) {
      showToast('Error generating AI hypotheses: ' + err.message, 'error')
    } finally {
      setGeneratingAI(false)
    }
  }

  const handleTestSplunk = async (hypoId) => {
    try {
      setTestingSplunkId(hypoId)

      const settingsRaw = localStorage.getItem(`settings_${selectedClient.id}`)
      let platform = 'splunk'
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw)
        platform = settings.primary_siem || 'splunk'
      }

      const res = await fetch(`${API_BASE_URL}/hunt/execute/${hypoId}?client_id=${selectedClient.id}&earliest=${timeRange}&latest=now&platform=${platform}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to execute query')
      // Normalize: backend returns { events, total_events, ... }; card expects { data: [] }
      const events = data.events || data.data || []
      setSplunkResults(prev => ({
        ...prev,
        [hypoId]: { data: events, total_events: data.total_events }
      }))
    } catch (err) {
      setSplunkResults(prev => ({
        ...prev,
        [hypoId]: { error: err.message }
      }))
    } finally {
      setTestingSplunkId(null)
    }
  }

  const blankForm = {
    title: '', mitre_id: '', mitre_tactic: '', splunk_query: '', sentinel_kql: '',
    intelSummary: '',
    actorName: '',
    actorSophistication: 'Medium',
    actorActiveSince: '',
    actorTargets: '',
    actorDwellTime: '',
    falsePositives: '',
    truePositiveAction: 'Isolate host and escalate to Incident Response.',
    iocs: [],
    logSources: [],
    huntingSteps: [],
    references: []
  }

  const buildRichDescription = (fd) => ({
    isRichFormat: true,
    lastSeen: fd.actorActiveSince || 'Current',
    confidence: 'HIGH',
    source: 'Analyst Entry',
    actorContext: fd.actorName
      ? `Actor: ${fd.actorName} | Sophistication: ${fd.actorSophistication} | Active Since: ${fd.actorActiveSince || 'Unknown'} | Targets: ${fd.actorTargets || 'All sectors'} | Dwell Time: ${fd.actorDwellTime || 'Unknown'}`
      : '',
    description: fd.intelSummary,
    huntingLogic: fd.huntingSteps.filter(s => s.step).map(s => `${s.step}: ${s.description}`).join('\n'),
    falsePositiveRisk: fd.falsePositives,
    truePositiveAction: fd.truePositiveAction,
    threatActor: {
      actor: fd.actorName || 'Unknown',
      aliases: 'N/A',
      origin: 'Unknown',
      activeSince: fd.actorActiveSince || 'Current',
      targets: fd.actorTargets || 'All sectors',
      dwellTime: fd.actorDwellTime || 'Unknown',
      sophistication: fd.actorSophistication || 'Medium',
      cisaAlert: 'Manual',
      confidence: 'HIGH'
    },
    intelSummary: fd.intelSummary,
    iocs: fd.iocs.filter(ioc => ioc.value),
    logSources: fd.logSources.filter(src => src.source),
    huntingSteps: fd.huntingSteps.filter(step => step.step),
    triageQuery: fd.splunk_query || fd.sentinel_kql || '',
    falsePositives: fd.falsePositives,
    references: fd.references.filter(ref => ref)
  })

  // Open edit modal: pre-populate form from existing hypothesis
  const handleOpenEdit = (hypo) => {
    let fd = { ...blankForm }
    fd.title         = hypo.title || ''
    fd.mitre_id      = hypo.mitre_id || ''
    fd.mitre_tactic  = hypo.mitre_tactic || ''
    fd.splunk_query  = hypo.splunk_query || ''
    fd.sentinel_kql  = hypo.sentinel_kql || ''
    if (hypo.description?.startsWith('{')) {
      try {
        const d = JSON.parse(hypo.description)
        fd.intelSummary        = d.intelSummary || d.description || ''
        fd.falsePositives      = d.falsePositives || d.falsePositiveRisk || ''
        fd.truePositiveAction  = d.truePositiveAction || blankForm.truePositiveAction
        fd.iocs                = d.iocs || []
        fd.logSources          = d.logSources || []
        fd.huntingSteps        = d.huntingSteps || []
        fd.references          = d.references || []
        if (d.threatActor) {
          fd.actorName          = d.threatActor.actor !== 'Unknown' ? d.threatActor.actor : ''
          fd.actorSophistication = d.threatActor.sophistication || 'Medium'
          fd.actorActiveSince   = d.threatActor.activeSince || ''
          fd.actorTargets       = d.threatActor.targets || ''
          fd.actorDwellTime     = d.threatActor.dwellTime || ''
        }
      } catch (e) {}
    } else {
      fd.intelSummary = hypo.description || ''
    }
    setFormData(fd)
    setFormTab('general')
    setEditingHypo(hypo)
    fetchClientSiemConfig()
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingHypo) return
    try {
      const payload = {
        title:        formData.title,
        mitre_id:     formData.mitre_id,
        mitre_tactic: formData.mitre_tactic,
        splunk_query: formData.splunk_query,
        sentinel_kql: formData.sentinel_kql,
        description:  JSON.stringify(buildRichDescription(formData)),
      }
      const res = await fetch(`${API_BASE_URL}/hypotheses/${editingHypo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to update hypothesis')
      showToast('✅ Hypothesis updated successfully!', 'success')
      setEditingHypo(null)
      setFormData(blankForm)
      fetchHypotheses()
    } catch (err) {
      showToast('Error updating: ' + err.message, 'error')
    }
  }

  const handleAddManual = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        title: formData.title,
        mitre_id: formData.mitre_id,
        mitre_tactic: formData.mitre_tactic,
        splunk_query: formData.splunk_query,
        sentinel_kql: formData.sentinel_kql,
        description: JSON.stringify(buildRichDescription(formData)),
        client_id: selectedClient?.id || null,
        source: 'manual',
        status: 'draft',
        created_by: user?.id
      }
      const res = await fetch(`${API_BASE_URL}/hypotheses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to create hypothesis')
      showToast('✅ Hypothesis created successfully!', 'success')
      setIsFormOpen(false)
      setFormData(blankForm)
      setFormTab('general')
      setGeneratingQuery(false)
      fetchHypotheses()
    } catch (err) {
      showToast('Error creating hypothesis: ' + err.message, 'error')
    }
  }

  // Fetch client SIEM config to determine which query editors to show
  const fetchClientSiemConfig = async () => {
    if (!selectedClient) return
    try {
      const res = await fetch(`${API_BASE_URL}/clients`)
      if (!res.ok) return
      const clients = await res.json()
      const client = clients.find(c => c.id === selectedClient.id)
      if (client) {
        const hasSplunk   = !!client.splunk_url
        const hasSentinel = !!client.sentinel_workspace_id
        setClientSiemConfig({ hasSplunk, hasSentinel })
        // Auto-select tab: if only sentinel, show sentinel; else splunk
        if (hasSentinel && !hasSplunk) setQueryTab('sentinel')
        else setQueryTab('splunk')
      }
    } catch (e) {
      console.warn('Could not fetch client SIEM config', e)
    }
  }

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/hypotheses/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      })
      if (!res.ok) throw new Error('Failed to approve')
      showToast('✅ Hypothesis approved — ready to hunt!', 'success')
      fetchHypotheses()
    } catch (err) {
      showToast('Error approving: ' + err.message, 'error')
    }
  }

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) return
    try {
      let approved = 0
      for (const id of selectedIds) {
        const hypo = hypotheses.find(h => h.id === id)
        if (hypo && hypo.status === 'draft') {
          await fetch(`${API_BASE_URL}/hypotheses/${id}/approve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user?.id })
          })
          approved++
        }
      }
      showToast(`✅ Approved ${approved} hypothesis${approved !== 1 ? 'es' : ''}!`, 'success')
      setSelectedIds([])
      fetchHypotheses()
    } catch (err) {
      showToast('Error approving selected: ' + err.message, 'error')
    }
  }

  const handleReject = async () => {
    try {
      if (rejectingHypo?._unreject) {
        const res = await fetch(`${API_BASE_URL}/hypotheses/${rejectingHypo.id}/reject`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: '' })
        })
        if (!res.ok) throw new Error('Failed to reconsider')
        showToast('Hypothesis reconsidered — moved back to Draft.', 'info')
        setRejectingHypo(null)
        setRejectReason('')
        fetchHypotheses()
        return
      }
      if (!rejectReason.trim()) {
        showToast('Please provide a reason for rejection.', 'warning')
        return
      }
      const res = await fetch(`${API_BASE_URL}/hypotheses/${rejectingHypo.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      })
      if (!res.ok) throw new Error('Failed to reject')
      showToast('Hypothesis rejected.', 'warning')
      setRejectingHypo(null)
      setRejectReason('')
      fetchHypotheses()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this hypothesis?')) return
    try {
      const res = await fetch(`${API_BASE_URL}/hypotheses/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      showToast('Hypothesis deleted.', 'info')
      fetchHypotheses()
    } catch (err) {
      showToast('Error deleting: ' + err.message, 'error')
    }
  }

  const updateStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/hypotheses/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error('Failed to update status')
      const labels = { running: '🏃 Hunt started!', complete: '✅ Hunt closed!' }
      showToast(labels[newStatus] || 'Status updated.', 'success')
      fetchHypotheses()
    } catch (err) {
      showToast('Error updating status: ' + err.message, 'error')
    }
  }

  const [runningHunts, setRunningHunts] = useState(false)
  const handleRunHunts = async () => {
    try {
      setRunningHunts(true)
      const res = await fetch(`${API_BASE_URL}/hunt/trigger-executor/${selectedClient.id}`, {
        method: 'POST'
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to start Hunt Executor')
      }
      showToast('🚀 Hunt Executor started! Check Pipeline Health for live logs.', 'success', 6000)
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setRunningHunts(false)
    }
  }

  // Hunt all approved hypotheses in today's queue sequentially
  const [huntingAll, setHuntingAll] = useState(false)
  const handleHuntAllPending = async () => {
    const toHunt = workflowData.todayQueue.filter(h => h.splunk_query || h.sentinel_kql)
    if (toHunt.length === 0) {
      showToast('No approved hypotheses with queries to run today.', 'warning')
      return
    }
    setHuntingAll(true)
    const settingsRaw = localStorage.getItem(`settings_${selectedClient.id}`)
    let platform = 'splunk'
    if (settingsRaw) { try { platform = JSON.parse(settingsRaw).primary_siem || 'splunk' } catch(e) {} }
    for (let i = 0; i < toHunt.length; i++) {
      const hypoId = toHunt[i].id
      setTestingSplunkId(hypoId)
      try {
        const res = await fetch(`${API_BASE_URL}/hunt/execute/${hypoId}?client_id=${selectedClient.id}&earliest=${timeRange}&latest=now&platform=${platform}`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed')
        const events = data.events || data.data || []
        setSplunkResults(prev => ({ ...prev, [hypoId]: { data: events } }))
        // Auto-advance status to 'complete'
        await fetch(`${API_BASE_URL}/hypotheses/${hypoId}/status`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'complete' })
        })
      } catch (err) {
        setSplunkResults(prev => ({ ...prev, [hypoId]: { error: err.message } }))
      }
      setTestingSplunkId(null)
    }
    setHuntingAll(false)
    showToast(`✅ Hunt All complete — ${toHunt.length} hypotheses processed!`, 'success', 6000)
    fetchHypotheses()
  }

  // ── Computed / Filtered data ──
  const stats = useMemo(() => {
    const total = hypotheses.length
    const draft = hypotheses.filter(h => h.status === 'draft' && !h.rejected_reason).length
    const approved = hypotheses.filter(h => h.status === 'approved').length
    const running = hypotheses.filter(h => h.status === 'running').length
    const complete = hypotheses.filter(h => h.status === 'complete').length
    const rejected = hypotheses.filter(h => !!h.rejected_reason).length
    const ai = hypotheses.filter(h => h.source === 'ai').length
    const manual = hypotheses.filter(h => h.source === 'manual').length
    return { total, draft, approved, running, complete, rejected, ai, manual }
  }, [hypotheses])

  // Day-wise workflow computed
  const workflowData = useMemo(() => {
    const selDateStr = selectedDate.toDateString()
    // Today's queue: approved + daily scheduled + error
    const todayQueue = hypotheses.filter(h =>
      (h.status === 'approved' || h.status === 'error' || h.is_daily) && !h.rejected_reason
    )
    // In progress
    const inProgress = hypotheses.filter(h => h.status === 'running')
    // Done on selected date (using updated_at)
    const doneOnDate = hypotheses.filter(h => {
      if (h.status !== 'complete') return false
      const updDate = h.updated_at ? new Date(h.updated_at) : null
      return updDate && updDate.toDateString() === selDateStr
    })
    // Draft queue
    const draftQueue = hypotheses.filter(h => (h.status === 'draft' || h.status === 'error') && !h.rejected_reason)
    // Progress calculation for today
    const todayTotal = todayQueue.length
    const todayDone = hypotheses.filter(h => h.status === 'complete').length
    const todayPct = todayTotal > 0 ? Math.round((Math.min(todayDone, todayTotal) / todayTotal) * 100) : 0
    return { todayQueue, inProgress, doneOnDate, draftQueue, todayTotal, todayDone, todayPct }
  }, [hypotheses, selectedDate])

  const displayHypos = useMemo(() => {
    let filtered = []

    // Workflow tab filter
    if (activeTab === 'today') {
      filtered = workflowData.todayQueue
    } else if (activeTab === 'running') {
      filtered = workflowData.inProgress
    } else if (activeTab === 'done') {
      filtered = workflowData.doneOnDate
    } else {
      // 'all' tab — apply status sub-filters
      filtered = hypotheses
      if (statusFilter === 'rejected') {
        filtered = filtered.filter(h => !!h.rejected_reason)
      } else if (statusFilter !== 'all') {
        filtered = filtered.filter(h => h.status === statusFilter && !h.rejected_reason)
      }
      // Tactic filter (only on all tab)
      if (tacticFilter !== 'all') {
        filtered = filtered.filter(h => (h.mitre_tactic || '').toLowerCase() === tacticFilter.toLowerCase())
      }
    }

    // Search (applies to all tabs)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(h =>
        (h.title || '').toLowerCase().includes(q) ||
        (h.mitre_id || '').toLowerCase().includes(q) ||
        (h.mitre_tactic || '').toLowerCase().includes(q) ||
        (h.splunk_query || '').toLowerCase().includes(q)
      )
    }

    // Sort: recent first
    filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return filtered
  }, [hypotheses, activeTab, statusFilter, searchQuery, tacticFilter, workflowData])

  // Pagination — only applied to the 'all' tab
  const pagedHypos = useMemo(() => {
    if (activeTab !== 'all') return displayHypos
    return displayHypos.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  }, [displayHypos, currentPage, activeTab])

  const totalPages = activeTab === 'all' ? Math.ceil(displayHypos.length / PAGE_SIZE) : 1

  // MITRE Tactic counts from the filtered-but-untactic'd set (for the chip counts)
  const tacticCounts = useMemo(() => {
    if (activeTab !== 'all') return {}
    let base = hypotheses
    if (statusFilter === 'rejected') base = base.filter(h => !!h.rejected_reason)
    else if (statusFilter !== 'all') base = base.filter(h => h.status === statusFilter && !h.rejected_reason)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      base = base.filter(h =>
        (h.title || '').toLowerCase().includes(q) ||
        (h.mitre_id || '').toLowerCase().includes(q) ||
        (h.mitre_tactic || '').toLowerCase().includes(q)
      )
    }
    const counts = {}
    base.forEach(h => {
      const t = h.mitre_tactic || 'Uncategorized'
      counts[t] = (counts[t] || 0) + 1
    })
    return counts
  }, [hypotheses, activeTab, statusFilter, searchQuery])

  // Reset page when search/filter/tab changes
  useEffect(() => { setCurrentPage(0) }, [searchQuery, statusFilter, tacticFilter, activeTab])

  // ── No client selected ──
  if (!selectedClient) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-textsecondary gap-4">
        <Crosshair size={48} className="text-white/10" />
        <p className="text-lg font-medium">Select a client to begin threat hunting</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} remove={removeToast} />

      {/* ══════════ Page Header ══════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60 flex items-center gap-3">
            <Crosshair size={22} className="text-accent-primary" /> Hunt Hypotheses
          </h2>
          <p className="text-sm text-textsecondary mt-0.5">{selectedClient.name} &middot; {stats.total} hypotheses &middot; <span className="text-blue-400 font-semibold">{workflowData?.todayQueue?.length ?? 0} ready to hunt today</span></p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleApproveSelected}
                className="flex items-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              >
                <Check size={14} /> Approve ({selectedIds.length})
              </button>
              <button
                onClick={handleHuntSelected}
                disabled={huntingSelected}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  huntingSelected
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse cursor-wait'
                    : 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border-orange-500/20'
                }`}
              >
                {huntingSelected ? (
                  <><RefreshCw size={14} className="animate-spin" /> Hunting {huntProgress}...</>
                ) : (
                  <><Crosshair size={14} /> Hunt ({selectedIds.length})</>
                )}
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-textsecondary hover:text-white border border-glass hover:border-white/10 transition-all"
                title="Clear selection"
              >
                <XIcon size={13} /> Clear
              </button>
            </>
          )}
          <button
            onClick={handleGenerateAI}
            disabled={generatingAI}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              generatingAI
                ? 'bg-violet-500/30 cursor-not-allowed animate-pulse text-white/60'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg hover:shadow-violet-500/20'
            }`}
          >
            {generatingAI ? (
              <><RefreshCw size={14} className="animate-spin" /> AI Generating...</>
            ) : (
              <><Sparkles size={14} /> Generate AI Hypotheses</>
            )}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/10 text-textprimary px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-glass"
              title="Download Excel Template"
            >
              <Download size={14} /> Template
            </button>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImportExcel} 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/10 text-textprimary px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-glass"
            >
              <Upload size={14} /> Import Data
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/10 text-textprimary px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-glass"
            >
              <Download size={14} /> Export Data
            </button>
            <button
              onClick={() => { setIsFormOpen(true); fetchClientSiemConfig() }}
              className="flex items-center gap-1.5 bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-accent-primary/30"
            >
              <Plus size={14} /> Add Manual
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ Top Dashboard Cards ══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-panel border border-glass rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileSearch size={80} />
          </div>
          <p className="text-xs font-semibold text-textsecondary uppercase tracking-wider mb-1">Total</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{stats.total}</span>
            <span className="text-xs text-textsecondary mb-1">hunts</span>
          </div>
        </div>

        <div className="glass-panel border-t border-glass border-b-0 border-x-0 bg-gradient-to-b from-blue-500/10 to-transparent rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group shadow-[inset_0_1px_0_rgba(59,130,246,0.3)]">
          <div className="absolute -right-4 -top-4 opacity-10 text-blue-500 group-hover:opacity-20 transition-opacity">
            <Target size={80} />
          </div>
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">Ready Today</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{workflowData.todayTotal}</span>
            <span className="text-xs text-blue-400/70 mb-1">queued</span>
          </div>
        </div>

        <div className="glass-panel border-t border-glass border-b-0 border-x-0 bg-gradient-to-b from-violet-500/10 to-transparent rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group shadow-[inset_0_1px_0_rgba(139,92,246,0.3)]">
          <div className="absolute -right-4 -top-4 opacity-10 text-violet-500 group-hover:opacity-20 transition-opacity">
            <Activity size={80} />
          </div>
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-1">In Progress</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{workflowData.inProgress.length}</span>
            <span className="text-xs text-violet-400/70 mb-1">running</span>
          </div>
        </div>

        <div className="glass-panel border-t border-glass border-b-0 border-x-0 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group shadow-[inset_0_1px_0_rgba(16,185,129,0.3)]">
          <div className="absolute -right-4 -top-4 opacity-10 text-emerald-500 group-hover:opacity-20 transition-opacity">
            <CheckCircle2 size={80} />
          </div>
          <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1">Done Today</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{workflowData.doneOnDate.length}</span>
            <span className="text-xs text-emerald-400/70 mb-1">completed</span>
          </div>
        </div>

        <div className="glass-panel border border-glass rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity text-amber-500">
            <Clock4 size={80} />
          </div>
          <p className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider mb-1">Needs Approval</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{workflowData.draftQueue.length}</span>
            <span className="text-xs text-textsecondary mb-1">drafts</span>
          </div>
        </div>
      </div>

      {/* ══════════ Day Navigation ══════════ */}
      <div className="glass-panel border border-glass rounded-2xl p-4 space-y-4">
        {/* Date nav row */}
        <div className="flex flex-col gap-4">
          {/* Header section with title and select date */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent-primary" />
              <h3 className="text-sm font-bold text-textprimary uppercase tracking-widest">Daily Hunt Queue</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                {isToday ? 'Today' : fmtDate(selectedDate)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {!isToday && (
                <button
                  onClick={() => {
                    const d = new Date()
                    d.setHours(0,0,0,0)
                    setSelectedDate(d)
                    setSliderEndDate(d)
                  }}
                  className="text-xs font-semibold text-accent-primary hover:text-blue-300 px-2.5 py-1.5 rounded-xl bg-accent-primary/10 border border-accent-primary/20 transition-all"
                >
                  Back to Today
                </button>
              )}
              {/* Pick Date Button with hidden native date input */}
              <div className="relative">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-glass rounded-xl hover:bg-white/10 text-xs font-semibold text-textprimary transition-all">
                  <Calendar size={14} className="text-accent-primary" />
                  <span>Select Date</span>
                </button>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    if (e.target.value) {
                      const parts = e.target.value.split('-')
                      const d = new Date(parts[0], parts[1] - 1, parts[2])
                      d.setHours(0,0,0,0)
                      setSelectedDate(d)
                      setSliderEndDate(d)
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
              </div>
            </div>
          </div>

          {/* Horizontal scrolling day cards */}
          <div className="overflow-x-auto custom-scrollbar pb-1">
            <div className="flex gap-2 pb-1 min-w-max">
              {displaySliderDates.map((date) => {
                const isActive = date.toDateString() === selectedDate.toDateString()
                const doneCount = getDoneCountForDate(date)
                return (
                  <button
                    key={date.toDateString()}
                    onClick={() => setSelectedDate(date)}
                    className={`px-4 py-3 rounded-xl border text-left min-w-[130px] transition-all duration-200 ${
                      isActive
                        ? 'bg-accent-primary/15 border-accent-primary text-white shadow-lg shadow-accent-primary/5'
                        : 'bg-black/20 border-glass text-textsecondary hover:border-white/20 hover:text-textprimary hover:bg-white/5'
                    }`}
                  >
                    <p className="text-xs font-bold leading-tight">{fmtShortDate(date)}</p>
                    <p className="text-[10px] mt-1 text-textsecondary">
                      {doneCount > 0 ? (
                        <span className="text-emerald-400 font-semibold">{doneCount} done</span>
                      ) : (
                        <span>0 done</span>
                      )}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Progress bar — only on Today */}
        {isToday && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-textsecondary font-medium">Today's Hunt Progress</span>
              <span className="font-bold text-textprimary">
                {Math.min(workflowData.todayDone, workflowData.todayTotal)} / {workflowData.todayTotal} hunts complete
                <span className="ml-2 text-accent-primary">{workflowData.todayPct}%</span>
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-glass">
              <div
                className="h-full bg-gradient-to-r from-accent-primary to-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${workflowData.todayPct}%` }}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <div className="flex items-center gap-1.5 text-xs text-textsecondary">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span> {workflowData.todayTotal} Ready
              </div>
              <div className="flex items-center gap-1.5 text-xs text-textsecondary">
                <span className="w-2 h-2 rounded-full bg-violet-400 inline-block"></span> {workflowData.inProgress.length} In Progress
              </div>
              <div className="flex items-center gap-1.5 text-xs text-textsecondary">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> {stats.complete} Done
              </div>
              <div className="flex items-center gap-1.5 text-xs text-textsecondary">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> {workflowData.draftQueue.length} Awaiting Approval
              </div>
            </div>
          </div>
        )}

        {/* Workflow tabs */}
        <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1 border border-glass">
          {[
            { key: 'today',   label: "🎯 Today's Queue",    count: workflowData.todayQueue.length,   color: 'text-blue-400',   activeBg: 'bg-blue-500/15 border-blue-500/20 text-blue-300' },
            { key: 'running', label: '🔄 In Progress',      count: workflowData.inProgress.length,   color: 'text-violet-400', activeBg: 'bg-violet-500/15 border-violet-500/20 text-violet-300' },
            { key: 'done',    label: '✅ Done',             count: workflowData.doneOnDate.length,   color: 'text-emerald-400', activeBg: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-300' },
            { key: 'all',     label: '📚 All Hypotheses',   count: stats.total,                      color: 'text-white/60',   activeBg: 'bg-white/10 border-white/10 text-white' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                activeTab === tab.key
                  ? tab.activeBg
                  : 'text-textsecondary border-transparent hover:text-textprimary hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-white/10' : 'bg-white/5'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Today tab — action bar */}
        {activeTab === 'today' && isToday && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-glass">
            <button
              onClick={handleHuntAllPending}
              disabled={huntingAll || workflowData.todayQueue.filter(h => h.splunk_query || h.sentinel_kql).length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                huntingAll
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse cursor-wait'
                  : 'bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 text-orange-400 border-orange-500/20 shadow-lg shadow-orange-500/10'
              }`}
            >
              {huntingAll ? <><RefreshCw size={13} className="animate-spin" /> Hunting All...</> : <><Zap size={13} /> Hunt All Pending ({workflowData.todayQueue.filter(h => h.splunk_query || h.sentinel_kql).length})</>}
            </button>
            <button
              onClick={handleApproveSelected}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              <Check size={13} /> Approve All Draft ({workflowData.draftQueue.length})
            </button>
            <div className="ml-auto flex items-center gap-1 bg-white/[0.03] border border-glass rounded-xl p-0.5">
              <Calendar size={11} className="text-textsecondary ml-2" />
              {TIME_RANGES.map(tr => (
                <button key={tr.value} onClick={() => setTimeRange(tr.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    timeRange === tr.value ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' : 'text-textsecondary hover:text-textprimary'
                  }`}>{tr.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* All tab — sub-filters */}
        {activeTab === 'all' && (
          <div className="flex flex-col gap-2 pt-2 border-t border-glass">
            {/* Row 1: Status pills + search + view toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter size={12} className="text-textsecondary" />
                {[
                  { key: 'all', label: 'All', count: stats.total, color: 'bg-white/5 text-white border-white/10' },
                  { key: 'draft', label: 'Draft', count: stats.draft, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  { key: 'approved', label: 'Ready', count: stats.approved, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  { key: 'running', label: 'Hunting', count: stats.running, color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
                  { key: 'complete', label: 'Done', count: stats.complete, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  { key: 'rejected', label: 'Rejected', count: stats.rejected, color: 'bg-red-500/10 text-red-400 border-red-500/20' },
                ].map(f => (
                  <StatusPill key={f.key} label={f.label} count={f.count} active={statusFilter === f.key} onClick={() => setStatusFilter(f.key)} color={f.color} />
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {/* Search bar */}
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-textsecondary" />
                  <input type="text" placeholder="Search title, MITRE, tactic..." value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-56 bg-white/[0.03] border border-glass rounded-xl pl-8 pr-7 py-1.5 text-xs text-textprimary focus:border-accent-primary focus:outline-none transition-all placeholder:text-textsecondary/50" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-textsecondary hover:text-white">
                      <XIcon size={11} />
                    </button>
                  )}
                </div>
                {/* View mode toggle */}
                <div className="flex items-center bg-black/30 border border-glass rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('rows')}
                    title="Row view"
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                      viewMode === 'rows' ? 'bg-accent-primary/20 text-accent-primary' : 'text-textsecondary hover:text-textprimary'
                    }`}>☰ Rows</button>
                  <button
                    onClick={() => setViewMode('cards')}
                    title="Card view"
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                      viewMode === 'cards' ? 'bg-accent-primary/20 text-accent-primary' : 'text-textsecondary hover:text-textprimary'
                    }`}>⊞ Cards</button>
                </div>
              </div>
            </div>

            {/* Row 2: MITRE Tactic chips */}
            {Object.keys(tacticCounts).length > 0 && (
              <div className="overflow-x-auto custom-scrollbar pb-1">
                <div className="flex items-center gap-1.5 pb-1 min-w-max">
                  <button
                    onClick={() => setTacticFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                      tacticFilter === 'all'
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-transparent border-glass text-textsecondary hover:text-textprimary hover:border-white/15'
                    }`}
                  >All Tactics ({displayHypos.length})</button>
                  {Object.entries(tacticCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tactic, count]) => (
                      <button
                        key={tactic}
                        onClick={() => setTacticFilter(tacticFilter === tactic ? 'all' : tactic)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border whitespace-nowrap ${
                          tacticFilter === tactic
                            ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/30'
                            : 'bg-transparent border-glass text-textsecondary hover:text-textprimary hover:border-white/15'
                        }`}
                      >{tactic} <span className="opacity-60">({count})</span></button>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Result count */}
            {!loading && (
              <p className="text-[10px] text-textsecondary/60">
                {searchQuery || tacticFilter !== 'all' || statusFilter !== 'all'
                  ? `Showing ${displayHypos.length} of ${stats.total} hypotheses`
                  : `${stats.total} hypotheses total`
                }
                {totalPages > 1 && ` · Page ${currentPage + 1} of ${totalPages}`}
              </p>
            )}
          </div>
        )}

        {/* Running/Done tabs — search bar */}
        {(activeTab === 'running' || activeTab === 'done') && (
          <div className="flex items-center gap-2 pt-1 border-t border-glass">
            <div className="relative ml-auto">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-textsecondary" />
              <input type="text" placeholder="Filter results..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-52 bg-white/[0.03] border border-glass rounded-xl pl-8 pr-3 py-1.5 text-xs text-textprimary focus:border-accent-primary focus:outline-none transition-all placeholder:text-textsecondary/50" />
            </div>
          </div>
        )}
      </div>

      {/* ══════════ Bulk Select Bar ══════════ */}
      {displayHypos.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-textsecondary hover:text-textprimary transition-colors"
          >
            {selectedIds.length === displayHypos.length && displayHypos.length > 0
              ? <><CheckSquare size={14} className="text-accent-primary" /> Deselect All</>
              : <><Square size={14} /> Select All ({displayHypos.length})</>
            }
          </button>
          {selectedIds.length > 0 && (
            <span className="text-xs text-textsecondary">{selectedIds.length} selected</span>
          )}
        </div>
      )}

      {/* ══════════ Hypothesis List ══════════ */}
      <div className={activeTab === 'all' && viewMode === 'rows' ? 'glass-panel border border-glass rounded-xl overflow-hidden' : 'space-y-3'}>
        {loading ? (
          <div className="space-y-3 p-2">
            <HypothesisSkeleton />
            <HypothesisSkeleton />
            <HypothesisSkeleton />
          </div>
        ) : displayHypos.length === 0 ? (
          <div className="py-16 text-center glass-panel rounded-2xl border border-glass">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-glass">
                <Crosshair size={24} className="text-white/15" />
              </div>
              <p className="text-sm font-medium text-textsecondary">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : tacticFilter !== 'all'
                    ? `No hypotheses for tactic "${tacticFilter}".`
                    : statusFilter !== 'all'
                      ? `No ${statusFilter} hypotheses found.`
                      : 'No hunt hypotheses yet. Generate from threat intel or create your own.'
                }
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <div className="flex gap-2 mt-2">
                  <button onClick={handleGenerateAI} className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
                    ✦ Generate with AI
                  </button>
                  <span className="text-textsecondary">or</span>
                  <button onClick={() => setIsFormOpen(true)} className="text-xs font-semibold text-accent-primary hover:text-blue-300 transition-colors flex items-center gap-1">
                    + Create Hunt
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'all' && viewMode === 'rows' ? (
          // ── ROW MODE: ultra-compact for 1000+ items ──
          <div>
            {/* Column headers */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-glass bg-white/[0.02] text-[10px] font-bold text-textsecondary uppercase tracking-wider">
              <span className="w-[15px] shrink-0" />
              <span className="w-[15px] shrink-0" />
              <span className="w-[80px] shrink-0">MITRE</span>
              <span className="flex-1">Hypothesis</span>
              <span className="hidden md:block w-[120px] shrink-0">Tactic</span>
              <span className="w-[28px] shrink-0 text-right">Age</span>
              <span className="w-[60px] shrink-0 text-center">Status</span>
              <span className="w-[140px] shrink-0" />
            </div>
            <div className="divide-y divide-white/[0.03]">
              {pagedHypos.map(hypo => (
                <RowCard
                  key={hypo.id}
                  hypo={hypo}
                  isSelected={selectedIds.includes(hypo.id)}
                  toggleSelection={toggleSelection}
                  handleApprove={handleApprove}
                  updateStatus={updateStatus}
                  handleDelete={handleDelete}
                  handleToggleDaily={handleToggleDaily}
                  handleOpenEdit={handleOpenEdit}
                  handleTestSplunk={handleTestSplunk}
                  testingSplunkId={testingSplunkId}
                />
              ))}
            </div>
          </div>
        ) : (
          // ── CARD MODE: full detail cards ──
          (() => {
            const grouped = [];
            let currentGroup = null;
            const listToRender = activeTab === 'all' ? pagedHypos : displayHypos;

            listToRender.forEach((hypo, i) => {
              const dateObj = new Date(hypo.created_at);
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);

              let groupName = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              if (dateObj.toDateString() === today.toDateString()) groupName = 'Today';
              else if (dateObj.toDateString() === yesterday.toDateString()) groupName = 'Yesterday';

              if (currentGroup !== groupName) {
                grouped.push({ type: 'header', label: groupName });
                currentGroup = groupName;
              }
              grouped.push({ type: 'item', data: hypo, index: i });
            });

            return grouped.map((item) => {
              if (item.type === 'header') {
                return (
                  <div key={`header-${item.label}`} className="sticky top-[72px] z-10 pt-4 pb-2 bg-[#0a0a0a]/90 backdrop-blur-md">
                    <h4 className="text-[11px] font-bold text-textsecondary uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-[1px] bg-glass"></span>
                      {item.label}
                      <span className="flex-1 h-[1px] bg-glass"></span>
                    </h4>
                  </div>
                );
              }
              const hypo = item.data;
              return (
                <HypothesisCard
                  key={hypo.id}
                  hypo={hypo}
                  index={item.index}
                  activeTab={activeTab}
                  isExpanded={!!expandedIds[hypo.id]}
                  toggleExpand={toggleExpand}
                  isSelected={selectedIds.includes(hypo.id)}
                  toggleSelection={toggleSelection}
                  handleApprove={handleApprove}
                  setRejectingHypo={setRejectingHypo}
                  updateStatus={updateStatus}
                  handleTestSplunk={handleTestSplunk}
                  testingSplunkId={testingSplunkId}
                  splunkResults={splunkResults}
                  handleDelete={handleDelete}
                  handleToggleDaily={handleToggleDaily}
                  handleOpenEdit={handleOpenEdit}
                />
              );
            });
          })()
        )}
      </div>

      {/* ══════════ Pagination Bar ══════════ */}
      {!loading && activeTab === 'all' && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 py-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-glass text-textsecondary hover:text-textprimary hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronDown size={13} className="rotate-90" /> Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // Show pages around current
              let pageNum
              if (totalPages <= 7) {
                pageNum = i
              } else if (currentPage < 4) {
                pageNum = i < 6 ? i : totalPages - 1
              } else if (currentPage > totalPages - 5) {
                pageNum = i === 0 ? 0 : totalPages - 7 + i
              } else {
                const offsets = [0, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, totalPages - 1]
                pageNum = offsets[i]
              }
              const isEllipsis = i > 0 && pageNum - (Array.from({ length: Math.min(totalPages, 7) }, (_, j) => {
                if (totalPages <= 7) return j
                if (currentPage < 4) return j < 6 ? j : totalPages - 1
                if (currentPage > totalPages - 5) return j === 0 ? 0 : totalPages - 7 + j
                return [0, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, totalPages - 1][j]
              })[i - 1]) > 1
              return (
                <>
                  {isEllipsis && <span key={`ellipsis-${i}`} className="text-textsecondary text-xs px-1">…</span>}
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[32px] h-[32px] rounded-lg text-xs font-semibold transition-all border ${
                      currentPage === pageNum
                        ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/30'
                        : 'border-glass text-textsecondary hover:text-textprimary hover:border-white/20'
                    }`}
                  >{pageNum + 1}</button>
                </>
              )
            })}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-glass text-textsecondary hover:text-textprimary hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next <ChevronDown size={13} className="-rotate-90" />
          </button>
        </div>
      )}

      {/* ══════════ Add Manual Form Modal ══════════ */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 sm:pt-20 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-2xl shadow-2xl relative flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
            <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-glass shrink-0 bg-white/[0.02]">
              <div>
                <h3 className="text-xl font-bold text-textprimary">New Hunt Hypothesis</h3>
                <p className="text-xs text-textsecondary mt-0.5">Create a proactive threat hunt for {selectedClient.name}</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-textsecondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors" title="Close (Esc)">
                <XIcon size={18} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-glass bg-white/[0.01] px-6 shrink-0 overflow-x-auto select-none custom-scrollbar">
              {[
                { id: 'general', label: '1. Basic Info' },
                { id: 'actor', label: '2. Threat Actor' },
                { id: 'iocs', label: '3. IOCs & Logs' },
                { id: 'siem', label: '4. Queries' },
                { id: 'triage', label: '5. Triage & Steps' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormTab(t.id)}
                  className={`px-4 py-3 text-[11px] font-semibold tracking-wider transition-all border-b-2 shrink-0 ${
                    formTab === t.id ? 'text-accent-primary border-accent-primary' : 'text-textsecondary border-transparent hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddManual} className="relative z-10 flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">

                {/* --- TAB 1: GENERAL --- */}
                {formTab === 'general' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Title *</label>
                      <input required type="text" value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder="e.g. Hunt for lateral movement via PsExec"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">MITRE ID</label>
                        <input type="text" value={formData.mitre_id}
                          onChange={(e) => setFormData({...formData, mitre_id: e.target.value})}
                          placeholder="T1059.001"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">MITRE Tactic</label>
                        <select
                          value={formData.mitre_tactic}
                          onChange={(e) => setFormData({...formData, mitre_tactic: e.target.value})}
                          className="w-full bg-[#16171d] border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all"
                        >
                          <option value="">-- Select tactic --</option>
                          {MITRE_TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Intel Summary / Description *</label>
                      <textarea required rows={5} value={formData.intelSummary}
                        onChange={(e) => setFormData({...formData, intelSummary: e.target.value})}
                        placeholder="Provide a detailed intelligence summary explaining what this threat does and what we are hunting."
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30 leading-relaxed" />
                    </div>
                  </div>
                )}

                {/* --- TAB 2: THREAT ACTOR --- */}
                {formTab === 'actor' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Threat Actor Name</label>
                      <input type="text" value={formData.actorName}
                        onChange={(e) => setFormData({...formData, actorName: e.target.value})}
                        placeholder="e.g. APT28 or Volt Typhoon"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Sophistication</label>
                        <select value={formData.actorSophistication}
                          onChange={(e) => setFormData({...formData, actorSophistication: e.target.value})}
                          className="w-full bg-[#16171d] border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all">
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Active Since</label>
                        <input type="text" value={formData.actorActiveSince}
                          onChange={(e) => setFormData({...formData, actorActiveSince: e.target.value})}
                          placeholder="e.g. 2018 or Unknown"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Target Sectors</label>
                        <input type="text" value={formData.actorTargets}
                          onChange={(e) => setFormData({...formData, actorTargets: e.target.value})}
                          placeholder="e.g. Finance, Energy"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Dwell Time</label>
                        <input type="text" value={formData.actorDwellTime}
                          onChange={(e) => setFormData({...formData, actorDwellTime: e.target.value})}
                          placeholder="e.g. 90 days"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TAB 3: IOCS & LOGS --- */}
                {formTab === 'iocs' && (
                  <div className="space-y-6 animate-fade-in">
                    {/* IOCs list */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary">Indicators of Compromise (IOCs)</label>
                        <button type="button" onClick={addIOC}
                          className="flex items-center gap-1 text-[11px] font-bold text-accent-primary hover:text-blue-300 transition-colors">
                          <Plus size={12} /> Add Indicator
                        </button>
                      </div>
                      
                      {formData.iocs.length === 0 ? (
                        <p className="text-xs text-textsecondary/50 italic py-4 bg-white/[0.01] border border-dashed border-glass rounded-xl text-center">No indicators added yet.</p>
                      ) : (
                        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                          {formData.iocs.map((ioc, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-white/[0.02] p-2.5 rounded-xl border border-glass">
                              <select value={ioc.type}
                                onChange={(e) => updateIOC(idx, 'type', e.target.value)}
                                className="bg-[#16171d] border border-glass rounded-lg px-2 py-1 text-xs text-textprimary outline-none">
                                <option value="IP">IP</option>
                                <option value="Domain">Domain</option>
                                <option value="Hash">Hash</option>
                                <option value="URL">URL</option>
                              </select>
                              <input type="text" value={ioc.value}
                                onChange={(e) => updateIOC(idx, 'value', e.target.value)}
                                placeholder="Value..."
                                className="flex-1 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none placeholder:text-textsecondary/30" />
                              <input type="text" value={ioc.description}
                                onChange={(e) => updateIOC(idx, 'description', e.target.value)}
                                placeholder="Context/Description..."
                                className="flex-1 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none placeholder:text-textsecondary/30" />
                              <button type="button" onClick={() => removeIOC(idx)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Log sources list */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary">Log Sources & Telemetry</label>
                        <button type="button" onClick={addLogSource}
                          className="flex items-center gap-1 text-[11px] font-bold text-accent-primary hover:text-blue-300 transition-colors">
                          <Plus size={12} /> Add Log Source
                        </button>
                      </div>
                      
                      {formData.logSources.length === 0 ? (
                        <p className="text-xs text-textsecondary/50 italic py-4 bg-white/[0.01] border border-dashed border-glass rounded-xl text-center">No log sources added yet.</p>
                      ) : (
                        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                          {formData.logSources.map((src, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-white/[0.02] p-2.5 rounded-xl border border-glass">
                              <input type="text" value={src.source}
                                onChange={(e) => updateLogSource(idx, 'source', e.target.value)}
                                placeholder="Log Source (e.g. Sysmon)"
                                className="w-1/4 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none placeholder:text-textsecondary/30" />
                              <input type="text" value={src.indicator}
                                onChange={(e) => updateLogSource(idx, 'indicator', e.target.value)}
                                placeholder="Detection Indicator (e.g. ntdsutil execution)"
                                className="w-1/3 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none placeholder:text-textsecondary/30" />
                              <input type="text" value={src.query}
                                onChange={(e) => updateLogSource(idx, 'query', e.target.value)}
                                placeholder="Query / Signature..."
                                className="flex-1 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none placeholder:text-textsecondary/30" />
                              <button type="button" onClick={() => removeLogSource(idx)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* --- TAB 4: SIEM QUERIES --- */}
                {formTab === 'siem' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border border-glass rounded-2xl overflow-hidden bg-black/20">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-glass bg-white/[0.02]">
                        <div className="flex items-center gap-1">
                          {clientSiemConfig.hasSplunk && clientSiemConfig.hasSentinel && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/20 mr-2">
                              <Zap size={9} /> Both SIEMs
                            </span>
                          )}
                          {clientSiemConfig.hasSplunk && !clientSiemConfig.hasSentinel && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20 mr-2">
                              <Database size={9} /> Splunk Only
                            </span>
                          )}
                          {!clientSiemConfig.hasSplunk && clientSiemConfig.hasSentinel && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 mr-2">
                              <Shield size={9} /> Sentinel Only
                            </span>
                          )}

                          <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
                            {(clientSiemConfig.hasSplunk || (!clientSiemConfig.hasSplunk && !clientSiemConfig.hasSentinel)) && (
                              <button type="button" onClick={() => setQueryTab('splunk')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                                  queryTab === 'splunk' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' : 'text-textsecondary hover:text-textprimary'
                                }`}>
                                <Database size={11} /> SPL
                                {formData.splunk_query && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                              </button>
                            )}
                            {clientSiemConfig.hasSentinel && (
                              <button type="button" onClick={() => setQueryTab('sentinel')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                                  queryTab === 'sentinel' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'text-textsecondary hover:text-textprimary'
                                }`}>
                                <Shield size={11} /> KQL
                                {formData.sentinel_kql && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={generatingQuery}
                          onClick={async () => {
                            if (!formData.title) { alert('Please enter a title first.'); return }
                            setGeneratingQuery(true)
                            try {
                              const res = await fetch(`${API_BASE_URL}/hypotheses/generate-query`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  title: formData.title,
                                  description: formData.intelSummary,
                                  hunting_logic: '',
                                  mitre_id: formData.mitre_id,
                                  mitre_tactic: formData.mitre_tactic,
                                  client_id: selectedClient.id
                                })
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.detail || 'Generation failed')
                              setFormData(prev => ({
                                ...prev,
                                splunk_query:  data.splunk_query  ?? prev.splunk_query,
                                sentinel_kql:  data.sentinel_kql  ?? prev.sentinel_kql,
                              }))
                              if (data.siem_type === 'sentinel') setQueryTab('sentinel')
                              else if (data.siem_type === 'both' || data.siem_type === 'splunk') setQueryTab('splunk')
                            } catch (err) {
                              alert('Gemini query generation failed: ' + err.message)
                            } finally {
                              setGeneratingQuery(false)
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                            generatingQuery
                              ? 'bg-violet-500/20 text-violet-300/50 border-violet-500/20 cursor-wait animate-pulse'
                              : 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border-violet-500/20 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                          }`}
                        >
                          {generatingQuery
                            ? <><RefreshCw size={11} className="animate-spin" /> Generating...</>
                            : <><Sparkles size={11} /> Generate with Gemini</>
                          }
                        </button>
                      </div>

                      {queryTab === 'splunk' && (
                        <div className="relative p-3 animate-fade-in">
                          <textarea
                            rows={7}
                            value={formData.splunk_query}
                            onChange={(e) => setFormData({...formData, splunk_query: e.target.value})}
                            placeholder={'index=main sourcetype=_json\n| stats count BY host\n| sort -count'}
                            className="w-full bg-black/30 border border-orange-500/10 rounded-xl px-4 py-3 font-mono text-xs text-emerald-400 focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/20 outline-none transition-all placeholder:text-textsecondary/30 resize-y leading-relaxed"
                          />
                          {formData.splunk_query && (
                            <div className="absolute top-5 right-5 flex gap-1">
                              <button type="button" onClick={() => navigator.clipboard.writeText(formData.splunk_query)}
                                className="p-1 rounded bg-black/40 border border-white/10 text-textsecondary hover:text-white transition-colors" title="Copy">
                                <Copy size={11} />
                              </button>
                              <button type="button" onClick={() => setFormData({...formData, splunk_query: ''})}
                                className="p-1 rounded bg-black/40 border border-white/10 text-textsecondary hover:text-red-400 transition-colors" title="Clear">
                                <XIcon size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {queryTab === 'sentinel' && (
                        <div className="relative p-3 animate-fade-in">
                          <textarea
                            rows={7}
                            value={formData.sentinel_kql}
                            onChange={(e) => setFormData({...formData, sentinel_kql: e.target.value})}
                            placeholder={'SecurityEvent\n| where TimeGenerated > ago(30d)\n| where EventID == 4688\n| summarize count() by Computer, CommandLine\n| sort by count_ desc'}
                            className="w-full bg-black/30 border border-blue-500/10 rounded-xl px-4 py-3 font-mono text-xs text-blue-300 focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all placeholder:text-textsecondary/30 resize-y leading-relaxed"
                          />
                          {formData.sentinel_kql && (
                            <div className="absolute top-5 right-5 flex gap-1">
                              <button type="button" onClick={() => navigator.clipboard.writeText(formData.sentinel_kql)}
                                className="p-1 rounded bg-black/40 border border-white/10 text-textsecondary hover:text-white transition-colors" title="Copy">
                                <Copy size={11} />
                              </button>
                              <button type="button" onClick={() => setFormData({...formData, sentinel_kql: ''})}
                                className="p-1 rounded bg-black/40 border border-white/10 text-textsecondary hover:text-red-400 transition-colors" title="Clear">
                                <XIcon size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="px-4 py-2 border-t border-glass bg-white/[0.01] text-[10px] text-textsecondary/40">
                        ✦ Click "Generate with Gemini" to auto-generate queries using this client's schema. Edit freely after.
                      </div>
                    </div>
                  </div>
                )}

                {/* --- TAB 5: TRIAGE & ACTIONS --- */}
                {formTab === 'triage' && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">False Positive Guidance</label>
                      <textarea rows={2} value={formData.falsePositives}
                        onChange={(e) => setFormData({...formData, falsePositives: e.target.value})}
                        placeholder="Benign scenarios that might trigger this (e.g. admin scripts, standard updates)"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">True Positive Action / Escalation</label>
                      <textarea rows={2} value={formData.truePositiveAction}
                        onChange={(e) => setFormData({...formData, truePositiveAction: e.target.value})}
                        placeholder="What actions must be taken if malicious activity is verified?"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary">Hunting Steps / Methodology</label>
                        <button type="button" onClick={addHuntingStep}
                          className="flex items-center gap-1 text-[11px] font-bold text-accent-primary hover:text-blue-300 transition-colors">
                          <Plus size={12} /> Add Step
                        </button>
                      </div>
                      
                      {formData.huntingSteps.length === 0 ? (
                        <p className="text-xs text-textsecondary/50 italic py-4 bg-white/[0.01] border border-dashed border-glass rounded-xl text-center">No hunting steps added yet.</p>
                      ) : (
                        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                          {formData.huntingSteps.map((step, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-white/[0.02] p-2.5 rounded-xl border border-glass">
                              <div className="flex flex-col gap-2 flex-1">
                                <input type="text" value={step.step}
                                  onChange={(e) => updateHuntingStep(idx, 'step', e.target.value)}
                                  placeholder={`Step ${idx + 1} Title`}
                                  className="bg-black/20 border border-glass rounded-lg px-3 py-1.5 text-xs font-semibold text-textprimary outline-none placeholder:text-textsecondary/30" />
                                <textarea rows={1} value={step.description}
                                  onChange={(e) => updateHuntingStep(idx, 'description', e.target.value)}
                                  placeholder="Describe what the analyst should perform in this step..."
                                  className="bg-black/20 border border-glass rounded-lg px-3 py-1.5 text-xs text-textprimary outline-none placeholder:text-textsecondary/30 resize-y" />
                              </div>
                              <button type="button" onClick={() => removeHuntingStep(idx)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors self-center">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary">Reference URLs</label>
                        <button type="button" onClick={addReference}
                          className="flex items-center gap-1 text-[11px] font-bold text-accent-primary hover:text-blue-300 transition-colors">
                          <Plus size={12} /> Add Reference
                        </button>
                      </div>
                      
                      {formData.references.length === 0 ? (
                        <p className="text-xs text-textsecondary/50 italic py-4 bg-white/[0.01] border border-dashed border-glass rounded-xl text-center">No references added yet.</p>
                      ) : (
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                          {formData.references.map((ref, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-white/[0.02] p-1.5 rounded-lg border border-glass">
                              <input type="url" value={ref}
                                onChange={(e) => updateReference(idx, e.target.value)}
                                placeholder="https://..."
                                className="flex-1 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none placeholder:text-textsecondary/30" />
                              <button type="button" onClick={() => removeReference(idx)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-glass shrink-0 bg-white/[0.02]">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2 text-xs font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl text-xs font-semibold transition-all shadow-lg hover:shadow-accent-primary/20 flex items-center gap-1.5">
                  <Crosshair size={13} /> Create Hunt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ Edit Hypothesis Modal ══════════ */}
      {editingHypo && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 sm:pt-20 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel border border-accent-primary/20 rounded-2xl w-full max-w-2xl shadow-2xl relative flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
            <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-glass shrink-0 bg-white/[0.02]">
              <div>
                <h3 className="text-xl font-bold text-textprimary flex items-center gap-2"><Edit2 size={18} className="text-accent-primary" /> Edit Hypothesis</h3>
                <p className="text-xs text-textsecondary mt-0.5 truncate max-w-md">{editingHypo.title}</p>
              </div>
              <button onClick={() => setEditingHypo(null)} className="text-textsecondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors" title="Close (Esc)">
                <XIcon size={18} />
              </button>
            </div>

            {/* Same tab nav */}
            <div className="flex border-b border-glass bg-white/[0.01] px-6 shrink-0 overflow-x-auto select-none custom-scrollbar">
              {[
                { id: 'general', label: '1. Basic Info' },
                { id: 'actor', label: '2. Threat Actor' },
                { id: 'iocs', label: '3. IOCs & Logs' },
                { id: 'siem', label: '4. Queries' },
                { id: 'triage', label: '5. Triage & Steps' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormTab(t.id)}
                  className={`px-4 py-3 text-[11px] font-semibold tracking-wider transition-all border-b-2 shrink-0 ${
                    formTab === t.id ? 'text-accent-primary border-accent-primary' : 'text-textsecondary border-transparent hover:text-white'
                  }`}
                >{t.label}</button>
              ))}
            </div>

            <form onSubmit={handleSaveEdit} className="relative z-10 flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">

                {formTab === 'general' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Title *</label>
                      <input required type="text" value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        placeholder="e.g. Hunt for lateral movement via PsExec"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">MITRE ID</label>
                        <input type="text" value={formData.mitre_id}
                          onChange={(e) => setFormData({...formData, mitre_id: e.target.value})}
                          placeholder="T1059.001"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">MITRE Tactic</label>
                        <select
                          value={formData.mitre_tactic}
                          onChange={(e) => setFormData({...formData, mitre_tactic: e.target.value})}
                          className="w-full bg-[#16171d] border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all"
                        >
                          <option value="">-- Select tactic --</option>
                          {MITRE_TACTICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Intel Summary / Description *</label>
                      <textarea required rows={5} value={formData.intelSummary}
                        onChange={(e) => setFormData({...formData, intelSummary: e.target.value})}
                        placeholder="Provide a detailed intelligence summary..."
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30 leading-relaxed" />
                    </div>
                  </div>
                )}

                {formTab === 'actor' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Threat Actor Name</label>
                      <input type="text" value={formData.actorName}
                        onChange={(e) => setFormData({...formData, actorName: e.target.value})}
                        placeholder="e.g. APT28 or Volt Typhoon"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Sophistication</label>
                        <select value={formData.actorSophistication}
                          onChange={(e) => setFormData({...formData, actorSophistication: e.target.value})}
                          className="w-full bg-[#16171d] border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none">
                          <option>Low</option><option>Medium</option><option>High</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Active Since</label>
                        <input type="text" value={formData.actorActiveSince}
                          onChange={(e) => setFormData({...formData, actorActiveSince: e.target.value})}
                          placeholder="e.g. 2018"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Target Sectors</label>
                        <input type="text" value={formData.actorTargets}
                          onChange={(e) => setFormData({...formData, actorTargets: e.target.value})}
                          placeholder="e.g. Finance, Energy"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">Dwell Time</label>
                        <input type="text" value={formData.actorDwellTime}
                          onChange={(e) => setFormData({...formData, actorDwellTime: e.target.value})}
                          placeholder="e.g. 90 days"
                          className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                      </div>
                    </div>
                  </div>
                )}

                {formTab === 'siem' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border border-glass rounded-2xl overflow-hidden bg-black/20">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-glass bg-white/[0.02]">
                        <div className="flex items-center gap-1">
                          <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
                            {(clientSiemConfig.hasSplunk || (!clientSiemConfig.hasSplunk && !clientSiemConfig.hasSentinel)) && (
                              <button type="button" onClick={() => setQueryTab('splunk')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                                  queryTab === 'splunk' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' : 'text-textsecondary hover:text-textprimary'
                                }`}>
                                <Database size={11} /> SPL
                              </button>
                            )}
                            {clientSiemConfig.hasSentinel && (
                              <button type="button" onClick={() => setQueryTab('sentinel')}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                                  queryTab === 'sentinel' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'text-textsecondary hover:text-textprimary'
                                }`}>
                                <Shield size={11} /> KQL
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={generatingQuery}
                          onClick={async () => {
                            if (!formData.title) { alert('Please enter a title first.'); return }
                            setGeneratingQuery(true)
                            try {
                              const res = await fetch(`${API_BASE_URL}/hypotheses/generate-query`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  title: formData.title,
                                  description: formData.intelSummary,
                                  hunting_logic: '',
                                  mitre_id: formData.mitre_id,
                                  mitre_tactic: formData.mitre_tactic,
                                  client_id: selectedClient.id
                                })
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.detail || 'Generation failed')
                              setFormData(prev => ({
                                ...prev,
                                splunk_query:  data.splunk_query  ?? prev.splunk_query,
                                sentinel_kql:  data.sentinel_kql  ?? prev.sentinel_kql,
                              }))
                              if (data.siem_type === 'sentinel') setQueryTab('sentinel')
                              else if (data.siem_type === 'both' || data.siem_type === 'splunk') setQueryTab('splunk')
                            } catch (err) {
                              alert('Gemini query generation failed: ' + err.message)
                            } finally {
                              setGeneratingQuery(false)
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                            generatingQuery
                              ? 'bg-violet-500/20 text-violet-300/50 border-violet-500/20 cursor-wait animate-pulse'
                              : 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border-violet-500/20 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                          }`}
                        >
                          {generatingQuery
                            ? <><RefreshCw size={11} className="animate-spin" /> Generating...</>
                            : <><Sparkles size={11} /> Generate with Gemini</>
                          }
                        </button>

                      </div>
                      {queryTab === 'splunk' && (
                        <div className="p-3">
                          <textarea rows={7} value={formData.splunk_query}
                            onChange={(e) => setFormData({...formData, splunk_query: e.target.value})}
                            placeholder={'index=main sourcetype=_json\n| stats count BY host\n| sort -count'}
                            className="w-full bg-black/30 border border-orange-500/10 rounded-xl px-4 py-3 font-mono text-xs text-emerald-400 focus:border-orange-500/30 outline-none transition-all placeholder:text-textsecondary/30 resize-y leading-relaxed" />
                        </div>
                      )}
                      {queryTab === 'sentinel' && (
                        <div className="p-3">
                          <textarea rows={7} value={formData.sentinel_kql}
                            onChange={(e) => setFormData({...formData, sentinel_kql: e.target.value})}
                            placeholder={'SecurityEvent\n| where TimeGenerated > ago(30d)'}
                            className="w-full bg-black/30 border border-blue-500/10 rounded-xl px-4 py-3 font-mono text-xs text-blue-300 focus:border-blue-500/30 outline-none transition-all placeholder:text-textsecondary/30 resize-y leading-relaxed" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {formTab === 'triage' && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">False Positive Guidance</label>
                      <textarea rows={2} value={formData.falsePositives}
                        onChange={(e) => setFormData({...formData, falsePositives: e.target.value})}
                        placeholder="Benign scenarios that might trigger this"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">True Positive Action</label>
                      <textarea rows={2} value={formData.truePositiveAction}
                        onChange={(e) => setFormData({...formData, truePositiveAction: e.target.value})}
                        placeholder="What actions must be taken if malicious activity is verified?"
                        className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary outline-none transition-all placeholder:text-textsecondary/30" />
                    </div>
                  </div>
                )}

                {formTab === 'iocs' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-textsecondary">Indicators of Compromise (IOCs)</label>
                        <button type="button" onClick={addIOC} className="flex items-center gap-1 text-[11px] font-bold text-accent-primary hover:text-blue-300">
                          <Plus size={12} /> Add Indicator
                        </button>
                      </div>
                      {formData.iocs.length === 0
                        ? <p className="text-xs text-textsecondary/50 italic py-4 bg-white/[0.01] border border-dashed border-glass rounded-xl text-center">No indicators added yet.</p>
                        : (
                          <div className="space-y-2.5">
                            {formData.iocs.map((ioc, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-white/[0.02] p-2.5 rounded-xl border border-glass">
                                <select value={ioc.type} onChange={(e) => updateIOC(idx, 'type', e.target.value)}
                                  className="bg-[#16171d] border border-glass rounded-lg px-2 py-1 text-xs text-textprimary outline-none">
                                  <option>IP</option><option>Domain</option><option>Hash</option><option>URL</option>
                                </select>
                                <input type="text" value={ioc.value} onChange={(e) => updateIOC(idx, 'value', e.target.value)}
                                  placeholder="Value..." className="flex-1 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none" />
                                <input type="text" value={ioc.description} onChange={(e) => updateIOC(idx, 'description', e.target.value)}
                                  placeholder="Context..." className="flex-1 bg-black/20 border border-glass rounded-lg px-3 py-1 text-xs text-textprimary outline-none" />
                                <button type="button" onClick={() => removeIOC(idx)} className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    </div>
                  </div>
                )}

              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-glass shrink-0 bg-white/[0.02]">
                <button type="button" onClick={() => setEditingHypo(null)} className="px-5 py-2 text-xs font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl text-xs font-semibold transition-all shadow-lg hover:shadow-accent-primary/20 flex items-center gap-1.5">
                  <Check size={13} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ Reject Modal ══════════ */}
      {rejectingHypo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-md shadow-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <XIcon size={120} className={rejectingHypo._unreject ? 'text-amber-500' : 'text-red-500'} />
            </div>
            <h3 className="relative z-10 text-lg font-bold text-textprimary mb-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${rejectingHypo._unreject ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                <AlertTriangle size={18} />
              </div>
              {rejectingHypo._unreject ? 'Reconsider Hypothesis' : 'Reject Hypothesis'}
            </h3>
            <p className="relative z-10 text-sm text-textsecondary mb-5 leading-relaxed">
              Rejecting <strong className="text-white">"{rejectingHypo.title}"</strong>
            </p>
            <textarea
              required
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="relative z-10 w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none mb-5 transition-all placeholder:text-textsecondary/30"
            />
            <div className="relative z-10 flex justify-end gap-3">
              <button onClick={() => setRejectingHypo(null)} className="px-4 py-2 text-xs font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold transition-all shadow-lg hover:shadow-red-500/25 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    {/* ══════════ Mapping Modal ══════════ */}
      {mappingModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden">
            <div className="p-6 border-b border-glass flex justify-between items-center bg-black/20">
              <h3 className="text-lg font-bold text-textprimary flex items-center gap-2">
                <Upload size={18} className="text-accent-primary" /> Map Columns
              </h3>
              <button onClick={() => setMappingModalOpen(false)} className="text-textsecondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                <XIcon size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-textsecondary">
                Match your Excel columns to the platform's fields. Any unmapped columns will be automatically added to the Description field so you don't lose them!
              </p>
              
              {[
                { key: 'title', label: 'Hunt Title / Name *' },
                { key: 'mitre_id', label: 'MITRE ID' },
                { key: 'mitre_tactic', label: 'MITRE Tactic' },
                { key: 'splunk_query', label: 'Splunk Query' },
                { key: 'description', label: 'Description' }
              ].map(field => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-textsecondary">{field.label}</label>
                  <select
                    value={columnMapping[field.key] || ''}
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 outline-none transition-all"
                  >
                    <option value="">-- Do not map (append to description) --</option>
                    {importHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-glass flex justify-end gap-3 bg-black/20">
              <button onClick={() => setMappingModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={confirmImport} className="px-5 py-2 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl text-xs font-semibold transition-all shadow-lg hover:shadow-accent-primary/20 flex items-center gap-1.5">
                <Check size={14} /> Import {importRawData.length} Rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Floating Chat Assistant */}
      <AIChat
        context="hypothesis"
        clientSlug={selectedClient?.slug || selectedClient?.id}
        currentItem={editingHypo || null}
      />
    </div>
  )
}
