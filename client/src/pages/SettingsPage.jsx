import React, { useState, useEffect } from 'react';
import { Bell, Send, Eye, EyeOff, Save, CheckCircle, ExternalLink, Trash2, Plus, RefreshCw, Key, Zap } from 'lucide-react';
import api from '../utils/api';

const STATUS_COLOR = { active: '#22c55e', rate_limited: '#f59e0b', invalid: '#ef4444' };
const STATUS_LABEL = { active: 'Aktif', rate_limited: 'Rate Limited', invalid: 'Invalid' };

function AIKeysSection() {
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState({});
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ api_key: '', label: '', provider: 'groq', model: '', base_url: '' });
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [keySuccess, setKeySuccess] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const [kr, sr, pr] = await Promise.all([
        api.get('/ai/keys'),
        api.get('/ai/stats'),
        api.get('/ai/providers'),
      ]);
      setKeys(kr.data);
      setStats(sr.data);
      setProviders(pr.data);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const currentProvider = providers.find(p => p.id === form.provider) || {};

  const addKey = async e => {
    e.preventDefault();
    if (!form.api_key.trim()) return setKeyError('API key wajib diisi');
    if (form.provider === 'custom' && !form.base_url.trim()) return setKeyError('Base URL wajib diisi untuk provider custom');
    setSavingKey(true); setKeyError(''); setKeySuccess('');
    try {
      const r = await api.post('/ai/keys', {
        api_key: form.api_key.trim(),
        label: form.label.trim(),
        provider: form.provider,
        model: form.model.trim() || null,
        base_url: form.base_url.trim() || null,
      });
      setKeySuccess(`✅ Key berhasil ditambahkan! Provider: ${r.data.provider}, Model: ${r.data.model || '-'}`);
      setForm({ api_key: '', label: '', provider: 'groq', model: '', base_url: '' });
      await fetchKeys();
      setTimeout(() => { setAdding(false); setKeySuccess(''); }, 2500);
    } catch (e) { setKeyError(e.response?.data?.error || 'Gagal menambahkan key'); }
    finally { setSavingKey(false); }
  };

  const deleteKey = async (id) => {
    if (!confirm('Hapus AI key ini?')) return;
    await api.delete(`/ai/keys/${id}`);
    fetchKeys();
  };

  const activateKey = async (id) => {
    await api.post(`/ai/keys/${id}/activate`);
    fetchKeys();
  };

  const fetchAvailableModels = async () => {
    if (!form.api_key.trim()) return setKeyError('Isi API key dulu untuk fetch models');
    if (form.provider === 'custom' && !form.base_url.trim()) return setKeyError('Isi Base URL dulu untuk provider custom');
    setFetchingModels(true); setKeyError('');
    try {
      const r = await api.post('/ai/fetch-models', {
        provider: form.provider,
        api_key: form.api_key.trim(),
        base_url: form.base_url.trim() || null,
      });
      setAvailableModels(r.data.models || []);
      if ((r.data.models || []).length === 0) setKeyError('Tidak ada model yang tersedia');
    } catch (e) {
      setKeyError(e.response?.data?.error || 'Gagal fetch models');
      setAvailableModels([]);
    } finally { setFetchingModels(false); }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(168,85,247,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Zap size={18} style={{ color:'#a855f7' }} />
          </div>
          <div>
            <h2 className="text-white font-semibold">AI Keys — Multi Provider</h2>
            <p className="text-gray-400 text-sm">Groq, OpenAI, OpenRouter, Anthropic, Gemini, atau custom endpoint</p>
          </div>
        </div>
        <button onClick={() => { setAdding(p => !p); setKeyError(''); setKeySuccess(''); }} className="btn-primary" style={{ padding:'6px 14px', fontSize:'0.85rem' }}>
          <Plus size={14} /> Tambah Key
        </button>
      </div>

      {stats.total > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 }}>
          {[
            { label:'Total Key', val: stats.total || 0, color:'#6b7280' },
            { label:'Aktif', val: stats.active || 0, color:'#22c55e' },
            { label:'Request Hari Ini', val: stats.total_requests || 0, color:'#a855f7' },
          ].map(s => (
            <div key={s.label} style={{ background:'#1f2937', borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
              <div style={{ fontSize:'1.4rem', fontWeight:700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={addKey} style={{ background:'#1f2937', borderRadius:12, padding:16, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
          <h3 style={{ color:'#e5e7eb', fontWeight:600, fontSize:'0.9rem', margin:0 }}>➕ Tambah AI Key</h3>
          {keyError && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'8px 12px', color:'#f87171', fontSize:'0.8rem' }}>⚠️ {keyError}</div>}
          {keySuccess && <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, padding:'8px 12px', color:'#86efac', fontSize:'0.8rem' }}>{keySuccess}</div>}

          <div>
            <label className="label">Provider <span style={{ color:'#ef4444' }}>*</span></label>
            <select className="input" value={form.provider} onChange={e => { setForm(p => ({ ...p, provider: e.target.value, model: '', base_url: '' })); setAvailableModels([]); }}>
              {providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {currentProvider.default_model && (
              <p style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:4 }}>Model default: <code style={{ background:'#111827', padding:'1px 5px', borderRadius:4 }}>{currentProvider.default_model}</code></p>
            )}
          </div>

          <div>
            <label className="label">Label (opsional)</label>
            <input className="input" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Contoh: Key Utama" />
          </div>

          <div>
            <label className="label">API Key <span style={{ color:'#ef4444' }}>*</span></label>
            <div style={{ position:'relative' }}>
              <input type={showKey ? 'text' : 'password'} className="input" value={form.api_key}
                onChange={e => setForm(p => ({ ...p, api_key: e.target.value }))}
                placeholder={form.provider === 'groq' ? 'gsk_...' : form.provider === 'openai' ? 'sk-...' : 'API key dari provider'}
                style={{ paddingRight:40 }} />
              <button type="button" onClick={() => setShowKey(p => !p)}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#9ca3af', cursor:'pointer' }}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <label className="label" style={{ marginBottom:0 }}>Model {form.provider === 'custom' ? <span style={{ color:'#ef4444' }}>*</span> : <span style={{ color:'#6b7280' }}>(opsional)</span>}</label>
              <button type="button" onClick={fetchAvailableModels} disabled={fetchingModels || !form.api_key.trim()}
                style={{ fontSize:'0.7rem', padding:'3px 10px', borderRadius:6, background:'#1f2937', color:'#60a5fa', border:'1px solid #374151', cursor: form.api_key.trim() ? 'pointer' : 'not-allowed', opacity: form.api_key.trim() ? 1 : 0.5 }}>
                {fetchingModels ? '⏳ Fetching...' : '🔄 Fetch Models'}
              </button>
            </div>
            {availableModels.length > 0 ? (
              <select className="input" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))}>
                <option value="">-- Pilih model (atau biarkan default) --</option>
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}{m.description ? ` — ${m.description.substring(0, 60)}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input" value={form.model}
                onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
                placeholder={currentProvider.default_model || 'Nama model atau klik Fetch Models'} />
            )}
            {availableModels.length > 0 && (
              <p style={{ fontSize:'0.7rem', color:'#9ca3af', marginTop:4 }}>{availableModels.length} model tersedia. <button type="button" onClick={() => setAvailableModels([])} style={{ background:'none', border:'none', color:'#60a5fa', cursor:'pointer', textDecoration:'underline', padding:0, fontSize:'inherit' }}>Input manual</button></p>
            )}
          </div>

          {form.provider === 'custom' && (
            <div>
              <label className="label">Base URL <span style={{ color:'#ef4444' }}>*</span></label>
              <input className="input" value={form.base_url}
                onChange={e => setForm(p => ({ ...p, base_url: e.target.value }))}
                placeholder="https://your-endpoint.com/v1" />
              <p style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:4 }}>Cukup isi base URL hingga <code>/v1</code>. Sistem otomatis menambahkan <code>/chat/completions</code>.</p>
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button type="submit" disabled={savingKey} className="btn-primary" style={{ flex:1 }}>
              {savingKey ? '🔍 Memvalidasi...' : '✅ Simpan & Validasi'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn-ghost">Batal</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:24, color:'#6b7280' }}>Memuat...</div>
      ) : keys.length === 0 ? (
        <div style={{ textAlign:'center', padding:24, color:'#6b7280' }}>
          <Key size={32} style={{ margin:'0 auto 8px', opacity:0.4 }} />
          <p style={{ fontSize:'0.875rem' }}>Belum ada AI key.</p>
          <p style={{ fontSize:'0.8rem', marginTop:4 }}>Tambahkan key untuk mulai generate konten dengan AI.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {keys.map(k => (
            <div key={k.id} style={{ background:'#1f2937', borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ color:'#e5e7eb', fontWeight:600, fontSize:'0.875rem' }}>{k.label}</span>
                  <span style={{ fontSize:'0.65rem', padding:'2px 7px', borderRadius:20, background:'#111827', color:'#a855f7', border:'1px solid rgba(168,85,247,0.3)', fontWeight:600 }}>
                    {k.provider || 'groq'}
                  </span>
                  <span style={{ fontSize:'0.7rem', padding:'2px 8px', borderRadius:20, background:'rgba(0,0,0,0.3)', color: STATUS_COLOR[k.status] || '#6b7280', border:`1px solid ${STATUS_COLOR[k.status] || '#6b7280'}40` }}>
                    {STATUS_LABEL[k.status] || k.status}
                  </span>
                </div>
                <div style={{ fontSize:'0.72rem', color:'#6b7280', marginTop:3 }}>
                  {k.model && <>Model: <code style={{ background:'#111827', padding:'1px 4px', borderRadius:3 }}>{k.model}</code> · </>}
                  {k.requests_today || 0} req hari ini
                  {k.last_used && <> · Terakhir: {new Date(k.last_used).toLocaleDateString('id-ID')}</>}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {k.status !== 'active' && (
                  <button onClick={() => activateKey(k.id)} title="Aktifkan kembali"
                    style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, padding:'6px 10px', color:'#86efac', cursor:'pointer', fontSize:'0.8rem' }}>
                    <RefreshCw size={14} />
                  </button>
                )}
                <button onClick={() => deleteKey(k.id)} title="Hapus"
                  style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'6px 10px', color:'#f87171', cursor:'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:14, background:'rgba(168,85,247,0.08)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(168,85,247,0.2)' }}>
        <h4 style={{ color:'#c084fc', fontWeight:600, fontSize:'0.85rem', margin:'0 0 6px' }}>💡 Tips Multi-Provider</h4>
        <ul style={{ margin:0, padding:'0 0 0 16px', color:'#9ca3af', fontSize:'0.78rem', lineHeight:1.7 }}>
          <li>Tambah beberapa key dari provider berbeda untuk kuota lebih besar</li>
          <li>Key dirotasi otomatis berdasarkan terakhir dipakai</li>
          <li>Rate limit → sistem coba key berikutnya, key yang invalid ditandai otomatis</li>
          <li>Provider <code style={{ background:'#111827', padding:'1px 5px', borderRadius:4 }}>custom</code> untuk endpoint OpenAI-compatible (mis. self-hosted vLLM, Together, Fireworks, dll)</li>
        </ul>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({ telegram_bot_token: '', telegram_chat_id: '', notify_campaign_complete: true, notify_checkpoint: true, notify_task_error: true });
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => {
      setSettings({ ...r.data, notify_campaign_complete: !!r.data.notify_campaign_complete, notify_checkpoint: !!r.data.notify_checkpoint, notify_task_error: !!r.data.notify_task_error });
      setLoading(false);
    });
  }, []);

  const save = async e => {
    e.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.put('/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const testTelegram = async () => {
    setTesting(true); setTestMsg(''); setError('');
    try {
      const r = await api.post('/settings/test-telegram');
      setTestMsg(r.data.message);
    } catch (err) { setError(err.response?.data?.error || 'Gagal test'); }
    finally { setTesting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-white">Pengaturan</h1><p className="text-gray-400 mt-1">Konfigurasi AI, notifikasi, dan preferensi akun</p></div>

      <AIKeysSection />

      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-900/40 rounded-xl flex items-center justify-center"><Send size={18} className="text-blue-400" /></div>
          <div>
            <h2 className="text-white font-semibold">Notifikasi Telegram</h2>
            <p className="text-gray-400 text-sm">Terima notifikasi real-time di Telegram</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
          {testMsg && <div className="bg-green-900/50 border border-green-700 text-green-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2"><CheckCircle size={16} /> {testMsg}</div>}

          <div>
            <label className="label">Bot Token</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} className="input pr-10" placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" value={settings.telegram_bot_token} onChange={e => setSettings(p => ({ ...p, telegram_bot_token: e.target.value }))} />
              <button type="button" onClick={() => setShowToken(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Chat ID</label>
            <input type="text" className="input" placeholder="-100123456789 atau 123456789" value={settings.telegram_chat_id} onChange={e => setSettings(p => ({ ...p, telegram_chat_id: e.target.value }))} />
            <p className="text-gray-500 text-xs mt-1">Chat ID grup/channel dimulai dengan tanda minus (-)</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white text-sm font-medium flex items-center gap-2"><Bell size={15} className="text-yellow-400" /> Notifikasi yang Dikirim</h3>
            {[
              { key: 'notify_campaign_complete', label: 'Kampanye Selesai', desc: 'Notifikasi ketika kampanye atau task selesai dijalankan' },
              { key: 'notify_checkpoint', label: 'Akun Checkpoint', desc: 'Peringatan ketika akun terdeteksi checkpoint atau invalid' },
              { key: 'notify_task_error', label: 'Error Task', desc: 'Notifikasi ketika terjadi error pada task atau kampanye' },
            ].map(item => (
              <label key={item.key} className="flex items-center justify-between gap-3 cursor-pointer group">
                <div><p className="text-white text-sm group-hover:text-blue-300 transition-colors">{item.label}</p><p className="text-gray-500 text-xs">{item.desc}</p></div>
                <button type="button" onClick={() => setSettings(p => ({ ...p, [item.key]: !p[item.key] }))}
                  className={`relative w-12 h-6 rounded-full flex items-center px-1 transition-colors ${settings[item.key] ? 'bg-blue-600' : 'bg-gray-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings[item.key] ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={testTelegram} disabled={testing || !settings.telegram_chat_id} className="btn-secondary flex-1 justify-center">
              <Send size={15} /> {testing ? 'Mengirim...' : 'Test Kirim Pesan'}
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saved ? <CheckCircle size={15} /> : <Save size={15} />}
              {saving ? 'Menyimpan...' : saved ? 'Tersimpan!' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">📖 Cara Setup Telegram Bot</h3>
        <ol className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-300 font-bold text-xs">1</span><span>Buka Telegram dan cari <span className="text-white font-mono bg-gray-800 px-1.5 py-0.5 rounded">@BotFather</span></span></li>
          <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-300 font-bold text-xs">2</span><span>Kirim perintah <span className="text-white font-mono bg-gray-800 px-1.5 py-0.5 rounded">/newbot</span> dan ikuti instruksinya</span></li>
          <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-300 font-bold text-xs">3</span><span>Salin Bot Token yang diberikan BotFather dan paste di atas</span></li>
          <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-300 font-bold text-xs">4</span><span>Untuk mendapatkan Chat ID: tambahkan bot ke grup/channel, lalu kirim pesan, dan buka <span className="text-white font-mono bg-gray-800 px-1.5 py-0.5 rounded">api.telegram.org/bot{'{TOKEN}'}/getUpdates</span></span></li>
          <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 bg-blue-900/50 rounded-full flex items-center justify-center text-blue-300 font-bold text-xs">5</span><span>Salin nilai <span className="text-white font-mono bg-gray-800 px-1.5 py-0.5 rounded">chat.id</span> dari response JSON dan paste di field Chat ID</span></li>
        </ol>
        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
          <ExternalLink size={14} /> Buka BotFather di Telegram
        </a>
      </div>
    </div>
  );
}
