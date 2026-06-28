import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpCircle, Users, Store, Share2, Plus, Play, Square, Trash2, X, Save, Clock, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Download, Search, ToggleLeft, ToggleRight, Tag, Zap } from 'lucide-react';
import api from '../utils/api';
import AIGenerateModal from '../components/AIGenerateModal';

const TABS = [
  { key: 'auto_up', label: 'Auto UP Postingan', icon: ArrowUpCircle, color: 'blue', desc: 'Bump postingan di grup agar selalu di atas' },
  { key: 'group_post', label: 'Auto Post Grup', icon: Users, color: 'purple', desc: 'Posting konten otomatis ke banyak grup' },
  { key: 'smart_post', label: 'Smart Post (Auto Detect)', icon: Zap, color: 'cyan', desc: 'Otomatis pilih: listing di grup jual-beli, post biasa di grup diskusi' },
  { key: 'share_post', label: 'Auto Share ke Grup', icon: Share2, color: 'emerald', desc: 'Share post profil/fanpage ke banyak grup' },
  { key: 'group_listing', label: 'Auto Jual di Grup', icon: Tag, color: 'pink', desc: 'Posting jual barang via tombol Sell Something di grup jual-beli' },
  { key: 'marketplace', label: 'Auto Post Marketplace', icon: Store, color: 'orange', desc: 'Pasang iklan otomatis di Facebook Marketplace' },
];

const CATEGORIES = ['Kendaraan', 'Properti', 'Elektronik', 'Pakaian', 'Perabotan', 'Taman', 'Hobi', 'Mainan', 'Lainnya'];
const CONDITIONS = [
  { value: 'NEW', label: 'Baru' },
  { value: 'USED_LIKE_NEW', label: 'Bekas - Seperti Baru' },
  { value: 'USED_GOOD', label: 'Bekas - Kondisi Baik' },
  { value: 'USED_FAIR', label: 'Bekas - Kondisi Cukup' },
];

function StatusBadge({ status }) {
  const map = { running: 'badge-running', idle: 'badge-idle', completed: 'badge-completed', failed: 'badge-failed' };
  const labels = { running: '● Berjalan', idle: '○ Idle', completed: '✓ Selesai', failed: '✗ Gagal' };
  return <span className={map[status] || 'badge-idle'}>{labels[status] || status}</span>;
}

function AutoUPModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState({
    name: '', account_ids: [], targets: '',
    up_text: '{UP|up|Up|naik|Naik|^^|⬆️}',
    delay_min: 10, delay_max: 30,
    browser_engine: 'patchright',
    interval_minutes: 120,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleAccount = id => setForm(p => ({
    ...p, account_ids: p.account_ids.includes(id) ? p.account_ids.filter(a => a !== id) : [...p.account_ids, id]
  }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.account_ids.length) return setError('Pilih minimal 1 akun');
    const targets = form.targets.split('\n').map(t => t.trim()).filter(Boolean);
    if (!targets.length) return setError('Masukkan minimal 1 URL postingan');
    setLoading(true); setError('');
    try {
      await api.post('/post-tasks', {
        type: 'auto_up', name: form.name, account_ids: form.account_ids,
        browser_engine: form.browser_engine || 'patchright',
      interval_minutes: form.interval_minutes,
        config: { targets, up_text: form.up_text, delay_min: form.delay_min, delay_max: form.delay_max },
      });
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal membuat task'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Auto UP Postingan" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrBox msg={error} />}
        <div>
          <label className="label">Nama Task *</label>
          <input className="input" placeholder="Contoh: UP Postingan Jual Motor" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>
        <div>
          <label className="label">URL Postingan yang Ingin di-UP (1 per baris) *</label>
          <textarea className="input min-h-[100px] resize-none text-sm" placeholder="https://www.facebook.com/groups/xxx/posts/xxx&#10;https://www.facebook.com/groups/yyy/posts/yyy" value={form.targets} onChange={e => setForm(p => ({ ...p, targets: e.target.value }))} required />
          <p className="text-gray-500 text-xs mt-1">Salin URL postingan Anda di grup yang ingin di-UP</p>
        </div>
        <div>
          <label className="label">Teks Komentar UP (spintax didukung)</label>
          <input className="input font-mono text-sm" value={form.up_text} onChange={e => setForm(p => ({ ...p, up_text: e.target.value }))} />
          <p className="text-gray-500 text-xs mt-1">Gunakan <code className="text-blue-400">{'{UP|up|naik}'}</code> agar bervariasi</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Delay Antar UP (detik)</label>
            <div className="flex gap-2">
              <input type="number" className="input text-center" min={5} value={form.delay_min} onChange={e => setForm(p => ({ ...p, delay_min: +e.target.value }))} />
              <span className="text-gray-500 self-center">–</span>
              <input type="number" className="input text-center" min={5} value={form.delay_max} onChange={e => setForm(p => ({ ...p, delay_max: +e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Ulangi Setiap (menit)</label>
            <div className="flex items-center gap-2">
              <input type="number" className="input text-center" min={30} max={10080} value={form.interval_minutes} onChange={e => setForm(p => ({ ...p, interval_minutes: +e.target.value }))} />
              <span className="text-gray-400 text-sm flex-shrink-0">menit</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">0 = jalankan sekali saja</p>
          </div>
        </div>
        <AccountSelector accounts={accounts} selected={form.account_ids} toggle={toggleAccount} />
                <div>
            <label className="label">Browser Engine</label>
            <select className="input" value={form.browser_engine || "patchright"} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
              <option value="patchright">Patchright / Chromium (default)</option>
              <option value="obscura">Obscura (ringan, hemat RAM)</option>
            </select>
          </div>

        <ModalActions onClose={onClose} loading={loading} label="Buat Task UP" />
      </form>
    </Modal>
  );
}

function GroupPickerSection({ accounts, selectedGroups, onGroupsChange }) {
  const [fetchAccountId, setFetchAccountId] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchedGroups, setFetchedGroups] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [mode, setMode] = useState('picker');

  const handleFetch = async () => {
    if (!fetchAccountId) return setFetchError('Pilih akun terlebih dahulu');
    setFetching(true); setFetchError('');
    try {
      const res = await api.get(`/accounts/${fetchAccountId}/groups`);
      if (res.data.success && res.data.groups.length > 0) {
        setFetchedGroups(res.data.groups);
        setFetchError('');
      } else {
        setFetchError(res.data.error || 'Tidak ada grup yang ditemukan. Coba akun lain atau input manual.');
        if (res.data.groups?.length === 0) setFetchedGroups([]);
      }
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Gagal memuat grup dari Facebook');
    } finally {
      setFetching(false);
    }
  };

  const filteredGroups = fetchedGroups.filter(g =>
    g.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    g.url.toLowerCase().includes(searchQ.toLowerCase())
  );

  const selectedUrls = selectedGroups.filter(Boolean);

  const toggleGroup = (url) => {
    if (selectedUrls.includes(url)) {
      onGroupsChange(selectedUrls.filter(u => u !== url));
    } else {
      onGroupsChange([...selectedUrls, url]);
    }
  };

  const toggleAll = () => {
    const allFiltered = filteredGroups.map(g => g.url);
    const allSelected = allFiltered.every(u => selectedUrls.includes(u));
    if (allSelected) {
      onGroupsChange(selectedUrls.filter(u => !allFiltered.includes(u)));
    } else {
      const merged = [...new Set([...selectedUrls, ...allFiltered])];
      onGroupsChange(merged);
    }
  };

  const manualText = selectedUrls.join('\n');
  const handleManualChange = (val) => {
    const urls = val.split('\n').map(u => u.trim()).filter(Boolean);
    onGroupsChange(urls);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="label mb-0 flex-1">Grup Target *</label>
        <div className="flex rounded-lg border border-gray-600 overflow-hidden text-xs">
          <button type="button" onClick={() => setMode('picker')}
            className={`px-3 py-1.5 transition-colors ${mode === 'picker' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Pilih dari Akun
          </button>
          <button type="button" onClick={() => setMode('manual')}
            className={`px-3 py-1.5 transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Input Manual
          </button>
        </div>
      </div>

      {mode === 'picker' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <select className="input flex-1" value={fetchAccountId} onChange={e => setFetchAccountId(e.target.value)}>
              <option value="">-- Pilih akun untuk ambil daftar grup --</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button type="button" onClick={handleFetch} disabled={fetching || !fetchAccountId}
              className="btn-primary px-3 flex-shrink-0 whitespace-nowrap">
              {fetching ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              {fetching ? 'Memuat...' : 'Muat Grup'}
            </button>
          </div>

          {fetchError && (
            <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 rounded-lg px-3 py-2 text-xs">{fetchError}</div>
          )}

          {fetchedGroups.length > 0 && (
            <div className="border border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-gray-800 px-3 py-2 flex items-center gap-2">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Cari nama grup..."
                  className="bg-transparent text-white text-sm flex-1 outline-none placeholder-gray-500"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                <span className="text-gray-400 text-xs flex-shrink-0">{selectedUrls.length} dipilih</span>
              </div>

              <div className="bg-gray-800/50 px-3 py-1.5 border-t border-gray-700 flex items-center justify-between">
                <button type="button" onClick={toggleAll} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
                  {filteredGroups.every(g => selectedUrls.includes(g.url)) ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {filteredGroups.every(g => selectedUrls.includes(g.url)) ? 'Batalkan Semua' : 'Pilih Semua'}
                </button>
                <span className="text-gray-500 text-xs">{filteredGroups.length} grup ditemukan</span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-gray-700/50">
                {filteredGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Tidak ada hasil pencarian</p>
                ) : filteredGroups.map(group => {
                  const isSelected = selectedUrls.includes(group.url);
                  return (
                    <label key={group.url} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-blue-900/20' : 'hover:bg-gray-800'}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleGroup(group.url)} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{group.name}</p>
                        <p className="text-gray-500 text-xs truncate">{group.url}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {fetchedGroups.length === 0 && !fetching && !fetchError && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-center">
              <Users size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Pilih akun lalu klik <strong className="text-white">Muat Grup</strong></p>
              <p className="text-gray-500 text-xs mt-1">Sistem akan mengambil daftar grup dari akun Facebook Anda</p>
            </div>
          )}

          {selectedUrls.length > 0 && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg px-3 py-2">
              <p className="text-blue-300 text-xs font-medium mb-1">{selectedUrls.length} grup dipilih:</p>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {selectedUrls.map(url => {
                  const grp = fetchedGroups.find(g => g.url === url);
                  const label = grp ? grp.name : url.split('/').filter(Boolean).pop();
                  return (
                    <span key={url} className="bg-blue-800/50 text-blue-200 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      {label}
                      <button type="button" onClick={() => toggleGroup(url)} className="hover:text-red-300"><X size={10} /></button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea
            className="input min-h-[100px] resize-none text-sm font-mono"
            placeholder="https://www.facebook.com/groups/namgrup&#10;https://www.facebook.com/groups/grupjualbeli&#10;..."
            value={manualText}
            onChange={e => handleManualChange(e.target.value)}
          />
          <p className="text-gray-500 text-xs mt-1">{selectedUrls.length} URL dimasukkan · Satu URL per baris</p>
        </div>
      )}
    </div>
  );
}

function GroupPostAI({ value, onChange }) {
  const [showAI, setShowAI] = useState(false);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <label className="label" style={{ margin:0 }}>Konten Postingan * (spintax didukung)</label>
        <button type="button" onClick={() => setShowAI(true)}
          style={{ background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.4)', borderRadius:8, padding:'3px 10px', color:'#c084fc', cursor:'pointer', fontSize:'0.78rem' }}>
          ✨ AI Generate
        </button>
      </div>
      <textarea className="input min-h-[120px] resize-none text-sm" placeholder="Tulis konten postingan Anda di sini...&#10;&#10;Gunakan {variasi1|variasi2} untuk variasi teks otomatis" value={value} onChange={e => onChange(e.target.value)} required />
      <p className="text-gray-500 text-xs mt-1">Spintax: <code className="text-blue-400">{'{Dijual|WTS|For Sale}'}</code></p>
      {showAI && <AIGenerateModal defaultType="group_post" onInsert={txt => onChange(txt)} onClose={() => setShowAI(false)} />}
    </div>
  );
}

function GroupPostModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState({
    name: '', account_ids: [], selected_groups: [],
    post_text: '', delay_min: 30, delay_max: 90,
    interval_minutes: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleAccount = id => setForm(p => ({
    ...p, account_ids: p.account_ids.includes(id) ? p.account_ids.filter(a => a !== id) : [...p.account_ids, id]
  }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.account_ids.length) return setError('Pilih minimal 1 akun');
    if (!form.selected_groups.length) return setError('Pilih atau masukkan minimal 1 URL grup');
    if (!form.post_text.trim()) return setError('Isi konten postingan');
    setLoading(true); setError('');
    try {
      await api.post('/post-tasks', {
        type: 'group_post', name: form.name, account_ids: form.account_ids,
        browser_engine: form.browser_engine || 'patchright',
      interval_minutes: form.interval_minutes,
        config: { groups: form.selected_groups, post_text: form.post_text, delay_min: form.delay_min, delay_max: form.delay_max },
      });
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal membuat task'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Auto Post ke Grup" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrBox msg={error} />}
        <div>
          <label className="label">Nama Task *</label>
          <input className="input" placeholder="Contoh: Post Promo ke Semua Grup" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>

        <AccountSelector accounts={accounts} selected={form.account_ids} toggle={toggleAccount} />

        <GroupPickerSection
          accounts={accounts}
          selectedGroups={form.selected_groups}
          onGroupsChange={groups => setForm(p => ({ ...p, selected_groups: groups }))}
        />

        <div>
          <GroupPostAI value={form.post_text} onChange={v => setForm(p => ({ ...p, post_text: v }))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Delay Antar Grup (detik)</label>
            <div className="flex gap-2">
              <input type="number" className="input text-center" min={10} value={form.delay_min} onChange={e => setForm(p => ({ ...p, delay_min: +e.target.value }))} />
              <span className="text-gray-500 self-center">–</span>
              <input type="number" className="input text-center" min={10} value={form.delay_max} onChange={e => setForm(p => ({ ...p, delay_max: +e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Ulangi Setiap (menit)</label>
            <div className="flex items-center gap-2">
              <input type="number" className="input text-center" min={0} max={10080} value={form.interval_minutes} onChange={e => setForm(p => ({ ...p, interval_minutes: +e.target.value }))} />
              <span className="text-gray-400 text-sm flex-shrink-0">menit</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">0 = jalankan sekali</p>
          </div>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-yellow-400 text-base">⚠️</span>
            <h4 className="text-yellow-300 font-semibold text-sm">Tips Agar Aman dari Checkpoint Facebook</h4>
          </div>
          <ul className="space-y-1.5 text-yellow-200/80 text-xs">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">1.</span>
              <span><strong className="text-yellow-200">Jangan terlalu banyak grup sekaligus</strong> — Maksimal 20–30 grup per sesi per akun. Terlalu banyak dalam waktu singkat memicu deteksi spam.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">2.</span>
              <span><strong className="text-yellow-200">Gunakan delay yang cukup</strong> — Set delay antar grup minimal 30–60 detik. Manusia tidak bisa posting ke 10 grup dalam 1 menit.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">3.</span>
              <span><strong className="text-yellow-200">Variasikan konten dengan spintax</strong> — Konten identik di banyak grup terdeteksi sebagai spam. Gunakan <code className="text-yellow-300">{'{teks1|teks2|teks3}'}</code> agar setiap postingan berbeda.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">4.</span>
              <span><strong className="text-yellow-200">Gunakan banyak akun bergantian</strong> — Pilih beberapa akun sekaligus agar beban dibagi rata. Satu akun posting ke semua grup = risiko tinggi.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">5.</span>
              <span><strong className="text-yellow-200">Atur interval pengulangan yang wajar</strong> — Jika diulang, jangan lebih sering dari 6–12 jam. Posting terlalu sering ke grup yang sama bisa diblokir oleh admin grup.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">6.</span>
              <span><strong className="text-yellow-200">Pastikan akun sudah aktif dan tua</strong> — Akun baru (&lt; 3 bulan) atau akun yang jarang aktif lebih mudah kena checkpoint.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">7.</span>
              <span><strong className="text-yellow-200">Hindari link di setiap postingan</strong> — Postingan yang selalu mengandung link eksternal lebih cepat ditandai spam oleh algoritma Facebook.</span>
            </li>
          </ul>
        </div>

                <div>
            <label className="label">Browser Engine</label>
            <select className="input" value={form.browser_engine || "patchright"} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
              <option value="patchright">Patchright / Chromium (default)</option>
              <option value="obscura">Obscura (ringan, hemat RAM)</option>
            </select>
          </div>

        <ModalActions onClose={onClose} loading={loading} label="Buat Task Post Grup" />
      </form>
    </Modal>
  );
}

const BLANK_LISTING = () => ({
  _id: Math.random().toString(36).slice(2),
  title: '', description: '',
  price_min: '', price_max: '',
  category: 'Lainnya', condition: 'USED_GOOD',
  images: '',
});

function ListingCard({ listing, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(index === 0);
  const [showAI, setShowAI] = useState(null);
  return (
    <div className="border border-gray-700 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-800 cursor-pointer hover:bg-gray-750 select-none"
        onClick={() => setOpen(p => !p)}
      >
        <div className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{index + 1}</div>
        <span className="text-white font-medium flex-1 truncate text-sm">{listing.title || `Produk ${index + 1}`}</span>
        {listing.price_min && <span className="text-orange-300 text-xs">Rp {Number(listing.price_min).toLocaleString('id-ID')}{listing.price_max && listing.price_max !== listing.price_min ? `–${Number(listing.price_max).toLocaleString('id-ID')}` : ''}</span>}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="text-gray-500 hover:text-white disabled:opacity-30 p-1"><ChevronUp size={14} /></button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="text-gray-500 hover:text-white disabled:opacity-30 p-1"><ChevronDown size={14} /></button>
          <button type="button" onClick={onRemove} disabled={total === 1} className="text-gray-500 hover:text-red-400 disabled:opacity-30 p-1"><X size={14} /></button>
        </div>
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="p-4 space-y-3">
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <label className="label text-xs" style={{ margin:0 }}>Judul Iklan * <span className="text-gray-500">(spintax didukung)</span></label>
              <button type="button" onClick={() => setShowAI('title')}
                style={{ background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.4)', borderRadius:6, padding:'2px 8px', color:'#c084fc', cursor:'pointer', fontSize:'0.72rem' }}>
                ✨ AI
              </button>
            </div>
            <input className="input text-sm" placeholder="Contoh: {Dijual|WTS|For Sale} Honda Beat 2020" value={listing.title} onChange={e => onChange({ ...listing, title: e.target.value })} />
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <label className="label text-xs" style={{ margin:0 }}>Deskripsi <span className="text-gray-500">(spintax didukung)</span></label>
              <button type="button" onClick={() => setShowAI('description')}
                style={{ background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.4)', borderRadius:6, padding:'2px 8px', color:'#c084fc', cursor:'pointer', fontSize:'0.72rem' }}>
                ✨ AI
              </button>
            </div>
            <textarea className="input text-sm min-h-[90px] resize-none" placeholder="Deskripsi produk, spesifikasi, kondisi, nomor kontak..." value={listing.description} onChange={e => onChange({ ...listing, description: e.target.value })} />
          </div>
          {showAI && (
            <AIGenerateModal
              defaultType={showAI === 'title' ? 'title' : 'description'}
              onInsert={txt => { onChange({ ...listing, [showAI]: txt }); setShowAI(null); }}
              onClose={() => setShowAI(null)}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Harga Min (Rp) *</label>
              <input type="number" className="input text-sm" placeholder="500000" min={0} value={listing.price_min} onChange={e => onChange({ ...listing, price_min: e.target.value })} />
            </div>
            <div>
              <label className="label text-xs">Harga Max (Rp) <span className="text-gray-500 font-normal">(opsional, untuk variasi)</span></label>
              <input type="number" className="input text-sm" placeholder="sama dengan min" min={0} value={listing.price_max} onChange={e => onChange({ ...listing, price_max: e.target.value })} />
            </div>
          </div>
          <p className="text-gray-500 text-xs -mt-1">Jika min ≠ max, harga dipilih acak dari rentang tersebut tiap posting</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Kategori</label>
              <select className="input text-sm" value={listing.category} onChange={e => onChange({ ...listing, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Kondisi Barang</label>
              <select className="input text-sm" value={listing.condition} onChange={e => onChange({ ...listing, condition: e.target.value })}>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label text-xs">URL Foto Produk <span className="text-gray-500 font-normal">(maks 8, satu per baris)</span></label>
            <textarea className="input text-sm min-h-[70px] resize-none font-mono text-xs" placeholder="https://i.imgur.com/foto1.jpg&#10;https://i.imgur.com/foto2.jpg" value={listing.images} onChange={e => onChange({ ...listing, images: e.target.value })} />
            <p className="text-gray-500 text-xs mt-1">Gunakan layanan hosting gambar seperti Imgur, ImgBB, atau Cloudinary</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketplaceModal({ onClose, onSave, accounts }) {
  const [name, setName] = useState('');
  const [accountIds, setAccountIds] = useState([]);
  const [listings, setListings] = useState([BLANK_LISTING()]);
  const [latitude, setLatitude] = useState(-6.2088);
  const [longitude, setLongitude] = useState(106.8456);
  const [locationOffset, setLocationOffset] = useState(0.02);
  const [useLocationOffset, setUseLocationOffset] = useState(false);
  const [peakEnabled, setPeakEnabled] = useState(false);
  const [peakStart, setPeakStart] = useState(8);
  const [peakEnd, setPeakEnd] = useState(21);
  const [hideFromFriends, setHideFromFriends] = useState(false);
  const [delayMin, setDelayMin] = useState(60);
  const [delayMax, setDelayMax] = useState(180);
  const [intervalMinutes, setIntervalMinutes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleAccount = id => setAccountIds(p =>
    p.includes(id) ? p.filter(a => a !== id) : [...p, id]
  );

  const updateListing = (idx, val) => setListings(p => p.map((l, i) => i === idx ? val : l));
  const addListing = () => setListings(p => [...p, BLANK_LISTING()]);
  const removeListing = idx => setListings(p => p.filter((_, i) => i !== idx));
  const moveListing = (idx, dir) => setListings(p => {
    const arr = [...p];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return arr;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    return arr;
  });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!accountIds.length) return setError('Pilih minimal 1 akun');
    for (const [i, l] of listings.entries()) {
      if (!l.title.trim()) return setError(`Produk ${i + 1}: judul wajib diisi`);
      if (!l.price_min) return setError(`Produk ${i + 1}: harga minimum wajib diisi`);
    }
    setLoading(true); setError('');
    try {
      const config = {
        listings: listings.map(l => ({
          title: l.title,
          description: l.description,
          price_min: parseInt(l.price_min) || 0,
          price_max: parseInt(l.price_max || l.price_min) || 0,
          category: l.category,
          condition: l.condition,
          images: l.images.split('\n').map(u => u.trim()).filter(Boolean),
        })),
        latitude,
        longitude,
        location_random_offset: useLocationOffset ? locationOffset : 0,
        peak_hours_enabled: peakEnabled,
        peak_hours_start: peakStart,
        peak_hours_end: peakEnd,
        hide_from_friends: hideFromFriends,
        delay_min: delayMin,
        delay_max: delayMax,
      };
      await api.post('/post-tasks', {
        type: 'marketplace', name, account_ids: accountIds,
        interval_minutes: intervalMinutes, config,
        browser_engine: form.browser_engine || 'patchright',
      });
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal membuat task'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Auto Post Marketplace" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <ErrBox msg={error} />}

        <div>
          <label className="label">Nama Task *</label>
          <input className="input" placeholder="Contoh: Iklan Motor & HP di Marketplace" value={name} onChange={e => setName(e.target.value)} required />
        </div>

        <AccountSelector accounts={accounts} selected={accountIds} toggle={toggleAccount} />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="label mb-0">Template Produk *</label>
              <p className="text-gray-500 text-xs">Semua produk akan diposting tiap kali task berjalan</p>
            </div>
            <button type="button" onClick={addListing} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
              <Plus size={13} /> Tambah Produk
            </button>
          </div>
          <div className="space-y-2">
            {listings.map((l, i) => (
              <ListingCard
                key={l._id} listing={l} index={i} total={listings.length}
                onChange={val => updateListing(i, val)}
                onRemove={() => removeListing(i)}
                onMoveUp={() => moveListing(i, -1)}
                onMoveDown={() => moveListing(i, 1)}
              />
            ))}
          </div>
        </div>

        <div className="border border-gray-700 rounded-xl p-4 space-y-4">
          <h4 className="text-white font-medium text-sm flex items-center gap-2">📍 Pengaturan Lokasi</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Latitude</label>
              <input type="number" step="any" className="input text-sm" value={latitude} onChange={e => setLatitude(+e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Longitude</label>
              <input type="number" step="any" className="input text-sm" value={longitude} onChange={e => setLongitude(+e.target.value)} />
            </div>
          </div>
          <p className="text-gray-500 text-xs">Jakarta: -6.2088, 106.8456 · Cari di <a href="https://www.latlong.net" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">latlong.net</a></p>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${useLocationOffset ? 'bg-blue-600' : 'bg-gray-600'}`} onClick={() => setUseLocationOffset(p => !p)}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${useLocationOffset ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-white text-sm">Variasi Lokasi Otomatis</p>
              <p className="text-gray-500 text-xs">Koordinat digeser sedikit setiap posting agar tidak identik</p>
            </div>
          </label>
          {useLocationOffset && (
            <div>
              <label className="label text-xs">Besar Offset (derajat, 0.01 ≈ ±1km)</label>
              <input type="number" step="0.001" className="input text-sm" value={locationOffset} onChange={e => setLocationOffset(+e.target.value)} min={0.001} max={0.5} />
            </div>
          )}
        </div>

        <div className="border border-gray-700 rounded-xl p-4 space-y-4">
          <h4 className="text-white font-medium text-sm flex items-center gap-2">⏰ Jadwal & Waktu</h4>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${peakEnabled ? 'bg-blue-600' : 'bg-gray-600'}`} onClick={() => setPeakEnabled(p => !p)}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${peakEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-white text-sm">Aktif Hanya di Jam Puncak</p>
              <p className="text-gray-500 text-xs">Posting hanya pada jam ramai agar iklan lebih terlihat</p>
            </div>
          </label>
          {peakEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Mulai Jam</label>
                <select className="input text-sm" value={peakStart} onChange={e => setPeakStart(+e.target.value)}>
                  {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Selesai Jam</label>
                <select className="input text-sm" value={peakEnd} onChange={e => setPeakEnd(+e.target.value)}>
                  {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Delay Antar Produk (detik)</label>
              <div className="flex gap-2">
                <input type="number" className="input text-sm text-center" min={10} value={delayMin} onChange={e => setDelayMin(+e.target.value)} />
                <span className="text-gray-500 self-center">–</span>
                <input type="number" className="input text-sm text-center" min={10} value={delayMax} onChange={e => setDelayMax(+e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label text-xs">Ulangi Setiap (menit)</label>
              <div className="flex items-center gap-2">
                <input type="number" className="input text-sm text-center" min={0} value={intervalMinutes} onChange={e => setIntervalMinutes(+e.target.value)} />
                <span className="text-gray-400 text-xs flex-shrink-0">mnt</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">0 = sekali jalan</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-700 rounded-xl p-4 space-y-2">
          <h4 className="text-white font-medium text-sm flex items-center gap-2">🔒 Privasi</h4>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={hideFromFriends} onChange={e => setHideFromFriends(e.target.checked)} />
            <div>
              <p className="text-white text-sm">Sembunyikan dari Teman</p>
              <p className="text-gray-500 text-xs">Iklan tidak muncul di timeline teman — hanya terlihat di Marketplace</p>
            </div>
          </label>
        </div>

        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-blue-400 text-base">💡</span>
            <h4 className="text-blue-300 font-semibold text-sm">Tips Marketplace Agar Tidak Dibatasi</h4>
          </div>
          <ul className="space-y-1.5 text-blue-200/80 text-xs">
            <li className="flex items-start gap-2"><span className="text-blue-400 flex-shrink-0">1.</span><span><strong className="text-blue-200">Gunakan kisaran harga berbeda</strong> — Set harga Min ≠ Max agar setiap listing harganya sedikit berbeda. Listing identik cepat terdeteksi duplikat.</span></li>
            <li className="flex items-start gap-2"><span className="text-blue-400 flex-shrink-0">2.</span><span><strong className="text-blue-200">Aktifkan variasi lokasi</strong> — Geser koordinat ±1–2 km agar iklan dianggap berasal dari lokasi berbeda.</span></li>
            <li className="flex items-start gap-2"><span className="text-blue-400 flex-shrink-0">3.</span><span><strong className="text-blue-200">Jangan terlalu sering re-post</strong> — Marketplace membatasi listing per akun per hari. Atur interval minimal 8–24 jam.</span></li>
            <li className="flex items-start gap-2"><span className="text-blue-400 flex-shrink-0">4.</span><span><strong className="text-blue-200">Tambahkan foto produk</strong> — Iklan dengan foto lebih dipercaya dan jarang ditandai spam otomatis.</span></li>
            <li className="flex items-start gap-2"><span className="text-blue-400 flex-shrink-0">5.</span><span><strong className="text-blue-200">Gunakan spintax di judul & deskripsi</strong> — <code className="text-blue-300">{'{Dijual|Jual|WTS}'}</code> membuat setiap listing terlihat unik.</span></li>
            <li className="flex items-start gap-2"><span className="text-blue-400 flex-shrink-0">6.</span><span><strong className="text-blue-200">Posting di jam puncak</strong> — Jam 08:00–12:00 dan 18:00–21:00 paling ramai dilihat pembeli.</span></li>
          </ul>
        </div>

                <div>
            <label className="label">Browser Engine</label>
            <select className="input" value={form.browser_engine || "patchright"} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
              <option value="patchright">Patchright / Chromium (default)</option>
              <option value="obscura">Obscura (ringan, hemat RAM)</option>
            </select>
          </div>

        <ModalActions onClose={onClose} loading={loading} label={`Buat Task (${listings.length} Produk)`} />
      </form>
    </Modal>
  );
}

function ShareModal({ onClose, onSave, accounts, initialTask = null }) {
  const [form, setForm] = useState({
    name: '', account_ids: [], selected_groups: [],
    post_urls: '', message: '',
    share_as: 'self', page_name: '',
    delay_min: 30, delay_max: 90,
    interval_minutes: 0,
    max_groups_per_run: 5,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);

  useEffect(() => {
    if (!initialTask) return;
    const cfg = initialTask.config || {};
    setForm({
      name: initialTask.name || '',
      account_ids: Array.isArray(initialTask.account_ids) ? initialTask.account_ids : [],
      selected_groups: Array.isArray(cfg.groups) ? cfg.groups : [],
      post_urls: Array.isArray(cfg.post_urls) ? cfg.post_urls.join('\n') : '',
      message: cfg.message || '',
      share_as: cfg.share_as || 'self',
      page_name: cfg.page_name || '',
      delay_min: cfg.delay_min || 30,
      delay_max: cfg.delay_max || 90,
      interval_minutes: initialTask.interval_minutes || 0,
      max_groups_per_run: cfg.max_groups_per_run || 5,
    });
  }, [initialTask]);

  const toggleAccount = id => setForm(p => ({
    ...p,
    account_ids: p.account_ids.includes(id) ? p.account_ids.filter(x => x !== id) : [...p.account_ids, id],
  }));

  // Auto-load pages saat user pilih "Halaman" + sudah ada akun terpilih
  React.useEffect(() => {
    if (form.share_as !== 'page' || form.account_ids.length === 0) {
      setPages([]);
      return;
    }
    setLoadingPages(true);
    api.get(`/accounts/${form.account_ids[0]}/pages`)
      .then(r => setPages(r.data?.pages || []))
      .catch(() => setPages([]))
      .finally(() => setLoadingPages(false));
  }, [form.share_as, form.account_ids[0]]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.account_ids.length) return setError('Pilih minimal 1 akun');
    const postUrls = form.post_urls.split('\n').map(u => u.trim()).filter(Boolean);
    if (!postUrls.length) return setError('Masukkan minimal 1 URL post sumber');
    if (form.share_as === 'page' && !form.page_name.trim()) return setError('Isi nama Page kalau share sebagai Halaman');

    setLoading(true);
    try {
      const payload = {
        type: 'share_post',
        name: form.name,
        account_ids: form.account_ids,
        config: {
          post_urls: postUrls,
          groups: form.selected_groups,
          message: form.message,
          share_as: form.share_as,
          page_name: form.page_name,
          delay_min: form.delay_min,
          delay_max: form.delay_max,
          max_groups_per_run: form.max_groups_per_run,
        },
        browser_engine: form.browser_engine || 'patchright',
      interval_minutes: form.interval_minutes,
      };
      if (initialTask?.id) await api.put(`/post-tasks/${initialTask.id}`, payload);
      else await api.post('/post-tasks', payload);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal membuat task share');
    } finally { setLoading(false); }
  };

  return (
    <Modal title={initialTask ? 'Edit Task Share ke Grup' : 'Auto Share ke Grup'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrBox msg={error} />}

        <div>
          <label className="label">Nama Task *</label>
          <input className="input" placeholder="Contoh: Share post promo ke 10 grup"
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>

        <div>
          <label className="label">URL Post Sumber * <span className="text-gray-500 font-normal">(1 per baris, dari profil/fanpage Anda)</span></label>
          <textarea className="input min-h-[80px] resize-none text-sm font-mono"
            placeholder={'https://www.facebook.com/{username}/posts/{id}\nhttps://www.facebook.com/{pageId}/posts/{id}'}
            value={form.post_urls}
            onChange={e => setForm(p => ({ ...p, post_urls: e.target.value }))} required />
          <p className="text-gray-500 text-xs mt-1">Boleh banyak post; sistem akan share masing-masing ke grup target.</p>
        </div>

        <div className="border border-purple-800/40 rounded-xl overflow-hidden">
          <div className="bg-purple-900/15 px-4 py-3">
            <p className="text-white text-sm font-medium">Bagikan sebagai</p>
          </div>
          <div className="p-4 bg-gray-900/50 space-y-3">
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${form.share_as === 'self' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'}`}>
                <input type="radio" checked={form.share_as === 'self'} onChange={() => setForm(p => ({ ...p, share_as: 'self' }))} />
                <div>
                  <div className="text-white text-sm font-medium">Profil Pribadi</div>
                  <div className="text-gray-400 text-xs">Share atas nama akun Facebook</div>
                </div>
              </label>
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${form.share_as === 'page' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'}`}>
                <input type="radio" checked={form.share_as === 'page'} onChange={() => setForm(p => ({ ...p, share_as: 'page' }))} />
                <div>
                  <div className="text-white text-sm font-medium">Halaman / Fanpage</div>
                  <div className="text-gray-400 text-xs">Share atas nama Page</div>
                </div>
              </label>
            </div>
            {form.share_as === 'page' && (
              <div>
                <label className="label">Nama Halaman *</label>
                {form.account_ids.length === 0 ? (
                  <p className="text-yellow-400 text-sm bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2">⚠️ Pilih akun dulu untuk memuat daftar Halaman yang dikelola</p>
                ) : loadingPages ? (
                  <p className="text-gray-400 text-sm">⏳ Memuat daftar halaman dari akun...</p>
                ) : pages.length > 0 ? (
                  <>
                    <select className="input" value={form.page_name}
                      onChange={e => setForm(p => ({ ...p, page_name: e.target.value }))}>
                      <option value="">-- Pilih halaman --</option>
                      {pages.map((pg, i) => (
                        <option key={pg.id || i} value={pg.name}>
                          {pg.name}{pg.category ? ` — ${pg.category}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-gray-500 text-xs mt-1">{pages.length} halaman tersedia dari akun ini.</p>
                  </>
                ) : (
                  <>
                    <input className="input" placeholder="Nama persis Halaman seperti di Facebook"
                      value={form.page_name} onChange={e => setForm(p => ({ ...p, page_name: e.target.value }))} />
                    <p className="text-yellow-400 text-xs mt-1">⚠️ Tidak bisa memuat daftar halaman otomatis. Ketik nama persis Halaman seperti di Facebook.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="label">Caption Tambahan <span className="text-gray-500">(opsional)</span></label>
          <textarea className="input min-h-[70px] resize-none text-sm"
            placeholder="Tulis sesuatu untuk dikirim bersama share, mis: '{Cek|Lihat} promo terbaru ya!'"
            value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
          <p className="text-gray-500 text-xs mt-1">Spintax didukung: <code className="text-blue-400">{'{Halo|Hi}'}</code></p>
        </div>

        <div>
          <label className="label">Pilih Akun ({form.account_ids.length}) *</label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-gray-800 rounded-xl p-2">
            {accounts.map(a => (
              <label key={a.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${form.account_ids.includes(a.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'}`}>
                <input type="checkbox" checked={form.account_ids.includes(a.id)} onChange={() => toggleAccount(a.id)} />
                <span className="text-white truncate">{a.name}</span>
              </label>
            ))}
          </div>
        </div>

        <GroupPickerSection
          accounts={accounts.filter(a => form.account_ids.includes(a.id))}
          selectedGroups={form.selected_groups}
          onGroupsChange={groups => setForm(p => ({ ...p, selected_groups: groups }))}
        />
        <p className="text-gray-500 text-xs -mt-2">Kosongkan untuk pakai grup tersimpan otomatis dari sync browser.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label text-xs">Max Grup/Run</label>
            <input type="number" className="input text-center" min={1} max={30}
              value={form.max_groups_per_run}
              onChange={e => setForm(p => ({ ...p, max_groups_per_run: +e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Delay Min (dtk)</label>
            <input type="number" className="input text-center" min={10}
              value={form.delay_min} onChange={e => setForm(p => ({ ...p, delay_min: +e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Delay Max (dtk)</label>
            <input type="number" className="input text-center" min={10}
              value={form.delay_max} onChange={e => setForm(p => ({ ...p, delay_max: +e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Ulang Tiap (menit, 0 = sekali)</label>
            <input type="number" className="input text-center" min={0} max={10080}
              value={form.interval_minutes} onChange={e => setForm(p => ({ ...p, interval_minutes: +e.target.value }))} />
          </div>
        </div>

        <div className="bg-blue-900/15 border border-blue-800/30 rounded-lg p-3 text-xs text-blue-200">
          💡 Share dilakukan via browser headless (klik Bagikan asli di Facebook). Lebih lambat dari API tapi lebih tahan deteksi. Gunakan delay agak panjang antar share.
        </div>

                <div>
            <label className="label">Browser Engine</label>
            <select className="input" value={form.browser_engine || "patchright"} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
              <option value="patchright">Patchright / Chromium (default)</option>
              <option value="obscura">Obscura (ringan, hemat RAM)</option>
            </select>
          </div>

        <ModalActions onClose={onClose} loading={loading} label="Buat Task Share" />
      </form>
    </Modal>
  );
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

function ErrBox({ msg }) {
  return <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{msg}</div>;
}

function AccountSelector({ accounts, selected, toggle }) {
  return (
    <div>
      <label className="label">Pilih Akun ({selected.length} dipilih) *</label>
      {!accounts.length ? <p className="text-gray-500 text-sm">Belum ada akun aktif.</p> : (
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
          {accounts.map(acc => (
            <label key={acc.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${selected.includes(acc.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}>
              <input type="checkbox" checked={selected.includes(acc.id)} onChange={() => toggle(acc.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{acc.name}</p>
                <span className={`badge-${acc.status}`}>{acc.status === 'active' ? 'Aktif' : acc.status === 'checkpoint' ? 'Checkpoint' : 'Invalid'}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalActions({ onClose, loading, label }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
      <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
        <Save size={16} /> {loading ? 'Menyimpan...' : label}
      </button>
    </div>
  );
}

function TaskCard({ task, onStart, onStop, onDelete, onRefresh, onEdit, actionLoading }) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.get(`/post-tasks/${task.id}/logs`);
      setLogs(res.data);
    } finally {
      setLoadingLogs(false);
    }
  };

  const toggleLogs = () => {
    if (!showLogs) fetchLogs();
    setShowLogs(p => !p);
  };

  const tabInfo = TABS.find(t => t.key === task.type);
  const Icon = tabInfo?.icon || ArrowUpCircle;
  const config = task.config || {};

  return (
    <div className="card hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${task.type === 'auto_up' ? 'bg-blue-900/50' : task.type === 'group_post' ? 'bg-purple-900/50' : task.type === 'share_post' ? 'bg-emerald-900/50' : task.type === 'group_listing' ? 'bg-pink-900/50' : task.type === 'smart_post' ? 'bg-cyan-900/50' : 'bg-orange-900/50'}`}>
            <Icon size={18} className={task.type === 'auto_up' ? 'text-blue-400' : task.type === 'group_post' ? 'text-purple-400' : task.type === 'share_post' ? 'text-emerald-400' : task.type === 'group_listing' ? 'text-pink-400' : task.type === 'smart_post' ? 'text-cyan-400' : 'text-orange-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-white font-semibold">{task.name}</h3>
              <StatusBadge status={task.status} />
            </div>
            <div className="flex items-center gap-3 text-gray-400 text-sm flex-wrap">
              <span>{tabInfo?.label}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Users size={12} /> {Array.isArray(task.account_ids) ? task.account_ids.length : 0} akun</span>
              {task.interval_minutes > 0 && (
                <span className="flex items-center gap-1"><Clock size={12} /> Setiap {task.interval_minutes} menit</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="text-green-400">✓ {task.total_success} berhasil</span>
              <span className="text-red-400">✗ {task.total_failed} gagal</span>
              {task.last_run && <span className="text-gray-500">Terakhir: {new Date(task.last_run).toLocaleString('id-ID')}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onRefresh} className="btn-secondary px-2 py-2"><RefreshCw size={14} /></button>
          {onEdit && <button onClick={onEdit} className="btn-secondary px-3 py-2" title="Edit"><Save size={14} /></button>}
          {task.status === 'running' ? (
            <button onClick={onStop} disabled={actionLoading} className="btn-danger px-3 py-2" title="Stop"><Square size={14} /></button>
          ) : (
            <button onClick={onStart} disabled={actionLoading} className="btn-success px-3 py-2" title="Start"><Play size={14} /></button>
          )}
          <button onClick={onDelete} disabled={actionLoading} className="btn-danger px-3 py-2" title="Hapus"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="mt-4 bg-gray-800 rounded-lg p-3 text-sm">
        {task.type === 'auto_up' && (
          <div className="space-y-1 text-gray-400">
            <p><span className="text-gray-300">Teks UP:</span> <code className="text-blue-300">{config.up_text}</code></p>
            <p><span className="text-gray-300">Target:</span> {(config.targets || []).length} postingan</p>
          </div>
        )}
        {task.type === 'group_post' && (
          <div className="space-y-1 text-gray-400">
            <p><span className="text-gray-300">Konten:</span> {(config.post_text || '').slice(0, 80)}{(config.post_text || '').length > 80 ? '...' : ''}</p>
            <p><span className="text-gray-300">Target:</span> {(config.groups || []).length} grup</p>
          </div>
        )}
        {task.type === 'marketplace' && (
          <div className="space-y-1 text-gray-400">
            <p><span className="text-gray-300">Judul:</span> {config.title}</p>
            <p><span className="text-gray-300">Harga:</span> Rp {Number(config.price || 0).toLocaleString('id-ID')}</p>
            <p><span className="text-gray-300">Kategori:</span> {config.category} · {CONDITIONS.find(c => c.value === config.condition)?.label || config.condition}</p>
          </div>
        )}
      </div>

      <button onClick={toggleLogs} className="mt-3 flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors w-full">
        {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showLogs ? 'Sembunyikan Log' : 'Lihat Log'}
        {logs.length > 0 && <span className="text-xs text-gray-500">({logs.length} entri)</span>}
        {loadingLogs && <RefreshCw size={12} className="animate-spin" />}
      </button>

      {showLogs && (
        <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-3">Belum ada log</p>
          ) : logs.map(log => (
            <div key={log.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${log.status === 'success' ? 'bg-green-900/20 border border-green-800/30' : log.status === 'info' ? 'bg-gray-800 border border-gray-700' : 'bg-red-900/20 border border-red-800/30'}`}>
              <div className="flex-shrink-0 mt-0.5">
                {log.status === 'success' ? <CheckCircle size={12} className="text-green-400" /> : log.status === 'info' ? <Clock size={12} className="text-gray-400" /> : <XCircle size={12} className="text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white font-medium">{log.account_name}</span>
                <span className="text-gray-400 mx-1">→</span>
                <span className="text-gray-300 truncate">{log.target?.length > 50 ? log.target.slice(0, 50) + '...' : log.target}</span>
                {log.error_message && <p className="text-red-400 mt-0.5">{log.error_message}</p>}
                <p className="text-gray-500 mt-0.5">{new Date(log.created_at).toLocaleString('id-ID')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SmartPostModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState({
    name: '', account_ids: [], group_source: 'stored', groups: '', selected_groups: [],
    post_text: '', title: '', description: '', price: '', category: '', condition: 'used_good', images: '',
    listing_type: 'item', max_groups_per_run: 5, delay_min: 30, delay_max: 90, interval_minutes: 360,
    browser_engine: 'patchright',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [myGroups, setMyGroups] = useState({ groups: [], grouped: {} });

  useEffect(() => {
    api.get('/niche/my-groups').then(r => setMyGroups(r.data)).catch(() => {});
  }, []);

  const toggleAccount = (id) => setForm(p => ({ ...p, account_ids: p.account_ids.includes(id) ? p.account_ids.filter(x => x !== id) : [...p.account_ids, id] }));
  const toggleGroup = (url) => setForm(p => ({ ...p, selected_groups: p.selected_groups.includes(url) ? p.selected_groups.filter(u => u !== url) : [...p.selected_groups, url] }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!form.name) return setError('Nama task wajib');
    if (form.account_ids.length === 0) return setError('Pilih minimal 1 akun');
    if (!form.post_text && !form.title) return setError('Isi minimal: Teks Post atau Judul Listing');
    setSaving(true);
    try {
      let groups = [];
      if (form.group_source === 'manual') groups = form.groups.split('\n').map(s => s.trim()).filter(Boolean);
      else if (form.group_source === 'pick') groups = form.selected_groups;
      // 'stored' = kosong, backend ambil otomatis

      const images = form.images.split('\n').map(s => s.trim()).filter(Boolean);
      await api.post('/post-tasks', {
        type: 'smart_post', name: form.name, account_ids: form.account_ids,
        interval_minutes: Number(form.interval_minutes) || 360,
        config: {
          groups, post_text: form.post_text, title: form.title, description: form.description || form.post_text,
          price: Number(form.price) || 0, category: form.category, condition: form.condition,
          images, listing_type: form.listing_type,
          max_groups_per_run: Number(form.max_groups_per_run) || 5,
          delay_min: Number(form.delay_min) || 30, delay_max: Number(form.delay_max) || 90,
        },
      });
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal'); }
    finally { setSaving(false); }
  };

  const joinedGroups = myGroups.groups?.filter(g => g.join_status === 'joined') || [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Zap size={16} className="text-cyan-400" /> Smart Post (Auto Detect Grup)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

          <div className="bg-cyan-900/20 border border-cyan-800/30 rounded-xl p-3 text-xs text-cyan-300">
            <p className="font-semibold mb-1">⚡ Cara kerja Smart Post:</p>
            <p>Sistem buka tiap grup → detect otomatis:</p>
            <p>• Ada tombol "Sell Something"? → Posting sebagai <strong>Listing</strong> (judul, harga, foto)</p>
            <p>• Tidak ada? → Posting sebagai <strong>Post biasa</strong> (teks)</p>
            <p>Isi kedua form di bawah supaya sistem bisa handle dua-duanya.</p>
          </div>

          <div><label className="label">Nama Task</label><input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Mis. Promo Sepatu All Grup" /></div>

          <div>
            <label className="label">Akun Facebook</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
              {accounts.map(a => (
                <label key={a.id} className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${form.account_ids.includes(a.id) ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40' : 'bg-gray-800 border border-gray-700 text-gray-400'}`}>
                  <input type="checkbox" checked={form.account_ids.includes(a.id)} onChange={() => toggleAccount(a.id)} />{a.name}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <label className="text-cyan-200 text-sm font-semibold block mb-2">Sumber Grup Target</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, group_source: 'stored' }))} className={`p-2 rounded-lg border text-xs text-center ${form.group_source === 'stored' ? 'border-cyan-500 bg-cyan-900/20 text-cyan-200' : 'border-gray-700 text-gray-400'}`}>
                🔄 Otomatis<br/><span className="text-[10px]">Stored groups</span>
              </button>
              <button type="button" onClick={() => setForm(p => ({ ...p, group_source: 'pick' }))} className={`p-2 rounded-lg border text-xs text-center ${form.group_source === 'pick' ? 'border-cyan-500 bg-cyan-900/20 text-cyan-200' : 'border-gray-700 text-gray-400'}`}>
                ✅ Pilih Grup<br/><span className="text-[10px]">Dari Grup Saya</span>
              </button>
              <button type="button" onClick={() => setForm(p => ({ ...p, group_source: 'manual' }))} className={`p-2 rounded-lg border text-xs text-center ${form.group_source === 'manual' ? 'border-cyan-500 bg-cyan-900/20 text-cyan-200' : 'border-gray-700 text-gray-400'}`}>
                ✏️ Manual<br/><span className="text-[10px]">Paste URL</span>
              </button>
            </div>
            {form.group_source === 'pick' && (
              <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                {joinedGroups.length === 0 ? <p className="text-gray-500 text-xs">Belum ada grup yang sudah di-join. Jalankan Auto Join dulu.</p> : (
                  Object.entries(myGroups.grouped || {}).map(([kw, groups]) => (
                    <div key={kw}>
                      <p className="text-indigo-300 text-[10px] font-semibold mt-1">{kw}</p>
                      {groups.filter(g => g.join_status === 'joined').map((g, i) => (
                        <label key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${form.selected_groups.includes(g.url) ? 'bg-cyan-500/15 text-cyan-200' : 'text-gray-400 hover:text-white'}`}>
                          <input type="checkbox" checked={form.selected_groups.includes(g.url)} onChange={() => toggleGroup(g.url)} />
                          <span className="truncate">{g.name || g.group_id}</span>
                        </label>
                      ))}
                    </div>
                  ))
                )}
                {form.selected_groups.length > 0 && <p className="text-cyan-300 text-[10px] mt-1">{form.selected_groups.length} grup dipilih</p>}
              </div>
            )}
            {form.group_source === 'manual' && <textarea className="input mt-2 min-h-[80px] font-mono text-xs" value={form.groups} onChange={e => setForm(p => ({ ...p, groups: e.target.value }))} placeholder="1 URL grup per baris" />}
            {form.group_source === 'stored' && <p className="text-gray-500 text-[10px] mt-1">Sistem otomatis ambil dari stored groups akun (Discovery + Auto Join).</p>}
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-white text-sm font-semibold mb-2">📝 Untuk Grup Diskusi (Post Biasa)</p>
            <textarea className="input min-h-[80px]" value={form.post_text} onChange={e => setForm(p => ({ ...p, post_text: e.target.value }))} placeholder="Teks post untuk grup diskusi. Support {spintax|variasi}." />
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-white text-sm font-semibold mb-2">🏷️ Untuk Grup Jual-Beli (Listing)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2"><label className="label">Judul Listing</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Sepatu {Lokal|Branded} Murah" /></div>
              <div><label className="label">Harga (IDR)</label><input className="input" type="number" min={0} value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} /></div>
              <div><label className="label">Kondisi</label>
                <select className="input" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
                  <option value="new">Baru</option><option value="used_like_new">Seperti Baru</option><option value="used_good">Kondisi Baik</option><option value="used_fair">Kondisi Cukup</option>
                </select>
              </div>
            </div>
            <div className="mt-2"><label className="label">URL Foto (1 per baris)</label><textarea className="input min-h-[60px] font-mono text-xs" value={form.images} onChange={e => setForm(p => ({ ...p, images: e.target.value }))} placeholder="https://example.com/foto1.jpg" /></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label">Max Grup/Run</label><input className="input" type="number" min={1} max={20} value={form.max_groups_per_run} onChange={e => setForm(p => ({ ...p, max_groups_per_run: e.target.value }))} /></div>
            <div><label className="label">Delay Min (s)</label><input className="input" type="number" min={10} value={form.delay_min} onChange={e => setForm(p => ({ ...p, delay_min: e.target.value }))} /></div>
            <div><label className="label">Delay Max (s)</label><input className="input" type="number" min={30} value={form.delay_max} onChange={e => setForm(p => ({ ...p, delay_max: e.target.value }))} /></div>
            <div>              <div className="mb-3">
                <label className="block text-xs text-gray-400 mb-1">Browser Engine</label>
                <select className="input" value={form.browser_engine || 'patchright'} onChange={e => setForm(p => ({...p, browser_engine: e.target.value}))}>
                  <option value="patchright">Patchright (default, paling kompatibel)</option>
                  <option value="obscura">Obscura (ringan, hemat RAM)</option>
                </select>
              </div>
<label className="label">Interval (menit)</label><input className="input" type="number" min={30} value={form.interval_minutes} onChange={e => setForm(p => ({ ...p, interval_minutes: e.target.value }))} /></div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center"><Save size={14} /> {saving ? 'Menyimpan...' : 'Buat Smart Post'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GroupListingModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState({
    name: '',
    account_ids: [],
    groups: '',
    use_stored_groups: true,
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used_good',
    images: '',
    listing_type: 'item',
    max_groups_per_run: 3,
    delay_min: 60,
    delay_max: 180,
    interval_minutes: 720,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleAccount = (id) => {
    setForm(p => ({ ...p, account_ids: p.account_ids.includes(id) ? p.account_ids.filter(x => x !== id) : [...p.account_ids, id] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name) return setError('Nama task wajib');
    if (form.account_ids.length === 0) return setError('Pilih minimal 1 akun');
    if (!form.title) return setError('Judul listing wajib');
    if (form.price === '' || isNaN(Number(form.price))) return setError('Harga harus angka');
    setSaving(true);
    try {
      const groups = form.use_stored_groups ? [] : form.groups.split('\n').map(s => s.trim()).filter(Boolean);
      const images = form.images.split('\n').map(s => s.trim()).filter(Boolean);
      await api.post('/post-tasks', {
        type: 'group_listing',
        name: form.name,
        account_ids: form.account_ids,
        interval_minutes: Number(form.interval_minutes) || 720,
        config: {
          groups,
          title: form.title,
          description: form.description,
          price: Number(form.price),
          category: form.category,
          condition: form.condition,
          images,
          listing_type: form.listing_type,
          max_groups_per_run: Number(form.max_groups_per_run) || 3,
          delay_min: Number(form.delay_min) || 60,
          delay_max: Number(form.delay_max) || 180,
        },
      });
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Tag size={16} className="text-pink-400" /> Buat Auto Jual di Grup</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

          <div>
            <label className="label">Nama Task</label>
            <input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Mis. Jual Sepatu Bandung" />
          </div>

          <div>
            <label className="label">Akun Facebook</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
              {accounts.length === 0 ? (
                <p className="text-gray-500 text-sm col-span-2">Tidak ada akun aktif</p>
              ) : accounts.map(a => (
                <label key={a.id} className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer ${form.account_ids.includes(a.id) ? 'bg-pink-500/15 text-pink-200 border border-pink-500/40' : 'bg-gray-800 border border-gray-700 text-gray-400'}`}>
                  <input type="checkbox" checked={form.account_ids.includes(a.id)} onChange={() => toggleAccount(a.id)} />
                  <span className="truncate">{a.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)' }}>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-pink-200">
              <input type="checkbox" checked={form.use_stored_groups} onChange={e => setForm(p => ({ ...p, use_stored_groups: e.target.checked }))} />
              Pakai stored groups (daftar grup dari Auto Discovery / Niche)
            </label>
            {!form.use_stored_groups && (
              <textarea className="input mt-2 min-h-[100px] font-mono text-xs" value={form.groups} onChange={e => setForm(p => ({ ...p, groups: e.target.value }))} placeholder="https://www.facebook.com/groups/.../\n1 URL per baris" />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="label">Judul Listing</label>
              <input className="input" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Mis. Sepatu {Lokal|Branded} Murah" />
              <p className="text-gray-500 text-xs mt-1">Mendukung spintax {'{ a | b | c }'}.</p>
            </div>
            <div>
              <label className="label">Harga (IDR)</label>
              <input className="input" type="number" min={0} required value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipe Listing</label>
              <select className="input" value={form.listing_type} onChange={e => setForm(p => ({ ...p, listing_type: e.target.value }))}>
                <option value="item">Barang Dijual</option>
                <option value="vehicle">Kendaraan Dijual</option>
                <option value="home">Rumah Dijual / Disewa</option>
              </select>
            </div>
            <div>
              <label className="label">Kondisi</label>
              <select className="input" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
                <option value="new">Baru</option>
                <option value="used_like_new">Bekas - Seperti Baru</option>
                <option value="used_good">Bekas - Kondisi Baik</option>
                <option value="used_fair">Bekas - Kondisi Cukup</option>
              </select>
            </div>
            <div>
              <label className="label">Kategori (opsional)</label>
              <input className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Mis. Pakaian" />
            </div>
          </div>

          <div>
            <label className="label">Deskripsi</label>
            <textarea className="input min-h-[100px]" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Mis. {Sepatu|Kicks} {kondisi mulus|seperti baru} ukuran 42, COD area Bandung." />
          </div>

          <div>
            <label className="label">URL Foto (1 per baris, max 10)</label>
            <textarea className="input min-h-[80px] font-mono text-xs" value={form.images} onChange={e => setForm(p => ({ ...p, images: e.target.value }))} placeholder="https://example.com/foto1.jpg\nhttps://example.com/foto2.jpg" />
            <p className="text-gray-500 text-xs mt-1">Foto akan diunduh dari URL lalu di-upload ke Facebook lewat browser. Kosongkan kalau tidak perlu foto.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Max Grup / Run</label>
              <input className="input" type="number" min={1} max={10} value={form.max_groups_per_run} onChange={e => setForm(p => ({ ...p, max_groups_per_run: e.target.value }))} />
            </div>
            <div>
              <label className="label">Delay Min (detik)</label>
              <input className="input" type="number" min={30} value={form.delay_min} onChange={e => setForm(p => ({ ...p, delay_min: e.target.value }))} />
            </div>
            <div>
              <label className="label">Delay Max (detik)</label>
              <input className="input" type="number" min={60} value={form.delay_max} onChange={e => setForm(p => ({ ...p, delay_max: e.target.value }))} />
            </div>
            <div>
              <label className="label">Interval Cycle (menit)</label>
              <input className="input" type="number" min={30} value={form.interval_minutes} onChange={e => setForm(p => ({ ...p, interval_minutes: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              <Save size={14} /> {saving ? 'Menyimpan...' : 'Buat Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PostToolsPage() {
  const [activeTab, setActiveTab] = useState('auto_up');
  const [tasks, setTasks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [taskRes, accRes] = await Promise.all([
        api.get(`/post-tasks?type=${activeTab}`),
        api.get('/accounts'),
      ]);
      setTasks(taskRes.data);
      setAccounts(accRes.data);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (tasks.some(t => t.status === 'running')) fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [tasks, fetchData]);

  const handleStart = async id => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await api.post(`/post-tasks/${id}/start`);
      setTimeout(fetchData, 1000);
    } catch (err) { alert(err.response?.data?.error || 'Gagal memulai'); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const handleStop = async id => {
    setActionLoading(p => ({ ...p, [id]: true }));
    try {
      await api.post(`/post-tasks/${id}/stop`);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Gagal menghentikan'); }
    finally { setActionLoading(p => ({ ...p, [id]: false })); }
  };

  const handleDelete = async id => {
    if (!confirm('Hapus task ini? Jika sedang berjalan, akan dihentikan dulu.')) return;
    try {
      // Stop dulu kalau running
      try { await api.post(`/post-tasks/${id}/stop`); } catch {}
      await api.delete(`/post-tasks/${id}`);
      setTasks(p => p.filter(t => t.id !== id));
    } catch (err) { alert(err.response?.data?.error || 'Gagal menghapus'); }
  };

  const currentTab = TABS.find(t => t.key === activeTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Post & UP Tools</h1>
        <p className="text-gray-400 mt-1">Auto UP postingan, posting ke grup, dan iklan Marketplace</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 ${isActive ? `border-${tab.color}-500 bg-${tab.color}-900/20` : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? `bg-${tab.color}-600` : 'bg-gray-800'}`}>
                  <Icon size={16} className="text-white" />
                </div>
                <span className={`font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>{tab.label}</span>
              </div>
              <p className="text-gray-400 text-xs">{tab.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{currentTab?.label}</h2>
          <p className="text-gray-400 text-sm">{tasks.length} task · {tasks.filter(t => t.status === 'running').length} berjalan</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Buat Task Baru
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-14">
          {React.createElement(currentTab?.icon || ArrowUpCircle, { size: 48, className: 'text-gray-600 mx-auto mb-4' })}
          <h3 className="text-xl font-semibold text-white mb-2">Belum Ada Task</h3>
          <p className="text-gray-400 mb-6">{currentTab?.desc}</p>
          <button className="btn-primary mx-auto" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Buat Task Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStart={() => handleStart(task.id)}
              onStop={() => handleStop(task.id)}
              onDelete={() => handleDelete(task.id)}
              onEdit={task.type === 'share_post' ? () => setEditingTask(task) : null}
              onRefresh={fetchData}
              actionLoading={actionLoading[task.id]}
            />
          ))}
        </div>
      )}

      {showModal && activeTab === 'auto_up' && <AutoUPModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
      {showModal && activeTab === 'group_post' && <GroupPostModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
      {showModal && activeTab === 'share_post' && <ShareModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
      {showModal && activeTab === 'group_listing' && <GroupListingModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
      {showModal && activeTab === 'smart_post' && <SmartPostModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
      {showModal && activeTab === 'marketplace' && <MarketplaceModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
      {editingTask?.type === 'share_post' && <ShareModal initialTask={editingTask} onClose={() => setEditingTask(null)} onSave={() => { setEditingTask(null); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />}
    </div>
  );
}
