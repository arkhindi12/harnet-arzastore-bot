import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Trash2, RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../utils/api';

export default function CookieRotationPage() {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newCookies, setNewCookies] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/accounts').then(r => setAccounts(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadPool();
  }, [selected]);

  const loadPool = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await api.get(`/cookie-rotation/${selected}`);
      setPool(r.data.pool || []);
    } catch(e) {
      setMsg('Gagal load pool: ' + (e.response?.data?.error || e.message));
    } finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newCookies.trim()) return setMsg('Cookies wajib diisi');
    try {
      await api.post(`/cookie-rotation/${selected}/add`, { cookies: newCookies.trim(), label: newLabel.trim() || undefined });
      setNewCookies(''); setNewLabel(''); setShowAdd(false);
      setMsg('Slot berhasil ditambahkan');
      loadPool();
    } catch(e) { setMsg(e.response?.data?.error || 'Gagal tambah slot'); }
  };

  const handleDelete = async (slotId) => {
    if (!confirm('Hapus slot ini?')) return;
    try {
      await api.delete(`/cookie-rotation/${selected}/${slotId}`);
      setMsg('Slot dihapus');
      loadPool();
    } catch(e) { setMsg(e.response?.data?.error || 'Gagal hapus'); }
  };

  const handleRotate = async () => {
    if (!confirm('Rotate cookies akun sekarang ke slot berikutnya?')) return;
    setRotating(true);
    try {
      const r = await api.post(`/cookie-rotation/${selected}/rotate`);
      setMsg(r.data.success ? `✅ ${r.data.message}` : `❌ ${r.data.message}`);
      loadPool();
    } catch(e) { setMsg(e.response?.data?.error || 'Gagal rotate'); }
    finally { setRotating(false); }
  };

  const selectedAcc = accounts.find(a => a.id === selected);

  const statusBadge = (s) => {
    if (s === 'expired') return <span className="badge bg-red-900/40 text-red-300 border-red-700/40">expired</span>;
    if (s === 'available') return <span className="badge bg-green-900/40 text-green-300 border-green-700/40">available</span>;
    return <span className="badge bg-gray-800 text-gray-400">{s}</span>;
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <RefreshCw size={22} className="text-blue-400" />
        <h1 className="text-xl font-bold text-white">Cookie Rotation</h1>
      </div>

      <p className="text-gray-400 text-sm mb-6">
        Simpan beberapa set cookies per akun. Kalau cookies aktif expired, sistem akan otomatis pindah ke slot berikutnya.
      </p>

      {/* Pilih akun */}
      <div className="mb-6">
        <label className="label mb-1">Pilih Akun</label>
        <select className="input" value={selected || ''} onChange={e => { setSelected(e.target.value); setMsg(''); }}>
          <option value="">-- pilih akun --</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          {/* Info akun */}
          <div className="mb-4 p-3 rounded-xl bg-gray-800/50 border border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{selectedAcc?.name}</p>
              <p className="text-xs text-gray-400">Status: <span className={selectedAcc?.status === 'active' ? 'text-green-400' : 'text-red-400'}>{selectedAcc?.status}</span> • {pool.length} slot di pool</p>
            </div>
            <div className="flex gap-2">
              <button
                className={`btn-secondary flex items-center gap-1.5 text-sm ${rotating ? 'opacity-60' : ''}`}
                onClick={handleRotate}
                disabled={rotating}
              >
                <RotateCcw size={14} /> {rotating ? 'Rotating...' : 'Rotate Sekarang'}
              </button>
              <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowAdd(v => !v)}>
                <Plus size={14} /> Tambah Slot
              </button>
            </div>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="mb-4 p-4 rounded-xl bg-gray-800 border border-gray-700">
              <h3 className="text-white font-medium mb-3">Tambah Cookies Baru</h3>
              <div className="mb-3">
                <label className="label mb-1">Label (opsional)</label>
                <input className="input" placeholder="Contoh: Slot Backup 1" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="label mb-1">Cookies *</label>
                <textarea className="input font-mono text-xs" rows={4} placeholder="Paste cookies di sini (format JSON array atau Netscape string)" value={newCookies} onChange={e => setNewCookies(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-sm" onClick={handleAdd}>Simpan Slot</button>
                <button className="btn-secondary text-sm" onClick={() => setShowAdd(false)}>Batal</button>
              </div>
            </div>
          )}

          {/* Message */}
          {msg && (
            <div className="mb-4 p-3 rounded-xl bg-blue-900/30 border border-blue-700/40 text-sm text-blue-200 flex justify-between">
              {msg}
              <button onClick={() => setMsg('')} className="text-gray-400 hover:text-white ml-4">✕</button>
            </div>
          )}

          {/* Pool list */}
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading pool...</div>
          ) : pool.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw size={32} className="mx-auto mb-2 opacity-30" />
              <p>Belum ada slot di pool.</p>
              <p className="text-sm mt-1">Tambah cookies backup agar sistem bisa auto-rotate.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pool.map((slot, i) => (
                <div key={slot.id} className="p-3 rounded-xl bg-gray-800/60 border border-gray-700 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{slot.label || `Slot ${i + 1}`}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{slot.cookies}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {statusBadge(slot.status)}
                      {slot.added_at && <span className="text-xs text-gray-600">Ditambah: {new Date(slot.added_at).toLocaleDateString('id-ID')}</span>}
                      {slot.expired_at && <span className="text-xs text-red-400">Expired: {new Date(slot.expired_at).toLocaleDateString('id-ID')}</span>}
                    </div>
                  </div>
                  <button className="text-gray-500 hover:text-red-400 ml-4" onClick={() => handleDelete(slot.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
