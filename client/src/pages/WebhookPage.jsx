import React, { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, X, ToggleLeft, ToggleRight, Send, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';

const EVENT_LABELS = {
  'campaign.started': 'Kampanye Dimulai',
  'campaign.completed': 'Kampanye Selesai',
  'campaign.stopped': 'Kampanye Dihentikan',
  'campaign.paused': 'Kampanye Dijeda',
  'account.dead': 'Akun Bermasalah',
  'account.checkpoint': 'Akun Checkpoint',
  'comment.success': 'Komentar Berhasil',
  'comment.failed': 'Komentar Gagal',
  'weekly.report': 'Laporan Mingguan',
};

export default function WebhookPage() {
  const [webhooks, setWebhooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: [] });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [wRes, eRes] = await Promise.all([api.get('/webhooks'), api.get('/webhooks/events')]);
      setWebhooks(wRes.data);
      setEvents(eRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.url.trim()) return alert('Nama dan URL wajib diisi');
    setSaving(true);
    try {
      await api.post('/webhooks', form);
      setShowCreate(false); setForm({ name: '', url: '', secret: '', events: [] }); fetchData();
    } catch (e) { alert(e.response?.data?.error || 'Gagal menambahkan webhook'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (wh) => {
    try {
      await api.put(`/webhooks/${wh.id}`, { is_active: !wh.is_active });
      fetchData();
    } catch {}
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus webhook "${name}"?`)) return;
    try { await api.delete(`/webhooks/${id}`); fetchData(); } catch (e) { alert(e.response?.data?.error); }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    try { await api.post(`/webhooks/${id}/test`); alert('Test webhook dikirim! Periksa endpoint Anda.'); } catch { alert('Gagal mengirim test'); }
    finally { setTestingId(null); }
  };

  const toggleEvent = (ev) => setForm(p => ({
    ...p,
    events: p.events.includes(ev) ? p.events.filter(e => e !== ev) : [...p.events, ev]
  }));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Webhook size={22} /> Webhook & Integrasi</h1>
          <p className="text-gray-400 text-sm mt-1">Kirim event otomatis ke sistem lain (Zapier, Make, custom API)</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm"><Plus size={15} /> Tambah Webhook</button>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 mb-6">
        <p className="text-blue-300 text-sm font-medium mb-1">Cara Kerja Webhook</p>
        <p className="text-blue-400/80 text-xs">Saat event tertentu terjadi (kampanye selesai, akun mati, dll), ArzaBot akan mengirim HTTP POST ke URL yang Anda daftarkan dengan data JSON. Cocok untuk integrasi ke Zapier, Make (Integromat), atau sistem custom Anda.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800">
          <Webhook size={48} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 mb-2">Belum ada webhook terdaftar</p>
          <p className="text-gray-600 text-sm">Tambahkan webhook untuk mengintegrasikan ArzaBot dengan sistem lain</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${wh.is_active ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{wh.name}</p>
                    <p className="text-gray-500 text-xs truncate">{wh.url}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{wh.events?.length === 0 ? 'Semua event' : `${wh.events?.length} event`} · Terkirim: {wh.total_sent || 0}x</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <button onClick={() => handleTest(wh.id)} disabled={testingId === wh.id} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs">
                    <Send size={12} />{testingId === wh.id ? '...' : 'Test'}
                  </button>
                  <button onClick={() => handleToggle(wh)} className="text-gray-400 hover:text-blue-400 transition-colors">
                    {wh.is_active ? <ToggleRight size={22} className="text-green-400" /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => handleDelete(wh.id, wh.name)} className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"><Trash2 size={14} /></button>
                  <button onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)} className="text-gray-500 hover:text-white">
                    {expandedId === wh.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>
              {expandedId === wh.id && (
                <div className="border-t border-gray-800 p-4 bg-gray-900/50">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Event yang dipantau</p>
                  <div className="flex flex-wrap gap-2">
                    {wh.events?.length === 0
                      ? <span className="bg-blue-900/40 text-blue-400 text-xs px-3 py-1 rounded-full">Semua event</span>
                      : wh.events.map(ev => <span key={ev} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">{EVENT_LABELS[ev] || ev}</span>)
                    }
                  </div>
                  {wh.last_triggered && <p className="text-gray-600 text-xs mt-3">Terakhir dikirim: {new Date(wh.last_triggered).toLocaleString('id-ID')}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Tambah Webhook</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Nama *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Zapier - Notifikasi Kampanye" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">URL Endpoint *</label>
                <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://hooks.zapier.com/..." className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 font-mono text-xs" />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Secret (opsional)</label>
                <input value={form.secret} onChange={e => setForm(p => ({ ...p, secret: e.target.value }))} placeholder="Untuk validasi signature header" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-2">Event yang dipantau <span className="text-gray-600">(kosong = semua event)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {events.map(ev => (
                    <label key={ev} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} className="rounded" />
                      <span className="text-gray-300 text-xs">{EVENT_LABELS[ev] || ev}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm">Batal</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium">
                  {saving ? 'Menambahkan...' : 'Tambah Webhook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
