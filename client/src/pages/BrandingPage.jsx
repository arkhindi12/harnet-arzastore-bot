import React, { useState, useEffect, useRef } from 'react';
import { Save, Image, Palette, Type, Globe, CheckCircle, Upload } from 'lucide-react';
import api from '../utils/api';
import { refreshBranding } from '../hooks/useBranding';

export default function BrandingPage() {
  const [form, setForm] = useState({
    brand_name: '',
    brand_tagline: '',
    brand_logo_url: '',
    brand_icon_url: '',
    brand_primary_color: '#2563eb',
    favicon_url: '',
    brand_logo_size: '100',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState('');

  const handleUpload = async (field) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.svg,.ico';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert('File terlalu besar (max 5MB)'); return; }
      setUploading(field);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setForm(prev => ({ ...prev, [field]: res.data.url }));
      } catch (err) {
        alert(err.response?.data?.error || 'Gagal upload');
      } finally { setUploading(''); }
    };
    input.click();
  };

  useEffect(() => {
    api.get('/admin/seo').then(r => {
      setForm(prev => ({
        ...prev,
        brand_name: r.data.brand_name || 'ArzaBot',
        brand_tagline: r.data.brand_tagline || '',
        brand_logo_url: r.data.brand_logo_url || '',
        brand_icon_url: r.data.brand_icon_url || '',
        brand_primary_color: r.data.brand_primary_color || '#2563eb',
        brand_logo_size: r.data.brand_logo_size || '100',
        favicon_url: r.data.favicon_url || '/favicon.svg',
      }));
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      await api.put('/admin/seo', form);
      setSaved(true);
      refreshBranding(); // Update sidebar/navbar langsung tanpa refresh halaman
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Palette size={22} className="text-purple-400" /> Branding & Logo</h1>
        <p className="text-gray-400 mt-1 text-sm">Atur nama brand, logo, icon, dan warna utama. Perubahan langsung tampil di landing page, sidebar, login, dan seluruh UI.</p>
      </div>

      {saved && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-4 py-3 flex items-center gap-2 text-emerald-300 text-sm">
          <CheckCircle size={16} /> Branding berhasil disimpan. Refresh halaman untuk melihat perubahan.
        </div>
      )}

      <div className="card space-y-5">
        <h2 className="text-white font-semibold flex items-center gap-2"><Type size={16} /> Identitas Brand</h2>

        <div>
          <label className="label">Nama Brand</label>
          <input className="input" value={form.brand_name} onChange={e => setForm(p => ({ ...p, brand_name: e.target.value }))} placeholder="ArzaBot" />
          <p className="text-gray-500 text-xs mt-1">Tampil di navbar, sidebar, footer, dan title halaman.</p>
        </div>

        <div>
          <label className="label">Tagline (opsional)</label>
          <input className="input" value={form.brand_tagline} onChange={e => setForm(p => ({ ...p, brand_tagline: e.target.value }))} placeholder="Platform Otomasi Facebook Terpercaya" />
          <p className="text-gray-500 text-xs mt-1">Tampil di bawah logo di sidebar dan footer.</p>
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="text-white font-semibold flex items-center gap-2"><Image size={16} /> Logo & Icon</h2>

        <div>
          <label className="label">Logo (gambar penuh, lebar ~200px)</label>
          <div className="flex gap-2">
            <input className="input font-mono text-sm flex-1" value={form.brand_logo_url} onChange={e => setForm(p => ({ ...p, brand_logo_url: e.target.value }))} placeholder="https://example.com/logo.png atau upload" />
            <button type="button" onClick={() => handleUpload('brand_logo_url')} disabled={uploading === 'brand_logo_url'} className="btn-secondary flex-shrink-0 flex items-center gap-1.5">
              <Upload size={14} /> {uploading === 'brand_logo_url' ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-1">Dipakai di navbar dan landing page. Kosongkan untuk pakai teks nama brand saja.</p>
          {form.brand_logo_url && (
            <div className="mt-3 space-y-3">
              <div className="p-3 bg-gray-800 rounded-xl border border-gray-700" style={{ width: `${form.brand_logo_size || 100}%`, maxWidth: '100%' }}>
                <img src={form.brand_logo_url} alt="Logo preview" className="w-full object-contain" onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <div>
                <label className="label flex items-center justify-between">
                  <span>Ukuran Logo</span>
                  <span className="text-blue-400 font-mono text-xs">{form.brand_logo_size || 100}%</span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="5"
                  value={form.brand_logo_size || 100}
                  onChange={e => setForm(p => ({ ...p, brand_logo_size: e.target.value }))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>Kecil (30%)</span>
                  <span>Penuh (100%)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="label">Icon (kotak, ~64x64px, untuk sidebar & favicon)</label>
          <div className="flex gap-2">
            <input className="input font-mono text-sm flex-1" value={form.brand_icon_url} onChange={e => setForm(p => ({ ...p, brand_icon_url: e.target.value }))} placeholder="https://example.com/icon.png atau upload" />
            <button type="button" onClick={() => handleUpload('brand_icon_url')} disabled={uploading === 'brand_icon_url'} className="btn-secondary flex-shrink-0 flex items-center gap-1.5">
              <Upload size={14} /> {uploading === 'brand_icon_url' ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-1">Dipakai sebagai icon kecil di sidebar header dan mobile. Kosongkan untuk pakai icon default.</p>
          {form.brand_icon_url && (
            <div className="mt-3 p-3 bg-gray-800 rounded-xl border border-gray-700 inline-flex items-center gap-3">
              <img src={form.brand_icon_url} alt="Icon preview" className="w-9 h-9 rounded-lg object-cover" onError={e => { e.target.style.display = 'none'; }} />
              <span className="text-gray-400 text-xs">Preview icon</span>
            </div>
          )}
        </div>

        <div>
          <label className="label">Favicon (browser tab icon)</label>
          <div className="flex gap-2">
            <input className="input font-mono text-sm flex-1" value={form.favicon_url} onChange={e => setForm(p => ({ ...p, favicon_url: e.target.value }))} placeholder="/favicon.svg atau upload" />
            <button type="button" onClick={() => handleUpload('favicon_url')} disabled={uploading === 'favicon_url'} className="btn-secondary flex-shrink-0 flex items-center gap-1.5">
              <Upload size={14} /> {uploading === 'favicon_url' ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-1">Icon kecil di tab browser. Bisa SVG, PNG, atau ICO.</p>
          {form.favicon_url && form.favicon_url !== '/favicon.svg' && (
            <div className="mt-3 p-3 bg-gray-800 rounded-xl border border-gray-700 inline-flex items-center gap-3">
              <img src={form.favicon_url} alt="Favicon preview" className="w-6 h-6 object-contain" onError={e => { e.target.style.display = 'none'; }} />
              <span className="text-gray-400 text-xs">Preview favicon</span>
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="text-white font-semibold flex items-center gap-2"><Palette size={16} /> Warna Utama</h2>

        <div>
          <label className="label">Primary Color (hex)</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.brand_primary_color} onChange={e => setForm(p => ({ ...p, brand_primary_color: e.target.value }))} className="w-12 h-10 rounded-lg border border-gray-700 cursor-pointer bg-transparent" />
            <input className="input flex-1 font-mono" value={form.brand_primary_color} onChange={e => setForm(p => ({ ...p, brand_primary_color: e.target.value }))} placeholder="#2563eb" />
          </div>
          <p className="text-gray-500 text-xs mt-1">Warna utama untuk tombol CTA, badge, dan aksen UI.</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="px-5 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: form.brand_primary_color }}>Preview Tombol</div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold border" style={{ borderColor: form.brand_primary_color, color: form.brand_primary_color }}>Preview Badge</div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-6">
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Branding'}
        </button>
      </div>
    </div>
  );
}
