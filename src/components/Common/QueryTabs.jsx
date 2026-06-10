import { useState } from 'react'
import { useClient } from '../../context/ClientContext'

const TABS = [
  { key: 'splunkSPL', label: 'Splunk SPL', color: 'text-orange-400' },
  { key: 'qradarAQL', label: 'QRadar AQL', color: 'text-blue-400' },
  { key: 'sentinelKQL', label: 'Sentinel KQL', color: 'text-cyan-400' },
]

export const QueryTabs = ({ values, onChange, readOnly = false }) => {
  const { selectedClient } = useClient() || {}
  const [active, setActive] = useState('splunkSPL')

  const hasSplunk = selectedClient?.splunk_url
  const hasSentinel = selectedClient?.sentinel_workspace_id

  // Filter tabs: show only configured SIEM queries. Fallback to all if both or neither is set.
  const filteredTabs = TABS.filter(tab => {
    if (hasSplunk && !hasSentinel) {
      return tab.key === 'splunkSPL'
    }
    if (hasSentinel && !hasSplunk) {
      return tab.key === 'sentinelKQL'
    }
    return true
  })

  const activeTab = filteredTabs.some(t => t.key === active)
    ? active
    : (filteredTabs[0]?.key || 'splunkSPL')

  return (
    <div className="border border-[#2a2d3e] rounded-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-[#2a2d3e] bg-[#0f1117]">
        {filteredTabs.map(tab => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-mono font-medium
              transition-colors border-b-2
              ${activeTab === tab.key
                ? `border-indigo-500 ${tab.color} bg-[#1a1d27]`
                : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {filteredTabs.map(tab => (
        activeTab === tab.key && (
          <div key={tab.key} className="relative">
            {readOnly ? (
              <pre className="p-4 font-mono text-sm text-gray-300
                bg-[#0f1117] min-h-[120px] overflow-auto whitespace-pre-wrap resize-y">
                {values[tab.key] || '-- No query defined --'}
              </pre>
            ) : (
              <textarea
                className="w-full p-4 font-mono text-sm text-gray-300
                  bg-[#0f1117] min-h-[120px] resize-y outline-none
                  placeholder-gray-600"
                placeholder={`Enter ${tab.label} query here...`}
                value={values[tab.key] || ''}
                onChange={e => onChange(tab.key, e.target.value)}
              />
            )}
            {readOnly && values[tab.key] && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(values[tab.key])}
                className="absolute top-2 right-2 px-2 py-1 text-xs
                  bg-indigo-600 hover:bg-indigo-700 text-white rounded"
              >
                Copy
              </button>
            )}
          </div>
        )
      ))}
    </div>
  )
}
