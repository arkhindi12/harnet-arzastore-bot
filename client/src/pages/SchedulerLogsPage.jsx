import React, { useEffect, useState, useCallback } from 'react';
import { Activity, RefreshCw, Filter, CheckCircle, XCircle, Info, Clock, AlertCircle } from 'lucide-react';
import api from '../utils/api';

const TYPE_LABEL = {
  campaign_auto_start: '🚀 Kampanye Auto-Start',
  campaign_auto_stop: '⏹ Kampanye Auto-Stop',
  campaign_scheduler_tick: '⚠️ Campaign Scheduler',
  warming_day: '🔥 Warming Hari',
  warming_completed: '✅ Warming Selesai',
  post_task_auto_up: '🔄 Auto UP',
  post_task_group_post: '📬 Post ke Grup',
  post_task_marketplace: '🛍 Marketplace',
  post_task_share_post: '↗️ Share ke Grup',
  post_task_run: '📦 Post Task',
  keyword_monitor_check: '🔍 Keyword Monitor',
  auto_reply_check: '↩️ Auto Reply',
  discovery_groups_auto: '🔎 Sync Grup',
  discovery_feed_auto: '📰 Sync Feed',
  discovery_auto_tick: '⚠️ Discovery Tick',
  weekly_report: '📊 Laporan Mingguan',
  weekly_report_tick: '⚠️ Weekly Tick',
};

const STATUS_STYLE = {
  success: { color: '#86efac', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', icon: CheckCircle },
  failed: { color: '#fca5a5', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', icon: XCircle },
  skipped: { color: '#fcd34d', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', icon: AlertCircle },
  info: { color: '#93c5fd', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', icon: Info },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.info;
  const Icon = s.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: '0.7rem', fontWeight: 600 }}>
      <Icon size={11} /> {status}
    </span>
  );
}

export default function SchedulerLogsPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [types, setTypes] = useState([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s, t] = await Promise.all([
        api.get('/scheduler-logs', { params: { type: filter || undefined, limit: 200 } }),
        api.get('/scheduler-logs/stats'),
        api.get('/scheduler-logs/types'),
      ]);
      setLogs(l.data); setStats(s.data); setTypes(t.data);
    } catch (e) {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [autoRefresh, load]);

  const filteredLogs = statusFilter ? logs.filter(l => l.status === statusFilter) : logs;

  const summary = stats.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + s.cnt;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Activity size={22} /> Log Aktivitas Scheduler</h1>
        <p className="text-gray-400 mt-1">Riwayat eksekusi semua scheduler/cron — 7 hari terakhir, log otomatis dibersihkan setelah 30 hari</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'success', label: 'Sukses', color: '#22c55e' },
          { key: 'failed', label: 'Gagal', color: '#ef4444' },
          { key: 'skipped', label: 'Skipped', color: '#f59e0b' },
          { key: 'info', label: 'Info', color: '#3b82f6' },
        ].map(c => (
          <div key={c.key} className="card text-center" style={{ padding: 16 }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c.color }}>{summary[c.key] || 0}</div>
            <div className="text-gray-400 text-xs mt-1">{c.label} (7 hari)</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-gray-400" />
            <select value={filter} onChange={e => setFilter(e.target.value)} className="input text-sm" style={{ minWidth: 200 }}>
              <option value="">Semua tipe</option>
              {types.map(t => <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm">
              <option value="">Semua status</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
              <option value="skipped">skipped</option>
              <option value="info">info</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto refresh 15s
            </label>
            <button onClick={load} className="btn-secondary text-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity size={36} className="mx-auto mb-3 opacity-40" />
            <p>Belum ada log scheduler.</p>
            <p className="text-xs mt-1">Log akan muncul saat ada scheduler/cron yang dijalankan otomatis.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredLogs.map(log => (
              <div key={log.id} className="rounded-lg px-3 py-2 text-sm" style={{ background: '#1f2937', border: '1px solid #374151' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={log.status} />
                      <span className="text-white font-medium text-sm">{TYPE_LABEL[log.type] || log.type}</span>
                      {log.target_name && <span className="text-gray-400 text-xs">— {log.target_name}</span>}
                    </div>
                    {log.message && <p className="text-gray-300 text-xs mt-1">{log.message}</p>}
                  </div>
                  <div className="text-right text-xs text-gray-500 flex-shrink-0">
                    <div className="flex items-center gap-1 justify-end"><Clock size={11} /> {new Date(log.created_at).toLocaleString('id-ID')}</div>
                    {log.duration_ms != null && <div className="text-gray-600 mt-0.5">{(log.duration_ms / 1000).toFixed(1)}s</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
