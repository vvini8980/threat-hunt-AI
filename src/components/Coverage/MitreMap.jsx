import React from 'react';
import { getCoverageColor } from '../../utils/coverage';

const MitreMap = ({ 
  tactics = [], 
  techniques = [], 
  subTechniques = [], 
  coverageMap = {}, 
  onTechniqueClick,
  showOnlyCovered = false 
}) => {
  
  const visibleTechniques = showOnlyCovered
    ? techniques.filter(t => coverageMap[t.id] && coverageMap[t.id].length > 0)
    : techniques;

  const visibleTactics = showOnlyCovered
    ? tactics.filter(tactic => visibleTechniques.some(tech => tech.tactics?.includes(tactic.shortName)))
    : tactics;

  const getTechniqueCount = (tacticShortName) => {
    if (!visibleTechniques || visibleTechniques.length === 0) return 0;
    return visibleTechniques.filter(tech => tech.tactics?.includes(tacticShortName)).length;
  };

  const getSubTechniqueCount = (techniqueId) => {
    if (!subTechniques || subTechniques.length === 0) return 0;
    return subTechniques.filter(st => st.parentId === techniqueId).length;
  };

  const getCoverageStyles = (colorStatus) => {
    switch (colorStatus) {
      case 'tp':
        return { container: 'bg-green-500/20 border-green-500/40', text: 'text-green-400' };
      case 'fp':
        return { container: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-400' };
      case 'planned':
        return { container: 'bg-yellow-500/20 border-yellow-500/40', text: 'text-yellow-400' };
      case 'active':
        return { container: 'bg-red-500/20 border-red-500/40', text: 'text-red-400' };
      case 'none':
      default:
        return { container: 'bg-[#1a1d27] border-[#2a2d3e]', text: 'text-gray-500' };
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-2 min-w-max pb-4">
        {visibleTactics.map(tactic => {
          const count = getTechniqueCount(tactic.shortName);
          const columnTechniques = visibleTechniques.filter(t => t.tactics?.includes(tactic.shortName));

          return (
            <div key={tactic.id} className="flex flex-col min-w-[140px]">
              {/* Tactic Header */}
              <div className="flex flex-col items-center justify-center border border-[#2a2d3e] bg-[#1e2130] p-2 text-center rounded-t-lg">
                <span className="text-sm font-bold text-white">{tactic.name}</span>
                <span className="mt-0.5 text-xs text-gray-400">{tactic.id}</span>
                <span className="mt-0.5 text-[11px] text-gray-500">
                  ({count} techniques)
                </span>
              </div>
              
              {/* Techniques List Container */}
              <div className="flex flex-col gap-[2px] mt-2">
                {columnTechniques.map(technique => {
                  const subCount = getSubTechniqueCount(technique.id);
                  const colorStatus = getCoverageColor(coverageMap[technique.id] || []);
                  const styles = getCoverageStyles(colorStatus);

                  return (
                    <div
                      key={technique.id}
                      onClick={() => onTechniqueClick?.(technique)}
                      className={`relative flex w-[130px] min-h-[48px] cursor-pointer flex-col justify-start rounded border p-1 mx-auto transition-all hover:brightness-125 ${styles.container}`}
                    >
                      <span className={`font-mono text-[10px] font-medium leading-none ${styles.text}`}>
                        {technique.id}
                      </span>
                      <span className="mt-0.5 text-[11px] font-medium text-white truncate w-full block" title={technique.name}>
                        {technique.name}
                      </span>
                      {subCount > 0 && (
                        <span className="absolute bottom-1 right-1 text-[9px] font-medium text-gray-500">
                          {subCount} subs
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MitreMap;
