import React from 'react';
import AttackCard from './AttackCard';
import { Loader2 } from 'lucide-react';

const AttackList = ({ attacks, isFetching, onViewHypo, savedLibrary }) => {
  if (isFetching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-bold">Syncing latest threat intelligence...</p>
      </div>
    );
  }

  if (!attacks || attacks.length === 0) {
    return (
      <div className="text-gray-500 text-center py-20 bg-[#1a1d27] border border-[#2a2d3e] rounded-xl shadow-lg">
        No recent attacks found in the feed.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {attacks.map(attack => (
        <AttackCard 
          key={attack.id} 
          attack={attack} 
          onViewHypo={onViewHypo} 
          savedLibrary={savedLibrary}
        />
      ))}
    </div>
  );
};

export default AttackList;
