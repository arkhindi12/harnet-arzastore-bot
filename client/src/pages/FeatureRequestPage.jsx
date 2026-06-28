import React, { useState, useEffect } from 'react';
import { ThumbsUp, Plus, Lightbulb, CheckCircle, Clock, Zap, XCircle, ChevronUp, MessageSquare, RefreshCw, Filter, Flame, Star, Send, Trash2, Edit2, Check } from 'lucide-react';
import api from '../utils/api';

const CATEGORIES = ['umum', 'auto-comment', 'auto-post', 'monitor', 'warming', 'analitik', 'integrasi', 'lainnya'];

const STATUS_CONFIG = {
  pending:     { label: 'Diusulkan',   color: 'text-gray-400',   bg: 'bg-gray-800',          icon: Clock },
  planned:     { label: 'Direncanakan',color: 'text-blue-400',   bg: 'bg-blue-900/40',       icon: Star },
  in_progress: { label: 'Dikerjakan',  color: 'text-yellow-400', bg: 'bg-yellow-900/40',     icon: Zap },
  done:        { label: 'Selesai',     color: 'text-green-400',  bg: 'bg-green-900/40',      icon: CheckCircle },
  rejected:    { label: 'Ditolak',     color: 'text-red-400',    bg: 'bg-red-900/40',        icon: XCircle },
};

const CAT_LABELS = {
  umum: 'Umum', 'auto-comment': 'Auto Komentar', 'auto-post': 'Auto Post',
  monitor: 'Monitor', warming: 'Warming', analitik: 'Analitik', integrasi: 'Integrasi', lainnya: 'Lainnya',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

function SubmitModal({ onClose, onSubmitted }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'umum' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.title.trim()) return setError('Judul wajib diisi');
    if (form.title.length > 120) return setError('Judul maksimal 120 karakter');
    setSaving(true); setError('');
    try {
      await api.post('/feature-requests', form);
      onSubmitted();
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal mengirim request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><Lightbulb size={18} className="text-yellow-400" /> Usul Fitur Baru</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Judul Fitur * <span className="text-gray-600">({form.title.length}/120)</span></label>
            <input className="input w-full" maxLength={120} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Misal: Export laporan komentar ke Excel" autoFocus />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Kategori</label>
            <select className="input w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Deskripsi (opsional) — jelaskan lebih detail</label>
            <textarea className="input w-full resize-none" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ceritakan kebutuhan Anda, kenapa fitur ini penting, dan bagaimana seharusnya bekerja..." />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button onClick={submit} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Send size={14} />{saving ? 'Mengirim...' : 'Kirim Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminEditModal({ item, onClose, onSaved }) {
  const [status, setStatus] = useState(item.status || 'pending');
  const [note, setNote] = useState(item.admin_note || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/feature-requests/admin/${item.id}`, { status, admin_note: note });
      onSaved();
    } catch (e) { alert(e.response?.data?.error || 'Gagal'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold">Kelola Request Fitur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-white font-medium">{item.title}</p>
            {item.description && <p className="text-gray-400 text-sm mt-1">{item.description}</p>}
            <p className="text-gray-600 text-xs mt-2">oleh {item.author_name} • {item.vote_count} vote</p>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Status</label>
            <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Catatan Admin (akan ditampilkan ke user)</label>
            <textarea className="input w-full resize-none" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Misal: Fitur ini akan kami kerjakan di sprint berikutnya..." />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ item, isAdmin, onVote, onAdminEdit, onAdminDelete }) {
  const [voting, setVoting] = useState(false);
  const [localVoted, setLocalVoted] = useState(item.has_voted);
  const [localCount, setLocalCount] = useState(item.vote_count);

  const handleVote = async () => {
    if (voting) return;
    setVoting(true);
    try {
      const r = await api.post(`/feature-requests/${item.id}/vote`);
      setLocalVoted(r.data.voted);
      setLocalCount(r.data.vote_count);
      onVote?.();
    } catch {} finally { setVoting(false); }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className={`card flex gap-4 transition-all ${item.status === 'done' ? 'opacity-75' : ''}`}>
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <button
          onClick={handleVote}
          disabled={voting}
          className={`flex flex-col items-center gap-0.5 w-12 py-2 rounded-xl transition-all border ${
            localVoted
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400'
          }`}
        >
          <ChevronUp size={18} />
          <span className="text-sm font-bold leading-none">{localCount}</span>
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-white font-semibold leading-snug">{item.title}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isAdmin && (
              <>
                <button onClick={() => onAdminEdit(item)} className="p-1 text-gray-500 hover:text-blue-400 transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => onAdminDelete(item.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        </div>
        {item.description && <p className="text-gray-400 text-sm mb-2 line-clamp-2">{item.description}</p>}
        {item.admin_note && (
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg px-3 py-2 mb-2">
            <p className="text-blue-300 text-xs"><span className="font-semibold">Tim:</span> {item.admin_note}</p>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={item.status} />
          <span className="bg-gray-800 text-gray-500 text-xs px-2 py-0.5 rounded-full">{CAT_LABELS[item.category] || item.category}</span>
          <span className="text-gray-600 text-xs">oleh {item.author_name} • {formatDate(item.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function FeatureRequestPage({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sort, setSort] = useState('votes');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const isAdmin = user?.role === 'admin';

  const load = (s = sort, st = filterStatus) => {
    setLoading(true);
    api.get(`/feature-requests?sort=${s}&status=${st}`)
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filterCat === 'all' ? items : items.filter(i => i.category === filterCat);

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus request ini?')) return;
    await api.delete(`/feature-requests/admin/${id}`);
    load();
  };

  const stats = {
    total: items.length,
    planned: items.filter(i => i.status === 'planned').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
    done: items.filter(i => i.status === 'done').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Lightbulb size={22} className="text-yellow-400" /> Request Fitur
          </h1>
          <p className="text-gray-400 mt-1">Usulkan fitur baru dan vote untuk fitur yang paling Anda butuhkan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="btn-secondary p-2" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Usulkan Fitur
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Usulan', value: stats.total, icon: MessageSquare, color: 'text-blue-400' },
          { label: 'Direncanakan', value: stats.planned, icon: Star, color: 'text-blue-400' },
          { label: 'Dikerjakan', value: stats.inProgress, icon: Zap, color: 'text-yellow-400' },
          { label: 'Selesai', value: stats.done, icon: CheckCircle, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card py-3">
            <div className="flex items-center gap-2">
              <Icon size={16} className={color} />
              <p className="text-gray-400 text-xs">{label}</p>
            </div>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
          {[['votes', <Flame size={13} />, 'Terpopuler'], ['new', <Clock size={13} />, 'Terbaru']].map(([k, icon, label]) => (
            <button key={k} onClick={() => { setSort(k); load(k, filterStatus); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${sort === k ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 flex-wrap">
          {[['all', 'Semua'], ['pending', 'Diusulkan'], ['planned', 'Direncanakan'], ['in_progress', 'Dikerjakan'], ['done', 'Selesai']].map(([k, label]) => (
            <button key={k} onClick={() => { setFilterStatus(k); load(sort, k); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === k ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>

        <select className="input text-sm py-1.5 px-3" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">Semua Kategori</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={52} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-semibold mb-2">Belum ada usulan fitur</p>
          <p className="text-gray-600 mb-6">Jadilah yang pertama mengusulkan fitur baru!</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">Usulkan Fitur Pertama</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, idx) => (
            <div key={item.id} className="relative">
              {idx === 0 && item.vote_count > 0 && sort === 'votes' && (
                <div className="absolute -top-2 -left-2 z-10">
                  <span className="bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">🔥 #1</span>
                </div>
              )}
              <FeatureCard
                item={item}
                isAdmin={isAdmin}
                onVote={() => load()}
                onAdminEdit={(i) => setEditItem(i)}
                onAdminDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      <div className="card bg-blue-900/10 border-blue-800/20">
        <h3 className="text-blue-300 font-semibold mb-2 flex items-center gap-2"><ThumbsUp size={15} /> Cara Voting</h3>
        <p className="text-gray-400 text-sm">Klik tombol ▲ di sebelah kiri untuk vote fitur yang Anda inginkan. Fitur dengan vote terbanyak akan diprioritaskan oleh tim pengembang. Anda bisa membatalkan vote kapan saja.</p>
      </div>

      {showModal && <SubmitModal onClose={() => setShowModal(false)} onSubmitted={() => { setShowModal(false); load(); }} />}
      {editItem && <AdminEditModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }} />}
    </div>
  );
}
