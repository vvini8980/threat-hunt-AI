import { useState, useEffect } from 'react'
import { FileDown, Calendar as CalendarIcon, ShieldAlert, CheckCircle, ShieldQuestion } from 'lucide-react'
import { API_BASE_URL } from '../config/api'
import { useClient } from '../context/ClientContext'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function HuntResults() {
  const { selectedClient } = useClient()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    if (selectedClient) {
      fetchResults()
    } else {
      setResults([])
    }
  }, [selectedClient, dateFilter])

  const fetchResults = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/hunt/results/${selectedClient.id}`)
      if (!res.ok) throw new Error('Failed to fetch results')
      let data = await res.json()

      if (dateFilter) {
        const start = new Date(dateFilter)
        const end = new Date(dateFilter)
        end.setDate(end.getDate() + 1)
        
        data = data.filter(r => {
          const t = new Date(r.executed_at)
          return t >= start && t < end
        })
      }

      setResults(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.text(`Hunt Results - ${selectedClient.name}`, 14, 15)
    
    if (dateFilter) {
      doc.setFontSize(10)
      doc.text(`Date Filter: ${dateFilter}`, 14, 22)
    }

    const tableData = results.map(r => [
      new Date(r.executed_at).toLocaleDateString(),
      r.hypotheses?.title || 'Unknown',
      r.verdict,
      r.evidence || 'None',
      r.analyst_notes || 'None'
    ])

    doc.autoTable({
      startY: dateFilter ? 28 : 22,
      head: [['Date', 'Hypothesis', 'Verdict', 'Evidence', 'Analyst Notes']],
      body: tableData,
    })

    doc.save(`Hunt_Results_${selectedClient.name.replace(/\s+/g, '_')}.pdf`)
  }

  const getVerdictConfig = (verdict) => {
    switch (verdict) {
      case 'TP':
        return { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' }
      case 'FP':
        return { icon: ShieldQuestion, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' }
      case 'clean':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' }
      default:
        return { icon: ShieldQuestion, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20' }
    }
  }

  if (!selectedClient) {
    return (
      <div className="flex h-full items-center justify-center text-textsecondary">
        Please select a client from the top bar to view hunt results.
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Hunt Results - {selectedClient.name}</h2>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textsecondary" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-black/20 border border-glass rounded-xl pl-10 pr-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all shadow-inner"
            />
          </div>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5 shrink-0"
          >
            <FileDown size={18} /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-textsecondary">Loading results...</div>
        ) : results.length === 0 ? (
          <div className="col-span-full py-12 text-center text-textsecondary glass-panel rounded-2xl border border-glass">
            No hunt results found for the selected criteria.
          </div>
        ) : (
          results.map((result, i) => {
            const { icon: VerdictIcon, color, bg, border } = getVerdictConfig(result.verdict)
            return (
              <div key={result.id} className="glass-panel border border-glass rounded-2xl p-6 shadow-lg transition-all hover:border-white/10 hover:shadow-xl hover:-translate-y-1 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-lg text-textprimary mb-1.5">{result.hypotheses?.title || 'Unknown Hypothesis'}</h3>
                    <p className="text-xs font-medium text-textsecondary flex items-center gap-1.5">
                      <Clock size={12} /> {new Date(result.executed_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${bg} ${color} ${border} shadow-sm`}>
                    <VerdictIcon size={14} />
                    {result.verdict}
                  </span>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-bold text-textsecondary uppercase tracking-wider mb-2 flex items-center gap-2">Evidence</h4>
                    <p className="text-sm leading-relaxed text-textprimary bg-black/20 p-4 rounded-xl border border-glass whitespace-pre-wrap">
                      {result.evidence || 'No evidence provided.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-textsecondary uppercase tracking-wider mb-2 flex items-center gap-2">Analyst Notes</h4>
                    <p className="text-sm leading-relaxed text-textprimary bg-black/20 p-4 rounded-xl border border-glass whitespace-pre-wrap">
                      {result.analyst_notes || 'No notes provided.'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
