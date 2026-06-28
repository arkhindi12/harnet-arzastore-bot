import React, { useState, useEffect, useCallback } from 'react';
import { Search, Compass, Plus, Loader, RefreshCw, Trash2, ArrowDownToLine, Award, Users, UserPlus, Play, StopCircle, Edit3, Save, X, Clock, ListChecks } from 'lucide-react';
import api from '../utils/api';

function GradeBadge({ grade }) {
  const styles = {
    A: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', color: '#86efac' },
    B: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#93c5fd' },
    C: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', color: '#fde68a' },
    D: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', color: '#fca5a5' },
  };
  const s = styles[grade] || styles.C;
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {grade}
    </span>
  );
}

function NicheTab() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [browserEngine, setBrowserEngine] = useState('patchright');
  const [maxRes, setMaxRes] = useState(30);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [groups, setGroups] = useState([]);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [runs, setRuns] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState(new Set());
  const [keywordEditMode, setKeywordEditMode] = useState(false);
  const [deletingKeywords, setDeletingKeywords] = useState(false);
  const [minMembers, setMinMembers] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [enriching, setEnriching] = useState('');

  const loadAll = useCallback(async (kw) => {
    try {
      const params = kw ? `?keyword=${encodeURIComponent(kw)}` : '';
      const [g, k, r] = await Promise.all([
        api.get(`/niche/groups${params}`),
        api.get('/niche/keywords'),
        api.get('/niche/runs?limit=10'),
      ]);
      setGroups(g.data); setKeywords(k.data); setRuns(r.data);
    } catch {}
  }, []);

  useEffect(() => {
    api.get('/accounts').then(r => {
      setAccounts(r.data);
      const active = r.data.find(a => a.status === 'active');
      if (active) setAccountId(active.id);
    });
    loadAll('');
  }, [loadAll]);

  const handleSearch = async () => {
    setError('');
    if (!accountId) return setError('Pilih akun dulu');
    if (!keyword.trim()) return setError('Keyword wajib diisi');
    setSearching(true);
    try {
      const r = await api.post('/niche/search', { account_id: accountId, keyword: keyword.trim(), max: Number(maxRes) || 30, browser_engine: browserEngine });
      if (!r.data?.success) throw new Error(r.data?.error || 'Gagal');
      setFilterKeyword(keyword.trim());
      await loadAll(keyword.trim());
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Gagal mencari niche');
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === groups.length) setSelected(new Set());
    else setSelected(new Set(groups.map(g => g.id)));
  };

  const handleImport = async () => {
    if (!accountId) return setError('Pilih akun dulu');
    if (selected.size === 0) return setError('Pilih grup dulu');
    setImporting(true);
    try {
      const r = await api.post('/niche/import', { account_id: accountId, ids: [...selected] });
      alert(`✅ ${r.data.imported || 0} grup berhasil ditambahkan ke akun.`);
      setSelected(new Set());
      loadAll(filterKeyword);
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal import');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus grup ini dari hasil niche?')) return;
    try {
      await api.delete(`/niche/groups/${id}`);
      setGroups(p => p.filter(g => g.id !== id));
    } catch (e) { alert('Gagal hapus'); }
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Search size={16} className="text-indigo-400" /> Cari Grup Niche</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Pilih akun...</option>
            {accounts.filter(a => a.status === 'active').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input
            className="input md:col-span-2"
            placeholder="Contoh: jual sepatu Bandung, dropshipper Jakarta, anak motor"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !searching && handleSearch()}
          />
          <input className="input" type="number" min={5} max={80} value={maxRes} onChange={e => setMaxRes(e.target.value)} placeholder="Max 30" />
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <div className="flex justify-between items-center mt-3">
          <p className="text-gray-500 text-xs">Bot akan buka Facebook Search dengan akun pilihan, ambil grup yang muncul, beserta jumlah anggota.</p>
          {/* Browser Engine selector */}
          <select className="input text-sm" style={{width:'auto'}} value={browserEngine} onChange={e => setBrowserEngine(e.target.value)}>
            <option value="patchright">Patchright</option>
            <option value="obscura">Obscura (ringan)</option>
          </select>
          <button className="btn-primary" disabled={searching} onClick={handleSearch}>
            {searching ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
            {searching ? 'Mencari...' : 'Cari Niche'}
          </button>
        </div>
      </div>

      {keywords.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-white text-sm font-semibold">Keyword Tersimpan</h3>
            <div className="flex gap-2 items-center">
              {keywordEditMode && (
                <>
                  <button
                    onClick={() => {
                      if (selectedKeywords.size === keywords.length) setSelectedKeywords(new Set());
                      else setSelectedKeywords(new Set(keywords.map(k => k.keyword)));
                    }}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    {selectedKeywords.size === keywords.length ? 'Kosongkan' : 'Pilih semua'}
                  </button>
                  <button
                    disabled={selectedKeywords.size === 0 || deletingKeywords}
                    onClick={async () => {
                      const list = [...selectedKeywords];
                      const totalGroups = keywords.filter(k => selectedKeywords.has(k.keyword)).reduce((s, k) => s + (k.count || 0), 0);
                      if (!confirm(`Hapus ${list.length} keyword (~${totalGroups} grup hasil)? Aksi ini tidak bisa dibatalkan.`)) return;
                      setDeletingKeywords(true);
                      try {
                        await api.delete('/niche/keywords', { data: { keywords: list } });
                        if (filterKeyword && selectedKeywords.has(filterKeyword)) setFilterKeyword('');
                        setSelectedKeywords(new Set());
                        setKeywordEditMode(false);
                        await loadAll('');
                      } catch (e) {
                        alert(e.response?.data?.error || 'Gagal hapus keyword');
                      } finally {
                        setDeletingKeywords(false);
                      }
                    }}
                    className="btn-danger text-xs"
                  >
                    <Trash2 size={12} /> Hapus {selectedKeywords.size > 0 ? `(${selectedKeywords.size})` : ''}
                  </button>
                  <button
                    onClick={() => { setKeywordEditMode(false); setSelectedKeywords(new Set()); }}
                    className="btn-secondary text-xs"
                  >
                    Batal
                  </button>
                </>
              )}
              {!keywordEditMode && (
                <button onClick={() => setKeywordEditMode(true)} className="btn-secondary text-xs">
                  <Trash2 size={12} /> Kelola
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!keywordEditMode && (
              <button onClick={() => { setFilterKeyword(''); loadAll(''); }} className={`px-3 py-1 rounded-full text-xs ${!filterKeyword ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                Semua ({groups.length})
              </button>
            )}
            {keywords.map(k => {
              const isSelected = selectedKeywords.has(k.keyword);
              const isFilter = filterKeyword === k.keyword;
              if (keywordEditMode) {
                return (
                  <label
                    key={k.keyword}
                    className={`px-3 py-1 rounded-full text-xs flex items-center gap-2 cursor-pointer ${isSelected ? 'bg-red-500/15 text-red-200 border border-red-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedKeywords(prev => {
                        const next = new Set(prev);
                        if (next.has(k.keyword)) next.delete(k.keyword); else next.add(k.keyword);
                        return next;
                      })}
                      className="w-3 h-3"
                    />
                    {k.keyword} <span className="text-gray-500">({k.count})</span>
                  </label>
                );
              }
              return (
                <button key={k.keyword} onClick={() => { setFilterKeyword(k.keyword); loadAll(k.keyword); }}
                  className={`px-3 py-1 rounded-full text-xs ${isFilter ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                  {k.keyword} <span className="text-gray-500 ml-1">({k.count})</span>
                </button>
              );
            })}
          </div>
          {keywordEditMode && (
            <p className="text-gray-500 text-xs mt-2">Centang keyword yang ingin dihapus. Semua grup hasil pencarian dan riwayat run untuk keyword tersebut juga akan dihapus.</p>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Compass size={16} className="text-blue-400" />
            Hasil Niche {filterKeyword ? <span className="text-blue-300 text-sm">"{filterKeyword}"</span> : ''}
            <span className="text-gray-500 text-sm">({groups.length})</span>
          </h3>
          <div className="flex gap-2">
            <button onClick={handleSelectAll} className="btn-secondary text-xs">{selected.size === groups.length && groups.length > 0 ? 'Kosongkan' : 'Pilih Semua'}</button>
            <button onClick={handleImport} disabled={importing || selected.size === 0 || !accountId} className="btn-primary text-xs">
              <ArrowDownToLine size={13} /> Import {selected.size} grup ke akun
            </button>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">Belum ada hasil. Coba cari keyword di atas.</div>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 mb-3 items-center">
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white w-24" placeholder="Min member" value={minMembers} onChange={e => setMinMembers(e.target.value)} />
              <input type="number" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white w-24" placeholder="Max member" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} />
              <select className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white" value={activityFilter} onChange={e => setActivityFilter(e.target.value)}>
                <option value="">Semua aktivitas</option>
                <option value="high">🔥 Tinggi</option>
                <option value="medium">⚡ Sedang</option>
                <option value="low">💤 Rendah</option>
              </select>
              <span className="text-gray-500 text-[10px]">Filter diterapkan langsung</span>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {groups.filter(g => {
                if (minMembers && (g.members_estimate || 0) < Number(minMembers)) return false;
                if (maxMembers && (g.members_estimate || 0) > Number(maxMembers)) return false;
                if (activityFilter && g.activity_level && g.activity_level !== activityFilter) return false;
                return true;
              }).map(g => (
              <div key={g.id} className={`rounded-lg p-3 border ${selected.has(g.id) ? 'bg-indigo-900/15 border-indigo-700/40' : 'bg-gray-800/50 border-gray-800'} flex items-start gap-3`}>
                <input type="checkbox" className="mt-1" checked={selected.has(g.id)} onChange={() => handleSelect(g.id)} />
                <div className="flex-1 min-w-0">
                  <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-white text-sm font-medium hover:text-indigo-300 truncate block">{g.name || g.url}</a>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {g.members_text && <span className="text-[11px] text-gray-300 bg-gray-700/50 px-2 py-0.5 rounded-full flex items-center gap-1"><Users size={10} /> {g.members_text} anggota</span>}
                    {g.privacy && <span className={`text-[11px] px-2 py-0.5 rounded-full ${g.privacy === 'public' ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'}`}>{g.privacy}</span>}
                    {g.imported ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">sudah diimport</span> : null}
                    <span className="text-[11px] text-gray-500">keyword: <span className="text-gray-300">{g.keyword}</span></span>
                  </div>
                  {g.description && <p className="text-gray-500 text-xs mt-1 line-clamp-1">{g.description}</p>}
                  {/* Enrichment data */}
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    {g.posts_per_day != null && g.enriched_at && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${g.activity_level === 'high' ? 'bg-emerald-500/15 text-emerald-300' : g.activity_level === 'medium' ? 'bg-yellow-500/15 text-yellow-300' : 'bg-gray-700/40 text-gray-400'}`}>
                        {g.activity_level === 'high' ? '🔥' : g.activity_level === 'medium' ? '⚡' : '💤'} ~{g.posts_per_day} post/hari
                      </span>
                    )}
                    {g.avg_comments != null && g.enriched_at && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">💬 ~{g.avg_comments} komentar/post</span>
                    )}
                    {!g.enriched_at && (
                      <button
                        type="button"
                        disabled={enriching === g.id}
                        onClick={async () => {
                          if (!accountId) { alert('Pilih akun dulu'); return; }
                          setEnriching(g.id);
                          try {
                            await api.post('/niche/enrich', { account_id: accountId, group_id: g.id });
                            await loadAll(filterKeyword);
                          } catch (e) { alert(e.response?.data?.error || 'Gagal enrich'); }
                          finally { setEnriching(''); }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 cursor-pointer"
                      >
                        {enriching === g.id ? '⏳ Analyzing...' : '🔍 Cek Aktivitas'}
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(g.id)} className="text-gray-500 hover:text-red-400" title="Hapus dari hasil"><Trash2 size={14} /></button>
              </div>
            ))}
            </div>
          </>
        )}
      </div>

      {runs.length > 0 && (
        <div className="card">
          <h3 className="text-white text-sm font-semibold mb-2 flex items-center gap-2"><RefreshCw size={14} /> Riwayat Pencarian</h3>
          <div className="space-y-1.5">
            {runs.map((r, i) => (
              <div key={i} className={`text-xs flex items-center justify-between rounded px-3 py-2 border ${r.status === 'success' ? 'bg-green-900/20 border-green-800/30' : 'bg-red-900/20 border-red-800/30'}`}>
                <span className={r.status === 'success' ? 'text-green-300' : 'text-red-300'}>"{r.keyword}" · {r.status} · {r.found} hasil</span>
                <span className="text-gray-500">{new Date(r.created_at).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QualityTab() {
  const [rows, setRows] = useState([]);
  const [filterGrade, setFilterGrade] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterGrade ? `?minGrade=${filterGrade}` : '';
      const r = await api.get(`/niche/group-quality${params}`);
      setRows(r.data);
    } finally { setLoading(false); }
  }, [filterGrade]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-white font-semibold flex items-center gap-2"><Award size={16} className="text-yellow-400" /> Group Quality Score</h3>
          <div className="flex gap-2">
            {['', 'A', 'B', 'C'].map(g => (
              <button key={g || 'all'} onClick={() => setFilterGrade(g)} className={`px-3 py-1 rounded-full text-xs ${filterGrade === g ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                {g === '' ? 'Semua' : `≥ ${g}`}
              </button>
            ))}
            <button onClick={load} className="btn-secondary text-xs"><RefreshCw size={12} /> Refresh</button>
          </div>
        </div>
        <p className="text-gray-500 text-xs mb-3">Skor dihitung otomatis dari riwayat post & share ke grup. Grup score tinggi diprioritaskan saat task dijalankan.</p>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">Belum ada data. Jalankan task post/share ke grup dulu.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2 font-medium">Grup</th>
                  <th className="text-left py-2 font-medium">Grade</th>
                  <th className="text-right py-2 font-medium">Score</th>
                  <th className="text-right py-2 font-medium">Sukses</th>
                  <th className="text-right py-2 font-medium">Gagal</th>
                  <th className="text-right py-2 font-medium">Update</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4">
                      <a href={r.group_url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-indigo-300 truncate block max-w-md">{r.name || r.group_url}</a>
                      <span className="text-gray-500 text-xs truncate block max-w-md">{r.group_url}</span>
                    </td>
                    <td className="py-2"><GradeBadge grade={r.grade} /></td>
                    <td className="py-2 text-right text-gray-300 font-mono">{Math.round(r.score)}</td>
                    <td className="py-2 text-right text-green-400">{r.success_count}</td>
                    <td className="py-2 text-right text-red-400">{r.failed_count}</td>
                    <td className="py-2 text-right text-gray-500 text-xs">{new Date(r.updated_at).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AutoJoinTab() {
  const [jobs, setJobs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [logsJob, setLogsJob] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [j, a, k] = await Promise.all([
        api.get('/auto-join'),
        api.get('/accounts'),
        api.get('/niche/keywords'),
      ]);
      setJobs(j.data); setAccounts(a.data); setKeywords(k.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto refresh setiap 15 detik supaya counter joined_today update
  useEffect(() => {
    const t = setInterval(() => { api.get('/auto-join').then(r => setJobs(r.data)).catch(() => {}); }, 15000);
    return () => clearInterval(t);
  }, []);

  const handleStart = async (id) => { await api.post(`/auto-join/${id}/start`); load(); };
  const handleStop = async (id) => { await api.post(`/auto-join/${id}/stop`); load(); };
  const handleRunNow = async (id) => {
    try { await api.post(`/auto-join/${id}/run-now`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Gagal jalankan'); }
  };
  const handleDelete = async (id) => {
    if (!confirm('Hapus job auto-join ini? Log akan ikut terhapus.')) return;
    await api.delete(`/auto-join/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2"><UserPlus size={16} className="text-emerald-400" /> Schedule Auto Join Grup</h3>
            <p className="text-gray-500 text-xs mt-1">Otomatis join grup hasil niche atau daftar URL manual, dengan batas harian dan jam aktif.</p>
          </div>
          <button onClick={() => { setEditJob(null); setShowModal(true); }} className="btn-primary text-sm"><Plus size={14} /> Buat Job</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-10 text-gray-500 text-sm">Belum ada job. Buat job untuk auto join grup.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jobs.map(j => (
            <div key={j.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white font-semibold text-sm truncate">{j.name}</h4>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${j.status === 'running' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700/40 text-gray-400'}`}>
                      {j.status === 'running' ? '● running' : '○ idle'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Akun: <span className="text-gray-300">{j.account_name || '-'}</span></p>
                  <div className="flex items-center gap-2 flex-wrap mt-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">source: {j.source}</span>
                    {j.keyword && <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">kw: {j.keyword}</span>}
                    <span className="px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-300">{j.joined_today}/{j.daily_limit} hari ini</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-200">{j.browser_engine || 'patchright'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-300">{j.active_hours_start}–{j.active_hours_end}h</span>
                    {j.next_run && <span className="px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-400"><Clock size={9} className="inline mr-1" /> {new Date(j.next_run).toLocaleString('id-ID')}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {j.status === 'running' ? (
                  <button onClick={() => handleStop(j.id)} className="btn-secondary text-xs"><StopCircle size={12} /> Stop</button>
                ) : (
                  <button onClick={() => handleStart(j.id)} className="btn-primary text-xs"><Play size={12} /> Start</button>
                )}
                <button onClick={() => handleRunNow(j.id)} className="btn-secondary text-xs"><Loader size={12} /> Jalankan 1 Grup</button>
                <button onClick={() => setLogsJob(j)} className="btn-secondary text-xs"><ListChecks size={12} /> Log</button>
                <button onClick={() => { setEditJob(j); setShowModal(true); }} className="btn-secondary text-xs"><Edit3 size={12} /></button>
                <button onClick={() => handleDelete(j.id)} className="btn-danger text-xs"><Trash2 size={12} /></button>
              </div>
              <div className="mt-3 text-[11px] text-gray-500 flex justify-between">
                <span>Total: <span className="text-emerald-400">{j.total_joined}</span> joined / <span className="text-red-400">{j.total_failed}</span> gagal</span>
                <span>{j.last_run ? `Run: ${new Date(j.last_run).toLocaleTimeString('id-ID')}` : 'Belum pernah'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AutoJoinModal
          editJob={editJob}
          accounts={accounts}
          keywords={keywords}
          onClose={() => { setShowModal(false); setEditJob(null); }}
          onSaved={() => { setShowModal(false); setEditJob(null); load(); }}
        />
      )}
      {logsJob && <AutoJoinLogsModal job={logsJob} onClose={() => setLogsJob(null)} />}
    </div>
  );
}

function AutoJoinModal({ editJob, accounts, keywords, onClose, onSaved }) {
  const isEdit = !!editJob;
  const [form, setForm] = useState({
    name: editJob?.name || '',
    account_id: editJob?.account_id || (accounts.find(a => a.status === 'active')?.id || ''),
    source: editJob?.source || 'niche',
    keyword: editJob?.keyword || '',
    group_urls: Array.isArray(editJob?.group_urls) ? editJob.group_urls.join('\n') : '',
    daily_limit: editJob?.daily_limit || 5,
    join_delay_min: editJob?.join_delay_min || 90,
    join_delay_max: editJob?.join_delay_max || 240,
    active_hours_start: editJob?.active_hours_start ?? 8,
    active_hours_end: editJob?.active_hours_end ?? 22,
    answer_template: editJob?.answer_template || '',
    quality_filter_enabled: editJob?.quality_filter_enabled ?? 1,
    browser_engine: editJob?.browser_engine || 'patchright',
    min_posts_per_day: editJob?.min_posts_per_day ?? 125,
    min_avg_comments: editJob?.min_avg_comments ?? 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = {
        name: form.name,
        account_id: form.account_id,
        source: form.source,
        keyword: form.source === 'niche' ? form.keyword.trim() : null,
        group_urls: form.source === 'manual' ? form.group_urls.split('\n').map(s => s.trim()).filter(Boolean) : [],
        daily_limit: Number(form.daily_limit),
        join_delay_min: Number(form.join_delay_min),
        join_delay_max: Number(form.join_delay_max),
        active_hours_start: Number(form.active_hours_start),
        active_hours_end: Number(form.active_hours_end),
        answer_template: form.answer_template,
        quality_filter_enabled: form.quality_filter_enabled ? 1 : 0,
        browser_engine: form.browser_engine || 'patchright',
        min_posts_per_day: Number(form.min_posts_per_day),
        min_avg_comments: Number(form.min_avg_comments),
      };
      if (isEdit) await api.put(`/auto-join/${editJob.id}`, payload);
      else await api.post('/auto-join', payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold">{isEdit ? 'Edit Job Auto Join' : 'Buat Job Auto Join'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

          <div>
            <label className="label">Nama Job</label>
            <input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Mis. Join Grup Jualan Bandung" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Akun Facebook</label>
              <select className="input" value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} required>
                <option value="">Pilih akun...</option>
                {accounts.filter(a => a.status === 'active').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sumber Grup</label>
              <select className="input" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                <option value="niche">Niche (dari hasil pencarian)</option>
                <option value="manual">Manual (daftar URL)</option>
              </select>
            </div>
          </div>

          {form.source === 'niche' ? (
            <div>
              <label className="label">Keyword Niche</label>
              {keywords.length > 0 ? (
                <select className="input" value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))} required>
                  <option value="">Pilih keyword...</option>
                  {keywords.map(k => <option key={k.keyword} value={k.keyword}>{k.keyword} ({k.count} grup)</option>)}
                </select>
              ) : (
                <>
                  <input className="input" value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))} required placeholder="Mis. jual sepatu Bandung" />
                  <p className="text-yellow-400 text-xs mt-1">Belum ada keyword tersimpan. Cari niche dulu di tab Auto-Discover supaya ada kandidat grup.</p>
                </>
              )}
            </div>
          ) : (
            <div>
              <label className="label">Daftar URL Grup (1 per baris)</label>
              <textarea className="input min-h-[120px] font-mono text-xs" value={form.group_urls} onChange={e => setForm(p => ({ ...p, group_urls: e.target.value }))} placeholder="https://www.facebook.com/groups/xxxxxxxxx/\nhttps://www.facebook.com/groups/yyyyyyyyy/" required={form.source === 'manual'} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Limit Harian</label>
              <input className="input" type="number" min={1} max={20} value={form.daily_limit} onChange={e => setForm(p => ({ ...p, daily_limit: e.target.value }))} />
            </div>
            <div>
              <label className="label">Jam Aktif Mulai</label>
              <input className="input" type="number" min={0} max={23} value={form.active_hours_start} onChange={e => setForm(p => ({ ...p, active_hours_start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Jam Aktif Akhir</label>
              <input className="input" type="number" min={0} max={23} value={form.active_hours_end} onChange={e => setForm(p => ({ ...p, active_hours_end: e.target.value }))} />
            </div>
            <div>
              <label className="label">Jeda Min (detik)</label>
              <input className="input" type="number" min={30} value={form.join_delay_min} onChange={e => setForm(p => ({ ...p, join_delay_min: e.target.value }))} />
            </div>
            <div>
              <label className="label">Jeda Max (detik)</label>
              <input className="input" type="number" min={60} value={form.join_delay_max} onChange={e => setForm(p => ({ ...p, join_delay_max: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="label mb-0">Filter Quality Grup</label>
                <p className="text-gray-500 text-xs mt-1">Sebelum join, hanya ambil grup yang lolos kualitas.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={!!form.quality_filter_enabled} onChange={e => setForm(p => ({ ...p, quality_filter_enabled: e.target.checked ? 1 : 0 }))} />
                Aktif
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Minimal Post / Hari</label>
                <input className="input" type="number" min={0} value={form.min_posts_per_day} onChange={e => setForm(p => ({ ...p, min_posts_per_day: e.target.value }))} disabled={!form.quality_filter_enabled} />
              </div>
              <div>
                <label className="label">Minimal Komentar / Post</label>
                <input className="input" type="number" min={0} step="0.1" value={form.min_avg_comments} onChange={e => setForm(p => ({ ...p, min_avg_comments: e.target.value }))} disabled={!form.quality_filter_enabled} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Jawaban Pertanyaan Keanggotaan (opsional)</label>
            <textarea className="input min-h-[80px]" value={form.answer_template} onChange={e => setForm(p => ({ ...p, answer_template: e.target.value }))} placeholder="Mis. Saya ingin {belajar|bergabung|aktif} di grup ini" />
            <p className="text-gray-500 text-xs mt-1">Mendukung spintax {'{ a | b | c }'}. Kalau kosong & grup minta jawaban, job akan skip grup itu.</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              <Save size={14} /> {saving ? 'Menyimpan...' : (isEdit ? 'Update Job' : 'Buat Job')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AutoJoinLogsModal({ job, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/auto-join/${job.id}/logs?limit=80`).then(r => setLogs(r.data)).finally(() => setLoading(false));
  }, [job.id]);

  const colorFor = (s) => {
    if (s === 'joined') return 'bg-emerald-900/20 border-emerald-800/30 text-emerald-300';
    if (s === 'requested') return 'bg-blue-900/20 border-blue-800/30 text-blue-300';
    if (s === 'already_member' || s === 'already_requested') return 'bg-gray-800 border-gray-700 text-gray-400';
    return 'bg-red-900/20 border-red-800/30 text-red-300';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><ListChecks size={16} /> Log: {job.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : logs.length === 0 ? (
            <p className="text-gray-500 text-center py-10 text-sm">Belum ada log.</p>
          ) : logs.map((l, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-xs border ${colorFor(l.status)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold uppercase">{l.status}</span>
                <span className="text-gray-500 text-[10px]">{new Date(l.created_at).toLocaleString('id-ID')}</span>
              </div>
              {l.group_url && <a href={l.group_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 truncate block mt-0.5">{l.group_name || l.group_url}</a>}
              {l.detail && <p className="text-gray-400 mt-1">{l.detail}</p>}
              {Array.isArray(l.questions) && l.questions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-800/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 uppercase">Pertanyaan & jawaban</p>
                    {l.answer_source && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        sumber: {l.answer_source === 'ai' ? '🤖 AI' : l.answer_source === 'template_fallback' ? 'AI gagal → template' : 'template'}
                      </span>
                    )}
                  </div>
                  {l.questions.map((q, qi) => (
                    <div key={qi} className="text-[11px]">
                      <p className="text-gray-300">Q: {q}</p>
                      <p className="text-emerald-300/90">A: {(l.answers && l.answers[qi]) || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MyGroupsTab() {
  const [data, setData] = useState({ groups: [], grouped: {}, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    api.get('/niche/my-groups').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const keywords = Object.keys(data.grouped).sort();
  const filtered = data.groups.filter(g => {
    if (filterKeyword && g.keyword !== filterKeyword) return false;
    if (filterStatus && g.join_status !== filterStatus) return false;
    return true;
  });

  // Group filtered
  const filteredGrouped = {};
  for (const g of filtered) {
    const kw = g.keyword || 'Tanpa Keyword';
    if (!filteredGrouped[kw]) filteredGrouped[kw] = [];
    filteredGrouped[kw].push(g);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2"><Users size={16} className="text-emerald-400" /> Grup Saya ({data.total})</h3>
          <div className="flex gap-2">
            <select className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">Semua status</option>
              <option value="joined">✅ Sudah bergabung</option>
              <option value="requested">⏳ Menunggu approval</option>
              <option value="member">👤 Member</option>
            </select>
            <select className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white" value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)}>
              <option value="">Semua keyword</option>
              {keywords.map(k => <option key={k} value={k}>{k} ({data.grouped[k]?.length || 0})</option>)}
            </select>
          </div>
        </div>
        <p className="text-gray-500 text-xs mb-4">Daftar grup yang sudah berhasil di-join via Auto Join, dikelompokkan berdasarkan keyword niche.</p>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">Belum ada grup. Jalankan Auto Join untuk mulai gabung grup.</div>
        ) : (
          <div className="space-y-5">
            {Object.entries(filteredGrouped).map(([keyword, groups]) => (
              <div key={keyword}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">{keyword}</span>
                  <span className="text-gray-500 text-xs">{groups.length} grup</span>
                </div>
                <div className="space-y-1.5">
                  {groups.map((g, i) => (
                    <div key={i} className="bg-gray-800/50 border border-gray-700/40 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-white text-sm font-medium hover:text-indigo-300 truncate block">{g.name || g.group_id}</a>
                        <div className="flex items-center gap-2 mt-0.5">
                          {g.account_name && <span className="text-[10px] text-gray-500">via {g.account_name}</span>}
                          {g.joined_at && <span className="text-[10px] text-gray-500">{new Date(g.joined_at).toLocaleDateString('id-ID')}</span>}
                        </div>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                        g.join_status === 'joined' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                        g.join_status === 'requested' ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30' :
                        'bg-gray-700/40 text-gray-400 border border-gray-600/30'
                      }`}>
                        {g.join_status === 'joined' ? '✅ Bergabung' : g.join_status === 'requested' ? '⏳ Menunggu Approval' : '👤 Member'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NicheGroupsPage() {
  const [tab, setTab] = useState('niche');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Niche & Quality Grup</h1>
        <p className="text-gray-400 mt-1 text-sm">Cari grup berdasarkan niche bisnis dan pantau quality score grup.</p>
      </div>

      <div className="flex gap-2 border-b border-gray-800 pb-1 flex-wrap">
        <button onClick={() => setTab('niche')} className={`px-4 py-2 text-sm rounded-t-lg ${tab === 'niche' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Compass size={14} className="inline mr-1" /> Auto-Discover
        </button>
        <button onClick={() => setTab('quality')} className={`px-4 py-2 text-sm rounded-t-lg ${tab === 'quality' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Award size={14} className="inline mr-1" /> Quality Score
        </button>
        <button onClick={() => setTab('autojoin')} className={`px-4 py-2 text-sm rounded-t-lg ${tab === 'autojoin' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
          <UserPlus size={14} className="inline mr-1" /> Auto Join Grup
        </button>
        <button onClick={() => setTab('mygroups')} className={`px-4 py-2 text-sm rounded-t-lg ${tab === 'mygroups' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Users size={14} className="inline mr-1" /> Grup Saya
        </button>
      </div>

      {tab === 'niche' ? <NicheTab /> : tab === 'quality' ? <QualityTab /> : tab === 'autojoin' ? <AutoJoinTab /> : <MyGroupsTab />}
    </div>
  );
}
