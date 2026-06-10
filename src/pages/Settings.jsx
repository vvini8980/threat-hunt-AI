import { useState, useEffect } from 'react'
import { Save, Bell, Brain, Clock4, Database, Wifi, WifiOff, CheckCircle2, AlertCircle, Server, Shield, Zap, Key } from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { useToastContext } from '../context/ToastContext'
import { API_BASE_URL } from '../config/api'
import { supabase } from '../services/supabase'

function Section({ title, icon: Icon, iconColor, children }) {
  return (
    <div className="glass-panel border border-glass rounded-2xl p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-[0.03] transition-transform group-hover:scale-110 duration-500 pointer-events-none">
        <Icon size={100} />
      </div>
      <h3 className="relative z-10 text-base font-bold text-textprimary mb-5 flex items-center gap-3">
        <div className={`p-2 rounded-xl ${iconColor}`}><Icon size={17} /></div>
        {title}
      </h3>
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-textsecondary/60 mt-1.5">{hint}</p>}
    </div>
  )
}

const EMPTY = {
  notification_email: '', report_time: '09:00', ai_enabled: true, ai_daily_limit: 5,
  opencti_url: '', opencti_token: '',
  // Splunk
  splunk_url: '', splunk_token: '', splunk_schema: '',
  splunk_indexes: '', splunk_sourcetypes: '', splunk_key_fields: '',
  // Sentinel
  sentinel_workspace_id: '', sentinel_tenant_id: '',
  sentinel_client_id: '', sentinel_client_secret: '', sentinel_schema: '',
}

export default function Settings() {
  const { selectedClient, refreshClients }   = useClient()
  const { showToast }        = useToastContext()
  const [loading, setLoading]               = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus]   = useState(null)
  const [connectionMessage, setConnectionMessage] = useState('')
  const [siemTab, setSiemTab] = useState('splunk')
  const [settings, setSettings] = useState(EMPTY)

  useEffect(() => { if (selectedClient) loadSettings() }, [selectedClient])

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }))

  const loadSettings = async () => {
    const saved = localStorage.getItem(`settings_${selectedClient.id}`)
    const local = saved ? JSON.parse(saved) : {}
    try {
      const { data } = await supabase
        .from('clients')
        .select(
          'contact_email,splunk_url,splunk_token,splunk_schema,splunk_indexes,splunk_sourcetypes,splunk_key_fields,' +
          'sentinel_workspace_id,sentinel_tenant_id,sentinel_client_id,sentinel_client_secret,sentinel_schema'
        )
        .eq('id', selectedClient.id)
        .single()

      setSettings({
        notification_email: local.notification_email || data?.contact_email || '',
        report_time:        local.report_time || '09:00',
        ai_enabled:         local.ai_enabled !== undefined ? local.ai_enabled : true,
        ai_daily_limit:     local.ai_daily_limit || 5,
        opencti_url:        local.opencti_url || '',
        opencti_token:      local.opencti_token || '',
        // Splunk — prefer DB
        splunk_url:          data?.splunk_url        || local.splunk_url        || '',
        splunk_token:        data?.splunk_token      || local.splunk_token      || '',
        splunk_schema:       data?.splunk_schema     || local.splunk_schema     || '',
        splunk_indexes:      data?.splunk_indexes    || local.splunk_indexes    || '',
        splunk_sourcetypes:  data?.splunk_sourcetypes|| local.splunk_sourcetypes|| '',
        splunk_key_fields:   data?.splunk_key_fields || local.splunk_key_fields || '',
        // Sentinel — prefer DB
        sentinel_workspace_id:  data?.sentinel_workspace_id  || '',
        sentinel_tenant_id:     data?.sentinel_tenant_id     || '',
        sentinel_client_id:     data?.sentinel_client_id     || '',
        sentinel_client_secret: data?.sentinel_client_secret || '',
        sentinel_schema:        data?.sentinel_schema        || '',
        // Primary SIEM Preference
        primary_siem:           local.primary_siem || 'splunk',
      })

      // Auto-select tab
      if (data?.sentinel_workspace_id && !data?.splunk_url) setSiemTab('sentinel')
      else setSiemTab('splunk')
    } catch {
      setSettings(prev => ({ ...prev, notification_email: local.notification_email || selectedClient.contact_email || '', ...local }))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await supabase.from('clients').update({
        splunk_url:    settings.splunk_url,
        splunk_token:  settings.splunk_token,
        splunk_schema: settings.splunk_schema,
        splunk_indexes:      settings.splunk_indexes,
        splunk_sourcetypes:  settings.splunk_sourcetypes,
        splunk_key_fields:   settings.splunk_key_fields,
        sentinel_workspace_id:  settings.sentinel_workspace_id,
        sentinel_tenant_id:     settings.sentinel_tenant_id,
        sentinel_client_id:     settings.sentinel_client_id,
        sentinel_client_secret: settings.sentinel_client_secret,
        sentinel_schema:        settings.sentinel_schema,
      }).eq('id', selectedClient.id)

      localStorage.setItem(`settings_${selectedClient.id}`, JSON.stringify(settings))
      if (refreshClients) {
        await refreshClients()
      }
      showToast('Settings saved successfully.', 'success')
    } catch (err) {
      showToast('Failed to save: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const testSplunkConnection = async () => {
    if (!settings.splunk_url || !settings.splunk_token) {
      showToast('Please enter Splunk URL and token first.', 'warning'); return
    }
    setTestingConnection(true); setConnectionStatus(null)
    try {
      const res = await fetch(`${API_BASE_URL}/hunt/splunk/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: settings.splunk_url, token: settings.splunk_token })
      })
      const data = await res.json()
      if (res.ok) { setConnectionStatus('ok'); showToast(data.message || 'Splunk connection successful!', 'success') }
      else { setConnectionStatus('error'); setConnectionMessage(data.detail || 'Could not connect.'); showToast(data.detail, 'error') }
    } catch (err) { setConnectionStatus('error'); showToast('Network error: ' + err.message, 'error') }
    finally { setTestingConnection(false) }
  }

  const inputCls = "w-full bg-black/20 border border-glass rounded-xl px-4 py-2.5 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all"
  const monoCls  = `${inputCls} font-mono text-xs`

  // Determine active SIEMs
  const hasSplunk   = !!(settings.splunk_url && settings.splunk_token)
  const hasSentinel = !!settings.sentinel_workspace_id

  if (!selectedClient) return (
    <div className="flex h-full items-center justify-center flex-col gap-4 text-textsecondary">
      <Server size={48} className="opacity-10" />
      <p>Select a client to view settings</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Settings</h2>
        <p className="text-sm text-textsecondary mt-0.5 flex items-center gap-2">
          {selectedClient.name}
          {hasSplunk && hasSentinel && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/20"><Zap size={9} /> Splunk + Sentinel</span>}
          {hasSplunk && !hasSentinel && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20"><Database size={9} /> Splunk</span>}
          {hasSentinel && !hasSplunk && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20"><Shield size={9} /> Sentinel</span>}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* ── Notifications ── */}
        <Section title="Notification Preferences" icon={Bell} iconColor="bg-accent-primary/15 text-accent-primary">
          <Field label="Alert Email Address">
            <input type="email" value={settings.notification_email}
              onChange={e => set('notification_email', e.target.value)}
              className={inputCls} placeholder="soc@company.com" />
          </Field>
        </Section>

        {/* ── Reporting ── */}
        <Section title="Automated Reporting" icon={Clock4} iconColor="bg-emerald-500/15 text-emerald-400">
          <Field label="Daily Report Delivery Time (UTC)" hint="Reports will be generated and emailed at this time daily.">
            <input type="time" value={settings.report_time} onChange={e => set('report_time', e.target.value)} className={inputCls} />
          </Field>
        </Section>

        {/* ══ SIEM Configuration ══ */}
        <div className="glass-panel border border-glass rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none"><Database size={100} /></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-textprimary flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400"><Key size={17} /></div>
                SIEM Integrations
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-textsecondary font-semibold uppercase tracking-wider">Default Target:</span>
                <select 
                  value={settings.primary_siem || 'splunk'} 
                  onChange={e => set('primary_siem', e.target.value)}
                  className="bg-black/40 border border-glass rounded-lg text-xs font-bold text-textprimary px-3 py-1.5 focus:border-accent-primary outline-none"
                >
                  <option value="splunk">Splunk SPL</option>
                  <option value="sentinel">Microsoft Sentinel KQL</option>
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center bg-white/[0.03] border border-glass rounded-xl p-1 mb-5 w-fit">
              {[
                { key: 'splunk',   label: 'Splunk',   icon: Database, activeBg: 'bg-orange-500/15 border-orange-500/20 text-orange-400', dot: hasSplunk },
                { key: 'sentinel', label: 'Sentinel',  icon: Shield,   activeBg: 'bg-blue-500/15 border-blue-500/20 text-blue-400',   dot: hasSentinel },
              ].map(tab => (
                <button key={tab.key} type="button" onClick={() => setSiemTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    siemTab === tab.key ? tab.activeBg : 'border-transparent text-textsecondary hover:text-textprimary'
                  }`}>
                  <tab.icon size={13} /> {tab.label}
                  {tab.dot && <span className="w-1.5 h-1.5 rounded-full bg-current ml-0.5" />}
                </button>
              ))}
            </div>

            {/* ── Splunk ── */}
            {siemTab === 'splunk' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Splunk URL" hint="https://splunk.company.com:8089">
                    <input type="url" value={settings.splunk_url} onChange={e => set('splunk_url', e.target.value)} className={inputCls} placeholder="https://splunk.company.com:8089" />
                  </Field>
                  <Field label="Splunk API Token">
                    <input type="password" value={settings.splunk_token} onChange={e => set('splunk_token', e.target.value)} className={inputCls} placeholder="••••••••••••••••" />
                  </Field>
                </div>

                {/* Test Connection */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" onClick={testSplunkConnection} disabled={testingConnection}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all disabled:opacity-50">
                    {testingConnection ? <><Wifi size={14} className="animate-pulse" /> Testing...</>
                      : connectionStatus === 'ok'    ? <><CheckCircle2 size={14} className="text-emerald-400" /> Connected</>
                      : connectionStatus === 'error' ? <><WifiOff size={14} className="text-red-400" /> Failed — Retry</>
                      : <><Wifi size={14} /> Test Connection</>}
                  </button>
                  {connectionStatus === 'ok' && <span className="text-xs text-emerald-400">✓ Splunk is reachable</span>}
                  {connectionStatus === 'error' && <span className="text-xs text-red-400">✗ Cannot reach Splunk</span>}
                </div>
                {connectionStatus === 'error' && connectionMessage && (
                  <div className="bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3 text-[11px] text-red-300/80 font-mono">{connectionMessage}</div>
                )}

                <Field label="Available Indexes" hint="One per line. AI uses these to write accurate SPL queries for this client.">
                  <textarea rows={4} value={settings.splunk_indexes} onChange={e => set('splunk_indexes', e.target.value)} className={`${monoCls} resize-y`}
                    placeholder={"index=windows\nindex=network\nindex=dns\nindex=web\nindex=endpoint"} />
                </Field>

                <Field label="Available SourceTypes" hint="Exact Splunk sourcetype names, one per line.">
                  <textarea rows={4} value={settings.splunk_sourcetypes} onChange={e => set('splunk_sourcetypes', e.target.value)} className={`${monoCls} resize-y`}
                    placeholder={"WinEventLog:Security\nXmlWinEventLog:Microsoft-Windows-Sysmon/Operational\npan:traffic\nstream:dns\naccess_combined"} />
                </Field>

                <Field label="Key Fields" hint="Important field names the AI should use in query filters.">
                  <textarea rows={2} value={settings.splunk_key_fields} onChange={e => set('splunk_key_fields', e.target.value)} className={`${monoCls} resize-y`}
                    placeholder={"src_ip, dest_ip, user, host, process_name, CommandLine, Image, EventCode, ParentImage"} />
                </Field>

                <Field label="Additional Schema Notes" hint="Macros, lookup tables, naming conventions, special indexes to avoid, etc.">
                  <textarea rows={3} value={settings.splunk_schema} onChange={e => set('splunk_schema', e.target.value)} className={`${monoCls} resize-y`}
                    placeholder={"Use index=windows for Sysmon (EventCode 1,3,7,11,12,13). Avoid index=_internal.\nAdmin hosts are in lookup admin_hosts.csv."} />
                </Field>
              </div>
            )}

            {/* ── Sentinel ── */}
            {siemTab === 'sentinel' && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-[11px] text-blue-300/80 leading-relaxed">
                  <strong className="text-blue-400">ℹ️ Setup:</strong> The Workspace ID enables KQL generation.
                  Tenant/Client ID and Secret are needed for live KQL execution via the Azure Monitor API.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Log Analytics Workspace ID" hint="Azure Portal → Log Analytics → Properties">
                    <input type="text" value={settings.sentinel_workspace_id} onChange={e => set('sentinel_workspace_id', e.target.value)} className={inputCls} placeholder="a1b2c3d4-..." />
                  </Field>
                  <Field label="Azure Tenant ID">
                    <input type="text" value={settings.sentinel_tenant_id} onChange={e => set('sentinel_tenant_id', e.target.value)} className={inputCls} placeholder="xxxxxxxx-xxxx-..." />
                  </Field>
                  <Field label="App Registration Client ID">
                    <input type="text" value={settings.sentinel_client_id} onChange={e => set('sentinel_client_id', e.target.value)} className={inputCls} placeholder="xxxxxxxx-xxxx-..." />
                  </Field>
                  <Field label="App Client Secret">
                    <input type="password" value={settings.sentinel_client_secret} onChange={e => set('sentinel_client_secret', e.target.value)} className={inputCls} placeholder="••••••••••••" />
                  </Field>
                </div>

                <Field label="Log Analytics Tables & Schema" hint="List the tables available in this workspace with their key fields. AI uses this to write accurate KQL.">
                  <textarea rows={10} value={settings.sentinel_schema} onChange={e => set('sentinel_schema', e.target.value)} className={`${monoCls} resize-y`}
                    placeholder={
                      "SecurityEvent          -- Windows Security Events (EventID, Computer, Account, CommandLine)\n" +
                      "SigninLogs             -- Azure AD Sign-in logs (UserPrincipalName, IPAddress, AppDisplayName)\n" +
                      "AuditLogs              -- Azure AD Audit events\n" +
                      "DeviceProcessEvents    -- MDE process creations (DeviceName, FileName, ProcessCommandLine)\n" +
                      "DeviceNetworkEvents    -- MDE network connections (DeviceName, RemoteIP, RemotePort)\n" +
                      "CommonSecurityLog      -- CEF firewall/proxy logs (SourceIP, DestinationIP, Protocol)\n" +
                      "DnsEvents              -- DNS queries (Computer, Name, QueryType)\n" +
                      "OfficeActivity         -- Microsoft 365 activity (Operation, UserId, ClientIP)"
                    } />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* ── OpenCTI ── */}
        <Section title="OpenCTI Integration" icon={AlertCircle} iconColor="bg-violet-500/15 text-violet-400">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="OpenCTI URL" hint="e.g. https://opencti.company.com">
              <input type="url" value={settings.opencti_url} onChange={e => set('opencti_url', e.target.value)} className={inputCls} placeholder="https://opencti.company.com" />
            </Field>
            <Field label="OpenCTI API Token">
              <input type="password" value={settings.opencti_token} onChange={e => set('opencti_token', e.target.value)} className={inputCls} placeholder="••••••••••••••••" />
            </Field>
          </div>
        </Section>

        {/* ── AI Generation ── */}
        <Section title="AI Generation Settings" icon={Brain} iconColor="bg-purple-500/15 text-purple-400">
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-white/[0.03] border border-glass rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-textprimary">Enable AI Hypothesis Generation</p>
                <p className="text-xs text-textsecondary mt-0.5">Auto-generate hunt hypotheses from OpenCTI threat intel</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.ai_enabled} onChange={e => set('ai_enabled', e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-black/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary" />
              </label>
            </div>
            {settings.ai_enabled && (
              <Field label="Max Daily Hypotheses" hint="Maximum AI-generated hypotheses per day for this client.">
                <input type="number" min="1" max="50" value={isNaN(settings.ai_daily_limit) ? '' : settings.ai_daily_limit}
                  onChange={e => { const v = parseInt(e.target.value); set('ai_daily_limit', isNaN(v) ? '' : v) }}
                  className={`${inputCls} max-w-[160px]`} />
              </Field>
            )}
          </div>
        </Section>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5 disabled:opacity-50">
            <Save size={16} />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
