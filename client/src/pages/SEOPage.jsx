import React, { useState, useEffect } from 'react';
import { Search, Globe, Twitter, Link2, Image, Save, RefreshCw, Info, Eye, EyeOff, Upload } from 'lucide-react';
import api from '../utils/api';
import { applySEO } from '../hooks/useSEO';

const FIELDS = {
  basic: {
    label: 'Dasar',
    icon: Globe,
    fields: [
      { key: 'site_title', label: 'Judul Halaman (Title Tag)', desc: 'Tampil di tab browser dan hasil pencarian Google. Ideal 50–60 karakter.', type: 'text', max: 70 },
      { key: 'site_name', label: 'Nama Situs', desc: 'Nama brand situs Anda.', type: 'text' },
      { key: 'meta_description', label: 'Meta Description', desc: 'Deskripsi singkat halaman di hasil pencarian. Ideal 120–160 karakter.', type: 'textarea', max: 200 },
      { key: 'meta_keywords', label: 'Meta Keywords', desc: 'Kata kunci dipisah koma. Meski kurang berpengaruh di Google, tetap berguna untuk mesin lain.', type: 'text' },
      { key: 'meta_author', label: 'Meta Author', desc: 'Nama penulis/pemilik situs.', type: 'text' },
      { key: 'meta_robots', label: 'Meta Robots', desc: 'Instruksi untuk crawler search engine.', type: 'select', options: ['index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow'] },
      { key: 'canonical_url', label: 'Canonical URL', desc: 'URL kanonik untuk mencegah konten duplikat.', type: 'text', placeholder: 'https://yourdomain.com' },
      { key: 'favicon_url', label: 'Favicon', desc: 'URL ikon favicon (bisa relatif /favicon.svg atau absolut).', type: 'image', placeholder: '/favicon.svg' },
      { key: 'theme_color', label: 'Theme Color', desc: 'Warna tema browser pada perangkat mobile.', type: 'color' },
    ],
  },
  og: {
    label: 'Open Graph (Facebook)',
    icon: Image,
    fields: [
      { key: 'og_title', label: 'OG Title', desc: 'Judul saat dibagikan di Facebook/LinkedIn. Ideal ≤ 60 karakter.', type: 'text', max: 90 },
      { key: 'og_description', label: 'OG Description', desc: 'Deskripsi saat dibagikan di media sosial. Ideal ≤ 200 karakter.', type: 'textarea', max: 250 },
      { key: 'og_image', label: 'OG Image', desc: 'Gambar thumbnail saat dibagikan. Ukuran ideal 1200×630 px.', type: 'image', placeholder: 'https://yourdomain.com/og-image.jpg' },
      { key: 'og_url', label: 'OG URL', desc: 'URL kanonik halaman untuk Open Graph.', type: 'text', placeholder: 'https://yourdomain.com' },
      { key: 'og_type', label: 'OG Type', desc: 'Jenis konten Open Graph.', type: 'select', options: ['website', 'article', 'product', 'profile'] },
      { key: 'og_site_name', label: 'OG Site Name', desc: 'Nama situs dalam metadata Open Graph.', type: 'text' },
    ],
  },
  twitter: {
    label: 'Twitter / X Card',
    icon: Twitter,
    fields: [
      { key: 'twitter_card', label: 'Twitter Card Type', desc: 'Tipe kartu Twitter untuk pratinjau link.', type: 'select', options: ['summary', 'summary_large_image', 'app', 'player'] },
      { key: 'twitter_title', label: 'Twitter Title', desc: 'Judul saat link dibagikan di Twitter/X.', type: 'text', max: 70 },
      { key: 'twitter_description', label: 'Twitter Description', desc: 'Deskripsi saat link dibagikan di Twitter/X.', type: 'textarea', max: 200 },
      { key: 'twitter_image', label: 'Twitter Image', desc: 'Gambar thumbnail Twitter Card.', type: 'image', placeholder: 'https://yourdomain.com/twitter-image.jpg' },
      { key: 'twitter_site', label: 'Twitter @username', desc: 'Username Twitter akun situs Anda (opsional).', type: 'text', placeholder: '@username' },
    ],
  },
};

function FieldInput({ field, value, onChange }) {
  const charCount = value?.length || 0;
  const isOver = field.max && charCount > field.max;
  const isNearLimit = field.max && charCount > field.max * 0.85;
  const [uploading, setUploading] = useState(false);

  if (field.type === 'image') {
    const handleUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.svg,.ico';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('File terlalu besar (max 5MB)'); return; }
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          onChange(res.data.url);
        } catch (err) {
          alert(err.response?.data?.error || 'Gagal upload');
        } finally { setUploading(false); }
      };
      input.click();
    };
    return (
      <div>
        <div className="flex gap-2">
          <input type="text" className="input flex-1 font-mono text-sm" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ''} />
          <button type="button" onClick={handleUpload} disabled={uploading} className="btn-secondary flex-shrink-0 flex items-center gap-1.5 text-sm">
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        {value && (
          <div className="mt-2 inline-block bg-gray-800 border border-gray-700 rounded-lg p-2">
            <img src={value} alt="Preview" className="max-h-16 max-w-[200px] object-contain rounded" onError={e => { e.target.style.display = 'none'; }} />
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <select className="input" value={value || ''} onChange={e => onChange(e.target.value)}>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (field.type === 'color') {
    return (
      <div className="flex items-center gap-3">
        <input type="color" value={value || '#1d4ed8'} onChange={e => onChange(e.target.value)}
          className="w-12 h-10 rounded cursor-pointer border-0 bg-transparent" />
        <input type="text" className="input flex-1" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder="#1d4ed8" />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <textarea
          className={`input resize-none w-full ${isOver ? 'border-red-500' : ''}`}
          rows={3}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          maxLength={field.max ? field.max + 50 : undefined}
        />
        {field.max && (
          <p className={`text-xs mt-1 text-right ${isOver ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-gray-600'}`}>
            {charCount}/{field.max} karakter
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        className={`input w-full ${isOver ? 'border-red-500' : ''}`}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
      />
      {field.max && (
        <p className={`text-xs mt-1 text-right ${isOver ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-gray-600'}`}>
          {charCount}/{field.max} karakter
        </p>
      )}
    </div>
  );
}

function PreviewCard({ form }) {
  const url = form.og_url || form.canonical_url || 'https://yourdomain.com';
  const displayUrl = url.replace(/^https?:\/\//, '');

  return (
    <div className="card space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2"><Eye size={16} /> Pratinjau</h3>

      <div>
        <p className="text-gray-500 text-xs mb-2">Google Search Result</p>
        <div className="bg-white rounded-xl p-4">
          <p className="text-green-700 text-xs">{displayUrl}</p>
          <p className="text-blue-700 text-lg font-medium leading-tight mt-0.5 line-clamp-1">{form.site_title || 'Judul Halaman'}</p>
          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{form.meta_description || 'Deskripsi halaman Anda akan muncul di sini...'}</p>
        </div>
      </div>

      <div>
        <p className="text-gray-500 text-xs mb-2">Facebook / LinkedIn Share</p>
        <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
          {form.og_image ? (
            <img src={form.og_image} alt="OG" className="w-full h-32 object-cover" onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
              <Image size={32} className="text-gray-400" />
            </div>
          )}
          <div className="p-3">
            <p className="text-gray-500 text-xs uppercase">{displayUrl}</p>
            <p className="text-gray-900 font-semibold text-sm line-clamp-1">{form.og_title || form.site_title || 'OG Title'}</p>
            <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">{form.og_description || form.meta_description || 'OG Description'}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-gray-500 text-xs mb-2">Twitter / X Card</p>
        <div className="bg-black rounded-xl overflow-hidden border border-gray-700">
          {form.twitter_image ? (
            <img src={form.twitter_image} alt="Twitter" className="w-full h-28 object-cover" onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div className="w-full h-28 bg-gray-900 flex items-center justify-center">
              <Twitter size={28} className="text-gray-600" />
            </div>
          )}
          <div className="p-3">
            <p className="text-white font-semibold text-sm line-clamp-1">{form.twitter_title || form.og_title || form.site_title || 'Twitter Title'}</p>
            <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{form.twitter_description || form.og_description || 'Twitter Description'}</p>
            <p className="text-gray-600 text-xs mt-1">{displayUrl}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SEOPage() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    api.get('/admin/seo').then(r => {
      setForm(r.data);
    }).catch(e => setError(e.response?.data?.error || 'Gagal memuat pengaturan SEO')).finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.put('/admin/seo', form);
      applySEO(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setLoading(true);
    const r = await api.get('/admin/seo');
    setForm(r.data);
    setLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tabs = Object.entries(FIELDS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Search size={22} className="text-green-400" /> Pengaturan SEO</h1>
          <p className="text-gray-400 mt-1">Edit meta tag untuk optimasi mesin pencari dan media sosial</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPreview(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
            {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
            {showPreview ? 'Sembunyikan' : 'Pratinjau'}
          </button>
          <button onClick={reset} className="btn-secondary flex items-center gap-2 text-sm" title="Refresh dari server">
            <RefreshCw size={15} />
          </button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={15} />
            {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan' : 'Simpan SEO'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-3 text-sm">{error}</div>}
      {saved && <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-xl p-3 text-sm flex items-center gap-2"><Info size={15} /> Pengaturan SEO berhasil disimpan dan diterapkan.</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={showPreview ? 'xl:col-span-2' : 'xl:col-span-3'}>
          <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-4">
            {tabs.map(([key, section]) => {
              const Icon = section.icon;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{section.label}</span>
                </button>
              );
            })}
          </div>

          <div className="card space-y-5">
            {FIELDS[activeTab].fields.map(field => (
              <div key={field.key}>
                <label className="text-white text-sm font-medium block mb-1">{field.label}</label>
                <FieldInput field={field} value={form[field.key] || ''} onChange={val => set(field.key, val)} />
                <p className="text-gray-500 text-xs mt-1">{field.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {showPreview && (
          <div>
            <PreviewCard form={form} />
          </div>
        )}
      </div>

      <div className="card bg-blue-900/20 border-blue-800/30">
        <h3 className="text-blue-300 font-semibold flex items-center gap-2 mb-3"><Info size={16} /> Tips SEO Terbaik</h3>
        <ul className="space-y-1.5 text-gray-400 text-sm">
          <li>• <strong className="text-gray-300">Title Tag</strong>: Masukkan keyword utama di awal judul, buat unik per halaman, 50–60 karakter ideal.</li>
          <li>• <strong className="text-gray-300">Meta Description</strong>: Tulis deskripsi persuasif yang mengundang klik, 120–160 karakter, sertakan keyword.</li>
          <li>• <strong className="text-gray-300">OG Image</strong>: Gunakan gambar 1200×630 px untuk tampilan optimal saat dibagikan di media sosial.</li>
          <li>• <strong className="text-gray-300">Canonical URL</strong>: Selalu isi untuk menghindari penalty konten duplikat dari Google.</li>
          <li>• <strong className="text-gray-300">Twitter Card</strong>: <code className="bg-gray-800 px-1 rounded">summary_large_image</code> memberikan tampilan paling menarik di Twitter/X.</li>
        </ul>
      </div>
    </div>
  );
}
