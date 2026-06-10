import React, { useState, useMemo } from 'react';
import { Search, Copy, Target, Shield, Hash, Globe, Server, Loader2, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

const IOC_TABS = [
  { key: 'IP', label: 'Top IPs', icon: Server, color: 'orange' },
  { key: 'DOMAIN', label: 'Top Domains', icon: Globe, color: 'blue' },
  { key: 'HASH', label: 'Top Hashes', icon: Hash, color: 'yellow' },
  { key: 'URL', label: 'Top URLs', icon: ExternalLink, color: 'cyan' },
];

const COLOR_MAP = {
  orange: { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dot: 'bg-orange-400', tab: 'border-orange-400 text-orange-400', icon: 'text-orange-400' },
  blue:   { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       dot: 'bg-blue-400',   tab: 'border-blue-400 text-blue-400',     icon: 'text-blue-400' },
  yellow: { badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', dot: 'bg-yellow-400', tab: 'border-yellow-400 text-yellow-400', icon: 'text-yellow-400' },
  cyan:   { badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',       dot: 'bg-cyan-400',   tab: 'border-cyan-400 text-cyan-400',     icon: 'text-cyan-400' },
};

function HuntButton({ ioc, clientId }) {
  const [state, setState] = useState('idle'); // idle | hunting | hit | clean | error
  const [hitCount, setHitCount] = useState(0);

  const handleHunt = async () => {
    if (!clientId) { alert('Please select a client from the top bar first.'); return; }
    setState('hunting');
    try {
      const res = await fetch(`${API_BASE_URL}/hunt/ioc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          ioc_type: ioc.type,
          ioc_value: ioc.value,
          earliest: '-30d',
          latest: 'now',
        }),
      });
      const data = await res.json();
      setHitCount(data.total_events || 0);
      setState(data.total_events > 0 ? 'hit' : 'clean');
    } catch {
      setState('error');
    }
  };

  if (state === 'hunting') return (
    <button disabled className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 opacity-70">
      <Loader2 className="w-3 h-3 animate-spin" /> Hunting...
    </button>
  );
  if (state === 'hit' || state === 'clean') return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default">
      <CheckCircle className="w-3.5 h-3.5" /> Hunted: {state === 'hit' ? `${hitCount} Hit${hitCount !== 1 ? 's' : ''}` : 'Clean'}
    </div>
  );

  return (
    <button onClick={handleHunt} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors">
      <Search className="w-3 h-3" /> Hunt
    </button>
  );
}

const normalizeIOCType = (type = '') => {
  const typeKey = type.toUpperCase();
  if (typeKey === 'IP' || typeKey === 'IP ADDRESS') return 'IP';
  if (typeKey === 'DOMAIN' || typeKey === 'HOSTNAME') return 'DOMAIN';
  if (typeKey === 'HASH' || typeKey === 'MD5' || typeKey === 'SHA256' || typeKey === 'SHA-256') return 'HASH';
  return typeKey || 'UNKNOWN';
};

const TopIOCsPanel = ({ attacks = [], clientId, onCreateHypothesis }) => {
  const [activeTab, setActiveTab] = useState('IP');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Aggregate all IOCs from attacks that occurred today
  const allIOCs = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const map = new Map();
    attacks.forEach(atk => {
      (atk.iocs || []).forEach(ioc => {
        const normalizedType = normalizeIOCType(ioc.type);

        const key = `${normalizedType}::${ioc.value}`;
        if (!map.has(key)) {
          map.set(key, {
            type: normalizedType,
            value: ioc.value,
            context: ioc.context || ioc.description || '',
            date: atk.generated_at || atk.date || 'Unknown',
            campaigns: [],
          });
        }
        map.get(key).campaigns.push(atk.metadata?.actor || atk.name);
      });
    });
    return Array.from(map.values());
  }, [attacks]);

  const filtered = useMemo(() => {
    let result = allIOCs.filter(i => i.type === activeTab);
    
    result.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (sortField === 'actor') {
         aVal = a.campaigns.length > 0 ? a.campaigns[0] : '';
         bVal = b.campaigns.length > 0 ? b.campaigns[0] : '';
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [allIOCs, activeTab, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const tabCounts = useMemo(() => ({
    IP: allIOCs.filter(i => i.type === 'IP').length,
    DOMAIN: allIOCs.filter(i => i.type === 'DOMAIN').length,
    HASH: allIOCs.filter(i => i.type === 'HASH').length,
    URL: allIOCs.filter(i => i.type === 'URL').length,
  }), [allIOCs]);

  const uniqueIOCs = allIOCs.length;
  const rawTotalIOCs = useMemo(() => attacks.reduce((sum, atk) => sum + (atk.iocs?.length || 0), 0), [attacks]);

  const activeTabInfo = IOC_TABS.find(t => t.key === activeTab);
  const colors = COLOR_MAP[activeTabInfo.color];

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2d3e] bg-[#1e2130]">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Today's Top IOC Intelligence</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20" title={`${uniqueIOCs} Unique IOCs`}>
            {rawTotalIOCs} Total
          </span>
        </div>
        {!clientId && (
          <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            ⚠ Select client to Hunt
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2d3e]">
        {IOC_TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const c = COLOR_MAP[tab.color];
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold transition-all border-b-2 ${
                isActive
                  ? `${c.tab} bg-white/3`
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/3'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? c.icon : ''}`} />
              {tab.label}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${isActive ? c.badge : 'bg-white/5 text-gray-500 border-white/10'}`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* IOC Table */}
      <div className="overflow-auto max-h-96 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No {activeTab} IOCs found in current feed
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-[#1a1d27]">
              <tr className="border-b border-[#2a2d3e]">
                <th className="px-4 py-2 text-gray-500 font-semibold uppercase tracking-wider w-8">#</th>
                <th className="px-4 py-2 text-gray-500 font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('value')}>
                  Value {sortField === 'value' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-2 text-gray-500 font-semibold uppercase tracking-wider hidden md:table-cell cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('context')}>
                  Context {sortField === 'context' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-2 text-gray-500 font-semibold uppercase tracking-wider hidden lg:table-cell cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('actor')}>
                  Actor {sortField === 'actor' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-2 text-gray-500 font-semibold uppercase tracking-wider hidden lg:table-cell cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('date')}>
                  Date & Time {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-2 text-gray-500 font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3e]/50">
              {filtered.map((ioc, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-2.5">
                    <span className="text-gray-600 font-mono">{i + 1}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <span className={`font-mono font-semibold break-all ${colors.icon}`}>
                        {ioc.value}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-gray-400 max-w-[200px]">
                    <span className="truncate block" title={ioc.context}>{ioc.context || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell">
                    <div className="flex flex-col gap-0.5">
                      {[...new Set(ioc.campaigns)].slice(0, 2).map((c, ci) => (
                        <span key={ci} className="text-[10px] text-gray-500 truncate max-w-[120px]">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell whitespace-nowrap">
                    <span className="text-[10px] bg-white/5 border border-white/10 text-gray-400 px-1.5 py-0.5 rounded">
                      {(() => {
                        if (!ioc.date || ioc.date === 'Unknown') return '—';
                        const d = new Date(ioc.date);
                        if (isNaN(d.getTime())) return ioc.date;
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
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => navigator.clipboard.writeText(ioc.value)}
                        className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
                        title="Copy value"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      
                      {ioc.opencti_id && (
                        <a
                          href={`${localStorage.getItem('ai_opencti_url') || 'http://localhost:8080'}/dashboard/observations/indicators/${ioc.opencti_id}/overview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded text-gray-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all opacity-0 group-hover:opacity-100"
                          title="View in OpenCTI"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      <HuntButton ioc={ioc} clientId={clientId} />
                      <button
                        onClick={() => onCreateHypothesis(ioc)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                        title="Create Hunt Hypothesis"
                      >
                        <Target className="w-3 h-3" /> Hypo
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TopIOCsPanel;
