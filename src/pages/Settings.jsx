import { useState, useEffect } from 'react'
import { Save, Bell, Brain, Key, Clock } from 'lucide-react'
import { useClient } from '../context/ClientContext'

export default function Settings() {
  const { selectedClient } = useClient()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    notification_email: '',
    report_time: '09:00',
    ai_enabled: true,
    ai_daily_limit: 5
  })

  // Load from local storage for demonstration
  useEffect(() => {
    if (selectedClient) {
      const saved = localStorage.getItem(`settings_${selectedClient.id}`)
      if (saved) {
        setSettings(JSON.parse(saved))
      } else {
        // defaults
        setSettings({
          notification_email: selectedClient.contact_email || '',
          report_time: '09:00',
          ai_enabled: true,
          ai_daily_limit: 5
        })
      }
    }
  }, [selectedClient])

  const handleSave = (e) => {
    e.preventDefault()
    setLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem(`settings_${selectedClient.id}`, JSON.stringify(settings))
      alert('Settings saved successfully.')
      setLoading(false)
    }, 500)
  }

  if (!selectedClient) {
    return (
      <div className="flex h-full items-center justify-center text-textsecondary">
        Please select a client from the top bar to view settings.
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Settings - {selectedClient.name}</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Notifications */}
        <div className="glass-panel border border-glass rounded-2xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 transition-transform group-hover:scale-110 duration-500 pointer-events-none">
            <Bell size={120} />
          </div>
          <h3 className="relative z-10 text-xl font-bold text-textprimary mb-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent-primary/20 text-accent-primary shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]">
              <Bell size={20} />
            </div>
            Notification Preferences
          </h3>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Alert Email Address</label>
              <input
                type="email"
                required
                value={settings.notification_email}
                onChange={(e) => setSettings({...settings, notification_email: e.target.value})}
                className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all shadow-inner"
                placeholder="soc@client.com"
              />
            </div>
          </div>
        </div>

        {/* Reporting */}
        <div className="glass-panel border border-glass rounded-2xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 transition-transform group-hover:scale-110 duration-500 pointer-events-none">
            <Clock size={120} />
          </div>
          <h3 className="relative z-10 text-xl font-bold text-textprimary mb-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-500 shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]">
              <Clock size={20} />
            </div>
            Automated Reporting
          </h3>
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Daily Report Delivery Time</label>
              <input
                type="time"
                required
                value={settings.report_time}
                onChange={(e) => setSettings({...settings, report_time: e.target.value})}
                className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all shadow-inner"
              />
              <p className="text-xs text-textsecondary mt-3">Reports will be generated and sent at this time in UTC.</p>
            </div>
          </div>
        </div>

        {/* AI Generation */}
        <div className="glass-panel border border-glass rounded-2xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 transition-transform group-hover:scale-110 duration-500 pointer-events-none">
            <Brain size={120} />
          </div>
          <h3 className="relative z-10 text-xl font-bold text-textprimary mb-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shadow-[inset_0_0_10px_rgba(168,85,247,0.2)]">
              <Brain size={20} />
            </div>
            AI Generation Settings
          </h3>
          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-glass">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai_enabled}
                  onChange={(e) => setSettings({...settings, ai_enabled: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
              </label>
              <span className="text-sm font-semibold tracking-wide text-textprimary">Enable AI Hypothesis Generation</span>
            </div>

            {settings.ai_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-glass">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-textsecondary mb-2">Max Daily Hypotheses</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.ai_daily_limit}
                    onChange={(e) => setSettings({...settings, ai_daily_limit: parseInt(e.target.value)})}
                    className="w-full bg-black/20 border border-glass rounded-xl px-4 py-3 text-sm text-textprimary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all shadow-inner"
                  />
                  <p className="text-xs text-textsecondary mt-3">Maximum number of AI-generated hypotheses to create per day.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-accent-primary hover:bg-accent-secondary text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-accent-primary/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Save size={18} />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
