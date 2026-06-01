import React from 'react';
import { RefreshCw, FileText, LayoutTemplate, Bug } from 'lucide-react';

const ActionButtons = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
      <button className="flex items-center justify-center gap-2 bg-[#1a1d27] border border-[#2a2d3e] p-4 rounded-xl hover:bg-[#252836] transition-colors text-gray-300 hover:text-white group">
        <RefreshCw className="w-5 h-5 text-indigo-400 group-hover:animate-spin" />
        <span className="font-semibold text-sm">Resync Feeds</span>
      </button>
      <button className="flex items-center justify-center gap-2 bg-[#1a1d27] border border-[#2a2d3e] p-4 rounded-xl hover:bg-[#252836] transition-colors text-gray-300 hover:text-white group">
        <FileText className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-sm">Parse Document</span>
      </button>
      <button className="flex items-center justify-center gap-2 bg-[#1a1d27] border border-[#2a2d3e] p-4 rounded-xl hover:bg-[#252836] transition-colors text-gray-300 hover:text-white group">
        <LayoutTemplate className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-sm">Use Template</span>
      </button>
      <button className="flex items-center justify-center gap-2 bg-[#1a1d27] border border-[#2a2d3e] p-4 rounded-xl hover:bg-[#252836] transition-colors text-gray-300 hover:text-white group">
        <Bug className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-sm">Submit Malware</span>
      </button>
    </div>
  );
};

export default ActionButtons;
