import { useState, useCallback, useEffect, useRef } from 'react';
import { generateThreatIntel } from '../services/geminiService';
import { API_BASE_URL } from '../config/api';

// ─── Helpers ────────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  ATTACKS:        'thboard_live_attacks',
  LIBRARY:        'thboard_saved_library',
  DAILY_REPORT:   'thboard_daily_report',
  LAST_DAILY_RUN: 'thboard_last_daily_run',
};

const LIVE_REFRESH_INTERVAL_MS = 3_600_000;

function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** Aggregate all IOCs from an array of attacks */
function aggregateIOCs(attacks) {
  const map = new Map();
  attacks.forEach(atk => {
    (atk.iocs || []).forEach(ioc => {
      const typeKey = ioc.type?.toUpperCase() || 'UNKNOWN';
      const normType =
        typeKey === 'IP' || typeKey === 'IP ADDRESS' ? 'IP' :
        typeKey === 'DOMAIN' || typeKey === 'HOSTNAME' ? 'DOMAIN' :
        typeKey === 'HASH' || typeKey === 'MD5' || typeKey === 'SHA256' || typeKey === 'SHA-256' ? 'HASH' :
        typeKey;
      const key = `${normType}::${ioc.value}`;
      if (!map.has(key)) {
        map.set(key, { type: normType, value: ioc.value, context: ioc.context || '', campaigns: [] });
      }
      map.get(key).campaigns.push(atk.metadata?.actor || atk.name || 'Unknown');
    });
  });
  return Array.from(map.values());
}

/** Build a daily intel report object from the current state of attacks */
function buildDailyReport(attacks, targetDateStr = yesterdayDateStr()) {
  const getAttackDateStr = (attack) => {
    const value = attack.generated_at || attack.date;
    if (!value) return null;
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
  };

  // Filter for attacks on the target date
  let recentAttacks = attacks.filter(a => {
    const dateStr = getAttackDateStr(a);
    return dateStr === targetDateStr;
  });

  // Fallback if none for the target date, take the most recent day available
  if (recentAttacks.length === 0 && attacks.length > 0) {
    const sorted = [...attacks]
      .filter(a => getAttackDateStr(a) !== null)
      .sort((a, b) => new Date(b.generated_at || b.date).getTime() - new Date(a.generated_at || a.date).getTime());
    
    if (sorted.length > 0) {
      const mostRecentDateStr = getAttackDateStr(sorted[0]);
      recentAttacks = sorted.filter(a => getAttackDateStr(a) === mostRecentDateStr);
      targetDateStr = mostRecentDateStr;
    }
  }

  const iocs = aggregateIOCs(recentAttacks);
  const actors = [...new Set(recentAttacks.map(a => a.metadata?.actor).filter(Boolean))];
  
  return {
    id:           `report-${Date.now()}`,
    generated_at: new Date().toISOString(),
    date:         todayDateStr(),
    report_for:   targetDateStr,
    attack_count: recentAttacks.length,
    ioc_count:    iocs.length,
    actor_count:  actors.length,
    top_iocs:     iocs.slice(0, 10),
    actors,
    campaigns:    recentAttacks,
    summary: `Daily Proactive Intel Report covering ${recentAttacks.length} active threat campaign${recentAttacks.length !== 1 ? 's' : ''}, `
           + `${iocs.length} unique IOC${iocs.length !== 1 ? 's' : ''} across ${actors.length} threat actor${actors.length !== 1 ? 's' : ''}. `
           + (actors.length > 0 ? `Key actors: ${actors.slice(0, 3).join(', ')}${actors.length > 3 ? ` and ${actors.length - 3} more` : ''}.` : ''),
    download_url: null,
  };
}

// ─── Seed campaign (used only when OpenCTI is empty & no cache) ──────────────
const SEED_CAMPAIGN = {
  id: 'seed-001',
  name: 'Volt Typhoon: Living off the Land (LotL) targeting Critical Infrastructure',
  date: '2026-05-24',
  generated_at: '2026-05-24T14:30:00.000Z',
  metadata: {
    actor: 'Volt Typhoon',
    aliases: 'Bronze Silhouette, DEV-0391, VANGUARD PANDA',
    origin: 'China (PRC sponsored)',
    activeSince: '2021 (confirmed 2023)',
    targetSector: 'Critical Infrastructure (Energy/Water/Comms/OT)',
    dwellTime: '300+ days average',
    sophistication: 'Nation State',
    cisaAlert: 'AA23-144A (May 2023)',
    confidence: 'HIGH 94% (CISA Confirmed)',
  },
  poc: {
    hypothesis: `PHASE 1 — Initial Access:\nExploits Fortinet FortiGuard SSL VPN CVE-2022-40684 or Zoho ManageEngine CVE-2021-40539.\n\nPHASE 2 — Discovery (cmd.exe ONLY, never PowerShell):\n  net group /domain\n  net user /domain\n  netstat -ano\n  ipconfig /all\n\nPHASE 3 — Credential Access:\n  ntdsutil "ac i ntds" "ifm" "create full c:\\temp" q q\n(ntdsutil IFM = Volt Typhoon signature — other actors use vssadmin)\n\nPHASE 4 — C2:\nProxies ALL traffic through compromised SOHO routers (no SNI headers).\n\nPHASE 5 — Persistence:\n  netsh interface portproxy add v4tov4 listenport=50100 connectaddress=[C2] connectport=443`,
    logSources: [
      { source: 'Sysmon EID 1', indicator: "ntdsutil.exe with 'ifm' arg", query: 'ProcessName=ntdsutil.exe CommandLine=*ifm* CommandLine=*create full*' },
      { source: 'Sysmon EID 1', indicator: 'netsh portproxy v4tov4', query: 'ProcessName=netsh.exe CommandLine=*portproxy* CommandLine=*v4tov4*' },
      { source: 'Windows EID 4688', indicator: 'net commands in sequence', query: 'EventCode=4688 sequence within 300 seconds' },
    ],
    huntingSteps: [
      { step: 'Identify ntdsutil IFM extraction', description: 'Look for ntdsutil.exe executing ifm create full — this dumps the AD database.' },
      { step: 'Search for unauthorized port proxies', description: 'Hunt for netsh.exe configuring v4tov4 proxies to bypass segmentation.' },
      { step: 'Analyze for SNI-less TLS', description: 'Detect outbound TLS to residential IPs without Server Name Indication headers.' },
      { step: 'Correlate with initial access vectors', description: 'Check perimeter logs for Fortinet CVE-2022-40684 exploitation.' },
    ],
    triageQuery: `index=windows sourcetype=sysmon earliest=-7d\n(\n  (EventCode=1 ProcessName="*\\ntdsutil.exe" CommandLine="*ifm*" CommandLine="*create full*")\n  OR\n  (EventCode=1 ProcessName="*\\netsh.exe" CommandLine="*portproxy*" CommandLine="*v4tov4*")\n)\n| eval technique=case(ProcessName="*ntdsutil*","T1003.003",ProcessName="*netsh*","T1090.001",true(),"Unknown")\n| stats count, values(technique) as ttps, values(CommandLine) as commands by host, user\n| sort -count`,
    falsePositives: 'ntdsutil ifm: Almost never a FP outside of dedicated DC backup jobs. netsh portproxy: Check IT tickets for legacy app NAT traversal.',
  },
  references: [
    'https://www.cisa.gov/news-events/cybersecurity-advisories/aa24-038a',
    'https://www.microsoft.com/en-us/security/blog/2023/05/24/volt-typhoon/',
  ],
  iocs: [
    { type: 'IP', value: '45.32.108.91', context: 'Compromised SOHO router C2 proxy' },
    { type: 'Command', value: 'ntdsutil "ac i ntds" "ifm" "create full c:\\temp" q q', context: 'NTDS.dit extraction signature' },
    { type: 'Command', value: 'netsh interface portproxy add v4tov4 listenport=50100', context: 'C2 tunnel persistence' },
  ],
  hypotheses: [
    {
      hypoName: 'Detect ntdsutil.exe AD Database Extraction',
      description: 'Volt Typhoon uniquely uses ntdsutil.exe IFM to dump NTDS.dit — never vssadmin.',
      mitreId: 'T1003.003', tactic: 'Credential Access', platform: 'Windows',
      dataSource: 'Process Creation (Sysmon EID 1)',
      actorContext: 'Phase 3 of Volt Typhoon chain. ntdsutil IFM is their signature — other actors use vssadmin.',
      confidence: 'HIGH 94%', source: 'CISA AA23-144A', lastSeen: 'Active May 2026',
      huntingLogic: '1. Run query last 90 days\n2. Exclude known backup servers\n3. Correlate with VPN auth logs ±48h\n4. HIGH CONFIDENCE = escalate immediately',
      falsePositiveRisk: 'LOW — ntdsutil ifm is rarely used legitimately.',
      truePositiveAction: '🚨 Escalate to IR immediately\n🚨 Assume full AD compromise\n🚨 Reset ALL domain admin passwords',
      splunkSPL: 'index=windows (sourcetype="WinEventLog:Security" EventCode=4688 OR sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1)\nProcessName="*\\ntdsutil.exe" CommandLine="*ifm create full*"\n| stats count by host, user, CommandLine, _time | sort -_time',
      sentinelKQL: 'SecurityEvent\n| where EventID == 4688\n| where NewProcessName endswith "ntdsutil.exe"\n| where CommandLine has "ifm" and CommandLine has "create full"\n| project TimeGenerated, Computer, Account, NewProcessName, CommandLine\n| order by TimeGenerated desc',
    },
  ],
};

// ─── Main Hook ───────────────────────────────────────────────────────────────
export const useAIHub = () => {
  const [attacks, setAttacks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ATTACKS);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isFetching,   setIsFetching]   = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastUpdated,  setLastUpdated]  = useState(null);

  const [savedLibrary, setSavedLibrary] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIBRARY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const [dailyReport,       setDailyReport]       = useState(() => {
    try {
      const r = localStorage.getItem(STORAGE_KEYS.DAILY_REPORT);
      return r ? JSON.parse(r) : null;
    } catch { return null; }
  });
  const [isDailyGenerating, setIsDailyGenerating] = useState(false);

  const midnightTimerRef = useRef(null);
  const feedFetchInFlightRef = useRef(false);

  // ── Save hypothesis to local tracking ─────────────────────────────────────
  const saveHypothesis = useCallback((hypo) => {
    setSavedLibrary(prev => {
      const next = new Set([...prev, hypo.hypoName]);
      localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // ── Fetch daily report from backend cache ──────────────────────────────────
  const fetchDailyReport = useCallback(async () => {
    const yesterday = yesterdayDateStr();
    try {
      const res = await fetch(`${API_BASE_URL}/intel/daily-report/${yesterday}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.report) {
          const report = { ...data.report, generated_at: data.report.generated_at || new Date().toISOString() };
          localStorage.setItem(STORAGE_KEYS.DAILY_REPORT, JSON.stringify(report));
          localStorage.setItem(STORAGE_KEYS.LAST_DAILY_RUN, todayDateStr());
          setDailyReport(report);
          return report;
        }
      }
    } catch (err) {
      console.warn('[Daily Report] Failed to fetch daily report from backend:', err.message);
    }
    return null;
  }, []);

  // ── Generate daily IOC + intel report ─────────────────────────────────────
  const generateDailyReport = useCallback(async (currentAttacks, force = false) => {
    setIsDailyGenerating(true);
    try {
      // First try the real backend endpoint
      try {
        const openctiUrl = localStorage.getItem('ai_opencti_url') || '';
        const openctiKey = localStorage.getItem('ai_opencti_key') || '';
        
        const url = `${API_BASE_URL}/intel/daily-run${force ? '?force=true' : ''}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'X-OpenCTI-Url': openctiUrl,
            'X-OpenCTI-Token': openctiKey,
          },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.report && data.report.source !== 'no_data' && data.report.ioc_count > 0) {
            const report = { ...data.report, generated_at: data.report.generated_at || new Date().toISOString() };
            localStorage.setItem(STORAGE_KEYS.DAILY_REPORT, JSON.stringify(report));
            localStorage.setItem(STORAGE_KEYS.LAST_DAILY_RUN, todayDateStr());
            setDailyReport(report);
            return report;
          }
        }
      } catch (backendErr) {
        console.warn('[Daily Report] Backend unavailable, using local aggregation:', backendErr.message);
      }

      // Fallback: aggregate locally from current attacks
      await new Promise(r => setTimeout(r, 800));
      const report = buildDailyReport(currentAttacks);
      localStorage.setItem(STORAGE_KEYS.DAILY_REPORT, JSON.stringify(report));
      localStorage.setItem(STORAGE_KEYS.LAST_DAILY_RUN, todayDateStr());
      setDailyReport(report);
      return report;
    } catch (err) {
      console.error('[Daily Report] Failed:', err);
    } finally {
      setIsDailyGenerating(false);
    }
  }, []);

  // ── Manual daily report trigger ────────────────────────────────────────────
  const triggerDailyReport = useCallback(async () => {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTACKS) || '[]');
    await generateDailyReport(current, true);
  }, [generateDailyReport]);

  // ── Generate a new live AI attack (manual button) ─────────────────────────
  const generateLiveAttack = useCallback(async (rawText, client) => {
    const apiKey = localStorage.getItem('ai_gemini_key');
    if (!apiKey) throw new Error('Please configure your Gemini API Key in AI Settings first.');

    setIsGenerating(true);
    try {
      const newAttack = await generateThreatIntel(apiKey, rawText, [], client);
      const newAttackWithDate = {
        ...newAttack,
        generated_at: new Date().toISOString()
      };
      setAttacks(prev => {
        const existingIndex = prev.findIndex(a => a.name === newAttackWithDate.name);
        let next;
        if (existingIndex >= 0) {
          next = [...prev];
          next[existingIndex] = newAttackWithDate;
        } else {
          next = [newAttackWithDate, ...prev];
        }
        localStorage.setItem(STORAGE_KEYS.ATTACKS, JSON.stringify(next));
        return next;
      });
      setLastUpdated(new Date().toLocaleTimeString() + ' (Live AI)');
      return newAttackWithDate;
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // ── Fetch real attacks from backend (OpenCTI → Gemini pipeline) ──────────
  const fetchRecentAttacks = useCallback(async () => {
    if (feedFetchInFlightRef.current) return;
    feedFetchInFlightRef.current = true;
    setIsFetching(true);
    try {
      // Try the real backend /intel/feed endpoint
      const openctiUrl = localStorage.getItem('ai_opencti_url') || '';
      const openctiKey = localStorage.getItem('ai_opencti_key') || '';

      const res = await fetch(`${API_BASE_URL}/intel/feed`, {
        headers: {
          'X-OpenCTI-Url': openctiUrl,
          'X-OpenCTI-Token': openctiKey,
        },
        signal: AbortSignal.timeout(30000), // 30s — Gemini analysis takes time
      });

      if (res.ok) {
        const data = await res.json();
        const liveCampaigns = data.campaigns || [];

        if (liveCampaigns.length > 0) {
          const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTACKS) || '[]');
          const stamped = liveCampaigns.map(c => {
            const existing = cached.find(a => a.name === c.name || a.id === c.id);
            return {
              ...c,
              date: c.date || new Date().toISOString().split('T')[0],
              generated_at: existing?.generated_at || c.generated_at || data.generated_at || new Date().toISOString()
            };
          });
          localStorage.setItem(STORAGE_KEYS.ATTACKS, JSON.stringify(stamped));
          setAttacks(stamped);
          setLastUpdated(new Date().toLocaleTimeString() + ' (Live — OpenCTI + AI)');
          console.log(`[Intel Feed] Loaded ${liveCampaigns.length} live campaigns from OpenCTI`);
          return;
        }
      }

      // Backend returned empty or failed — use cache
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTACKS) || '[]');
      if (cached.length > 0) {
        setAttacks(cached);
        setLastUpdated(new Date().toLocaleTimeString() + ' (Cached)');
        console.log(`[Intel Feed] Using ${cached.length} cached campaigns`);
        return;
      }

      // Final fallback: show seed campaign so the page is not blank
      console.warn('[Intel Feed] No live or cached data — loading seed campaign');
      const seeds = [SEED_CAMPAIGN];
      localStorage.setItem(STORAGE_KEYS.ATTACKS, JSON.stringify(seeds));
      setAttacks(seeds);
      setLastUpdated(new Date().toLocaleTimeString() + ' (Sample — connect OpenCTI for live data)');
    } catch (err) {
      console.error('[Intel Feed] Fetch failed:', err.message);
      // Show cached data on error rather than blank page
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTACKS) || '[]');
      if (cached.length > 0) {
        setAttacks(cached);
        setLastUpdated(new Date().toLocaleTimeString() + ' (Cached — backend offline)');
      } else {
        const seeds = [SEED_CAMPAIGN];
        setAttacks(seeds);
        setLastUpdated(new Date().toLocaleTimeString() + ' (Sample)');
      }
    } finally {
      feedFetchInFlightRef.current = false;
      setIsFetching(false);
    }
  }, []);

  // Keep the proactive feed live while the page is open.
  useEffect(() => {
    const liveRefreshTimer = setInterval(() => {
      fetchRecentAttacks();
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => clearInterval(liveRefreshTimer);
  }, [fetchRecentAttacks]);

  // ── Midnight scheduler ────────────────────────────────────────────────────
  useEffect(() => {
    const scheduleNextMidnight = () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      console.log(`[Daily Intel] Next report scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes.`);

      midnightTimerRef.current = setTimeout(async () => {
        console.log('[Daily Intel] Running midnight daily intel report...');
        // 1. Refresh the feed from OpenCTI first
        await fetchRecentAttacks();
        // 2. Then generate the daily report from the refreshed data
        const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTACKS) || '[]');
        await generateDailyReport(current, false);
        // Re-schedule for the next midnight
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    scheduleNextMidnight();

    return () => {
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, [generateDailyReport, fetchRecentAttacks]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      await fetchRecentAttacks();
      // Check if daily report already ran today
      const lastRun = localStorage.getItem(STORAGE_KEYS.LAST_DAILY_RUN);
      if (lastRun !== todayDateStr()) {
        console.log('[Daily Intel] Report not run today yet. Fetching/generating...');
        // Clear stale local daily report immediately
        localStorage.removeItem(STORAGE_KEYS.DAILY_REPORT);
        setDailyReport(null);

        // Try fetching cached report from backend first
        const fetched = await fetchDailyReport();
        if (!fetched) {
          // If not available, generate it
          const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTACKS) || '[]');
          await generateDailyReport(current, false);
        }
      }
    };
    init();
  }, [fetchRecentAttacks, fetchDailyReport, generateDailyReport]);

  return {
    attacks,
    isFetching,
    isGenerating,
    lastUpdated,
    fetchRecentAttacks,
    generateLiveAttack,
    savedLibrary,
    saveHypothesis,
    dailyReport,
    isDailyGenerating,
    triggerDailyReport,
    fetchDailyReport,
  };
};
