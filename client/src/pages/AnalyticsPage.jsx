import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, FlaskConical, Plus, Trash2, Play, RotateCcw, X, Save, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../utils/api';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function Heatmap({ data }) {
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const getCell = (dow, hour) => data.find(d => d.dow === dow && d.hour === hour) || { total: 0, success: 0 };
  const getColor = (total, success) => {
    if (total === 0) return 'bg-gray-800 border border-gray-700';
    const rate = success / total;
    if (rate >= 0.8) return 'bg-green-600';
    if (rate >= 0.6) return 'bg-green-800';
    if (rate >= 0.4) return 'bg-yellow-700';
    if (rate >= 0.2) return 'bg-orange-800';
    return 'bg-red-900';
  };
  const getOpacity = (total) => {
    if (total === 0) return '';
    const pct = total / maxVal;
    if (pct > 0.75) return 'opacity-100';
    if (pct > 0.5) return 'opacity-80';
    if (pct > 0.25) return 'opacity-60';
    return 'opacity-40';
  };

  if (data.length === 0) return (
    <div className="text-center py-16 text-gray-500">
      <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
      <p>Belum ada data. Jalankan kampanye terlebih dahulu.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex items-center mb-1">
          <div className="w-8" />
          {HOURS.map(h => <div key={h} className="flex-1 text-center text-gray-600 text-[9px]">{h}</div>)}
        </div>
        {DAYS.map((day, dow) => (
          <div key={dow} className="flex items-center mb-1">
            <div className="w-8 text-gray-500 text-xs text-right pr-2">{day}</div>
            {HOURS.map(hour => {
              const cell = getCell(dow, hour);
              return (
                <div key={hour} className="flex-1 mx-0.5" title={`${day} ${hour}:00 — ${cell.total} total, ${cell.success} berhasil`}>
                  <div className={`h-5 rounded-sm ${getColor(cell.total, cell.success)} ${getOpacity(cell.total)} transition-all cursor-default`} />
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span>Sedikit</span>
          <div className="flex gap-1">{['bg-gray-800', 'bg-red-900 opacity-40', 'bg-yellow-700 opacity-60', 'bg-green-800 opacity-80', 'bg-green-600'].map((c, i) => <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />)}</div>
          <span>Banyak</span>
          <span className="ml-4 text-gray-600">Hijau = tingkat keberhasilan tinggi · Merah = banyak error</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="card text-center">
      <p className={`text-3xl font-bold ${color}`}>{value ?? '-'}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
      {sub && <p className="text-gray-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function ABTestCard({ test, onDelete, onReset, onRefresh }) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const totalA = test.success_a + test.fail_a;
  const totalB = test.success_b + test.fail_b;
  const rateA = totalA > 0 ? Math.round((test.success_a / totalA) * 100) : 0;
  const rateB = totalB > 0 ? Math.round((test.success_b / totalB) * 100) : 0;
  const winner = totalA > 0 && totalB > 0 ? (rateA >= rateB ? 'A' : 'B') : null;

  const fetchLogs = async () => { const r = await api.get(`/ab-tests/${test.id}/logs`); setLogs(r.data); };
  const toggleLogs = () => { if (!showLogs) fetchLogs(); setShowLogs(p => !p); };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-900/40 rounded-xl flex items-center justify-center flex-shrink-0"><FlaskConical size={18} className="text-purple-400" /></div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold">{test.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${test.status === 'running' ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>{test.status === 'running' ? '● Berjalan' : '○ Idle'}</span>
            </div>
            <p className="text-gray-400 text-xs">{(test.targets || []).length} target · Delay {test.delay_min}–{test.delay_max} dtk</p>
          </div>
        </div>
        <div className="flex gap-2">
          {test.status !== 'running' && <button onClick={() => api.post(`/ab-tests/${test.id}/start`).then(onRefresh)} className="btn-success px-3 py-2"><Play size={14} /></button>}
          <button onClick={() => onReset(test.id)} title="Reset hasil" className="btn-secondary px-3 py-2"><RotateCcw size={14} /></button>
          <button onClick={() => onDelete(test.id)} disabled={test.status === 'running'} className="btn-danger px-3 py-2"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[{ label: 'A', template: test.template_a, success: test.success_a, fail: test.fail_a, rate: rateA, total: totalA },
          { label: 'B', template: test.template_b, success: test.success_b, fail: test.fail_b, rate: rateB, total: totalB }].map(v => (
          <div key={v.label} className={`p-3 rounded-xl border ${winner === v.label ? 'border-green-500 bg-green-900/15' : 'border-gray-700 bg-gray-800'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-bold text-sm ${winner === v.label ? 'text-green-300' : 'text-gray-300'}`}>Variant {v.label}</span>
              {winner === v.label && v.total > 0 && <span className="text-green-400 text-xs">🏆 Unggul</span>}
            </div>
            <p className="text-gray-400 text-xs truncate mb-2">{v.template.slice(0, 50)}{v.template.length > 50 ? '...' : ''}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-400">✓ {v.success}</span>
              <span className="text-red-400">✗ {v.fail}</span>
              <span className="text-white font-bold">{v.total > 0 ? `${v.rate}%` : 'Belum dijalankan'}</span>
            </div>
            {v.total > 0 && <div className="mt-1.5 w-full bg-gray-700 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${v.rate}%` }} /></div>}
          </div>
        ))}
      </div>
      <button onClick={toggleLogs} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
        {showLogs ? '▲' : '▼'} {showLogs ? 'Sembunyikan Log' : 'Lihat Log'}
      </button>
      {showLogs && (
        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
          {logs.length === 0 ? <p className="text-gray-500 text-sm text-center py-2">Belum ada log</p> : logs.map(log => (
            <div key={log.id} className="flex items-center gap-2 text-xs bg-gray-800 rounded-lg px-3 py-2">
              {log.status === 'success' ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" /> : <XCircle size={11} className="text-red-400 flex-shrink-0" />}
              <span className={`font-bold ${log.variant === 'A' ? 'text-blue-300' : 'text-purple-300'}`}>{log.variant}</span>
              <span className="text-gray-300 truncate">{log.target_url?.split('/').pop()}</span>
              <span className="text-gray-500 ml-auto flex-shrink-0">{new Date(log.created_at).toLocaleTimeString('id-ID')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewABTestModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState({ name: '', targets: '', template_a: '', template_b: '', delay_min: 5, delay_max: 30, account_ids: [] });
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const toggle = id => setForm(p => ({ ...p, account_ids: p.account_ids.includes(id) ? p.account_ids.filter(a => a !== id) : [...p.account_ids, id] }));
  const submit = async e => {
    e.preventDefault();
    if (!form.account_ids.length) return setError('Pilih minimal 1 akun');
    const targets = form.targets.split('\n').map(u => u.trim()).filter(Boolean);
    if (targets.length < 2) return setError('Masukkan minimal 2 target URL');
    if (!form.template_a || !form.template_b) return setError('Kedua template wajib diisi');
    setLoading(true); setError('');
    try {
      await api.post('/ab-tests', { ...form, targets });
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Buat A/B Test</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div><label className="label">Nama Test *</label><input className="input" placeholder="Contoh: Test Template Komentar Juli" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
          <div><label className="label">URL Target (1 per baris, min 2) *</label><textarea className="input min-h-[80px] resize-none text-sm" placeholder="https://facebook.com/groups/.../posts/123&#10;https://facebook.com/groups/.../posts/456" value={form.targets} onChange={e => setForm(p => ({ ...p, targets: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Template A *</label><textarea className="input min-h-[90px] resize-none text-sm" placeholder="Template komentar pertama" value={form.template_a} onChange={e => setForm(p => ({ ...p, template_a: e.target.value }))} /></div>
            <div><label className="label">Template B *</label><textarea className="input min-h-[90px] resize-none text-sm" placeholder="Template komentar alternatif" value={form.template_b} onChange={e => setForm(p => ({ ...p, template_b: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label text-xs">Delay Min (dtk)</label><input type="number" className="input text-sm" min={3} value={form.delay_min} onChange={e => setForm(p => ({ ...p, delay_min: +e.target.value }))} /></div>
            <div><label className="label text-xs">Delay Max (dtk)</label><input type="number" className="input text-sm" min={5} value={form.delay_max} onChange={e => setForm(p => ({ ...p, delay_max: +e.target.value }))} /></div>
          </div>
          <div><label className="label">Pilih Akun ({form.account_ids.length} dipilih) *</label>
            <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto">
              {accounts.map(a => <label key={a.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${form.account_ids.includes(a.id) ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800'}`}><input type="checkbox" checked={form.account_ids.includes(a.id)} onChange={() => toggle(a.id)} /><span className="text-white truncate">{a.name}</span></label>)}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}><Save size={15} />{loading ? 'Menyimpan...' : 'Buat Test'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'chart', label: '📈 Grafik Performa' },
  { key: 'heatmap', label: '📊 Heatmap Jam Terbaik' },
  { key: 'abtest', label: '🧪 A/B Test Template' },
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState('chart');
  const [heatmap, setHeatmap] = useState([]);
  const [stats, setStats] = useState(null);
  const [tests, setTests] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dailyData, setDailyData] = useState([]);
  const [campaignData, setCampaignData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [h, s, t, a, d, c] = await Promise.all([
        api.get('/analytics/heatmap'), api.get('/analytics/stats'),
        api.get('/ab-tests'), api.get('/accounts'),
        api.get('/analytics/daily?days=30'), api.get('/analytics/campaigns-overview'),
      ]);
      setHeatmap(h.data); setStats(s.data); setTests(t.data); setAccounts(a.data);
      setDailyData(d.data.map(r => ({ ...r, date: r.date.slice(5) })));
      setCampaignData(c.data.map(r => ({ ...r, name: r.name?.length > 16 ? r.name.slice(0, 14) + '…' : r.name })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(() => { if (tests.some(t => t.status === 'running')) fetchData(); }, 5000);
    return () => clearInterval(iv);
  }, [tests, fetchData]);

  const deleteTest = async id => {
    if (!confirm('Hapus A/B test ini?')) return;
    await api.delete(`/ab-tests/${id}`);
    setTests(p => p.filter(t => t.id !== id));
  };
  const resetTest = async id => {
    if (!confirm('Reset hasil test ini?')) return;
    await api.post(`/ab-tests/${id}/reset`);
    fetchData();
  };

  const totalComments = stats ? (stats.comments?.total || 0) + (stats.posts?.total || 0) : 0;
  const totalSuccess = stats ? (stats.comments?.success || 0) + (stats.posts?.success || 0) : 0;
  const successRate = totalComments > 0 ? Math.round((totalSuccess / totalComments) * 100) : 0;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Analitik</h1><p className="text-gray-400 mt-1">Heatmap waktu terbaik dan A/B test template komentar</p></div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Aksi" value={totalComments.toLocaleString()} color="text-blue-400" />
          <StatCard label="Berhasil" value={totalSuccess.toLocaleString()} color="text-green-400" />
          <StatCard label="Tingkat Sukses" value={`${successRate}%`} color={successRate >= 70 ? 'text-green-400' : successRate >= 40 ? 'text-yellow-400' : 'text-red-400'} />
          <StatCard label="Akun Aktif" value={stats.accounts?.active || 0} sub={`${stats.accounts?.count || 0} total`} color="text-purple-400" />
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-800">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <>
          {tab === 'chart' && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2"><TrendingUp size={18} className="text-blue-400" /> Komentar 30 Hari Terakhir</h3>
                <p className="text-gray-400 text-sm mb-4">Jumlah komentar berhasil dan gagal per hari</p>
                {dailyData.length === 0 ? (
                  <div className="text-center py-16 text-gray-600"><BarChart3 size={40} className="mx-auto mb-3 opacity-30" /><p>Belum ada data. Jalankan kampanye terlebih dahulu.</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
                      <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                      <Line type="monotone" dataKey="success" name="Berhasil" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="failed" name="Gagal" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2"><BarChart3 size={18} className="text-purple-400" /> Performa per Kampanye</h3>
                <p className="text-gray-400 text-sm mb-4">10 kampanye terbanyak aktivitas</p>
                {campaignData.length === 0 ? (
                  <div className="text-center py-16 text-gray-600"><BarChart3 size={40} className="mx-auto mb-3 opacity-30" /><p>Belum ada data kampanye.</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={campaignData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#d1d5db', fontSize: 11 }} width={90} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }} />
                      <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                      <Bar dataKey="success" name="Berhasil" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="failed" name="Gagal" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
          {tab === 'heatmap' && (
            <div className="card">
              <h3 className="text-white font-semibold mb-1">Aktivitas per Jam & Hari</h3>
              <p className="text-gray-400 text-sm mb-4">Waktu dengan keberhasilan tertinggi berdasarkan semua kampanye dan task yang pernah dijalankan</p>
              <Heatmap data={heatmap} />
            </div>
          )}
          {tab === 'abtest' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm">{tests.length} test · {tests.filter(t => t.status === 'running').length} aktif</p>
                <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Buat A/B Test</button>
              </div>
              {tests.length === 0 ? (
                <div className="card text-center py-14">
                  <FlaskConical size={48} className="text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Belum Ada A/B Test</h3>
                  <p className="text-gray-400 mb-6">Bandingkan dua template komentar untuk menemukan yang paling efektif</p>
                  <button className="btn-primary mx-auto" onClick={() => setShowModal(true)}><Plus size={18} /> Buat Test Pertama</button>
                </div>
              ) : tests.map(t => <ABTestCard key={t.id} test={t} onDelete={deleteTest} onReset={resetTest} onRefresh={fetchData} />)}
            </div>
          )}
        </>
      )}
      {showModal && <NewABTestModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
    </div>
  );
}
