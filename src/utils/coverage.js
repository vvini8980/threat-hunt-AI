export const getCoverageColor = (hypotheses) => {
  if (!hypotheses || hypotheses.length === 0) return 'none';
  
  if (hypotheses.some(h => h.result === 'TP')) return 'tp';
  if (hypotheses.some(h => h.status === 'Active')) return 'active';
  if (hypotheses.some(h => h.status === 'Planned')) return 'planned';
  if (hypotheses.every(h => h.result === 'FP')) return 'fp';
  
  return 'none';
};

export const buildCoverageMap = (hypotheses) => {
  const map = {};
  if (!hypotheses) return map;
  
  hypotheses.forEach(hyp => {
    if (!hyp.mitreId) return;
    if (!map[hyp.mitreId]) {
      map[hyp.mitreId] = [];
    }
    map[hyp.mitreId].push(hyp);
  });
  
  return map;
};

export const getCoverageStats = (mitreData, coverageMap) => {
  if (!mitreData || !mitreData.techniques) {
    return {
      total: 0,
      covered: 0,
      tp: 0,
      fp: 0,
      planned: 0,
      active: 0,
      percentage: 0
    };
  }

  const techniques = mitreData.techniques;
  const total = techniques.length;
  
  let covered = 0;
  let tp = 0;
  let fp = 0;
  let planned = 0;
  let active = 0;
  
  techniques.forEach(tech => {
    const hyps = coverageMap[tech.id] || [];
    if (hyps.length > 0) {
      covered++;
      const color = getCoverageColor(hyps);
      if (color === 'tp') tp++;
      else if (color === 'fp') fp++;
      else if (color === 'active') active++;
      else if (color === 'planned') planned++;
    }
  });
  
  const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;
  
  return {
    total,
    covered,
    tp,
    fp,
    planned,
    active,
    percentage
  };
};
