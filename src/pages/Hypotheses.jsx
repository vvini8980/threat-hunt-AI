import { useState, useEffect } from 'react'
import { Check, X as XIcon, Plus, Play, CheckCircle2 } from 'lucide-react'
import { API_BASE_URL } from '../config/api'
import { useClient } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import { StatusBadge } from '../components/Common/StatusBadge'

export default function Hypotheses() {
  const { selectedClient } = useClient()
  const { user } = useAuth()
  const [hypotheses, setHypotheses] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('manual')

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '', description: '', mitre_id: '', mitre_tactic: '', splunk_query: ''
  })

  // Reject modal state
  const [rejectingHypo, setRejectingHypo] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

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

  const handleAddManual = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...formData,
        client_id: selectedClient.id,
        source: 'manual',
        status: 'draft',
        created_by: user.id
      }
      const res = await fetch(`${API_BASE_URL}/hypotheses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Failed to create hypothesis')
      setIsFormOpen(false)
      setFormData({ title: '', description: '', mitre_id: '', mitre_tactic: '', splunk_query: '' })
      fetchHypotheses()
    } catch (err) {
      alert('Error creating hypothesis: ' + err.message)
    }
  }

  const handleApprove = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/hypotheses/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })
      if (!res.ok) throw new Error('Failed to approve')
      fetchHypotheses()
    } catch (err) {
      alert('Error approving: ' + err.message)
    }
  }

  const handleReject = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/hypotheses/${rejectingHypo.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      })
      if (!res.ok) throw new Error('Failed to reject')
      setRejectingHypo(null)
      setRejectReason('')
      fetchHypotheses()
    } catch (err) {
      alert('Error rejecting: ' + err.message)
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
      fetchHypotheses()
    } catch (err) {
      alert('Error updating status: ' + err.message)
    }
  }

  if (!selectedClient) {
    return (
      <div className="flex h-full items-center justify-center text-textsecondary">
        Please select a client from the top bar to view hypotheses.
      </div>
    )
  }

  const manualHypos = hypotheses.filter(h => h.source === 'manual')
  const aiHypos = hypotheses.filter(h => h.source === 'ai')
  const displayHypos = activeTab === 'manual' ? manualHypos : aiHypos

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Hypotheses - {selectedClient.name}</h2>
        {activeTab === 'manual' && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5"
          >
            <Plus size={18} /> Add Hypothesis
          </button>
        )}
      </div>

      <div className="flex border-b border-glass gap-8">
        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-4 font-semibold text-sm transition-all border-b-2 relative ${activeTab === 'manual' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-textsecondary hover:text-textprimary'}`}
        >
          Manual Hypotheses ({manualHypos.length})
          {activeTab === 'manual' && <div className="absolute -bottom-[2px] left-0 w-full h-[2px] bg-accent-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`pb-4 font-semibold text-sm transition-all border-b-2 relative ${activeTab === 'ai' ? 'border-accent-primary text-accent-primary' : 'border-transparent text-textsecondary hover:text-textprimary'}`}
        >
          AI Generated ({aiHypos.length})
          {activeTab === 'ai' && <div className="absolute -bottom-[2px] left-0 w-full h-[2px] bg-accent-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-textsecondary">Loading hypotheses...</div>
        ) : displayHypos.length === 0 ? (
          <div className="py-12 text-center text-textsecondary glass-panel rounded-2xl border border-glass">
            No {activeTab} hypotheses found.
          </div>
        ) : (
          displayHypos.map((hypo, i) => (
            <div key={hypo.id} className="glass-panel border border-glass rounded-2xl p-6 flex flex-col gap-5 transition-all hover:border-white/10 hover:shadow-lg animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-textprimary">{hypo.title}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-mono font-bold tracking-wider bg-black/40 px-2.5 py-1 rounded-md text-textsecondary border border-glass">
                      {hypo.mitre_id || 'No ID'}
                    </span>
                    <span className="text-sm font-medium text-textsecondary">{hypo.mitre_tactic}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm
                    ${hypo.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]' : 
                      hypo.status === 'approved' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' :
                      hypo.status === 'running' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'}`}
                  >
                    {hypo.status}
                  </span>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-textprimary bg-black/20 p-4 rounded-xl border border-glass">
                {hypo.description}
              </p>

              {hypo.rejected_reason && (
                <div className="text-sm text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20 shadow-inner">
                  <strong className="font-semibold text-red-500 uppercase tracking-wider text-xs mr-2">Rejected Reason:</strong>
                  {hypo.rejected_reason}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-glass">
                {hypo.status === 'draft' && activeTab === 'ai' && !hypo.rejected_reason && (
                  <>
                    <button onClick={() => setRejectingHypo(hypo)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20">
                      <XIcon size={16} /> Reject
                    </button>
                    <button onClick={() => handleApprove(hypo.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors border border-transparent hover:border-emerald-500/20">
                      <Check size={16} /> Approve
                    </button>
                  </>
                )}
                
                {hypo.status === 'draft' && activeTab === 'manual' && (
                  <button onClick={() => handleApprove(hypo.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-accent-primary hover:bg-accent-primary/10 transition-colors border border-transparent hover:border-accent-primary/20">
                    <Check size={16} /> Mark Approved
                  </button>
                )}

                {hypo.status === 'approved' && (
                  <button onClick={() => updateStatus(hypo.id, 'running')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                    <Play size={16} className="fill-indigo-400/50" /> Run Hunt
                  </button>
                )}

                {hypo.status === 'running' && (
                  <button onClick={() => updateStatus(hypo.id, 'complete')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors border border-transparent hover:border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    <CheckCircle2 size={16} /> Complete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Manual Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-2xl shadow-2xl my-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-glass">
              <h3 className="text-2xl font-bold text-textprimary">Add Manual Hypothesis</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-textsecondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                <XIcon size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddManual} className="relative z-10 p-6 space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Title *</label>
                <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">MITRE ID</label>
                  <input type="text" value={formData.mitre_id} onChange={(e) => setFormData({...formData, mitre_id: e.target.value})} placeholder="T1059" className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">MITRE Tactic</label>
                  <input type="text" value={formData.mitre_tactic} onChange={(e) => setFormData({...formData, mitre_tactic: e.target.value})} placeholder="Execution" className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Description</label>
                <textarea rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Splunk Query</label>
                <textarea rows={3} value={formData.splunk_query} onChange={(e) => setFormData({...formData, splunk_query: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 font-mono text-xs text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-glass">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5">
                  Save Hypothesis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingHypo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-md shadow-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <XIcon size={120} className="text-red-500" />
            </div>
            <h3 className="relative z-10 text-xl font-bold text-textprimary mb-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-500">
                <XIcon size={20} />
              </div>
              Reject Hypothesis
            </h3>
            <p className="relative z-10 text-sm text-textsecondary mb-6 leading-relaxed">Are you sure you want to reject <strong className="text-white">"{rejectingHypo.title}"</strong>?</p>
            <textarea
              required
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="relative z-10 w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none mb-6 transition-all"
            />
            <div className="relative z-10 flex justify-end gap-3">
              <button onClick={() => setRejectingHypo(null)} className="px-5 py-2.5 text-sm font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-red-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
