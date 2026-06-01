const MITRE_CACHE_KEY = 'mitre_attack_data_v2';
const MITRE_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

// ── Fetch + Cache ─────────────────────────────

export const loadMitreData = async () => {
  try {
    const cached = localStorage.getItem(MITRE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await fetch(MITRE_URL);
    const raw = await response.json();

    const parsed = parseMitreData(raw);
    localStorage.setItem(MITRE_CACHE_KEY, JSON.stringify(parsed));
    return parsed;

  } catch (error) {
    console.error('Failed to load MITRE data:', error);
    return getFallbackData();
  }
};

// ── Parser ────────────────────────────────────

const parseMitreData = (raw) => {
  const objects = raw.objects || [];

  // Get tactics
  const tactics = objects
    .filter(o => o.type === 'x-mitre-tactic')
    .map(t => ({
      id: t.external_references?.[0]?.external_id || '',
      name: t.name,
      shortName: t.x_mitre_shortname
    }));

  // Get techniques (not sub-techniques)
  const techniques = objects
    .filter(o =>
      o.type === 'attack-pattern' &&
      !o.x_mitre_is_subtechnique &&
      !o.revoked
    )
    .map(t => ({
      id: t.external_references?.[0]?.external_id || '',
      name: t.name,
      tactics: t.kill_chain_phases?.map(p => p.phase_name) || [],
      description: t.description?.substring(0, 200) || ''
    }));

  // Get sub-techniques
  const subTechniques = objects
    .filter(o =>
      o.type === 'attack-pattern' &&
      o.x_mitre_is_subtechnique &&
      !o.revoked
    )
    .map(t => ({
      id: t.external_references?.[0]?.external_id || '',
      name: t.name,
      parentId: t.external_references?.[0]?.external_id?.split('.')[0] || '',
      tactics: t.kill_chain_phases?.map(p => p.phase_name) || []
    }));

  return { tactics, techniques, subTechniques };
};

// ── Helpers ───────────────────────────────────

export const searchTechniques = (mitreData, query) => {
  if (!mitreData || !query) return [];
  const q = query.toLowerCase();
  return [
    ...mitreData.techniques,
    ...mitreData.subTechniques
  ]
    .filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q)
    )
    .slice(0, 10);
};

export const getTechniqueById = (mitreData, id) => {
  if (!mitreData || !id) return null;
  return (
    mitreData.techniques.find(t => t.id === id) ||
    mitreData.subTechniques.find(t => t.id === id) ||
    null
  );
};

export const getSubTechniques = (mitreData, parentId) => {
  if (!mitreData || !parentId) return [];
  return mitreData.subTechniques.filter(
    t => t.parentId === parentId
  );
};

export const getTacticName = (mitreData, shortName) => {
  if (!mitreData) return shortName;
  const tactic = mitreData.tactics.find(
    t => t.shortName === shortName
  );
  return tactic?.name || shortName;
};

// ── Fallback (if fetch fails) ─────────────────

const getFallbackData = () => ({
  tactics: [
    { id: 'TA0001', name: 'Reconnaissance', shortName: 'reconnaissance' },
    { id: 'TA0002', name: 'Resource Development', shortName: 'resource-development' },
    { id: 'TA0003', name: 'Initial Access', shortName: 'initial-access' },
    { id: 'TA0004', name: 'Execution', shortName: 'execution' },
    { id: 'TA0005', name: 'Persistence', shortName: 'persistence' },
    { id: 'TA0006', name: 'Privilege Escalation', shortName: 'privilege-escalation' },
    { id: 'TA0007', name: 'Defense Evasion', shortName: 'defense-evasion' },
    { id: 'TA0008', name: 'Credential Access', shortName: 'credential-access' },
    { id: 'TA0009', name: 'Discovery', shortName: 'discovery' },
    { id: 'TA0010', name: 'Lateral Movement', shortName: 'lateral-movement' },
    { id: 'TA0011', name: 'Collection', shortName: 'collection' },
    { id: 'TA0012', name: 'Command and Control', shortName: 'command-and-control' },
    { id: 'TA0040', name: 'Impact', shortName: 'impact' },
    { id: 'TA0010', name: 'Exfiltration', shortName: 'exfiltration' }
  ],
  techniques: [
    { id: 'T1059', name: 'Command and Scripting Interpreter', tactics: ['execution'] },
    { id: 'T1003', name: 'OS Credential Dumping', tactics: ['credential-access'] },
    { id: 'T1053', name: 'Scheduled Task/Job', tactics: ['persistence', 'privilege-escalation'] },
    { id: 'T1078', name: 'Valid Accounts', tactics: ['initial-access', 'persistence'] },
    { id: 'T1021', name: 'Remote Services', tactics: ['lateral-movement'] },
    { id: 'T1055', name: 'Process Injection', tactics: ['defense-evasion', 'privilege-escalation'] },
    { id: 'T1027', name: 'Obfuscated Files or Information', tactics: ['defense-evasion'] },
    { id: 'T1566', name: 'Phishing', tactics: ['initial-access'] }
  ],
  subTechniques: [
    { id: 'T1059.001', name: 'PowerShell', parentId: 'T1059', tactics: ['execution'] },
    { id: 'T1059.003', name: 'Windows Command Shell', parentId: 'T1059', tactics: ['execution'] },
    { id: 'T1003.001', name: 'LSASS Memory', parentId: 'T1003', tactics: ['credential-access'] },
    { id: 'T1053.005', name: 'Scheduled Task', parentId: 'T1053', tactics: ['persistence'] },
    { id: 'T1078.002', name: 'Domain Accounts', parentId: 'T1078', tactics: ['initial-access'] }
  ]
});
