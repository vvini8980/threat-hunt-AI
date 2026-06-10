import { useState, useEffect, useMemo } from 'react'
import { FileDown, ShieldAlert, CheckCircle2, ShieldQuestion, Clock4, Search, Filter, AlertTriangle, Crosshair, ChevronUp, ChevronDown, Activity, Target } from 'lucide-react'
import { API_BASE_URL } from '../config/api'
import { useClient } from '../context/ClientContext'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const VERDICTS = ['All', 'TP', 'FP', 'clean']

const VERDICT_CONFIG = {
  TP:    { icon: ShieldAlert,   color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    label: 'True Positive' },
  FP:    { icon: ShieldQuestion, color: 'text-amber-400', bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  label: 'False Positive' },
  clean: { icon: CheckCircle2,  color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',label: 'Clean' },
}
function getVC(v) { return VERDICT_CONFIG[v] || { icon: ShieldQuestion, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', label: v || 'Unknown' } }

export default function HuntResults() {
  const { selectedClient } = useClient()
  const [hypotheses, setHypotheses] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Filters
  const [dateFilter, setDateFilter] = useState('')
  const [verdictFilter, setVerdictFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All') // 'All', 'Hunted', 'Pending'
  
  // Sorting
  const [sortField, setSortField] = useState('status') // default sort by hunted vs pending
  const [sortDir, setSortDir] = useState('asc') // asc means Pending top
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (selectedClient) fetchAllData()
    else { setHypotheses([]); setResults([]) }
  }, [selectedClient])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const [hypoRes, resultsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/hypotheses/${selectedClient.id}`),
        fetch(`${API_BASE_URL}/hunt/results/${selectedClient.id}`)
      ])
      
      let hypoData = []
      let resData = []
      
      if (hypoRes.ok) hypoData = await hypoRes.json()
      if (resultsRes.ok) resData = await resultsRes.json()

      setHypotheses(hypoData || [])
      setResults(resData || [])
    } catch (err) {
      console.error('Error fetching hunt data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Merge Data ──
  const mergedData = useMemo(() => {
    // Only include completed or currently running hypotheses (exclude draft/approved)
    const validHypos = hypotheses.filter(h => h.status === 'complete' || h.status === 'running')

    const merged = validHypos.map(hypo => {
      // Find all results for this hypothesis
      const hypoResults = results.filter(r => 
        r.hypothesis_id === hypo.id || (r.hypotheses && r.hypotheses.id === hypo.id)
      )
      // Get the latest result if any
      const latestResult = hypoResults.sort((a,b) => new Date(b.executed_at) - new Date(a.executed_at))[0]
      
      const isHunted = hypo.status === 'complete' || !!latestResult

      return {
        ...hypo,
        isHunted,
        latestResult,
        sortTitle: hypo.title || '',
        sortDate: latestResult ? new Date(latestResult.executed_at).getTime() : new Date(hypo.created_at).getTime()
      }
    })

    // Also include results that might not have a matching hypothesis anymore (deleted, draft, etc)
    const unmatchedResults = results.filter(r => 
      !validHypos.find(h => h.id === r.hypothesis_id || (r.hypotheses && r.hypotheses.id === h.id))
    )
    unmatchedResults.forEach(r => {
      merged.push({
        id: `unmatched-${r.id}`,
        title: r._hypo_title || r.hypotheses?.title || 'Deleted Hypothesis',
        mitre_id: r._hypo_mitre_id || r.hypotheses?.mitre_id,
        isHunted: true,
        latestResult: r,
        sortTitle: r._hypo_title || r.hypotheses?.title || '',
        sortDate: new Date(r.executed_at).getTime()
      })
    })

    return merged
  }, [hypotheses, results])

  // ── Filter Data ──
  const filtered = useMemo(() => {
    let f = mergedData

    // Status Filter
    if (statusFilter === 'Hunted') f = f.filter(r => r.isHunted)
    if (statusFilter === 'Pending') f = f.filter(r => !r.isHunted)

    // Verdict Filter (Only applies to Hunted ones)
    if (verdictFilter !== 'All') {
      f = f.filter(r => r.latestResult && r.latestResult.verdict === verdictFilter)
    }

    // Search Filter
    if (search) {
      const q = search.toLowerCase()
      f = f.filter(r => (r.title || '').toLowerCase().includes(q))
    }

    // Date Filter (Applies to execution date if hunted, created date if pending)
    if (dateFilter) {
      const start = new Date(dateFilter).getTime()
      const end = start + 86400000 // +1 day
      f = f.filter(r => r.sortDate >= start && r.sortDate < end)
    }

    // Sort
    f = [...f].sort((a, b) => {
      if (sortField === 'status') {
        // Pending (false) first if ASC, Hunted (true) first if DESC
        if (a.isHunted === b.isHunted) return b.sortDate - a.sortDate // tiebreaker: newest first
        if (a.isHunted && !b.isHunted) return sortDir === 'asc' ? 1 : -1
        if (!a.isHunted && b.isHunted) return sortDir === 'asc' ? -1 : 1
      }
      if (sortField === 'title') {
        if (a.sortTitle < b.sortTitle) return sortDir === 'asc' ? -1 : 1
        if (a.sortTitle > b.sortTitle) return sortDir === 'asc' ? 1 : -1
      }
      if (sortField === 'date') {
        return sortDir === 'asc' ? a.sortDate - b.sortDate : b.sortDate - a.sortDate
      }
      return 0
    })

    return f
  }, [mergedData, statusFilter, verdictFilter, search, dateFilter, sortField, sortDir])

  const exportPDF = () => {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(99, 130, 246)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('ThreatHunt AI — Master Hunt Results', 14, 12)
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text(`Client: ${selectedClient.name}  |  Generated: ${new Date().toLocaleString()}  |  Total Tracked: ${filtered.length}`, 14, 22)

    const body = filtered.map(r => [
      r.isHunted ? 'Hunted' : 'Pending',
      r.isHunted && r.latestResult ? new Date(r.latestResult.executed_at).toLocaleDateString() : '-',
      r.title || 'Unknown',
      r.latestResult?.verdict || '-',
      r.latestResult?.evidence ? r.latestResult.evidence.substring(0, 80) : '-',
    ])
    doc.autoTable({
      startY: 36,
      head: [['Status', 'Date', 'Hypothesis', 'Verdict', 'Evidence']],
      body,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 20 }, 2: { cellWidth: 60 }, 3: { cellWidth: 15 }, 4: { cellWidth: 70 } },
    })
    doc.save(`ThreatHunt_Master_${selectedClient.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`)
  }

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'status' ? 'asc' : 'desc') }
  }

  const SortIcon = ({ field }) => sortField === field
    ? (sortDir === 'asc' ? <ChevronUp size={13} className="text-accent-primary" /> : <ChevronDown size={13} className="text-accent-primary" />)
    : <ChevronDown size={13} className="opacity-30" />

  // ── KPIs ──
  const kpis = {
    total: mergedData.length,
    hunted: mergedData.filter(r => r.isHunted).length,
    pending: mergedData.filter(r => !r.isHunted).length,
    tp: mergedData.filter(r => r.latestResult?.verdict === 'TP').length,
    fp: mergedData.filter(r => r.latestResult?.verdict === 'FP').length,
    clean: mergedData.filter(r => r.latestResult?.verdict === 'clean').length,
  }

  if (!selectedClient) return (
    <div className="flex h-full items-center justify-center flex-col gap-4 text-textsecondary">
      <Crosshair size={48} className="opacity-10" />
      <p>Select a client to view hunt results</p>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 flex items-center gap-3">
            <Crosshair size={22} className="text-accent-primary" /> Master Hunt Results Tracker
          </h2>
          <p className="text-sm text-textsecondary mt-0.5">
            {selectedClient.name} · Track pending hypotheses vs completed hunts
          </p>
        </div>
        <button onClick={exportPDF} className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-lg hover:shadow-accent-primary/20 shrink-0">
          <FileDown size={15} /> Export Report
        </button>
      </div>

      {/* ── High-Level KPI Strip ── */}
      {mergedData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 animate-slide-up">
          <div className="glass-panel border border-glass rounded-xl px-4 py-3 flex flex-col justify-center bg-white/[0.02]">
            <p className="text-[11px] text-textsecondary font-bold uppercase tracking-wider">Total Tracked</p>
            <p className="text-2xl font-bold text-white mt-1">{kpis.total}</p>
          </div>
          
          <div className="glass-panel border border-emerald-500/20 rounded-xl px-4 py-3 flex flex-col justify-center bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/20 transition-colors" onClick={() => setStatusFilter('Hunted')}>
            <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle2 size={12}/> Hunts Done</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{kpis.hunted}</p>
          </div>
          
          <div className="glass-panel border border-amber-500/20 rounded-xl px-4 py-3 flex flex-col justify-center bg-amber-500/10 cursor-pointer hover:bg-amber-500/20 transition-colors" onClick={() => setStatusFilter('Pending')}>
            <p className="text-[11px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1"><Activity size={12}/> Running</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{kpis.pending}</p>
          </div>

          <div className="glass-panel border border-red-500/20 rounded-xl px-4 py-3 flex flex-col justify-center bg-red-500/5">
            <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider">True Positive</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{kpis.tp}</p>
          </div>

          <div className="glass-panel border border-orange-500/20 rounded-xl px-4 py-3 flex flex-col justify-center bg-orange-500/5">
            <p className="text-[11px] text-orange-400 font-bold uppercase tracking-wider">False Positive</p>
            <p className="text-2xl font-bold text-orange-400 mt-1">{kpis.fp}</p>
          </div>

          <div className="glass-panel border border-cyan-500/20 rounded-xl px-4 py-3 flex flex-col justify-center bg-cyan-500/5">
            <p className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">Clean / Neg</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{kpis.clean}</p>
          </div>
        </div>
      )}

      {/* ── Filters Row ── */}
      <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textsecondary" />
          <input
            type="text"
            placeholder="Search hypotheses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-glass rounded-xl pl-9 pr-4 py-2 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all"
          />
        </div>
        
        {/* Status Filter Chips */}
        <div className="flex items-center bg-white/[0.03] border border-glass rounded-xl p-0.5">
          {['All', 'Pending', 'Hunted'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); if(s === 'Pending') setVerdictFilter('All'); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s ? 'bg-accent-primary/20 text-accent-primary shadow-sm' : 'text-textsecondary hover:text-textprimary'
              }`}
            >{s}</button>
          ))}
        </div>

        {/* Verdict filter chips (Only relevant if Hunted is selected or All) */}
        {statusFilter !== 'Pending' && (
          <div className="flex items-center gap-1.5 border border-glass rounded-xl px-2 py-1 bg-black/10">
            <Filter size={13} className="text-textsecondary mx-1" />
            {VERDICTS.map(v => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${
                  verdictFilter === v ? 'bg-white/20 text-white border-white/30' : 'border-transparent text-textsecondary hover:bg-white/5'
                }`}
              >{v}</button>
            ))}
          </div>
        )}

        {/* Date filter */}
        <div className="relative">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-black/20 border border-glass rounded-xl px-3 py-2 text-sm text-textprimary focus:border-accent-primary outline-none transition-all"
          />
        </div>

        {(dateFilter || verdictFilter !== 'All' || search || statusFilter !== 'All') && (
          <button onClick={() => { setDateFilter(''); setVerdictFilter('All'); setSearch(''); setStatusFilter('All'); }}
            className="text-xs text-textsecondary hover:text-red-400 transition-colors px-2">✕ Clear</button>
        )}
      </div>

      {/* ── Results Table ── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-textsecondary glass-panel rounded-2xl border border-glass">
          <Crosshair size={40} className="mx-auto mb-3 opacity-15" />
          <p className="font-medium">No results match your filters</p>
        </div>
      ) : (
        <div className="glass-panel border border-glass rounded-2xl overflow-hidden shadow-xl animate-slide-up">
          {/* Table Header */}
          <div className="grid grid-cols-[100px_1fr_130px_120px] gap-4 px-5 py-3 bg-white/3 border-b border-glass text-[11px] font-bold uppercase tracking-widest text-textsecondary">
            <button className="flex items-center gap-1 hover:text-textprimary transition-colors" onClick={() => toggleSort('status')}>
              Status <SortIcon field="status" />
            </button>
            <button className="flex items-center gap-1 text-left hover:text-textprimary transition-colors" onClick={() => toggleSort('title')}>
              Hypothesis / Hunt <SortIcon field="title" />
            </button>
            <button className="flex items-center gap-1 hover:text-textprimary transition-colors" onClick={() => toggleSort('date')}>
              Date <SortIcon field="date" />
            </button>
            <span>Result Verdict</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/5">
            {filtered.map((row, i) => {
              const isExpanded = expandedId === row.id
              const hasResult = row.latestResult != null

              return (
                <div key={row.id} className={`transition-colors ${row.isHunted ? 'bg-transparent' : 'bg-amber-500/[0.02]'}`}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    className="w-full grid grid-cols-[100px_1fr_130px_120px] gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors group"
                  >
                    {/* Status Column */}
                    <div className="flex items-center">
                      {row.isHunted ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                          <CheckCircle2 size={11} /> HUNTED
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
                          <Activity size={11} className="animate-pulse" /> RUNNING
                        </span>
                      )}
                    </div>

                    {/* Title Column */}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate transition-colors ${row.isHunted ? 'text-textprimary group-hover:text-white' : 'text-amber-100 group-hover:text-amber-200'}`}>
                        {row.title}
                      </p>
                      {row.mitre_id && (
                        <span className="text-[10px] font-mono text-textsecondary opacity-70">{row.mitre_id}</span>
                      )}
                    </div>

                    {/* Date Column */}
                    <div className="flex items-center text-xs text-textsecondary gap-1">
                      <Clock4 size={11} /> 
                      {row.sortDate ? new Date(row.sortDate).toLocaleDateString() : '-'}
                    </div>

                    {/* Verdict Column */}
                    <div className="flex items-center">
                      {hasResult ? (
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${getVC(row.latestResult.verdict).bg} ${getVC(row.latestResult.verdict).color} ${getVC(row.latestResult.verdict).border}`}>
                          {row.latestResult.verdict || '?'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-textsecondary italic">Awaiting Run</span>
                      )}
                    </div>
                  </button>

                  {/* Expanded Row Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/20 border-t border-white/5 shadow-inner">
                      {hasResult ? (
                        <>
                          <div>
                            <h4 className="text-[10px] font-bold text-textsecondary uppercase tracking-wider mb-2">Evidence / Logs</h4>
                            <p className="text-xs text-textprimary bg-black/40 p-3 rounded-lg border border-glass whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar">
                              {row.latestResult.evidence || 'No evidence captured.'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold text-textsecondary uppercase tracking-wider mb-2">Analyst Notes</h4>
                            <p className="text-xs text-textprimary bg-black/40 p-3 rounded-lg border border-glass whitespace-pre-wrap leading-relaxed min-h-[50px]">
                              {row.latestResult.analyst_notes || 'No notes added.'}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 py-4 flex flex-col items-center justify-center text-amber-500/60 border border-amber-500/10 bg-amber-500/5 rounded-xl border-dashed">
                          <Activity size={24} className="mb-2 opacity-50 animate-pulse" />
                          <p className="text-sm font-medium">This hunt is currently running.</p>
                          <p className="text-xs opacity-70">Check back later for the final verdict and evidence.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
