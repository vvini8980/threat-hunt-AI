import React, { useState, useEffect } from 'react';
import { Clock, Check, X } from 'lucide-react';

const PendingReview = () => {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    // Dummy local storage load for now
    const saved = localStorage.getItem('ai_pending_review');
    if (saved) {
      try {
        setQueue(JSON.parse(saved));
      } catch (e) { }
    } else {
      setQueue([
        { id: 1, type: 'Hypothesis', title: 'Suspicious PowerShell Execution', date: '2026-05-25' }
      ]);
    }
  }, []);

  if (queue.length === 0) return null;

  return (
    <div className="mt-8 bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-orange-400" />
        <h3 className="font-bold text-white text-lg">Pending Review</h3>
        <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs font-bold">{queue.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {queue.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-[#0f1117] p-3 rounded-lg border border-[#2a2d3e]">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">{item.title}</span>
              <span className="text-xs font-semibold text-gray-500">{item.type} • {item.date}</span>
            </div>
            <div className="flex gap-2">
              <button className="p-1.5 rounded-md text-gray-400 hover:text-green-400 hover:bg-green-400/10 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingReview;
