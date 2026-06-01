const STATUS_COLORS = {
  Planned: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Pending: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Completed: "bg-green-500/20 text-green-400 border-green-500/30",
  Closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const RESULT_COLORS = {
  TP: 'bg-green-500/20 text-green-400 border-green-500/40',
  FP: 'bg-red-500/20 text-red-400 border-red-500/40',
  Undetermined: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
};

const KNOWN_RESULTS = new Set(['TP', 'FP', 'Undetermined']);

/** Normalize TP / FP / Undetermined; leave notes unchanged */
export const normalizeResultValue = (value) => {
  if (value == null || value === '') return null;
  const trimmed = String(value).trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'TP') return 'TP';
  if (upper === 'FP') return 'FP';
  if (upper === 'UNDETERMINED') return 'Undetermined';
  return trimmed;
};

export const isKnownResult = (value) => {
  const normalized = normalizeResultValue(value);
  return normalized != null && KNOWN_RESULTS.has(normalized);
};

export const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs border font-semibold whitespace-nowrap ${
      STATUS_COLORS[status] || 'bg-gray-500/15 text-gray-300 border-gray-500/30'
    }`}
  >
    {status}
  </span>
);

export const ResultBadge = ({ result }) => {
  const label = normalizeResultValue(result);
  if (!label || !KNOWN_RESULTS.has(label)) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.25rem] px-2.5 py-0.5 rounded-md text-xs border font-bold tracking-wide whitespace-nowrap ${RESULT_COLORS[label]}`}
    >
      {label === 'Undetermined' ? 'TBD' : label}
    </span>
  );
};

/** Table cell: badge for TP/FP/TBD, muted truncated text for long findings */
export const ResultCell = ({ result, className = '' }) => {
  const normalized = normalizeResultValue(result);

  if (!normalized) {
    return (
      <span className={`text-xs text-gray-600 ${className}`}>—</span>
    );
  }

  if (KNOWN_RESULTS.has(normalized)) {
    return (
      <div className={className}>
        <ResultBadge result={normalized} />
      </div>
    );
  }

  return (
    <p
      className={`max-w-[160px] text-xs text-gray-400 leading-snug line-clamp-2 ${className}`}
      title={normalized}
    >
      {normalized}
    </p>
  );
};
