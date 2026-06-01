import React, { useState, useEffect } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { useToastContext } from '../../context/ToastContext';

const AISettings = ({ onClose }) => {
  const { showToast } = useToastContext();
  const [keys, setKeys] = useState({
    gemini: '',
    opencti: ''
  });

  useEffect(() => {
    setKeys({
      gemini: localStorage.getItem('ai_gemini_key') || '',
      opencti: localStorage.getItem('ai_opencti_key') || ''
    });
  }, []);

  const handleSave = () => {
    localStorage.setItem('ai_gemini_key', keys.gemini);
    localStorage.setItem('ai_opencti_key', keys.opencti);
    showToast('AI Settings saved successfully', 'success');
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1a1d27] border border-[#2a2d3e] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-[slideUp_200ms_ease-out]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2d3e] bg-[#1e2130]">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">AI Hub Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gemini API Key</label>
            <input 
              type="password"
              className="bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="Enter Gemini API Key..."
              value={keys.gemini}
              onChange={(e) => setKeys(prev => ({ ...prev, gemini: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Threat Feed API Key</label>
            <input 
              type="password"
              className="bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="Enter Threat Feed API Key..."
              value={keys.opencti}
              onChange={(e) => setKeys(prev => ({ ...prev, opencti: e.target.value }))}
            />
          </div>
        </div>

        <div className="p-4 border-t border-[#2a2d3e] bg-[#1e2130] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            <Save className="w-4 h-4" />
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettings;
