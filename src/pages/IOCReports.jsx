import { useState, useEffect, Fragment } from 'react'
import { FileDown, FileSpreadsheet, RefreshCw, Archive, Search, Target, Sparkles, AlertTriangle, Shield, CheckSquare, ChevronDown, ChevronRight, Download, X, Calendar } from 'lucide-react'
import { API_BASE_URL } from '../config/api'
import { useClient } from '../context/ClientContext'
import * as XLSX from 'xlsx'

export default function IOCReports() {
  const { selectedClient } = useClient()
  const [iocs, setIocs] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Filtering
  const [activeTab, setActiveTab] = useState('all') // 'all', 'ip', 'domain', 'hash', 'url'
  const [searchTerm, setSearchTerm] = useState('')
  
  // Actions
  const [syncing, setSyncing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [enrichingId, setEnrichingId] = useState(null)
  const [draftingId, setDraftingId] = useState(null)
  const [draftedIds, setDraftedIds] = useState([])

  // Export Modal State
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportTimeRange, setExportTimeRange] = useState('all') // '1d', '7d', '30d', 'all'
  const [exportActor, setExportActor] = useState('all')
  const [exportFormat, setExportFormat] = useState('xlsx') // 'xlsx', 'blocklist'

  useEffect(() => {
    if (selectedClient) {
      fetchIOCs()
    } else {
      setIocs([])
    }
  }, [selectedClient])

  const fetchIOCs = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/ioc/${selectedClient.id}`)
      if (!res.ok) throw new Error('Failed to fetch IOCs')
      let data = await res.json()
      setIocs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const syncOpenCTI = async () => {
    try {
      setSyncing(true)
      const res = await fetch(`${API_BASE_URL}/ioc/fetch/${selectedClient.id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to sync IOCs')
      await fetchIOCs()
    } catch (err) {
      console.error(err)
      alert('Failed to sync with OpenCTI')
    } finally {
      setSyncing(false)
    }
  }

  const generateAdvancedReport = async () => {
    try {
      setGenerating(true)
      const res = await fetch(`${API_BASE_URL}/reports/ioc/${selectedClient.id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate report')
      const data = await res.json()
      alert(`Advanced Report Generated successfully!\n\nSaved mock location: ${data.file_url}`)
    } catch (err) {
      console.error(err)
      alert('Failed to generate advanced report')
    } finally {
      setGenerating(false)
    }
  }

  const handleEnrich = async (iocId) => {
    try {
      setEnrichingId(iocId)
      const res = await fetch(`${API_BASE_URL}/ioc/enrich/${iocId}`, { method: 'PUT' })
      if (!res.ok) throw new Error('Failed to enrich IOC')
      fetchIOCs()
    } catch (err) {
      alert('Error enriching IOC: ' + err.message)
    } finally {
      setEnrichingId(null)
    }
  }

  const handleDraftHunt = async (iocId) => {
    try {
      setDraftingId(iocId)
      const res = await fetch(`${API_BASE_URL}/ioc/draft-hunt/${iocId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to draft hunt')
      setDraftedIds(prev => [...prev, iocId])
    } catch (err) {
      alert('Error drafting hunt: ' + err.message)
    } finally {
      setDraftingId(null)
    }
  }

  // ─── Export Logic ───────────────────────────────────────────────
  const getFilteredDataForExport = () => {
    return iocs.filter(ioc => {
      // Actor filter
      if (exportActor !== 'all' && ioc.threat_actor !== exportActor) return false
      
      // Time filter
      if (exportTimeRange !== 'all') {
        const iocDate = new Date(ioc.report_date).getTime()
        const now = Date.now()
        const diffDays = (now - iocDate) / (1000 * 3600 * 24)
        if (exportTimeRange === '1d' && diffDays > 1) return false
        if (exportTimeRange === '7d' && diffDays > 7) return false
        if (exportTimeRange === '30d' && diffDays > 30) return false
      }
      return true
    })
  }

  const executeExport = () => {
    const exportData = getFilteredDataForExport()
    if (exportData.length === 0) {
      alert("No IOCs match your export filters.")
      return
    }

    if (exportFormat === 'blocklist') {
      const text = exportData.map(i => i.value).join('\n')
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Blocklist_${selectedClient.name.replace(/\s+/g, '_')}.txt`
      a.click()
    } else if (exportFormat === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(exportData.map(ioc => ({
        Date: new Date(ioc.report_date).toLocaleDateString(),
        Type: ioc.ioc_type.toUpperCase(),
        Value: ioc.value,
        Confidence: ioc.confidence,
        'Threat Actor': ioc.threat_actor || 'Unknown',
        Source: ioc.source || 'Unknown',
        'AI Summary': ioc.ai_summary || ''
      })))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "IOCs")
      XLSX.writeFile(wb, `IOC_Export_${selectedClient.name.replace(/\s+/g, '_')}.xlsx`)
    }

    setExportModalOpen(false)
  }

  // ─── Table Utilities ────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredIOCs.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredIOCs.map(i => i.id))
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  // Active view filtering
  const filteredIOCs = iocs.filter(ioc => {
    if (activeTab !== 'all' && ioc.ioc_type !== activeTab) return false
    if (searchTerm && !ioc.value.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  // KPI Calculations
  const totalIOCs = iocs.length
  const highConfidence = iocs.filter(i => i.confidence === 'High').length
  const uniqueActors = [...new Set(iocs.map(i => i.threat_actor).filter(Boolean))]
  
  const actorCounts = {}
  iocs.forEach(i => {
    if (i.threat_actor) actorCounts[i.threat_actor] = (actorCounts[i.threat_actor] || 0) + 1
  })
  let topActor = '-'
  let maxCount = 0
  Object.entries(actorCounts).forEach(([actor, count]) => {
    if (count > maxCount) { maxCount = count; topActor = actor }
  })

  if (!selectedClient) {
    return (
      <div className="flex h-full items-center justify-center text-textsecondary">
        Please select a client from the top bar to view IOC reports.
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
          IOC Reports - {selectedClient.name}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={syncOpenCTI}
            disabled={syncing}
            className="flex items-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? 'Syncing...' : 'Sync OpenCTI'}
          </button>
          <button
            onClick={generateAdvancedReport}
            disabled={generating}
            className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            <Archive size={18} /> {generating ? 'Building...' : 'Advanced Report'}
          </button>
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/25"
          >
            <FileDown size={18} /> Export Results
          </button>
        </div>
      </div>

      {/* KPI Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-glass flex items-center justify-between bg-white/[0.02]">
          <div>
            <p className="text-textsecondary text-xs font-bold uppercase tracking-wider mb-1">Total IOCs</p>
            <h3 className="text-3xl font-bold text-white">{totalIOCs}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
            <Shield size={24} />
          </div>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl border border-glass flex items-center justify-between bg-white/[0.02]">
          <div>
            <p className="text-textsecondary text-xs font-bold uppercase tracking-wider mb-1">High Confidence</p>
            <h3 className="text-3xl font-bold text-red-400">{highConfidence}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-glass flex items-center justify-between bg-white/[0.02]">
          <div>
            <p className="text-textsecondary text-xs font-bold uppercase tracking-wider mb-1">Top Threat Actor</p>
            <h3 className="text-2xl font-bold text-accent-primary mt-1 truncate max-w-[150px]">{topActor}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20 text-accent-primary">
            <Target size={24} />
          </div>
        </div>
      </div>

      {/* ─── Controls Row (Tabs + Search) ─── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center p-1 bg-black/20 border border-glass rounded-xl overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'All Indicators' },
            { id: 'ip', label: 'IP Addresses' },
            { id: 'domain', label: 'Domains' },
            { id: 'hash', label: 'Hashes' },
            { id: 'url', label: 'URLs' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-accent-primary text-white shadow-md'
                  : 'text-textsecondary hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
              <span className="ml-2 opacity-50 font-normal">
                ({tab.id === 'all' ? iocs.length : iocs.filter(i => i.ioc_type === tab.id).length})
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textsecondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search indicator values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64 bg-black/20 border border-glass rounded-xl pl-10 pr-4 py-2 text-sm text-textprimary focus:border-accent-primary focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="glass-panel border border-glass rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-textsecondary border-b border-glass">
              <tr>
                <th className="px-5 py-4 font-semibold w-12">
                  <button onClick={toggleSelectAll} className="text-textsecondary hover:text-textprimary transition-colors">
                    <CheckSquare size={16} className={selectedIds.length === filteredIOCs.length && filteredIOCs.length > 0 ? "text-accent-primary" : ""} />
                  </button>
                </th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Type</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Indicator Value</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Confidence</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Threat Actor</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider">Discovered</th>
                <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-16 text-center text-textsecondary">Loading indicators...</td></tr>
              ) : filteredIOCs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-textsecondary">
                    <Target size={32} className="mx-auto opacity-20 mb-3" />
                    No indicators match your current filters.
                  </td>
                </tr>
              ) : (
                filteredIOCs.map((ioc) => (
                  <Fragment key={ioc.id}>
                    <tr className={`hover:bg-white/5 transition-colors group cursor-pointer ${expandedId === ioc.id ? 'bg-white/5' : ''}`} onClick={() => setExpandedId(expandedId === ioc.id ? null : ioc.id)}>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleSelect(ioc.id)} className="text-textsecondary hover:text-textprimary transition-colors">
                          <CheckSquare size={16} className={selectedIds.includes(ioc.id) ? "text-accent-primary" : ""} />
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          ioc.ioc_type === 'ip' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          ioc.ioc_type === 'domain' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          ioc.ioc_type === 'hash' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {ioc.ioc_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-textprimary">
                        {ioc.value}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          ioc.confidence === 'High' ? 'text-red-400' :
                          ioc.confidence === 'Medium' ? 'text-amber-400' : 'text-blue-400'
                        }`}>
                          {ioc.confidence || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-textsecondary">
                        {ioc.threat_actor || '-'}
                      </td>
                      <td className="px-5 py-4 text-xs text-textsecondary">
                        {new Date(ioc.report_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDraftHunt(ioc.id)}
                          disabled={draftingId === ioc.id || draftedIds.includes(ioc.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            draftedIds.includes(ioc.id)
                              ? 'bg-glass text-emerald-400 border border-emerald-500/20 opacity-80'
                              : 'bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 border border-accent-primary/20'
                          }`}
                        >
                          {draftedIds.includes(ioc.id) ? 'Generated' : draftingId === ioc.id ? 'Drafting...' : 'Draft Hunt'}
                        </button>
                        <button className="p-1.5 rounded-lg text-textsecondary hover:text-white transition-colors">
                          {expandedId === ioc.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {expandedId === ioc.id && (
                      <tr className="bg-black/40 border-b border-glass">
                        <td colSpan="7" className="px-6 py-6 animate-slide-up">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Metadata Card */}
                            <div className="lg:col-span-1 bg-white/[0.02] border border-glass rounded-xl p-4">
                              <h4 className="text-xs font-bold text-textsecondary uppercase tracking-wider mb-3">Indicator Context</h4>
                              <div className="space-y-3 text-sm">
                                <div>
                                  <span className="text-textsecondary text-xs">Full Value:</span>
                                  <p className="font-mono text-white mt-0.5 break-all">{ioc.value}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-textsecondary text-xs">Threat Actor:</span>
                                    <p className="text-white font-semibold mt-0.5">{ioc.threat_actor || 'Unknown'}</p>
                                  </div>
                                  <div>
                                    <span className="text-textsecondary text-xs">Confidence:</span>
                                    <p className="text-white font-semibold mt-0.5">{ioc.confidence || 'Unknown'}</p>
                                  </div>
                                  <div>
                                    <span className="text-textsecondary text-xs">Source ID:</span>
                                    <p className="text-white font-mono mt-0.5 text-[10px]">{ioc.opencti_id ? ioc.opencti_id.split('--')[1]?.substring(0,8) + '...' : 'Manual'}</p>
                                  </div>
                                  <div>
                                    <span className="text-textsecondary text-xs">Import Date:</span>
                                    <p className="text-white mt-0.5">{new Date(ioc.created_at || ioc.report_date).toLocaleDateString()}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* AI Enrichment Card */}
                            <div className="lg:col-span-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 flex flex-col">
                              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Sparkles size={14} /> AI Context Enrichment
                                {enrichingId === ioc.id && <RefreshCw size={12} className="animate-spin ml-2 text-indigo-400" />}
                              </h4>
                              
                              {ioc.ai_summary ? (
                                <div className="flex-1 bg-black/20 rounded-lg p-3 border border-indigo-500/10 text-sm text-textprimary leading-relaxed custom-scrollbar overflow-y-auto max-h-[150px]">
                                  {ioc.ai_summary}
                                </div>
                              ) : (
                                <div className="flex-1 flex flex-col items-center justify-center py-6 border border-dashed border-indigo-500/20 rounded-lg bg-black/20">
                                  <p className="text-sm text-textsecondary mb-3">No AI enrichment generated yet.</p>
                                  <button
                                    onClick={() => handleEnrich(ioc.id)}
                                    disabled={enrichingId === ioc.id}
                                    className="px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all"
                                  >
                                    Generate Context Summary
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Export Modal ─── */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="p-5 border-b border-glass flex items-center justify-between bg-white/[0.02]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileDown size={20} className="text-accent-primary" /> Export Indicators
              </h3>
              <button onClick={() => setExportModalOpen(false)} className="text-textsecondary hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Time Range */}
              <div>
                <label className="block text-xs font-bold text-textsecondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={14} /> Time Range
                </label>
                <select
                  value={exportTimeRange}
                  onChange={e => setExportTimeRange(e.target.value)}
                  className="w-full bg-black/20 border border-glass rounded-xl px-3 py-2.5 text-sm text-white focus:border-accent-primary outline-none"
                >
                  <option value="1d">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {/* Threat Actor */}
              <div>
                <label className="block text-xs font-bold text-textsecondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Target size={14} /> Threat Group
                </label>
                <select
                  value={exportActor}
                  onChange={e => setExportActor(e.target.value)}
                  className="w-full bg-black/20 border border-glass rounded-xl px-3 py-2.5 text-sm text-white focus:border-accent-primary outline-none"
                >
                  <option value="all">All Groups</option>
                  {uniqueActors.map(actor => (
                    <option key={actor} value={actor}>{actor}</option>
                  ))}
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="block text-xs font-bold text-textsecondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileSpreadsheet size={14} /> Export Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'xlsx', label: 'Excel (.xlsx)' },
                    { id: 'blocklist', label: 'TXT Blocklist' }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setExportFormat(fmt.id)}
                      className={`py-2 px-1 rounded-xl border text-xs font-bold transition-all text-center ${
                        exportFormat === fmt.id
                          ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/40'
                          : 'bg-black/20 border-glass text-textsecondary hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-glass bg-black/20 flex items-center justify-between">
              <span className="text-xs text-textsecondary font-medium">
                Will export <strong className="text-white">{getFilteredDataForExport().length}</strong> indicators.
              </span>
              <button
                onClick={executeExport}
                className="bg-accent-primary hover:bg-accent-secondary text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg transition-all"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
