import React, { useState } from 'react'
import { useClient } from '../context/ClientContext'

const API_BASE_URL = 'http://localhost:8000'

const QueryChecker = () => {
  const { currentClient } = useClient()
  const [query, setQuery] = useState('')
  const [targetSiem, setTargetSiem] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [aiMode, setAiMode] = useState('cloud') // 'cloud' or 'local'
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)

  const handleTestQuery = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_BASE_URL}/hunt/test-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: currentClient?.id || '',
          query: query,
          earliest: '-30d',
          latest: 'now',
          platform: targetSiem
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Error executing query')
      }

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeLogs = async () => {
    if (aiMode === 'local' && !ollamaUrl.trim()) return
    if (!result || !result.events) return

    setAnalyzing(true)
    setAnalysisResult(null)
    setError(null)

    const endpoint = aiMode === 'cloud' ? '/hunt/analyze-logs-cloud' : '/hunt/analyze-logs-local'
    const bodyPayload = {
      query: query,
      // If cloud, we can safely send more events since Gemini handles massive contexts
      events: aiMode === 'cloud' ? result.events.slice(0, 50) : result.events.slice(0, 3)
    }

    if (aiMode === 'cloud' && geminiApiKey.trim()) {
      bodyPayload.gemini_api_key = geminiApiKey.trim()
    } else if (aiMode === 'local') {
      bodyPayload.ollama_url = ollamaUrl.trim()
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Error analyzing logs')
      }

      setAnalysisResult(data.analysis)
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // Determine headers dynamically from the first event object
  const getHeaders = () => {
    if (!result || !result.events || result.events.length === 0) return []
    // Get all unique keys across the first 5 events to build columns
    const keys = new Set()
    result.events.slice(0, 5).forEach(ev => {
      Object.keys(ev).forEach(k => {
        if (!k.startsWith('_')) keys.add(k)
      })
    })
    return Array.from(keys)
  }

  const headers = getHeaders()

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-bg-secondary p-6 rounded-xl border border-border-light shadow-sm">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Query Checker</h1>
        <p className="text-text-secondary mb-6 text-sm">
          Lightweight sandbox to test KQL or SPL queries. Results are not saved.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-text-primary mb-2">
            Enter Query
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search * | summarize count() by Type..."
            className="w-full h-40 bg-bg-tertiary border border-border-light rounded-lg p-4 font-mono text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
          />
        </div>

        <div className="flex justify-between items-center">
          <div className="flex bg-bg-tertiary rounded-lg p-1 border border-border-light">
            <button
              onClick={() => setTargetSiem('auto')}
              className={`px-4 py-1 text-xs font-medium rounded-md transition-colors ${targetSiem === 'auto' ? 'bg-accent-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Auto-Detect
            </button>
            <button
              onClick={() => setTargetSiem('splunk')}
              className={`px-4 py-1 text-xs font-medium rounded-md transition-colors ${targetSiem === 'splunk' ? 'bg-emerald-600 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Splunk
            </button>
            <button
              onClick={() => setTargetSiem('sentinel')}
              className={`px-4 py-1 text-xs font-medium rounded-md transition-colors ${targetSiem === 'sentinel' ? 'bg-blue-600 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Sentinel
            </button>
          </div>
          <button
            onClick={handleTestQuery}
            disabled={loading || !query.trim()}
            className="bg-accent-primary hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Testing...</span>
              </>
            ) : (
              <span>Run Query</span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-xl">
          <span className="font-bold mr-2">Error:</span> {error}
        </div>
      )}

      {result && (
        <div className="bg-bg-secondary p-6 rounded-xl border border-border-light shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">Results Preview</h2>
            <div className="flex items-center space-x-4 text-sm">
              <span className="px-3 py-1 rounded-md bg-bg-tertiary text-text-secondary border border-border-light font-mono">
                Platform: {result.platform.toUpperCase()}
              </span>
              <span className="px-3 py-1 rounded-md bg-bg-tertiary text-text-secondary border border-border-light">
                Returned: <span className="font-bold text-text-primary">{result.returned_events}</span> / {result.total_events}
              </span>
            </div>
          </div>

          {result.events.length === 0 ? (
            <div className="text-center py-12 text-text-secondary bg-bg-tertiary rounded-lg border border-dashed border-border-light">
              No results found for this query.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-light">
              <table className="w-full text-left text-sm text-text-secondary">
                <thead className="bg-bg-tertiary text-text-primary uppercase text-xs">
                  <tr>
                    {headers.map(header => (
                      <th key={header} className="px-4 py-3 border-b border-border-light whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.events.map((ev, i) => (
                    <tr key={i} className="border-b border-border-light hover:bg-bg-tertiary/50 transition-colors">
                      {headers.map(header => (
                        <td key={header} className="px-4 py-3 truncate max-w-xs" title={String(ev[header] || '')}>
                          {String(ev[header] || '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* AI ANALYSIS SECTION */}
          {result.events.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border-light space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text-primary flex items-center space-x-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span>AI Log Analysis</span>
                </h3>
                
                {/* AI Mode Toggle Switch */}
                <div className="flex bg-bg-tertiary rounded-lg p-1 border border-border-light">
                  <button
                    onClick={() => setAiMode('cloud')}
                    className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${aiMode === 'cloud' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Cloud AI (Fast)
                  </button>
                  <button
                    onClick={() => setAiMode('local')}
                    className={`px-4 py-1 text-sm font-medium rounded-md transition-colors ${aiMode === 'local' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Local AI (Private)
                  </button>
                </div>
              </div>

              <p className="text-sm text-text-secondary">
                {aiMode === 'cloud' 
                  ? "Use Google Gemini 2.5 Flash to instantly analyze your logs. Provide your own API key below to override the backend default."
                  : "Send these raw logs to your local AI engine (like Ollama on Oracle Cloud) for an intelligent breakdown without sending data to a third-party cloud."}
              </p>
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                {aiMode === 'cloud' ? (
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter Gemini API Key (Optional if configured in backend)"
                    className="flex-1 bg-bg-tertiary border border-border-light rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="e.g. http://1.2.3.4:11434"
                    className="flex-1 bg-bg-tertiary border border-border-light rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                )}
                
                <button
                  onClick={handleAnalyzeLogs}
                  disabled={analyzing || (aiMode === 'local' && !ollamaUrl.trim())}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {analyzing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <span>{aiMode === 'cloud' ? 'Analyze with Gemini' : 'Analyze with Local AI'}</span>
                  )}
                </button>
              </div>

              {analysisResult && (
                <div className="mt-4 p-4 bg-bg-tertiary border border-purple-500/30 rounded-lg shadow-inner">
                  <h4 className="text-xs font-bold text-purple-400 uppercase mb-2 tracking-wider">AI Analyst Report</h4>
                  <div className="text-text-primary text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {analysisResult}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default QueryChecker
