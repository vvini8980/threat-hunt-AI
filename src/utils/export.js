import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generatePDFReport = (hypotheses, month) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(22);
  doc.setTextColor(33, 33, 33);
  doc.text('Threat Hunt Campaign Report', 14, 22);
  
  // Subtitle
  doc.setFontSize(16);
  doc.setTextColor(99, 102, 241); // indigo-500
  doc.text(month, 14, 32);

  // Generated date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);

  // Calculate Stats
  const stats = {
    total: hypotheses.length,
    completed: hypotheses.filter(h => h.status === 'Completed' || h.status === 'Closed').length,
    active: hypotheses.filter(h => h.status === 'Active').length,
    tp: hypotheses.filter(h => h.result === 'TP').length,
    fp: hypotheses.filter(h => h.result === 'FP').length,
  };
  const tpRate = (stats.tp + stats.fp) > 0 ? Math.round((stats.tp / (stats.tp + stats.fp)) * 100) : 0;

  // Summary stats table
  doc.autoTable({
    startY: 48,
    head: [['Total', 'Active', 'Completed', 'TP', 'FP', 'TP Rate']],
    body: [[
      stats.total.toString(),
      stats.active.toString(),
      stats.completed.toString(),
      stats.tp.toString(),
      stats.fp.toString(),
      `${tpRate}%`
    ]],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241] }, // #6366f1
    styles: { halign: 'center', fontSize: 11 },
  });

  // Main hypotheses table
  const tableBody = hypotheses.map((h, index) => [
    h.id || (index + 1).toString(),
    h.hypoName || '-',
    h.mitreId || '-',
    h.status || '-',
    h.result || '-'
  ]);

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 15,
    head: [['ID', 'Hypo Name', 'MITRE ID', 'Status', 'Result']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] }, // #6366f1
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Confidential - Internal Use Only',
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  const filename = `HuntReport_${month.replace(/\s+/g, '')}.pdf`;
  doc.save(filename);
};
