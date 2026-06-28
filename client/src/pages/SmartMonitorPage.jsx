import React, { useState, useEffect, useCallback } from 'react';
import { Search, MessageSquareReply, Plus, Play, Square, Trash2, X, Save, RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../utils/api';
import AIGenerateModal from '../components/AIGenerateModal';

const AIBtn = ({ type, onInsert }) => {
  const [show, setShow] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setShow(true)}
        style={{ background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.4)', borderRadius:6, padding:'2px 8px', color:'#c084fc', cursor:'pointer', fontSize:'0.72rem', marginLeft:8, verticalAlign:'middle' }}>
        ✨ AI
      </button>
      {show && <AIGenerateModal defaultType={type} onInsert={txt => { onInsert(txt); setShow(false); }} onClose={() => setShow(false)} />}
    </>
  );
};

function StatusBadge({ status }) {
  const map = { running: 'badge-running', idle: 'badge-idle', stopped: 'badge-stopped' };
  const labels = { running: '● Aktif', idle: '○ Idle', stopped: '■ Berhenti' };
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

function ErrBox({ msg }) { return <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{msg}</div>; }

function LogList({ logs }) {
  if (!logs.length) return <p className="text-gray-500 text-sm text-center py-3">Belum ada log</p>;
  return (
    <div className="space-y-1.5 max-h-52 overflow-y-auto">
      {logs.map(log => (
        <div key={log.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${log.status === 'success' ? 'bg-green-900/20 border border-green-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
          <div className="flex-shrink-0 mt-0.5">{log.status === 'success' ? <CheckCircle size={12} className="text-green-400" /> : <XCircle size={12} className="text-red-400" />}</div>
          <div className="flex-1 min-w-0">
            {log.matched_keyword && <span className="text-yellow-300 font-medium">🎯 "{log.matched_keyword}"</span>}
            {log.commenter_name && <span className="text-blue-300 font-medium">💬 {log.commenter_name}</span>}
            <span className="text-gray-400 mx-1">→</span>
            <span className="text-gray-300">{(log.comment_sent || log.reply_sent || '').slice(0, 60)}</span>
            {log.status !== 'success' && <p className="text-red-400 mt-0.5">Gagal - cek cookies akun</p>}
            <p className="text-gray-500 mt-0.5">{new Date(log.created_at).toLocaleString('id-ID')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function KeywordMonitorCard({ item, accounts, onStart, onStop, onDelete, onRefresh }) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const fetchLogs = async () => {
    const r = await api.get(`/keyword-monitors/${item.id}/logs`);
    setLogs(r.data);
  };
  const toggleLogs = () => { if (!showLogs) fetchLogs(); setShowLogs(p => !p); };

  return (
    <div className="card hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-yellow-900/40 rounded-xl flex items-center justify-center flex-shrink-0"><Search size={18} className="text-yellow-400" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-white font-semibold">{item.name}</h3>
              <StatusBadge status={item.status} />
            </div>
            <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
              <span>{item.group_urls.length} grup</span>
              <span>·</span>
              <span>{item.keywords.length} keyword</span>
              <span>·</span>
              <span>Cek tiap {item.check_interval} menit</span>
            </div>
            <div className="flex gap-2 flex-wrap mt-1">
              {item.keywords.slice(0, 5).map(kw => <span key={kw} className="bg-yellow-900/30 text-yellow-300 text-xs px-2 py-0.5 rounded-full">"{kw}"</span>)}
              {item.keywords.length > 5 && <span className="text-gray-500 text-xs">+{item.keywords.length - 5} lainnya</span>}
            </div>
            <div className="mt-1 text-xs text-green-400">🎯 {item.total_triggered} komentar terkirim</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onRefresh} className="btn-secondary px-2 py-2"><RefreshCw size={14} /></button>
          {item.status === 'running' ? <button onClick={onStop} className="btn-danger px-3 py-2"><Square size={14} /></button> : <button onClick={onStart} className="btn-success px-3 py-2"><Play size={14} /></button>}
          <button onClick={onDelete} className="btn-danger px-3 py-2"><Trash2 size={14} /></button>
        </div>
      </div>
      <button onClick={toggleLogs} className="mt-3 flex items-center gap-2 text-gray-400 hover:text-white text-sm">
        {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showLogs ? 'Sembunyikan Log' : 'Lihat Log'}
      </button>
      {showLogs && <div className="mt-2"><LogList logs={logs} /></div>}
    </div>
  );
}

function AutoReplyCard({ item, accounts, onStart, onStop, onDelete, onRefresh }) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const fetchLogs = async () => { const r = await api.get(`/auto-replies/${item.id}/logs`); setLogs(r.data); };
  const toggleLogs = () => { if (!showLogs) fetchLogs(); setShowLogs(p => !p); };
  const isPageMode = item.reply_mode === 'as_page';

  return (
    <div className="card hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPageMode ? 'bg-purple-900/40' : 'bg-blue-900/40'}`}>
            <MessageSquareReply size={18} className={isPageMode ? 'text-purple-400' : 'text-blue-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-white font-semibold">{item.name}</h3>
              <StatusBadge status={item.status} />
              {isPageMode && <span className="bg-purple-900/40 text-purple-300 text-xs px-2 py-0.5 rounded-full">🏢 Halaman</span>}
            </div>
            <div className="flex gap-3 text-xs text-gray-400 flex-wrap">
              <span>{item.post_urls.length} postingan</span>
              <span>·</span>
              <span>Cek tiap {item.check_interval} menit</span>
              <span>·</span>
              {isPageMode
                ? <span className="text-purple-300">📄 {item.page_name || item.page_id} <span className="text-gray-500">(via {item.reply_account_name})</span></span>
                : <span>👤 {item.reply_account_name || '-'}</span>
              }
            </div>
            <div className="flex gap-2 flex-wrap mt-1">
              {item.keywords.slice(0, 5).map(kw => <span key={kw} className="bg-blue-900/30 text-blue-300 text-xs px-2 py-0.5 rounded-full">"{kw}"</span>)}
            </div>
            <div className="mt-1 text-xs text-green-400">💬 {item.total_replied} balasan terkirim</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onRefresh} className="btn-secondary px-2 py-2"><RefreshCw size={14} /></button>
          {item.status === 'running' ? <button onClick={onStop} className="btn-danger px-3 py-2"><Square size={14} /></button> : <button onClick={onStart} className="btn-success px-3 py-2"><Play size={14} /></button>}
          <button onClick={onDelete} className="btn-danger px-3 py-2"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="mt-3 bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300">
        <span className="text-gray-400">Template:</span> {item.reply_template.slice(0, 100)}{item.reply_template.length > 100 ? '...' : ''}
      </div>
      <button onClick={toggleLogs} className="mt-3 flex items-center gap-2 text-gray-400 hover:text-white text-sm">
        {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showLogs ? 'Sembunyikan Log' : 'Lihat Log'}
      </button>
      {showLogs && <div className="mt-2"><LogList logs={logs} /></div>}
    </div>
  );
}

function NewKeywordMonitorModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState({ name: '', group_urls: '', keywords: '', comment_template: '{Halo|Hi|Hey}, {produk kami tersedia|kami punya stok}! WA: 0812xxx', delay_min: 10, delay_max: 30, check_interval: 15, max_comments_per_run: 5, account_ids: [], browser_engine: 'patchright' });
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const toggle = id => setForm(p => ({ ...p, account_ids: p.account_ids.includes(id) ? p.account_ids.filter(a => a !== id) : [...p.account_ids, id] }));
  const submit = async e => {
    e.preventDefault();
    if (!form.account_ids.length) return setError('Pilih minimal 1 akun');
    const group_urls = form.group_urls.split('\n').map(u => u.trim()).filter(Boolean);
    const keywords = form.keywords.split('\n').map(k => k.trim()).filter(Boolean);
    if (!group_urls.length) return setError('Masukkan minimal 1 URL grup');
    if (!keywords.length) return setError('Masukkan minimal 1 keyword');
    setLoading(true); setError('');
    try {
      await api.post('/keyword-monitors', { ...form, group_urls, keywords, browser_engine: form.browser_engine || 'patchright' });
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal'); } finally { setLoading(false); }
  };
  return (
    <Modal title="Buat Keyword Monitor" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrBox msg={error} />}
        <div><label className="label">Nama Monitor *</label><input className="input" placeholder="Contoh: Monitor Pembeli Motor" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
        <div><label className="label">URL Grup yang Dipantau (1 per baris) *</label><textarea className="input min-h-[80px] resize-none text-sm" placeholder="https://www.facebook.com/groups/jualbeli&#10;https://www.facebook.com/groups/motorbekas" value={form.group_urls} onChange={e => setForm(p => ({ ...p, group_urls: e.target.value }))} /></div>
        <div><label className="label">Keyword Trigger (1 per baris) *</label><textarea className="input min-h-[80px] resize-none text-sm" placeholder="mau beli motor&#10;cari motor bekas&#10;WTB motor&#10;butuh motor&#10;cari yamaha" value={form.keywords} onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))} />
          <p className="text-gray-500 text-xs mt-1">Sistem akan komentar otomatis ketika ada postingan yang mengandung keyword ini</p></div>
        <div>
          <label className="label">Template Komentar * (spintax didukung)<AIBtn type="comment" onInsert={txt => setForm(p => ({ ...p, comment_template: txt }))} /></label>
          <textarea className="input min-h-[80px] resize-none text-sm" value={form.comment_template} onChange={e => setForm(p => ({ ...p, comment_template: e.target.value }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label text-xs">Cek Tiap (menit)</label><input type="number" className="input text-sm text-center" min={5} value={form.check_interval} onChange={e => setForm(p => ({ ...p, check_interval: +e.target.value }))} /></div>
          <div><label className="label text-xs">Max Komentar/Run</label><input type="number" className="input text-sm text-center" min={1} max={20} value={form.max_comments_per_run} onChange={e => setForm(p => ({ ...p, max_comments_per_run: +e.target.value }))} /></div>
          <div><label className="label text-xs">Delay (dtk)</label><input type="number" className="input text-sm text-center" min={5} value={form.delay_min} onChange={e => setForm(p => ({ ...p, delay_min: +e.target.value }))} /></div>
        </div>
        <div><label className="label">Pilih Akun ({form.account_ids.length} dipilih) *</label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {accounts.map(a => <label key={a.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${form.account_ids.includes(a.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'}`}><input type="checkbox" checked={form.account_ids.includes(a.id)} onChange={() => toggle(a.id)} /><span className="text-white truncate">{a.name}</span></label>)}
          </div>
        </div>
                <div>
          <label className="label text-xs">Browser Engine</label>
          <select className="input" value={form.browser_engine || "patchright"} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
            <option value="patchright">Patchright / Chromium (default)</option>
            <option value="obscura">Obscura (ringan, hemat RAM)</option>
          </select>
        </div>
        <div className="flex gap-3"><button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button><button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}><Save size={15} />{loading ? 'Menyimpan...' : 'Buat Monitor'}</button></div>
      </form>
    </Modal>
  );
}

function NewAutoReplyModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState({ name: '', post_urls: '', keywords: '', reply_template: '', reply_account_id: '', check_interval: 30, max_replies_per_run: 10, reply_mode: 'personal', page_id: '', page_name: '', browser_engine: 'patchright' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pages, setPages] = useState([]);
  const [fetchingPages, setFetchingPages] = useState(false);

  const fetchPages = async () => {
    if (!form.reply_account_id) return setError('Pilih akun terlebih dahulu');
    setFetchingPages(true); setError(''); setPages([]);
    try {
      const r = await api.get(`/accounts/${form.reply_account_id}/pages`);
      if (r.data.pages?.length === 0) setError('Tidak ada halaman yang ditemukan. Masukkan Page ID secara manual.');
      else setPages(r.data.pages || []);
    } catch (err) { setError('Gagal ambil halaman: ' + (err.response?.data?.error || err.message)); }
    finally { setFetchingPages(false); }
  };

  const selectPage = (page) => {
    setForm(p => ({ ...p, page_id: page.id, page_name: page.name }));
  };

  const submit = async e => {
    e.preventDefault();
    const post_urls = form.post_urls.split('\n').map(u => u.trim()).filter(Boolean);
    const keywords = form.keywords.split('\n').map(k => k.trim()).filter(Boolean);
    if (!post_urls.length) return setError('Masukkan minimal 1 URL postingan');
    if (!keywords.length) return setError('Masukkan minimal 1 keyword');
    if (!form.reply_account_id) return setError('Pilih akun untuk membalas');
    if (form.reply_mode === 'as_page' && !form.page_id) return setError('Masukkan Page ID untuk mode halaman');
    setLoading(true); setError('');
    try {
      await api.post('/auto-replies', { ...form, post_urls, keywords });
      onSave();
    } catch (err) { setError(err.response?.data?.error || 'Gagal'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Buat Auto-Reply Monitor" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrBox msg={error} />}

        <div><label className="label">Nama Monitor *</label>
          <input className="input" placeholder="Contoh: Reply Pertanyaan Harga" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>

        <div><label className="label">URL Postingan yang Dipantau (1 per baris) *</label>
          <textarea className="input min-h-[80px] resize-none text-sm" placeholder="https://www.facebook.com/groups/xxx/posts/yyy&#10;https://www.facebook.com/permalink.php?story_fbid=..." value={form.post_urls} onChange={e => setForm(p => ({ ...p, post_urls: e.target.value }))} />
        </div>

        <div><label className="label">Keyword yang Memicu Reply (1 per baris) *</label>
          <textarea className="input min-h-[70px] resize-none text-sm" placeholder="harga?&#10;wa nya&#10;masih ada&#10;berapa&#10;stok" value={form.keywords} onChange={e => setForm(p => ({ ...p, keywords: e.target.value }))} />
        </div>

        <div>
          <label className="label">Template Balasan * (spintax didukung)<AIBtn type="reply" onInsert={txt => setForm(p => ({ ...p, reply_template: txt }))} /></label>
          <textarea className="input min-h-[90px] resize-none text-sm" placeholder="Halo kak! {Masih ada|Stok tersedia}. WA kami: 0812xxx. {Silakan hubungi kami|Bisa chat langsung} ya!" value={form.reply_template} onChange={e => setForm(p => ({ ...p, reply_template: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="label text-xs">Cek Tiap (menit)</label><input type="number" className="input text-sm" min={5} value={form.check_interval} onChange={e => setForm(p => ({ ...p, check_interval: +e.target.value }))} /></div>
          <div><label className="label text-xs">Max Reply/Run</label><input type="number" className="input text-sm" min={1} max={50} value={form.max_replies_per_run} onChange={e => setForm(p => ({ ...p, max_replies_per_run: +e.target.value }))} /></div>
        </div>

        <div>
          <label className="label">Akun Admin yang Digunakan *</label>
          <select className="input" value={form.reply_account_id} onChange={e => { setForm(p => ({ ...p, reply_account_id: e.target.value, page_id: '', page_name: '' })); setPages([]); }} required>
            <option value="">-- Pilih akun Facebook --</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <label className="label text-sm mb-0">Balas Sebagai</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ val: 'personal', label: '👤 Profil Pribadi', desc: 'Reply atas nama akun personal' },
              { val: 'as_page', label: '🏢 Admin Halaman', desc: 'Reply atas nama fanpage/halaman' }].map(opt => (
              <button key={opt.val} type="button" onClick={() => setForm(p => ({ ...p, reply_mode: opt.val, page_id: '', page_name: '' }))}
                className={`text-left p-3 rounded-xl border transition-all ${form.reply_mode === opt.val ? (opt.val === 'as_page' ? 'border-purple-500 bg-purple-900/20' : 'border-blue-500 bg-blue-900/20') : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}>
                <p className={`font-medium text-sm ${form.reply_mode === opt.val ? (opt.val === 'as_page' ? 'text-purple-300' : 'text-blue-300') : 'text-gray-300'}`}>{opt.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>

          {form.reply_mode === 'as_page' && (
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <button type="button" onClick={fetchPages} disabled={fetchingPages || !form.reply_account_id}
                  className="btn-secondary text-sm px-3 py-2 flex-shrink-0">
                  {fetchingPages ? '⏳ Mengambil...' : '🔍 Ambil Halaman Saya'}
                </button>
                {pages.length > 0 && <span className="text-green-400 text-sm self-center">{pages.length} halaman ditemukan</span>}
              </div>

              {pages.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {pages.map(page => (
                    <button key={page.id} type="button" onClick={() => selectPage(page)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${form.page_id === page.id ? 'border-purple-500 bg-purple-900/20 text-purple-300' : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600'}`}>
                      <span className="font-medium">{page.name}</span>
                      <span className="text-gray-500 ml-2 text-xs">ID: {page.id}</span>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="label text-xs">Page ID (manual jika tidak terdeteksi otomatis)</label>
                <input className="input text-sm" placeholder="Contoh: 123456789012345" value={form.page_id} onChange={e => setForm(p => ({ ...p, page_id: e.target.value, page_name: form.page_name || e.target.value }))} />
                {form.page_id && <p className="text-xs text-gray-500 mt-1">Page ID yang akan digunakan: <span className="text-purple-300">{form.page_id}</span></p>}
              </div>

              <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg p-3 text-xs text-purple-200/80">
                <p className="font-semibold text-purple-300 mb-1">ℹ️ Cara kerja Balas sebagai Halaman:</p>
                <p>• Akun yang dipilih harus menjadi <strong>Admin/Editor</strong> halaman tersebut</p>
                <p>• Balasan akan muncul atas nama halaman, bukan akun pribadi</p>
                <p>• Cocok untuk customer service otomatis di postingan fanpage</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
                  <div>
          <label className="label text-xs">Browser Engine</label>
          <select className="input" value={form.browser_engine || "patchright"} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
            <option value="patchright">Patchright / Chromium (default)</option>
            <option value="obscura">Obscura (ringan, hemat RAM)</option>
          </select>
        </div>
        <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
            <Save size={15} />{loading ? 'Menyimpan...' : 'Buat Auto-Reply'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const TABS = [
  { key: 'keyword', label: 'Keyword Monitor', icon: Search, desc: 'Pantau postingan baru dan komentar otomatis' },
  { key: 'autoreply', label: 'Auto-Reply', icon: MessageSquareReply, desc: 'Balas komentar di postingan Anda secara otomatis' },
];

export default function SmartMonitorPage() {
  const [tab, setTab] = useState('keyword');
  const [monitors, setMonitors] = useState([]);
  const [replies, setReplies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [m, r, a] = await Promise.all([api.get('/keyword-monitors'), api.get('/auto-replies'), api.get('/accounts')]);
      setMonitors(m.data); setReplies(r.data); setAccounts(a.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(() => {
      const any = tab === 'keyword' ? monitors.some(m => m.status === 'running') : replies.some(r => r.status === 'running');
      if (any) fetchData();
    }, 6000);
    return () => clearInterval(iv);
  }, [monitors, replies, tab, fetchData]);

  const action = async (endpoint, id, verb) => {
    await api.post(`${endpoint}/${id}/${verb}`).catch(() => {});
    setTimeout(fetchData, 800);
  };
  const del = async (endpoint, id, setter) => {
    if (!confirm('Hapus item ini?')) return;
    await api.delete(`${endpoint}/${id}`);
    setter(p => p.filter(i => i.id !== id));
  };

  const activeAccounts = accounts.filter(a => a.status === 'active');

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Smart Monitor</h1><p className="text-gray-400 mt-1">Pantau postingan dan balas komentar secara otomatis & real-time</p></div>
      <div className="grid grid-cols-2 gap-3">
        {TABS.map(t => { const Icon = t.icon; const isActive = tab === t.key; return (
          <button key={t.key} onClick={() => setTab(t.key)} className={`text-left p-4 rounded-xl border transition-all ${isActive ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-700 bg-gray-900 hover:border-gray-600'}`}>
            <div className="flex items-center gap-3 mb-1"><Icon size={18} className={isActive ? 'text-yellow-400' : 'text-gray-400'} /><span className={`font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>{t.label}</span></div>
            <p className="text-gray-500 text-xs">{t.desc}</p>
          </button>
        ); })}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">{tab === 'keyword' ? monitors.length : replies.length} item · {tab === 'keyword' ? monitors.filter(m => m.status === 'running').length : replies.filter(r => r.status === 'running').length} aktif</p>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Buat Baru</button>
      </div>
      {loading ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="space-y-4">
          {tab === 'keyword' && (monitors.length === 0 ? <EmptyState icon={Search} title="Belum Ada Monitor" desc="Sistem akan memantau grup dan berkomentar otomatis saat keyword ditemukan" onAdd={() => setShowModal(true)} /> :
            monitors.map(m => <KeywordMonitorCard key={m.id} item={m} accounts={accounts} onStart={() => action('/keyword-monitors', m.id, 'start')} onStop={() => action('/keyword-monitors', m.id, 'stop')} onDelete={() => del('/keyword-monitors', m.id, setMonitors)} onRefresh={fetchData} />)
          )}
          {tab === 'autoreply' && (replies.length === 0 ? <EmptyState icon={MessageSquareReply} title="Belum Ada Auto-Reply" desc="Balas komentar di postingan Anda secara otomatis berdasarkan keyword" onAdd={() => setShowModal(true)} /> :
            replies.map(r => <AutoReplyCard key={r.id} item={r} accounts={accounts} onStart={() => action('/auto-replies', r.id, 'start')} onStop={() => action('/auto-replies', r.id, 'stop')} onDelete={() => del('/auto-replies', r.id, setReplies)} onRefresh={fetchData} />)
          )}
        </div>
      )}
      {showModal && tab === 'keyword' && <NewKeywordMonitorModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={activeAccounts} />}
      {showModal && tab === 'autoreply' && <NewAutoReplyModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={activeAccounts} />}
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, onAdd }) {
  return (
    <div className="card text-center py-14">
      <Icon size={48} className="text-gray-600 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-6">{desc}</p>
      <button className="btn-primary mx-auto" onClick={onAdd}><Plus size={18} /> Buat Baru</button>
    </div>
  );
}
