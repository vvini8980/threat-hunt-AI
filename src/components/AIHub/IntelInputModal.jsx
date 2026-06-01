import React, { useState } from 'react';
import { X, BrainCircuit, FileText } from 'lucide-react';

const IntelInputModal = ({ onClose, onSubmit, isGenerating }) => {
  const [intelText, setIntelText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!intelText.trim()) return;
    onSubmit(intelText);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2d3e] bg-[#0f1117]">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-lg">Generate Live Intelligence</h3>
          </div>
          <button 
            onClick={onClose}
            disabled={isGenerating}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Paste Raw Intelligence, Article URL, or Logs
            </label>
            <textarea
              autoFocus
              className="w-full h-48 bg-[#0f1117] border border-[#2a2d3e] rounded-lg p-3 text-sm text-gray-200 font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
              placeholder="Paste a CISA alert, threat report, raw logs, or summary here..."
              value={intelText}
              onChange={(e) => setIntelText(e.target.value)}
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-2">
              The AI will automatically extract the threat actor, map the MITRE ATT&CK phases, and generate advanced Splunk hunting queries based on this input.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!intelText.trim() || isGenerating}
              className="px-4 py-2 bg-indigo-600 border border-indigo-500 rounded-lg text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {isGenerating ? (
                <>
                  <BrainCircuit className="w-4 h-4 animate-pulse" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4" />
                  Analyze & Generate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IntelInputModal;
