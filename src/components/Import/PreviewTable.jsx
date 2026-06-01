import React, { useMemo } from 'react';
import { mapRowToHypothesis } from '../../utils/excel';

const PreviewTable = ({ rows = [], columnMap = {}, onConfirm, onBack }) => {
  const { previewRows, validCount, errorCount } = useMemo(() => {
    let vCount = 0;
    let eCount = 0;
    
    const mappedData = rows.map(row => {
      const hyp = mapRowToHypothesis(row, columnMap);
      const isInvalid = !hyp.hypoName || !hyp.mitreId;
      if (isInvalid) eCount++;
      else vCount++;
      return { ...hyp, _isInvalid: isInvalid };
    });

    return {
      previewRows: mappedData,
      validCount: vCount,
      errorCount: eCount
    };
  }, [rows, columnMap]);

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-[#2a2d3e]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Preview Import</h2>
            <p className="text-sm text-gray-400">
              Preview (showing all {rows.length} rows)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium">
              {validCount} rows ready to import
            </span>
            {errorCount > 0 && (
              <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium">
                {errorCount} rows have errors
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0f1117] border-b border-[#2a2d3e]">
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Hypo Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">MITRE ID</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Month</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Result</th>
            </tr>
          </thead>
          <tbody className="bg-[#1a1d27] divide-y divide-[#2a2d3e]">
            {previewRows.map((row, index) => (
              <tr 
                key={index} 
                className={`hover:bg-[#1f2230] transition-colors ${row._isInvalid ? 'bg-red-500/5 hover:bg-red-500/10' : ''}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${row._isInvalid && !row.hypoName ? 'text-red-400 italic' : 'text-white'}`}>
                    {row.hypoName || 'Missing Name'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-mono ${row._isInvalid && !row.mitreId ? 'text-red-400 italic' : 'text-indigo-400'}`}>
                    {row.mitreId || 'Missing ID'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {row.month || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {row.status || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {row.result || '-'}
                </td>
              </tr>
            ))}
            {previewRows.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-500">
                  No data available to preview.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-6 border-t border-[#2a2d3e] flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg border border-[#2a2d3e] text-gray-300 hover:text-white hover:border-gray-500 font-medium transition-colors w-full sm:w-auto"
        >
          ← Back to mapping
        </button>
        <button
          disabled={validCount === 0}
          onClick={onConfirm}
          className={`px-8 py-2.5 rounded-lg font-bold transition-colors w-full sm:w-auto ${
            validCount === 0 
              ? 'bg-[#2a2d3e] text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          Import {validCount} hypotheses
        </button>
      </div>
    </div>
  );
};

export default PreviewTable;
