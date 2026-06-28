import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, Users, Edit3, X, Save, Shield, Upload, BarChart2, Activity, CheckCircle, AlertTriangle, XCircle, Clock, Globe, Zap, Monitor, Smartphone, ChevronDown, Compass } from 'lucide-react';
import api from '../utils/api';
import ProxyRecommendation from '../components/ProxyRecommendation';
import RemoteBrowserModal from '../components/RemoteBrowserModal';

const PROXY_FORMATS = [
  'http://user:pass@host:port',
  'https://user:pass@host:port',
  'socks5://user:pass@host:port',
  'socks4://user:pass@host:port',
];



const PERSONA_OPTIONS = [
  { value: 'natural', label: 'Natural (Netral)' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'sales', label: 'Sales Soft' },
  { value: 'expert', label: 'Expert' },
  { value: 'humor', label: 'Humor Ringan' },
];

function getHealthLabel(acc) {
  if (acc.status === 'proxy_dead') return { label: '⚠️ Proxy Mati', color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/30' };
  if (acc.status === 'checkpoint') return { label: 'Risk Checkpoint', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/30' };
  if (acc.status === 'invalid') return { label: 'Update Cookie', color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/30' };
  if (acc.status === 'problematic') return { label: 'Bermasalah', color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/30' };
  const hasProxy = acc.proxy || (acc.proxy_pool && acc.proxy_pool !== '[]');
  if (hasProxy && acc.user_agent) return { label: 'Siap Warming', color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/30' };
  if (hasProxy) return { label: 'Proxy Aktif', color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/30' };
  return { label: 'Siap Browse', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/30' };
}

const UA_PRESETS = [
  { label: 'Acak Otomatis', value: '', icon: 'random', desc: 'User agent berbeda setiap request' },
  { label: 'Chrome Windows', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', icon: 'desktop', desc: 'Chrome 124 · Windows 10' },
  { label: 'Chrome Mac', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', icon: 'desktop', desc: 'Chrome 124 · macOS' },
  { label: 'Firefox Windows', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0', icon: 'desktop', desc: 'Firefox 125 · Windows 10' },
  { label: 'Edge Windows', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0', icon: 'desktop', desc: 'Edge 124 · Windows 10' },
  { label: 'Chrome Android', value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36', icon: 'mobile', desc: 'Chrome Mobile · Android 14' },
  { label: 'Safari iPhone', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1', icon: 'mobile', desc: 'Safari · iPhone iOS 17' },
  { label: 'Samsung Android', value: 'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36', icon: 'mobile', desc: 'Samsung Browser · Android 14' },
];

function ProxyLatencyDisplay({ proxies }) {
  const [latencies, setLatencies] = useState({});
  const [loading, setLoading] = useState(false);

  const proxyList = (proxies || '').split('\n').map(s => s.trim()).filter(Boolean);

  const fetchLatencies = async () => {
    if (proxyList.length === 0) return;
    setLoading(true);
    try {
      const res = await api.get('/proxy-latency');
      setLatencies(res.data || {});
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (proxyList.length > 0) fetchLatencies();
  }, [proxies]);

  if (proxyList.length === 0) return null;

  const getColor = (data) => {
    if (!data || !data.ok) return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'DEAD' };
    if (data.latency <= 500) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: `${data.latency}ms` };
    if (data.latency <= 1500) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: `${data.latency}ms` };
    return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: `${data.latency}ms` };
  };

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-[10px]">Latency (cek tiap 1 menit):</span>
        <button type="button" onClick={fetchLatencies} disabled={loading} className="text-indigo-400 text-[10px] hover:text-indigo-300">{loading ? 'Checking...' : 'Refresh'}</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {proxyList.map((p, i) => {
          const data = latencies[p];
          const c = getColor(data);
          return (
            <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${c.bg} ${c.text}`} title={p}>
              <span className={`w-1.5 h-1.5 rounded-full ${data?.ok ? (data.latency <= 500 ? 'bg-emerald-400' : data.latency <= 1500 ? 'bg-yellow-400' : 'bg-orange-400') : 'bg-red-400'}`} />
              {p.replace(/^https?:\/\/[^@]*@/, '').replace(/^socks[45]?:\/\/[^@]*@/, '').slice(0, 20)}
              <span className="font-semibold">{c.label}</span>
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[9px] text-gray-600">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> &le;500ms (prioritas)</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> 500-1500ms</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> &gt;1500ms</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Dead</span>
      </div>
    </div>
  );
}

function GrabProxyPanel({ onSelect, onSelectPool, onSetProxySource }) {
  const [open, setOpen] = useState(false);
  const [proxies, setProxies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [applied, setApplied] = useState(false);

  const fetchProxies = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/proxies/grab?protocol=all');
      const data = Array.isArray(res.data) ? res.data : [];
      setProxies(data);
      // Extract unique countries
      const countryMap = new Map();
      data.forEach(p => {
        const c = p.geolocation?.country || p.country || '';
        const code = p.geolocation?.countryCode || p.countryCode || '';
        if (c) countryMap.set(c, { name: c, code, count: (countryMap.get(c)?.count || 0) + 1 });
      });
      const sorted = [...countryMap.values()].sort((a, b) => b.count - a.count);
      setCountries(sorted);
    } catch { setError('Gagal mengambil proxy.'); }
    finally { setLoading(false); }
  };

  const handleOpen = () => {
    setOpen(true);
    if (proxies.length === 0) fetchProxies();
  };

  const handleApply = () => {
    if (!selectedCountry) return;
    const filtered = proxies.filter(p => {
      const c = p.geolocation?.country || p.country || '';
      return c === selectedCountry;
    });
    // Format proxy URLs
    const urls = filtered.map(p => {
      if (p.proxy) return p.proxy;
      const proto = p.protocol || p.protocols?.[0] || 'http';
      return `${proto}://${p.ip}:${p.port}`;
    }).filter(Boolean);

    if (urls.length === 0) return setError('Tidak ada proxy untuk negara ini.');

    // Set proxy utama (pertama) + sisanya ke pool
    onSelect(urls[0]);
    if (onSelectPool && urls.length > 1) {
      onSelectPool(urls.slice(0, 20)); // max 20 proxy di pool
    }
    // Set source = proxifly + country agar auto-refresh
    if (onSetProxySource) {
      onSetProxySource({ source: 'proxifly', country: selectedCountry });
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  const countryProxyCount = selectedCountry ? proxies.filter(p => (p.geolocation?.country || p.country) === selectedCountry).length : 0;

  return (
    <div className="mt-2">
      <button type="button" onClick={handleOpen} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
        <Globe size={14} /> Ambil Proxy Gratis (Proxifly)
      </button>

      {open && (
        <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(15,15,30,0.95)' }}>
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)' }}>
            <span className="text-indigo-300 text-xs font-semibold flex items-center gap-1.5"><Zap size={12} /> Proxifly Auto-Rotate by Country</span>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
          </div>

          <div className="p-3 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400 text-xs">Mengambil daftar proxy...</span>
              </div>
            ) : error ? (
              <div className="text-center py-4"><p className="text-red-400 text-xs">{error}</p><button onClick={fetchProxies} className="text-indigo-400 text-xs mt-2 underline">Coba lagi</button></div>
            ) : (
              <>
                <div>
                  <label className="text-gray-400 text-xs font-semibold mb-1.5 block">Pilih Negara</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
                    value={selectedCountry}
                    onChange={e => { setSelectedCountry(e.target.value); setApplied(false); }}
                  >
                    <option value="">-- Pilih negara --</option>
                    {countries.map(c => (
                      <option key={c.name} value={c.name}>{c.name} ({c.count} proxy)</option>
                    ))}
                  </select>
                </div>

                {selectedCountry && (
                  <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-xs">Proxy tersedia: <strong className="text-white">{countryProxyCount}</strong></span>
                      <span className="text-gray-500 text-[10px]">Auto-rotate dari pool</span>
                    </div>
                    <p className="text-gray-500 text-[11px]">Sistem akan otomatis mengisi proxy utama + proxy pool dengan proxy dari {selectedCountry}. <strong className="text-indigo-300">Pool otomatis di-refresh tiap 5 menit</strong> mengikuti update Proxifly.</p>
                  </div>
                )}

                {applied && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <CheckCircle size={12} className="text-green-400" />
                    <span className="text-green-300 text-xs">{countryProxyCount} proxy dari {selectedCountry} berhasil diterapkan ke proxy pool!</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!selectedCountry}
                  className="w-full py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: selectedCountry ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.4)', color: selectedCountry ? '#a5b4fc' : '#4b5563' }}
                >
                  {selectedCountry ? `Terapkan ${countryProxyCount} Proxy ${selectedCountry}` : 'Pilih negara dulu'}
                </button>

                <p className="text-gray-600 text-[10px]">Sumber: proxifly/free-proxy-list • Proxy gratis, kualitas bervariasi • Untuk hasil terbaik gunakan proxy residensial berbayar</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserAgentSection({ value, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [open, setOpen] = useState(false);

  const currentPreset = UA_PRESETS.find(p => p.value === value);
  const isCustom = value && !currentPreset;

  const handlePreset = (preset) => {
    onChange(preset.value);
    setShowCustom(false);
    setOpen(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <Monitor size={14} className={value ? 'text-purple-400' : 'text-gray-500'} />
        <span>
          {open ? 'Sembunyikan User Agent' : value
            ? `User Agent: ${isCustom ? 'Custom' : currentPreset?.label}`
            : '🖥️ Atur User Agent (Opsional)'}
        </span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(15,10,30,0.95)' }}>
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.08)' }}>
            <Monitor size={12} className="text-purple-400" />
            <span className="text-purple-300 text-xs font-semibold">Pilih User Agent</span>
          </div>
          <div className="p-3 space-y-1.5">
            {UA_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                style={{
                  background: (value === preset.value && !isCustom) ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)',
                  border: (value === preset.value && !isCustom) ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {preset.icon === 'random' ? (
                  <RefreshCw size={14} className="text-gray-400 flex-shrink-0" />
                ) : preset.icon === 'mobile' ? (
                  <Smartphone size={14} className="text-blue-400 flex-shrink-0" />
                ) : (
                  <Monitor size={14} className="text-green-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium">{preset.label}</p>
                  <p className="text-gray-500 text-xs">{preset.desc}</p>
                </div>
                {value === preset.value && !isCustom && <CheckCircle size={13} className="text-purple-400 flex-shrink-0" />}
              </button>
            ))}

            <button
              type="button"
              onClick={() => { setShowCustom(p => !p); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
              style={{
                background: (isCustom || showCustom) ? 'rgba(234,179,8,0.1)' : 'rgba(255,255,255,0.03)',
                border: (isCustom || showCustom) ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Globe size={14} className="text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-white text-xs font-medium">Custom User Agent</p>
                <p className="text-gray-500 text-xs">Masukkan user agent sendiri</p>
              </div>
              {isCustom && <CheckCircle size={13} className="text-yellow-400 flex-shrink-0" />}
            </button>

            {(showCustom || isCustom) && (
              <div className="pt-1 space-y-2">
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-gray-600 outline-none resize-none"
                  rows={3}
                  placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
                  value={isCustom ? value : ''}
                  onChange={e => onChange(e.target.value)}
                />
                <p className="text-gray-600 text-xs">Gunakan user agent browser yang sama dengan yang digunakan saat login Facebook.</p>
              </div>
            )}

            {value && (
              <div className="pt-1 rounded-lg px-3 py-2" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <p className="text-purple-400 text-xs font-semibold mb-1">Aktif:</p>
                <p className="text-gray-400 text-xs font-mono break-all leading-relaxed">{value || '(acak setiap request)'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function parseCookieJson(str) {
  try {
    const trimmed = str.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null;
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    if (!arr.every(c => typeof c === 'object' && c.name)) return null;
    return arr.filter(c => c.name && c.value !== undefined).map(c => `${c.name}=${c.value}`).join('; ');
  } catch { return null; }
}

function AccountModal({ onClose, onSave, editAccount }) {
  const [form, setForm] = useState({ name: editAccount?.name || '', cookies: '', proxy: '', user_agent: editAccount?.user_agent || '', persona: editAccount?.persona || 'natural', browser_engine: editAccount?.browser_engine || 'patchright', proxy_pool: '', proxy_source: 'manual', proxy_country: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProxy, setShowProxy] = useState(false);
  const [proxyLoaded, setProxyLoaded] = useState(false);
  const [loginMode, setLoginMode] = useState('cookies'); // cookies | browser
  const [cookieConverted, setCookieConverted] = useState(false);
  const [proxyCheck, setProxyCheck] = useState(null);
  const [checkingProxy, setCheckingProxy] = useState(false);

  useEffect(() => {
    if (editAccount && !proxyLoaded) {
      api.get(`/accounts/${editAccount.id}/proxy`).then(r => {
        setForm(p => ({ ...p, proxy: r.data.proxy || '', user_agent: r.data.user_agent || editAccount.user_agent || '', browser_engine: editAccount.browser_engine || r.data.browser_engine || 'patchright', proxy_pool: Array.isArray(r.data.proxy_pool) ? r.data.proxy_pool.join('\n') : '', proxy_source: r.data.proxy_source || 'manual', proxy_country: r.data.proxy_country || '' }));
        if (r.data.proxy || (r.data.proxy_pool && r.data.proxy_pool.length)) setShowProxy(true);
        setProxyLoaded(true);
      }).catch(() => setProxyLoaded(true));
      // Load proxy pool
      api.get(`/accounts/${editAccount.id}`).catch(() => {});
    }
  }, [editAccount, proxyLoaded]);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload = { name: form.name, proxy: form.proxy || null, user_agent: form.user_agent || null, persona: form.persona || 'natural', browser_engine: form.browser_engine || 'patchright', proxy_pool: form.proxy_pool ? form.proxy_pool.split('\n').map(s => s.trim()).filter(Boolean) : [], proxy_source: form.proxy_source || 'manual', proxy_country: form.proxy_country || null };
      if (form.cookies) payload.cookies = form.cookies;
      if (!editAccount && loginMode === 'cookies' && !form.cookies) { setError('Cookies wajib diisi'); setLoading(false); return; }
      if (!editAccount && loginMode === 'browser' && !form.proxy) { setError('Proxy wajib diisi untuk login via browser'); setLoading(false); return; }
      if (editAccount) {
        await api.put(`/accounts/${editAccount.id}`, payload);
        onSave();
      } else {
        const r = await api.post('/accounts', payload);
        if (loginMode === 'browser') {
          onSave(r.data?.id, 'browser');
        } else {
          onSave();
        }
      }
    } catch (err) {
      const apiError = err.response?.data;
      setError(apiError?.detail ? `${apiError.error}: ${apiError.detail}` : (apiError?.error || 'Gagal menyimpan akun'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">{editAccount ? 'Edit Akun' : 'Tambah Akun Facebook'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div>
            <label className="label">Nama Akun</label>
            <input className="input" placeholder="Contoh: Akun Utama, Akun Backup 1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            {!editAccount && (
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setLoginMode('cookies')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${loginMode === 'cookies' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                  Tempel Cookies
                </button>
                <button type="button" onClick={() => setLoginMode('browser')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${loginMode === 'browser' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                  Login via Browser
                </button>
              </div>
            )}
            {(loginMode === 'cookies' || editAccount) ? (
              <>
            <label className="label">Cookies Facebook {editAccount && <span className="text-gray-500 font-normal">(kosongkan jika tidak ingin ganti)</span>}</label>
            <textarea
              className="input min-h-[120px] resize-none font-mono text-xs"
              placeholder={"Tempel cookies dari browser di sini...\nFormat: c_user=xxx; xs=xxx; datr=xxx; ...\n\nAtau paste JSON dari Cookie-Editor — otomatis dikonversi!"}
              value={form.cookies}
              onChange={e => {
                const val = e.target.value;
                const converted = parseCookieJson(val);
                if (converted) {
                  setForm(p => ({ ...p, cookies: converted }));
                  setCookieConverted(true);
                } else {
                  setForm(p => ({ ...p, cookies: val }));
                  setCookieConverted(false);
                }
              }}
              required={!editAccount}
            />
            {cookieConverted && (
              <div className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
                <p className="text-green-300 text-xs">JSON Cookie-Editor berhasil dikonversi ke format yang benar.</p>
              </div>
            )}
            <p className="text-gray-500 text-xs mt-1.5">
              Gunakan ekstensi <strong className="text-gray-400">EditThisCookie</strong> atau <strong className="text-gray-400">Cookie-Editor</strong>.
              {' '}<span className="text-indigo-400">Format JSON maupun key=value didukung.</span>
            </p>
              </>
            ) : (
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-300 space-y-1">
                <p className="font-semibold">Login via Browser</p>
                <p className="text-xs text-gray-400">Simpan akun dulu lalu browser terbuka otomatis. Login FB manual, cookies tersimpan otomatis saat terdeteksi.</p>
                <p className="text-xs text-yellow-400">Wajib isi Proxy dulu di bawah sebelum simpan.</p>
              </div>
            )}
          </div>

          <div>
            <label className="label">Browser Engine</label>
            <select className="input" value={form.browser_engine || 'patchright'} onChange={e => setForm(p => ({ ...p, browser_engine: e.target.value }))}>
              <option value="patchright">Patchright / Chromium (default, paling kompatibel)</option>
              <option value="obscura">Obscura (ringan, hemat RAM)</option>
            </select>
            <p className="text-gray-500 text-xs mt-1.5">Pilih engine browser untuk cek akun, login manual, dan task browser akun ini.</p>
          </div>

          <GrabProxyPanel
            onSelect={proxy => { setForm(p => ({ ...p, proxy })); setShowProxy(true); }}
            onSelectPool={pool => { setForm(p => ({ ...p, proxy_pool: pool.join('\n') })); setShowProxy(true); }}
            onSetProxySource={({ source, country }) => setForm(p => ({ ...p, proxy_source: source, proxy_country: country }))}
          />

          <div>
            <button type="button" onClick={() => setShowProxy(p => !p)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <Shield size={14} className={showProxy ? 'text-green-400' : 'text-gray-500'} />
              {showProxy ? 'Sembunyikan Proxy' : '🛡️ Atur Proxy (Opsional)'}
            </button>
            {showProxy && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-gray-400 text-xs font-semibold mb-1 block">Proxy Utama</label>
                  <div className="flex gap-2">
                    <input className="input font-mono text-sm flex-1" placeholder="socks5://user:pass@host:port" value={form.proxy} onChange={e => { setForm(p => ({ ...p, proxy: e.target.value, proxy_source: 'manual' })); setProxyCheck(null); }} />
                    <button type="button" disabled={!form.proxy || checkingProxy} onClick={async () => {
                      setCheckingProxy(true); setProxyCheck(null);
                      try {
                        const r = await api.post('/anti-detection/check-proxy-country', { proxy_url: form.proxy });
                        setProxyCheck(r.data);
                      } catch (e) { setProxyCheck({ detected: false, message: e.response?.data?.error || 'Gagal cek' }); }
                      finally { setCheckingProxy(false); }
                    }} className="btn-secondary text-xs flex-shrink-0">
                      {checkingProxy ? 'Cek...' : '🌍 Cek Country'}
                    </button>
                  </div>
                  {proxyCheck && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${
                      proxyCheck.risk_level === 'safe' ? 'bg-emerald-900/20 border border-emerald-700/40 text-emerald-300' :
                      proxyCheck.risk_level === 'low' ? 'bg-yellow-900/20 border border-yellow-700/40 text-yellow-300' :
                      proxyCheck.risk_level === 'high' ? 'bg-red-900/20 border border-red-700/40 text-red-300' :
                      'bg-gray-800 border border-gray-700 text-gray-400'
                    }`}>
                      <span>{proxyCheck.risk_level === 'safe' ? '✅' : proxyCheck.risk_level === 'low' ? '⚠️' : proxyCheck.risk_level === 'high' ? '❌' : 'ℹ️'}</span>
                      <div>
                        <p className="font-semibold">{proxyCheck.message}</p>
                        {proxyCheck.detected && (
                          <p className="text-gray-400 mt-0.5">
                            {proxyCheck.country} ({proxyCheck.code}) {proxyCheck.city ? `· ${proxyCheck.city}` : ''}
                            {proxyCheck.isp ? ` · ${proxyCheck.isp}` : ''}
                            {proxyCheck.is_datacenter ? ' · ⚠️ Datacenter IP' : ' · ✓ Residential'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold mb-1 block">Proxy Pool (Rotasi Otomatis — prioritas latency terendah)</label>
                  <textarea
                    className="input font-mono text-xs min-h-[80px]"
                    placeholder={"http://user:pass@gate.smartproxy.com:7777\nhttp://user:pass@gate.smartproxy.com:7778\nsocks5://user:pass@proxy.iproyal.com:12321"}
                    value={form.proxy_pool}
                    onChange={e => setForm(p => ({ ...p, proxy_pool: e.target.value, proxy_source: 'manual', proxy_country: '' }))}
                  />
                  <ProxyLatencyDisplay proxies={form.proxy_pool} />
                  <p className="text-gray-500 text-xs mt-1">Sistem cek latency tiap 1 menit. Proxy hijau (tercepat) diprioritaskan. Dead proxy otomatis di-skip.</p>
                </div>
                <div style={{ background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, padding:'8px 12px' }}>
                  <p className="text-green-400 text-xs font-semibold mb-1">Format yang didukung:</p>
                  {PROXY_FORMATS.map(f => <p key={f} className="text-gray-400 font-mono text-xs">{f}</p>)}
                  <p className="text-gray-500 text-xs mt-2">💡 Disarankan pakai proxy <strong className="text-green-300">residensial Indonesia</strong> agar lokasi konsisten dengan cookie.</p>
                </div>
              </div>
            )}
          </div>

          <UserAgentSection value={form.user_agent} onChange={ua => setForm(p => ({ ...p, user_agent: ua }))} />

          <div>
            <label className="label">Persona Komentar AI</label>
            <select
              className="input"
              value={form.persona}
              onChange={e => setForm(p => ({ ...p, persona: e.target.value }))}
            >
              {PERSONA_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className="text-gray-500 text-xs mt-1.5">Dipakai saat Smart AI Comment aktif agar gaya tiap akun berbeda.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              <Save size={16} />{loading ? (editAccount ? 'Menyimpan...' : 'Memverifikasi...') : 'Simpan Akun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkImportModal({ onClose, onDone }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const parse = () => {
    const lines = text.split('\n').filter(l => l.trim());
    const accounts = [];
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        accounts.push({ name: parts[0].trim(), cookies: parts[1].trim(), proxy: parts[2]?.trim() || null });
      }
    }
    return accounts;
  };

  const handleImport = async () => {
    const accounts = parse();
    if (!accounts.length) return setError('Format tidak valid. Gunakan: NamaAkun|cookies|proxy(opsional)');
    setLoading(true); setError('');
    try {
      const r = await api.post('/accounts/bulk-import', { accounts });
      setResult(r.data);
    } catch (e) { setError(e.response?.data?.error || 'Gagal import'); }
    finally { setLoading(false); }
  };

  const parsedCount = parse().length;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Upload size={16} className="text-blue-400" /> Bulk Import Akun</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-4 text-center">
                  <p className="text-green-400 text-3xl font-bold">{result.success}</p>
                  <p className="text-gray-400 text-sm mt-1">Berhasil diimpor</p>
                </div>
                <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-center">
                  <p className="text-red-400 text-3xl font-bold">{result.failed}</p>
                  <p className="text-gray-400 text-sm mt-1">Gagal</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <p className="text-red-400 text-xs font-semibold mb-2">Error Detail:</p>
                  {result.errors.map((e, i) => <p key={i} className="text-gray-400 text-xs">{e}</p>)}
                </div>
              )}
              <button onClick={() => { onDone(); onClose(); }} className="btn-primary w-full">Selesai</button>
            </div>
          ) : (
            <>
              {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-4">
                <p className="text-blue-300 text-sm font-semibold mb-2">Format: <code className="text-blue-400">NamaAkun|cookies|proxy(opsional)</code></p>
                <p className="text-gray-400 text-xs">Satu akun per baris. Proxy bersifat opsional (bisa dikosongkan).</p>
                <p className="text-gray-500 text-xs mt-1 font-mono">Contoh: Akun Marketing|c_user=123;xs=abc;...|socks5://user:pass@1.2.3.4:1080</p>
              </div>
              <textarea
                className="input w-full resize-none text-sm font-mono min-h-[200px]"
                placeholder={"Akun Marketing|c_user=123;xs=abc...\nAkun Backup|c_user=456;xs=def...|socks5://..."}
                value={text}
                onChange={e => setText(e.target.value)}
              />
              {parsedCount > 0 && <p className="text-gray-400 text-sm">✓ {parsedCount} akun terdeteksi</p>}
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
                <button onClick={handleImport} disabled={loading || !parsedCount} className="btn-primary flex-1">
                  {loading ? 'Mengimpor...' : `Import ${parsedCount} Akun`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsModal({ account, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/accounts/${account.id}/stats`).then(r => setStats(r.data)).finally(() => setLoading(false));
  }, [account.id]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><BarChart2 size={16} className="text-blue-400" /> Statistik: {account.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5">
          {loading ? <div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div> : stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { label: 'Total Komentar', val: stats.overall?.total || 0, color: 'text-white' },
                  { label: 'Berhasil', val: stats.overall?.success || 0, color: 'text-green-400' },
                  { label: 'Gagal', val: stats.overall?.failed || 0, color: 'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-800 rounded-xl p-2 sm:p-3 text-center">
                    <p className={`text-lg sm:text-2xl font-bold ${s.color}`}>{s.val}</p>
                    <p className="text-gray-500 text-xs mt-1 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs font-semibold mb-2">HARI INI</p>
                <div className="flex items-center gap-4">
                  <div><p className="text-white font-bold text-xl">{stats.today?.total || 0}</p><p className="text-gray-500 text-xs">Komentar</p></div>
                  <div><p className="text-green-400 font-bold text-xl">{stats.today?.success || 0}</p><p className="text-gray-500 text-xs">Berhasil</p></div>
                </div>
              </div>
              {stats.byCampaign?.length > 0 && (
                <div>
                  <p className="text-gray-400 text-xs font-semibold mb-2">PER KAMPANYE</p>
                  <div className="space-y-2">
                    {stats.byCampaign.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                        <span className="text-gray-300 text-sm truncate flex-1">{c.campaign_name || 'Kampanye dihapus'}</span>
                        <div className="flex items-center gap-3 ml-2 flex-shrink-0 text-xs">
                          <span className="text-green-400">{c.success} ✓</span>
                          <span className="text-gray-500">{c.total} total</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <p className="text-gray-500 text-center py-8">Gagal memuat statistik</p>}
        </div>
      </div>
    </div>
  );
}

function ActivityModal({ account, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/accounts/${account.id}/activity`).then(r => setLogs(r.data)).finally(() => setLoading(false));
  }, [account.id]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Activity size={16} className="text-purple-400" /> Riwayat: {account.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Belum ada riwayat aktivitas</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm ${log.status === 'success' ? 'bg-green-900/20 border border-green-800/30' : log.status === 'info' ? 'bg-blue-900/20 border border-blue-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {log.status === 'success' ? <CheckCircle size={14} className="text-green-400" /> : log.status === 'info' ? <Clock size={14} className="text-blue-400" /> : <XCircle size={14} className="text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 text-xs bg-gray-800 px-2 py-0.5 rounded">{log.campaign_name || 'Kampanye dihapus'}</span>
                      <span className="text-gray-600 text-xs">{new Date(log.created_at).toLocaleString('id-ID')}</span>
                    </div>
                    {log.comment_text && <p className="text-gray-300 text-xs mt-1 truncate">"{log.comment_text}"</p>}
                    {log.target_url && log.target_url !== 'system' && (
                      <a href={log.target_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs truncate block">{log.target_url}</a>
                    )}
                    {log.error_message && <p className="text-red-400 text-xs">{log.error_message}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosticsModal({ account, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/accounts/${account.id}/diagnostics`)
      .then(r => setData(r.data.diagnostics))
      .catch(e => setError(e.response?.data?.error || 'Gagal mendiagnosa akun'));
  }, [account.id]);

  const items = data ? [
    ['Cookie ada', data.cookie_present],
    ['c_user ada', data.has_c_user],
    ['xs ada', data.has_xs],
    ['datr ada', data.has_datr],
    ['Web Facebook terbuka', data.web_ok],
    ['Mobile Facebook terbuka', data.mobile_ok],
    ['DTSG ditemukan', data.dtsg_found],
    ['Feed terbaca', data.feed_readable],
    ['Checkpoint terdeteksi', data.checkpoint, true],
    ['Redirect login', data.login_redirect, true],
  ] : [];

  const score = data ? Math.max(0, Math.min(100, [
    data.has_c_user, data.has_xs, data.has_datr, data.web_ok, data.mobile_ok, data.dtsg_found, data.feed_readable,
  ].filter(Boolean).length * 14 - (data.checkpoint ? 35 : 0) - (data.login_redirect ? 25 : 0))) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Shield size={16} className="text-green-400" /> Diagnosa Akun</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5">
          <h3 className="text-white font-semibold mb-1">{account.name}</h3>
          {!data && !error && <div className="text-center py-8"><div className="w-9 h-9 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-400">Mengecek kesehatan akun...</p></div>}
          {error && <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-300 text-sm">{error}</div>}
          {data && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2"><span className="text-gray-400 text-sm">Health Score</span><span className={`text-2xl font-bold ${score >= 70 ? 'text-green-400' : score >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>{score}</span></div>
                <div className="w-full bg-gray-700 rounded-full h-2"><div className={`${score >= 70 ? 'bg-green-500' : score >= 45 ? 'bg-yellow-500' : 'bg-red-500'} h-2 rounded-full`} style={{ width: `${score}%` }} /></div>
                {data.user_id && <p className="text-gray-500 text-xs mt-2 font-mono">UID: {data.user_id}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map(([label, ok, negative]) => (
                  <div key={label} className={`rounded-lg px-3 py-2 text-xs border ${ok ? (negative ? 'bg-red-900/20 border-red-800/30 text-red-300' : 'bg-green-900/20 border-green-800/30 text-green-300') : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    {ok ? (negative ? '⚠ ' : '✓ ') : '○ '}{label}
                  </div>
                ))}
              </div>
              {data.error && <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-3 text-red-300 text-xs">Error terakhir: {data.error}</div>}
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-3 text-blue-200 text-sm">
                <p className="font-semibold text-blue-300 mb-1">Rekomendasi</p>
                <p>{data.recommendation || 'Tidak ada rekomendasi khusus.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscoveryModal({ account, onClose }) {
  const [groups, setGroups] = useState([]);
  const [posts, setPosts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [likeLogs, setLikeLogs] = useState([]);
  const [syncing, setSyncing] = useState({ groups: false, feed: false });
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [g, p, r, ll] = await Promise.all([
        api.get(`/discovery/accounts/${account.id}/stored-groups`),
        api.get(`/discovery/accounts/${account.id}/stored-feed?limit=30`),
        api.get(`/discovery/accounts/${account.id}/discovery-runs?limit=10`),
        api.get(`/discovery/accounts/${account.id}/like-logs?limit=30`),
      ]);
      setGroups(g.data); setPosts(p.data); setRuns(r.data); setLikeLogs(ll.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal memuat data discovery');
    }
  }, [account.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Polling status setiap 3 detik kalau ada sync berjalan
  useEffect(() => {
    if (!syncing.groups && !syncing.feed) return;
    const iv = setInterval(async () => {
      try {
        const s = await api.get('/discovery/status');
        const st = s.data[account.id] || {};
        setSyncing(st);
        if (!st.groups && !st.feed) fetchAll();
      } catch {}
    }, 3000);
    return () => clearInterval(iv);
  }, [syncing, account.id, fetchAll]);

  const trigger = async (type) => {
    setError('');
    try {
      await api.post(`/discovery/accounts/${account.id}/sync-${type === 'groups' ? 'groups' : 'feed'}`);
      setSyncing(p => ({ ...p, [type === 'groups' ? 'groups' : 'feed']: true }));
    } catch (e) {
      setError(e.response?.data?.error || `Gagal mulai sync ${type}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Compass size={16} className="text-blue-400" /> Auto Discovery — {account.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-3 text-blue-200 text-sm">
            <p className="font-semibold text-blue-300 mb-1">Cara kerja</p>
            <p>Sistem buka browser tersembunyi pakai cookie akun ini, lalu ambil daftar grup & post ID dari feed. Hasil disimpan dan dipakai otomatis untuk warming, post, dan komentar.</p>
          </div>
          {error && <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 text-red-300 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm font-semibold">Grup tersimpan</span>
                <span className="text-2xl font-bold text-white">{groups.length}</span>
              </div>
              <button onClick={() => trigger('groups')} disabled={syncing.groups} className="btn-primary w-full justify-center text-xs py-1.5">
                <RefreshCw size={12} className={syncing.groups ? 'animate-spin' : ''} />
                {syncing.groups ? 'Sync grup...' : 'Sync grup sekarang'}
              </button>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm font-semibold">Post ID feed</span>
                <span className="text-2xl font-bold text-white">{posts.length}</span>
              </div>
              <button onClick={() => trigger('feed')} disabled={syncing.feed} className="btn-primary w-full justify-center text-xs py-1.5">
                <RefreshCw size={12} className={syncing.feed ? 'animate-spin' : ''} />
                {syncing.feed ? 'Sync feed...' : 'Sync feed sekarang'}
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-white text-sm font-semibold mb-2">Grup ({groups.length})</h3>
            {groups.length === 0 ? <p className="text-gray-500 text-xs">Belum ada grup tersimpan. Tekan tombol sync di atas.</p> : (
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {groups.map(g => (
                  <a key={g.group_id} href={g.url} target="_blank" rel="noopener noreferrer" className="block bg-gray-800 hover:bg-gray-750 rounded-lg px-3 py-2 text-xs">
                    <div className="text-white truncate">{g.name}</div>
                    <div className="text-gray-500 font-mono text-[10px] truncate">{g.url}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-white text-sm font-semibold mb-2">Post ID feed ({posts.length})</h3>
            {posts.length === 0 ? <p className="text-gray-500 text-xs">Belum ada post ID. Sync feed dulu.</p> : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {posts.map(p => (
                  <a key={p.post_id} href={p.url} target="_blank" rel="noopener noreferrer" className="block bg-gray-800 hover:bg-gray-750 rounded-lg px-3 py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-300 font-mono truncate">{p.post_id}</span>
                      <span className="text-gray-500 text-[10px] flex-shrink-0">{new Date(p.last_seen).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="text-blue-400 text-[10px] truncate mt-0.5">{p.url}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
          {likeLogs.length > 0 && (
            <div>
              <h3 className="text-white text-sm font-semibold mb-2">Riwayat Like ({likeLogs.length})</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {likeLogs.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={`block rounded-lg px-3 py-1.5 text-xs border ${l.status === 'liked' ? 'bg-green-900/20 border-green-800/30' : l.status === 'already_liked' ? 'bg-blue-900/20 border-blue-800/30' : 'bg-red-900/20 border-red-800/30'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={l.status === 'liked' ? 'text-green-300' : l.status === 'already_liked' ? 'text-blue-300' : 'text-red-300'}>
                        {l.status === 'liked' ? '❤️ Liked' : l.status === 'already_liked' ? '✅ Sudah liked' : '⚠ ' + l.status}
                      </span>
                      <span className="text-gray-500 text-[10px]">{new Date(l.created_at).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="text-gray-400 text-[10px] truncate mt-0.5">{l.title || l.url}</div>
                    {l.detail && <div className="text-gray-500 text-[10px] mt-0.5">{l.detail}</div>}
                  </a>
                ))}
              </div>
            </div>
          )}
          {runs.length > 0 && (
            <div>
              <h3 className="text-white text-sm font-semibold mb-2">Riwayat sync</h3>
              <div className="space-y-1">
                {runs.map((r, i) => (
                  <div key={i} className={`rounded-lg px-3 py-1.5 text-xs flex items-center justify-between ${r.status === 'success' ? 'bg-green-900/20 border border-green-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
                    <span className={r.status === 'success' ? 'text-green-300' : 'text-red-300'}>
                      {r.type === 'groups' ? '📁 Grup' : '📰 Feed'} · {r.message || r.status}
                    </span>
                    <span className="text-gray-500 text-[10px]">{new Date(r.created_at).toLocaleString('id-ID')} {r.duration_ms ? `(${(r.duration_ms / 1000).toFixed(1)}s)` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchValidateModal({ accounts, onClose, onDone }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.post('/accounts/batch-validate')
      .then(r => setResults(r.data))
      .catch(e => setError(e.response?.data?.error || 'Gagal validasi'))
      .finally(() => setLoading(false));
  }, []);

  const getIcon = (status) => {
    if (status === 'active') return <CheckCircle size={16} className="text-green-400" />;
    if (status === 'checkpoint') return <AlertTriangle size={16} className="text-yellow-400" />;
    return <XCircle size={16} className="text-red-400" />;
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><Shield size={16} className="text-blue-400" /> Validasi Semua Akun</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Sedang memvalidasi {accounts.length} akun...</p>
              <p className="text-gray-600 text-sm mt-1">Ini mungkin memerlukan beberapa menit</p>
            </div>
          ) : error ? (
            <div className="text-center py-8"><p className="text-red-400">{error}</p></div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Aktif', count: results.filter(r => r.status === 'active').length, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/30' },
                  { label: 'Checkpoint', count: results.filter(r => r.status === 'checkpoint').length, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/30' },
                  { label: 'Invalid', count: results.filter(r => r.status === 'invalid').length, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/30' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 text-center border ${s.bg}`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                    <p className="text-gray-500 text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
              {results.map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
                  {getIcon(r.status)}
                  <span className="text-white text-sm flex-1">{r.name}</span>
                  <span className={`text-xs font-medium ${r.status === 'active' ? 'text-green-400' : r.status === 'checkpoint' ? 'text-yellow-400' : 'text-red-400'}`}>
                    {r.status === 'active' ? 'Aktif' : r.status === 'checkpoint' ? 'Checkpoint' : 'Invalid'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {!loading && (
          <div className="p-5 border-t border-gray-800">
            <button onClick={() => { onDone(); onClose(); }} className="btn-primary w-full">Selesai & Refresh</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [remoteBrowserAccount, setRemoteBrowserAccount] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBatchValidate, setShowBatchValidate] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState(null);
  const [statsAccount, setStatsAccount] = useState(null);
  const [activityAccount, setActivityAccount] = useState(null);
  const [diagnosticsAccount, setDiagnosticsAccount] = useState(null);
  const [discoveryAccount, setDiscoveryAccount] = useState(null);
  const [validating, setValidating] = useState({});
  const [deleting, setDeleting] = useState({});

  const fetchAccounts = useCallback(async () => {
    try { const res = await api.get('/accounts'); setAccounts(res.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleHealthCheckAll = async () => {
    if (!confirm("Cek status semua akun aktif via API? Proses ini mungkin membutuhkan beberapa menit.")) return;
    setHealthChecking(true);
    setHealthResult(null);
    try {
      const r = await api.post("/accounts/health-check-all");
      const changed = r.data.results.filter(x => x.changed);
      setHealthResult({ checked: r.data.checked, changed: changed.length, problems: changed.filter(x => x.status !== "active") });
      fetchAccounts();
    } catch(e) {
      alert(e.response?.data?.error || "Gagal health check");
    } finally {
      setHealthChecking(false);
    }
  };

  const handleDelete = async id => {
    if (!confirm('Hapus akun ini?')) return;
    setDeleting(p => ({ ...p, [id]: true }));
    try { await api.delete(`/accounts/${id}`); setAccounts(p => p.filter(a => a.id !== id)); }
    catch (err) { alert(err.response?.data?.error || 'Gagal menghapus'); }
    finally { setDeleting(p => ({ ...p, [id]: false })); }
  };

  const handleValidate = async id => {
    setValidating(p => ({ ...p, [id]: true }));
    try {
      // Pakai test-live (browser real) untuk deteksi cookie expired yang akurat
      const res = await api.post(`/accounts/${id}/test-live`);
      const r = res.data;
      setAccounts(p => p.map(a => a.id === id ? { ...a, status: r.status === 'active' ? 'active' : r.status } : a));

      if (r.status === 'active') {
        alert(`✅ Akun aktif & cookies valid!\n\nNama FB: ${r.userName || 'Tidak diketahui'}`);
      } else if (r.status === 'expired') {
        alert(`❌ COOKIES EXPIRED\n\n${r.message}\n\n${r.detail || ''}\n\n💡 Login ulang ke Facebook, ambil cookies baru, lalu update di akun ini.`);
      } else if (r.status === 'checkpoint') {
        alert(`⚠️ CHECKPOINT TERDETEKSI\n\n${r.message}\n\n${r.detail || ''}\n\n💡 Login manual di browser, selesaikan checkpoint, lalu ambil cookies baru.`);
      } else if (r.status === 'locked') {
        alert(`🔒 AKUN TERKUNCI\n\n${r.message}\n\n${r.detail || ''}\n\n💡 Akun ini sudah dikunci/dinonaktifkan oleh Facebook.`);
      } else {
        alert(`❓ Status tidak jelas\n\n${r.message}\n\n${r.detail || ''}`);
      }
    } catch (e) { alert('Gagal cek akun: ' + (e.response?.data?.error || e.message)); }
    finally { setValidating(p => ({ ...p, [id]: false })); }
  };

  const handleSave = (accountId, mode) => { setShowModal(false); setEditAccount(null); fetchAccounts(); if (mode === 'browser' && accountId) { const accs = accounts; setTimeout(() => fetchAccounts().then(() => { setRemoteBrowserAccount(prev => prev || { id: accountId, name: 'Akun Baru' }); }), 800); } };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeCount = accounts.filter(a => a.status === 'active').length;
  const checkpointCount = accounts.filter(a => a.status === 'checkpoint').length;
  const proxyCount = accounts.filter(a => a.proxy).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Akun Facebook</h1>
          <p className="text-gray-400 mt-1 text-sm">{accounts.length} akun terdaftar</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {accounts.length > 0 && (
            <>
              <button onClick={() => setShowBatchValidate(true)} className="btn-secondary flex items-center gap-2 text-sm">
                <Shield size={15} /> Validasi Semua
              </button>
              <button
                className={`btn-secondary flex items-center gap-1.5 text-sm ${healthChecking ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleHealthCheckAll}
                disabled={healthChecking}
              >
                <Activity size={15} /> {healthChecking ? 'Mengecek...' : 'Cek Health'}
              </button>
            </>
          )}
          <button onClick={() => setShowBulkImport(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={15} /> Bulk Import
          </button>
          <button className="btn-primary" onClick={() => { setEditAccount(null); setShowModal(true); }}>
            <Plus size={18} /> Tambah Akun
          </button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Akun', val: accounts.length, color: '#6b7280' },
            { label: 'Aktif', val: activeCount, color: '#22c55e' },
            { label: 'Checkpoint', val: checkpointCount, color: '#f59e0b' },
            { label: 'Pakai Proxy', val: proxyCount, color: '#a855f7' },
          ].map(s => (
            <div key={s.label} className="card text-center py-3">
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <ProxyRecommendation />

      {accounts.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={48} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Belum Ada Akun</h3>
          <p className="text-gray-400 mb-6">Tambahkan akun Facebook menggunakan cookies untuk mulai auto-comment</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary" onClick={() => setShowBulkImport(true)}>
              <Upload size={16} /> Bulk Import
            </button>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> Tambah Akun
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="card hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${acc.status === 'active' ? 'bg-gradient-to-br from-blue-600 to-blue-800' : acc.status === 'checkpoint' ? 'bg-gradient-to-br from-yellow-600 to-orange-700' : 'bg-gradient-to-br from-gray-600 to-gray-800'}`}>
                    {acc.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{acc.name}</h3>
                    <span className={`badge-${acc.status}`}>
                      {acc.status === 'active' ? '● Aktif' : acc.status === 'checkpoint' ? '⚠ Checkpoint' : acc.status === 'problematic' ? '⚠ Bermasalah' : '● Invalid'}
                    </span>
                    {(() => {
                      const health = getHealthLabel(acc);
                      return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${health.bg} ${health.color} mt-1 inline-block`}>{health.label}</span>;
                    })()}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border mt-1 inline-block ml-1 ${acc.fatigue_level === 'high' ? 'bg-red-900/20 border-red-800/30 text-red-300' : acc.fatigue_level === 'medium' ? 'bg-yellow-900/20 border-yellow-800/30 text-yellow-300' : 'bg-emerald-900/20 border-emerald-800/30 text-emerald-300'}`}>
                      Fatigue: {(acc.fatigue_level || 'low').toUpperCase()} ({Math.round(acc.fatigue_score || 0)})
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border mt-1 inline-block ml-1 bg-indigo-900/20 border-indigo-800/30 text-indigo-300">
                      Persona: {(acc.persona || 'natural')}
                    </span>
                  </div>
                </div>
                {(acc.proxy || (acc.proxy_pool && acc.proxy_pool !== '[]')) && (
                  <span title={acc.proxy_masked || 'Proxy aktif'} style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 6, padding: '2px 6px', color: '#c084fc', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Shield size={10} /> {(() => { try { const p = JSON.parse(acc.proxy_pool || '[]'); return p.length > 1 ? `Pool ${p.length}` : 'Proxy'; } catch { return 'Proxy'; } })()}
                  </span>
                )}
              </div>
              <div className="text-gray-500 text-xs mb-3 space-y-0.5">
                <p>Dibuat: {new Date(acc.created_at).toLocaleDateString('id-ID')}</p>
                <p>Terakhir: {acc.last_used ? new Date(acc.last_used).toLocaleDateString('id-ID') : 'Belum pernah'}</p>
                {acc.proxy && acc.proxy_masked && <p className="text-purple-400/70 font-mono truncate">🛡 {acc.proxy_masked}</p>}
                {acc.cooldown_until && new Date(acc.cooldown_until).getTime() > Date.now() && (
                  <p className="text-red-400 text-xs">⏳ Cooldown sampai: {new Date(acc.cooldown_until).toLocaleString('id-ID')}</p>
                )}
              </div>
              {acc.status === 'checkpoint' && (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                  <p style={{ color: '#fbbf24', fontSize: '0.72rem' }}>⚠️ Butuh verifikasi manual di browser Facebook, lalu update cookies.</p>
                </div>
              )}
              {acc.status === 'proxy_dead' && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                  <p style={{ color: '#f87171', fontSize: '0.72rem' }}>❌ Semua proxy mati! Task akun ini di-pause otomatis. Ganti/tambah proxy yang aktif.</p>
                </div>
              )}
              {acc.status === 'active' && acc.dead_proxies && (() => {
                try {
                  const dead = JSON.parse(acc.dead_proxies || '[]');
                  if (dead.length > 0) return (
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                      <p style={{ color: '#fbbf24', fontSize: '0.72rem' }}>⚠️ {dead.length} proxy mati (otomatis di-skip). Akun tetap jalan pakai proxy yang hidup.</p>
                    </div>
                  );
                } catch {} return null;
              })()}
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => handleValidate(acc.id)} disabled={validating[acc.id]} className="btn-secondary flex-1 justify-center text-xs py-1.5" style={{ minWidth: 0 }}>
                  <RefreshCw size={12} className={validating[acc.id] ? 'animate-spin' : ''} />
                  {validating[acc.id] ? 'Cek...' : 'Cek'}
                </button>
                <button onClick={() => setStatsAccount(acc)} className="btn-secondary px-2.5 py-1.5" title="Statistik"><BarChart2 size={13} /></button>
                <button onClick={() => setActivityAccount(acc)} className="btn-secondary px-2.5 py-1.5" title="Riwayat Aktivitas"><Activity size={13} /></button>
                <button onClick={() => setDiagnosticsAccount(acc)} className="btn-secondary px-2.5 py-1.5" title="Diagnosa Akun"><Shield size={13} /></button>
                <button onClick={() => setRemoteBrowserAccount(acc)} className="btn-secondary px-2.5 py-1.5" title="Login Manual Browser"><Monitor size={13} /></button>
                <button onClick={() => setDiscoveryAccount(acc)} className="btn-secondary px-2.5 py-1.5" title="Auto Discovery (sync grup & feed)"><Compass size={13} /></button>
                <button onClick={async () => { try { await api.post(`/accounts/${acc.id}/fatigue/recalculate`); fetchAccounts(); } catch (e) { alert(e.response?.data?.error || 'Gagal hitung fatigue'); } }} className="btn-secondary px-2.5 py-1.5" title="Hitung Ulang Fatigue"><Zap size={13} /></button>
                <button onClick={() => { setEditAccount(acc); setShowModal(true); }} className="btn-secondary px-2.5 py-1.5" title="Edit"><Edit3 size={13} /></button>
                <button onClick={() => handleDelete(acc.id)} disabled={deleting[acc.id]} className="btn-danger px-2.5 py-1.5" title="Hapus"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <AccountModal onClose={() => { setShowModal(false); setEditAccount(null); }} onSave={handleSave} editAccount={editAccount} />}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onDone={fetchAccounts} />}
      {showBatchValidate && <BatchValidateModal accounts={accounts} onClose={() => setShowBatchValidate(false)} onDone={fetchAccounts} />}
      {statsAccount && <StatsModal account={statsAccount} onClose={() => setStatsAccount(null)} />}
      {activityAccount && <ActivityModal account={activityAccount} onClose={() => setActivityAccount(null)} />}
      {diagnosticsAccount && <DiagnosticsModal account={diagnosticsAccount} onClose={() => setDiagnosticsAccount(null)} />}
      {discoveryAccount && <DiscoveryModal account={discoveryAccount} onClose={() => setDiscoveryAccount(null)} />}
      {remoteBrowserAccount && <RemoteBrowserModal account={remoteBrowserAccount} onClose={() => { setRemoteBrowserAccount(null); fetchAccounts(); }} />}
    </div>
  );
}
