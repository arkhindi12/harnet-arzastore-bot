import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit2, Trash2, ToggleLeft, ToggleRight, Shield, ShieldOff, Calendar, MessageSquare, Megaphone, CheckCircle, XCircle, RefreshCw, Crown, User } from 'lucide-react';
import api from '../utils/api';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gray-800`}>
          <Icon size={22} className={color} />
        </div>
      </div>
    </div>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user?.id;
  const [form, setForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    password: '',
    role: user?.role || 'user',
    is_active: user?.is_active !== false,
    expires_at: user?.expires_at ? user.expires_at.slice(0, 10) : '',
    notes: user?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.username) return setError('Username wajib diisi');
    if (!isEdit && form.password.length < 6) return setError('Password minimal 6 karakter');
    if (isEdit && form.password && form.password.length < 6) return setError('Password baru minimal 6 karakter');
    setSaving(true); setError('');
    try {
      const payload = { ...form, expires_at: form.expires_at || null };
      if (isEdit) {
        if (!payload.password) delete payload.password;
        await api.put(`/admin/users/${user.id}`, payload);
      } else {
        await api.post('/admin/users', payload);
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">{isEdit ? 'Edit User' : 'Tambah User Baru'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Username *</label>
              <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Username" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nama Lengkap</label>
              <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nama lengkap" />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">{isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Min. 6 karakter'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Status Akun</label>
              <select className="input" value={form.is_active ? '1' : '0'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === '1' }))}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block flex items-center gap-1"><Calendar size={12} /> Masa Berlaku Langganan</label>
            <input className="input" type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
            <p className="text-gray-600 text-xs mt-1">Kosongkan untuk tidak ada batas waktu</p>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Catatan</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Catatan internal..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/users'),
      api.get('/admin/stats'),
      api.get('/admin/health'),
    ]).then(([uRes, sRes, hRes]) => {
      setUsers(uRes.data);
      setStats(sRes.data);
      setHealth(hRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (user) => {
    try {
      const res = await api.post(`/admin/users/${user.id}/toggle`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: res.data.is_active } : u));
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal mengubah status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus user ini? Data kampanye dan akunnya juga akan terhapus.')) return;
    setDeleting(id);
    try {
      await api.delete(`/admin/users/${id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal menghapus');
    } finally {
      setDeleting(null);
    }
  };

  const isExpired = (expires_at) => expires_at && new Date(expires_at) < new Date();
  const daysLeft = (expires_at) => {
    if (!expires_at) return null;
    const d = Math.ceil((new Date(expires_at) - new Date()) / 86400000);
    return d;
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Crown size={22} className="text-yellow-400" /> Panel Admin</h1>
          <p className="text-gray-400 mt-1">Kelola pengguna dan langganan platform</p>
        </div>
        <button onClick={() => setModal({})} className="btn-primary flex items-center gap-2">
          <UserPlus size={16} /> Tambah User
        </button>
      </div>

      {/* Health Dashboard */}
      {health && (
        <div className={`card border ${health.status === 'warning' ? 'border-yellow-700/50 bg-yellow-900/10' : 'border-green-700/50 bg-green-900/10'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              {health.status === 'warning' ? '⚠️' : '✅'} System Health
            </h3>
            <button onClick={load} className="text-gray-400 hover:text-white text-xs">🔄 Refresh</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Browser Queue</p>
              <p className="text-white font-bold">{health.browser?.running || 0} running / {health.browser?.queued || 0} queued</p>
            </div>
            <div className={`rounded-xl p-3 ${health.accounts?.problem_count > 0 ? 'bg-red-900/30' : 'bg-gray-800'}`}>
              <p className="text-gray-400 text-xs">Akun Bermasalah</p>
              <p className={`font-bold ${health.accounts?.problem_count > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {health.accounts?.problem_count || 0} akun
              </p>
            </div>
            <div className={`rounded-xl p-3 ${health.errors_last_hour > 10 ? 'bg-yellow-900/30' : 'bg-gray-800'}`}>
              <p className="text-gray-400 text-xs">Error (1 jam)</p>
              <p className={`font-bold ${health.errors_last_hour > 10 ? 'text-yellow-400' : 'text-white'}`}>{health.errors_last_hour}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs">Memory</p>
              <p className="text-white font-bold">{health.memory?.heap_used_mb} MB</p>
            </div>
          </div>
          {health.accounts?.problems?.length > 0 && (
            <div className="mt-3 bg-red-900/20 border border-red-700/40 rounded-xl p-3">
              <p className="text-red-300 text-xs font-semibold mb-2">Akun bermasalah:</p>
              <div className="flex flex-wrap gap-2">
                {health.accounts.problems.map((a, i) => (
                  <span key={i} className="text-xs bg-red-900/40 text-red-300 px-2 py-1 rounded-lg">
                    {a.name} ({a.status})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total User" value={stats.totalUsers} color="text-blue-400" sub={`${stats.activeUsers} aktif`} />
          <StatCard icon={XCircle} label="Langganan Habis" value={stats.expiredUsers} color="text-red-400" />
          <StatCard icon={Shield} label="Total Akun FB" value={stats.totalAccounts} color="text-green-400" sub={`${stats.activeAccounts} valid`} />
          <StatCard icon={Megaphone} label="Total Komentar" value={(stats.totalComments || 0).toLocaleString()} color="text-purple-400" sub={`${stats.runningCampaigns} kampanye aktif`} />
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-semibold text-white">Daftar Pengguna</h2>
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <input className="input flex-1" placeholder="Cari username / nama..." value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={load} className="p-2 text-gray-400 hover:text-white" title="Refresh"><RefreshCw size={16} /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Tidak ada user ditemukan</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-left py-2 px-3">Role</th>
                  <th className="text-center py-2 px-3">Akun FB</th>
                  <th className="text-center py-2 px-3">Kampanye</th>
                  <th className="text-center py-2 px-3">Komentar</th>
                  <th className="text-left py-2 px-3">Masa Aktif</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-right py-2 px-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(u => {
                  const expired = isExpired(u.expires_at);
                  const days = daysLeft(u.expires_at);
                  return (
                    <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${u.role === 'admin' ? 'bg-yellow-900 text-yellow-300' : 'bg-blue-900 text-blue-300'}`}>
                            {u.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{u.username}</p>
                            {u.full_name && <p className="text-gray-500 text-xs">{u.full_name}</p>}
                            {u.notes && <p className="text-gray-600 text-xs italic">{u.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-yellow-400 text-xs font-semibold bg-yellow-900/30 px-2 py-0.5 rounded-full"><Crown size={10} /> Admin</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 text-xs bg-gray-800 px-2 py-0.5 rounded-full"><User size={10} /> User</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-white">{u.account_count}</td>
                      <td className="py-3 px-3 text-center text-white">{u.campaign_count}</td>
                      <td className="py-3 px-3 text-center text-white">{(u.total_comments || 0).toLocaleString()}</td>
                      <td className="py-3 px-3">
                        {!u.expires_at ? (
                          <span className="text-gray-500 text-xs">Tanpa batas</span>
                        ) : expired ? (
                          <span className="text-red-400 text-xs font-semibold">Habis {new Date(u.expires_at).toLocaleDateString('id-ID')}</span>
                        ) : (
                          <div>
                            <p className="text-green-400 text-xs font-semibold">{new Date(u.expires_at).toLocaleDateString('id-ID')}</p>
                            <p className="text-gray-500 text-xs">{days} hari lagi</p>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-green-400 text-xs bg-green-900/30 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Aktif</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 text-xs bg-red-900/30 px-2 py-0.5 rounded-full"><XCircle size={10} /> Nonaktif</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => handleToggle(u)} className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-green-400 hover:bg-green-900/30' : 'text-red-400 hover:bg-red-900/30'}`} title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                            {u.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => setModal(u)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-900/30 transition-colors" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(u.id)} disabled={deleting === u.id} className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors" title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <UserModal
          user={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
