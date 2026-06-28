import React, { useState, useEffect } from 'react';
import { Library, Plus, Trash2, Play, X, ChevronDown, ChevronUp, Copy, Save } from 'lucide-react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function CampaignLibraryPage() {
  const [templates, setTemplates] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const emptyForm = {
    name: '', description: '', targets: '', comment_template: '',
    delay_min: 5, delay_max: 30, active_hours_start: 0, active_hours_end: 23,
    session_size: 10, session_break_min: 10, session_break_max: 30,
    max_errors: 3, daily_limit: 0, auto_rotate: true, account_ids: [],
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, aRes] = await Promise.all([api.get('/campaign-library'), api.get('/accounts')]);
      setTemplates(tRes.data);
      setAccounts(aRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.comment_template.trim()) return alert('Nama dan template komentar wajib diisi');
    setSaving(true);
    try {
      await api.post('/campaign-library', {
        ...form,
        targets: form.targets.split('\n').map(t => t.trim()).filter(Boolean),
      });
      setShowCreate(false); setForm(emptyForm); fetchData();
    } catch (e) { alert(e.response?.data?.error || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Hapus template "${name}"?`)) return;
    try { await api.delete(`/campaign-library/${id}`); fetchData(); } catch (e) { alert(e.response?.data?.error); }
  };

  const handleUse = async (tmpl) => {
    try {
      await api.post('/campaigns', {
        name: tmpl.name,
        description: tmpl.description,
        targets: tmpl.targets,
        comment_template: tmpl.comment_template,
        account_ids: tmpl.account_ids,
        delay_min: tmpl.delay_min, delay_max: tmpl.delay_max,
        active_hours_start: tmpl.active_hours_start, active_hours_end: tmpl.active_hours_end,
        session_size: tmpl.session_size, session_break_min: tmpl.session_break_min, session_break_max: tmpl.session_break_max,
        max_errors: tmpl.max_errors, daily_limit: tmpl.daily_limit, auto_rotate: tmpl.auto_rotate,
      });
      alert('Kampanye berhasil dibuat dari template!');
      navigate('/campaigns');
    } catch (e) { alert(e.response?.data?.error || 'Gagal membuat kampanye'); }
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));
  const fi = (key) => (e) => setForm(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Library size={22} /> Library Kampanye</h1>
          <p className="text-gray-400 text-sm mt-1">Simpan konfigurasi kampanye sebagai template siap pakai</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm"><Plus size={15} /> Template Baru</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800">
          <Library size={48} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 mb-2">Belum ada template kampanye</p>
          <p className="text-gray-600 text-sm">Simpan konfigurasi kampanye favoritmu untuk dipakai ulang kapan saja</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tmpl => (
            <div key={tmpl.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggleExpand(tmpl.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-900/40 border border-blue-800/50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Library size={18} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{tmpl.name}</p>
                    {tmpl.description && <p className="text-gray-500 text-xs truncate">{tmpl.description}</p>}
                    <p className="text-gray-600 text-xs mt-0.5">
                      {tmpl.targets?.length || 0} target · Delay {tmpl.delay_min}-{tmpl.delay_max}s · {tmpl.account_ids?.length || 0} akun dipilih
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); handleUse(tmpl); }} className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-xs"><Play size={12} /> Pakai</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(tmpl.id, tmpl.name); }} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-900/20 transition-colors"><Trash2 size={14} /></button>
                  {expandedId === tmpl.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {expandedId === tmpl.id && (
                <div className="border-t border-gray-800 p-4 space-y-3 bg-gray-900/50">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Template Komentar</p>
                    <pre className="bg-gray-800 rounded-xl p-3 text-gray-300 text-sm whitespace-pre-wrap font-sans">{tmpl.comment_template}</pre>
                  </div>
                  {tmpl.targets?.length > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Target URL ({tmpl.targets.length})</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {tmpl.targets.map((t, i) => <p key={i} className="text-gray-400 text-xs truncate bg-gray-800 rounded-lg px-3 py-1.5">{t}</p>)}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Delay', value: `${tmpl.delay_min}-${tmpl.delay_max}s` },
                      { label: 'Jam Aktif', value: `${tmpl.active_hours_start}:00-${tmpl.active_hours_end}:59` },
                      { label: 'Ukuran Sesi', value: tmpl.session_size },
                      { label: 'Max Error', value: tmpl.max_errors },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center">
                        <p className="text-gray-500 text-xs">{s.label}</p>
                        <p className="text-white font-medium text-sm mt-1">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">Template Kampanye Baru</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-gray-400 text-sm block mb-1">Nama Template *</label>
                  <input value={form.name} onChange={f('name')} placeholder="Template Promo Lebaran 2025" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-sm block mb-1">Deskripsi</label>
                  <input value={form.description} onChange={f('description')} placeholder="Catatan singkat tentang template ini" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Template Komentar *</label>
                <textarea value={form.comment_template} onChange={f('comment_template')} rows={4} placeholder="Gunakan {opsi1|opsi2} untuk variasi spintax" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Target URL (opsional, 1 per baris)</label>
                <textarea value={form.targets} onChange={f('targets')} rows={3} placeholder="https://facebook.com/groups/..." className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Delay Min (s)</label>
                  <input type="number" value={form.delay_min} onChange={fi('delay_min')} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Delay Max (s)</label>
                  <input type="number" value={form.delay_max} onChange={fi('delay_max')} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Jam Aktif (mulai)</label>
                  <input type="number" min={0} max={23} value={form.active_hours_start} onChange={fi('active_hours_start')} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Jam Aktif (akhir)</label>
                  <input type="number" min={0} max={23} value={form.active_hours_end} onChange={fi('active_hours_end')} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm">Batal</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  <Save size={15} />{saving ? 'Menyimpan...' : 'Simpan Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
