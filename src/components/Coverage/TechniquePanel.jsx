import React from 'react';
import { X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TechniquePanel = ({ technique, hypotheses = [], onClose, onAddHypo }) => {
  const navigate = useNavigate();

  if (!technique) return null;

  const handleAdd = () => {
    if (onAddHypo) {
      onAddHypo(technique.id);
    } else {
      navigate(`/add?mitreId=${technique.id}`);
    }
  };

  const tpCount = hypotheses.filter(h => h.result === 'TP').length;
  const fpCount = hypotheses.filter(h => h.result === 'FP').length;
  const activeCount = hypotheses.filter(h => h.status === 'Active').length;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col overflow-y-auto border-l border-[#2a2d3e] bg-[#1a1d27] shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#2a2d3e] p-6">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xl font-bold text-indigo-400">{technique.id}</span>
            <h2 className="text-xl font-bold leading-snug text-white">{technique.name}</h2>
            <div className="mt-1 flex flex-wrap gap-2">
              {technique.tactics?.map(tactic => (
                <span key={tactic} className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-medium text-purple-400">
                  {tactic}
                </span>
              ))}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[#252836] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Coverage summary */}
        <div className="border-b border-[#2a2d3e] p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Coverage Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-lg border border-[#2a2d3e] bg-[#0f1117] p-3 text-center">
              <span className="text-2xl font-bold text-white">{hypotheses.length}</span>
              <span className="text-xs font-medium text-gray-400">Total Hypotheses</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-center">
              <span className="text-2xl font-bold text-green-400">{tpCount}</span>
              <span className="text-xs font-medium text-green-500">True Positives</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center">
              <span className="text-2xl font-bold text-red-400">{fpCount}</span>
              <span className="text-xs font-medium text-red-500">False Positives</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-center">
              <span className="text-2xl font-bold text-blue-400">{activeCount}</span>
              <span className="text-xs font-medium text-blue-500">Active Hunts</span>
            </div>
          </div>
        </div>

        {/* Hypotheses List */}
        <div className="flex-1 p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Related Hypotheses</h3>
          
          {hypotheses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2a2d3e] bg-[#0f1117] py-12 text-center">
              <p className="mb-4 text-sm font-medium text-gray-400">No hypotheses for this technique</p>
              <button 
                onClick={handleAdd}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add Hypothesis
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {hypotheses.map((hyp, i) => {
                const displayStatus = hyp.status || 'Pending';
                
                return (
                <div key={hyp.id} className={`flex flex-col gap-2 py-4 ${i !== hypotheses.length - 1 ? 'border-b border-[#2a2d3e]' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium text-white">{hyp.hypoName || hyp.name || 'Untitled Hypothesis'}</span>
                    <span className="whitespace-nowrap text-xs font-medium text-gray-400">{hyp.month || '--'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      displayStatus === 'Active' ? 'bg-blue-500/20 text-blue-400' :
                      displayStatus === 'Planned' ? 'bg-yellow-500/20 text-yellow-400' :
                      displayStatus === 'Completed' || displayStatus === 'Shared' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {displayStatus}
                    </span>
                    {hyp.result && hyp.result !== 'Undetermined' && (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        hyp.result === 'TP' ? 'bg-green-500/20 text-green-400' :
                        hyp.result === 'FP' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {hyp.result}
                      </span>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>

        {/* Bottom Button */}
        {hypotheses.length > 0 && (
          <div className="sticky bottom-0 border-t border-[#2a2d3e] bg-[#1a1d27] p-6">
            <button 
              onClick={handleAdd}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
            >
              <Plus className="h-5 w-5" />
              Add Hypothesis for this technique
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default TechniquePanel;
