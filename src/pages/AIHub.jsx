import React, { useState, useMemo, useCallback } from 'react';
import { useAIHub } from '../hooks/useAIHub';
import AttackList from '../components/AIHub/AttackList';
import AISettings from '../components/AIHub/AISettings';
import HypoPreviewModal from '../components/AIHub/HypoPreviewModal';
import TopIOCsPanel from '../components/AIHub/TopIOCsPanel';
import DailyReportBanner from '../components/AIHub/DailyReportBanner';
import IntelSummaryPanel from '../components/AIHub/IntelSummaryPanel';
import {
  Settings, BrainCircuit, RefreshCw, Clock, Database,
  Globe, ShieldAlert, Search, Filter, X, CalendarDays, Calendar
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { useToastContext as useToast } from '../context/ToastContext';

// ─── Connector status card ───────────────────────────────────────────────────
const ConnectorCard = ({ label, status, statusLabel, icon: Icon, color }) => {
  const colors = {
    green:  { dot: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    amber:  { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    red:    { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    indigo: { dot: 'bg-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  };
  const c = colors[color] || colors.green;
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] p-4 rounded-xl flex items-center gap-3 shadow-lg">
      <div className="relative flex-shrink-0">
        <div className={`w-9 h-9 ${c.bg} rounded-lg border ${c.border} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${c.dot} border-2 border-[#1a1d27] rounded-full`} />
      </div>
      <div className="min-w-0">
        <h3 className="text-xs font-bold text-white truncate">{label}</h3>
        <p className={`text-[10px] font-semibold mt-0.5 ${c.text}`}>{statusLabel}</p>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const getAttackDateKey = (attack) => {
  const value = attack.generated_at || attack.date;
  if (!value) return 'unknown';
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return String(value).split('T')[0] || 'unknown';
};

const formatDateLabel = (dateKey) => {
  if (dateKey === 'all') return 'All Days';
  if (dateKey === 'unknown') return 'Unknown Date';
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (dateKey) => {
  if (dateKey === 'unknown') return 'Unknown';
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const AIHub = () => {
  const {
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
  } = useAIHub();

  const [showSettings,   setShowSettings]   = useState(false);
  const [previewHypo,    setPreviewHypo]    = useState(null);
  const [selectedActor,  setSelectedActor]  = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [sliderEndDate, setSliderEndDate] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [filterAll, setFilterAll] = useState(true);

  const { selectedClient } = useClient();
  const { user }           = useAuth();
  const { showToast }      = useToast();

  // ── Connector status based on real key presence ───────────────────────────
  const geminiConfigured = !!localStorage.getItem('ai_gemini_key');

  // Generate 10 continuous calendar days ending on sliderEndDate, sorted chronologically (oldest first)
  const displaySliderDates = useMemo(() => {
    const dates = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(sliderEndDate);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }
    return dates;
  }, [sliderEndDate]);

  // Get campaign, ioc, and hypothesis stats for a date
  const getStatsForDate = useCallback((date) => {
    const dateKey = date.toISOString().split('T')[0];
    const dateScoped = attacks.filter(a => getAttackDateKey(a) === dateKey);
    const campaigns = dateScoped.length;
    const iocs = dateScoped.reduce((sum, a) => sum + (a.iocs || []).length, 0);
    const hypotheses = dateScoped.reduce((sum, a) => sum + (a.hypotheses || []).length, 0);
    return { campaigns, iocs, hypotheses };
  }, [attacks]);

  const activeDateLabel = useMemo(() => {
    if (filterAll) return 'All Days';
    return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [filterAll, selectedDate]);

  const fmtShortDate = (d) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const dateScopedAttacks = useMemo(() => {
    if (filterAll) return attacks;
    const selDateKey = selectedDate.toISOString().split('T')[0];
    return attacks.filter(attack => getAttackDateKey(attack) === selDateKey);
  }, [attacks, filterAll, selectedDate]);

  const activeDateSummary = useMemo(() => ({
    campaigns: dateScopedAttacks.length,
    iocs: dateScopedAttacks.reduce((sum, attack) => sum + (attack.iocs || []).length, 0),
    hypotheses: dateScopedAttacks.reduce((sum, attack) => sum + (attack.hypotheses || []).length, 0),
    actors: new Set(dateScopedAttacks.map(attack => attack.metadata?.actor).filter(Boolean)).size,
  }), [dateScopedAttacks]);

  // ── Filter attacks by selected actor or search term ───────────────────────
  const filteredAttacks = useMemo(() => {
    let list = dateScopedAttacks;
    if (selectedActor) {
      list = list.filter(a => a.metadata?.actor === selectedActor);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(a =>
        a.name?.toLowerCase().includes(term) ||
        a.metadata?.actor?.toLowerCase().includes(term) ||
        a.metadata?.targetSector?.toLowerCase().includes(term) ||
        (a.iocs || []).some(i => i.value?.toLowerCase().includes(term))
      );
    }
    return list;
  }, [dateScopedAttacks, selectedActor, searchTerm]);

  // ── Save hypothesis ───────────────────────────────────────────────────────
  const handleSaveHypothesis = async (hypo) => {
    if (!selectedClient) {
      showToast('Please select a client from the top bar first.', 'error');
      return;
    }
    try {
      const richDescription = JSON.stringify(hypo);

      const { error } = await supabase.from('hypotheses').insert([{
        client_id:    selectedClient.id,
        title:        hypo.hypoName,
        description:  richDescription.trim(),
        mitre_id:     hypo.mitreId,
        mitre_tactic: hypo.tactic,
        splunk_query: hypo.splunkSPL,
        sentinel_kql: hypo.sentinelKQL,
        source:       'ai',
        status:       'draft',
        created_by:   user.id
      }]);
      if (error) throw error;

      saveHypothesis(hypo);
      setPreviewHypo(null);
      showToast('✅ AI hypothesis saved to Hypotheses library!', 'success');
    } catch (err) {
      showToast('Failed to save hypothesis: ' + err.message, 'error');
    }
  };

  // ── Create hypothesis from actor ──────────────────────────────────────────
  const handleActorHypothesis = (actor) => {
    const syntheticHypo = {
      hypoName:          `Hunt ${actor.actor} Activity`,
      description:       `Proactive threat hunt for ${actor.actor} (${actor.aliases || 'No aliases'}). Origin: ${actor.origin}. Targeting: ${actor.targetSector}.`,
      mitreId:           'T1078',
      tactic:            'Initial Access / Persistence',
      platform:          'Cross-Platform',
      dataSource:        'All Available Telemetry',
      actorContext:      `${actor.actor} has been active since ${actor.activeSince}. Sophistication: ${actor.sophistication}. Known aliases: ${actor.aliases}.`,
      confidence:        actor.confidence || 'HIGH',
      source:            actor.cisaAlert || 'Proactive Intel Feed',
      lastSeen:          'Current (from feed)',
      huntingLogic:      `1. Search all logs for IOCs associated with ${actor.actor}\n2. Look for TTPs specific to this actor\n3. Review ${actor.campaigns?.length || 0} known campaigns\n4. Cross-reference with CISA alert ${actor.cisaAlert || 'if available'}`,
      falsePositiveRisk: 'MEDIUM: Correlate against known-good baselines before escalating.',
      truePositiveAction: `🚨 Escalate to Incident Response immediately\n🚨 Assume ${actor.actor} has persistent access\n🚨 Initiate full forensic review`,
      splunkSPL:         `| Comment: Hunt for ${actor.actor} TTPs\nindex=* earliest=-30d\n| search ...\n| table _time, host, user, src_ip, dest_ip`,
      sentinelKQL:       `// Hunt for ${actor.actor} TTPs\nSecurityEvent\n| where TimeGenerated > ago(30d)\n| order by TimeGenerated desc`,
    };
    setPreviewHypo(syntheticHypo);
  };

  // ── Create hypothesis from IOC ────────────────────────────────────────────
  const handleIOCHypothesis = (ioc) => {
    const syntheticHypo = {
      hypoName:          `Investigate ${ioc.type} IOC: ${ioc.value.slice(0, 40)}${ioc.value.length > 40 ? '...' : ''}`,
      description:       `Threat hunt for IOC of type ${ioc.type}: ${ioc.value}. Context: ${ioc.context || 'No context available.'}`,
      mitreId:           ioc.type === 'IP' || ioc.type === 'DOMAIN' ? 'T1071.001' : 'T1204.002',
      tactic:            'Command and Control / Execution',
      platform:          'Cross-Platform',
      dataSource:        ioc.type === 'IP' || ioc.type === 'DOMAIN' ? 'Network Telemetry / Firewall / Proxy' : 'EDR / Endpoint Telemetry',
      actorContext:      `This ${ioc.type} IOC (${ioc.value}) was found in: ${(ioc.campaigns || []).join(', ') || 'active threat campaigns'}. ${ioc.context || ''}`,
      confidence:        'HIGH',
      source:            'Proactive Intel Feed — IOC Intelligence',
      lastSeen:          'Current (from feed)',
      huntingLogic:      ioc.type === 'IP'
        ? `1. Search network logs for any connection to/from ${ioc.value}\n2. Check both inbound and outbound flows\n3. Review firewall, proxy, and IDS logs\n4. Correlate with user/host activity at connection time`
        : ioc.type === 'DOMAIN'
        ? `1. Search DNS logs for queries to ${ioc.value}\n2. Check proxy/web filter logs for HTTP traffic\n3. Identify which hosts made the query\n4. Check for typosquatting variants`
        : `1. Search endpoint telemetry for file hash ${ioc.value}\n2. Check AV/EDR quarantine logs\n3. Search email gateway for this hash in attachments\n4. Review process execution events`,
      falsePositiveRisk: 'LOW to MEDIUM — validate against threat intel before escalating.',
      truePositiveAction: `🚨 Isolate affected hosts\n🚨 Block ${ioc.value} on all perimeter controls\n🚨 Preserve forensic artifacts\n🚨 Escalate to IR`,
      splunkSPL: ioc.type === 'IP'
        ? `index=* earliest=-30d\n(src_ip="${ioc.value}" OR dest_ip="${ioc.value}")\n| stats count by src_ip, dest_ip, host, _time\n| sort -count`
        : ioc.type === 'DOMAIN'
        ? `index=* earliest=-30d\n(query="${ioc.value}" OR domain="${ioc.value}" OR url="*${ioc.value}*")\n| stats count by host, user, _time\n| sort -count`
        : `index=* earliest=-30d\n(file_hash="${ioc.value}" OR MD5="${ioc.value}" OR SHA256="${ioc.value}")\n| stats count by host, file_path, _time`,
      sentinelKQL: ioc.type === 'IP'
        ? `NetworkCommunicationEvents\n| where RemoteIP == "${ioc.value}" or LocalIP == "${ioc.value}"\n| project TimeGenerated, DeviceName, LocalIP, RemoteIP, RemotePort\n| order by TimeGenerated desc`
        : `DnsEvents\n| where Name contains "${ioc.value}"\n| project TimeGenerated, Computer, Name, QueryType\n| order by TimeGenerated desc`,
    };
    setPreviewHypo(syntheticHypo);
  };

  // ── Generate live intel ───────────────────────────────────────────────────
  const handleGenerateLive = async () => {
    if (!geminiConfigured) {
      showToast('Please configure your Gemini API Key in AI Settings first.', 'error');
      setShowSettings(true);
      return;
    }
    const themes = [
      'Ransomware group (e.g. LockBit, BlackCat, Play)',
      'Nation-State Espionage (e.g. APT29, Lazarus, Volt Typhoon)',
      'Supply Chain Attack (e.g. SolarWinds, XZ Utils style)',
      'Zero-Day Vulnerability Exploitation (recent critical CVE)',
      'Financially Motivated Cybercrime (e.g. Scattered Spider, FIN7)'
    ];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    showToast(`🔬 Generating intel: ${randomTheme}...`, 'info');
    try {
      await generateLiveAttack(randomTheme, selectedClient);
      showToast('✅ New threat intel generated!', 'success');
    } catch (err) {
      showToast('Failed to generate intel: ' + err.message, 'error');
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalIOCs   = activeDateSummary.iocs;
  const totalActors = activeDateSummary.actors;
  const totalHypos  = activeDateSummary.hypotheses;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              Proactive Intel Feed
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated AI threat analysis with ready-to-use hunting hypotheses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-[#1a1d27] border border-[#2a2d3e] px-3 py-2 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              Updated: {lastUpdated}
            </div>
          )}
          <button
            onClick={handleGenerateLive}
            disabled={isGenerating || isFetching}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 border border-indigo-500/50 rounded-lg text-indigo-400 font-bold hover:bg-indigo-500/30 transition-colors disabled:opacity-50 text-sm"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            {isGenerating ? 'Analyzing...' : 'Generate Live Intel'}
          </button>
          <button
            onClick={fetchRecentAttacks}
            disabled={isFetching || isGenerating}
            className="p-2 bg-indigo-600 border border-indigo-500 rounded-lg text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            title="Sync Feed"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-[#1a1d27] border border-[#2a2d3e] rounded-lg text-gray-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors"
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Intel Library (IOC Summary) ── */}
      <div className="mb-2">
        <IntelSummaryPanel clientId={selectedClient?.id} />
      </div>

      {/* ── KPI Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Campaigns', value: activeDateSummary.campaigns, color: 'text-red-400', icon: ShieldAlert },
          { label: 'Threat Actors',    value: totalActors,    color: 'text-violet-400', icon: BrainCircuit },
          { label: 'Saved Hunts',      value: savedLibrary.size, color: 'text-emerald-400', icon: Clock },
          { label: 'Hunt Hypotheses',  value: totalHypos,     color: 'text-indigo-400', icon: Database },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{label}</p>
            <p className={`text-3xl font-bold ${color} mt-1`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Connector Status ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ConnectorCard
          label="OpenCTI Server"
          statusLabel="Connected & Syncing"
          icon={Database}
          color="green"
        />
        <ConnectorCard
          label="Gemini AI Engine"
          statusLabel={geminiConfigured ? 'Key Configured ✓' : '⚠ Key Not Set — Click Settings'}
          icon={BrainCircuit}
          color={geminiConfigured ? 'indigo' : 'amber'}
        />
        <ConnectorCard
          label="Global Threat Feeds"
          statusLabel="Polling Next Cycle..."
          icon={Globe}
          color="amber"
        />
      </div>

      {/* ── Daily Intel Report Banner ── */}
      <DailyReportBanner
        report={dailyReport}
        isGenerating={isDailyGenerating}
        onManualGenerate={triggerDailyReport}
      />

      <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl overflow-hidden shadow-lg">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#2a2d3e] bg-[#1e2130] flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Daily Intel Updates</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {activeDateLabel}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              <span>{activeDateSummary.campaigns} Campaigns</span>
              <span>{activeDateSummary.iocs} IOCs</span>
              <span>{activeDateSummary.hypotheses} Hypotheses</span>
            </div>

            {/* Pick Date Button */}
            <div className="relative">
              <button className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-[10px] font-bold text-white transition-colors">
                <Calendar size={12} className="text-indigo-400" />
                <span>Select Date</span>
              </button>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const parts = e.target.value.split('-')
                    const d = new Date(parts[0], parts[1] - 1, parts[2])
                    d.setHours(0,0,0,0)
                    setSelectedDate(d)
                    setSliderEndDate(d)
                    setFilterAll(false)
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 overflow-x-auto custom-scrollbar">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => {
                setFilterAll(true);
                const today = new Date(); today.setHours(0,0,0,0);
                setSelectedDate(today);
                setSliderEndDate(today);
              }}
              className={`px-4 py-3 rounded-lg border text-left min-w-[130px] transition-colors ${
                filterAll
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                  : 'bg-[#0f1117] border-[#2a2d3e] text-gray-400 hover:border-indigo-500/30 hover:text-white'
              }`}
            >
              <p className="text-xs font-bold">All Days</p>
              <p className="text-[10px] mt-1 text-gray-500">{attacks.length} campaigns total</p>
            </button>

            {displaySliderDates.map(date => {
              const isActive = !filterAll && date.toDateString() === selectedDate.toDateString();
              const stats = getStatsForDate(date);
              return (
                <button
                  key={date.toDateString()}
                  onClick={() => {
                    setSelectedDate(date);
                    setFilterAll(false);
                  }}
                  className={`px-4 py-3 rounded-lg border text-left min-w-[150px] transition-colors ${
                    isActive
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                      : 'bg-[#0f1117] border-[#2a2d3e] text-gray-400 hover:border-indigo-500/30 hover:text-white'
                  }`}
                >
                  <p className="text-xs font-bold">{fmtShortDate(date)}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                    <span>{stats.campaigns} camp</span>
                    <span>{stats.iocs} IOC</span>
                    <span>{stats.hypotheses} hypo</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Top IOCs Panel ── */}
      {dateScopedAttacks.length > 0 && (
        <TopIOCsPanel
          attacks={dateScopedAttacks}
          clientId={selectedClient?.id}
          onCreateHypothesis={handleIOCHypothesis}
        />
      )}

      {/* ── Campaign Feed Section ── */}
      <div>
        {/* Section header + filter */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Active Campaigns
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {activeDateLabel}
            </span>
            {filteredAttacks.length !== dateScopedAttacks.length && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {filteredAttacks.length} of {dateScopedAttacks.length}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search campaigns, actors, IOCs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-[#1a1d27] border border-[#2a2d3e] rounded-lg pl-8 pr-8 py-2 text-xs text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none transition-colors w-56"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Active actor filter chip */}
            {selectedActor && (
              <button
                onClick={() => setSelectedActor(null)}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/10 text-violet-400 border border-violet-500/30 rounded-lg text-xs font-bold hover:bg-violet-500/20 transition-colors"
              >
                <Filter className="w-3 h-3" />
                {selectedActor}
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <AttackList
          attacks={filteredAttacks}
          isFetching={isFetching}
          savedLibrary={savedLibrary}
          onViewHypo={setPreviewHypo}
          clientId={selectedClient?.id}
        />
      </div>

      {/* ── Modals ── */}
      {showSettings && <AISettings onClose={() => setShowSettings(false)} />}
      {previewHypo && (
        <HypoPreviewModal
          hypo={previewHypo}
          onClose={() => setPreviewHypo(null)}
          onSave={() => handleSaveHypothesis(previewHypo)}
        />
      )}
    </div>
  );
};

export default AIHub;
