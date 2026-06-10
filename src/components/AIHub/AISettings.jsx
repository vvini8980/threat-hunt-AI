import React, { useState, useEffect } from 'react';
import { Settings, Save, X, Check, Eye, EyeOff } from 'lucide-react';
import { useToastContext } from '../../context/ToastContext';

const AISettings = ({ onClose }) => {
  const { showToast } = useToastContext();
  const [keys, setKeys] = useState({ gemini: '', opencti: '', opencti_url: '' });
  const [showGemini,  setShowGemini]  = useState(false);
  const [showOpenCTI, setShowOpenCTI] = useState(false);

  useEffect(() => {
    setKeys({
      gemini:  localStorage.getItem('ai_gemini_key')  || '',
      opencti: localStorage.getItem('ai_opencti_key') || '',
      opencti_url: localStorage.getItem('ai_opencti_url') || '',
    });
  }, []);

  const handleSave = () => {
    localStorage.setItem('ai_gemini_key',  keys.gemini);
    localStorage.setItem('ai_opencti_key', keys.opencti);
    localStorage.setItem('ai_opencti_url', keys.opencti_url);
    showToast('AI Settings saved successfully', 'success');
    if (onClose) onClose();
  };

  const isGeminiConfigured  = !!localStorage.getItem('ai_gemini_key');
  const isOpenCTIConfigured = !!localStorage.getItem('ai_opencti_key');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1a1d27] border border-[#2a2d3e] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2d3e] bg-[#1e2130]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">AI Hub Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Gemini API Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gemini API Key</label>
              {isGeminiConfigured && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Check className="w-2.5 h-2.5" /> Configured
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showGemini ? 'text' : 'password'}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition-colors pr-10"
                placeholder={isGeminiConfigured ? '••••••••••••••••••••••••••' : 'Enter Gemini API Key...'}
                value={keys.gemini}
                onChange={(e) => setKeys(prev => ({ ...prev, gemini: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowGemini(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-600">Required for "Generate Live Intel" feature. Get it from Google AI Studio.</p>
          </div>

          {/* OpenCTI / Threat Feed Key */}
          <div className="flex flex-col gap-3">
            {/* OpenCTI URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">OpenCTI Server URL</label>
              <input
                type="text"
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                placeholder="e.g. https://demo.opencti.io"
                value={keys.opencti_url}
                onChange={(e) => setKeys(prev => ({ ...prev, opencti_url: e.target.value }))}
              />
            </div>
            
            {/* OpenCTI Token */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Threat Feed API Token</label>
                {isOpenCTIConfigured && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <Check className="w-2.5 h-2.5" /> Configured
                  </span>
                )}
              </div>
            <div className="relative">
              <input
                type={showOpenCTI ? 'text' : 'password'}
                className="w-full bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-indigo-500 transition-colors pr-10"
                placeholder={isOpenCTIConfigured ? '••••••••••••••••••••••••••' : 'Enter OpenCTI API Token...'}
                value={keys.opencti}
                onChange={(e) => setKeys(prev => ({ ...prev, opencti: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowOpenCTI(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showOpenCTI ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-600">Optional — Used to sync real IOCs from your OpenCTI server.</p>
          </div>
        </div>

          {/* Daily Intel Scheduler Info */}
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
            <p className="text-xs font-bold text-indigo-400 mb-1">📅 Daily Intel Report Schedule</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              A daily IOC & threat intelligence report is automatically generated at <span className="text-white font-semibold">12:00 AM</span> (midnight) each day,
              collecting all IOCs from the previous day's feed and summarizing active threat actors and campaigns.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-[#2a2d3e] bg-[#1e2130] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg">
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettings;
