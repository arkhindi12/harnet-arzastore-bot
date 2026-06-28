import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Clock, Globe, Monitor, Activity, Zap } from 'lucide-react';
import api from '../utils/api';

function RiskBadge({ level, score }) {
  const styles = {
    critical: { bg: 'rgba(220,38,38,0.18)', border: 'rgba(220,38,38,0.4)', color: '#fca5a5', label: 'CRITICAL' },
    high: { bg: 'rgba(234,88,12,0.18)', border: 'rgba(234,88,12,0.4)', color: '#fdba74', label: 'HIGH' },
    medium: { bg: 'rgba(234,179,8,0.18)', border: 'rgba(234,179,8,0.4)', color: '#fde68a', label: 'MEDIUM' },
    low: { bg: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.4)', color: '#86efac', label: 'LOW' },
  };
  const s = styles[level] || styles.low;
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {s.label} {score != null ? `(${score})` : ''}
    </span>
  );
}

function StatCard({ label, value, color = '#a3a3a3' }) {
  return (
    <div className="card text-center py-3">
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function TrendBar({ success, failed }) {
  const total = success + failed;
  if (total === 0) return <div className="text-gray-500 text-xs">Tidak ada aktivitas</div>;
  const sPct = (success / total) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
        <div style={{ width: `${sPct}%`, background: '#22c55e', height: '100%' }} />
      </div>
      <span className="text-green-400">{success}</span>
      <span className="text-gray-600">/</span>
      <span className="text-red-400">{failed}</span>
    </div>
  );
}

function AccountCard({ acc, onCheckProxy }) {
  const [open, setOpen] = useState(false);
  const [pinging, setPinging] = useState(false);

  const handleCheck = async () => {
    setPinging(true);
    try { await onCheckProxy(acc.id); }
    finally { setPinging(false); }
  };

  const statusColors = {
    active: 'text-green-400',
    checkpoint: 'text-yellow-400',
    invalid: 'text-red-400',
    problematic: 'text-orange-400',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-sm truncate">{acc.name}</h3>
            <span className={`text-xs ${statusColors[acc.status] || 'text-gray-400'}`}>● {acc.status}</span>
            <RiskBadge level={acc.risk_level} score={acc.risk_score} />
            {acc.cooldown_active && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 flex items-center gap-1">
                <Clock size={10} /> cooldown
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[11px]">
            <span className={`px-2 py-0.5 rounded-full ${acc.fatigue?.level === 'high' ? 'bg-red-500/15 text-red-300' : acc.fatigue?.level === 'medium' ? 'bg-yellow-500/15 text-yellow-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              fatigue: {acc.fatigue?.level || 'low'} ({Math.round(acc.fatigue?.score || 0)})
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">persona: {acc.persona}</span>
            {acc.cookie_age_days != null && (
              <span className={`px-2 py-0.5 rounded-full ${acc.cookie_age_days > 90 ? 'bg-orange-500/15 text-orange-300' : 'bg-gray-700/40 text-gray-300'}`}>
                cookie: {acc.cookie_age_days}h
              </span>
            )}
            {acc.ua_shared && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">UA shared</span>}
            {acc.proxy_shared && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">Proxy shared</span>}
            {!acc.proxy && <span className="px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-400">no proxy</span>}
            {acc.proxy_health && (
              <span className={`px-2 py-0.5 rounded-full ${acc.proxy_health.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                proxy {acc.proxy_health.ok ? `OK ${acc.proxy_health.latency || ''}ms` : `FAIL: ${acc.proxy_health.reason || ''}`}
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-gray-500 text-[11px] mb-1">Aktivitas 24 jam</p>
            <TrendBar success={acc.trend?.last24?.success || 0} failed={acc.trend?.last24?.failed || 0} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <button onClick={handleCheck} disabled={pinging || !acc.proxy} className="btn-secondary text-xs px-2 py-1.5" title={acc.proxy ? 'Cek koneksi proxy' : 'Tidak ada proxy'}>
            <Globe size={12} />{pinging ? 'cek...' : 'Cek Proxy'}
          </button>
          <button onClick={() => setOpen(p => !p)} className="btn-secondary text-xs px-2 py-1.5">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {open ? 'Tutup' : 'Detail'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
          <div>
            <p className="text-gray-300 text-xs font-semibold mb-1.5 flex items-center gap-1.5"><AlertTriangle size={12} /> Rekomendasi</p>
            <ul className="space-y-1 text-xs text-gray-400">
              {acc.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          </div>

          {acc.top_errors?.length > 0 && (
            <div>
              <p className="text-gray-300 text-xs font-semibold mb-1.5 flex items-center gap-1.5"><Activity size={12} /> Error 7 hari teratas</p>
              <div className="space-y-1">
                {acc.top_errors.map((e, i) => (
                  <div key={i} className="bg-red-900/15 border border-red-800/30 rounded px-3 py-1.5 text-[11px] text-red-200 flex items-center justify-between gap-3">
                    <span className="truncate">{e.error_message}</span>
                    <span className="bg-red-500/15 text-red-300 px-2 py-0.5 rounded-full flex-shrink-0">{e.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-gray-800/50 rounded px-2.5 py-2">
              <p className="text-gray-500">Last used</p>
              <p className="text-gray-300">{acc.last_used ? new Date(acc.last_used).toLocaleString('id-ID') : '—'}</p>
            </div>
            <div className="bg-gray-800/50 rounded px-2.5 py-2">
              <p className="text-gray-500">Cooldown sampai</p>
              <p className="text-gray-300">{acc.cooldown_until ? new Date(acc.cooldown_until).toLocaleString('id-ID') : '—'}</p>
            </div>
            <div className="bg-gray-800/50 rounded px-2.5 py-2 col-span-2">
              <p className="text-gray-500">User agent</p>
              <p className="text-gray-300 font-mono text-[10px] break-all">{acc.user_agent || 'acak'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AntiDetectionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [withProxy, setWithProxy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (checkProxy = false) => {
    setLoading(true); setError('');
    try {
      const r = await api.get(`/anti-detection/dashboard${checkProxy ? '?check_proxy=1' : ''}`);
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const handleProxyCheck = async (accountId) => {
    try {
      const r = await api.post('/anti-detection/check-proxy', { account_id: accountId });
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map(a => a.id === accountId ? { ...a, proxy_health: r.data } : a),
        };
      });
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal cek proxy');
    }
  };

  const summary = data?.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0, cooldown: 0, shared_ua_groups: 0, shared_proxy_groups: 0 };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-emerald-400" /> Anti-Detection Dashboard
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Pantau risiko deteksi per akun: fatigue, fingerprint, cookie age, proxy health, error trend.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} className="btn-secondary text-sm" disabled={loading}>
            <Globe size={14} /> Cek Semua Proxy
          </button>
          <button onClick={() => load(withProxy)} className="btn-primary text-sm" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Akun" value={summary.total} color="#9ca3af" />
        <StatCard label="Risk Critical" value={summary.critical} color="#dc2626" />
        <StatCard label="Risk High" value={summary.high} color="#ea580c" />
        <StatCard label="Cooldown Aktif" value={summary.cooldown} color="#f59e0b" />
      </div>

      {(summary.shared_ua_groups > 0 || summary.shared_proxy_groups > 0) && (
        <div className="card border-yellow-700/40 bg-yellow-900/10">
          <p className="text-yellow-300 text-sm font-semibold flex items-center gap-2 mb-2">
            <AlertTriangle size={14} /> Fingerprint Sharing Terdeteksi
          </p>
          {summary.shared_ua_groups > 0 && (
            <p className="text-yellow-200 text-xs">• {summary.shared_ua_groups} grup akun berbagi User Agent yang sama. Disarankan ganti UA per akun.</p>
          )}
          {summary.shared_proxy_groups > 0 && (
            <p className="text-yellow-200 text-xs">• {summary.shared_proxy_groups} grup akun berbagi proxy yang sama. Disarankan minimal 1 IP per 2 akun.</p>
          )}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : data?.accounts?.length === 0 ? (
        <div className="card text-center py-10 text-gray-500 text-sm">Belum ada akun terdaftar.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data?.accounts?.map(acc => (
            <AccountCard key={acc.id} acc={acc} onCheckProxy={handleProxyCheck} />
          ))}
        </div>
      )}
    </div>
  );
}
