import { useRef, useState } from 'react';
import { Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { addHypothesis, addAssignment, addComment } from '../../services/storage';
import { useToastContext } from '../../context/ToastContext';
import ColumnMapper from '../Import/ColumnMapper';
import { mapRowToHypothesis } from '../../utils/excel';

// Column mappings from Excel header → internal field name
const COLUMN_MAP = {
  // Hypothesis fields
  'Hypothesis Name': 'hypoName',
  'HypoName': 'hypoName',
  'MITRE ID': 'mitreId',
  'MitreID': 'mitreId',
  'Sub Technique': 'subTechnique',
  'SubTechnique': 'subTechnique',
  'Tactic': 'tactic',
  'Description': 'description',
  'Hunting Logic': 'huntingLogic',
  'HuntingLogic': 'huntingLogic',
  'SOC Rule': 'socDetectionRule',
  'SOC Detection Rule': 'socDetectionRule',
  'Splunk Query': 'splunkSPL',
  'SplunkSPL': 'splunkSPL',
  'QRadar Query': 'qradarAQL',
  'QRadarAQL': 'qradarAQL',
  'Sentinel Query': 'sentinelKQL',
  'SentinelKQL': 'sentinelKQL',
  // Assignment fields
  'Month': 'month',
  'Client Name': 'clientName',
  'ClientName': 'clientName',
  'Assigned Analyst': 'assignedAnalyst',
  'AssignedAnalyst': 'assignedAnalyst',
  'Status': 'status',
  'Result': 'result',
  'IsGeneral': 'isGeneral',
  'Planned Date': 'planned',
  'PlannedDate': 'planned',
  'Comments': 'commentsText',
};

// Template configs per mode
const TEMPLATES = {
  lead: {
    label: 'Lead Template',
    filename: 'Lead_Monthly_Upload_Template.xlsx',
    sheetName: 'Lead Upload',
    columns: {
      'Client Name': '',
      'Assigned Analyst': '',
      'Month': new Date().toISOString().slice(0, 7),
      'Status': 'Planned'
    }
  },
  hypotheses: {
    label: 'Hypotheses Template',
    filename: 'Hypotheses_Import_Template.xlsx',
    sheetName: 'Hypotheses',
    columns: {
      'Hypothesis Name': '',
      'MITRE ID': '',
      'Sub Technique': '',
      'Tactic': '',
      'Month': new Date().toISOString().slice(0, 7),
      'Description': '',
      'Hunting Logic': '',
      'SOC Rule': '',
      'Splunk Query': '',
      'QRadar Query': '',
      'Sentinel Query': '',
      'Result': '',
      'Comments': '',
    }
  }
};

const downloadTemplate = (mode) => {
  const tmpl = TEMPLATES[mode];
  const ws = XLSX.utils.json_to_sheet([tmpl.columns]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tmpl.sheetName);
  XLSX.writeFile(wb, tmpl.filename);
};

/**
 * QuickImport — a compact import button that can be dropped anywhere.
 * @param {string} mode - 'lead' | 'hypotheses'
 * @param {string} defaultMonth - pre-fill month for lead imports
 * @param {object} monthlyHypothesis - The master hypothesis for the month (used for lead imports)
 * @param {function} onDone - called after successful import
 */
export default function QuickImport({ mode = 'lead', defaultMonth = '', monthlyHypothesis = null, onDone }) {
  const fileRef = useRef(null);
  const { showToast } = useToastContext();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showMapper, setShowMapper] = useState(false);
  const [excelRows, setExcelRows] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      setImporting(true);
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      const actualColumns = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
      const rows = XLSX.utils.sheet_to_json(ws);



      setExcelHeaders(actualColumns);
      setExcelRows(rows);
      setShowMapper(true);
    } catch (error) {
      showToast(`Error reading file: ${error.message || error}`, 'error');
      setImporting(false);
    }
  };

  const handleMappingComplete = async (mapping) => {
    setShowMapper(false);
    setImporting(true);

    try {
      const valid = excelRows
        .map(row => mapRowToHypothesis(row, mapping))
        .map(h => {
          if (mode === 'lead') {
            return {
              ...h,
              hypothesis_id: null,
              month: h.month || defaultMonth || new Date().toISOString().slice(0, 7),
              status: h.status || 'Planned',
              isGeneral: false,
            };
          }
          return h;
        })
        .filter(h => {
          if (mode === 'lead') return h.clientName || h.assignedAnalyst;
          return h.hypoName && h.mitreId;
        });

      if (valid.length === 0) {
        showToast('No valid rows found after mapping.', 'error');
        setImporting(false);
        return;
      }

      setProgress({ done: 0, total: valid.length });

      for (let i = 0; i < valid.length; i++) {
        let added;
        if (mode === 'lead') {
          added = await addAssignment(valid[i]);
        } else {
          added = await addHypothesis(valid[i], { campaign: false });
        }
        
        if (valid[i].commentsText && added?.id) {
          await addComment(added.id, valid[i].commentsText, 'System Import');
        }
        setProgress({ done: i + 1, total: valid.length });
      }

      showToast(
        mode === 'lead'
          ? `✅ ${valid.length} monthly assignments imported!`
          : `✅ ${valid.length} hypotheses added to library!`,
        'success',
      );
      setImporting(false);
      if (onDone) onDone();

    } catch (err) {
      console.error(err);
      showToast(`Import failed: ${err.message}`, 'error');
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-row items-center gap-2 w-full sm:w-auto justify-center">
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />

      {/* Download template button */}
      <button
        onClick={() => downloadTemplate(mode)}
        title="Download template"
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#2a2d3e] text-gray-400 hover:text-white hover:border-gray-500 text-xs font-medium transition-colors whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        Template
      </button>

      {/* Import button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg whitespace-nowrap ${
          mode === 'lead'
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
            : 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {importing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Importing... ({progress.done}/{progress.total})</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {mode === 'lead' ? '📋 Assignments Import' : '📥 Import Hypotheses'}
          </>
        )}
      </button>

      {showMapper && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto text-left">
          <div className="w-full max-w-4xl bg-[#1a1d27] rounded-xl relative border border-[#2a2d3e]">
            <button 
              onClick={() => { setShowMapper(false); setImporting(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="p-2">
              <ColumnMapper 
                headers={excelHeaders} 
                onMappingComplete={handleMappingComplete}
                customFields={mode === 'lead' ? [
                  { key: 'clientName', label: 'Client Name', required: true },
                  { key: 'assignedAnalyst', label: 'Assigned Analyst' },
                  { key: 'month', label: 'Month' },
                  { key: 'status', label: 'Status' }
                ] : [
                  { key: 'hypoName', label: 'Hypothesis Name', required: true },
                  { key: 'mitreId', label: 'MITRE ID', required: true },
                  { key: 'subTechnique', label: 'Sub Technique' },
                  { key: 'tactic', label: 'Tactic' },
                  { key: 'month', label: 'Month' },
                  { key: 'description', label: 'Description' },
                  { key: 'huntingLogic', label: 'Hunting Logic' },
                  { key: 'socDetectionRule', label: 'SOC Rule' },
                  { key: 'splunkSPL', label: 'Splunk Query' },
                  { key: 'qradarAQL', label: 'QRadar Query' },
                  { key: 'sentinelKQL', label: 'Sentinel Query' },
                  { key: 'result', label: 'Result' },
                  { key: 'commentsText', label: 'Comments' }
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
