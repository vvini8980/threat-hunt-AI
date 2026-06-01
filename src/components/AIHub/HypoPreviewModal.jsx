import React from 'react';
import { Target, X, Check, Activity, Copy, AlertTriangle } from 'lucide-react';
import { useToastContext } from '../../context/ToastContext';

const HypoPreviewModal = ({ hypo, onClose, onSave }) => {
  const { showToast } = useToastContext();

  const handleApprove = () => {
    if (onSave) onSave();
    showToast('Hypothesis pushed to Library', 'success');
    onClose();
  };

  const copySPL = () => {
    navigator.clipboard.writeText(hypo.splunkSPL || hypo.socDetectionRule);
    showToast('SPL Copied to clipboard', 'success');
  };

  if (!hypo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#1a1d27] border border-[#2a2d3e] rounded-xl shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[#2a2d3e] bg-[#1e2130]">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">🔍 Hypothesis Review</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          
          {/* MITRE ATT&CK DETAILS */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">MITRE ATT&CK DETAILS</span>
            <div className="bg-[#0f1117] p-4 rounded-lg border border-[#2a2d3e] grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
              <div><span className="text-[10px] text-gray-500 block uppercase">ID</span><span className="text-sm text-gray-200">{hypo.mitreId}</span></div>
              <div className="col-span-2 md:col-span-1"><span className="text-[10px] text-gray-500 block uppercase">Name</span><span className="text-sm text-gray-200">{hypo.hypoName}</span></div>
              <div><span className="text-[10px] text-gray-500 block uppercase">Tactic</span><span className="text-sm text-gray-200">{hypo.tactic}</span></div>
              <div><span className="text-[10px] text-gray-500 block uppercase">Platform</span><span className="text-sm text-gray-200">{hypo.platform || 'Cross-Platform'}</span></div>
              <div className="col-span-2 md:col-span-1"><span className="text-[10px] text-gray-500 block uppercase">Data Source</span><span className="text-sm text-gray-200">{hypo.dataSource || 'Event Logs / Telemetry'}</span></div>
            </div>
          </div>

          {/* ACTOR CONTEXT */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">{hypo.actorContext ? 'THREAT ACTOR CONTEXT' : 'DESCRIPTION'}</span>
            <div className="bg-[#0f1117] p-4 rounded-lg border border-[#2a2d3e]">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{hypo.actorContext || hypo.description}</p>
            </div>
          </div>

          {/* METADATA STRIP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d3e] flex flex-col">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Confidence</span>
              <span className="text-sm font-bold text-green-400 mt-1">{hypo.confidence || 'MEDIUM 70%'}</span>
            </div>
            <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d3e] flex flex-col">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Source</span>
              <span className="text-sm text-gray-200 mt-1">{hypo.source || 'AI Generated Inference'}</span>
            </div>
            <div className="bg-[#0f1117] p-3 rounded-lg border border-[#2a2d3e] flex flex-col">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Last Seen</span>
              <span className="text-sm text-gray-200 mt-1">{hypo.lastSeen || 'Current (Ongoing)'}</span>
            </div>
          </div>

          {/* HUNTING LOGIC */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Hunting Logic</span>
            <div className="bg-[#0f1117] p-4 rounded-lg border border-[#2a2d3e]">
              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{hypo.huntingLogic}</p>
            </div>
          </div>

          {/* RISK & ESCALATION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> False Positive Risk</span>
              <div className="bg-[#1a150b] p-4 rounded-lg border border-yellow-900/50 h-full">
                <p className="text-yellow-200/80 text-sm whitespace-pre-wrap leading-relaxed">{hypo.falsePositiveRisk || 'Moderate: Verify against standard IT administration activity.'}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-red-500 uppercase tracking-widest">If True Positive:</span>
              <div className="bg-[#1a0f0f] p-4 rounded-lg border border-red-900/50 h-full">
                <p className="text-red-300 text-sm whitespace-pre-wrap leading-relaxed font-semibold">{hypo.truePositiveAction || '🚨 Escalate to Incident Response\n🚨 Isolate affected systems\n🚨 Initiate forensic timeline'}</p>
              </div>
            </div>
          </div>

        </div>

        <div className="sticky bottom-0 p-4 border-t border-[#2a2d3e] bg-[#1e2130] flex justify-between items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <div className="flex gap-3">
            <button onClick={copySPL} className="flex items-center gap-2 bg-[#2a2d3e] hover:bg-[#3b3e54] text-white px-6 py-2 rounded-lg font-bold transition-colors">
              <Copy className="w-4 h-4" />
              Copy SPL
            </button>
            <button onClick={handleApprove} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-colors">
              <Check className="w-5 h-5" />
              Save to Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HypoPreviewModal;
