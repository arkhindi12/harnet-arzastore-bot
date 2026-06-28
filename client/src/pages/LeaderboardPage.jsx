import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, AlertTriangle, RefreshCw, Medal, Users } from 'lucide-react';
import api from '../utils/api';

export default function LeaderboardPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('total_success');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounts/leaderboard');
      setAccounts(res.data);
    } catch {
      // fallback: get accounts with stats
      const res = await api.get('/accounts');
      setAccounts(res.data);
    } finally { setLoading(false); }
  };

  const sorted = [...accounts].sort((a, b) => (b[sort] || 0) - (a[sort] || 0));

  const medal = (i) => {
    if (i === 0) return <Trophy size={18} className="text-yellow-400" />;
    if (i === 1) return <Medal size={18} className="text-gray-300" />;
    if (i === 2) return <Medal size={18} className="text-amber-600" />;
    return <span className="text-gray-500 text-sm font-bold w-4 text-center">{i + 1}</span>;
  };

  const statusColor = (status) => {
    if (status === 'active') return 'bg-green-900/40 text-green-400 border border-green-800/50';
    if (status === 'problematic') return 'bg-red-900/40 text-red-400 border border-red-800/50';
    if (status === 'checkpoint') return 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50';
    return 'bg-gray-800 text-gray-400';
  };

  const statusLabel = { active: 'Aktif', problematic: 'Bermasalah', checkpoint: 'Checkpoint', invalid: 'Invalid' };

  const rate = (a) => {
    const total = (a.total_success || 0) + (a.total_failed || 0);
    return total > 0 ? Math.round((a.total_success / total) * 100) : 0;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Trophy size={22} className="text-yellow-400" /> Leaderboard Akun</h1>
          <p className="text-gray-400 text-sm mt-1">Ranking performa akun Facebook</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { key: 'total_success', label: 'Berhasil' },
          { key: 'total_failed', label: 'Gagal' },
          { key: 'total_comments', label: 'Total' },
        ].map(s => (
          <button key={s.key} onClick={() => setSort(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sort === s.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Sort: {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>Belum ada akun terdaftar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((acc, i) => (
            <div key={acc.id} className={`rounded-xl border p-4 flex items-center gap-4 transition-all ${i === 0 ? 'bg-yellow-900/10 border-yellow-800/40' : i === 1 ? 'bg-gray-800/60 border-gray-700' : i === 2 ? 'bg-amber-900/10 border-amber-800/30' : 'bg-gray-900 border-gray-800'}`}>
              <div className="flex items-center justify-center w-8 flex-shrink-0">{medal(i)}</div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {acc.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{acc.name}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs mt-1 ${statusColor(acc.status)}`}>{statusLabel[acc.status] || acc.status}</span>
              </div>
              <div className="flex gap-3 sm:gap-6 text-center flex-shrink-0">
                <div>
                  <p className="text-green-400 font-bold text-base sm:text-lg">{acc.total_success || 0}</p>
                  <p className="text-gray-500 text-xs">Berhasil</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-red-400 font-bold text-base sm:text-lg">{acc.total_failed || 0}</p>
                  <p className="text-gray-500 text-xs">Gagal</p>
                </div>
                <div>
                  <p className="text-blue-400 font-bold text-base sm:text-lg">{rate(acc)}%</p>
                  <p className="text-gray-500 text-xs">Sukses</p>
                </div>
              </div>
              {acc.status === 'problematic' && (
                <AlertTriangle size={18} className="text-red-400 flex-shrink-0" title="Akun bermasalah" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
