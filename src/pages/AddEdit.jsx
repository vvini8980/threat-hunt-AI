import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMitre } from '../hooks/useMitre'
import { useHypotheses } from '../hooks/useHypotheses'
import { QueryTabs } from '../components/Common/QueryTabs'
import { useToastContext } from '../context/ToastContext'
import Spinner from '../components/Common/Spinner'
import {
  getHypothesisById,
  getAssignmentForHypothesisMonth,
  getAssignmentById,
} from '../services/storage'
import { EMPTY_HYPOTHESIS_FORM, recordToForm, formToPayload } from '../utils/hypothesisForm'
import { goToPath } from '../utils/goTo'

export default function AddEdit() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { hypotheses, add, update } = useHypotheses()
  const { mitreData, search } = useMitre()
  const { showToast } = useToastContext()

  const monthParam = searchParams.get('month')
  const fromCampaigns = searchParams.get('from') === 'campaigns'
  const isCampaignForm = searchParams.get('mode') === 'hypothesis' ? false : (fromCampaigns || Boolean(monthParam))
  const backPath = fromCampaigns ? '/campaigns' : '/hypotheses'

  const [form, setForm] = useState(EMPTY_HYPOTHESIS_FORM)
  const [loadingRecord, setLoadingRecord] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [mitreSearch, setMitreSearch] = useState('')
  const [mitreResults, setMitreResults] = useState([])
  const [subTechOptions, setSubTechOptions] = useState([])

  useEffect(() => {
    if (!id) {
      const mitreIdParam = searchParams.get('mitreId')
      const typeParam = searchParams.get('type')
      const isGeneralVal = typeParam === 'general'

      setForm(recordToForm(null, {
        isGeneral: isGeneralVal,
        month: monthParam || EMPTY_HYPOTHESIS_FORM.month,
        ...(mitreIdParam ? { mitreId: mitreIdParam } : {}),
      }))
      setLoadingRecord(false)
      return
    }

    let cancelled = false

    const loadRecord = async () => {
      setLoadingRecord(true)
      try {
        const hypo = await getHypothesisById(id)
        if (cancelled) return

        if (!hypo) {
          showToast('Hypothesis not found', 'error')
          goToPath(backPath)
          return
        }

        let merged = hypo
        const assignIdParam = searchParams.get('assignId')
        if (assignIdParam) {
          const assignment = await getAssignmentById(assignIdParam)
          if (assignment) {
            merged = { ...hypo, ...assignment, id: hypo.id }
          }
        } else if (monthParam) {
          const assignment = await getAssignmentForHypothesisMonth(id, monthParam)
          if (assignment) {
            merged = { ...hypo, ...assignment, id: hypo.id }
          }
        }

        setForm(recordToForm(merged, {
          month: monthParam || merged.month,
        }))
      } catch (err) {
        console.error(err)
        if (!cancelled) showToast('Failed to load hypothesis', 'error')
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }

    loadRecord()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id/month changes only
  }, [id, monthParam, backPath])

  useEffect(() => {
    if (!id || !mitreData || !form.mitreId) return

    const mitreIdParam = searchParams.get('mitreId')
    if (mitreIdParam) return

    const technique = mitreData.techniques?.find(t => t.id === form.mitreId)
      || mitreData.subTechniques?.find(t => t.id === form.mitreId)

    if (!technique) return

    const isSubTech = technique.id.includes('.')
    const tacticShort = technique.tactics?.[0] || ''
    const tacticObj = mitreData.tactics?.find(t => t.shortName === tacticShort)

    setForm(f => {
      const nextSub = f.subTechnique || (isSubTech ? `${technique.id} - ${technique.name}` : '')
      const nextTactic = f.tactic || tacticObj?.name || tacticShort
      if (f.subTechnique === nextSub && f.tactic === nextTactic) return f
      return { ...f, subTechnique: nextSub, tactic: nextTactic }
    })
  }, [id, mitreData, form.mitreId])

  useEffect(() => {
    if (mitreSearch.length > 1) {
      setMitreResults(search(mitreSearch))
    } else {
      setMitreResults(prev => prev.length === 0 ? prev : [])
    }
  }, [mitreSearch, search])

  const selectMitre = (technique) => {
    const isSubTech = technique.id.includes('.')
    const parentId = isSubTech ? technique.id.split('.')[0] : technique.id
    const subs = mitreData?.subTechniques?.filter(s => s.parentId === parentId) || []
    setSubTechOptions(subs)

    const tacticShort = technique.tactics?.[0] || ''
    const tacticObj = mitreData?.tactics?.find(t => t.shortName === tacticShort)

    setForm(f => ({
      ...f,
      mitreId: technique.id,
      subTechnique: isSubTech ? `${technique.id} - ${technique.name}` : '',
      tactic: tacticObj?.name || tacticShort,
    }))

    setMitreSearch('')
    setMitreResults([])
  }

  const handleField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const handleBack = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    goToPath(backPath)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()

    if (!form.hypoName?.trim() || !form.mitreId?.trim()) {
      showToast('Please fill required fields', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = formToPayload(form)

      if (id) {
        const assignIdParam = searchParams.get('assignId')
        await update(id, payload, assignIdParam)
        showToast('Hypothesis updated', 'success')
      } else {
        await add(payload, { campaign: isCampaignForm })
        showToast('Hypothesis saved successfully', 'success')
      }

      goToPath(backPath)
    } catch (err) {
      console.error(err)
      showToast(err?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const sectionClass = 'bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-6 mb-6'
  const labelClass = 'block text-sm font-medium text-gray-400 mb-1'
  const inputClass = `w-full bg-[#0f1117] border border-[#2a2d3e] 
    rounded-lg px-3 py-2 text-gray-200 text-sm outline-none
    focus:border-indigo-500 transition-colors`

  if (loadingRecord) {
    return <Spinner size="lg" text="Loading hypothesis details..." />
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pb-32 md:pb-10 relative z-0">
      <div className="relative z-[100] mb-8 pointer-events-auto">
        <a
          href={backPath}
          onClick={handleBack}
          className="inline-flex items-center gap-2 mb-4 rounded-lg border border-[#2a2d3e] bg-[#1a1d27] px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:border-indigo-500/50 hover:bg-[#252840] transition-colors cursor-pointer no-underline"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to {fromCampaigns ? 'Monthly Campaigns' : 'Hypothesis Library'}
        </a>
        <h1 className="text-2xl font-bold text-white">
          {id ? '✏️ Edit Hypothesis' : '➕ Add Hypothesis'}
        </h1>
        {isCampaignForm && (
          <p className="text-sm text-indigo-300 mt-1">
            Monthly campaign assignment — changes apply to this hunt month
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {isCampaignForm ? (
          <div className={sectionClass}>
            <h2 className="text-lg font-semibold text-indigo-400 mb-4">
              📅 Monthly Assignment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className={labelClass}>Hunt Month</label>
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
              <div>
                <label className={labelClass}>Client Name</label>
                <input
                  className={inputClass}
                  value={form.clientName}
                  onChange={e => handleField('clientName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Assigned Analyst</label>
                <input
                  className={inputClass}
                  value={form.assignedAnalyst}
                  onChange={e => handleField('assignedAnalyst', e.target.value)}
                />
              </div>
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
                <div className="flex gap-2 flex-wrap">
                  {['TP', 'FP', 'Undetermined', ''].map(r => (
                    <button
                      key={r || 'none'}
                      type="button"
                      onClick={() => handleField('result', r)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex-1 ${
                        form.result === r
                          ? r === 'TP'
                            ? 'bg-green-500/30 border-green-500 text-green-400'
                            : r === 'FP'
                            ? 'bg-red-500/30 border-red-500 text-red-400'
                            : r === 'Undetermined'
                            ? 'bg-yellow-500/30 border-yellow-500 text-yellow-400'
                            : 'bg-gray-500/30 border-gray-500 text-gray-300'
                          : 'bg-transparent border-[#2a2d3e] text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {r || 'None'}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <>
            <div className={sectionClass}>
              <h2 className="text-lg font-semibold text-indigo-400 mb-4">
                📌 Section 1 — Identity
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Hypothesis Name *</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Detect Encoded PowerShell Execution"
                    value={form.hypoName}
                    onChange={e => handleField('hypoName', e.target.value)}
                  />
                </div>

                <div className="relative">
                  <label className={labelClass}>MITRE ATT&CK ID *</label>
                  <input
                    className={inputClass}
                    placeholder="Search T1059 or PowerShell..."
                    value={mitreResults.length > 0 ? mitreSearch : (form.mitreId || '')}
                    onChange={e => {
                      setMitreSearch(e.target.value)
                      handleField('mitreId', e.target.value)
                    }}
                  />
                  {mitreResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-[#1e2130] border border-[#2a2d3e] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {mitreResults.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectMitre(t)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-600/20 border-b border-[#2a2d3e] last:border-0"
                        >
                          <span className="text-indigo-400 font-mono">{t.id}</span>
                          <span className="text-gray-300 ml-2">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Sub-technique</label>
                  {subTechOptions.length > 0 ? (
                    <select
                      className={inputClass}
                      value={form.subTechnique}
                      onChange={e => handleField('subTechnique', e.target.value)}
                    >
                      <option value="">-- Select sub-technique --</option>
                      {subTechOptions.map(s => (
                        <option key={s.id} value={`${s.id} - ${s.name}`}>
                          {s.id} - {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      placeholder="e.g. T1059.001 - PowerShell"
                      value={form.subTechnique}
                      onChange={e => handleField('subTechnique', e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label className={labelClass}>Tactic</label>
                  <input
                    className={`${inputClass} text-indigo-300`}
                    placeholder="Auto-filled from MITRE ID"
                    value={form.tactic}
                    onChange={e => handleField('tactic', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className="text-lg font-semibold text-indigo-400 mb-4">
                🔍 Section 2 — Hunt Content
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-y`}
                    placeholder="What are we hunting for and why?"
                    value={form.description}
                    onChange={e => handleField('description', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Hunting Logic</label>
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-y`}
                    placeholder="How do we detect it? What signals do we look for?"
                    value={form.huntingLogic}
                    onChange={e => handleField('huntingLogic', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>SOC Detection Rule</label>
                  <textarea
                    className={`${inputClass} min-h-[80px] resize-y font-mono text-xs`}
                    placeholder="Detection rule logic or Sigma rule..."
                    value={form.socDetectionRule}
                    onChange={e => handleField('socDetectionRule', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={sectionClass}>
              <h2 className="text-lg font-semibold text-indigo-400 mb-4">
                💻 Section 3 — SIEM Queries
              </h2>
              <QueryTabs
                values={{
                  splunkSPL: form.splunkSPL,
                  qradarAQL: form.qradarAQL,
                  sentinelKQL: form.sentinelKQL,
                }}
                onChange={(key, val) => handleField(key, val)}
              />
            </div>
            
            <div className={sectionClass}>
              <h2 className="text-lg font-semibold text-indigo-400 mb-4">
                🎯 Section 4 — Outcome
              </h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Result</label>
                  <div className="flex gap-3 flex-wrap">
                    {['TP', 'FP', 'Undetermined', ''].map(r => (
                      <button
                        key={r || 'none'}
                        type="button"
                        onClick={() => handleField('result', r)}
                        className={`px-6 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.result === r
                            ? r === 'TP'
                              ? 'bg-green-500/30 border-green-500 text-green-400'
                              : r === 'FP'
                              ? 'bg-red-500/30 border-red-500 text-red-400'
                              : r === 'Undetermined'
                              ? 'bg-yellow-500/30 border-yellow-500 text-yellow-400'
                              : 'bg-gray-500/30 border-gray-500 text-gray-300'
                            : 'bg-transparent border-[#2a2d3e] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {r || 'None'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sticky footer — sits above mobile bottom nav (z-40) */}
        <div className="fixed bottom-16 left-0 right-0 md:bottom-0 z-50 border-t border-[#2a2d3e] bg-[#1a1d27]/95 backdrop-blur-md px-6 py-4 md:static md:z-auto md:border-0 md:bg-transparent md:backdrop-blur-none md:px-0">
          <div className="max-w-4xl mx-auto flex gap-3 justify-end">
            <a
              href={backPath}
              onClick={handleBack}
              className="px-6 py-2 rounded-lg border border-[#2a2d3e] text-gray-400 hover:text-white hover:border-gray-500 transition-colors no-underline inline-block text-center"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {saving ? 'Saving...' : id ? 'Update Hypothesis' : 'Save Hypothesis'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
