import React from 'react';
import { CalendarClock, FileText, Download, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

const DailyReportBanner = ({ report, isGenerating, onManualGenerate }) => {
  if (isGenerating) {
    return (
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-4 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-indigo-300">Generating Daily Intel Report...</p>
          <p className="text-xs text-gray-500 mt-0.5">Collecting yesterday's IOC data and generating AI threat summary</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Daily Intel Report</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Scheduled at <span className="text-amber-400 font-semibold">12:00 AM</span> daily — collects all IOC intelligence from the previous day.
          </p>
        </div>
        <button
          onClick={onManualGenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" /> Run Now
        </button>
      </div>
    );
  }

  // Report exists
  const date = new Date(report.generated_at || report.created_at);
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const handleExportPDF = () => {
    if (report.download_url) {
      window.open(report.download_url, '_blank');
      return;
    }

    const dStr = formattedDate + ' ' + formattedTime;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Daily Intel Report - ${formattedDate}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #111; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            h1 { color: #000; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; margin-bottom: 10px; }
            .meta { color: #555; margin-bottom: 30px; font-size: 0.9em; display: flex; gap: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
            .meta div { display: flex; flex-direction: column; }
            .meta strong { color: #000; font-size: 1.2em; }
            .section { margin-top: 30px; }
            .ioc-list { font-family: monospace; background: #f5f5f5; padding: 15px; border-radius: 4px; font-size: 0.9em; border: 1px solid #ddd; }
            .ioc-list div { padding: 4px 0; border-bottom: 1px solid #eee; }
            .ioc-list div:last-child { border-bottom: none; }
          </style>
        </head>
        <body>
          <h1>Daily Proactive Intel Report</h1>
          <div class="meta">
            <div><span>Date</span><strong>${dStr}</strong></div>
            <div><span>Campaigns</span><strong>${report.attack_count || 0}</strong></div>
            <div><span>Threat Actors</span><strong>${report.actor_count || 0}</strong></div>
            <div><span>Total IOCs</span><strong>${report.ioc_count || 0}</strong></div>
          </div>
          
          <div class="section">
            <h2>Executive Summary</h2>
            <p>${report.summary ? report.summary.replace(/\n/g, '<br/>') : 'No summary available.'}</p>
          </div>

          <div class="section">
            <h2>Top IOCs</h2>
            ${report.top_iocs && report.top_iocs.length > 0 ? `
              <div class="ioc-list">
                ${report.top_iocs.map(ioc => `<div><strong>[${ioc.type}]</strong> ${ioc.value}</div>`).join('')}
              </div>
            ` : '<p>No IOCs extracted.</p>'}
          </div>

          ${report.campaigns && report.campaigns.length > 0 ? `
            <div class="section">
              <h2>Intel Campaigns (Last 24h)</h2>
              ${report.campaigns.map(camp => `
                <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
                  <h3 style="margin-top: 0; color: #1e3a8a;">${camp.name}</h3>
                  <div style="font-size: 0.9em; margin-bottom: 10px; color: #555;">
                    <strong>Actor:</strong> ${camp.metadata?.actor || 'Unknown'} | 
                    <strong>Target:</strong> ${camp.metadata?.targetSector || 'Unknown'} |
                    <strong>Confidence:</strong> ${camp.metadata?.confidence || 'Unknown'}
                  </div>
                  <p style="font-size: 0.95em;">${camp.poc?.hypothesis ? camp.poc.hypothesis.replace(/\n/g, '<br/>') : 'No description.'}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white">Daily Intel Report Ready</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {formattedDate} at {formattedTime}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {report.ioc_count > 0 && (
              <span className="text-xs text-gray-400">
                <span className="text-orange-400 font-bold">{report.ioc_count}</span> IOCs collected
              </span>
            )}
            {report.attack_count > 0 && (
              <span className="text-xs text-gray-400">
                <span className="text-red-400 font-bold">{report.attack_count}</span> threat campaigns
              </span>
            )}
            {report.actor_count > 0 && (
              <span className="text-xs text-gray-400">
                <span className="text-violet-400 font-bold">{report.actor_count}</span> threat actors
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onManualGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2a2d3e] text-gray-400 border border-[#3a3d4e] hover:text-white transition-colors"
          >
            <Sparkles className="w-3 h-3" /> Regenerate
          </button>
          
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            <Download className="w-3 h-3" /> Export PDF
          </button>
        </div>
      </div>

      {/* Summary text if available */}
      {report.summary && (
        <div className="mt-3 pt-3 border-t border-emerald-500/10">
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{report.summary}</p>
        </div>
      )}

      {/* Top IOCs from report */}
      {report.top_iocs && report.top_iocs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-500/10">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Yesterday's Top IOCs</p>
          <div className="flex flex-wrap gap-2">
            {report.top_iocs.slice(0, 6).map((ioc, i) => (
              <span
                key={i}
                onClick={() => navigator.clipboard.writeText(ioc.value)}
                title={`${ioc.type}: ${ioc.value} — Click to copy`}
                className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/30 text-gray-300 border border-[#2a2d3e] cursor-pointer hover:border-emerald-500/30 hover:text-emerald-400 transition-colors max-w-[160px] truncate"
              >
                {ioc.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReportBanner;
