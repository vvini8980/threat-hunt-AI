import { supabase } from './supabase';

// ── Helpers ──────────────────────────────────
export const normalizeMonth = (monthValue) => {
  if (!monthValue) return new Date().toISOString().slice(0, 7);
  
  // Handle Excel serial date numbers (e.g., 46165)
  if (!isNaN(monthValue) && Number(monthValue) > 10000) {
    const utcDays = Math.floor(Number(monthValue) - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${d.getUTCFullYear()}-${mm}`;
  }

  const str = String(monthValue);
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  
  const currentYear = new Date().getFullYear();
  const lower = str.toLowerCase().trim();
  const monthMap = {
    jan: '01', january: '01', feb: '02', february: '02',
    mar: '03', march: '03', apr: '04', april: '04',
    may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', september: '09',
    oct: '10', october: '10', nov: '11', november: '11',
    dec: '12', december: '12'
  };
  
  if (monthMap[lower]) return `${currentYear}-${monthMap[lower]}`;
  
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  }
  return str;
};

const hypoNameKey = (name) => (name || '').trim().toLowerCase();

const rowTimestamp = (row) => {
  const t = row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt;
  return t ? new Date(t).getTime() : 0;
};

/** One row per hypothesis name; newest updated_at wins. */
export const dedupeHypothesesByName = (rows = []) => {
  const groups = new Map();

  for (const row of rows) {
    const key = hypoNameKey(row.hypoName) || row.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const unique = [];
  for (const group of groups.values()) {
    group.sort((a, b) => rowTimestamp(b) - rowTimestamp(a));
    unique.push(group[0]);
  }

  return unique.sort((a, b) =>
    (a.hypoName || '').localeCompare(b.hypoName || '', undefined, { sensitivity: 'base' })
  );
};

export const getHypothesisByName = async (hypoName) => {
  const key = hypoNameKey(hypoName);
  if (!key) return null;

  const { data, error } = await supabase
    .from('hypotheses')
    .select('id, hypoName, updated_at, created_at');

  if (error) return null;

  const matches = (data || []).filter(h => hypoNameKey(h.hypoName) === key);
  if (!matches.length) return null;

  matches.sort((a, b) => rowTimestamp(b) - rowTimestamp(a));
  return matches[0];
};

// ── CRUD - Hypotheses Library ─────────────────

export const getAllHypotheses = async () => {
  try {
    const { data, error } = await supabase
      .from('hypotheses')
      .select('*, comments(*)');
      
    if (error) {
      console.error('Supabase error fetching hypotheses:', error);
      return [];
    }
    
    const rows = (data || []).map(h => ({
      ...h,
      month: normalizeMonth(h.month),
    }));

    const unique = dedupeHypothesesByName(rows);
    const keepIds = new Set(unique.map(h => h.id));
    const duplicateIds = rows.filter(h => !keepIds.has(h.id)).map(h => h.id);

    // We used to delete duplicate IDs here, but that is dangerous as it cascades deletes to assignments.
    // Instead, we just return the deduplicated array for the UI.

    return unique;
  } catch (err) {
    console.error('Exception fetching hypotheses:', err);
    return [];
  }
};

export const getHypothesisById = async (id) => {
  const { data, error } = await supabase
    .from('hypotheses')
    .select('*, comments(*)')
    .eq('id', id)
    .single();
    
  if (error) return null;
  return { ...data, month: normalizeMonth(data.month) };
};

const buildTrackingFields = ({ clientName, assignedAnalyst, month, status, planned, isGeneral, result }) => {
  if (!month) return null;
  return {
    month: normalizeMonth(month),
    clientName: clientName || '',
    assignedAnalyst: assignedAnalyst || '',
    status: status || 'Pending',
    planned: planned || '',
    isGeneral: isGeneral || false,
    result: result || '',
  };
};

/**
 * @param {object} data - hypothesis + optional campaign fields
 * @param {{ campaign?: boolean }} options - campaign=true for lead monthly uploads
 */
export const addHypothesis = async (data, { campaign = false } = {}) => {
  const { id, comments, commentsText, createdAt, updatedAt, ...insertData } = data;
  const { clientName, assignedAnalyst, month, status, planned, isGeneral, result, ...hypoData } = insertData;

  const trackingFields = buildTrackingFields({
    clientName, assignedAnalyst, month, status, planned, isGeneral, result,
  });
  const isCampaign = campaign && trackingFields;

  let hypothesisId;

  const existing = hypoData.hypoName ? await getHypothesisByName(hypoData.hypoName) : null;

  if (existing) {
    hypothesisId = existing.id;
    
    // Prevent empty columns in the spreadsheet from wiping out existing database data
    const safeUpdateData = { updated_at: new Date().toISOString() };
    if (month) safeUpdateData.month = normalizeMonth(month);
    
    Object.keys(hypoData).forEach(key => {
      if (hypoData[key] !== '' && hypoData[key] !== null && hypoData[key] !== undefined) {
        safeUpdateData[key] = hypoData[key];
      }
    });

    const { error: updateError } = await supabase
      .from('hypotheses')
      .update(safeUpdateData)
      .eq('id', hypothesisId);

    if (updateError) {
      console.error('Error updating library hypothesis:', updateError);
      throw updateError;
    }
  } else {
    const insertPayload = isCampaign
      ? { ...hypoData, ...trackingFields }
      : { ...hypoData, month: normalizeMonth(month) };

    const { data: inserted, error } = await supabase
      .from('hypotheses')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error('Error adding hypothesis:', error);
      throw error;
    }
    hypothesisId = inserted.id;
  }



  return getHypothesisById(hypothesisId);
};

export const updateHypothesis = async (id, data) => {
  const { comments, commentsText, created_at, updated_at, id: hypoId, createdAt, updatedAt, ...updateData } = data;
  
  const { clientName, assignedAnalyst, month, status, planned, isGeneral, result, ...hypoData } = updateData;

  const payload = {
    ...hypoData,
    updated_at: new Date().toISOString(),
  };

  const trackingFields = buildTrackingFields({
    clientName, assignedAnalyst, month, status, planned, isGeneral, result,
  });

  if (trackingFields) {
    if (clientName !== undefined) payload.clientName = clientName;
    if (assignedAnalyst !== undefined) payload.assignedAnalyst = assignedAnalyst;
    if (status !== undefined) payload.status = status;
    if (planned !== undefined) payload.planned = planned;
    if (isGeneral !== undefined) payload.isGeneral = isGeneral;
    if (result !== undefined) payload.result = result;
  }
  
  if (month !== undefined) {
    payload.month = normalizeMonth(month);
  }

  const { data: updated, error } = await supabase
    .from('hypotheses')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
    
  if (error) {
    console.error('Error updating hypothesis:', error);
    throw error;
  }
  return updated;
};

export const deleteHypothesis = async (id) => {
  const { error } = await supabase
    .from('hypotheses')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting hypothesis:', error);
    return false;
  }
  return true;
};

// ── CRUD - Assignments ───────────────────────

const mapAssignmentRow = (a) => ({
  id: a.id,
  month: normalizeMonth(a.month),
  clientName: a.clientName || '',
  assignedAnalyst: a.assignedAnalyst || '',
  status: a.status || 'Pending',
  planned: a.planned || '',
  isGeneral: a.isGeneral || false,
  result: a.result || '',
  created_at: a.created_at,
  updated_at: a.updated_at,
  hypothesis_id: a.hypothesis_id,
  hypoName: a.hypotheses?.hypoName || 'Untitled Hypothesis',
  mitreId: a.hypotheses?.mitreId || '--',
  subTechnique: a.hypotheses?.subTechnique || '',
  tactic: a.hypotheses?.tactic || '',
  description: a.hypotheses?.description || '',
  huntingLogic: a.hypotheses?.huntingLogic || '',
  socDetectionRule: a.hypotheses?.socDetectionRule || '',
  splunkSPL: a.hypotheses?.splunkSPL || '',
  qradarAQL: a.hypotheses?.qradarAQL || '',
  sentinelKQL: a.hypotheses?.sentinelKQL || '',
  comments: a.comments || a.hypotheses?.comments || [],
  _source: 'assignment',
});

/** Legacy rows: campaign fields stored directly on hypotheses (pre-assignments split). */
const mapHypothesisAsAssignment = (h) => ({
  id: h.id,
  month: normalizeMonth(h.month),
  clientName: h.clientName || '',
  assignedAnalyst: h.assignedAnalyst || '',
  status: h.status || 'Pending',
  planned: h.planned || '',
  isGeneral: h.isGeneral || false,
  result: h.result || '',
  created_at: h.created_at,
  updated_at: h.updated_at,
  hypothesis_id: h.id,
  hypoName: h.hypoName || 'Untitled Hypothesis',
  mitreId: h.mitreId || '--',
  subTechnique: h.subTechnique || '',
  tactic: h.tactic || '',
  description: h.description || '',
  huntingLogic: h.huntingLogic || '',
  socDetectionRule: h.socDetectionRule || '',
  splunkSPL: h.splunkSPL || '',
  qradarAQL: h.qradarAQL || '',
  sentinelKQL: h.sentinelKQL || '',
  comments: h.comments || [],
  _source: 'hypothesis',
});

export const getAssignmentForHypothesisMonth = async (hypothesisId, month) => {
  const normalized = normalizeMonth(month);
  if (!hypothesisId || !normalized) return null;

  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('hypothesis_id', hypothesisId)
    .eq('month', normalized)
    .maybeSingle();

  if (!error && data) return { ...data, month: normalized };

  return null;
};

export const getAllAssignments = async () => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, hypotheses(*, comments(*))');
      
    if (error) {
      console.error('Supabase error fetching assignments:', error);
      return [];
    }

    return (data || []).map(mapAssignmentRow);
  } catch (err) {
    console.error('Exception fetching assignments:', err);
    return [];
  }
};

export const getAssignmentById = async (id) => {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, hypotheses(*, comments(*))')
    .eq('id', id)
    .single();
    
  if (error || !data) return null;
  return mapAssignmentRow(data);
};

export const addAssignment = async (assignmentData) => {
  const { clientName, assignedAnalyst, month, status, planned, isGeneral, result, hypothesis_id } = assignmentData;
  const payload = {
    hypothesis_id,
    month: normalizeMonth(month),
    clientName: clientName || '',
    assignedAnalyst: assignedAnalyst || '',
    status: status || 'Pending',
    planned: planned || '',
    isGeneral: isGeneral || false,
    result: result || ''
  };

  const { data, error } = await supabase
    .from('assignments')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error inserting assignment:', error);
    throw error;
  }
  return data;
};

export const updateAssignment = async (id, data) => {
  const { comments, created_at, updated_at, id: assignId, hypothesis_id, _source, ...updateData } = data;

  if (updateData.month) {
    updateData.month = normalizeMonth(updateData.month);
  }

  const { data: updated, error } = await supabase
    .from('assignments')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating assignment:', error);
    throw error;
  }
  return updated;
};

export const deleteAssignment = async (id) => {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting assignment:', error);
    return false;
  }
  return true;
};

// ── Comments ──────────────────────────────────

export const addComment = async (id, commentText, analyst = 'Analyst') => {
  const { data, error } = await supabase
    .from('comments')
    .insert([{
      hypothesis_id: id,
      text: commentText,
      analyst: analyst
    }])
    .select()
    .single();
    
  if (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
  return data;
};

// ── Stats (Synchronous logic over passed array) ──────────────────

export const getStats = (all = []) => {
  return {
    total: all.length,
    planned: all.filter(h => h.status === 'Planned').length,
    active: all.filter(h => h.status === 'Active').length,
    pending: all.filter(h => h.status === 'Pending').length,
    completed: all.filter(h => h.status === 'Completed').length,
    closed: all.filter(h => h.status === 'Closed').length,
    tp: all.filter(h => h.result === 'TP').length,
    fp: all.filter(h => h.result === 'FP').length,
    undetermined: all.filter(h => h.result === 'Undetermined').length,
  };
};

export const getMonthlyStats = (all = []) => {
  const months = {};

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

  all.forEach(h => {
    if (!h.month) return;
    const normMonth = toYYYYMM(h.month);
    if (!normMonth) return;

    if (!months[normMonth]) {
      months[normMonth] = { month: normMonth, total: 0, tp: 0, fp: 0 };
    }
    months[normMonth].total++;
    if (h.result === 'TP') months[normMonth].tp++;
    if (h.result === 'FP') months[normMonth].fp++;
  });

  return Object.values(months).sort((a, b) =>
    a.month.localeCompare(b.month)
  );
};

export const seedTestData = async () => {
  // Emptying seed function as data comes from the live database now
};

// 🎯 Monthly Settings 🎯
export const getMonthlyPurpose = async (month) => {
  try {
    const { data, error } = await supabase
      .from('monthly_settings')
      .select('purpose')
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('Error fetching monthly purpose:', error);
      return '';
    }
    return data ? data.purpose : '';
  } catch (err) {
    console.error('Exception fetching monthly purpose:', err);
    return '';
  }
};

export const saveMonthlyPurpose = async (month, purpose) => {
  try {
    const { error } = await supabase
      .from('monthly_settings')
      .upsert({ month, purpose });

    if (error) {
      console.error('Error saving monthly purpose:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception saving monthly purpose:', err);
    return false;
  }
};
