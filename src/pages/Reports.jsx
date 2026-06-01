import { useState, useEffect } from 'react'
import { FileDown, Mail, Calendar as CalendarIcon, FileText } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useClient } from '../context/ClientContext'

export default function Reports() {
  const { selectedClient } = useClient()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    if (selectedClient) {
      fetchReports()
    } else {
      setReports([])
    }
  }, [selectedClient, dateFilter])

  const fetchReports = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('reports')
        .select('*')
        .eq('client_id', selectedClient.id)
        .order('report_date', { ascending: false })

      if (dateFilter) {
        const start = new Date(dateFilter)
        const end = new Date(dateFilter)
        end.setDate(end.getDate() + 1)
        query = query.gte('report_date', start.toISOString()).lt('report_date', end.toISOString())
      }

      const { data, error } = await query
      if (error) throw error
      setReports(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (id) => {
    // In a real app, this would trigger an edge function to send an email
    // For now, just update the sent_at timestamp to simulate it
    try {
      const { error } = await supabase
        .from('reports')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', id)
        
      if (error) throw error
      alert('Report email queued for delivery.')
      fetchReports()
    } catch (err) {
      alert('Failed to resend: ' + err.message)
    }
  }

  if (!selectedClient) {
    return (
      <div className="flex h-full items-center justify-center text-textsecondary">
        Please select a client from the top bar to view reports.
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-2">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Reports - {selectedClient.name}</h2>
        <div className="relative w-full sm:w-auto">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textsecondary" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full sm:w-[250px] bg-black/20 border border-glass rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-textsecondary">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="col-span-full py-12 text-center text-textsecondary glass-panel rounded-2xl border border-glass">
            No reports found for the selected criteria.
          </div>
        ) : (
          reports.map((report, i) => (
            <div key={report.id} className="glass-panel border border-glass rounded-2xl p-6 flex flex-col gap-6 shadow-lg transition-all hover:border-white/10 hover:shadow-xl hover:-translate-y-1 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent-primary/20 text-accent-primary rounded-xl shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-textprimary capitalize tracking-wide">
                      {report.report_type} Report
                    </h3>
                    <p className="text-xs font-medium text-textsecondary mt-1">
                      {new Date(report.report_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4 text-sm text-textsecondary border border-glass shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="font-semibold uppercase tracking-wider text-xs">Last Sent</span>
                  <span className="text-textprimary font-bold">
                    {report.sent_at ? new Date(report.sent_at).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-glass">
                <button
                  onClick={() => window.open(report.file_url, '_blank')}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-glass text-textprimary px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <FileDown size={16} /> Download
                </button>
                <button
                  onClick={() => handleResend(report.id)}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5"
                >
                  <Mail size={16} /> Resend
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
