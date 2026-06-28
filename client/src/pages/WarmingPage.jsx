import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Plus, Play, Square, Trash2, X, Save, RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle, Edit3 } from 'lucide-react';
import api from '../utils/api';

function StatusBadge({ status }) {
  const map = { running: 'badge-running', idle: 'badge-idle', completed: 'badge-completed', stopped: 'badge-stopped' };
  const labels = { running: '● Berjalan', idle: '○ Idle', completed: '✓ Selesai', stopped: '■ Berhenti' };
  return <span className={map[status] || 'badge-idle'}>{labels[status] || status}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const DEFAULT_SCHEDULE = [
  { day: 1, likes: 5, views: 3, comments: 0 },
  { day: 2, likes: 8, views: 5, comments: 0 },
  { day: 3, likes: 10, views: 5, comments: 1 },
  { day: 4, likes: 12, views: 8, comments: 1 },
  { day: 5, likes: 15, views: 10, comments: 2 },
  { day: 7, likes: 18, views: 10, comments: 3 },
  { day: 10, likes: 20, views: 12, comments: 5 },
  { day: 14, likes: 25, views: 15, comments: 7 },
];

function parseWarmingError(msg) {
  if (!msg) return { code: null, message: msg };
  const match = msg.match(/^([A-Z_]+): (.+)/);
  if (match) return { code: match[1], rest: match[2] };
  return { code: null, rest: msg };
}

function PlanCard({ plan, onStart, onStop, onDelete, onEdit, onRefresh }) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const pct = plan.total_days > 0 ? Math.round((plan.current_day / plan.total_days) * 100) : 0;

  const fetchLogs = async () => {
    const r = await api.get(`/warming/${plan.id}/logs`);
    setLogs(r.data);
  };
  const toggleLogs = () => { if (!showLogs) fetchLogs(); setShowLogs(p => !p); };

  return (
    <div className="card hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-orange-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <Flame size={18} className="text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-white font-semibold">{plan.name}</h3>
              <StatusBadge status={plan.status} />
            </div>
            <div className="flex gap-3 text-xs text-gray-400 flex-wrap mb-2">
              <span>👤 {plan.account_name || '?'}</span>
              <span>·</span>
              <span>Hari {plan.current_day}/{plan.total_days}</span>
              <span className="text-xs text-blue-300">{plan.browser_engine || 'patchright'}</span>
              {plan.next_run && <span>· Berikutnya: {new Date(plan.next_run).toLocaleString('id-ID')}</span>}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
              <div className={`h-2 rounded-full transition-all ${plan.status === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-gray-500 text-xs">{pct}% selesai</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onRefresh} className="btn-secondary px-2 py-2" title="Refresh"><RefreshCw size={14} /></button>
          <button onClick={onEdit} disabled={plan.status === 'running'} className="btn-secondary px-2 py-2" title="Edit rencana"><Edit3 size={14} /></button>
          {plan.status === 'running' ? (
            <button onClick={onStop} className="btn-danger px-3 py-2" title="Stop"><Square size={14} /></button>
          ) : plan.status !== 'completed' ? (
            <button onClick={onStart} className="btn-success px-3 py-2" title="Mulai"><Play size={14} /></button>
          ) : null}
          <button onClick={onDelete} disabled={plan.status === 'running'} className="btn-danger px-3 py-2" title="Hapus"><Trash2 size={14} /></button>
        </div>
      </div>
      <button onClick={toggleLogs} className="mt-3 flex items-center gap-2 text-gray-400 hover:text-white text-sm">
        {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showLogs ? 'Sembunyikan Log' : 'Lihat Log Aktivitas'}
      </button>
      {showLogs && (
        <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
          {logs.length === 0 ? <p className="text-gray-500 text-sm text-center py-2">Belum ada log</p> : logs.map(log => (
            <div key={log.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${log.status === 'success' ? 'bg-green-900/20 border border-green-800/30' : log.status === 'skipped' ? 'bg-yellow-900/20 border border-yellow-800/30' : 'bg-gray-800 border border-gray-700'}`}>
              <span className={log.status === 'success' ? 'text-green-400' : log.status === 'skipped' ? 'text-yellow-400' : 'text-gray-400'}>{log.status === 'skipped' ? '⚠️' : log.action === 'like' ? '❤️' : log.action === 'browse' ? '👁️' : '💬'}</span>
              <div className="flex-1">
                <span className="text-white">Hari {log.day_number}: </span>
                <span className="text-gray-300">{log.target}</span>
                {log.error_message && (() => {
                  const { code, rest } = parseWarmingError(log.error_message);
                  return (
                    <div className="mt-0.5 flex flex-wrap items-start gap-1">
                      {code && <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${log.status === 'skipped' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-red-900/40 text-red-300'}`}>{code}</span>}
                      <span className={log.status === 'skipped' ? 'text-yellow-300' : 'text-red-300'}>{rest}</span>
                    </div>
                  );
                })()}
                <p className="text-gray-500 mt-0.5">{new Date(log.created_at).toLocaleString('id-ID')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewPlanModal({ onClose, onSave, accounts, editPlan }) {
  const isEdit = !!editPlan;
  const initialLikeUrls = editPlan?.like_urls
    ? (Array.isArray(editPlan.like_urls) ? editPlan.like_urls.join('\n') : '')
    : '';
  const [form, setForm] = useState({
    name: editPlan?.name || '',
    account_id: editPlan?.account_id || '',
    total_days: editPlan?.total_days || 14,
    like_urls: initialLikeUrls,
    niche: editPlan?.niche || '',
    browser_engine: editPlan?.browser_engine || 'patchright',
    auto_post_status: !!editPlan?.auto_post_status,
    auto_setup_profile: !!editPlan?.auto_setup_profile,
    photo_url: '',
    bio: '',
    city: '',
    workplace: '',
    school: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!form.account_id) return setError('Pilih akun');
    setLoading(true); setError('');
    const payload = {
      ...form,
      schedule: DEFAULT_SCHEDULE,
      like_urls: form.like_urls.split('\n').map(u => u.trim()).filter(Boolean),
      auto_post_status: form.auto_post_status ? 1 : 0,
      auto_setup_profile: form.auto_setup_profile ? 1 : 0,
      profile_data: form.auto_setup_profile ? { photo_url: form.photo_url, bio: form.bio, city: form.city, workplace: form.workplace, school: form.school } : null,
    };
    try {
      payload.browser_engine = form.browser_engine || 'patchright';
      if (isEdit) await api.put(`/warming/${editPlan.id}`, payload);
      else await api.post('/warming', payload);
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={isEdit ? 'Edit Rencana Warming' : 'Buat Rencana Warming Akun'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
        <div><label className="label">Nama Rencana *</label><input className="input" placeholder="Contoh: Warming Akun Baru Juli" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
        <div><label className="label">Akun yang Akan Di-Warm *</label>
          <select className="input" value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} required>
            <option value="">-- Pilih akun --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.status})</option>)}
          </select>
        </div>
        <div><label className="label">Durasi Warming (hari)</label>
          <select className="input" value={form.total_days} onChange={e => setForm(p => ({ ...p, total_days: +e.target.value }))}>
            {[7, 10, 14, 21, 30].map(d => <option key={d} value={d}>{d} hari</option>)}
          </select>
        </div>
        <div>
          <label className="label">URL Post untuk Like <span className="text-gray-500 font-normal">(opsional, 1 per baris)</span></label>
          <textarea
            className="input min-h-[80px] resize-none text-sm font-mono"
            placeholder={"https://facebook.com/groups/xxx/posts/123\nhttps://facebook.com/permalink/456"}
            value={form.like_urls}
            onChange={e => setForm(p => ({ ...p, like_urls: e.target.value }))}
          />
          <p className="text-gray-500 text-xs mt-1">Jika diisi, warming akan like post dari URL ini. Jika kosong, sistem mencoba ambil dari feed otomatis.</p>
        </div>

        {/* Auto Post Status */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-purple-200">
                      <div>
            <label className="label">Browser Engine</label>
            <select className="input" value={form.browser_engine || 'patchright'} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
              <option value="patchright">Patchright (default, paling kompatibel)</option>
              <option value="obscura">Obscura (ringan, hemat RAM)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Obscura dipakai saat auto post status. Like/view tetap via API.</p>
          </div>
          <input type="checkbox" checked={form.auto_post_status} onChange={e => setForm(p => ({ ...p, auto_post_status: e.target.checked }))} />
            🤖 Auto Post Status (AI Generate)
          </label>
          <p className="text-purple-300/70 text-xs mt-1">Mulai hari ke-3, akun akan posting status sendiri yang di-generate AI sesuai niche. Bikin akun terlihat aktif seperti manusia.</p>
          {form.auto_post_status && (
            <div className="mt-3">
              <label className="label">Niche / Topik Akun</label>
              <input className="input" value={form.niche} onChange={e => setForm(p => ({ ...p, niche: e.target.value }))} placeholder="Contoh: jual beli fashion, otomotif, kuliner Bandung" />
              <p className="text-gray-500 text-xs mt-1">AI akan generate status sesuai topik ini. Contoh: "Hari ini dapet orderan lagi, alhamdulillah 🙏"</p>
            </div>
          )}
        </div>

        {/* Auto Setup Profile */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-200">
            <input type="checkbox" checked={form.auto_setup_profile} onChange={e => setForm(p => ({ ...p, auto_setup_profile: e.target.checked }))} />
            👤 Auto Setup Profil (Bertahap)
          </label>
          <p className="text-blue-300/70 text-xs mt-1">Setiap hari warming, sistem juga edit 1 bagian profil (foto, bio, kota, kerja, sekolah) secara bertahap.</p>
          {form.auto_setup_profile && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="label">URL Foto Profil</label>
                <input className="input font-mono text-xs" value={form.photo_url} onChange={e => setForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://example.com/foto.jpg" />
              </div>
              <div>
                <label className="label">Bio</label>
                <input className="input" value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Pebisnis online | Bandung" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><label className="label">Kota</label><input className="input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Bandung" /></div>
                <div><label className="label">Kerja</label><input className="input" value={form.workplace} onChange={e => setForm(p => ({ ...p, workplace: e.target.value }))} placeholder="PT Maju" /></div>
                <div><label className="label">Sekolah</label><input className="input" value={form.school} onChange={e => setForm(p => ({ ...p, school: e.target.value }))} placeholder="Unpad" /></div>
              </div>
              <p className="text-gray-500 text-xs">Hari 4: foto, Hari 5: bio, Hari 6: kota, Hari 7: kerja, Hari 8: sekolah (masing-masing 1x saja)</p>
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <h4 className="text-white font-medium text-sm mb-3">📋 Jadwal Warming (Otomatis)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-1 pr-4">Hari ke</th>
                <th className="text-center py-1 pr-4">Like</th>
                <th className="text-center py-1 pr-4">Browse</th>
                <th className="text-center py-1 pr-4">Komentar</th>
                {form.auto_post_status && <th className="text-center py-1 pr-4">Status AI</th>}
                {form.auto_setup_profile && <th className="text-center py-1">Setup Profil</th>}
              </tr></thead>
              <tbody>
                {(() => {
                  // Generate jadwal lengkap sampai total_days
                  const days = [];
                  for (let d = 1; d <= form.total_days; d++) {
                    // Cari config dari DEFAULT_SCHEDULE (ambil yang terdekat <= d)
                    const cfg = DEFAULT_SCHEDULE.reduce((prev, s) => s.day <= d ? s : prev, DEFAULT_SCHEDULE[0]);
                    days.push({ day: d, ...cfg });
                  }
                  // Tampilkan: hari 1-7 semua, lalu tiap 3 hari, lalu hari terakhir
                  const shown = days.filter((d, i) => d.day <= 7 || d.day % 3 === 0 || d.day === form.total_days);
                  return shown.map(s => {
                    const profileFields = ['foto', 'bio', 'kota', 'kerja', 'sekolah'];
                    // Hanya hari 4-8 (5 field, tidak rotasi)
                    const profileField = (form.auto_setup_profile && s.day >= 4 && s.day <= 8) ? profileFields[s.day - 4] : null;
                    return (
                      <tr key={s.day} className="border-b border-gray-800 text-gray-300">
                        <td className="py-1.5 pr-4">Hari {s.day}</td>
                        <td className="py-1.5 pr-4 text-center text-red-400">❤️ {s.likes}x</td>
                        <td className="py-1.5 pr-4 text-center text-blue-400">👁️ {s.views}x</td>
                        <td className="py-1.5 pr-4 text-center text-green-400">{s.comments > 0 ? `💬 ${s.comments}x` : '-'}</td>
                        {form.auto_post_status && <td className="py-1.5 pr-4 text-center text-purple-400">{s.day >= 3 ? '🤖 1x' : <span className="text-gray-600">-</span>}</td>}
                        {form.auto_setup_profile && <td className="py-1.5 text-center text-cyan-400">{profileField ? `👤 ${profileField}` : <span className="text-gray-600">-</span>}</td>}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-3 text-xs text-orange-200/80">
          <p className="font-semibold text-orange-300 mb-1">🔥 Kenapa Warming Penting?</p>
          <p>Akun baru atau lama tidak aktif mudah kena checkpoint. Warming mensimulasikan aktivitas normal manusia: like postingan, browse halaman, dan komentar — secara bertahap — sebelum digunakan untuk auto-post/komentar massal.</p>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
          <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}><Save size={15} />{loading ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Buat Rencana')}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function WarmingPage() {
  const [plans, setPlans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([api.get('/warming'), api.get('/accounts')]);
      setPlans(p.data); setAccounts(a.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(() => { if (plans.some(p => p.status === 'running')) fetchData(); }, 8000);
    return () => clearInterval(iv);
  }, [plans, fetchData]);

  const action = async (id, verb) => {
    await api.post(`/warming/${id}/${verb}`).catch(e => alert(e.response?.data?.error || 'Error'));
    setTimeout(fetchData, 800);
  };
  const del = async id => {
    if (!confirm('Hapus rencana warming ini?')) return;
    await api.delete(`/warming/${id}`);
    setPlans(p => p.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Warming Akun</h1>
        <p className="text-gray-400 mt-1">Panaskan akun baru atau tidak aktif agar tahan checkpoint</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center"><p className="text-3xl font-bold text-orange-400">{plans.length}</p><p className="text-gray-400 text-sm mt-1">Total Rencana</p></div>
        <div className="card text-center"><p className="text-3xl font-bold text-blue-400">{plans.filter(p => p.status === 'running').length}</p><p className="text-gray-400 text-sm mt-1">Sedang Berjalan</p></div>
        <div className="card text-center"><p className="text-3xl font-bold text-green-400">{plans.filter(p => p.status === 'completed').length}</p><p className="text-gray-400 text-sm mt-1">Selesai</p></div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">{plans.length} rencana</p>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Buat Rencana Warming</button>
      </div>
      {loading ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        : plans.length === 0 ? (
          <div className="card text-center py-14">
            <Flame size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Belum Ada Rencana Warming</h3>
            <p className="text-gray-400 mb-6">Buat rencana warming untuk menyiapkan akun baru atau akun lama agar tahan checkpoint</p>
            <button className="btn-primary mx-auto" onClick={() => setShowModal(true)}><Plus size={18} /> Buat Sekarang</button>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => <PlanCard key={plan.id} plan={plan} onStart={() => action(plan.id, 'start')} onStop={() => action(plan.id, 'stop')} onDelete={() => del(plan.id)} onEdit={() => setEditPlan(plan)} onRefresh={fetchData} />)}
          </div>
        )}
      {showModal && <NewPlanModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts} />}
      {editPlan && <NewPlanModal editPlan={editPlan} onClose={() => setEditPlan(null)} onSave={() => { setEditPlan(null); fetchData(); }} accounts={accounts} />}
    </div>
  );
}
