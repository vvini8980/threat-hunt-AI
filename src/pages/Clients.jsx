import { useState, useEffect } from 'react'
import { Plus, Edit2, Key, X, Database, Shield, Zap, ChevronDown, CheckCircle2, AlertCircle, Layers } from 'lucide-react'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useClient } from '../context/ClientContext'

const EMPTY_FORM = {
  name: '', industry: '', contact_email: '', edr_vendor: '', firewall_vendor: '',
  // Splunk
  splunk_url: '', splunk_token: '', splunk_schema: '',
  splunk_indexes: '', splunk_sourcetypes: '', splunk_key_fields: '',
  // Sentinel
  sentinel_workspace_id: '', sentinel_tenant_id: '',
  sentinel_client_id: '', sentinel_client_secret: '', sentinel_schema: '',
}

function SiemBadge({ client }) {
  const hasSplunk   = client.splunk_url
  const hasSentinel = client.sentinel_workspace_id
  if (hasSplunk && hasSentinel) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
      <Zap size={11} /> Splunk + Sentinel
    </span>
  )
  if (hasSplunk) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
      <Database size={11} /> Splunk
    </span>
  )
  if (hasSentinel) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <Shield size={11} /> Sentinel
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <AlertCircle size={11} /> Not Configured
    </span>
  )
}

function InputField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-textsecondary mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-textsecondary/60 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = "w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all placeholder:text-textsecondary/30"
const monoCls  = `${inputCls} font-mono text-xs`

export default function Clients() {
  const [localClients, setLocalClients] = useState([])
  const [loading, setLoading]           = useState(true)
  const [isModalOpen, setIsModalOpen]   = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [siemTab, setSiemTab]           = useState('splunk')   // 'splunk' | 'sentinel'
  const [formData, setFormData]         = useState(EMPTY_FORM)
  const { isAdmin }       = useAuth()
  const { refreshClients } = useClient()

  useEffect(() => { fetchClientsList() }, [])

  const fetchClientsList = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE_URL}/clients`)
      if (!res.ok) throw new Error('Failed to fetch clients')
      setLocalClients(await res.json() || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }))

  const handleOpenModal = (client = null) => {
    if (client) {
      setEditingClient(client)
      setFormData({
        name: client.name || '', industry: client.industry || '',
        contact_email: client.contact_email || '',
        edr_vendor: client.edr_vendor || '', firewall_vendor: client.firewall_vendor || '',
        splunk_url: client.splunk_url || '', splunk_token: client.splunk_token || '',
        splunk_schema: client.splunk_schema || '',
        splunk_indexes: client.splunk_indexes || '',
        splunk_sourcetypes: client.splunk_sourcetypes || '',
        splunk_key_fields: client.splunk_key_fields || '',
        sentinel_workspace_id: client.sentinel_workspace_id || '',
        sentinel_tenant_id: client.sentinel_tenant_id || '',
        sentinel_client_id: client.sentinel_client_id || '',
        sentinel_client_secret: client.sentinel_client_secret || '',
        sentinel_schema: client.sentinel_schema || '',
      })
      // Auto-select the right SIEM tab
      if (client.sentinel_workspace_id && !client.splunk_url) setSiemTab('sentinel')
      else setSiemTab('splunk')
    } else {
      setEditingClient(null)
      setFormData(EMPTY_FORM)
      setSiemTab('splunk')
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const url    = editingClient ? `${API_BASE_URL}/clients/${editingClient.id}` : `${API_BASE_URL}/clients`
      const method = editingClient ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to save client')
      setIsModalOpen(false)
      fetchClientsList()
      refreshClients()
    } catch (err) {
      alert('Failed to save client: ' + err.message)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 flex items-center gap-3">
            <Layers size={22} className="text-accent-primary" /> Client Management
          </h2>
          <p className="text-sm text-textsecondary mt-0.5">{localClients.length} clients configured</p>
        </div>
        {isAdmin && (
          <button onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5">
            <Plus size={16} /> Add Client
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="glass-panel border border-glass rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-textsecondary border-b border-glass">
              <tr>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Industry</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">SIEM Integration</th>
                <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-textsecondary">Loading clients...</td></tr>
              ) : localClients.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-textsecondary">No clients yet. Add your first client.</td></tr>
              ) : localClients.map(client => (
                <tr key={client.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-textprimary">{client.name}</p>
                  </td>
                  <td className="px-6 py-4 text-textsecondary text-xs">{client.industry || '—'}</td>
                  <td className="px-6 py-4 text-textsecondary text-xs">{client.contact_email || '—'}</td>
                  <td className="px-6 py-4"><SiemBadge client={client} /></td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <button onClick={() => handleOpenModal(client)}
                        className="text-textsecondary hover:text-accent-primary p-2 rounded-lg hover:bg-accent-primary/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                        <Edit2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════ Add / Edit Modal ══════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 sm:pt-20 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel border border-glass rounded-2xl w-full max-w-2xl shadow-2xl relative flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
            <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/5 to-transparent pointer-events-none" />

            {/* Modal Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-glass shrink-0 bg-white/[0.02]">
              <div>
                <h3 className="text-xl font-bold text-textprimary">
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h3>
                <p className="text-xs text-textsecondary mt-0.5">Configure client details and SIEM integrations</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-textsecondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="relative z-10 flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

                {/* ── Client Info ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Client Name *">
                  <input required type="text" value={formData.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Acme Corp" />
                </InputField>
                <InputField label="Contact Email">
                  <input type="email" value={formData.contact_email} onChange={e => set('contact_email', e.target.value)} className={inputCls} placeholder="soc@client.com" />
                </InputField>
                <InputField label="Industry">
                  <input type="text" value={formData.industry} onChange={e => set('industry', e.target.value)} className={inputCls} placeholder="Finance, Healthcare..." />
                </InputField>
              </div>

              <InputField label="Vendor Log Sources" hint="List all security vendors and technologies (e.g. CrowdStrike, Okta, Palo Alto). The AI uses this context for query creation.">
                <textarea rows={3} value={formData.vendor_log_sources || ''} onChange={e => set('vendor_log_sources', e.target.value)}
                  className={`${monoCls} resize-y`}
                  placeholder={"CrowdStrike Falcon\nPalo Alto NGFW\nOkta Identity\nWindows Active Directory"} />
              </InputField>

              {/* ── SIEM Configuration ── */}
              <div className="pt-2 border-t border-glass">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-textprimary flex items-center gap-2">
                    <Key size={15} className="text-accent-primary" /> SIEM Configuration
                  </h4>
                  <p className="text-[10px] text-textsecondary">Fill in one or both SIEMs — AI generates queries for whichever are configured</p>
                </div>

                {/* SIEM Tabs */}
                <div className="flex items-center bg-white/[0.03] border border-glass rounded-xl p-1 mb-5 w-fit">
                  {[
                    { key: 'splunk',   label: 'Splunk',    icon: Database, color: 'text-orange-400', activeBg: 'bg-orange-500/15 border-orange-500/20 text-orange-400' },
                    { key: 'sentinel', label: 'Sentinel',  icon: Shield,   color: 'text-blue-400',   activeBg: 'bg-blue-500/15 border-blue-500/20 text-blue-400' },
                  ].map(tab => (
                    <button key={tab.key} type="button" onClick={() => setSiemTab(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                        siemTab === tab.key ? tab.activeBg : 'border-transparent text-textsecondary hover:text-textprimary'
                      }`}>
                      <tab.icon size={13} /> {tab.label}
                      {/* Configured dot */}
                      {tab.key === 'splunk' && formData.splunk_url && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 ml-1" />}
                      {tab.key === 'sentinel' && formData.sentinel_workspace_id && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1" />}
                    </button>
                  ))}
                </div>

                {/* ── Splunk Tab ── */}
                {siemTab === 'splunk' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label="Splunk URL" hint="e.g. https://splunk.company.com:8089">
                        <input type="text" value={formData.splunk_url} onChange={e => set('splunk_url', e.target.value)} className={inputCls} placeholder="https://splunk.company.com:8089" />
                      </InputField>
                      <InputField label="Splunk API Token">
                        <input type="password" value={formData.splunk_token} onChange={e => set('splunk_token', e.target.value)} className={inputCls} placeholder="eyJhbGciOi..." />
                      </InputField>
                    </div>

                    <InputField label="Available Indexes" hint="One per line. The AI uses these to write correct SPL queries.">
                      <textarea rows={4} value={formData.splunk_indexes} onChange={e => set('splunk_indexes', e.target.value)}
                        className={`${monoCls} resize-y`}
                        placeholder={"index=windows\nindex=network\nindex=dns\nindex=web\nindex=endpoint"} />
                    </InputField>

                    <InputField label="Available SourceTypes" hint="One per line. Include exact Splunk sourcetype names.">
                      <textarea rows={4} value={formData.splunk_sourcetypes} onChange={e => set('splunk_sourcetypes', e.target.value)}
                        className={`${monoCls} resize-y`}
                        placeholder={"WinEventLog:Security\nXmlWinEventLog:Microsoft-Windows-Sysmon/Operational\npan:traffic\nstream:dns\naccess_combined"} />
                    </InputField>

                    <InputField label="Key Fields" hint="Important field names in this client's logs. Helps AI write accurate field filters.">
                      <textarea rows={3} value={formData.splunk_key_fields} onChange={e => set('splunk_key_fields', e.target.value)}
                        className={`${monoCls} resize-y`}
                        placeholder={"src_ip, dest_ip, user, host, process_name, CommandLine, Image, EventCode, ParentImage"} />
                    </InputField>

                    <InputField label="Additional Schema Notes" hint="Any extra context: macros, lookups, naming conventions, filtered indexes, etc.">
                      <textarea rows={3} value={formData.splunk_schema} onChange={e => set('splunk_schema', e.target.value)}
                        className={`${monoCls} resize-y`}
                        placeholder={"index=windows contains Sysmon (EventCode 1,3,7,11,12,13) and Windows Security Logs.\nUse index=proxy for web traffic. Avoid index=_internal.\nAdmin hosts are in the lookup 'admin_hosts.csv'."} />
                    </InputField>
                  </div>
                )}

                {/* ── Sentinel Tab ── */}
                {siemTab === 'sentinel' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-[11px] text-blue-300/80 leading-relaxed">
                      <strong className="text-blue-400">ℹ️ Sentinel Setup:</strong> The Workspace ID is required for AI query generation.
                      Tenant ID, Client ID, and Secret are needed only for live query execution via the Azure API.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField label="Log Analytics Workspace ID *" hint="Found in Azure Portal → Log Analytics → Properties">
                        <input type="text" value={formData.sentinel_workspace_id} onChange={e => set('sentinel_workspace_id', e.target.value)} className={inputCls} placeholder="a1b2c3d4-..." />
                      </InputField>
                      <InputField label="Azure Tenant ID" hint="Azure Active Directory → Properties → Tenant ID">
                        <input type="text" value={formData.sentinel_tenant_id} onChange={e => set('sentinel_tenant_id', e.target.value)} className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-..." />
                      </InputField>
                      <InputField label="App Registration Client ID" hint="App registrations → Your App → Application (client) ID">
                        <input type="text" value={formData.sentinel_client_id} onChange={e => set('sentinel_client_id', e.target.value)} className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-..." />
                      </InputField>
                      <InputField label="App Client Secret" hint="App registrations → Certificates & Secrets">
                        <input type="password" value={formData.sentinel_client_secret} onChange={e => set('sentinel_client_secret', e.target.value)} className={inputCls} placeholder="••••••••••••" />
                      </InputField>
                    </div>

                    <InputField label="Log Analytics Tables & Schema" hint="List the tables available in this workspace. The AI uses these to write accurate KQL queries.">
                      <textarea rows={8} value={formData.sentinel_schema} onChange={e => set('sentinel_schema', e.target.value)}
                        className={`${monoCls} resize-y`}
                        placeholder={"SecurityEvent          -- Windows Security Events (EventID, Computer, Account, CommandLine)\nSigninLogs             -- Azure AD Sign-in logs (UserPrincipalName, IPAddress, AppDisplayName)\nAuditLogs              -- Azure AD Audit events\nDeviceProcessEvents    -- MDE process creations (DeviceName, FileName, ProcessCommandLine)\nDeviceNetworkEvents    -- MDE network connections (DeviceName, RemoteIP, RemotePort)\nDeviceFileEvents       -- MDE file operations\nCommonSecurityLog      -- CEF-format firewall/proxy logs (SourceIP, DestinationIP, Protocol)\nDnsEvents              -- DNS query logs (Computer, Name, QueryType)\nOfficeActivity         -- Microsoft 365 activity (Operation, UserId, ClientIP)"} />
                    </InputField>
                  </div>
                )}
              </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex justify-end gap-3 p-6 border-t border-glass shrink-0 bg-white/[0.02]">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-textsecondary hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="px-5 py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5">
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
