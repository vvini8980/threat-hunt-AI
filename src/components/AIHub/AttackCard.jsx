import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert, BookOpen, Link as LinkIcon, Target, Activity, Copy } from 'lucide-react';

const AttackCard = ({ attack, onViewHypo, savedLibrary }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localHypotheses, setLocalHypotheses] = useState(attack.hypotheses || []);

  useEffect(() => {
    setLocalHypotheses(attack.hypotheses || []);
  }, [attack.hypotheses]);

  const handleQueryChange = (index, newQuery) => {
    const updated = [...localHypotheses];
    updated[index] = { ...updated[index], splunkSPL: newQuery };
    setLocalHypotheses(updated);
  };

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden shadow-lg transition-all">
      {/* Header (Click to expand) */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 bg-[#1e2130] hover:bg-[#252836] transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="bg-red-500/10 p-2 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-white">{attack.name}</h3>
            <span className="text-xs font-semibold text-gray-500 mt-1">First detected: {attack.date}</span>
          </div>
        </div>
        <div className="text-gray-400">
          {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 sm:p-6 border-t border-[#2a2d3e] flex flex-col gap-6 animate-[slideDown_0.2s_ease-out] min-w-0">
          
          {/* Metadata Grid */}
          {attack.metadata && (
            <div className="bg-[#0f1117] p-4 sm:p-5 rounded-lg border border-[#2a2d3e] min-w-0 shadow-inner">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                {Object.entries({
                  'Threat Actor': attack.metadata.actor,
                  'Aliases': attack.metadata.aliases,
                  'Origin': attack.metadata.origin,
                  'Active Since': attack.metadata.activeSince,
                  'Target Sector': attack.metadata.targetSector,
                  'Dwell Time': attack.metadata.dwellTime,
                  'Sophistication': attack.metadata.sophistication,
                  'CISA Alert': attack.metadata.cisaAlert,
                  'Confidence': attack.metadata.confidence
                }).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{key}</span>
                    <span className="text-sm text-gray-200 font-medium mt-0.5 break-words">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* POC / Study Details */}
          <div className="flex flex-col gap-4 mt-2 min-w-0">
            
            {/* Hypothesis */}
            <div className="bg-[#0f1117] p-4 rounded-lg border border-[#2a2d3e] min-w-0">
              <h5 className="text-white font-bold mb-2">Threat Hunting Hypothesis</h5>
              <p className="text-gray-300 leading-relaxed text-sm break-words whitespace-pre-wrap">{attack.poc.hypothesis}</p>
            </div>

            {/* Log Sources Table */}
            {attack.poc.logSources && attack.poc.logSources.length > 0 && (
              <div className="bg-[#0f1117] p-4 rounded-lg border border-[#2a2d3e] overflow-x-auto max-w-full">
                <h5 className="text-white font-bold mb-3">Log Sources & Detection Points</h5>
                <div className="min-w-max md:min-w-0">
                  <table className="w-full text-left border-collapse text-sm table-fixed">
                    <thead>
                      <tr className="bg-[#1a1d27] border-b border-[#2a2d3e]">
                        <th className="py-2 px-3 text-gray-300 font-semibold w-1/4">Log Source</th>
                        <th className="py-2 px-3 text-gray-300 font-semibold w-1/3">Indicators to Hunt</th>
                        <th className="py-2 px-3 text-gray-300 font-semibold w-[41%]">Example Query (Splunk/KQL)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attack.poc.logSources.map((log, idx) => (
                        <tr key={idx} className="border-b border-[#2a2d3e]/50 hover:bg-[#1a1d27]/50 transition-colors">
                          <td className="py-2 px-3 text-indigo-400 font-medium break-words align-top whitespace-pre-wrap">{log.source}</td>
                          <td className="py-2 px-3 text-gray-400 break-words align-top whitespace-pre-wrap">{log.indicator}</td>
                          <td className="py-2 px-3 align-top break-all">
                            <code className="text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded font-mono text-xs block break-all whitespace-pre-wrap">
                              {log.query}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hunting Steps */}
            {attack.poc.huntingSteps && attack.poc.huntingSteps.length > 0 && (
              <div className="bg-[#0f1117] p-4 rounded-lg border border-[#2a2d3e] min-w-0">
                <h5 className="text-white font-bold mb-3">Hunting Steps</h5>
                <div className="flex flex-col gap-3 min-w-0">
                  {attack.poc.huntingSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-3 min-w-0">
                      <div className="mt-1 flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <span className="text-gray-300 text-sm leading-relaxed break-words">{step.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Triage Query */}
            {attack.poc.triageQuery && (
              <div className="bg-[#0a0c10] rounded-lg border border-[#2a2d3e] overflow-hidden min-w-0">
                <div className="bg-[#1a1d27] px-4 py-2 border-b border-[#2a2d3e] flex items-center justify-between">
                  <span className="text-xs text-gray-300 font-bold">Example Splunk Query for Initial Triage</span>
                  <span className="text-xs text-gray-500 font-mono">splunk</span>
                </div>
                <div className="p-4 overflow-y-auto custom-scrollbar max-w-full resize-y min-h-[80px] max-h-[500px]">
                  <pre className="text-blue-300 font-mono text-xs whitespace-pre-wrap break-words">
                    {attack.poc.triageQuery}
                  </pre>
                </div>
              </div>
            )}

            {/* False Positives */}
            {attack.poc.falsePositives && (
              <div className="bg-red-900/10 p-4 rounded-lg border border-red-500/20 min-w-0">
                <h5 className="text-red-400 font-bold mb-2">False Positive Considerations</h5>
                <p className="text-gray-300 leading-relaxed text-sm break-words">{attack.poc.falsePositives}</p>
              </div>
            )}

          </div>

          {/* References */}
          {attack.references && attack.references.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-blue-400">
                <LinkIcon className="w-4 h-4" />
                <h4 className="font-bold uppercase tracking-wider text-xs">Reference URLs</h4>
              </div>
              <div className="flex flex-col gap-1">
                {attack.references.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:text-blue-300 hover:underline truncate">
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Specific IOCs */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-gray-400 uppercase tracking-wider text-xs">Targeted IOCs</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {attack.iocs.map((ioc, i) => (
                <div key={i} className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d3e] flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-xs font-bold">{ioc.type}</span>
                    <span className="text-white font-mono text-sm truncate">{ioc.value}</span>
                  </div>
                  <span className="text-gray-500 text-xs pl-1">{ioc.context}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Specific Hypotheses */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2 text-green-400">
              <Target className="w-5 h-5" />
              <h4 className="font-bold uppercase tracking-wider text-sm">Actionable Hypotheses</h4>
            </div>
            <div className="flex flex-col gap-3">
              {localHypotheses.map((hypo, i) => (
                <div key={i} className="bg-[#0f1117] border border-[#2a2d3e] p-4 rounded-xl hover:border-green-500/30 transition-colors">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex flex-col gap-2 flex-1 min-w-0 w-full">
                      <h5 className="text-white font-bold text-md">{hypo.hypoName}</h5>
                      <p className="text-sm text-gray-400 leading-relaxed break-words">{hypo.description}</p>
                      
                      <div className="mt-2 flex flex-col gap-1 w-full">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Activity className="w-3 h-3"/> Detection Query</span>
                        <textarea
                          value={hypo.splunkSPL}
                          onChange={(e) => handleQueryChange(i, e.target.value)}
                          className="w-full bg-[#1a1d27] text-green-400 p-3 rounded-lg text-xs font-mono border border-[#2a2d3e] focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/50 resize-y min-h-[60px] whitespace-pre-wrap break-all custom-scrollbar"
                          rows={2}
                          spellCheck={false}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-2 sm:mt-0 self-start">
                      {savedLibrary && savedLibrary.has(hypo.hypoName) ? (
                        <button 
                          disabled
                          className="w-full shrink-0 bg-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold shadow-lg opacity-75 cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          In Library
                        </button>
                      ) : (
                        <button 
                          onClick={() => onViewHypo(hypo)}
                          className="w-full shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-colors"
                        >
                          Use
                        </button>
                      )}
                      <button 
                        onClick={() => navigator.clipboard.writeText(hypo.splunkSPL)}
                        className="w-full shrink-0 bg-[#2a2d3e] hover:bg-[#3b3e54] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                        title="Copy SPL"
                      >
                        <Copy className="w-4 h-4" /> Copy
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default AttackCard;
