import React, { useState, useEffect } from 'react';
import { Users, Plus, RefreshCw, Copy, UserPlus, LogOut, Trash2, X, Crown, UserCheck } from 'lucide-react';
import api from '../utils/api';

export default function TeamPage() {
  const [data, setData] = useState({ owned: [], member: [] });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [joinCode, setJoinCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await api.get('/teams'); setData(res.data); } catch {}
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/teams', { name: form.name });
      setShowCreate(false); setForm({ name: '' }); fetchData();
    } catch (e) { alert(e.response?.data?.error || 'Gagal membuat tim'); }
    finally { setSaving(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/teams/join', { invite_code: joinCode });
      alert(res.data.message); setShowJoin(false); setJoinCode(''); fetchData();
    } catch (e) { alert(e.response?.data?.error || 'Gagal bergabung'); }
    finally { setSaving(false); }
  };

  const handleRegenCode = async (teamId) => {
    if (!confirm('Reset kode undangan? Kode lama tidak bisa dipakai lagi.')) return;
    try { await api.post(`/teams/${teamId}/regenerate-code`); fetchData(); } catch (e) { alert(e.response?.data?.error); }
  };

  const handleKick = async (teamId, memberId, name) => {
    if (!confirm(`Keluarkan ${name} dari tim?`)) return;
    try { await api.delete(`/teams/${teamId}/members/${memberId}`); fetchData(); } catch (e) { alert(e.response?.data?.error); }
  };

  const handleLeave = async (teamId, teamName) => {
    if (!confirm(`Keluar dari tim "${teamName}"?`)) return;
    try { await api.post(`/teams/leave/${teamId}`); fetchData(); } catch (e) { alert(e.response?.data?.error); }
  };

  const handleDelete = async (teamId, teamName) => {
    if (!confirm(`Hapus tim "${teamName}" permanen?`)) return;
    try { await api.delete(`/teams/${teamId}`); fetchData(); } catch (e) { alert(e.response?.data?.error); }
  };

  const copyCode = (code) => { navigator.clipboard.writeText(code); alert('Kode undangan disalin!'); };

  const allTeams = [...data.owned, ...data.member];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Users size={22} /> Manajemen Tim</h1>
          <p className="text-gray-400 text-sm mt-1">Undang anggota dan kelola akses tim Anda</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowJoin(true)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm"><UserPlus size={15} /> Gabung Tim</button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm"><Plus size={15} /> Buat Tim</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : allTeams.length === 0 ? (
        <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800">
          <Users size={48} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400 mb-2">Anda belum memiliki tim</p>
          <p className="text-gray-600 text-sm">Buat tim baru atau masukkan kode undangan untuk bergabung</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allTeams.map(team => (
            <div key={team.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white font-bold text-lg">{team.name}</h2>
                    {team.role === 'owner' && <span className="bg-yellow-900/40 text-yellow-400 border border-yellow-800/50 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"><Crown size={10} /> Owner</span>}
                    {team.role === 'member' && <span className="bg-blue-900/40 text-blue-400 border border-blue-800/50 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"><UserCheck size={10} /> Anggota</span>}
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{team.members?.length || 0} anggota</p>
                </div>
                <div className="flex gap-2">
                  {team.role === 'owner' && (
                    <button onClick={() => handleDelete(team.id, team.name)} className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"><Trash2 size={15} /></button>
                  )}
                  {team.role === 'member' && (
                    <button onClick={() => handleLeave(team.id, team.name)} className="flex items-center gap-1 text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors border border-red-800/40"><LogOut size={13} /> Keluar</button>
                  )}
                </div>
              </div>

              {team.role === 'owner' && (
                <div className="mb-4 bg-gray-800/60 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Kode Undangan</p>
                    <p className="text-white font-mono font-bold text-lg tracking-widest">{team.invite_code}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copyCode(team.invite_code)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"><Copy size={13} /> Salin</button>
                    <button onClick={() => handleRegenCode(team.id)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"><RefreshCw size={13} /> Reset</button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Anggota</p>
                <div className="space-y-2">
                  {(team.members || []).map(m => (
                    <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-gray-800/40 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${m.role === 'owner' ? 'bg-yellow-600' : 'bg-blue-600'}`}>{m.username?.[0]?.toUpperCase()}</div>
                        <div>
                          <p className="text-white text-sm font-medium">{m.username}</p>
                          {m.full_name && <p className="text-gray-500 text-xs">{m.full_name}</p>}
                        </div>
                        {m.role === 'owner' && <Crown size={12} className="text-yellow-400 ml-1" />}
                      </div>
                      {team.role === 'owner' && m.role !== 'owner' && (
                        <button onClick={() => handleKick(team.id, m.id, m.username)} className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-900/20 transition-colors"><X size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Buat Tim Baru</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Nama Tim</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Tim Marketing A" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm">Batal</button>
                <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium">
                  {saving ? 'Membuat...' : 'Buat Tim'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Gabung Tim</h2>
              <button onClick={() => setShowJoin(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Kode Undangan</label>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Masukkan kode (contoh: A1B2C3D4)" maxLength={8} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono tracking-widest text-center text-lg focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowJoin(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm">Batal</button>
                <button onClick={handleJoin} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium">
                  {saving ? 'Bergabung...' : 'Gabung'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
