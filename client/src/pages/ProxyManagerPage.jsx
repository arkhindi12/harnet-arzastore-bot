import { useState, useEffect } from 'react';
import { Globe, Plus, Play, Trash2, Wifi, WifiOff, Loader } from 'lucide-react';
import api from '../utils/api';

export default function ProxyManagerPage() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState({});
  const [form, setForm] = useState({ label: '', url: '', country: '' });
  const [bulkText, setBulkText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([api.get('/proxies'), api.get('/accounts')]);
      setItems(r1.data || []);
      setAccounts(r2.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (bulkMode) {
      const lines = bulkText.split('\n').filter(x => x.trim());
      await api.post('/proxies/bulk', { lines });
      setBulkText(''); setBulkMode(false);
    } else {
      if (!form.url) return alert('URL wajib diisi');
      await api.post('/proxies', form);
      setForm({ label: '', url: '', country: '' });
      setShowForm(false);
    }
    load();
  };

  const del = async id => { if (!confirm('Hapus proxy ini?')) return; await api.delete(`/proxies/${id}`); load(); };

  const testProxy = async id => {
    setTesting(t => ({ ...t, [id]: true }));
    try {
      await api.post(`/proxies/${id}/test`);
      load();
    } finally { setTesting(t => ({ ...t, [id]: false })); }
  };

  const testAll = async () => {
    setTesting(t => ({ ...t, all: true }));
    try {
      await api.post('/proxies/test-all');
      load();
    } finally { setTesting(t => ({ ...t, all: false })); }
  };

  const assignProxy = async (proxyId, accountId) => {
    await api.post(`/proxies/${proxyId}/assign`, { account_id: accountId });
    alert('Proxy berhasil di-assign');
  };

  const statusIcon = s => s === 'alive' ? <Wifi size={14} className="text-green-400" /> : s === 'dead' ? <WifiOff size={14} className="text-red-400" /> : <Globe size={14} className="text-gray-400" />;
  const statusClass = s => s === 'alive' ? 'bg-green-900/30 text-green-300' : s === 'dead' ? 'bg-red-900/30 text-red-300' : 'bg-gray-800 text-gray-400';

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Globe className="text-blue-400" /> Proxy Manager</h1>
          <p className="text-gray-400 text-sm mt-1">Kelola proxy untuk akun Facebook.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={testAll} disabled={testing.all}>
            {testing.all ? <Loader className="animate-spin" size={14} /> : <Play size={14} />} Test Semua
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Tambah Proxy
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Tambah Proxy</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bulkMode} onChange={e => setBulkMode(e.target.checked)} />
              Mode Bulk
            </label>
          </div>
          {bulkMode ? (
            <div>
              <label className="label">Proxy List (1 per baris)</label>
              <textarea className="input font-mono text-xs" rows={6} placeholder="http://user:pass@host:port" value={bulkText} onChange={e => setBulkText(e.target.value)} />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              <div><label className="label">Label (opsional)</label><input className="input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
              <div><label className="label">URL *</label><input className="input" placeholder="http://user:pass@host:port" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></div>
              <div><label className="label">Negara (opsional)</label><input className="input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save}>Simpan</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setBulkMode(false); }}>Batal</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-gray-400">Loading...</div> : items.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border border-dashed border-gray-700 rounded-2xl">Belum ada proxy.</div>
      ) : (
        <div className="space-y-3">
          {items.map(it => (
            <div key={it.id} className="p-4 bg-gray-900/70 border border-gray-700 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{it.url}</span>
                    {it.label && <span className="badge bg-blue-900/30 text-blue-300">{it.label}</span>}
                    {it.country && <span className="badge bg-purple-900/30 text-purple-300">{it.country}</span>}
                    <span className={"badge " + statusClass(it.status)}>{statusIcon(it.status)} {it.status}</span>
                    {it.latency_ms && <span className="text-xs text-gray-500">{it.latency_ms}ms</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Ditambah: {new Date(it.created_at).toLocaleString('id-ID')}
                    {it.last_checked && <> • Terakhir dicek: {new Date(it.last_checked).toLocaleString('id-ID')}</>}
                    {it.fail_count > 0 && <> • Gagal: {it.fail_count}x</>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button className="btn-secondary" onClick={() => testProxy(it.id)} disabled={testing[it.id]}>
                    {testing[it.id] ? <Loader className="animate-spin" size={14} /> : <Play size={14} />}
                  </button>
                  <div className="dropdown dropdown-bottom dropdown-end">
                    <label tabIndex={0} className="btn-secondary">Assign</label>
                    <ul tabIndex={0} className="dropdown-content menu bg-gray-800 border border-gray-700 rounded-box z-[1] w-64 p-2 shadow">
                      {accounts.map(a => (
                        <li key={a.id}>
                          <a onClick={() => assignProxy(it.id, a.id)}>{a.name}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button className="btn-secondary text-red-300" onClick={() => del(it.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
