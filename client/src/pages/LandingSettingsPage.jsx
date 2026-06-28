import React, { useState, useEffect } from 'react';
import { Layout, Save, Eye, RefreshCw, CheckCircle } from 'lucide-react';
import api from '../utils/api';

const FIELDS = [
  { section: 'Umumm & Banner', fields: [
    { key: 'announcement', label: 'Banner Pengumuman (kosongkan untuk sembunyikan)', type: 'text', placeholder: '🔥 Promo: Diskon 50% untuk 100 pendaftar pertama!' },
    { key: 'hero_badge', label: 'Badge Kepercayaan di bawah navbar', type: 'text' },
  ]},
  { section: 'Seksi Hero', fields: [
    { key: 'hero_title', label: 'Judul Utama', type: 'textarea' },
    { key: 'hero_subtitle', label: 'Subjudul / Deskripsi', type: 'textarea' },
    { key: 'hero_cta_primary', label: 'Tombol CTA Utama (Register)', type: 'text' },
    { key: 'hero_cta_secondary', label: 'Tombol CTA Sekunder', type: 'text' },
  ]},
  { section: 'Statistik Hero', fields: [
    { key: 'stat_1_value', label: 'Statistik 1 - Nilai', type: 'text', placeholder: '10.000+' },
    { key: 'stat_1_label', label: 'Statistik 1 - Label', type: 'text' },
    { key: 'stat_2_value', label: 'Statistik 2 - Nilai', type: 'text', placeholder: '500+' },
    { key: 'stat_2_label', label: 'Statistik 2 - Label', type: 'text' },
    { key: 'stat_3_value', label: 'Statistik 3 - Nilai', type: 'text', placeholder: '50+' },
    { key: 'stat_3_label', label: 'Statistik 3 - Label', type: 'text' },
    { key: 'stat_4_value', label: 'Statistik 4 - Nilai', type: 'text', placeholder: '99.9%' },
    { key: 'stat_4_label', label: 'Statistik 4 - Label', type: 'text' },
  ]},
  { section: 'Seksi Fitur', fields: [
    { key: 'features_title', label: 'Judul Seksi Fitur', type: 'text' },
    { key: 'features_subtitle', label: 'Subjudul Seksi Fitur', type: 'text' },
  ]},
  { section: 'Testimoni', fields: [
    { key: 'testimonial_1_name', label: 'Nama Testimoni 1', type: 'text' },
    { key: 'testimonial_1_role', label: 'Peran/Profesi Testimoni 1', type: 'text' },
    { key: 'testimonial_1_text', label: 'Isi Testimoni 1', type: 'textarea' },
    { key: 'testimonial_2_name', label: 'Nama Testimoni 2', type: 'text' },
    { key: 'testimonial_2_role', label: 'Peran/Profesi Testimoni 2', type: 'text' },
    { key: 'testimonial_2_text', label: 'Isi Testimoni 2', type: 'textarea' },
    { key: 'testimonial_3_name', label: 'Nama Testimoni 3', type: 'text' },
    { key: 'testimonial_3_role', label: 'Peran/Profesi Testimoni 3', type: 'text' },
    { key: 'testimonial_3_text', label: 'Isi Testimoni 3', type: 'textarea' },
  ]},
  { section: 'Seksi Harga & Footer', fields: [
    { key: 'pricing_title', label: 'Judul Seksi Harga', type: 'text' },
    { key: 'pricing_subtitle', label: 'Subjudul Seksi Harga', type: 'text' },
    { key: 'footer_text', label: 'Teks Footer', type: 'text' },
  ]},
];

export default function LandingSettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/landing');
      setSettings(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleChange = (key, value) => {
    setSettings(p => ({ ...p, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/landing', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Gagal menyimpan pengaturan landing page');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Layout size={22} className="text-blue-400" /> Pengaturan Landing Page
          </h1>
          <p className="text-gray-400 text-sm mt-1">Edit semua konten halaman depan yang dilihat pengunjung baru</p>
        </div>
        <div className="flex gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 btn-secondary text-sm">
            <Eye size={14} /> Preview
          </a>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium transition-colors ${saved ? 'bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {saved ? <><CheckCircle size={14} /> Tersimpan!</> : saving ? <><RefreshCw size={14} className="animate-spin" /> Menyimpan...</> : <><Save size={14} /> Simpan Perubahan</>}
          </button>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl px-4 py-3 text-sm text-blue-300">
        💡 Perubahan akan langsung terlihat di halaman depan setelah disimpan. Klik "Preview" untuk melihat hasil.
      </div>

      {FIELDS.map(section => (
        <div key={section.section} className="card space-y-4">
          <h3 className="text-white font-semibold border-b border-gray-700 pb-3">{section.section}</h3>
          <div className="space-y-4">
            {section.fields.map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea
                    className="input resize-none"
                    rows={3}
                    value={settings[f.key] || ''}
                    onChange={e => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder || ''}
                  />
                ) : (
                  <input
                    type="text"
                    className="input"
                    value={settings[f.key] || ''}
                    onChange={e => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder || ''}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${saved ? 'bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
          {saved ? <><CheckCircle size={16} /> Tersimpan!</> : saving ? <><RefreshCw size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16} /> Simpan Semua Perubahan</>}
        </button>
      </div>
    </div>
  );
}
