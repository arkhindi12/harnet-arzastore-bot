import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, RefreshCw, Edit2, X, Save, Copy, CheckCircle, Sparkles } from 'lucide-react';
import api from '../utils/api';

function SpinModal({ template, onClose, onUse }) {
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState([]);
  const [copied, setCopied] = useState(null);

  const spin = async () => {
    setLoading(true); setVariations([]);
    try {
      const res = await api.post('/ai/spin', { text: template.content, count });
      setVariations(res.data.variations || []);
    } catch (e) { alert(e.response?.data?.error || 'Gagal spin. Pastikan Groq API Key sudah dikonfigurasi.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { spin(); }, []);

  const copyVar = (text, i) => { navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            <h2 className="text-white font-bold">AI Spin: {template.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="bg-gray-800/60 rounded-xl p-3 mb-4 text-sm text-gray-300 italic">{template.content}</div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-gray-400 text-sm">Jumlah variasi:</label>
            <select value={count} onChange={e => setCount(+e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm">
              {[3, 5, 7, 10, 15, 20].map(n => <option key={n} value={n}>{n} variasi</option>)}
            </select>
            <button onClick={spin} disabled={loading} className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm">
              <Sparkles size={14} />{loading ? 'Generating...' : 'Spin Ulang'}
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : variations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Tekan "Spin Ulang" untuk generate variasi</div>
          ) : (
            <div className="space-y-2">
              {variations.map((v, i) => (
                <div key={i} className="flex items-start gap-2 bg-gray-800/60 rounded-xl p-3 group">
                  <span className="text-gray-600 text-xs font-mono w-5 flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="text-gray-200 text-sm flex-1">{v}</p>
                  <button onClick={() => copyVar(v, i)} className="flex-shrink-0 text-gray-500 hover:text-green-400 transition-colors">
                    {copied === i ? <CheckCircle size={15} className="text-green-400" /> : <Copy size={15} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = ['umum', 'auto-comment', 'promo', 'sapaan', 'engagement', 'lainnya'];
const CAT_LABELS = { umum: 'Umum', 'auto-comment': 'Auto Komentar', promo: 'Promo', sapaan: 'Sapaan', engagement: 'Engagement', lainnya: 'Lainnya' };

function TemplateModal({ tpl, onClose, onSaved }) {
  const [form, setForm] = useState({ name: tpl?.name || '', content: tpl?.content || '', category: tpl?.category || 'umum' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.name.trim()) return setError('Nama template wajib diisi');
    if (!form.content.trim()) return setError('Konten template wajib diisi');
    setSaving(true); setError('');
    try {
      if (tpl) await api.put(`/templates/${tpl.id}`, form);
      else await api.post('/templates', form);
      onSaved();
    } catch (e) { setError(e.response?.data?.error || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold">{tpl ? 'Edit Template' : 'Buat Template Baru'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Nama Template *</label>
            <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Contoh: Template Promo Ramadan" autoFocus />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Kategori</label>
            <select className="input w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Konten Template *</label>
            <textarea className="input w-full resize-none text-sm font-mono" rows={6} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="{Bagus|Keren|Mantap} sekali postingannya! {{date}}" />
            <p className="text-gray-600 text-xs mt-1">Dukung Spintax: <code className="text-blue-400">{'{opsi1|opsi2}'}</code> dan Variabel: <code className="text-blue-400">{'{{date}}'}</code> <code className="text-blue-400">{'{{time}}'}</code> <code className="text-blue-400">{'{{account}}'}</code></p>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={14} />{saving ? 'Menyimpan...' : 'Simpan Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTpl, setEditTpl] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [spinTpl, setSpinTpl] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/templates'); setTemplates(r.data); }
    catch { setTemplates([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Hapus template ini?')) return;
    await api.delete(`/templates/${id}`);
    setTemplates(p => p.filter(t => t.id !== id));
  };

  const handleCopy = (content, id) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = filterCat === 'all' ? templates : templates.filter(t => t.category === filterCat);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><BookOpen size={22} className="text-blue-400" /> Template Komentar</h1>
          <p className="text-gray-400 mt-1">Simpan dan kelola template komentar untuk dipakai ulang di kampanye</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary p-2"><RefreshCw size={15} /></button>
          <button onClick={() => { setEditTpl(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Buat Template
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 flex-wrap">
        {[['all', 'Semua'], ...CATEGORIES.map(c => [c, CAT_LABELS[c]])].map(([k, label]) => (
          <button key={k} onClick={() => setFilterCat(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterCat === k ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {label} {k === 'all' ? `(${templates.length})` : `(${templates.filter(t => t.category === k).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold">{templates.length === 0 ? 'Belum ada template tersimpan' : 'Tidak ada template dalam kategori ini'}</p>
          <p className="text-gray-600 text-sm mt-1 mb-6">Buat template sekali, pakai berkali-kali di semua kampanye</p>
          {templates.length === 0 && <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">Buat Template Pertama</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(tpl => (
            <div key={tpl.id} className="card hover:border-gray-600 transition-colors flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">{tpl.name}</h3>
                  <span className="bg-blue-900/30 text-blue-400 text-xs px-2 py-0.5 rounded-full">{CAT_LABELS[tpl.category] || tpl.category}</span>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button onClick={() => handleCopy(tpl.content, tpl.id)} className="p-1.5 text-gray-500 hover:text-green-400 transition-colors" title="Salin konten">
                    {copiedId === tpl.id ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => setSpinTpl(tpl)} className="p-1.5 text-gray-500 hover:text-purple-400 transition-colors" title="AI Spin — generate variasi">
                    <Sparkles size={14} />
                  </button>
                  <button onClick={() => { setEditTpl(tpl); setShowModal(true); }} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(tpl.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <pre className="bg-gray-800 rounded-lg p-3 text-gray-300 text-xs whitespace-pre-wrap font-sans flex-1 max-h-32 overflow-hidden line-clamp-4">{tpl.content}</pre>
              <p className="text-gray-600 text-xs mt-2">{new Date(tpl.created_at).toLocaleDateString('id-ID')}</p>
            </div>
          ))}
        </div>
      )}

      {showModal && <TemplateModal tpl={editTpl} onClose={() => { setShowModal(false); setEditTpl(null); }} onSaved={() => { setShowModal(false); setEditTpl(null); load(); }} />}
      {spinTpl && <SpinModal template={spinTpl} onClose={() => setSpinTpl(null)} />}
    </div>
  );
}
