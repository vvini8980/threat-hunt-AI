import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useToastContext } from '../../context/ToastContext';

export default function AssignmentEditPanel({ assignment, onClose, onSave }) {
  const [form, setForm] = useState({
    clientName: '',
    assignedAnalyst: '',
    month: '',
    planned: '',
    status: 'Planned',
    result: 'None'
  });
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToastContext();

  useEffect(() => {
    if (assignment) {
      setForm({
        clientName: assignment.clientName || '',
        assignedAnalyst: assignment.assignedAnalyst || '',
        month: assignment.month || '',
        planned: assignment.planned ? assignment.planned.slice(0, 10) : '',
        status: assignment.status || 'Planned',
        result: assignment.result || 'None'
      });
    }
  }, [assignment]);

  if (!assignment) return null;

  const handleField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(assignment.id, form);
      showToast('Assignment updated', 'success');
      onClose();
    } catch (error) {
      console.error(error);
      showToast('Failed to save assignment', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const labelClass = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2";
  const inputClass = "w-full rounded-lg bg-[#1a1d27] border border-[#2a2d3e] px-4 py-2.5 text-sm text-gray-200 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 hover:border-[#3a3d4e]";

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      {/* Side Panel */}
      <aside className="fixed right-0 top-0 z-50 h-screen w-[480px] max-w-full animate-[slideInRight_180ms_ease-out] border-l border-[#2a2d3e] bg-[#0f1117] shadow-[-24px_0_60px_rgba(0,0,0,0.45)] flex flex-col">
        <div className="flex h-16 items-center justify-between border-b border-[#2a2d3e] px-6 bg-[#1a1d27]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-400">
              Edit Assignment
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#2a2d3e] p-2 text-gray-400 transition-colors hover:border-gray-500 hover:bg-[#252840] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className={labelClass}>Client Name</label>
              <input
                className={inputClass}
                placeholder="e.g. Acme Corp"
                value={form.clientName}
                onChange={e => handleField('clientName', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>Assigned Analyst</label>
              <input
                className={inputClass}
                placeholder="e.g. John Doe"
                value={form.assignedAnalyst}
                onChange={e => handleField('assignedAnalyst', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Month</label>
                <input
                  type="month"
                  className={inputClass}
                  value={form.month}
                  onChange={e => handleField('month', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={e => handleField('status', e.target.value)}
                >
                  {['Planned', 'Active', 'Pending', 'Completed', 'Closed', 'Shared', 'ETA'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Planned / ETA Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.planned}
                  onChange={e => handleField('planned', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Result</label>
                <select
                  className={inputClass}
                  value={form.result}
                  onChange={e => handleField('result', e.target.value)}
                >
                  {['None', 'TP', 'FP', 'Undetermined'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-[#2a2d3e] flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg border border-[#2a2d3e] text-gray-300 font-semibold text-sm hover:bg-[#1a1d27] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
