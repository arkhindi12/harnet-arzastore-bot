import React, { useState, useEffect } from 'react';
import { ShieldOff, Plus, Trash2, RefreshCw, X, Upload, AlertCircle } from 'lucide-react';
import api from '../utils/api';

const TYPE_LABELS = { post: 'Postingan', group: 'Grup', profile: 'Profil', other: 'Lainnya' };

function AddModal({ onClose, onSaved }) {
  const [mode, setMode] = useState('single');
  const [url, setUrl] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [type, setType] = useState('post');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSingle = async () => {
    if (!url.trim()) return setError('URL wajib diisi');
    setSaving(true); setError('');
    try {
      await api.post('/blacklists', { url: url.trim(), type, note });
      onSaved();
    } catch (e) { setError(e.response?.data?.error || 'Gagal menambahkan'); }
    finally { setSaving(false); }
  };

  const handleBulk = async () => {
    const urls = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!urls.length) return setError('Masukkan minimal 1 URL');
    setSaving(true); setError('');
    try {
      const r = await api.post('/blacklists/bulk', { urls, type });
      onSaved(r.data.message);
    } catch (e) { setError(e.response?.data?.error || 'Gagal'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><ShieldOff size={16} className="text-red-400" /> Tambah Blacklist</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}

          <div className="flex gap-2">
            {['single', 'bulk'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${mode === m ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {m === 'single' ? 'URL Tunggal' : 'Bulk (Banyak URL)'}
              </button>
            ))}
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Tipe URL</label>
            <select className="input w-full" value={type} onChange={e => setType(e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {mode === 'single' ? (
            <>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">URL *</label>
                <input className="input w-full" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.facebook.com/..." />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Catatan (opsional)</label>
                <input className="input w-full" value={note} onChange={e => setNote(e.target.value)} placeholder="Alasan blacklist..." />
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
                <button onClick={handleSingle} disabled={saving} className="btn-danger flex-1">{saving ? 'Menyimpan...' : 'Tambahkan'}</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">URL (satu per baris) *</label>
                <textarea className="input w-full resize-none text-sm" rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"https://www.facebook.com/...\nhttps://www.facebook.com/groups/..."} />
                <p className="text-gray-600 text-xs mt-1">{bulkText.split('\n').filter(l => l.trim()).length} URL terdeteksi</p>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
                <button onClick={handleBulk} disabled={saving} className="btn-danger flex-1">{saving ? 'Menambahkan...' : 'Tambahkan Semua'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BlacklistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/blacklists'); setItems(r.data); }
    catch { setItems([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Hapus dari blacklist?')) return;
    await api.delete(`/blacklists/${id}`);
    setItems(p => p.filter(i => i.id !== id));
  };

  const handleClearAll = async () => {
    if (!confirm('Kosongkan seluruh blacklist? Tindakan ini tidak bisa dibatalkan.')) return;
    await api.delete('/blacklists');
    setItems([]);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filtered = items.filter(i => {
    if (filterType !== 'all' && i.type !== filterType) return false;
    if (search && !i.url.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldOff size={22} className="text-red-400" /> Blacklist URL</h1>
          <p className="text-gray-400 mt-1">URL yang diblacklist tidak akan dijadikan target komentar otomatis</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary p-2" title="Refresh"><RefreshCw size={15} /></button>
          {items.length > 0 && (
            <button onClick={handleClearAll} className="btn-danger flex items-center gap-2">
              <Trash2 size={15} /> Kosongkan
            </button>
          )}
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Tambah URL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {['all', 'post', 'group', 'profile'].map(t => {
          const count = t === 'all' ? items.length : items.filter(i => i.type === t).length;
          return (
            <div key={t} onClick={() => setFilterType(t)} className={`card py-3 cursor-pointer transition-all ${filterType === t ? 'border-red-500/50 bg-red-900/10' : 'hover:border-gray-600'}`}>
              <p className="text-gray-400 text-xs">{t === 'all' ? 'Semua' : TYPE_LABELS[t]}</p>
              <p className="text-2xl font-bold text-white mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <input className="input flex-1" placeholder="Cari URL..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <ShieldOff size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold">{items.length === 0 ? 'Blacklist kosong' : 'Tidak ada yang cocok'}</p>
          <p className="text-gray-600 text-sm mt-1 mb-6">URL yang diblacklist tidak akan dikomentari secara otomatis</p>
          {items.length === 0 && <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">Tambah URL Pertama</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-800/30">{TYPE_LABELS[item.type] || item.type}</span>
                  <span className="text-gray-600 text-xs">{new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm font-mono truncate block">{item.url}</a>
                {item.note && <p className="text-gray-500 text-xs mt-1">{item.note}</p>}
              </div>
              <button onClick={() => handleDelete(item.id)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card bg-orange-900/10 border-orange-800/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-300 font-semibold text-sm">Cara Kerja Blacklist</p>
            <p className="text-gray-400 text-sm mt-1">URL yang ada di blacklist akan otomatis dilewati saat kampanye berjalan. Blacklist berlaku untuk semua kampanye Anda. Anda bisa blacklist postingan spesifik, seluruh grup, atau profil tertentu.</p>
          </div>
        </div>
      </div>

      {showModal && <AddModal onClose={() => setShowModal(false)} onSaved={(msg) => { setShowModal(false); load(); if (msg) showToast(msg); }} />}
    </div>
  );
}
