import React, { useState, useEffect } from 'react';
import { Code2, Plus, Trash2, Copy, CheckCircle, Eye, EyeOff, AlertTriangle, Terminal } from 'lucide-react';
import api from '../utils/api';

const EVENT_EXAMPLES = [
  {
    endpoint: 'GET /api/v1/me',
    desc: 'Info akun pengguna',
    example: `curl -H "X-API-Key: fbac_xxx..." https://yourapp.com/api/v1/me`,
  },
  {
    endpoint: 'GET /api/v1/campaigns',
    desc: 'Daftar semua kampanye',
    example: `curl -H "X-API-Key: fbac_xxx..." https://yourapp.com/api/v1/campaigns`,
  },
  {
    endpoint: 'POST /api/v1/campaigns/:id/start',
    desc: 'Mulai kampanye',
    example: `curl -X POST -H "X-API-Key: fbac_xxx..." https://yourapp.com/api/v1/campaigns/KAMPANYE_ID/start`,
  },
  {
    endpoint: 'POST /api/v1/campaigns/:id/stop',
    desc: 'Hentikan kampanye',
    example: `curl -X POST -H "X-API-Key: fbac_xxx..." https://yourapp.com/api/v1/campaigns/KAMPANYE_ID/stop`,
  },
  {
    endpoint: 'GET /api/v1/accounts',
    desc: 'Daftar akun Facebook',
    example: `curl -H "X-API-Key: fbac_xxx..." https://yourapp.com/api/v1/accounts`,
  },
];

export default function APIPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(null);

  useEffect(() => { fetchKeys(); }, []);

  const fetchKeys = async () => {
    try {
      const res = await api.get('/api-keys');
      setKeys(res.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const createKey = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api-keys', { name });
      setNewKey(res.data);
      setName('');
      fetchKeys();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membuat API key');
    } finally { setCreating(false); }
  };

  const revokeKey = async (id) => {
    if (!confirm('Nonaktifkan API key ini?')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      fetchKeys();
    } catch (err) {
      alert('Gagal menonaktifkan API key');
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Code2 size={22} className="text-green-400" /> Akses API</h1>
          <p className="text-gray-400 text-sm mt-1">Integrasikan ArzaBot ke tools dan sistem Anda sendiri</p>
        </div>
      </div>

      {newKey && (
        <div className="card bg-green-900/20 border-green-700/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-yellow-400" />
            <span className="text-yellow-300 font-semibold">Simpan API key ini sekarang — tidak akan ditampilkan lagi!</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-4 py-3 font-mono text-green-400 text-sm break-all">
            <span className="flex-1">{newKey.key}</span>
            <button onClick={() => copy(newKey.key)} className="text-gray-400 hover:text-green-400 flex-shrink-0">
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-3 text-gray-500 text-sm hover:text-gray-300">✓ Sudah saya simpan, tutup</button>
        </div>
      )}

      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus size={16} /> Buat API Key Baru</h3>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createKey()} placeholder="Nama API key (contoh: Zapier, n8n, Custom App)" className="input" />
          <button onClick={createKey} disabled={creating || !name.trim()} className="btn-primary whitespace-nowrap">
            {creating ? 'Membuat...' : 'Buat Key'}
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-2">Maksimal 5 API key aktif per akun</p>
      </div>

      <div className="card">
        <h3 className="text-white font-semibold mb-4">API Key Aktif</h3>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : keys.filter(k => k.is_active).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Code2 size={36} className="mx-auto mb-2 opacity-30" />
            <p>Belum ada API key. Buat yang pertama!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.filter(k => k.is_active).map(k => (
              <div key={k.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{k.name}</p>
                  <p className="text-gray-500 text-xs font-mono">{k.key_prefix}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-gray-500 text-xs">{k.last_used ? `Terakhir: ${new Date(k.last_used).toLocaleDateString('id-ID')}` : 'Belum dipakai'}</p>
                  <p className="text-gray-600 text-xs">Dibuat: {new Date(k.created_at).toLocaleDateString('id-ID')}</p>
                </div>
                <button onClick={() => revokeKey(k.id)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2"><Terminal size={16} className="text-green-400" /> Dokumentasi API</h3>
        <p className="text-gray-400 text-sm mb-4">Gunakan header <code className="bg-gray-800 px-1.5 py-0.5 rounded text-green-400 text-xs">X-API-Key: fbac_xxx...</code> pada setiap request</p>
        <div className="space-y-2">
          {EVENT_EXAMPLES.map((e, i) => (
            <div key={i} className="border border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedDoc(expandedDoc === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <code className="text-green-400 text-sm font-mono">{e.endpoint}</code>
                  <span className="text-gray-400 text-sm hidden sm:block">— {e.desc}</span>
                </div>
                <span className="text-gray-500 text-xs">{expandedDoc === i ? '▲' : '▼'}</span>
              </button>
              {expandedDoc === i && (
                <div className="border-t border-gray-700 bg-gray-950 p-4">
                  <p className="text-gray-400 text-sm mb-2">{e.desc}</p>
                  <div className="flex items-start gap-2 bg-gray-900 rounded-lg p-3">
                    <code className="text-green-400 text-xs font-mono flex-1 break-all">{e.example}</code>
                    <button onClick={() => copy(e.example)} className="text-gray-500 hover:text-green-400 flex-shrink-0">
                      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
