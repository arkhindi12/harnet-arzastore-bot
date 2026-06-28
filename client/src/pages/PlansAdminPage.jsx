import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Star, CreditCard, RefreshCw, Check, DollarSign, Clock, History, Settings, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';

const FEATURES_SUGGESTIONS = [
  'Auto Komentar Multi Akun', 'Auto UP Postingan', 'Post ke Grup Otomatis',
  'Post Marketplace Otomatis', 'Smart Monitor Keyword', 'Warming Akun Otomatis',
  'Auto Reply Komentar', 'Notifikasi Telegram', 'Analitik & A/B Test',
  'Proxy Per Akun', 'AI Groq Konten', 'Dukungan Prioritas',
];

function PlanModal({ plan, onClose, onSaved }) {
  const isEdit = !!plan?.id;
  const [form, setForm] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price || '',
    duration_days: plan?.duration_days || 30,
    max_accounts: plan?.max_accounts ?? 0,
    max_campaigns: plan?.max_campaigns ?? 0,
    features: plan?.features || [],
    badge: plan?.badge || '',
    is_popular: plan?.is_popular || false,
    is_active: plan?.is_active !== false,
    sort_order: plan?.sort_order || 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newFeature, setNewFeature] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addFeature = (f) => {
    const feat = f || newFeature.trim();
    if (!feat || form.features.includes(feat)) return;
    set('features', [...form.features, feat]);
    setNewFeature('');
  };

  const removeFeature = (f) => set('features', form.features.filter(x => x !== f));

  const save = async () => {
    if (!form.name || !form.price || !form.duration_days) return setError('Nama, harga, durasi wajib diisi');
    setSaving(true); setError('');
    try {
      if (isEdit) await api.put(`/plans/${plan.id}`, form);
      else await api.post('/plans', form);
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (p) => p ? new Intl.NumberFormat('id-ID').format(p) : '';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">{isEdit ? 'Edit Plan' : 'Tambah Plan Baru'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Nama Plan *</label>
              <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Misal: Starter, Pro, Ultimate" />
            </div>
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Deskripsi</label>
              <input className="input w-full" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Tagline singkat plan ini" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Harga (IDR) *</label>
              <input className="input w-full" type="number" value={form.price} onChange={e => set('price', parseInt(e.target.value) || '')} placeholder="99000" />
              {form.price && <p className="text-gray-600 text-xs mt-0.5">Rp {formatPrice(form.price)}</p>}
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Durasi (hari) *</label>
              <select className="input w-full" value={form.duration_days} onChange={e => set('duration_days', parseInt(e.target.value))}>
                <option value={7}>7 hari (1 minggu)</option>
                <option value={14}>14 hari (2 minggu)</option>
                <option value={30}>30 hari (1 bulan)</option>
                <option value={60}>60 hari (2 bulan)</option>
                <option value={90}>90 hari (3 bulan)</option>
                <option value={180}>180 hari (6 bulan)</option>
                <option value={365}>365 hari (1 tahun)</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Maks. Akun FB (0=unlimited)</label>
              <input className="input w-full" type="number" min={0} value={form.max_accounts} onChange={e => set('max_accounts', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Maks. Kampanye (0=unlimited)</label>
              <input className="input w-full" type="number" min={0} value={form.max_campaigns} onChange={e => set('max_campaigns', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Badge (opsional)</label>
              <input className="input w-full" value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="Hemat 30%" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Urutan Tampil</label>
              <input className="input w-full" type="number" min={0} value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_popular} onChange={e => set('is_popular', e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <span className="text-gray-300 text-sm flex items-center gap-1"><Star size={13} className="text-yellow-400" /> Tandai Populer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <span className="text-gray-300 text-sm">Aktif / Tampilkan</span>
            </label>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-2 block">Fitur yang disertakan</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FEATURES_SUGGESTIONS.filter(s => !form.features.includes(s)).map(s => (
                <button key={s} onClick={() => addFeature(s)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded transition-colors">+ {s}</button>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input className="input flex-1 text-sm" value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeature()} placeholder="Ketik fitur lain..." />
              <button onClick={() => addFeature()} className="btn-secondary text-sm px-3">+ Tambah</button>
            </div>
            <div className="space-y-1">
              {form.features.map(f => (
                <div key={f} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-1.5">
                  <span className="text-gray-300 text-sm flex items-center gap-2"><Check size={12} className="text-green-400" />{f}</span>
                  <button onClick={() => removeFeature(f)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Buat Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaySettingsModal({ onClose }) {
  const [form, setForm] = useState({ midtrans_server_key: '', midtrans_client_key: '', midtrans_is_production: '0', payment_enabled: '1', manual_payment_enabled: '1', qris_image_url: '', qris_name: '', bank_name: '', bank_account_number: '', bank_account_name: '', bank_name_2: '', bank_account_number_2: '', bank_account_name_2: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    api.get('/payments/settings').then(r => setForm(f => ({ ...f, ...r.data }))).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/payments/settings', form);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert(e.response?.data?.error || 'Gagal'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold">Konfigurasi Midtrans</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {loading ? <div className="text-center py-4"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> : <>
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-3 text-xs text-blue-300">
              Daftar di <a href="https://dashboard.midtrans.com" target="_blank" rel="noreferrer" className="underline">dashboard.midtrans.com</a> → Settings → Access Keys untuk mendapatkan Server Key & Client Key.
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Mode</label>
              <select className="input w-full" value={form.midtrans_is_production} onChange={e => setForm(f => ({ ...f, midtrans_is_production: e.target.value }))}>
                <option value="0">Sandbox (Testing)</option>
                <option value="1">Production (Live)</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block flex items-center justify-between">
                Server Key
                <button onClick={() => setShowKey(v => !v)} className="text-gray-500 hover:text-gray-300">{showKey ? <EyeOff size={12} /> : <Eye size={12} />}</button>
              </label>
              <input className="input w-full font-mono text-sm" type={showKey ? 'text' : 'password'} value={form.midtrans_server_key} onChange={e => setForm(f => ({ ...f, midtrans_server_key: e.target.value }))} placeholder="SB-Mid-server-xxxx atau Mid-server-xxxx" />
              <p className="text-gray-600 text-xs mt-0.5">Jangan bagikan ke siapapun. Hanya digunakan di server.</p>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Client Key (untuk Snap.js di frontend)</label>
              <input className="input w-full font-mono text-sm" value={form.midtrans_client_key} onChange={e => setForm(f => ({ ...f, midtrans_client_key: e.target.value }))} placeholder="SB-Mid-client-xxxx atau Mid-client-xxxx" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Status Pembayaran</label>
              <select className="input w-full" value={form.payment_enabled} onChange={e => setForm(f => ({ ...f, payment_enabled: e.target.value }))}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-400">
              <p className="font-semibold text-gray-300 mb-1">URL Webhook (Notification URL):</p>
              <code className="text-green-400 break-all">{window.location.origin}/api/payments/notification</code>
              <p className="mt-1">Daftarkan URL ini di Midtrans Dashboard → Settings → Configuration</p>
            </div>

            <div className="border-t border-gray-700 pt-4 mt-4">
              <h3 className="text-white font-semibold text-sm mb-3">💳 Pembayaran Manual (QRIS + Bank)</h3>
              <p className="text-gray-500 text-xs mb-3">Jika Midtrans tidak diisi, sistem otomatis pakai pembayaran manual. Kode unik 3 digit ditambahkan otomatis ke setiap transaksi.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Pembayaran Manual</label>
                  <select className="input w-full" value={form.manual_payment_enabled} onChange={e => setForm(f => ({ ...f, manual_payment_enabled: e.target.value }))}>
                    <option value="1">Aktif</option>
                    <option value="0">Nonaktif</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">URL Gambar QRIS (opsional)</label>
                  <input className="input w-full font-mono text-sm" value={form.qris_image_url} onChange={e => setForm(f => ({ ...f, qris_image_url: e.target.value }))} placeholder="https://example.com/qris.png" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Nama QRIS (opsional)</label>
                  <input className="input w-full" value={form.qris_name} onChange={e => setForm(f => ({ ...f, qris_name: e.target.value }))} placeholder="Toko ArzaBot" />
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                  <p className="text-gray-300 text-xs font-semibold">Rekening Bank 1</p>
                  <input className="input w-full" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Nama Bank (BCA, BNI, dll)" />
                  <input className="input w-full font-mono" value={form.bank_account_number} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} placeholder="Nomor Rekening" />
                  <input className="input w-full" value={form.bank_account_name} onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))} placeholder="Atas Nama" />
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                  <p className="text-gray-300 text-xs font-semibold">Rekening Bank 2 (opsional)</p>
                  <input className="input w-full" value={form.bank_name_2} onChange={e => setForm(f => ({ ...f, bank_name_2: e.target.value }))} placeholder="Nama Bank" />
                  <input className="input w-full font-mono" value={form.bank_account_number_2} onChange={e => setForm(f => ({ ...f, bank_account_number_2: e.target.value }))} placeholder="Nomor Rekening" />
                  <input className="input w-full" value={form.bank_account_name_2} onChange={e => setForm(f => ({ ...f, bank_account_name_2: e.target.value }))} placeholder="Atas Nama" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saved ? '✓ Tersimpan' : saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

export default function PlansAdminPage() {
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [showPaySettings, setShowPaySettings] = useState(false);
  const [activeTab, setActiveTab] = useState('plans');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/plans/all'),
      api.get('/payments/history/all'),
    ]).then(([pRes, pyRes]) => {
      setPlans(pRes.data);
      setPayments(pyRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Nonaktifkan plan ini?')) return;
    await api.delete(`/plans/${id}`);
    load();
  };

  const formatPrice = (p) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
  const statusBadge = (s) => {
    const map = { paid: 'text-green-400 bg-green-900/30', pending: 'text-yellow-400 bg-yellow-900/30', failed: 'text-red-400 bg-red-900/30', expired: 'text-gray-400 bg-gray-800' };
    const label = { paid: 'Lunas', pending: 'Menunggu', failed: 'Gagal', expired: 'Kedaluwarsa' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map[s] || 'text-gray-400 bg-gray-800'}`}>{label[s] || s}</span>;
  };

  const totalRevenue = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><DollarSign size={22} className="text-green-400" /> Manajemen Langganan</h1>
          <p className="text-gray-400 mt-1">Kelola paket harga dan konfigurasi payment gateway</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPaySettings(true)} className="btn-secondary flex items-center gap-2 text-sm"><Settings size={15} /> Midtrans</button>
          <button onClick={load} className="btn-secondary p-2" title="Refresh"><RefreshCw size={15} /></button>
          {activeTab === 'plans' && <button onClick={() => setModal({})} className="btn-primary flex items-center gap-2"><Plus size={15} /> Tambah Plan</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-green-900 rounded-xl flex items-center justify-center"><DollarSign size={18} className="text-green-400" /></div>
          <div><p className="text-gray-400 text-sm">Total Pendapatan</p><p className="text-2xl font-bold text-green-400">{formatPrice(totalRevenue)}</p></div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center"><Check size={18} className="text-blue-400" /></div>
          <div><p className="text-gray-400 text-sm">Transaksi Sukses</p><p className="text-2xl font-bold text-white">{payments.filter(p => p.status === 'paid').length}</p></div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-900 rounded-xl flex items-center justify-center"><CreditCard size={18} className="text-purple-400" /></div>
          <div><p className="text-gray-400 text-sm">Total Transaksi</p><p className="text-2xl font-bold text-white">{payments.length}</p></div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 w-fit">
        {[['plans', 'Paket Harga'], ['payments', 'Riwayat Pembayaran']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>{label}</button>
        ))}
      </div>

      {activeTab === 'plans' && (
        <div className="card">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-10">
              <CreditCard size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Belum ada paket</p>
              <button onClick={() => setModal({})} className="btn-primary">Buat Plan Pertama</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map(plan => (
                <div key={plan.id} className={`rounded-xl border p-4 ${plan.is_active ? 'border-gray-700 bg-gray-800' : 'border-gray-800 bg-gray-900 opacity-60'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-bold">{plan.name}</h3>
                      {plan.description && <p className="text-gray-500 text-xs">{plan.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      {plan.is_popular && <Star size={14} className="text-yellow-400" />}
                      {!plan.is_active && <span className="text-xs text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">Nonaktif</span>}
                    </div>
                  </div>
                  <p className="text-2xl font-black text-white">{formatPrice(plan.price)}</p>
                  <p className="text-gray-500 text-xs flex items-center gap-1 mb-3"><Clock size={11} /> {plan.duration_days} hari</p>
                  <div className="space-y-1 mb-4">
                    {plan.features.slice(0,3).map(f => <p key={f} className="text-gray-400 text-xs flex items-center gap-1"><Check size={10} className="text-green-400" />{f}</p>)}
                    {plan.features.length > 3 && <p className="text-gray-600 text-xs">+{plan.features.length - 3} fitur lainnya</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setModal(plan)} className="btn-secondary flex-1 text-xs py-1.5 flex items-center justify-center gap-1"><Edit2 size={11} /> Edit</button>
                    <button onClick={() => handleDelete(plan.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="card overflow-x-auto">
          {payments.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Belum ada transaksi</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-left py-2 px-3">Plan</th>
                  <th className="text-right py-2 px-3">Jumlah</th>
                  <th className="text-left py-2 px-3">Metode</th>
                  <th className="text-left py-2 px-3">Bukti</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Tanggal</th>
                  <th className="text-right py-2 px-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-800/40">
                    <td className="py-2 px-3">
                      <p className="text-white font-medium">{p.username}</p>
                      {p.full_name && <p className="text-gray-500 text-xs">{p.full_name}</p>}
                      <p className="text-gray-600 text-xs font-mono">{p.order_id}</p>
                    </td>
                    <td className="py-2 px-3"><p className="text-gray-300 text-xs">{p.plan_name}<br /><span className="text-gray-600">{p.duration_days} hari</span></p></td>
                    <td className="py-2 px-3 text-right text-white font-semibold">{formatPrice(p.amount)}</td>
                    <td className="py-2 px-3 text-gray-400 text-xs">{p.payment_type || '-'}</td>
                    <td className="py-2 px-3">
                      {p.payment_proof_url ? (
                        <a href={p.payment_proof_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-xs">Lihat</a>
                      ) : <span className="text-gray-600 text-xs">-</span>}
                    </td>
                    <td className="py-2 px-3 text-center">{statusBadge(p.status)}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{formatDate(p.created_at)}</td>
                    <td className="py-2 px-3 text-right">
                      {p.status === 'pending' ? (
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Konfirmasi pembayaran ${formatPrice(p.amount)} dari ${p.username}?\n\nLangganan akan langsung aktif.`)) return;
                            try {
                              await api.post(`/payments/confirm/${p.order_id}`);
                              load();
                            } catch (e) {
                              alert(e.response?.data?.error || 'Gagal konfirmasi pembayaran');
                            }
                          }}
                          className="text-xs bg-green-600 hover:bg-green-500 text-white font-semibold px-3 py-1 rounded-lg transition-colors"
                        >
                          Konfirmasi
                        </button>
                      ) : <span className="text-gray-600 text-xs">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal !== null && (
        <PlanModal plan={modal?.id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
      {showPaySettings && <PaySettingsModal onClose={() => setShowPaySettings(false)} />}
    </div>
  );
}
