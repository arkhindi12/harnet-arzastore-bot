import React, { useState, useEffect } from 'react';
import { Store, Users, TrendingUp, Copy, CheckCircle, Clock, XCircle, Wallet, Send, AlertTriangle, Star, Shield } from 'lucide-react';
import api from '../utils/api';

const fmt = (n) => `Rp${(n || 0).toLocaleString('id-ID')}`;

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Transfer Bank (BCA/BRI/Mandiri/BNI)' },
  { value: 'gopay', label: 'GoPay' },
  { value: 'dana', label: 'DANA' },
  { value: 'ovo', label: 'OVO' },
  { value: 'other', label: 'Lainnya' },
];

function WithdrawModal({ balance, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [details, setDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt < 100000) return setError('Minimum withdrawal Rp100.000');
    if (amt > balance) return setError('Saldo tidak mencukupi');
    if (!method) return setError('Pilih metode pembayaran');
    if (!details.trim()) return setError('Masukkan detail rekening/akun');
    setLoading(true); setError('');
    try {
      await api.post('/referrals/withdraw', { amount: amt, payment_method: method, payment_details: details, notes });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengajukan withdrawal');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Wallet size={18} className="text-green-400" /> Ajukan Withdrawal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/40 border border-red-800/50 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>}
          <div className="bg-green-900/20 border border-green-800/30 rounded-xl px-4 py-3">
            <p className="text-gray-400 text-sm">Saldo tersedia</p>
            <p className="text-green-400 text-2xl font-bold">{fmt(balance)}</p>
          </div>
          <div>
            <label className="label">Jumlah Withdrawal (Rp)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Min. Rp100.000" className="input" min={100000} step={10000} />
            <p className="text-gray-500 text-xs mt-1">Minimum withdrawal: Rp100.000</p>
          </div>
          <div>
            <label className="label">Metode Pembayaran</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="input">
              <option value="">-- Pilih metode --</option>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Detail Rekening / Akun</label>
            <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder={method === 'bank_transfer' ? 'Contoh: BCA - 1234567890 - Nama Lengkap' : 'Contoh: 0812-xxxx-xxxx (nama akun)'} className="input resize-none" rows={2} />
          </div>
          <div>
            <label className="label">Catatan (Opsional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan untuk admin" className="input" />
          </div>
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-xl px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-300 text-xs">Withdrawal akan diproses admin dalam 1-3 hari kerja. Saldo langsung dipotong saat pengajuan. Jika ditolak, saldo dikembalikan otomatis.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              <Send size={15} /> {loading ? 'Mengajukan...' : 'Ajukan Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResellerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/referrals/my');
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/?ref=${data.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!data?.is_reseller) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-12">
          <Store size={48} className="mx-auto mb-4 text-gray-600" />
          <h2 className="text-2xl font-bold text-white mb-2">Program Reseller</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">Jadilah reseller ArzaBot dan dapatkan komisi untuk setiap pelanggan yang kamu bawa. Akun kamu belum aktif sebagai reseller.</p>
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-5 text-left space-y-3 mb-6">
            <h3 className="text-white font-semibold">Keuntungan Menjadi Reseller:</h3>
            {[
              'Komisi uang tunai per referral yang berhasil',
              'Bonus perpanjangan langganan',
              'Saldo bisa dicairkan ke rekening/dompet digital',
              'Dashboard lengkap untuk memantau penjualan',
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{b}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm">Hubungi admin untuk mengaktifkan status reseller akun kamu.</p>
        </div>
      </div>
    );
  }

  const link = `${window.location.origin}/?ref=${data.referral_code}`;

  const statusBadge = {
    pending: <span className="flex items-center gap-1 text-yellow-400 text-xs px-2 py-0.5 bg-yellow-900/30 rounded-full border border-yellow-800/40"><Clock size={11} /> Menunggu</span>,
    approved: <span className="flex items-center gap-1 text-green-400 text-xs px-2 py-0.5 bg-green-900/30 rounded-full border border-green-800/40"><CheckCircle size={11} /> Disetujui</span>,
    rejected: <span className="flex items-center gap-1 text-red-400 text-xs px-2 py-0.5 bg-red-900/30 rounded-full border border-red-800/40"><XCircle size={11} /> Ditolak</span>,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showWithdraw && (
        <WithdrawModal balance={data.reseller_balance} onClose={() => setShowWithdraw(false)} onSuccess={() => { setShowWithdraw(false); fetchData(); }} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Store size={22} className="text-yellow-400" /> Dashboard Reseller
            <span className="px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 text-xs border border-yellow-800/50">Aktif</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Kelola penjualan dan cairkan komisi Anda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl sm:text-3xl font-bold text-blue-400">{data.total_referrals}</p>
          <p className="text-gray-400 text-sm mt-1">Total Pendaftar</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-green-400">{fmt(data.total_commission)}</p>
          <p className="text-gray-400 text-sm mt-1">Total Komisi Diperoleh</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-purple-400">{fmt(data.reseller_balance)}</p>
          <p className="text-gray-400 text-sm mt-1">Saldo Tersedia</p>
        </div>
        <div className="card text-center">
          <p className="text-xl font-bold text-yellow-400">{fmt(data.reseller_commission_per_referral)}</p>
          <p className="text-gray-400 text-sm mt-1">Komisi/Referral</p>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-green-900/20 to-teal-900/10 border-green-800/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-gray-400 text-sm">Saldo Komisi Tersedia</p>
            <p className="text-3xl font-bold text-green-400">{fmt(data.reseller_balance)}</p>
            <p className="text-gray-500 text-xs mt-1">Komisi per referral: {fmt(data.reseller_commission_per_referral)} · Bonus hari: {data.reseller_margin}%</p>
          </div>
          <button
            onClick={() => setShowWithdraw(true)}
            disabled={data.reseller_balance < 100000 || data.has_pending_withdrawal}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors ${data.reseller_balance >= 100000 && !data.has_pending_withdrawal ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
          >
            <Wallet size={16} />
            {data.has_pending_withdrawal ? 'Ada Withdrawal Pending' : data.reseller_balance < 100000 ? `Min. ${fmt(100000)}` : 'Cairkan Komisi'}
          </button>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-800/40">
        <div className="flex items-center gap-2 mb-3">
          <Star size={18} className="text-yellow-400" />
          <span className="text-white font-semibold">Link Reseller Kamu</span>
        </div>
        <div className="bg-gray-900 border border-yellow-800/30 rounded-xl px-4 py-3 font-mono text-yellow-300 text-sm break-all mb-3">{link}</div>
        <button onClick={copyLink} className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl text-sm transition-colors">
          {copied ? <CheckCircle size={15} /> : <Copy size={15} />} {copied ? 'Disalin!' : 'Salin Link'}
        </button>
      </div>

      {data.withdrawals && data.withdrawals.length > 0 && (
        <div className="card">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Wallet size={16} /> Riwayat Withdrawal</h3>
          <div className="space-y-3">
            {data.withdrawals.map(w => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 bg-gray-800 rounded-xl px-4 py-3">
                <div>
                  <p className="text-green-400 font-bold">{fmt(w.amount)}</p>
                  <p className="text-gray-500 text-xs">{new Date(w.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · {w.payment_method}</p>
                  {w.admin_notes && <p className="text-gray-400 text-xs mt-0.5">Admin: {w.admin_notes}</p>}
                </div>
                {statusBadge[w.status]}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Users size={16} /> Riwayat Referral</h3>
        {data.referrals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users size={36} className="mx-auto mb-2 opacity-30" />
            <p>Belum ada yang mendaftar via link kamu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Username</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Bonus Hari</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Komisi</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map(r => (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2.5 px-3 text-white">{r.referred_username}</td>
                    <td className="py-2.5 px-3 text-yellow-400 text-right">+{r.bonus_days} hari</td>
                    <td className="py-2.5 px-3 text-green-400 text-right font-medium">{r.commission_amount > 0 ? fmt(r.commission_amount) : '—'}</td>
                    <td className="py-2.5 px-3 text-gray-400 text-right">{new Date(r.created_at).toLocaleDateString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card bg-gray-900/50 border-gray-700/50">
        <div className="flex items-start gap-3">
          <Shield size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium text-sm">Informasi Komisi & Withdrawal</p>
            <ul className="text-gray-400 text-sm mt-1 space-y-1 list-disc list-inside">
              <li>Komisi dikreditkan otomatis setiap kali ada pendaftar baru via link kamu</li>
              <li>Minimum withdrawal: Rp100.000</li>
              <li>Diproses admin dalam 1-3 hari kerja</li>
              <li>Hanya 1 permintaan withdrawal aktif dalam satu waktu</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
