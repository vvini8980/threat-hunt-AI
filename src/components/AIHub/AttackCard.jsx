import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, ShieldAlert, Link as LinkIcon,
  ArrowRight, Search, CheckCircle, XCircle, Loader2, Copy,
  ExternalLink, Terminal, ListChecks, Table2, Target, Zap
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { useClient } from '../../context/ClientContext';

// ── IOC type colour config ───────────────────────────────────────────────────
const IOC_CONFIG = {
  'IP':         { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'IP' },
  'IP ADDRESS': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'IP' },
  'DOMAIN':     { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   label: 'Domain' },
  'HOSTNAME':   { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   label: 'Host' },
  'HASH':       { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Hash' },
  'MD5':        { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'MD5' },
  'SHA256':     { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'SHA256' },
  'SHA-256':    { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'SHA256' },
  'FILE':       { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', label: 'File' },
  'FILENAME':   { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', label: 'File' },
  'URL':        { color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   label: 'URL' },
  'COMMAND':    { color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/20',     label: 'CMD' },
  'EMAIL':      { color: 'text-pink-400',   bg: 'bg-pink-500/10',   border: 'border-pink-500/20',   label: 'Email' },
};
const getIOCConfig = (type) =>
  IOC_CONFIG[type?.toUpperCase()] || { color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10', label: type };

// ── Inline IOC hunt result ───────────────────────────────────────────────────
const IOCHuntResult = ({ result, onClose }) => {
  const [showQuery, setShowQuery] = useState(false);
  const total   = result?.total_events ?? 0;
  const events  = result?.events ?? [];
  const hasHits = total > 0 && !result?.error;
  const err     = result?.error;

  return (
    <div className={`mt-2 rounded-xl border overflow-hidden text-sm ${
      err     ? 'border-amber-500/30' :
      hasHits ? 'border-red-500/30'   : 'border-emerald-500/30'
    }`}>
      <div className={`flex items-center justify-between px-4 py-2.5 font-bold ${
        err     ? 'bg-amber-500/10 text-amber-400' :
        hasHits ? 'bg-red-500/10    text-red-400'  : 'bg-emerald-500/10 text-emerald-400'
      }`}>
        <div className="flex items-center gap-2">
          {err || hasHits ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {err
            ? `Splunk error: ${err}`
            : hasHits
              ? `🚨 ${total} MATCH${total !== 1 ? 'ES' : ''} FOUND — Investigate!`
              : '✅ Clean — no matches found in Splunk'}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowQuery(v => !v)}
            className="text-xs opacity-60 hover:opacity-100 underline underline-offset-2 transition-opacity">
            {showQuery ? 'Hide' : 'View'} Query
          </button>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity text-base leading-none">✕</button>
        </div>
      </div>

      {showQuery && (
        <div className="bg-[#0a0c10] px-4 py-3 border-t border-[#2a2d3e]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Splunk Query Used</span>
            <button onClick={() => navigator.clipboard.writeText(result.query_used)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="text-blue-300 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed">
            {result.query_used}
          </pre>
        </div>
      )}

      {hasHits && events.length > 0 && (
        <div className="overflow-x-auto max-h-56 custom-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-[#1a1d27]">
              <tr>
                {Object.keys(events[0] || {})
                  .filter(k => !k.startsWith('_') || k === '_time')
                  .slice(0, 8)
                  .map(k => (
                    <th key={k} className="py-1.5 px-3 text-gray-400 font-semibold border-b border-[#2a2d3e] whitespace-nowrap">{k}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 20).map((ev, i) => (
                <tr key={i} className="border-b border-[#2a2d3e]/40 hover:bg-white/[0.02]">
                  {Object.entries(ev)
                    .filter(([k]) => !k.startsWith('_') || k === '_time')
                    .slice(0, 8)
                    .map(([k, v]) => (
                      <td key={k} title={String(v)}
                        className="py-1.5 px-3 text-gray-300 font-mono whitespace-nowrap max-w-[180px] truncate">
                        {String(v)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── IOC Indicator card ────────────────────────────────────────────────────────
export const IOCCard = ({ ioc, clientId }) => {
  const cfg = getIOCConfig(ioc.type);
  const [hunting, setHunting] = useState(false);
  const [result,  setResult]  = useState(null);

  const handleHunt = async () => {
    if (!clientId) { alert('Please select a client in the top bar first.'); return; }
    setHunting(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/hunt/ioc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          ioc_type:  ioc.type,
          ioc_value: ioc.value,
          earliest:  '-30d',
          latest:    'now',
        }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ error: e.message, total_events: 0, events: [] });
    } finally {
      setHunting(false);
    }
  };

  const hitCount = result?.total_events ?? 0;

  return (
    <div>
      <div className={`flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
          {cfg.label}
        </span>
        <span className={`font-mono text-sm font-semibold flex-1 min-w-[200px] break-all ${cfg.color}`}>
          {ioc.value}
        </span>
        <div className="flex-1 min-w-[150px] hidden 2xl:block">
          {ioc.context  && <p className="text-xs text-gray-400 truncate" title={ioc.context}>{ioc.context}</p>}
          {ioc.description && <p className="text-xs text-gray-400 truncate" title={ioc.description}>{ioc.description}</p>}
          {(ioc.author || ioc.valid_until) && (
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 font-medium">
              {ioc.author && <span>Source: {ioc.author}</span>}
              {ioc.valid_until && <span>• Valid until: {ioc.valid_until.substring(0,10)}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto w-full sm:w-auto">
          <button onClick={() => navigator.clipboard.writeText(ioc.value)}
            title="Copy IOC value"
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {result ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 cursor-default">
              <CheckCircle className="w-3.5 h-3.5" /> Hunted: {hitCount > 0 ? `${hitCount} Hit${hitCount !== 1 ? 's' : ''}` : 'Clean'}
            </div>
          ) : (
            <button
              onClick={handleHunt}
              disabled={hunting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all bg-indigo-600/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/25 hover:text-indigo-300 disabled:opacity-50"
            >
              {hunting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Hunting...</> : <><Search className="w-3.5 h-3.5" /> Hunt</>}
            </button>
          )}
        </div>
      </div>
      {result && <IOCHuntResult result={result} onClose={() => setResult(null)} />}
    </div>
  );
};

// ── Confidence badge ─────────────────────────────────────────────────────────
export const ConfidenceBadge = ({ confidence = '' }) => {
  const upper = confidence.toUpperCase();
  if (upper.includes('HIGH') || upper.startsWith('9') || upper.startsWith('8'))
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">🔴 {confidence}</span>;
  if (upper.includes('MEDIUM') || upper.startsWith('7') || upper.startsWith('6'))
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">🟡 {confidence}</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20">🔵 {confidence}</span>;
};

// ── Triage Query section ─────────────────────────────────────────────────────
export const TriageQueryBlock = ({ query, onPush }) => {
  const [copied, setCopied] = useState(false);
  if (!query) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-[#0f1117] rounded-xl border border-[#2a2d3e] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2d3e] bg-[#1a1d27]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Master Triage Query (Splunk SPL)</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-orange-400 transition-colors">
            <Copy className="w-3 h-3" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {onPush && (
            <button
              onClick={onPush}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded border bg-indigo-600/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30 hover:text-indigo-300 transition-all text-xs font-bold"
            >
              <ArrowRight className="w-3 h-3" /> Push
            </button>
          )}
        </div>
      </div>
      <pre className="px-4 py-3 text-orange-300 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
        {query}
      </pre>
    </div>
  );
};

// ── Hunting Steps section ────────────────────────────────────────────────────
export const HuntingSteps = ({ steps }) => {
  if (!steps || steps.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-emerald-400" />
        <p className="text-sm font-bold text-white">Hunting Steps</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {steps.length} steps
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 bg-[#0f1117] p-3 rounded-xl border border-[#2a2d3e]">
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">{step.step}</p>
              {step.description && (
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Log Sources table ────────────────────────────────────────────────────────
export const LogSourcesTable = ({ sources }) => {
  if (!sources || sources.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Table2 className="w-4 h-4 text-blue-400" />
        <p className="text-sm font-bold text-white">Log Sources & Detection Indicators</p>
      </div>
      <div className="rounded-xl border border-[#2a2d3e] overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#1e2130]">
            <tr className="border-b border-[#2a2d3e]">
              <th className="px-4 py-2.5 text-gray-500 font-semibold uppercase tracking-wider w-1/4">Log Source</th>
              <th className="px-4 py-2.5 text-gray-500 font-semibold uppercase tracking-wider w-1/3">Detection Indicator</th>
              <th className="px-4 py-2.5 text-gray-500 font-semibold uppercase tracking-wider">Query / Signature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3e]/50 bg-[#0f1117]">
            {sources.map((src, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 align-top">
                  <span className="font-bold text-blue-400 whitespace-pre-wrap leading-snug">{src.source}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="text-gray-300 whitespace-pre-wrap leading-snug">{src.indicator}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <code className="font-mono text-orange-300 whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                    {src.query}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Sub-Hypothesis card with individual Push button ──────────────────────────
const HypoCard = ({ hypo, saved, onViewHypo }) => {
  const isSaved = saved && saved.has(hypo.hypoName);
  return (
    <div className={`p-3 rounded-xl border transition-colors ${
      isSaved ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0f1117] border-[#2a2d3e] hover:border-indigo-500/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {hypo.mitreId}
            </span>
            <span className="text-[10px] text-gray-500">{hypo.tactic}</span>
          </div>
          <p className="text-sm font-semibold text-white leading-tight">{hypo.hypoName}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{hypo.description}</p>
        </div>
        {isSaved ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold flex-shrink-0">
            <CheckCircle className="w-3 h-3" /> Saved
          </span>
        ) : (
          <button
            onClick={() => onViewHypo(hypo)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 hover:text-indigo-300 transition-all"
          >
            <ArrowRight className="w-3 h-3" /> Push
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main card ────────────────────────────────────────────────────────────────
const AttackCard = ({ attack, onViewHypo, savedLibrary, clientId }) => {
  const { selectedClient } = useClient() || {};
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSplunk = selectedClient?.splunk_url;
  const hasSentinel = selectedClient?.sentinel_workspace_id;
  const showSplunkTriage = hasSplunk || !hasSentinel;

  const iocCount  = (attack.iocs || []).length;
  const hypoCount = (attack.hypotheses || []).length;
  const savedCount = (attack.hypotheses || []).filter(
    h => savedLibrary && savedLibrary.has(h.hypoName)
  ).length;

  const confidenceStr = attack.metadata?.confidence || '';
  const isHighConfidence = confidenceStr.toUpperCase().includes('HIGH');

  return (
    <React.Fragment>
      {/* ── Summary Row ── */}
      <tr 
        onClick={() => setIsExpanded(v => !v)}
        className={`transition-colors cursor-pointer group border-b border-[#2a2d3e]/50 ${
          isHighConfidence ? 'bg-red-500/[0.03] hover:bg-red-500/[0.06]' : 'hover:bg-white/[0.02]'
        }`}
      >
        <td className="px-4 py-4 max-w-[250px] sm:max-w-[300px]">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldAlert className={`flex-shrink-0 w-4 h-4 ${isHighConfidence ? 'text-red-400' : 'text-amber-400'}`} />
            <span className="font-bold text-white group-hover:text-indigo-400 transition-colors truncate block">{attack.name}</span>
          </div>
        </td>
        <td className="px-4 py-4">
          {attack.metadata?.actor ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 whitespace-nowrap">
              {attack.metadata.actor}
            </span>
          ) : <span className="text-gray-600">—</span>}
        </td>
        <td className="px-4 py-4">
          <span className="text-xs text-gray-400 whitespace-nowrap">{attack.date || 'Unknown'}</span>
        </td>
        <td className="px-4 py-4">
          <span className="text-xs text-indigo-300 font-medium whitespace-nowrap">
            {(() => {
              const val = attack.generated_at || attack.date;
              if (!val) return '—';
              const d = new Date(val);
              if (isNaN(d.getTime())) return val;
              return d.toLocaleString([], {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });
            })()}
          </span>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            {iocCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 whitespace-nowrap">
                {iocCount} IOCs
              </span>
            )}
            {hypoCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                {hypoCount - savedCount} hunts
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-4 text-right">
          <div className="flex items-center justify-end gap-3">
            {attack.metadata?.confidence && (
              <ConfidenceBadge confidence={attack.metadata.confidence} />
            )}
            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
          </div>
        </td>
      </tr>

      {/* ── Expanded intel content ── */}
      {isExpanded && (
        <tr className="bg-[#12141c]">
          <td colSpan="6" className="p-0 border-b border-[#2a2d3e]">
            <div className="p-4 sm:p-6 grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (Intel & Context) */}
              <div className="2xl:col-span-7 flex flex-col gap-6">
                
                {/* 1. Threat Actor Profile */}
                {attack.metadata && (
                  <div className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Threat Actor Profile</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                      {[
                        ['Actor',          attack.metadata.actor],
                        ['Aliases',        attack.metadata.aliases],
                        ['Origin',         attack.metadata.origin],
                        ['Active Since',   attack.metadata.activeSince],
                        ['Targets',        attack.metadata.targetSector],
                        ['Dwell Time',     attack.metadata.dwellTime],
                        ['Sophistication', attack.metadata.sophistication],
                        ['CISA Alert',     attack.metadata.cisaAlert],
                        ['Confidence',     attack.metadata.confidence],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{k}</span>
                          <p className="text-sm text-gray-200 font-medium mt-0.5 break-words truncate" title={v}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Intel Summary */}
                {attack.poc?.hypothesis && (
                  <div className="bg-[#0f1117] p-4 rounded-xl border border-[#2a2d3e]">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Intel Summary & Attack Chain</p>
                    <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                      {attack.poc.hypothesis}
                    </div>
                  </div>
                )}

                {/* 3. Log Sources Table */}
                <LogSourcesTable sources={attack.poc?.logSources} />

                {/* 4. Reference URLs */}
                {attack.references?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Reference URLs</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {attack.references.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline break-all">
                          <ExternalLink className="w-3 h-3 shrink-0" />{url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (Hunting & Operations) */}
              <div className="2xl:col-span-5 flex flex-col gap-6">
                
                {/* 5. Sub-Hypotheses (Hunts) */}
                {hypoCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-indigo-400" />
                      <p className="text-sm font-bold text-white">Ready-to-Use Hunt Hypotheses</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {hypoCount} hypotheses
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                      {attack.hypotheses.map((hypo, i) => (
                        <HypoCard
                          key={i}
                          hypo={hypo}
                          saved={savedLibrary}
                          onViewHypo={(h) => {
                            const richThreatActor = {
                              actor: attack.metadata?.actor || 'Unknown',
                              aliases: attack.metadata?.aliases || 'N/A',
                              origin: attack.metadata?.origin || 'N/A',
                              activeSince: attack.metadata?.activeSince || 'N/A',
                              targets: attack.metadata?.targetSector || 'N/A',
                              dwellTime: attack.metadata?.dwellTime || 'N/A',
                              sophistication: attack.metadata?.sophistication || 'N/A',
                              cisaAlert: attack.metadata?.cisaAlert || 'None',
                              confidence: attack.metadata?.confidence || 'HIGH'
                            };
                            
                            const enrichedHypo = {
                              ...h,
                              hypoName: `${attack.name}: ${h.hypoName}`,
                              isRichFormat: true,
                              threatActor: richThreatActor,
                              intelSummary: attack.poc?.hypothesis || h.description || 'No summary available.',
                              iocs: attack.iocs || [],
                              logSources: attack.poc?.logSources || [],
                              huntingSteps: attack.poc?.huntingSteps || [],
                              triageQuery: attack.poc?.triageQuery || h.splunkSPL || '',
                              falsePositives: attack.poc?.falsePositives || h.falsePositiveRisk || '',
                              references: attack.references || [],
                              lastSeen: attack.date || 'Current',
                              confidence: attack.metadata?.confidence || 'HIGH',
                              source: attack.metadata?.origin || 'Proactive Intel',
                              actorContext: JSON.stringify(richThreatActor),
                              description: attack.poc?.hypothesis || 'N/A'
                            };
                            onViewHypo(enrichedHypo);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. IOCs */}
                {attack.iocs?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="w-4 h-4 text-orange-400" />
                      <p className="text-sm font-bold text-white">Indicators of Compromise</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        {attack.iocs.length} IOCs
                      </span>
                      {!clientId && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full ml-1">
                          ⚠ Select a client to Hunt
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {attack.iocs.map((ioc, i) => (
                        <IOCCard key={i} ioc={ioc} clientId={clientId} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. Hunting Steps */}
                <HuntingSteps steps={attack.poc?.huntingSteps} />

                {/* 8. Triage Query */}
                {showSplunkTriage && (
                  <TriageQueryBlock 
                    query={attack.poc?.triageQuery} 
                    onPush={() => {
                      const richThreatActor = {
                        actor: attack.metadata?.actor || 'Unknown',
                        aliases: attack.metadata?.aliases || 'N/A',
                        origin: attack.metadata?.origin || 'N/A',
                        activeSince: attack.metadata?.activeSince || 'N/A',
                        targets: attack.metadata?.targetSector || 'N/A',
                        dwellTime: attack.metadata?.dwellTime || 'N/A',
                        sophistication: attack.metadata?.sophistication || 'N/A',
                        cisaAlert: attack.metadata?.cisaAlert || 'None',
                        confidence: attack.metadata?.confidence || 'HIGH'
                      };
                      
                      const enrichedHypo = {
                        hypoName: `${attack.name}: Master Triage Hunt`,
                        mitreId: 'TRIAGE',
                        tactic: 'Sweep',
                        description: 'Master triage query sweeping environment for multiple IOCs and behaviors.',
                        isRichFormat: true,
                        threatActor: richThreatActor,
                        intelSummary: attack.poc?.hypothesis || 'No summary available.',
                        iocs: attack.iocs || [],
                        logSources: attack.poc?.logSources || [],
                        huntingSteps: attack.poc?.huntingSteps || [],
                        triageQuery: attack.poc?.triageQuery || '',
                        falsePositives: attack.poc?.falsePositives || '',
                        references: attack.references || [],
                        lastSeen: attack.date || 'Current',
                        confidence: attack.metadata?.confidence || 'HIGH',
                        source: attack.metadata?.origin || 'Proactive Intel',
                        actorContext: JSON.stringify(richThreatActor),
                        splunkSPL: attack.poc?.triageQuery || ''
                      };
                      onViewHypo(enrichedHypo);
                    }}
                  />
                )}

                {/* 9. False Positives */}
                {attack.poc?.falsePositives && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">False Positive Guidance</p>
                    <p className="text-sm text-amber-200/80 leading-relaxed">{attack.poc.falsePositives}</p>
                  </div>
                )}

              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

export default AttackCard;
