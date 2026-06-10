import React, { useState, useMemo } from 'react';
import AttackCard from './AttackCard';
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const AttackList = ({ attacks, isFetching, onViewHypo, savedLibrary, clientId }) => {
  const [sortField, setSortField] = useState('ai_date');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc'); // Default to descending when switching columns (usually users want most recent / highest risk first)
    }
  };

  const sortedAttacks = useMemo(() => {
    if (!attacks) return [];
    return [...attacks].sort((a, b) => {
      let aVal, bVal;
      switch(sortField) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'actor':
          aVal = a.metadata?.actor || '';
          bVal = b.metadata?.actor || '';
          break;
        case 'date':
          const aD = a.date;
          const bD = b.date;
          aVal = aD ? new Date(aD).getTime() : 0;
          bVal = bD ? new Date(bD).getTime() : 0;
          break;
        case 'ai_date':
          const aAI = a.generated_at || a.date;
          const bAI = b.generated_at || b.date;
          aVal = aAI ? new Date(aAI).getTime() : 0;
          bVal = bAI ? new Date(bAI).getTime() : 0;
          break;
        case 'risk':
          const getRiskScore = (conf = '') => {
            const upper = conf.toUpperCase();
            if (upper.includes('HIGH') || upper.startsWith('9') || upper.startsWith('8')) return 3;
            if (upper.includes('MEDIUM') || upper.startsWith('7') || upper.startsWith('6')) return 2;
            if (upper.includes('LOW') || upper.startsWith('5') || upper.startsWith('4')) return 1;
            const match = conf.match(/\d+/);
            if (match) {
              const val = parseInt(match[0], 10);
              if (val >= 80) return 3;
              if (val >= 50) return 2;
              return 1;
            }
            return 0;
          };
          aVal = getRiskScore(a.metadata?.confidence);
          bVal = getRiskScore(b.metadata?.confidence);
          break;
        default:
          aVal = ''; bVal = '';
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [attacks, sortField, sortDir]);

  if (isFetching && (!attacks || attacks.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold">Syncing latest threat intelligence...</p>
      </div>
    );
  }

  if (!attacks || attacks.length === 0) {
    return (
      <div className="text-gray-500 text-center py-20 bg-[#1a1d27] border border-[#2a2d3e] rounded-xl shadow-lg">
        No recent attacks found in the feed.
      </div>
    );
  }

  const RenderSortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1.5 opacity-40 hover:opacity-100 transition-opacity shrink-0" />;
    }
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 ml-1.5 text-indigo-400 shrink-0" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1.5 text-indigo-400 shrink-0" />;
  };

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#1e2130]">
            <tr className="border-b border-[#2a2d3e] text-gray-400">
              <th className="px-4 py-3 font-bold cursor-pointer hover:text-white transition-colors select-none align-middle" onClick={() => handleSort('name')}>
                <div className="flex items-center whitespace-nowrap">
                  Campaign Name
                  <RenderSortIcon field="name" />
                </div>
              </th>
              <th className="px-4 py-3 font-bold cursor-pointer hover:text-white transition-colors select-none align-middle" onClick={() => handleSort('actor')}>
                <div className="flex items-center whitespace-nowrap">
                  Threat Actor
                  <RenderSortIcon field="actor" />
                </div>
              </th>
              <th className="px-4 py-3 font-bold cursor-pointer hover:text-white transition-colors select-none align-middle" onClick={() => handleSort('date')}>
                <div className="flex items-center whitespace-nowrap">
                  First Detected
                  <RenderSortIcon field="date" />
                </div>
              </th>
              <th className="px-4 py-3 font-bold cursor-pointer hover:text-white transition-colors select-none align-middle" onClick={() => handleSort('ai_date')}>
                <div className="flex items-center whitespace-nowrap">
                  AI Generated
                  <RenderSortIcon field="ai_date" />
                </div>
              </th>
              <th className="px-4 py-3 font-bold whitespace-nowrap align-middle text-gray-400">
                Assets
              </th>
              <th className="px-4 py-3 font-bold cursor-pointer hover:text-white transition-colors text-right select-none align-middle" onClick={() => handleSort('risk')}>
                <div className="flex items-center justify-end whitespace-nowrap">
                  Risk
                  <RenderSortIcon field="risk" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3e]/50">
            {sortedAttacks.map((attack, index) => (
              <AttackCard 
                key={attack.id ? `${attack.id}-${index}` : `attack-${index}`} 
                attack={attack} 
                onViewHypo={onViewHypo} 
                savedLibrary={savedLibrary}
                clientId={clientId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttackList;
