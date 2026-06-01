import * as XLSX from 'xlsx';

export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const mapRowToHypothesis = (row, columnMap) => {
  const hypothesis = {};
  
  Object.keys(columnMap).forEach(key => {
    const excelColumnName = columnMap[key];
    hypothesis[key] = row[excelColumnName] !== undefined ? row[excelColumnName] : '';
  });
  
  return hypothesis;
};

const formatDateForExport = (dateValue) => {
  if (!dateValue) return '';
  
  // Check if it's an Excel serial date number (e.g., 46165 or "46165")
  if (!isNaN(dateValue) && Number(dateValue) > 10000) {
    const utcDays = Math.floor(Number(dateValue) - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    return dateInfo.toISOString().slice(0, 10);
  }
  
  if (typeof dateValue === 'string') {
    return dateValue.slice(0, 10);
  }
  
  return String(dateValue);
};

export const exportToExcel = (hypotheses, filename, type = 'all') => {
  if (!hypotheses || hypotheses.length === 0) return;

  let exportData;

  if (type === 'individual') {
    exportData = hypotheses.map(h => ({
      "Client Name": h.clientName || '',
      "Assigned Analyst": h.assignedAnalyst || '',
      "Month": h.month || '',
      "Status": h.status || ''
    }));
  } else if (type === 'hypotheses') {
    exportData = hypotheses.map(h => ({
      "Hypothesis Name": h.hypoName || '',
      "MITRE ID": h.mitreId || '',
      "Sub Technique": h.subTechnique || '',
      "Tactic": h.tactic || '',
      "Month": h.month || '',
      "Description": h.description || '',
      "Hunting Logic": h.huntingLogic || '',
      "SOC Rule": h.socDetectionRule || '',
      "Splunk Query": h.splunkSPL || '',
      "QRadar Query": h.qradarAQL || '',
      "Result": h.result || '',
      "Comments": h.comments && h.comments.length > 0 ? h.comments.map(c => `${c.analyst || 'Analyst'}: ${c.text}`).join('\n') : '',
    }));
  } else {
    // Default / 'all' - mostly used by Campaigns.jsx
    exportData = hypotheses.map(h => ({
      "Hunt Purpose": h.hunt_purpose || '',
      "Hypothesis Name": h.hypoName || '',
      "MITRE ID": h.mitreId || '',
      "Sub Technique": h.subTechnique || '',
      "Tactic": h.tactic || '',
      "Month": h.month || '',
      "Status": h.status || '',
      "Planned Date": formatDateForExport(h.planned),
      "Client Name": h.clientName || '',
      "Assigned Analyst": h.assignedAnalyst || '',
      "Description": h.description || '',
      "Hunting Logic": h.huntingLogic || '',
      "SOC Rule": h.socDetectionRule || '',
      "Splunk Query": h.splunkSPL || '',
      "QRadar Query": h.qradarAQL || '',
      "Result": h.result || '',
      "Comments": h.comments && h.comments.length > 0 ? h.comments.map(c => `${c.analyst || 'Analyst'}: ${c.text}`).join('\n') : '',
    }));
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Hypotheses");

  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const generateExcelTemplate = () => {
  const emptyRow = {
    "Hypothesis Name": "",
    "MITRE ID": "",
    "Sub Technique": "",
    "Tactic": "",
    "Month": "",
    "Status": "",
    "Planned Date": "",
    "Client Name": "",
    "Assigned Analyst": "",
    "Description": "",
    "Hunting Logic": "",
    "SOC Rule": "",
    "Splunk Query": "",
    "QRadar Query": "",
    "Sentinel Query": "",
    "Result": "",
    "Comments": "",
  };

  const worksheet = XLSX.utils.json_to_sheet([emptyRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");

  XLSX.writeFile(workbook, "Hypothesis_Template.xlsx");
};
