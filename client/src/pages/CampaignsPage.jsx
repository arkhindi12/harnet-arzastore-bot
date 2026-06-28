import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Play, Square, Eye, X, Save, Target, Clock, Users, Shield, ChevronDown, ChevronUp, Copy, Pause, BookOpen, Calendar, Search, Variable, Layers, Loader2, Sparkles } from 'lucide-react';
import api from '../utils/api';
import AIGenerateModal from '../components/AIGenerateModal';

const DEFAULT_FORM = {
  name: '', description: '', targets: '', comment_template: '',
  account_ids: [], delay_min: 10, delay_max: 45, daily_limit: 20,
  active_hours_start: 8, active_hours_end: 22, session_size: 10,
  session_break_min: 15, session_break_max: 30, max_errors: 3,
  schedule_start: '', schedule_end: '', auto_rotate: 1,
  variables: {},
  ai_smart_comment: false, ai_topic: '', ai_tone: 'natural',
  browser_engine: 'patchright',
};

function RangeInput({ label, minVal, maxVal, onMinChange, onMaxChange, unit = 'detik', min = 1, max = 999 }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" className="input text-center" min={min} max={max} value={minVal} onChange={e => onMinChange(+e.target.value)} />
        <span className="text-gray-500 flex-shrink-0">–</span>
        <input type="number" className="input text-center" min={min} max={max} value={maxVal} onChange={e => onMaxChange(+e.target.value)} />
        <span className="text-gray-400 text-sm flex-shrink-0">{unit}</span>
      </div>
    </div>
  );
}

function TemplatePicker({ onPick, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/templates').then(r => setTemplates(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><BookOpen size={16} className="text-blue-400" /> Pilih Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Belum ada template tersimpan</p>
              <Link to="/templates" onClick={onClose} className="text-blue-400 hover:text-blue-300 text-sm mt-2 block">Buat template di halaman Template →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} onClick={() => onPick(t.content)} className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded-xl p-4 cursor-pointer transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{t.name}</span>
                    <span className="text-blue-400 text-xs bg-blue-900/30 px-2 py-0.5 rounded-full">{t.category}</span>
                  </div>
                  <pre className="text-gray-400 text-xs whitespace-pre-wrap font-sans line-clamp-3">{t.content}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CampaignModal({ onClose, onSave, accounts }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSafety, setShowSafety] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchAccount, setSearchAccount] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [varKey, setVarKey] = useState('');
  const [varVal, setVarVal] = useState('');

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.account_ids.length) return setError('Pilih minimal 1 akun');
    const targets = form.targets.split('\n').map(t => t.trim()).filter(Boolean);
    if (!targets.length) return setError('Masukkan minimal 1 URL target');
    if (form.delay_min > form.delay_max) return setError('Delay minimum tidak boleh lebih besar dari maksimum');
    setLoading(true); setError('');
    try {
      await api.post('/campaigns', { ...form, targets, variables: JSON.stringify(form.variables || {}) });
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal membuat kampanye');
    } finally { setLoading(false); }
  };

  const toggleAccount = id => {
    set('account_ids', form.account_ids.includes(id) ? form.account_ids.filter(a => a !== id) : [...form.account_ids, id]);
  };

  const doSearch = async () => {
    if (!searchKeyword.trim() || !searchAccount) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await api.post('/search-posts', { keyword: searchKeyword, account_id: searchAccount });
      setSearchResults(res.data.urls || []);
      if (!res.data.urls?.length) alert('Tidak ada URL ditemukan. Coba keyword lain.');
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mencari. Pastikan cookies akun valid.');
    } finally { setSearchLoading(false); }
  };

  const addSearchedUrls = () => {
    const current = form.targets.trim();
    const newUrls = searchResults.join('\n');
    set('targets', current ? current + '\n' + newUrls : newUrls);
    setSearchResults([]);
    setShowSearch(false);
  };

  const addVar = () => {
    if (!varKey.trim() || !varVal.trim()) return;
    set('variables', { ...form.variables, [varKey.trim()]: varVal.trim() });
    setVarKey(''); setVarVal('');
  };

  const removeVar = (k) => {
    const v = { ...form.variables };
    delete v[k];
    set('variables', v);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Buat Kampanye Baru</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nama Kampanye *</label>
              <input className="input" placeholder="Contoh: Promo Ramadan" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Deskripsi</label>
              <input className="input" placeholder="Opsional" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label" style={{ margin: 0 }}>URL Target (1 per baris) *</label>
              <button type="button" onClick={() => setShowSearch(p => !p)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-purple-900/30 text-purple-400 border border-purple-800/40 hover:bg-purple-900/50 transition-colors">
                <Search size={11} /> Auto-Cari URL
              </button>
            </div>
            {showSearch && (
              <div className="bg-gray-800 border border-purple-800/40 rounded-xl p-3 mb-2 space-y-2">
                <div className="flex gap-2">
                  <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="Keyword (contoh: jual sepatu murah)" className="input text-sm" />
                  <select value={searchAccount} onChange={e => setSearchAccount(e.target.value)} className="input text-sm max-w-[160px]">
                    <option value="">Pilih akun...</option>
                    {accounts.filter(a => a.status === 'active').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button type="button" onClick={doSearch} disabled={searchLoading || !searchKeyword || !searchAccount} className="btn-primary text-sm whitespace-nowrap px-3">
                    {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-purple-400 text-xs font-medium">{searchResults.length} URL ditemukan:</p>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {searchResults.map((u, i) => <p key={i} className="text-gray-400 text-xs truncate bg-gray-900 rounded px-2 py-1">{u}</p>)}
                    </div>
                    <button type="button" onClick={addSearchedUrls} className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors">
                      Tambahkan {searchResults.length} URL ke Target
                    </button>
                  </div>
                )}
              </div>
            )}
            <textarea className="input min-h-[90px] resize-none text-sm" placeholder={"https://www.facebook.com/xxx/posts/xxx\nhttps://www.facebook.com/groups/xxx/posts/xxx"} value={form.targets} onChange={e => set('targets', e.target.value)} required />
            <p className="text-gray-500 text-xs mt-1">Mendukung postingan halaman, grup, dan profil Facebook</p>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="label" style={{ margin: 0 }}>Template Komentar *</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowTemplatePicker(true)}
                  style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, padding: '3px 10px', color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BookOpen size={12} /> Pilih Template
                </button>
                <button type="button" onClick={() => setShowAI(true)}
                  style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 8, padding: '3px 10px', color: '#c084fc', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✨ AI Generate
                </button>
              </div>
            </div>
            <textarea className="input min-h-[90px] resize-none text-sm" placeholder="Contoh: {Bagus|Keren|Mantap} sekali! {{date}}" value={form.comment_template} onChange={e => set('comment_template', e.target.value)} required={!form.ai_smart_comment} />
            <p className="text-gray-500 text-xs mt-1">
              {form.ai_smart_comment ? <span className="text-purple-400">⚡ Mode AI aktif — template ini hanya dipakai saat AI gagal (fallback). Boleh dikosongkan.</span> : <>Spintax: <code className="text-blue-400">{'{opsi1|opsi2}'}</code> · Variabel: <code className="text-blue-400">{'{{date}}'}</code> <code className="text-blue-400">{'{{account}}'}</code> · Rotasi per akun: pisahkan template dengan <code className="text-orange-400">{'\n---\n'}</code></>}
            </p>
          </div>
          {showAI && <AIGenerateModal defaultType="comment" onInsert={txt => set('comment_template', txt)} onClose={() => setShowAI(false)} />}
          {showTemplatePicker && <TemplatePicker onPick={content => { set('comment_template', content); setShowTemplatePicker(false); }} onClose={() => setShowTemplatePicker(false)} />}

          <div className="border border-purple-800/40 rounded-xl overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-3 bg-purple-900/15 cursor-pointer">
              <input type="checkbox" checked={!!form.ai_smart_comment} onChange={e => set('ai_smart_comment', e.target.checked)} />
              <Sparkles size={15} className="text-purple-400" />
              <div className="flex-1">
                <div className="text-white font-medium text-sm">Smart AI Comment <span className="text-purple-400">— 1 topik per status</span></div>
                <div className="text-gray-400 text-xs mt-0.5">Sistem buka tiap status, ambil isinya, lalu generate komentar yang nyambung dengan status itu sambil mengaitkan ke topik kamu. Hemat komentar template manual.</div>
              </div>
            </label>
            {form.ai_smart_comment && (
              <div className="p-4 bg-gray-900/50 space-y-3 border-t border-purple-800/30">
                <div>
                  <label className="label">Topik / Produk yang Dipromosikan <span className="text-red-400">*</span></label>
                  <input className="input text-sm" placeholder="Contoh: Jasa cuci motor home service area Jakarta Selatan"
                    value={form.ai_topic} onChange={e => set('ai_topic', e.target.value)} />
                  <p className="text-gray-500 text-xs mt-1">AI akan mengaitkan komentar ke topik ini secara halus, tidak spam.</p>
                </div>
                <div>
                  <label className="label">Gaya Bahasa</label>
                  <select className="input text-sm" value={form.ai_tone} onChange={e => set('ai_tone', e.target.value)}>
                    <option value="natural">Natural — sopan, ramah</option>
                    <option value="casual">Casual — santai seperti teman</option>
                    <option value="formal">Formal</option>
                    <option value="enthusiastic">Antusias — emoji ringan</option>
                    <option value="persuasive">Persuasif — narik calon pembeli</option>
                  </select>
                </div>
                <div className="bg-purple-900/15 border border-purple-800/30 rounded-lg p-3 text-xs text-purple-200">
                  💡 Pastikan kamu sudah tambah <strong>AI key</strong> (Groq / 0penAI / OpenRouter / Gemini / dll) di <strong>Pengaturan → AI Keys</strong>. Setiap status akan dihit AI sekali; jika gagal, kembali ke template komentar manual.
                </div>
              </div>
            )}
          </div>

          <div className="border border-orange-800/40 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowVars(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-orange-900/15 hover:bg-orange-900/25 transition-colors">
              <div className="flex items-center gap-2 text-orange-400 font-medium text-sm">
                <Variable size={15} /> Variabel Kustom Template ({Object.keys(form.variables || {}).length} variabel)
              </div>
              {showVars ? <ChevronUp size={15} className="text-orange-400" /> : <ChevronDown size={15} className="text-orange-400" />}
            </button>
            {showVars && (
              <div className="p-4 bg-gray-900/50 space-y-3">
                <p className="text-gray-400 text-xs">Buat variabel kustom seperti <code className="text-orange-300">{'{{nama_toko}}'}</code>, <code className="text-orange-300">{'{{link_wa}}'}</code>, dll yang akan diganti otomatis saat komentar dikirim.</p>
                <div className="flex gap-2">
                  <input value={varKey} onChange={e => setVarKey(e.target.value)} placeholder="nama_variabel" className="input text-sm font-mono" />
                  <input value={varVal} onChange={e => setVarVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVar())} placeholder="nilainya" className="input text-sm" />
                  <button type="button" onClick={addVar} className="btn-primary text-sm px-3 whitespace-nowrap"><Plus size={14} /></button>
                </div>
                {Object.keys(form.variables || {}).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(form.variables).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 text-sm">
                        <code className="text-orange-400 font-mono">{'{{' + k + '}}'}</code>
                        <span className="text-gray-500">→</span>
                        <span className="text-white flex-1 truncate">{v}</span>
                        <button type="button" onClick={() => removeVar(k)} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <RangeInput label="Delay Antar Komentar *" minVal={form.delay_min} maxVal={form.delay_max} onMinChange={v => set('delay_min', v)} onMaxChange={v => set('delay_max', v)} unit="detik" min={3} max={600} />

          <div>
            <label className="label">Pilih Akun ({form.account_ids.length} dipilih) *</label>
            {accounts.length === 0 ? (
              <p className="text-gray-500 text-sm">Belum ada akun aktif.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {accounts.map(acc => (
                  <label key={acc.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${form.account_ids.includes(acc.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}>
                    <input type="checkbox" checked={form.account_ids.includes(acc.id)} onChange={() => toggleAccount(acc.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{acc.name}</p>
                      <span className={`badge-${acc.status}`}>{acc.status === 'active' ? 'Aktif' : 'Invalid'}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="border border-blue-800/50 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowSchedule(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-900/20 hover:bg-blue-900/30 transition-colors">
              <div className="flex items-center gap-2 text-blue-400 font-medium">
                <Calendar size={16} /> Jadwal Otomatis (Opsional)
              </div>
              {showSchedule ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
            </button>
            {showSchedule && (
              <div className="p-4 space-y-4 bg-gray-900/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Mulai Otomatis</label>
                    <input type="datetime-local" className="input" value={form.schedule_start} onChange={e => set('schedule_start', e.target.value)} />
                    <p className="text-gray-500 text-xs mt-1">Kampanye akan auto-start pada waktu ini</p>
                  </div>
                  <div>
                    <label className="label">Berhenti Otomatis</label>
                    <input type="datetime-local" className="input" value={form.schedule_end} onChange={e => set('schedule_end', e.target.value)} />
                    <p className="text-gray-500 text-xs mt-1">Kampanye akan auto-stop pada waktu ini</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border border-green-800/50 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowSafety(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-green-900/20 hover:bg-green-900/30 transition-colors">
              <div className="flex items-center gap-2 text-green-400 font-medium">
                <Shield size={16} /> Pengaturan Anti-Checkpoint Facebook
              </div>
              {showSafety ? <ChevronUp size={16} className="text-green-400" /> : <ChevronDown size={16} className="text-green-400" />}
            </button>
            {showSafety && (
              <div className="p-4 space-y-4 bg-gray-900/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Batas Komentar per Hari/Akun</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input" min={0} max={500} value={form.daily_limit} onChange={e => set('daily_limit', +e.target.value)} />
                      <span className="text-gray-400 text-sm flex-shrink-0">komentar</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">0 = tidak dibatasi. Rekomendasi: 20-30/hari</p>
                  </div>
                <div>
                  <label className="label">Browser Engine</label>
                  <select className="input" value={form.browser_engine || 'patchright'} onChange={e => set('browser_engine', e.target.value)}>
                    <option value="patchright">Patchright / Chromium (default)</option>
                    <option value="obscura">Obscura (ringan, hemat RAM)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Obscura dipakai saat AI fetch post text. Komentar tetap via API.</p>
                </div>
                <div>
                  <label className="label">Max Error Berturut-turut</label>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input" min={1} max={20} value={form.max_errors} onChange={e => set('max_errors', +e.target.value)} />
                      <span className="text-gray-400 text-sm flex-shrink-0">error</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label">Jam Operasional</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <input type="number" className="input text-center" min={0} max={23} value={form.active_hours_start} onChange={e => set('active_hours_start', +e.target.value)} />
                      <span className="text-gray-400 text-sm flex-shrink-0">:00</span>
                    </div>
                    <span className="text-gray-500">–</span>
                    <div className="flex items-center gap-2 flex-1">
                      <input type="number" className="input text-center" min={0} max={23} value={form.active_hours_end} onChange={e => set('active_hours_end', +e.target.value)} />
                      <span className="text-gray-400 text-sm flex-shrink-0">:59</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label">Istirahat Sesi</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">Setiap</span>
                      <input type="number" className="input w-20 text-center" min={1} max={100} value={form.session_size} onChange={e => set('session_size', +e.target.value)} />
                      <span className="text-gray-400 text-sm">komentar, istirahat</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input w-20 text-center" min={1} max={180} value={form.session_break_min} onChange={e => set('session_break_min', +e.target.value)} />
                      <span className="text-gray-400 text-sm">–</span>
                      <input type="number" className="input w-20 text-center" min={1} max={240} value={form.session_break_max} onChange={e => set('session_break_max', +e.target.value)} />
                      <span className="text-gray-400 text-sm">menit</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.auto_rotate} onChange={e => set('auto_rotate', e.target.checked ? 1 : 0)} className="rounded" />
                    <span className="text-gray-300 text-sm">Auto-rotate akun (skip akun bermasalah otomatis)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              <Save size={16} />{loading ? 'Menyimpan...' : 'Buat Kampanye'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [campRes, accRes] = await Promise.all([api.get('/campaigns'), api.get('/accounts')]);
      setCampaigns(campRes.data);
      setAccounts(accRes.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (campaigns.some(c => c.status === 'running')) fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [campaigns, fetchData]);

  const handleStart = async id => {
    setActionLoading(p => ({ ...p, [id]: 'start' }));
    try { await api.post(`/runner/campaigns/${id}/start`); setTimeout(fetchData, 1000); }
    catch (err) { alert(err.response?.data?.error || 'Gagal memulai kampanye'); }
    finally { setActionLoading(p => ({ ...p, [id]: null })); }
  };

  const handleStop = async id => {
    setActionLoading(p => ({ ...p, [id]: 'stop' }));
    try { await api.post(`/runner/campaigns/${id}/stop`); fetchData(); }
    catch (err) { alert(err.response?.data?.error || 'Gagal menghentikan kampanye'); }
    finally { setActionLoading(p => ({ ...p, [id]: null })); }
  };

  const handlePause = async id => {
    setActionLoading(p => ({ ...p, [id]: 'pause' }));
    try { await api.post(`/campaigns/${id}/pause`); fetchData(); }
    catch (err) { alert(err.response?.data?.error || 'Gagal menjeda'); }
    finally { setActionLoading(p => ({ ...p, [id]: null })); }
  };

  const handleDuplicate = async id => {
    setActionLoading(p => ({ ...p, [id]: 'dup' }));
    try {
      await api.post(`/campaigns/${id}/duplicate`);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Gagal menduplikasi'); }
    finally { setActionLoading(p => ({ ...p, [id]: null })); }
  };

  const handleDelete = async id => {
    if (!confirm('Hapus kampanye ini beserta semua log-nya?')) return;
    try { await api.delete(`/campaigns/${id}`); setCampaigns(p => p.filter(c => c.id !== id)); }
    catch (err) { alert(err.response?.data?.error || 'Gagal menghapus'); }
  };

  const statusLabel = s => ({ running: 'Berjalan', completed: 'Selesai', failed: 'Gagal', stopped: 'Dihentikan', idle: 'Menunggu', paused: 'Dijeda' }[s] || s);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Kampanye</h1>
          <p className="text-gray-400 mt-1 text-sm">{campaigns.length} kampanye</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Buat Kampanye
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-16">
          <Target size={48} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Belum Ada Kampanye</h3>
          <p className="text-gray-400 mb-6">Buat kampanye untuk mulai auto-comment di Facebook</p>
          <button className="btn-primary mx-auto" onClick={() => setShowModal(true)}><Plus size={18} /> Buat Kampanye Pertama</button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(camp => (
            <div key={camp.id} className="card hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-white font-semibold text-lg">{camp.name}</h3>
                    <span className={`badge-${camp.status}`}>{statusLabel(camp.status)}</span>
                    {camp.schedule_start && (
                      <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Calendar size={10} /> Terjadwal
                      </span>
                    )}
                  </div>
                  {camp.description && <p className="text-gray-400 text-sm mb-3">{camp.description}</p>}
                  <div className="flex items-center gap-4 text-gray-400 text-sm flex-wrap">
                    <span className="flex items-center gap-1.5"><Target size={14} /> {Array.isArray(camp.targets) ? camp.targets.length : 0} target</span>
                    <span className="flex items-center gap-1.5"><Users size={14} /> {Array.isArray(camp.account_ids) ? camp.account_ids.length : 0} akun</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} /> {camp.delay_min}-{camp.delay_max}s</span>
                    <span className="flex items-center gap-1.5 text-green-400">
                      <Shield size={14} />{camp.daily_limit > 0 ? `${camp.daily_limit}/hari` : 'Unlimited'} • jam {camp.active_hours_start ?? 0}-{camp.active_hours_end ?? 23} • {camp.browser_engine || 'patchright'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  <Link to={`/campaigns/${camp.id}`} className="btn-secondary px-2.5 py-2" title="Detail"><Eye size={15} /></Link>
                  {camp.status === 'running' ? (
                    <>
                      <button onClick={() => handlePause(camp.id)} disabled={!!actionLoading[camp.id]} className="btn-secondary px-2.5 py-2" title="Jeda">
                        <Pause size={15} />
                      </button>
                      <button onClick={() => handleStop(camp.id)} disabled={!!actionLoading[camp.id]} className="btn-danger px-2.5 py-2" title="Stop">
                        <Square size={15} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleStart(camp.id)} disabled={!!actionLoading[camp.id]} className="btn-success px-2.5 py-2" title={camp.status === 'paused' ? 'Lanjutkan' : 'Mulai'}>
                      <Play size={15} />
                    </button>
                  )}
                  <button onClick={() => handleDuplicate(camp.id)} disabled={!!actionLoading[camp.id]} className="btn-secondary px-2.5 py-2" title="Duplikasi">
                    {actionLoading[camp.id] === 'dup' ? <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Copy size={15} />}
                  </button>
                  {camp.status !== 'running' && (
                    <button onClick={() => handleDelete(camp.id)} className="btn-danger px-2.5 py-2" title="Hapus"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CampaignModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); fetchData(); }} accounts={accounts.filter(a => a.status === 'active')} />
      )}
    </div>
  );
}
