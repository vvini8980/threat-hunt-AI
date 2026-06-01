import { useState, useEffect } from 'react'
import { FileDown, FileSpreadsheet, Filter } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useClient } from '../context/ClientContext'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

export default function IOCReports() {
  const { selectedClient } = useClient()
  const [iocs, setIocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    if (selectedClient) {
      fetchIOCs()
    } else {
      setIocs([])
    }
  }, [selectedClient, typeFilter])

  const fetchIOCs = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('ioc_reports')
        .select('*')
        .eq('client_id', selectedClient.id)
        .order('report_date', { ascending: false })

      if (typeFilter !== 'all') {
        query = query.eq('ioc_type', typeFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setIocs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.text(`IOC Intelligence Report - ${selectedClient.name}`, 14, 15)

    const tableData = iocs.map(ioc => [
      new Date(ioc.report_date).toLocaleDateString(),
      ioc.ioc_type.toUpperCase(),
      ioc.value,
      ioc.confidence,
      ioc.threat_actor || 'Unknown'
    ])

    doc.autoTable({
      startY: 22,
      head: [['Date', 'Type', 'Value', 'Confidence', 'Threat Actor']],
      body: tableData,
    })

    doc.save(`IOC_Report_${selectedClient.name.replace(/\s+/g, '_')}.pdf`)
  }

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(iocs.map(ioc => ({
      Date: new Date(ioc.report_date).toLocaleDateString(),
      Type: ioc.ioc_type.toUpperCase(),
      Value: ioc.value,
      Confidence: ioc.confidence,
      'Threat Actor': ioc.threat_actor || 'Unknown',
      Source: ioc.source || 'Unknown'
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "IOCs")
    XLSX.writeFile(wb, `IOC_Export_${selectedClient.name.replace(/\s+/g, '_')}.csv`)
  }

  if (!selectedClient) {
    return (
      <div className="flex h-full items-center justify-center text-textsecondary">
        Please select a client from the top bar to view IOC reports.
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-2">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">IOC Reports - {selectedClient.name}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textsecondary pointer-events-none" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-black/20 border border-glass rounded-xl pl-10 pr-8 py-2.5 text-sm font-medium text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none appearance-none transition-all shadow-inner"
            >
              <option value="all" className="bg-bg-primary">All Types</option>
              <option value="ip" className="bg-bg-primary">IP Address</option>
              <option value="domain" className="bg-bg-primary">Domain</option>
              <option value="url" className="bg-bg-primary">URL</option>
              <option value="hash" className="bg-bg-primary">Hash</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-textsecondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-textprimary border border-glass px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <FileSpreadsheet size={18} className="text-emerald-400" /> CSV
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5"
            >
              <FileDown size={18} /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel border border-glass rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-textsecondary border-b border-glass">
              <tr>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Type</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Value</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Confidence</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Threat Actor</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-textsecondary">Loading IOCs...</td></tr>
              ) : iocs.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-12 text-center text-textsecondary">No IOCs found.</td></tr>
              ) : (
                iocs.map((ioc) => (
                  <tr key={ioc.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-black/40 border border-glass text-textprimary shadow-inner">
                        {ioc.ioc_type}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-mono text-sm text-textprimary">
                      {ioc.value}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm ${
                        ioc.confidence === 'High' ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' :
                        ioc.confidence === 'Medium' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                      }`}>
                        {ioc.confidence || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-textsecondary font-medium">
                      {ioc.threat_actor || '-'}
                    </td>
                    <td className="px-6 py-5 text-textsecondary">
                      {new Date(ioc.report_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
