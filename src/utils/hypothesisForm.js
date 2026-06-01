import { normalizeMonth } from '../services/storage'

export const EMPTY_HYPOTHESIS_FORM = {
  hypoName: '',
  mitreId: '',
  subTechnique: '',
  tactic: '',
  month: new Date().toISOString().slice(0, 7),
  status: 'Planned',
  planned: new Date().toISOString().slice(0, 10),
  description: '',
  huntingLogic: '',
  socDetectionRule: '',
  splunkSPL: '',
  qradarAQL: '',
  sentinelKQL: '',
  result: '',
  comments: [],
  clientName: '',
  assignedAnalyst: '',
  isGeneral: false,
}

const toDateInput = (value) => {
  if (!value) return ''
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return ''
}

const toMonthInput = (value) => {
  if (!value) return new Date().toISOString().slice(0, 7)
  if (/^\d{4}-\d{2}$/.test(String(value))) return String(value)
  return normalizeMonth(value)
}

/** Map DB / assignment record → Add/Edit form state */
export const recordToForm = (record, overrides = {}) => {
  if (!record) return { ...EMPTY_HYPOTHESIS_FORM, ...overrides }

  return {
    ...EMPTY_HYPOTHESIS_FORM,
    hypoName: record.hypoName || '',
    mitreId: record.mitreId || '',
    subTechnique: record.subTechnique || '',
    tactic: record.tactic || '',
    month: toMonthInput(record.month),
    status: record.status || 'Planned',
    planned: toDateInput(record.planned),
    description: record.description || '',
    huntingLogic: record.huntingLogic || '',
    socDetectionRule: record.socDetectionRule || '',
    splunkSPL: record.splunkSPL || '',
    qradarAQL: record.qradarAQL || '',
    sentinelKQL: record.sentinelKQL || '',
    result: record.result || '',
    comments: Array.isArray(record.comments) ? record.comments : [],
    clientName: record.clientName || '',
    assignedAnalyst: record.assignedAnalyst || '',
    isGeneral: Boolean(record.isGeneral),
    ...overrides,
  }
}

/** Clean payload for Supabase insert/update (no nested relations or UI-only fields) */
export const formToPayload = (form) => ({
  hypoName: form.hypoName?.trim() || '',
  mitreId: form.mitreId?.trim() || '',
  subTechnique: form.subTechnique || '',
  tactic: form.tactic || '',
  description: form.description || '',
  huntingLogic: form.huntingLogic || '',
  socDetectionRule: form.socDetectionRule || '',
  splunkSPL: form.splunkSPL || '',
  qradarAQL: form.qradarAQL || '',
  sentinelKQL: form.sentinelKQL || '',
  result: form.result || '',
  month: form.month || '',
  status: form.status || 'Planned',
  planned: form.planned || '',
  clientName: form.clientName || '',
  assignedAnalyst: form.assignedAnalyst || '',
  isGeneral: Boolean(form.isGeneral),
})
