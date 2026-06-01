import React, { useState } from 'react';
import { useAIHub } from '../hooks/useAIHub';
import AttackList from '../components/AIHub/AttackList';
import AISettings from '../components/AIHub/AISettings';
import HypoPreviewModal from '../components/AIHub/HypoPreviewModal';
import { Settings, BrainCircuit, RefreshCw, Clock } from 'lucide-react';

const AIHub = () => {
  const {
    attacks,
    isFetching,
    isGenerating,
    lastUpdated,
    fetchRecentAttacks,
    generateLiveAttack,
    savedLibrary,
    saveHypothesis
  } = useAIHub();

  const [showSettings, setShowSettings] = useState(false);
  const [previewHypo, setPreviewHypo] = useState(null);

  const handleGenerateLive = async () => {
    // Pick a random theme so the AI doesn't always generate the same attack
    const themes = [
      'Ransomware group (e.g. LockBit, BlackCat)',
      'Nation-State Espionage (e.g. APT29, Lazarus)',
      'Supply Chain Attack (e.g. SolarWinds style)',
      'Zero-Day Vulnerability Exploitation',
      'Financially Motivated Cybercrime (e.g. Scattered Spider)'
    ];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];

    try {
      await generateLiveAttack(randomTheme);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-[#0f1117] text-white p-4 md:p-8 custom-scrollbar">
      <div className="max-w-[1600px] w-full mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30">
              <BrainCircuit className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Proactive Threat Intel Feed</h1>
              <p className="text-gray-400 text-sm mt-1">Automated AI analysis of the latest real-world attacks with ready-to-use hunting hypotheses.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-[#1a1d27] border border-[#2a2d3e] px-3 py-2 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
                Updated: {lastUpdated}
              </div>
            )}
            <button
              onClick={handleGenerateLive}
              disabled={isGenerating || isFetching}
              className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/50 rounded-lg text-indigo-400 font-bold hover:bg-indigo-500/30 hover:text-indigo-300 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              {isGenerating ? 'Analyzing Intel...' : 'Generate Live Intel'}
            </button>
            <button 
              onClick={fetchRecentAttacks}
              disabled={isFetching || isGenerating}
              className="p-2.5 bg-indigo-600 border border-indigo-500 rounded-lg text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              title="Force Sync Feed"
            >
              <RefreshCw className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-[#1a1d27] border border-[#2a2d3e] rounded-lg text-gray-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors"
              title="AI Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
        


        <div className="flex flex-col gap-6">
          <div className="w-full">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Active Campaigns
              </h2>
            </div>
            
            {/* Expanded Feed List */}
            <AttackList 
              attacks={attacks}
              isFetching={isFetching}
              savedLibrary={savedLibrary}
              onViewHypo={setPreviewHypo}
            />
          </div>
        </div>

      </div>

      {/* Modals */}
      {showSettings && <AISettings onClose={() => setShowSettings(false)} />}
      {previewHypo && (
        <HypoPreviewModal 
          hypo={previewHypo} 
          onClose={() => setPreviewHypo(null)} 
          onSave={() => saveHypothesis(previewHypo)}
        />
      )}
    </div>
  );
};

export default AIHub;
