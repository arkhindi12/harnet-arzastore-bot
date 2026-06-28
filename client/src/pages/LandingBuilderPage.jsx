import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Eye, EyeOff, Trash2, Plus, Save, ExternalLink, ChevronLeft,
  Target, BarChart2, Sparkles, List, Users, Star, CreditCard, Megaphone,
  Bell, Type, ChevronDown, ChevronUp, CheckCircle, Facebook, RefreshCw,
  Settings, X, Copy, AlertCircle
} from 'lucide-react';
import api from '../utils/api';

const BLOCK_TYPES = [
  { type: 'hero', label: 'Hero Banner', icon: Target, color: 'blue', desc: 'Judul besar + tombol CTA' },
  { type: 'stats', label: 'Statistik', icon: BarChart2, color: 'green', desc: 'Angka-angka statistik' },
  { type: 'features', label: 'Grid Fitur', icon: Sparkles, color: 'purple', desc: '12 fitur dengan icon' },
  { type: 'how_it_works', label: 'Cara Kerja', icon: List, color: 'orange', desc: '3 langkah penggunaan' },
  { type: 'target_users', label: 'Target Pengguna', icon: Users, color: 'teal', desc: 'Kategori bisnis' },
  { type: 'testimonials', label: 'Testimoni', icon: Star, color: 'yellow', desc: 'Ulasan pelanggan' },
  { type: 'pricing', label: 'Harga & Paket', icon: CreditCard, color: 'indigo', desc: 'Tabel harga 3 tier' },
  { type: 'cta_banner', label: 'Banner CTA', icon: Megaphone, color: 'pink', desc: 'Ajakan bertindak' },
  { type: 'announcement', label: 'Pengumuman', icon: Bell, color: 'red', desc: 'Bar notifikasi atas' },
  { type: 'text_block', label: 'Blok Teks', icon: Type, color: 'gray', desc: 'Teks bebas kustom' },
];

const COLOR_MAP = {
  blue: 'bg-blue-900/30 border-blue-700/50 text-blue-400',
  green: 'bg-green-900/30 border-green-700/50 text-green-400',
  purple: 'bg-purple-900/30 border-purple-700/50 text-purple-400',
  orange: 'bg-orange-900/30 border-orange-700/50 text-orange-400',
  teal: 'bg-teal-900/30 border-teal-700/50 text-teal-400',
  yellow: 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400',
  indigo: 'bg-indigo-900/30 border-indigo-700/50 text-indigo-400',
  pink: 'bg-pink-900/30 border-pink-700/50 text-pink-400',
  red: 'bg-red-900/30 border-red-700/50 text-red-400',
  gray: 'bg-gray-800/50 border-gray-600/50 text-gray-400',
};

const ICON_COLOR_MAP = {
  blue: 'text-blue-400', green: 'text-green-400', purple: 'text-purple-400',
  orange: 'text-orange-400', teal: 'text-teal-400', yellow: 'text-yellow-400',
  indigo: 'text-indigo-400', pink: 'text-pink-400', red: 'text-red-400', gray: 'text-gray-400',
};

function getBlockDef(type) { return BLOCK_TYPES.find(b => b.type === type) || BLOCK_TYPES[0]; }

function makeNewSection(type) {
  const defaults = {
    hero: { badge: '⚡ Badge Kepercayaan', title: 'Judul Hero Anda', subtitle: 'Subjudul yang menarik pengunjung untuk mendaftar.', cta_primary: 'Coba Gratis', cta_secondary: 'Pelajari Lebih Lanjut' },
    stats: { items: [{ value: '1.000+', label: 'Label 1' }, { value: '500+', label: 'Label 2' }, { value: '99%', label: 'Label 3' }, { value: '24/7', label: 'Label 4' }] },
    features: { title: 'Fitur Unggulan Kami', subtitle: 'Semua yang Anda butuhkan dalam satu platform' },
    how_it_works: { title: 'Cara Kerja', subtitle: 'Mudah, cepat, langsung jalan', steps: [{ step: '01', title: 'Langkah 1', desc: 'Deskripsi langkah pertama.' }, { step: '02', title: 'Langkah 2', desc: 'Deskripsi langkah kedua.' }, { step: '03', title: 'Langkah 3', desc: 'Deskripsi langkah ketiga.' }] },
    target_users: { title: 'Cocok untuk Siapa?', items: ['Kategori 1', 'Kategori 2', 'Kategori 3', 'Kategori 4', 'Kategori 5', 'Kategori 6'] },
    testimonials: { title: 'Apa Kata Pengguna Kami', items: [{ name: 'Nama Pengguna', role: 'Profesi / Kota', text: 'Testimoni yang meyakinkan tentang produk Anda...' }] },
    pricing: { title: 'Pilih Paket yang Sesuai', subtitle: 'Mulai gratis, upgrade kapan saja' },
    cta_banner: { title: 'Siap Memulai?', subtitle: 'Bergabunglah dengan ribuan pengguna puas kami.', cta_text: 'Mulai Sekarang' },
    announcement: { text: '🎉 Promo spesial! Diskon 50% untuk pendaftar baru.', bg_color: 'blue' },
    text_block: { heading: 'Judul Blok Teks', content: 'Isi konten teks Anda di sini. Bisa berupa informasi tambahan, deskripsi layanan, atau apapun yang ingin Anda sampaikan kepada pengunjung.', align: 'center' },
  };
  return { id: `s_${Date.now()}`, type, visible: true, data: defaults[type] || {} };
}

function SortableSection({ section, selected, onSelect, onDelete, onToggleVisible }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const def = getBlockDef(section.type);
  const Icon = def.icon;
  const colorClass = COLOR_MAP[def.color] || COLOR_MAP.gray;
  const iconColor = ICON_COLOR_MAP[def.color] || 'text-gray-400';

  return (
    <div ref={setNodeRef} style={style}
      className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none
        ${selected ? 'bg-blue-900/30 border-blue-500/70 shadow-lg shadow-blue-900/20' : 'bg-gray-900 border-gray-700/50 hover:border-gray-600'}`}
      onClick={() => onSelect(section.id)}>
      <button {...listeners} {...attributes}
        className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        onClick={e => e.stopPropagation()}>
        <GripVertical size={18} />
      </button>
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg border flex-shrink-0 ${colorClass}`}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{def.label}</p>
        <p className="text-gray-500 text-xs truncate">{section.data?.title || section.data?.text || '—'}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={() => onToggleVisible(section.id)}
          className={`p-1.5 rounded-lg transition-colors ${section.visible ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-400'}`}
          title={section.visible ? 'Sembunyikan' : 'Tampilkan'}>
          {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button onClick={() => onDelete(section.id)}
          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-colors" title="Hapus">
          <Trash2 size={14} />
        </button>
      </div>
      {!section.visible && (
        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">tersembunyi</span>
      )}
    </div>
  );
}

function PropertyField({ label, type = 'text', value, onChange, placeholder, options }) {
  if (type === 'textarea') return (
    <div>
      <label className="label">{label}</label>
      <textarea className="input resize-none text-sm" rows={3} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} />
    </div>
  );
  if (type === 'select') return (
    <div>
      <label className="label">{label}</label>
      <select className="input text-sm" value={value || ''} onChange={e => onChange(e.target.value)}>
        {(options || []).map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
  return (
    <div>
      <label className="label">{label}</label>
      <input type="text" className="input text-sm" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} />
    </div>
  );
}

function StatItemsEditor({ items, onChange }) {
  const update = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="bg-gray-800/50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-gray-500 font-medium">Statistik {i + 1}</p>
          <input className="input text-sm" placeholder="Nilai (misal: 10.000+)" value={item.value || ''} onChange={e => update(i, 'value', e.target.value)} />
          <input className="input text-sm" placeholder="Label" value={item.label || ''} onChange={e => update(i, 'label', e.target.value)} />
        </div>
      ))}
    </div>
  );
}

function StepsEditor({ steps, onChange }) {
  const update = (i, field, val) => {
    const next = [...steps];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const addStep = () => onChange([...steps, { step: String(steps.length + 1).padStart(2, '0'), title: 'Langkah Baru', desc: 'Deskripsi langkah ini.' }]);
  const removeStep = (i) => onChange(steps.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="bg-gray-800/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">Langkah {i + 1}</p>
            {steps.length > 1 && <button onClick={() => removeStep(i)} className="text-red-500 hover:text-red-400"><X size={12} /></button>}
          </div>
          <input className="input text-sm" placeholder="Label (misal: 01)" value={step.step || ''} onChange={e => update(i, 'step', e.target.value)} />
          <input className="input text-sm" placeholder="Judul langkah" value={step.title || ''} onChange={e => update(i, 'title', e.target.value)} />
          <textarea className="input text-sm resize-none" rows={2} placeholder="Deskripsi" value={step.desc || ''} onChange={e => update(i, 'desc', e.target.value)} />
        </div>
      ))}
      <button onClick={addStep} className="w-full text-sm text-blue-400 hover:text-blue-300 border border-dashed border-blue-800 hover:border-blue-700 py-2 rounded-xl transition-colors">
        <Plus size={13} className="inline mr-1" /> Tambah Langkah
      </button>
    </div>
  );
}

function TestimonialsEditor({ items, onChange }) {
  const update = (i, field, val) => { const next = [...items]; next[i] = { ...next[i], [field]: val }; onChange(next); };
  const add = () => onChange([...items, { name: 'Nama Pengguna', role: 'Profesi', text: 'Testimoni...' }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="bg-gray-800/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">Testimoni {i + 1}</p>
            {items.length > 1 && <button onClick={() => remove(i)} className="text-red-500 hover:text-red-400"><X size={12} /></button>}
          </div>
          <input className="input text-sm" placeholder="Nama" value={item.name || ''} onChange={e => update(i, 'name', e.target.value)} />
          <input className="input text-sm" placeholder="Profesi / Kota" value={item.role || ''} onChange={e => update(i, 'role', e.target.value)} />
          <textarea className="input text-sm resize-none" rows={2} placeholder="Isi testimoni..." value={item.text || ''} onChange={e => update(i, 'text', e.target.value)} />
        </div>
      ))}
      {items.length < 6 && (
        <button onClick={add} className="w-full text-sm text-blue-400 hover:text-blue-300 border border-dashed border-blue-800 hover:border-blue-700 py-2 rounded-xl transition-colors">
          <Plus size={13} className="inline mr-1" /> Tambah Testimoni
        </button>
      )}
    </div>
  );
}

function TagsEditor({ items, onChange }) {
  const update = (i, val) => { const next = [...items]; next[i] = val; onChange(next); };
  const add = () => onChange([...items, 'Kategori Baru']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input className="input text-sm flex-1" value={item} onChange={e => update(i, e.target.value)} />
          <button onClick={() => remove(i)} className="text-red-500 hover:text-red-400 px-2"><X size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="w-full text-sm text-blue-400 hover:text-blue-300 border border-dashed border-blue-800 hover:border-blue-700 py-2 rounded-xl transition-colors">
        <Plus size={13} className="inline mr-1" /> Tambah Item
      </button>
    </div>
  );
}

function PropertyEditor({ section, onChange }) {
  if (!section) return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
        <Settings size={24} className="text-gray-600" />
      </div>
      <p className="text-gray-400 font-medium text-sm">Pilih blok di canvas</p>
      <p className="text-gray-600 text-xs mt-1">Klik salah satu blok untuk mengedit isinya</p>
    </div>
  );

  const def = getBlockDef(section.type);
  const Icon = def.icon;
  const d = section.data || {};

  const set = (key, val) => onChange({ ...section, data: { ...d, [key]: val } });

  const renderFields = () => {
    switch (section.type) {
      case 'hero': return (
        <div className="space-y-4">
          <PropertyField label="Badge Kepercayaan" value={d.badge} onChange={v => set('badge', v)} placeholder="⚡ Dipercaya 500+ pengguna..." />
          <PropertyField label="Judul Utama" type="textarea" value={d.title} onChange={v => set('title', v)} />
          <PropertyField label="Subjudul / Deskripsi" type="textarea" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <PropertyField label="Teks Tombol Utama (Daftar)" value={d.cta_primary} onChange={v => set('cta_primary', v)} placeholder="Coba Gratis 3 Hari" />
          <PropertyField label="Teks Tombol Sekunder" value={d.cta_secondary} onChange={v => set('cta_secondary', v)} placeholder="Pelajari Lebih Lanjut" />
        </div>
      );
      case 'stats': return (
        <div className="space-y-3">
          <p className="label">4 Kotak Statistik</p>
          <StatItemsEditor items={d.items || []} onChange={v => set('items', v)} />
        </div>
      );
      case 'features': return (
        <div className="space-y-4">
          <PropertyField label="Judul Seksi" value={d.title} onChange={v => set('title', v)} />
          <PropertyField label="Subjudul" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <div className="bg-gray-800/50 rounded-xl p-3 text-xs text-gray-500">
            <AlertCircle size={12} className="inline mr-1" />
            Daftar 12 fitur bawaan bisa dikustomisasi langsung dari kode. Kontak developer untuk mengubahnya.
          </div>
        </div>
      );
      case 'how_it_works': return (
        <div className="space-y-4">
          <PropertyField label="Judul Seksi" value={d.title} onChange={v => set('title', v)} />
          <PropertyField label="Subjudul" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <div>
            <p className="label mb-2">Langkah-langkah</p>
            <StepsEditor steps={d.steps || []} onChange={v => set('steps', v)} />
          </div>
        </div>
      );
      case 'target_users': return (
        <div className="space-y-4">
          <PropertyField label="Judul Seksi" value={d.title} onChange={v => set('title', v)} />
          <div>
            <p className="label mb-2">Daftar Kategori</p>
            <TagsEditor items={d.items || []} onChange={v => set('items', v)} />
          </div>
        </div>
      );
      case 'testimonials': return (
        <div className="space-y-4">
          <PropertyField label="Judul Seksi" value={d.title} onChange={v => set('title', v)} />
          <div>
            <p className="label mb-2">Testimoni</p>
            <TestimonialsEditor items={d.items || []} onChange={v => set('items', v)} />
          </div>
        </div>
      );
      case 'pricing': return (
        <div className="space-y-4">
          <PropertyField label="Judul Seksi" value={d.title} onChange={v => set('title', v)} />
          <PropertyField label="Subjudul" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <div className="bg-gray-800/50 rounded-xl p-3 text-xs text-gray-500">
            <AlertCircle size={12} className="inline mr-1" />
            Paket harga diambil dari data paket di admin panel (Langganan & Harga).
          </div>
        </div>
      );
      case 'cta_banner': return (
        <div className="space-y-4">
          <PropertyField label="Judul Banner" type="textarea" value={d.title} onChange={v => set('title', v)} />
          <PropertyField label="Subjudul" value={d.subtitle} onChange={v => set('subtitle', v)} />
          <PropertyField label="Teks Tombol CTA" value={d.cta_text} onChange={v => set('cta_text', v)} placeholder="Mulai Sekarang" />
        </div>
      );
      case 'announcement': return (
        <div className="space-y-4">
          <PropertyField label="Teks Pengumuman" value={d.text} onChange={v => set('text', v)} placeholder="🎉 Promo spesial! Diskon 50%..." />
          <PropertyField label="Warna Latar" type="select" value={d.bg_color || 'blue'} onChange={v => set('bg_color', v)}
            options={[
              { value: 'blue', label: 'Biru' }, { value: 'green', label: 'Hijau' },
              { value: 'red', label: 'Merah' }, { value: 'purple', label: 'Ungu' },
              { value: 'orange', label: 'Oranye' }, { value: 'teal', label: 'Teal' },
            ]} />
        </div>
      );
      case 'text_block': return (
        <div className="space-y-4">
          <PropertyField label="Judul (opsional)" value={d.heading} onChange={v => set('heading', v)} />
          <PropertyField label="Konten" type="textarea" value={d.content} onChange={v => set('content', v)} />
          <PropertyField label="Alignment" type="select" value={d.align || 'center'} onChange={v => set('align', v)}
            options={[{ value: 'left', label: 'Kiri' }, { value: 'center', label: 'Tengah' }, { value: 'right', label: 'Kanan' }]} />
        </div>
      );
      default: return <p className="text-gray-500 text-sm">Tidak ada properti untuk tipe ini.</p>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-800 flex-shrink-0`}>
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${COLOR_MAP[def.color]}`}>
          <Icon size={13} />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">{def.label}</p>
          <p className="text-gray-500 text-xs">{def.desc}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {renderFields()}
      </div>
    </div>
  );
}

export default function LandingBuilderPage() {
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const navigate = useNavigate();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    api.get('/landing/sections').then(r => {
      setSections(r.data);
      if (r.data.length > 0) setSelected(r.data[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectedSection = sections.find(s => s.id === selected);

  const handleDragStart = (e) => setActiveId(e.active.id);
  const handleDragEnd = (e) => {
    const { active, over } = e;
    setActiveId(null);
    if (active.id !== over?.id) {
      setSections(prev => {
        const oldIdx = prev.findIndex(s => s.id === active.id);
        const newIdx = prev.findIndex(s => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const handleDelete = (id) => {
    if (!confirm('Hapus blok ini?')) return;
    setSections(prev => prev.filter(s => s.id !== id));
    if (selected === id) setSelected(sections.find(s => s.id !== id)?.id || null);
  };

  const handleToggleVisible = (id) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  const handleAddBlock = (type) => {
    const newSection = makeNewSection(type);
    setSections(prev => [...prev, newSection]);
    setSelected(newSection.id);
    setTimeout(() => {
      document.getElementById('canvas-bottom')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleUpdateSection = (updated) => {
    setSections(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/landing/sections', { sections });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Gagal menyimpan. Coba lagi.');
    } finally { setSaving(false); }
  };

  const activeSection = sections.find(s => s.id === activeId);
  const activeDef = activeSection ? getBlockDef(activeSection.type) : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-4 sm:-m-6">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Facebook size={13} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">Landing Page Builder</span>
          </div>
          <span className="text-gray-600 text-sm hidden sm:block">· {sections.length} blok · {sections.filter(s => s.visible).length} tampil</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-colors">
            <ExternalLink size={12} /> Preview
          </a>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${saved ? 'bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {saved ? <><CheckCircle size={12} /> Tersimpan!</> : saving ? <><RefreshCw size={12} className="animate-spin" /> Menyimpan...</> : <><Save size={12} /> Publikasikan</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 flex-shrink-0 bg-gray-900/50 border-r border-gray-800 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tambah Blok</p>
            <div className="space-y-1.5">
              {BLOCK_TYPES.map(b => {
                const Icon = b.icon;
                return (
                  <button key={b.type} onClick={() => handleAddBlock(b.type)}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-all group text-left">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${COLOR_MAP[b.color]}`}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-medium">{b.label}</p>
                      <p className="text-gray-600 text-xs truncate">{b.desc}</p>
                    </div>
                    <Plus size={13} className="text-gray-700 group-hover:text-blue-400 flex-shrink-0 ml-auto transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-gray-950 overflow-y-auto">
          <div className="p-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Susunan Halaman</p>
              <p className="text-xs text-gray-600">Drag untuk mengurutkan ulang</p>
            </div>
            {sections.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-800 rounded-2xl">
                <p className="text-gray-500 text-sm">Belum ada blok</p>
                <p className="text-gray-600 text-xs mt-1">Tambah blok dari panel kiri</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {sections.map(section => (
                      <SortableSection
                        key={section.id}
                        section={section}
                        selected={selected === section.id}
                        onSelect={setSelected}
                        onDelete={handleDelete}
                        onToggleVisible={handleToggleVisible}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeSection && activeDef && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-gray-800 border-blue-500 shadow-xl opacity-90">
                      <GripVertical size={18} className="text-gray-500" />
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${COLOR_MAP[activeDef.color]}`}>
                        <activeDef.icon size={15} />
                      </div>
                      <span className="text-white text-sm font-medium">{activeDef.label}</span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
            <div id="canvas-bottom" className="h-4" />
            <button onClick={() => {}}
              className="w-full mt-3 py-3 border-2 border-dashed border-gray-800 hover:border-gray-700 rounded-xl text-gray-600 hover:text-gray-400 text-sm transition-colors flex items-center justify-center gap-2">
              <Plus size={16} /> Tambah blok dari panel kiri
            </button>
          </div>
        </div>

        <div className="w-72 flex-shrink-0 bg-gray-900/60 border-l border-gray-800 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-gray-800 flex-shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Edit Blok</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <PropertyEditor
              section={selectedSection}
              onChange={handleUpdateSection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
