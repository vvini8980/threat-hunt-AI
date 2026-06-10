import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Shield, TrendingUp, AlertTriangle, Target, RefreshCw, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { supabase } from '../../services/supabase';

// ─── Mini stat card ──────────────────────────────────────────────────────────
const MiniStat = ({ label, value, icon: Icon, color, onClick }) => {
  const colors = {
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    amber:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red:    'text-red-400 bg-red-500/10 border-red-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  };
  const c = colors[color] || colors.orange;
  return (
    <div
      onClick={onClick}
      className={`bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-4 flex items-center justify-between ${onClick ? 'cursor-pointer hover:border-indigo-500/30 hover:bg-[#1e2035] transition-all' : ''}`}
    >
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{label}</p>
        <p className={`text-2xl font-bold ${c.split(' ')[0]} mt-1 truncate max-w-[120px]`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${c}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const IntelSummaryPanel = ({ clientId }) => {
  const navigate = useNavigate();
  const [iocStats, setIocStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId || !supabase) { setLoading(false); return; }
    loadIOCStats();
  }, [clientId]);

  const loadIOCStats = async () => {
    setLoading(true);
    try {
      const { data: allIOCs } = await supabase
        .from('ioc_reports')
        .select('ioc_type, confidence, threat_actor, report_date, value')
        .eq('client_id', clientId)
        .order('report_date', { ascending: false })
        .limit(500);

      if (!allIOCs) return;

      const today = new Date().toISOString().split('T')[0];
      const todayIOCs = allIOCs.filter(i => i.report_date?.startsWith(today));

      // Calculate Top Actor
      const actorMap = {};
      allIOCs.forEach(i => {
        if (i.threat_actor && i.threat_actor !== 'Unknown') {
          actorMap[i.threat_actor] = (actorMap[i.threat_actor] || 0) + 1;
        }
      });
      let topActor = '-';
      let maxCount = 0;
      Object.entries(actorMap).forEach(([actor, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topActor = actor;
        }
      });

      setIocStats({
        total: allIOCs.length,
        today: todayIOCs.length,
        high: allIOCs.filter(i => i.confidence === 'High').length,
        topActor,
      });
    } catch (e) {
      console.error('[Intel Summary] IOC stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncIOCs = async () => {
    if (!clientId) return;
    try {
      await fetch(`${API_BASE_URL}/ioc/fetch/${clientId}`, { method: 'POST' });
      await loadIOCStats();
    } catch (e) {
      console.error('[Intel Summary] Sync failed:', e);
    }
  };

  if (!clientId) return null;

  return (
    <div className="flex flex-col gap-3 mt-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-400" />
          IOC Intelligence Library
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncIOCs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Sync IOCs
          </button>
          <button
            onClick={() => navigate('/ioc-reports')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2a2d3e] text-gray-400 border border-[#3a3d4e] hover:text-white transition-colors"
          >
            View Library <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1a1d27] border border-[#2a2d3e] rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat
            label="Total IOCs"
            value={iocStats?.total ?? 0}
            icon={Shield}
            color="orange"
            onClick={() => navigate('/ioc-reports')}
          />
          <MiniStat
            label="Collected Today"
            value={iocStats?.today ?? 0}
            icon={TrendingUp}
            color="amber"
          />
          <MiniStat
            label="High Confidence"
            value={iocStats?.high ?? 0}
            icon={AlertTriangle}
            color="red"
          />
          <MiniStat
            label="Top Threat Actor"
            value={iocStats?.topActor ?? '-'}
            icon={Target}
            color="violet"
          />
        </div>
      )}
    </div>
  );
};

export default IntelSummaryPanel;
