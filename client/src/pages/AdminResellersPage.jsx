import React, { useState, useEffect } from 'react';
import { Store, Users, TrendingUp, Edit2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Wallet, Plus, Minus, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const fmt = (n) => `Rp${(n || 0).toLocaleString('id-ID')}`;

function ResellerCard({ r, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [margin, setMargin] = useState(r.reseller_margin || 30);
  const [commission, setCommission] = useState(r.reseller_commission_per_referral || 50000);
  const [saving, setSaving] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/referrals/admin/set-reseller', {
        user_id: r.id, is_reseller: true, margin: +margin, commission_per_referral: +commission,
      });
      setEditing(false);
      onUpdate();
    } catch (err) { alert('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const adjustBalance = async (sign) => {
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) return alert('Masukkan nominal valid');
    setAdjusting(true);
    try {
      await api.post('/referrals/admin/adjust-balance', { user_id: r.id, amount: sign * amt });
      setAdjustAmount('');
      onUpdate();
    } catch (err) { alert('Gagal menyesuaikan saldo'); }
    finally { setAdjusting(false); }
  };

  const deactivate = async () => {
    if (!confirm(`Nonaktifkan reseller ${r.username}?`)) return;
    try {
      await api.post('/referrals/admin/set-reseller', {
        user_id: r.id, is_reseller: false, margin: r.reseller_margin, commission_per_referral: r.reseller_commission_per_referral,
      });
      onUpdate();
    } catch (err) { alert('Gagal'); }
  };

  return (
    <div className="card border-gray-700">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-900 rounded-full flex items-center justify-center text-yellow-300 font-bold">
            {r.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold">{r.username}</p>
            <p className="text-gray-500 text-xs">Aktif hingga: {r.expires_at ? new Date(r.expires_at).toLocaleDateString('id-ID') : 'N/A'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(e => !e)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-900/40 text-blue-400 border border-blue-800/50 rounded-lg text-xs hover:bg-blue-900/60 transition-colors">
            <Edit2 size={12} /> Edit
          </button>
          <button onClick={deactivate} className="flex items-center gap-1 px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-800/40 rounded-lg text-xs hover:bg-red-900/50 transition-colors">
            Nonaktifkan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-400">{r.total_referrals}</p>
          <p className="text-gray-500 text-xs">Total Referral</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-yellow-400">{r.reseller_margin}%</p>
          <p className="text-gray-500 text-xs">Margin Hari</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-base font-bold text-green-400">{fmt(r.reseller_commission_per_referral)}</p>
          <p className="text-gray-500 text-xs">Komisi/Referral</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-3 text-center">
          <p className="text-base font-bold text-purple-400">{fmt(r.reseller_balance)}</p>
          <p className="text-gray-500 text-xs">Saldo Saat Ini</p>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-xl p-3 mb-3">
        <p className="text-gray-400 text-xs mb-2 font-medium">Sesuaikan Saldo Manual</p>
        <div className="flex gap-2">
          <input
            type="number"
            value={adjustAmount}
            onChange={e => setAdjustAmount(e.target.value)}
            placeholder="Nominal (Rp)"
            className="input text-sm"
            min={0}
          />
          <button onClick={() => adjustBalance(1)} disabled={adjusting} className="px-3 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
            <Plus size={12} /> Tambah
          </button>
          <button onClick={() => adjustBalance(-1)} disabled={adjusting} className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
            <Minus size={12} /> Kurangi
          </button>
        </div>
      </div>

      {editing && (
        <div className="border border-blue-800/40 rounded-xl p-4 bg-blue-900/10 space-y-3">
          <p className="text-blue-300 text-sm font-medium">Edit Pengaturan Reseller</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Margin Hari Bonus (%)</label>
              <input type="number" value={margin} onChange={e => setMargin(e.target.value)} className="input" min={1} max={365} />
              <p className="text-gray-500 text-xs mt-1">Bonus hari yang diterima reseller per referral</p>
            </div>
            <div>
              <label className="label">Komisi Uang per Referral (Rp)</label>
              <input type="number" value={commission} onChange={e => setCommission(e.target.value)} className="input" min={0} step={10000} />
              <p className="text-gray-500 text-xs mt-1">0 = tidak ada komisi uang</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WithdrawalRow({ w, onUpdate }) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAction, setShowAction] = useState(false);

  const process = async (status) => {
    setLoading(true);
    try {
      await api.put(`/referrals/admin/withdrawals/${w.id}`, { status, admin_notes: notes });
      onUpdate();
    } catch (err) { alert(err.response?.data?.error || 'Gagal'); }
    finally { setLoading(false); }
  };

  const statusBadge = {
    pending: <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={12} /> Menunggu</span>,
    approved: <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle size={12} /> Disetujui</span>,
    rejected: <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} /> Ditolak</span>,
  };

  const methods = { bank_transfer: 'Transfer Bank', gopay: 'GoPay', dana: 'DANA', ovo: 'OVO', other: 'Lainnya' };

  return (
    <div className={`border rounded-xl overflow-hidden ${w.status === 'pending' ? 'border-yellow-800/40' : 'border-gray-700/50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-800/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-gray-300 text-sm font-bold">
            {w.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium">{w.username}</p>
            <p className="text-gray-500 text-xs">{new Date(w.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-green-400 font-bold text-lg">{fmt(w.amount)}</p>
          {statusBadge[w.status]}
        </div>
      </div>
      <div className="px-4 py-3 space-y-1.5 text-sm">
        <div className="flex gap-2">
          <span className="text-gray-500">Metode:</span>
          <span className="text-white">{methods[w.payment_method] || w.payment_method}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500">Detail Rekening:</span>
          <span className="text-white font-mono text-xs">{w.payment_details}</span>
        </div>
        {w.notes && <div className="flex gap-2"><span className="text-gray-500">Catatan:</span><span className="text-gray-300">{w.notes}</span></div>}
        {w.admin_notes && <div className="flex gap-2"><span className="text-gray-500">Catatan Admin:</span><span className="text-gray-300">{w.admin_notes}</span></div>}
      </div>
      {w.status === 'pending' && (
        <div className="px-4 py-3 border-t border-gray-700/50">
          {!showAction ? (
            <button onClick={() => setShowAction(true)} className="text-blue-400 text-sm hover:text-blue-300">Proses Withdrawal →</button>
          ) : (
            <div className="space-y-2">
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan admin (opsional)" className="input text-sm" />
              <div className="flex gap-2">
                <button onClick={() => process('approved')} disabled={loading} className="flex items-center gap-1 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-xl text-sm transition-colors">
                  <CheckCircle size={14} /> Setujui & Tandai Lunas
                </button>
                <button onClick={() => process('rejected')} disabled={loading} className="flex items-center gap-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm transition-colors">
                  <XCircle size={14} /> Tolak (Kembalikan Saldo)
                </button>
                <button onClick={() => setShowAction(false)} className="btn-secondary text-sm">Batal</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminResellersPage() {
  const [resellers, setResellers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resellers');
  const [addUserId, setAddUserId] = useState('');
  const [addMargin, setAddMargin] = useState(30);
  const [addCommission, setAddCommission] = useState(50000);
  const [adding, setAdding] = useState(false);
  const [wdFilter, setWdFilter] = useState('pending');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r, w, u] = await Promise.all([
        api.get('/referrals/admin/resellers'),
        api.get('/referrals/admin/withdrawals'),
        api.get('/referrals/admin/all-users-reseller'),
      ]);
      setResellers(r.data);
      setWithdrawals(w.data);
      setAllUsers(u.data.filter(u => !u.is_reseller));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const addReseller = async () => {
    if (!addUserId) return alert('Pilih user terlebih dahulu');
    setAdding(true);
    try {
      await api.post('/referrals/admin/set-reseller', {
        user_id: addUserId, is_reseller: true, margin: +addMargin, commission_per_referral: +addCommission,
      });
      setAddUserId('');
      fetchAll();
    } catch (err) { alert('Gagal menambahkan reseller'); }
    finally { setAdding(false); }
  };

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
  const filteredWd = withdrawals.filter(w => wdFilter === 'all' || w.status === wdFilter);
  const totalBalance = resellers.reduce((s, r) => s + (r.reseller_balance || 0), 0);
  const totalEarned = resellers.reduce((s, r) => s + (r.total_commission_earned || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Store size={22} className="text-yellow-400" /> Manajemen Reseller
          </h1>
          <p className="text-gray-400 text-sm mt-1">Kelola reseller, komisi, dan permintaan withdrawal</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 btn-secondary text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl sm:text-3xl font-bold text-yellow-400">{resellers.length}</p>
          <p className="text-gray-400 text-sm mt-1">Total Reseller</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl sm:text-3xl font-bold text-blue-400">{resellers.reduce((s, r) => s + r.total_referrals, 0)}</p>
          <p className="text-gray-400 text-sm mt-1">Total Referral</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-green-400">{fmt(totalEarned)}</p>
          <p className="text-gray-400 text-sm mt-1">Total Komisi Diperoleh</p>
        </div>
        <div className="card text-center relative">
          <p className="text-xl font-bold text-purple-400">{fmt(totalBalance)}</p>
          <p className="text-gray-400 text-sm mt-1">Total Saldo Aktif</p>
          {pendingCount > 0 && (
            <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{pendingCount}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {[
          { id: 'resellers', label: 'Daftar Reseller', count: resellers.length },
          { id: 'withdrawals', label: 'Withdrawal', count: pendingCount || null },
          { id: 'add', label: 'Tambah Reseller', count: null },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {t.label}
            {t.count ? <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {tab === 'resellers' && (
            <div className="space-y-4">
              {resellers.length === 0 ? (
                <div className="card text-center py-12 text-gray-500">
                  <Store size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Belum ada reseller. Tambahkan dari tab "Tambah Reseller".</p>
                </div>
              ) : resellers.map(r => (
                <ResellerCard key={r.id} r={r} onUpdate={fetchAll} />
              ))}
            </div>
          )}

          {tab === 'withdrawals' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {['pending', 'approved', 'rejected', 'all'].map(s => (
                  <button key={s} onClick={() => setWdFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs capitalize transition-colors ${wdFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    {s === 'pending' ? 'Menunggu' : s === 'approved' ? 'Disetujui' : s === 'rejected' ? 'Ditolak' : 'Semua'}
                    {s === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
                  </button>
                ))}
              </div>
              {filteredWd.length === 0 ? (
                <div className="card text-center py-10 text-gray-500">
                  <Wallet size={36} className="mx-auto mb-2 opacity-30" />
                  <p>Tidak ada withdrawal untuk filter ini</p>
                </div>
              ) : filteredWd.map(w => (
                <WithdrawalRow key={w.id} w={w} onUpdate={fetchAll} />
              ))}
            </div>
          )}

          {tab === 'add' && (
            <div className="card max-w-lg">
              <h3 className="text-white font-semibold mb-4">Tambah Reseller Baru</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Pilih User</label>
                  <select value={addUserId} onChange={e => setAddUserId(e.target.value)} className="input">
                    <option value="">-- Pilih user --</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Margin Bonus Hari (%)</label>
                    <input type="number" value={addMargin} onChange={e => setAddMargin(e.target.value)} className="input" min={1} max={365} />
                    <p className="text-gray-500 text-xs mt-1">Bonus hari per referral</p>
                  </div>
                  <div>
                    <label className="label">Komisi Uang per Referral (Rp)</label>
                    <input type="number" value={addCommission} onChange={e => setAddCommission(e.target.value)} className="input" min={0} step={10000} />
                    <p className="text-gray-500 text-xs mt-1">0 = tidak ada komisi uang</p>
                  </div>
                </div>
                <button onClick={addReseller} disabled={adding || !addUserId} className="btn-primary w-full justify-center">
                  {adding ? 'Menambahkan...' : 'Jadikan Reseller'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
