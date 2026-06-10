import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMitre } from '../hooks/useMitre';
import { useHypotheses } from '../hooks/useHypotheses';
import MitreMap from '../components/Coverage/MitreMap';
import TechniquePanel from '../components/Coverage/TechniquePanel';
import { buildCoverageMap, getCoverageStats } from '../utils/coverage';
import Spinner from '../components/Common/Spinner';

function Coverage() {
  const { mitreData, loading: mitreLoading } = useMitre();
  const { hypotheses } = useHypotheses();
  const navigate = useNavigate();

  const [selectedTechnique, setSelectedTechnique] = useState(null);
  const [selectedHypotheses, setSelectedHypotheses] = useState([]);
  const [showOnlyCovered, setShowOnlyCovered] = useState(false);

  const coverageMap = useMemo(() => buildCoverageMap(hypotheses), [hypotheses]);

  const coverageStats = useMemo(() => {
    return getCoverageStats(mitreData, coverageMap);
  }, [mitreData, coverageMap]);

  const handleTechniqueClick = (technique) => {
    setSelectedTechnique(technique);
    const matching = hypotheses.filter(h => 
      h.mitreId === technique.id || h.mitreId?.startsWith(`${technique.id}.`)
    );
    setSelectedHypotheses(matching);
  };

  const handleAddHypo = (mitreId) => {
    navigate(`/add?mitreId=${mitreId}`);
  };

  if (mitreLoading) {
    return <Spinner size="lg" text="Loading MITRE ATT&CK data..." />;
  }

  return (
    <section className="min-h-full p-6 text-textprimary relative">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-textprimary">
            🗺️ MITRE ATT&CK Coverage Map
          </h2>
          <p className="mt-1 text-sm text-textsecondary">Click any technique to see hypotheses</p>
        </div>
        
        {/* Legend & Controls */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <button
            onClick={() => setShowOnlyCovered(!showOnlyCovered)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
              showOnlyCovered 
                ? 'bg-accent-primary text-bg-base border-accent-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                : 'bg-bg-primary text-textsecondary border-glass hover:text-textprimary'
            }`}
          >
            {showOnlyCovered ? '👁️ Showing Covered Only' : '👁️ Show Covered Only'}
          </button>
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-glass bg-bg-primary px-4 py-2 text-sm font-medium">
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-green-500"></span> TP Found</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-500"></span> FP Only</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-yellow-500"></span> Planned</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-500"></span> Active</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-gray-500 bg-gray-600"></span> No Coverage</div>
          </div>
        </div>
      </div>

      {/* Coverage Score Bar */}
      <div className="mb-8 rounded-xl border border-glass bg-bg-primary p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm font-medium">
          <span className="text-textprimary">Coverage: {coverageStats.covered} of {coverageStats.total} techniques hunted</span>
          <span className="text-accent-primary">{coverageStats.percentage}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-glass">
          <div 
            className="h-full rounded-full bg-accent-primary transition-all duration-500" 
            style={{ width: `${coverageStats.percentage}%` }}
          />
        </div>
      </div>

      {/* Mitre Map */}
      {!mitreLoading && mitreData && (
        <MitreMap 
          tactics={mitreData.tactics}
          techniques={mitreData.techniques}
          subTechniques={mitreData.subTechniques}
          coverageMap={coverageMap}
          onTechniqueClick={handleTechniqueClick}
          showOnlyCovered={showOnlyCovered}
        />
      )}

      {/* Side Panel */}
      <TechniquePanel 
        technique={selectedTechnique}
        hypotheses={selectedHypotheses}
        onClose={() => setSelectedTechnique(null)}
        onAddHypo={handleAddHypo}
      />
    </section>
  );
}

export default Coverage;
