import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHypotheses } from '../hooks/useHypotheses';
import { getMonthlyStats, updateHypothesis, addComment, getMonthlyPurpose, saveMonthlyPurpose } from '../services/storage';
import { exportToExcel } from '../utils/excel';
import QuickImport from '../components/Common/QuickImport';
import HypoDetail from '../components/Hypotheses/HypoDetail';
import AssignmentEditPanel from '../components/Assignments/AssignmentEditPanel';
import { 
  ChevronLeft, ChevronRight, Calendar, 
  Target, CheckCircle, Activity, 
  ShieldCheck, AlertTriangle, Users, Clock,
  FileSpreadsheet, Edit, Check, X, Trash2
} from 'lucide-react';
import { useToastContext } from '../context/ToastContext';
import { ResultCell } from '../components/Common/StatusBadge';

const getStatusColor = (status) => {
  switch (status) {
    case 'Active': return 'bg-blue-500';
    case 'Planned': return 'bg-yellow-500';
    case 'Completed': return 'bg-green-500';
    case 'Closed': return 'bg-gray-500';
    case 'Pending': return 'bg-purple-500';
    case 'Shared': return 'bg-teal-500';
    case 'ETA': return 'bg-orange-500';
    default: return 'bg-gray-500';
  }
};

const StatusBadge = ({ status }) => {
  const colors = {
    Active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Planned: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    Closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    Pending: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Shared: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    ETA: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  const cls = colors[status] || colors.Closed;
  return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${cls}`}>{status}</span>;
};

const getDropdownStyle = (status) => {
  switch (status) {
    case 'Completed':
      return 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20';
    case 'Shared':
      return 'bg-teal-500/10 text-teal-400 border-teal-500/30 hover:bg-teal-500/20';
    case 'ETA':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20';
    case 'Pending':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20';
    case 'Active':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20';
    case 'Planned':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20';
  }
};



function Campaigns() {
  const navigate = useNavigate();
  const { hypotheses, assignments, refresh, updateAssignment, add, removeAssignment } = useHypotheses();
  const { showToast } = useToastContext();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthsData, setMonthsData] = useState([]);
  
  // Inline edit state removed - direct dropdown & date picker are used instead

  // Side panel state
  const [selectedHypo, setSelectedHypo] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);

  // Month status state (Drafted vs Production)
  const [monthStatus, setMonthStatus] = useState('Drafted');

  // Status sorting state
  const [statusSortDirection, setStatusSortDirection] = useState('none');

  useEffect(() => {
    setMonthStatus(localStorage.getItem(`campaign_status_${selectedMonth}`) || 'Drafted');
  }, [selectedMonth]);

  const toggleMonthStatus = (newStatus) => {
    setMonthStatus(newStatus);
    localStorage.setItem(`campaign_status_${selectedMonth}`, newStatus);
    showToast(`Campaign set to ${newStatus}`, 'success');
  };

  // Hunt purpose — one editable label per month
  const [huntPurpose, setHuntPurpose] = useState('');
  const [editingPurpose, setEditingPurpose] = useState(false);
  const [purposeDraft, setPurposeDraft] = useState('');

  useEffect(() => {
    const loadPurpose = async () => {
      const saved = await getMonthlyPurpose(selectedMonth);
      setHuntPurpose(saved || '');
    };
    loadPurpose();
    setEditingPurpose(false);
  }, [selectedMonth]);

  const savePurpose = async () => {
    const trimmed = purposeDraft.trim();
    setHuntPurpose(trimmed);
    setEditingPurpose(false);
    
    const success = await saveMonthlyPurpose(selectedMonth, trimmed);
    if (success) {
      showToast('Hunt purpose saved globally', 'success');
    } else {
      showToast('Failed to save hunt purpose to database', 'error');
    }
  };

  const startEditPurpose = () => {
    setPurposeDraft(huntPurpose);
    setEditingPurpose(true);
  };

  useEffect(() => {
    const data = getMonthlyStats(assignments);
    setMonthsData(data);
  }, [assignments]);

  // Keep selectedHypo in sync with any updates made in the side panel
  useEffect(() => {
    if (selectedHypo) {
      // Check if it's an assignment or a hypothesis by looking for hypothesis_id
      if (selectedHypo.hypothesis_id) {
        const updated = assignments.find(a => a.id === selectedHypo.id);
        if (updated && JSON.stringify(updated) !== JSON.stringify(selectedHypo)) {
          setSelectedHypo(updated);
        }
      } else {
        const updated = hypotheses.find(h => h.id === selectedHypo.id);
        if (updated && JSON.stringify(updated) !== JSON.stringify(selectedHypo)) {
          setSelectedHypo(updated);
        }
      }
    }
  }, [assignments, hypotheses, selectedHypo]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const isCurrentMonth = selectedMonth === currentMonthKey;

  const editCampaignHref = (row) => {
    const hypoId = row.hypothesis_id || row.id;
    const assignId = row.id; // row is the assignment row
    return `/edit/${hypoId}?month=${selectedMonth}&from=campaigns&assignId=${assignId}`;
  };



  // Normalize legacy "Month YYYY" or Excel Serial to "YYYY-MM" for comparison
  const toYYYYMM = (m) => {
    if (!m) return '';
    if (!isNaN(m) && Number(m) > 10000) {
      const utcDays = Math.floor(Number(m) - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    const str = String(m);
    if (str.match(/^\d{4}-\d{2}$/)) return str;
    try {
      const realDate = new Date(str);
      if (!isNaN(realDate)) {
        return `${realDate.getFullYear()}-${String(realDate.getMonth() + 1).padStart(2, '0')}`;
      }
    } catch (e) {}
    return str;
  };

  const allMonths = Array.from(
    new Set([
      ...monthsData.map(d => d.month),
      ...hypotheses.map(h => toYYYYMM(h.month)),
      selectedMonth
    ].filter(Boolean))
  ).sort();
  
  const currentIndex = allMonths.indexOf(selectedMonth);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allMonths.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) setSelectedMonth(allMonths[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) setSelectedMonth(allMonths[currentIndex + 1]);
  };

  const formatMonth = (monthValue) => {
    if (!monthValue) return 'Unknown Month';
    try {
      const parts = monthValue.split('-');
      if (parts.length === 2) {
        const year = Number(parts[0]);
        const monthIndex = Number(parts[1]);
        if (!isNaN(year) && !isNaN(monthIndex)) {
          const date = new Date(year, monthIndex - 1, 1);
          return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
        }
      }
      return monthValue;
    } catch (e) {
      return monthValue;
    }
  };

  const currentStats = monthsData.find(d => d.month === selectedMonth);
  const totalHypotheses = currentStats ? currentStats.total : 0;

  const handleDateChange = async (id, newDate) => {
    try {
      await updateAssignment(id, { planned: newDate });
      refresh();
      showToast('Date updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update date', 'error');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateAssignment(id, { status: newStatus });
      refresh();
      showToast('Status updated', 'success');
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleAddComment = async (id, text, analyst, resultValue) => {
    try {
      const target = assignments.find(a => a.id === id);
      const hypoId = target?.hypothesis_id || id;
      await addComment(hypoId, text, analyst, resultValue);
      refresh();
    } catch (error) {
      showToast('Failed to add comment', 'error');
    }
  };

  // Derive stats based on selectedMonth filtering
  const monthHypotheses = assignments.filter(h => toYYYYMM(h.month) === selectedMonth);

  // All assignments for the month
  const campaignAssignments = monthHypotheses;

  // All hypotheses scheduled for this month
  const monthFilteredHypotheses = hypotheses.filter(hypo => toYYYYMM(hypo.month) === selectedMonth);

  const sortedCampaignAssignments = [...campaignAssignments].sort((a, b) => {
    if (statusSortDirection === 'none') return 0;
    const statusA = a.status || '';
    const statusB = b.status || '';
    if (statusSortDirection === 'asc') {
      return statusA.localeCompare(statusB);
    } else {
      return statusB.localeCompare(statusA);
    }
  });

  const toggleStatusSort = () => {
    if (statusSortDirection === 'none') setStatusSortDirection('asc');
    else if (statusSortDirection === 'asc') setStatusSortDirection('desc');
    else setStatusSortDirection('none');
  };

  // Group individual hunts by analyst
  const byAnalyst = campaignAssignments.reduce((acc, h) => {
    const key = h.assignedAnalyst || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  // Group by client
  const byClient = monthHypotheses.reduce((acc, h) => {
    const key = h.clientName || 'No Client';
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  const stats = {
    total: monthHypotheses.length,
    completed: monthHypotheses.filter(h => h.status === 'Completed' || h.status === 'Closed').length,
    active: monthHypotheses.filter(h => h.status === 'Active').length,
    planned: monthHypotheses.filter(h => h.status === 'Planned').length,
    shared: monthHypotheses.filter(h => h.status === 'Shared').length,
    tp: monthHypotheses.filter(h => h.result === 'TP').length,
    fp: monthHypotheses.filter(h => h.result === 'FP').length,
  };

  const tpRate = (stats.tp + stats.fp) > 0 ? Math.round((stats.tp / (stats.tp + stats.fp)) * 100) : 0;
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const statCardClass = "flex flex-col gap-2 rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-5 shadow-lg";


  return (
    <section className="min-h-full bg-bg-primary p-6 text-white pb-24">
      
      {/* Header & Month Selector */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#2a2d3e] pb-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Monthly Campaigns</h2>
          <p className="text-sm text-gray-400 mb-4 max-w-xl">
            Current month hunting plan — lead uploads assignments here. The Hypothesis Library holds all hunt definitions.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonthKey)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10"
              >
                Jump to current month
              </button>
            )}
            {isCurrentMonth && (
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Viewing current month
              </span>
            )}
            <div className="flex items-center gap-4 bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-2 shadow-lg">
              <button 
                onClick={handlePrevious}
                disabled={!hasPrevious}
                className={`p-2 rounded-lg transition-colors ${!hasPrevious ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:text-white hover:bg-[#252840]'}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="relative flex items-center group">
                <Calendar className="w-4 h-4 text-indigo-400 absolute left-3 pointer-events-none" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-transparent text-white font-bold text-lg py-1 pl-10 pr-6 outline-none cursor-pointer hover:text-indigo-300 transition-colors"
                >
                  {allMonths.map(m => (
                    <option key={m} value={m} className="bg-[#1a1d27] text-white">
                      {formatMonth(m)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              <button 
                onClick={handleNext}
                disabled={!hasNext}
                className={`p-2 rounded-lg transition-colors ${!hasNext ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:text-white hover:bg-[#252840]'}`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Drafted / Production Toggle */}
            <div className="flex items-center rounded-lg bg-[#1a1d27] p-1 border border-[#2a2d3e] shadow-sm">
              <button
                onClick={() => toggleMonthStatus('Drafted')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-colors ${monthStatus === 'Drafted' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'text-gray-500 hover:text-white'}`}
              >
                <AlertTriangle className="w-4 h-4" /> Drafted
              </button>
              <button
                onClick={() => toggleMonthStatus('Production')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-colors ${monthStatus === 'Production' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'text-gray-500 hover:text-white'}`}
              >
                <CheckCircle className="w-4 h-4" /> Production
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Import + Export Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 self-stretch md:self-end md:mb-2">
          <QuickImport
            mode="hypotheses"
            onDone={refresh}
          />
          <div className="hidden sm:block w-px h-6 bg-[#2a2d3e]" />
          <QuickImport
            mode="lead"
            defaultMonth={selectedMonth}
            monthlyHypothesis={monthHypotheses.length > 0 ? monthHypotheses[0] : null}
            onDone={refresh}
          />
          <div className="hidden sm:block w-px h-6 bg-[#2a2d3e]" />
          <button
            onClick={() => {
              exportToExcel(monthHypotheses, `MonthlyHunts_${formatMonth(selectedMonth).replace(/\s+/g, '')}`);
              showToast("Excel file downloaded", "info");
            }}
            disabled={monthHypotheses.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-green-500/50 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className={statCardClass}>
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Hypotheses</span>
            <Target className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-bold text-indigo-400">
              {monthFilteredHypotheses.length}
            </span>
            <span className="text-xs font-medium text-gray-500 mt-1 tracking-wide uppercase">
              {campaignAssignments.length} ASSIGNMENTS
            </span>
          </div>
        </div>
        
        <div className={statCardClass}>
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Clients</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-bold text-blue-400">
              {Array.from(new Set(campaignAssignments.map(a => a.clientName).filter(Boolean))).length}
            </span>
            <span className="text-xs font-medium text-gray-500 mt-1 tracking-wide uppercase">
              <span className="text-teal-400">{campaignAssignments.filter(a => a.status === 'Shared').length}</span> Shared / <span className="text-green-400">{campaignAssignments.filter(a => a.status === 'Completed').length}</span> Completed
            </span>
          </div>
        </div>

        <div className={statCardClass}>
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Pending / Planned / ETA</span>
            <Clock className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-2xl font-bold text-yellow-400">{campaignAssignments.filter(a => a.status === 'Pending').length}</span>
            <span className="text-lg font-bold text-gray-500 mb-0.5">/</span>
            <span className="text-2xl font-bold text-indigo-300">{campaignAssignments.filter(a => a.status === 'Planned').length}</span>
            <span className="text-lg font-bold text-gray-500 mb-0.5">/</span>
            <span className="text-2xl font-bold text-orange-400">{campaignAssignments.filter(a => a.status === 'ETA').length}</span>
          </div>
        </div>

        <div className={statCardClass}>
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">TP / FP</span>
            <ShieldCheck className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-3xl font-bold text-green-500">{campaignAssignments.filter(a => a.result === 'TP').length}</span>
            <span className="text-xl font-bold text-gray-500 mb-1">/</span>
            <span className="text-3xl font-bold text-red-400">{campaignAssignments.filter(a => a.result === 'FP').length}</span>
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Completion Rate */}
        <div className="rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-5 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span className="text-white">Completion Rate: {stats.completed} of {stats.total} assignments complete</span>
            <span className="text-indigo-400 font-bold">{completionRate}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#2a2d3e]">
            <div 
              className="h-full rounded-full bg-indigo-500 transition-all duration-700" 
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* TP Rate */}
        <div className="rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-5 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span className="text-white">TP Rate: {stats.tp} TP / {stats.tp + stats.fp} Tested</span>
            <span className="text-green-500 font-bold">{tpRate}% true positive rate</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#2a2d3e]">
            <div 
              className="h-full rounded-full bg-green-500 transition-all duration-700" 
              style={{ width: `${tpRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scheduled Hypotheses Table */}
      <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/5 overflow-hidden shadow-xl mb-8">
        <div className="p-5 border-b border-indigo-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-indigo-500/10">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              📋 Monthly Hypotheses
            </h3>
            
            <span className="hidden md:block text-gray-500 font-bold text-lg">-</span>

            {/* Inline-editable hunt purpose */}
            {editingPurpose ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={purposeDraft}
                  onChange={e => setPurposeDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePurpose(); if (e.key === 'Escape') setEditingPurpose(false); }}
                  placeholder="e.g. Exfiltration in Cloud"
                  className="text-lg font-bold bg-indigo-900/40 border border-indigo-500/50 rounded px-3 py-1 text-indigo-300 placeholder-indigo-400/50 outline-none focus:border-indigo-400 w-80"
                />
                <button onClick={savePurpose} className="text-green-400 hover:text-green-300">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingPurpose(false)} className="text-gray-400 hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditPurpose}
                className="flex items-center gap-2 group"
                title="Click to set hunt purpose"
              >
                {huntPurpose ? (
                  <span className="text-lg text-[#00f2fe] font-bold tracking-wide group-hover:text-indigo-200 transition-colors drop-shadow-[0_0_8px_rgba(0,242,254,0.4)]">
                    🎯 {huntPurpose}
                  </span>
                ) : (
                  <span className="text-lg text-indigo-500/70 italic font-semibold group-hover:text-indigo-400 transition-colors">
                    + Set hunt purpose...
                  </span>
                )}
                <Edit className="w-4 h-4 text-indigo-500/50 group-hover:text-indigo-400 transition-colors" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                exportToExcel(
                  monthFilteredHypotheses.map(h => ({ ...h, hunt_purpose: huntPurpose })),
                  `Monthly_Hypotheses_${formatMonth(selectedMonth).replace(/\s+/g, '')}`
                );
                showToast("Monthly Hypotheses exported to Excel", "success");
              }}
              disabled={monthFilteredHypotheses.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <span className="px-3 py-1.5 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-lg border border-indigo-500/30">
              {monthFilteredHypotheses.length} Active
            </span>
          </div>
        </div>
        {(() => {
          if (monthFilteredHypotheses.length === 0) return (
                <div className="p-8 text-center bg-[#1a1d27]">
                  <p className="text-gray-500 text-sm">No hypotheses scheduled for this month.</p>
                  <button onClick={() => navigate('/hypotheses')} className="mt-3 text-indigo-400 text-sm hover:text-indigo-300">
                    Go to Library to schedule a hypothesis
                  </button>
                </div>
              );

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#0f1117] text-xs uppercase tracking-wide text-gray-400 border-b border-indigo-500/20">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-1/3">Hypothesis Name</th>
                        <th className="px-4 py-3 font-semibold">Description</th>
                        <th className="px-4 py-3 font-semibold">Mitre Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-500/10">
                      {monthFilteredHypotheses.map((hypo, index) => (
                        <tr 
                          key={hypo.id}
                          onClick={() => setSelectedHypo(hypo)}
                          className={`transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-[#1a1d27]' : 'bg-[#1e2130]/45'} hover:bg-indigo-500/10`}
                        >
                          <td className="px-4 py-3 text-white font-medium hover:text-indigo-300">
                            {hypo.hypoName}
                          </td>
                          <td className="px-4 py-3 text-gray-300 whitespace-normal">
                            <div className="line-clamp-2" title={hypo.description}>
                              {hypo.description || <span className="italic text-gray-500">No description provided</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-xs font-mono">
                              {hypo.mitreId || '--'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
      </div>

      {/* Campaign Assignments Table */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">👤 Campaign Assignments</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                exportToExcel(campaignAssignments, `Campaign_Assignments_${formatMonth(selectedMonth).replace(/\s+/g, '')}`, 'individual');
                showToast("Assignments exported to Excel", "success");
              }}
              disabled={campaignAssignments.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500/50 text-green-400 hover:bg-green-500/10 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Table</span>
            </button>
            <button
              onClick={() => navigate(`/add?type=individual&month=${selectedMonth}&from=campaigns`)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg"
            >
              + Add Assignment
            </button>
          </div>
        </div>
        {campaignAssignments.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[#2a2d3e] bg-[#1a1d27] shadow-xl">
            <div className="overflow-auto resize-y min-h-[200px] h-[400px]">
              <table className="w-full text-left text-sm whitespace-nowrap relative">
                <thead className="bg-[#0f1117] text-xs uppercase tracking-wide text-gray-400 border-b border-[#2a2d3e] sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Analyst</th>
                    <th className="px-4 py-3 font-semibold">Month</th>
                    <th 
                      className="px-4 py-3 font-semibold cursor-pointer hover:text-indigo-300 select-none flex items-center gap-1"
                      onClick={toggleStatusSort}
                      title="Click to sort by status"
                    >
                      Status / Date
                      {statusSortDirection === 'asc' && <span className="text-xs">▲</span>}
                      {statusSortDirection === 'desc' && <span className="text-xs">▼</span>}
                      {statusSortDirection === 'none' && <span className="text-xs text-gray-600">↕</span>}
                    </th>
                    <th className="px-4 py-3 font-semibold text-right">Edit / Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2d3e]">
                  {sortedCampaignAssignments.map((hypo, index) => (
                    <tr 
                      key={hypo.id}
                      className={`transition-colors ${index % 2 === 0 ? 'bg-[#1a1d27]' : 'bg-[#1e2130]/45'}`}
                    >
                      <td className="px-4 py-3 text-gray-300 font-bold">
                        {hypo.clientName ? (
                          <span className="flex items-center gap-2">🏢 {hypo.clientName}</span>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3 text-indigo-300 font-medium">
                        {hypo.assignedAnalyst || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-medium">
                        {hypo.month || '--'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-xs">
                          <div className="relative flex items-center">
                            <select
                              value={hypo.status || 'Pending'}
                              onChange={(e) => handleStatusChange(hypo.id, e.target.value)}
                              className={`appearance-none font-semibold text-xs rounded-full border pl-3 pr-6 py-1 outline-none cursor-pointer transition-colors ${getDropdownStyle(hypo.status)}`}
                            >
                              <option value="Pending" className="bg-[#1a1d27] text-purple-400 font-semibold">Pending</option>
                              <option value="Completed" className="bg-[#1a1d27] text-green-400 font-semibold">Completed</option>
                              <option value="Shared" className="bg-[#1a1d27] text-teal-400 font-semibold">Shared</option>
                              <option value="ETA" className="bg-[#1a1d27] text-orange-400 font-semibold">ETA</option>
                              <option value="Planned" className="bg-[#1a1d27] text-yellow-400 font-semibold">Planned</option>
                              <option value="Active" className="bg-[#1a1d27] text-blue-400 font-semibold">Active</option>
                              <option value="Closed" className="bg-[#1a1d27] text-gray-400 font-semibold">Closed</option>
                            </select>
                            <div className="pointer-events-none absolute right-2 flex items-center">
                              <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                          </div>
                          {hypo.status === 'ETA' && (
                            <input
                              type="date"
                              value={hypo.planned ? hypo.planned.slice(0, 10) : ''}
                              onChange={(e) => handleDateChange(hypo.id, e.target.value)}
                              className="bg-[#1e1a17] border border-orange-500/30 hover:border-orange-500/60 rounded-lg px-2.5 py-1 text-xs text-orange-300 font-semibold outline-none focus:border-orange-500 transition-colors w-[135px]"
                              title="ETA Date for client report"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingAssignment(hypo)}
                            className="p-2 rounded-md text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                            title="Edit assignment details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Delete this assignment? This cannot be undone.')) {
                                removeAssignment(hypo.id);
                                showToast('Assignment deleted', 'success');
                              }
                            }}
                            className="p-2 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Delete assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#2a2d3e] bg-[#1a1d27] p-8 text-center shadow-xl">
            <p className="text-gray-500 text-sm">No assignments for this month.</p>
            <button
              onClick={() => navigate('/add')}
              className="mt-3 text-indigo-400 text-sm hover:text-indigo-300 transition-colors"
            >
              + Assign a Hunt
            </button>
          </div>
        )}
      </div>

      {/* Side Panel for Hypothesis Details */}
      <HypoDetail
        hypothesis={selectedHypo}
        onClose={() => setSelectedHypo(null)}
        onEdit={() => selectedHypo && navigate(`/edit/${selectedHypo.hypothesis_id || selectedHypo.id}?from=campaigns&mode=hypothesis`)}
        currentStatus={selectedHypo?.status}
        onStatusChange={handleStatusChange}
        comments={selectedHypo?.comments}
        onAddComment={handleAddComment}
        onSaveSuccess={refresh}
      />

      {/* Side Panel for Editing Assignment */}
      <AssignmentEditPanel 
        assignment={editingAssignment}
        onClose={() => setEditingAssignment(null)}
        onSave={async (id, data) => {
          await updateAssignment(id, data);
        }}
      />
    </section>
  );
}

export default Campaigns;
