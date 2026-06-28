import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle, Server, RefreshCw, Shield } from 'lucide-react';
import api from '../utils/api';

export default function SystemConfigPage() {
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);

  const [proxyRec, setProxyRec] = useState({ title: '', subtitle: '', cta: '', providers: [] });
  const [proxyRecRaw, setProxyRecRaw] = useState('');
  const [proxyMode, setProxyMode] = useState('visual'); // 'visual' | 'json'

  useEffect(() => {
    Promise.all([
      api.get('/admin/system-config'),
      fetch('/api/browser-queue').then(r => r.json()),
      fetch('/api/proxy-recommendation').then(r => r.json()),
    ]).then(([configRes, qRes, proxyRes]) => {
      setConfigs(configRes.data);
      const f = {};
      configRes.data.forEach(c => { f[c.key] = c.value; });
      setForm(f);
      setQueueStatus(qRes);
      if (proxyRes?.providers) {
        setProxyRec(proxyRes);
        setProxyRecRaw(JSON.stringify(proxyRes, null, 2));
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      // Save system config
      await api.put('/admin/system-config', form);
      // Save proxy recommendation
      let proxyData;
      if (proxyMode === 'json') {
        proxyData = JSON.parse(proxyRecRaw);
      } else {
        proxyData = proxyRec;
      }
      await api.put('/admin/system-config', { proxy_recommendation: JSON.stringify(proxyData) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const q = await fetch('/api/browser-queue').then(r => r.json());
      setQueueStatus(q);
    } catch (e) {
      alert(e.response?.data?.error || e.message || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Server size={22} className="text-blue-400" /> Konfigurasi Server</h1>
        <p className="text-gray-400 mt-1 text-sm">Atur performa server: browser concurrent, scheduler interval, dan fitur on/off. Perubahan berlaku real-time (beberapa butuh restart scheduler).</p>
      </div>

      {saved && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3 flex items-center gap-2 text-emerald-300 text-sm">
          <CheckCircle size={16} /> Konfigurasi berhasil disimpan.
        </div>
      )}

      {/* Browser Queue Status */}
      {queueStatus && (
        <div className="card">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-3"><RefreshCw size={14} className="text-blue-400" /> Status Browser Queue (Live)</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{queueStatus.running}</p>
              <p className="text-gray-500 text-xs">Running</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{queueStatus.queued}</p>
              <p className="text-gray-500 text-xs">Antrian</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{queueStatus.max_concurrent}</p>
              <p className="text-gray-500 text-xs">Max Concurrent</p>
            </div>
          </div>
          {queueStatus.queued_by_priority && Object.keys(queueStatus.queued_by_priority).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(queueStatus.queued_by_priority).map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                  {k}: {v} antri
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config Fields */}
      <div className="card space-y-5">
        <h2 className="text-white font-semibold flex items-center gap-2"><Settings size={16} /> Parameter Server</h2>

        {configs.map(c => (
          <div key={c.key}>
            <label className="label">{c.label || c.key}</label>
            {(c.key.includes('enabled') || c.key.includes('auto_sync') || c.key === 'browser_headless') ? (
              <select className="input w-full" value={form[c.key] || '0'} onChange={e => setForm(p => ({ ...p, [c.key]: e.target.value }))}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            ) : c.key === 'browser_engine' ? (
              <select className="input w-full" value={form[c.key] || 'chromium'} onChange={e => setForm(p => ({ ...p, [c.key]: e.target.value }))}>
                <option value="chromium">Chromium (paling kompatibel, ~300MB RAM)</option>
                <option value="firefox">Firefox (lebih ringan, ~200MB RAM)</option>
                <option value="webkit">WebKit/Safari (paling ringan, ~150MB RAM, kompatibilitas terbatas)</option>
              </select>
            ) : (
              <input type="number" className="input w-full" min={1} value={form[c.key] || ''} onChange={e => setForm(p => ({ ...p, [c.key]: e.target.value }))} />
            )}
            {c.description && <p className="text-gray-500 text-xs mt-1">{c.description}</p>}
          </div>
        ))}
      </div>

      <div className="card border-blue-800/30 bg-blue-900/10">
        <h3 className="text-blue-300 text-sm font-semibold mb-2">Estimasi RAM</h3>
        <div className="text-xs text-blue-200/80 space-y-1">
          {(() => {
            const engine = form.browser_engine || 'chromium';
            const ramPerBrowser = engine === 'webkit' ? 150 : engine === 'firefox' ? 200 : 300;
            const concurrent = form.browser_max_concurrent || 2;
            return (
              <>
                <p>• Base app: ~200MB</p>
                <p>• Engine: <strong>{engine}</strong> (~{ramPerBrowser}MB per instance)</p>
                <p>• <strong>Max {concurrent} concurrent</strong> = ~{200 + concurrent * ramPerBrowser}MB total estimasi</p>
                <p className="mt-2 text-gray-400">Tips: Ganti ke Firefox/WebKit untuk hemat RAM di VPS kecil. Chromium paling stabil untuk Facebook.</p>
              </>
            );
          })()}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2"><Shield size={16} /> Rekomendasi Proxy (tampil di dashboard user)</h2>
          <div className="flex gap-2">
            <button onClick={() => setProxyMode('visual')} className={`text-xs px-3 py-1 rounded-lg ${proxyMode === 'visual' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Visual</button>
            <button onClick={() => { setProxyMode('json'); setProxyRecRaw(JSON.stringify(proxyRec, null, 2)); }} className={`text-xs px-3 py-1 rounded-lg ${proxyMode === 'json' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>JSON</button>
          </div>
        </div>

        {proxyMode === 'visual' ? (
          <div className="space-y-3">
            <div><label className="label">Judul</label><input className="input" value={proxyRec.title} onChange={e => setProxyRec(p => ({ ...p, title: e.target.value }))} /></div>
            <div><label className="label">Subtitle</label><input className="input" value={proxyRec.subtitle || ''} onChange={e => setProxyRec(p => ({ ...p, subtitle: e.target.value }))} /></div>
            <div><label className="label">CTA / Warning Text</label><textarea className="input min-h-[60px]" value={proxyRec.cta || ''} onChange={e => setProxyRec(p => ({ ...p, cta: e.target.value }))} /></div>
            <div>
              <label className="label">Daftar Provider</label>
              <div className="space-y-2">
                {(proxyRec.providers || []).map((prov, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <input className="input text-xs" value={prov.name} onChange={e => { const arr = [...proxyRec.providers]; arr[i] = { ...arr[i], name: e.target.value }; setProxyRec(p => ({ ...p, providers: arr })); }} placeholder="Nama" />
                    <input className="input text-xs" value={prov.price} onChange={e => { const arr = [...proxyRec.providers]; arr[i] = { ...arr[i], price: e.target.value }; setProxyRec(p => ({ ...p, providers: arr })); }} placeholder="Harga" />
                    <input className="input text-xs sm:col-span-2" value={prov.pros} onChange={e => { const arr = [...proxyRec.providers]; arr[i] = { ...arr[i], pros: e.target.value }; setProxyRec(p => ({ ...p, providers: arr })); }} placeholder="Kelebihan" />
                    <div className="flex gap-1">
                      <input className="input text-xs flex-1" value={prov.url} onChange={e => { const arr = [...proxyRec.providers]; arr[i] = { ...arr[i], url: e.target.value }; setProxyRec(p => ({ ...p, providers: arr })); }} placeholder="URL" />
                      <button onClick={() => { const arr = proxyRec.providers.filter((_, idx) => idx !== i); setProxyRec(p => ({ ...p, providers: arr })); }} className="text-red-400 hover:text-red-300 px-1">&times;</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setProxyRec(p => ({ ...p, providers: [...(p.providers || []), { name: '', price: '', pros: '', url: '', recommended: false }] }))} className="btn-secondary text-xs w-full">+ Tambah Provider</button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <textarea className="input w-full min-h-[300px] font-mono text-xs" value={proxyRecRaw} onChange={e => setProxyRecRaw(e.target.value)} />
            <p className="text-gray-500 text-xs mt-1">Edit JSON langsung. Pastikan format valid sebelum simpan.</p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-6">
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
        </button>
      </div>
    </div>
  );
}
