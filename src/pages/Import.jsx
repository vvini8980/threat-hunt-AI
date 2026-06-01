import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/Import/FileUpload';
import ColumnMapper from '../components/Import/ColumnMapper';
import PreviewTable from '../components/Import/PreviewTable';
import { parseExcelFile, exportToExcel, generateExcelTemplate, mapRowToHypothesis } from '../utils/excel';
import { generatePDFReport } from '../utils/export';
import { addHypothesis } from '../services/storage';
import { useHypotheses } from '../hooks/useHypotheses';
import { useToastContext } from '../context/ToastContext';
import { Check, ChevronRight, FileText } from 'lucide-react';

function Import() {
  const navigate = useNavigate();
  const { hypotheses, refresh } = useHypotheses();
  const { showToast } = useToastContext();

  // Wizard State
  const [step, setStep] = useState(1);
  const [excelRows, setExcelRows] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMap, setColumnMap] = useState({});
  
  // Import Progress State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importSuccess, setImportSuccess] = useState(false);

  // Step Handlers
  const handleFileLoaded = (rows, headers) => {
    setExcelRows(rows);
    setExcelHeaders(headers);
    setStep(2);
  };

  const handleMappingComplete = (map) => {
    setColumnMap(map);
    setStep(3);
  };

  const handleConfirmImport = async () => {
    const validRows = excelRows.map(row => mapRowToHypothesis(row, columnMap))
      .filter(hyp => hyp.hypoName && hyp.mitreId);
    
    if (validRows.length === 0) return;

    setIsImporting(true);
    setImportTotal(validRows.length);
    setImportProgress(0);

    try {
      for (let i = 0; i < validRows.length; i++) {
        setImportProgress(i + 1);
        const hypToImport = { ...validRows[i] };
        const isCampaignRow = Boolean(hypToImport.month);
        await addHypothesis(hypToImport, { campaign: isCampaignRow });
      }
      
      await refresh();

      setIsImporting(false);
      setImportSuccess(true);
      showToast(`${validRows.length} hypotheses imported`, 'success');
    } catch (error) {
      setIsImporting(false);
      showToast(`Import failed: ${error.message || error}`, 'error');
    }
  };

  const handleExportAll = () => {
    exportToExcel(hypotheses, 'All_Hypotheses');
    showToast('Export downloaded', 'info');
  };

  const handleExportPDF = () => {
    generatePDFReport(hypotheses, 'All Time');
    showToast('PDF report downloaded', 'info');
  };

  return (
    <section className="min-h-full bg-bg-primary p-6 text-white max-w-5xl mx-auto">
      <h2 className="mb-8 text-3xl font-bold">Import & Export</h2>

      {/* Wizard Flow Container */}
      <div className="mb-10">
        
        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-between gap-2 rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-4 md:justify-start md:gap-4">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Map Columns' },
            { num: 3, label: 'Preview' }
          ].map((s, idx) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            let bgColor = 'bg-[#2a2d3e] text-gray-400';
            if (isCompleted) {
              bgColor = 'bg-green-500/20 text-green-400';
            } else if (isCurrent) {
              bgColor = 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20';
            }

            return (
              <React.Fragment key={s.num}>
                <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${bgColor}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    isCompleted ? 'bg-green-500 text-[#1a1d27]' : isCurrent ? 'bg-white text-indigo-600' : 'bg-gray-500 text-[#1a1d27]'
                  }`}>
                    {isCompleted ? <Check className="h-3 w-3" /> : s.num}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {idx < 2 && <ChevronRight className="h-5 w-5 text-gray-500" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Wizard Content */}
        {!importSuccess ? (
          <div>
            {step === 1 && (
              <FileUpload onFileLoaded={handleFileLoaded} />
            )}
            {step === 2 && (
              <ColumnMapper 
                headers={excelHeaders} 
                onMappingComplete={handleMappingComplete} 
              />
            )}
            {step === 3 && (
              <div className="relative">
                {isImporting && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#2a2d3e] border-t-indigo-500"></div>
                    <p className="text-lg font-bold text-white">
                      Importing {importProgress} of {importTotal}...
                    </p>
                  </div>
                )}
                <PreviewTable 
                  rows={excelRows} 
                  columnMap={columnMap}
                  onBack={() => setStep(2)}
                  onConfirm={handleConfirmImport}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[#2a2d3e] bg-[#1a1d27] py-16 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="mb-2 text-2xl font-bold text-white">Import Complete</h3>
            <p className="mb-8 text-gray-400">
              ✅ {importTotal} hypotheses imported successfully
            </p>
            <button 
              onClick={() => navigate('/hypotheses')}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-700"
            >
              View Hypotheses
            </button>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-6">
        <h3 className="mb-4 text-lg font-bold text-white">Export Hypotheses</h3>
        <p className="mb-6 text-sm text-gray-400">
          Download a blank template to fill out, or export all your existing hypotheses to a spreadsheet or PDF.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row flex-wrap">
          <button 
            onClick={generateExcelTemplate}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#2a2d3e] px-6 py-2.5 text-white transition-colors hover:border-gray-500 hover:bg-[#252836]"
          >
            📥 Download Excel Template
          </button>
          <button 
            onClick={handleExportAll}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#2a2d3e] px-6 py-2.5 text-white transition-colors hover:bg-[#353849]"
          >
            📤 Export All to Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-white transition-colors hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
          >
            <FileText className="w-5 h-5" />
            Export All to PDF
          </button>
        </div>
      </div>
    </section>
  );
}

export default Import;
