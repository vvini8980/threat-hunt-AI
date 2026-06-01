import { useState, useRef, useEffect, useCallback } from 'react'
import { Edit, X, Trash2 } from 'lucide-react'
import { QueryTabs } from '../Common/QueryTabs'
import { ResultCell, StatusBadge } from '../Common/StatusBadge'
import { useToastContext } from '../../context/ToastContext'
import { useHypotheses } from '../../hooks/useHypotheses'
import { useNavigate } from 'react-router-dom'

const STATUS_STEPS = ['Planned', 'Active', 'Pending', 'Completed', 'Closed']

function HypoDetail({
  hypothesis,
  onClose,
  onEdit,
  currentStatus,
  onStatusChange,
  onSaveSuccess,
  comments,
  onAddComment,
}) {
  const [commentText, setCommentText] = useState('')
  const [analyst, setAnalyst] = useState('Analyst')
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [commentResult, setCommentResult] = useState('Neutral')

  const { showToast } = useToastContext()
  const { remove, update } = useHypotheses()
  const navigate = useNavigate()

  // --- Resize Logic ---
  const [panelWidth, setPanelWidth] = useState(520)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef(null)

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      // Calculate new width: window width minus mouse X position
      // Max width: 50vw, Min width: 400px
      const newWidth = window.innerWidth - e.clientX
      const maxW = window.innerWidth * 0.5
      setPanelWidth(Math.max(400, Math.min(newWidth, maxW)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }, [isResizing])
  // --------------------

  if (!hypothesis) return null

  const displayComments = comments || hypothesis.comments || []
  const activeStatus = currentStatus || hypothesis.status || 'Planned'
  const currentIndex = Math.max(STATUS_STEPS.indexOf(activeStatus), 0)
  const createdDate = hypothesis.createdAt
    ? new Date(hypothesis.createdAt).toLocaleDateString()
    : '--'
  const sectionClass = 'rounded-xl border border-[#2a2d3e] bg-[#0f1117] p-4'
  const labelClass = 'mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500'
  const inputClass = 'w-full rounded-lg bg-[#1a1d27] border border-[#2a2d3e] px-4 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-indigo-500 hover:border-[#3a3d4e]'

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '--'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date(timestamp))
      .replace(',', '')
  }

  const handleAddComment = () => {
    const text = commentText.trim()
    const analystName = analyst.trim() || 'Analyst'

    if (!text) return

    let finalResult = null;
    let finalText = text;

    if (commentResult === 'TP') {
      finalResult = 'TP';
      finalText = `[TP] ${text}`;
    } else if (commentResult === 'FP') {
      finalResult = 'FP';
      finalText = `[FP] ${text}`;
    }

    onAddComment?.(hypothesis.id, finalText, analystName, finalResult)
    setCommentText('')
    setCommentResult('Neutral')
    showToast('Comment added', 'success')
  }

  const handleStatusChange = (status) => {
    onStatusChange?.(status)
    showToast('Status updated to ' + status, 'success')
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this hypothesis?')) {
      const targetId = hypothesis.hypothesis_id || hypothesis.id
      remove(targetId)
      showToast('Hypothesis deleted', 'error')
      onClose()
      navigate('/hypotheses')
    }
  }

  const toggleEdit = () => {
    if (!isEditing) {
      setForm({
        hypoName: hypothesis.hypoName || '',
        mitreId: hypothesis.mitreId || '',
        tactic: hypothesis.tactic || '',
        subTechnique: hypothesis.subTechnique || '',
        month: hypothesis.month || '',
        planned: hypothesis.planned || '',
        description: hypothesis.description || '',
        huntingLogic: hypothesis.huntingLogic || '',
        socDetectionRule: hypothesis.socDetectionRule || '',
        splunkSPL: hypothesis.splunkSPL || '',
        qradarAQL: hypothesis.qradarAQL || '',
        sentinelKQL: hypothesis.sentinelKQL || ''
      })
      setIsEditing(true)
    } else {
      setIsEditing(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const targetId = hypothesis.hypothesis_id || hypothesis.id
      const assignId = hypothesis.hypothesis_id ? hypothesis.id : null
      await update(targetId, form, assignId)
      showToast('Hypothesis updated', 'success')
      setIsEditing(false)
      onSaveSuccess?.()
      // Note: hypothesis prop might not update immediately depending on parent state, 
      // but if the parent pulls from the store, it will re-render.
    } catch (err) {
      console.error(err)
      showToast('Failed to save', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop Overlay */}
      <div 
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
        aria-label="Close details overlay"
      />
      <aside 
        className="fixed right-0 top-0 z-50 h-screen max-w-full animate-[slideInRight_180ms_ease-out] border-l border-[#2a2d3e] bg-[#1a1d27] shadow-[-24px_0_60px_rgba(0,0,0,0.45)] flex"
        style={{ width: `${panelWidth}px` }}
      >
        {/* Resize Handle */}
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          className="w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 absolute left-0 top-0 z-10 transition-colors"
          title="Drag to resize"
        />

        <div className="flex-1 overflow-y-auto flex flex-col h-full w-full">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#2a2d3e] px-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Hypothesis Detail
              </p>
              <h2 className="text-lg font-semibold text-white">
                {hypothesis.hypoName || 'Untitled Hypothesis'}
              </h2>
            </div>

          <div className="flex items-center gap-2">
            <button
              aria-label={isEditing ? "Cancel editing" : "Edit hypothesis"}
              onClick={toggleEdit}
              className={`rounded-lg border p-2 transition-colors ${
                isEditing 
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                  : 'border-[#2a2d3e] text-gray-400 hover:border-indigo-500/50 hover:bg-indigo-500/15 hover:text-indigo-300'
              }`}
            >
              <Edit size={18} />
            </button>
            <button
              aria-label="Delete hypothesis"
              onClick={handleDelete}
              className="rounded-lg border border-[#2a2d3e] p-2 text-gray-400 transition-colors hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-300"
            >
              <Trash2 size={18} />
            </button>
            <button
              aria-label="Close details"
              onClick={onClose}
              className="rounded-lg border border-[#2a2d3e] p-2 text-gray-400 transition-colors hover:border-gray-500 hover:bg-[#252840] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="h-[calc(100vh-4rem)] overflow-y-auto p-5">
          <div className="border-b border-[#2a2d3e] pb-5">
            {isEditing ? (
              <input
                className={`${inputClass} text-2xl font-bold leading-tight text-white mb-2 py-3`}
                value={form.hypoName}
                onChange={e => setForm(f => ({...f, hypoName: e.target.value}))}
                placeholder="Hypothesis Name"
              />
            ) : (
              <h3 className="text-2xl font-bold leading-tight text-white">
                {hypothesis.hypoName || 'Untitled Hypothesis'}
              </h3>
            )}

            {isEditing ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  className={`${inputClass} w-32 font-mono`}
                  value={form.mitreId}
                  onChange={e => setForm(f => ({...f, mitreId: e.target.value}))}
                  placeholder="MITRE ID"
                />
                <input
                  className={`${inputClass} w-48`}
                  value={form.tactic}
                  onChange={e => setForm(f => ({...f, tactic: e.target.value}))}
                  placeholder="Tactic"
                />
                <input
                  className={`${inputClass} flex-1`}
                  value={form.subTechnique}
                  onChange={e => setForm(f => ({...f, subTechnique: e.target.value}))}
                  placeholder="Sub-technique"
                />
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 font-mono text-lg font-bold text-indigo-300">
                    {hypothesis.mitreId || '--'}
                  </span>

                  {hypothesis.tactic && (
                    <span className="rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1 text-sm font-medium text-purple-300">
                      {hypothesis.tactic}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm text-gray-400">
                  {hypothesis.subTechnique || 'No sub-technique selected'}
                </p>
              </>
            )}

            <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-[#2a2d3e] bg-[#0f1117] p-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Month
                </p>
                {isEditing ? (
                  <input
                    type="month"
                    className={`${inputClass} mt-1 p-1 text-xs`}
                    value={form.month}
                    onChange={e => setForm(f => ({...f, month: e.target.value}))}
                  />
                ) : (
                  <p className="mt-1 text-sm font-medium text-gray-200">
                    {hypothesis.month || '--'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Planned
                </p>
                {isEditing ? (
                  <input
                    type="date"
                    className={`${inputClass} mt-1 p-1 text-xs`}
                    value={form.planned}
                    onChange={e => setForm(f => ({...f, planned: e.target.value}))}
                  />
                ) : (
                  <p className="mt-1 text-sm font-medium text-gray-200">
                    {hypothesis.planned || '--'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Created
                </p>
                <p className="mt-1 text-sm font-medium text-gray-200">
                  {createdDate}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={hypothesis.status} />
              <ResultCell result={hypothesis.result} />
            </div>
          </div>

          <div className="space-y-4 pt-5">
            <section className={sectionClass}>
              <p className={labelClass}>Description</p>
              {isEditing ? (
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={form.description}
                  onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  placeholder="What are we hunting for and why?"
                />
              ) : (
                <p className="text-sm leading-6 text-gray-200">
                  {hypothesis.description || 'Not provided'}
                </p>
              )}
            </section>

            <section className={sectionClass}>
              <p className={labelClass}>Hunting Logic</p>
              {isEditing ? (
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={form.huntingLogic}
                  onChange={e => setForm(f => ({...f, huntingLogic: e.target.value}))}
                  placeholder="How do we detect it?"
                />
              ) : (
                <p className="text-sm leading-6 text-gray-200">
                  {hypothesis.huntingLogic || 'Not provided'}
                </p>
              )}
            </section>

            <section className={`${sectionClass} relative`}>
              <p className={labelClass}>SOC Detection Rule</p>
              {isEditing ? (
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y font-mono text-xs`}
                  value={form.socDetectionRule}
                  onChange={e => setForm(f => ({...f, socDetectionRule: e.target.value}))}
                  placeholder="Detection rule logic..."
                />
              ) : (
                <>
                  <pre className="min-h-[96px] resize-y overflow-auto whitespace-pre-wrap pr-16 font-mono text-sm leading-6 text-gray-200">
                    {hypothesis.socDetectionRule || 'Not provided'}
                  </pre>
                  {hypothesis.socDetectionRule && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(hypothesis.socDetectionRule)
                        showToast('Query copied to clipboard', 'info')
                      }}
                      className="absolute right-3 top-3 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      Copy
                    </button>
                  )}
                </>
              )}
            </section>

            <section className={sectionClass}>
              <p className={labelClass}>SIEM Queries</p>
              <QueryTabs
                readOnly={!isEditing}
                values={isEditing ? {
                  splunkSPL: form.splunkSPL,
                  qradarAQL: form.qradarAQL,
                  sentinelKQL: form.sentinelKQL,
                } : {
                  splunkSPL: hypothesis.splunkSPL,
                  qradarAQL: hypothesis.qradarAQL,
                  sentinelKQL: hypothesis.sentinelKQL,
                }}
                onChange={isEditing ? (key, val) => setForm(f => ({ ...f, [key]: val })) : undefined}
              />
            </section>

            {isEditing && (
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={toggleEdit}
                  className="px-5 py-2.5 rounded-lg border border-[#2a2d3e] text-gray-300 font-semibold text-sm hover:bg-[#1a1d27] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            <section className={sectionClass}>
              <p className={labelClass}>Comments</p>

              <div className="mb-4">
                {displayComments.length > 0 ? (
                  displayComments.map(comment => {
                    const analystName = comment.analyst || 'Analyst'
                    let displayText = comment.text || '';
                    let badge = null;

                    if (displayText.startsWith('[TP] ')) {
                      badge = <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs font-bold text-green-400">TP</span>;
                      displayText = displayText.substring(5);
                    } else if (displayText.startsWith('[FP] ')) {
                      badge = <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-bold text-red-400">FP</span>;
                      displayText = displayText.substring(5);
                    }

                    return (
                      <div
                        key={comment.id || `${analystName}-${comment.timestamp}`}
                        className="flex gap-3 border-b border-[#2a2d3e] py-4 first:pt-0 last:border-b-0"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                          {analystName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-6 text-gray-200">
                            {displayText}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 items-center">
                            {badge}
                            <span className="font-medium text-gray-400">
                              {analystName}
                            </span>
                            <span>{formatTimestamp(comment.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="py-3 text-sm text-gray-500">No comments yet.</p>
                )}
              </div>

              <div className="space-y-3 border-t border-[#2a2d3e] pt-4">
                <textarea
                  className="min-h-[90px] w-full resize-y rounded-lg border border-[#2a2d3e] bg-[#1a1d27] px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-indigo-500"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={event => setCommentText(event.target.value)}
                />
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex rounded-lg border border-[#2a2d3e] bg-[#1a1d27] p-1 shrink-0">
                    {['TP', 'FP', 'Neutral'].map((res) => (
                      <button
                        key={res}
                        onClick={() => setCommentResult(res)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                          commentResult === res
                            ? res === 'TP'
                              ? 'bg-green-500/20 text-green-400'
                              : res === 'FP'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-600 text-white'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-1 min-w-[200px] gap-3">
                    <input
                      className="h-9 min-w-0 flex-1 rounded-lg border border-[#2a2d3e] bg-[#1a1d27] px-3 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-indigo-500"
                      placeholder="Analyst name"
                      value={analyst}
                      onChange={event => setAnalyst(event.target.value)}
                    />
                    <button
                      onClick={handleAddComment}
                      className="h-9 whitespace-nowrap rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 shrink-0"
                    >
                      Add Comment
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        </div>
      </aside>
    </>
  )
}

export default HypoDetail
