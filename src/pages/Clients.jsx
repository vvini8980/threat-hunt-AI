import { useState, useEffect } from 'react'
import { Plus, Edit2, Key, X } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { useClient } from '../context/ClientContext'

export default function Clients() {
  const [localClients, setLocalClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const { isAdmin } = useAuth()
  const { refreshClients } = useClient()

  // Form state
  const [formData, setFormData] = useState({
    name: '', industry: '', contact_email: '',
    splunk_url: '', splunk_token: '', edr_vendor: '', firewall_vendor: ''
  })

  useEffect(() => {
    fetchClientsList()
  }, [])

  const fetchClientsList = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) throw error
      setLocalClients(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (client = null) => {
    if (client) {
      setEditingClient(client)
      setFormData({
        name: client.name || '',
        industry: client.industry || '',
        contact_email: client.contact_email || '',
        splunk_url: client.splunk_url || '',
        splunk_token: client.splunk_token || '',
        edr_vendor: client.edr_vendor || '',
        firewall_vendor: client.firewall_vendor || ''
      })
    } else {
      setEditingClient(null)
      setFormData({
        name: '', industry: '', contact_email: '',
        splunk_url: '', splunk_token: '', edr_vendor: '', firewall_vendor: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      if (editingClient) {
        const { error } = await supabase.from('clients').update(formData).eq('id', editingClient.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clients').insert([formData])
        if (error) throw error
      }
      setIsModalOpen(false)
      fetchClientsList()
      refreshClients()
    } catch (err) {
      console.error('Save failed', err)
      alert('Failed to save client: ' + err.message)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Client Management</h2>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5"
          >
            <Plus size={18} /> Add Client
          </button>
        )}
      </div>

      <div className="glass-panel border border-glass rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-textsecondary border-b border-glass">
              <tr>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Name</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Industry</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Contact</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">EDR / FW</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider">Integration Status</th>
                <th className="px-6 py-5 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-textsecondary">Loading clients...</td></tr>
              ) : localClients.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-textsecondary">No clients found.</td></tr>
              ) : (
                localClients.map((client) => (
                  <tr key={client.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5 font-semibold text-textprimary">{client.name}</td>
                    <td className="px-6 py-4 text-textsecondary">{client.industry || '-'}</td>
                    <td className="px-6 py-4 text-textsecondary">{client.contact_email || '-'}</td>
                    <td className="px-6 py-4 text-textsecondary">
                      {client.edr_vendor || '-'} / {client.firewall_vendor || '-'}
                    </td>
                    <td className="px-6 py-5">
                      {client.splunk_url && client.splunk_token ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                          <Key size={14} /> Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Missing Config
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => handleOpenModal(client)}
                          className="text-textsecondary hover:text-accent-primary p-2 rounded-lg hover:bg-accent-primary/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-2xl shadow-2xl my-8 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-glass">
              <h3 className="text-2xl font-bold text-textprimary">
                {editingClient ? 'Edit Client' : 'Add New Client'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-textsecondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="relative z-10 p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Client Name *</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Industry</label>
                  <input type="text" value={formData.industry} onChange={(e) => setFormData({...formData, industry: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Contact Email</label>
                  <input type="email" value={formData.contact_email} onChange={(e) => setFormData({...formData, contact_email: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">EDR Vendor</label>
                  <input type="text" value={formData.edr_vendor} onChange={(e) => setFormData({...formData, edr_vendor: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Firewall Vendor</label>
                  <input type="text" value={formData.firewall_vendor} onChange={(e) => setFormData({...formData, firewall_vendor: e.target.value})} className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                </div>
              </div>

              <div className="pt-6 border-t border-glass">
                <h4 className="text-lg font-bold text-textprimary mb-6 flex items-center gap-2">
                  <Key size={18} className="text-accent-primary" /> API Integrations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Splunk URL</label>
                    <input type="url" value={formData.splunk_url} onChange={(e) => setFormData({...formData, splunk_url: e.target.value})} placeholder="https://splunk.client.com:8089" className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Splunk Token</label>
                    <input type="password" value={formData.splunk_token} onChange={(e) => setFormData({...formData, splunk_token: e.target.value})} placeholder="eyJhbGciOi..." className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-glass">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5">
                  {editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
