import { useState } from 'react'

const TABS = [
  { key: 'splunkSPL', label: 'Splunk SPL', color: 'text-orange-400' },
  { key: 'qradarAQL', label: 'QRadar AQL', color: 'text-blue-400' },
  { key: 'sentinelKQL', label: 'Sentinel KQL', color: 'text-cyan-400' },
]

export const QueryTabs = ({ values, onChange, readOnly = false }) => {
  const [active, setActive] = useState('splunkSPL')

  return (
    <div className="border border-[#2a2d3e] rounded-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-[#2a2d3e] bg-[#0f1117]">
        {TABS.map(tab => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-mono font-medium
              transition-colors border-b-2
              ${active === tab.key
                ? `border-indigo-500 ${tab.color} bg-[#1a1d27]`
                : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {TABS.map(tab => (
        active === tab.key && (
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
