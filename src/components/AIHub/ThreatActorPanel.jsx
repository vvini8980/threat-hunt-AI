import React, { useState } from 'react';
import { Users, Shield, Globe, ChevronRight, Target, Crosshair, Zap } from 'lucide-react';

const SOPHISTICATION_COLOR = {
  'Nation State': 'text-red-400 bg-red-500/10 border-red-500/20',
  'Advanced / Zero-Day capability': 'text-red-400 bg-red-500/10 border-red-500/20',
  'Advanced': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'Organized Criminal': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'Ransomware Gang': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  default: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const ORIGIN_FLAG = {
  'China': '🇨🇳',
  'Russia': '🇷🇺',
  'North Korea': '🇰🇵',
  'Iran': '🇮🇷',
  'United States': '🇺🇸',
  'Unknown': '🌐',
};

function getFlag(origin = '') {
  for (const [country, flag] of Object.entries(ORIGIN_FLAG)) {
    if (origin.toLowerCase().includes(country.toLowerCase())) return flag;
  }
  return '🌐';
}

function getSophisticationStyle(soph = '') {
  return SOPHISTICATION_COLOR[soph] || SOPHISTICATION_COLOR.default;
}

const ThreatActorPanel = ({ attacks = [], selectedActor, onSelectActor, onCreateHypothesis }) => {
  // Derive unique threat actors from all loaded attacks
  const actors = React.useMemo(() => {
    const map = new Map();
    attacks.forEach(atk => {
      if (!atk.metadata?.actor) return;
      const key = atk.metadata.actor;
      if (!map.has(key)) {
        map.set(key, {
          actor: atk.metadata.actor,
          aliases: atk.metadata.aliases,
          origin: atk.metadata.origin || 'Unknown',
          targetSector: atk.metadata.targetSector,
          sophistication: atk.metadata.sophistication || 'Advanced',
          confidence: atk.metadata.confidence,
          cisaAlert: atk.metadata.cisaAlert,
          activeSince: atk.metadata.activeSince,
          campaigns: [],
          iocCount: 0,
        });
      }
      const entry = map.get(key);
      entry.campaigns.push(atk.name);
      entry.iocCount += (atk.iocs || []).length;
    });
    return Array.from(map.values());
  }, [attacks]);

  if (actors.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Active Threat Actors</h2>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
          {actors.length} Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {actors.map(actor => {
          const isSelected = selectedActor === actor.actor;
          const sophStyle = getSophisticationStyle(actor.sophistication);
          const flag = getFlag(actor.origin);

          return (
            <div
              key={actor.actor}
              onClick={() => onSelectActor(isSelected ? null : actor.actor)}
              className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 group overflow-hidden ${
                isSelected
                  ? 'bg-violet-500/10 border-violet-500/40 shadow-lg shadow-violet-500/10'
                  : 'bg-[#1a1d27] border-[#2a2d3e] hover:border-violet-500/30 hover:bg-[#1e2035]'
              }`}
            >
              {/* Glow on select */}
              {isSelected && (
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
              )}

              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-base ${sophStyle}`}>
                    {flag}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{actor.actor}</h3>
                    {actor.aliases && (
                      <p className="text-[10px] text-gray-500 truncate">{actor.aliases}</p>
                    )}
                  </div>
                </div>
                <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${sophStyle}`}>
                  {actor.sophistication?.split('/')[0]?.trim() || 'APT'}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Campaigns</p>
                  <p className="text-lg font-bold text-white">{actor.campaigns.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">IOCs</p>
                  <p className="text-lg font-bold text-orange-400">{actor.iocCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Since</p>
                  <p className="text-xs font-bold text-gray-300 mt-0.5">{actor.activeSince?.split(' ')[0] || '?'}</p>
                </div>
              </div>

              {/* Target sector */}
              {actor.targetSector && (
                <div className="flex items-center gap-1.5 mb-3">
                  <Crosshair className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <p className="text-[11px] text-gray-400 truncate">{actor.targetSector}</p>
                </div>
              )}

              {/* Confidence + CISA */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {actor.confidence && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {actor.confidence}
                  </span>
                )}
                {actor.cisaAlert && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    CISA {actor.cisaAlert}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-[#2a2d3e]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectActor(isSelected ? null : actor.actor);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    isSelected
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                      : 'bg-white/5 text-gray-400 border-[#2a2d3e] hover:text-violet-400 hover:border-violet-500/30'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  {isSelected ? 'Filtered' : 'Filter'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateHypothesis(actor);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 hover:text-indigo-300 transition-all"
                >
                  <Target className="w-3 h-3" />
                  Hunt Actor
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ThreatActorPanel;
