import React, { useState, useEffect } from 'react';

const APP_FIELDS = [
  { key: 'hypoName', label: 'Hypothesis Name', required: true },
  { key: 'mitreId', label: 'MITRE ID', required: true },
  { key: 'subTechnique', label: 'Sub Technique' },
  { key: 'tactic', label: 'Tactic' },
  { key: 'month', label: 'Month' },
  { key: 'status', label: 'Status' },
  { key: 'planned', label: 'Planned Date' },
  { key: 'clientName', label: 'Client Name' },
  { key: 'assignedAnalyst', label: 'Assigned Analyst' },
  { key: 'isGeneral', label: 'General Hunt' },
  { key: 'description', label: 'Description' },
  { key: 'huntingLogic', label: 'Hunting Logic' },
  { key: 'socDetectionRule', label: 'SOC Detection Rule' },
  { key: 'splunkSPL', label: 'Splunk SPL' },
  { key: 'qradarAQL', label: 'QRadar AQL' },
  { key: 'sentinelKQL', label: 'Sentinel KQL' },
  { key: 'result', label: 'Result' }
];

const ColumnMapper = ({ headers = [], onMappingComplete, customFields = null }) => {
  const [mapping, setMapping] = useState({});
  const fieldsToUse = customFields || APP_FIELDS;

  useEffect(() => {
    const initialMap = {};
    fieldsToUse.forEach(field => {
      const match = headers.find(h => {
        const headerNorm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        const keyNorm = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
        return headerNorm === labelNorm || headerNorm === keyNorm;
      });
      initialMap[field.key] = match || '';
    });
    setMapping(initialMap);
  }, [headers, fieldsToUse]);

  const handleChange = (fieldKey, headerValue) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: headerValue
    }));
  };

  const isPreviewDisabled = fieldsToUse.filter(f => f.required).some(f => !mapping[f.key]);

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-6 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-2">Map Columns</h2>
      <p className="text-sm text-gray-400 mb-6">
        Match the columns from your Excel file to the exact fields used in the system.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 bg-[#0f1117] p-6 rounded-lg border border-[#2a2d3e]">
        {fieldsToUse.map(field => (
          <div key={field.key} className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 border-b border-[#2a2d3e] pb-3 last:border-0 md:border-0 md:pb-0">
            <label className="text-sm font-medium text-gray-300 w-full xl:w-1/2">
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>
            <select
              value={mapping[field.key] || ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="w-full xl:w-1/2 bg-[#1a1d27] border border-[#2a2d3e] rounded-lg px-3 py-2 text-gray-200 text-sm outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">-- Skip this field --</option>
              {headers.map(header => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[#2a2d3e] pt-6">
        <p className="text-sm text-gray-400">
          * Indicates a required field. You must map these before continuing.
        </p>
        <button
          disabled={isPreviewDisabled}
          onClick={() => onMappingComplete(mapping)}
          className={`px-8 py-2.5 rounded-lg font-medium transition-colors ${
            isPreviewDisabled 
              ? 'bg-[#2a2d3e] text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          Preview Import
        </button>
      </div>
    </div>
  );
};

export default ColumnMapper;
