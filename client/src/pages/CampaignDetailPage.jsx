import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, Square, RefreshCw, CheckCircle, XCircle, Clock, Target, Users, MessageSquare, Download } from 'lucide-react';
import api from '../utils/api';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [campRes, statusRes] = await Promise.all([
        api.get(`/campaigns/${id}`),
        api.get(`/runner/campaigns/${id}/status`),
      ]);
      setCampaign(campRes.data);
      setStatus(statusRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (status?.running) {
      const interval = setInterval(() => fetchData(), 4000);
      return () => clearInterval(interval);
    }
  }, [status?.running, fetchData]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.post(`/runner/campaigns/${id}/start`);
      setTimeout(fetchData, 1000);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memulai');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await api.post(`/runner/campaigns/${id}/stop`);
      setTimeout(fetchData, 1000);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghentikan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleExport = async () => {
    try {
      const res = await api.get(`/campaigns/${id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `kampanye-${campaign.name}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { alert('Gagal mengekspor laporan'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!campaign) return <div className="text-center text-gray-400 py-16">Kampanye tidak ditemukan</div>;

  const statusLabel = s => ({ running: 'Berjalan', completed: 'Selesai', failed: 'Gagal', stopped: 'Dihentikan', idle: 'Menunggu' }[s] || s);
  const stats = status?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/campaigns" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
            <span className={`badge-${campaign.status}`}>{statusLabel(campaign.status)}</span>
          </div>
          {campaign.description && <p className="text-gray-400 mt-1 text-sm">{campaign.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary px-3 py-2">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {campaign.logs?.length > 0 && (
            <button onClick={handleExport} className="btn-secondary px-3 py-2 flex items-center gap-1.5" title="Export CSV">
              <Download size={16} /> CSV
            </button>
          )}
          {campaign.status === 'running' || status?.running ? (
            <button onClick={handleStop} disabled={actionLoading} className="btn-danger">
              <Square size={16} /> Hentikan
            </button>
          ) : (
            <button onClick={handleStart} disabled={actionLoading} className="btn-success">
              <Play size={16} /> Mulai
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Target, label: 'Total Target', value: Array.isArray(campaign.targets) ? campaign.targets.length : 0, color: 'blue' },
          { icon: Users, label: 'Akun', value: Array.isArray(campaign.account_ids) ? campaign.account_ids.length : 0, color: 'purple' },
          { icon: CheckCircle, label: 'Berhasil', value: stats.success || 0, color: 'green' },
          { icon: XCircle, label: 'Gagal', value: stats.failed || 0, color: 'red' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card">
            <div className={`w-8 h-8 bg-${color}-900/50 rounded-lg flex items-center justify-center mb-3`}>
              <Icon size={16} className={`text-${color}-400`} />
            </div>
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Target size={18} /> URL Target</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(Array.isArray(campaign.targets) ? campaign.targets : []).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block bg-gray-800 hover:bg-gray-750 rounded-lg px-4 py-2.5 text-blue-400 hover:text-blue-300 text-sm truncate transition-colors">
                {url}
              </a>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><MessageSquare size={18} /> Template Komentar</h2>
          <pre className="bg-gray-800 rounded-lg p-4 text-gray-300 text-sm whitespace-pre-wrap font-sans">{campaign.comment_template}</pre>
          <div className="mt-3 flex items-center gap-3 text-gray-400 text-sm">
            <Clock size={14} />
            <span>Delay: {campaign.delay_min}-{campaign.delay_max} detik</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Log Komentar ({campaign.logs?.length || 0})</h2>
        {!campaign.logs?.length ? (
          <p className="text-gray-500 text-center py-8">Belum ada log. Mulai kampanye untuk melihat hasil.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {campaign.logs.map(log => (
              <div key={log.id} className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${log.status === 'success' ? 'bg-green-900/20 border border-green-800/30' : 'bg-red-900/20 border border-red-800/30'}`}>
                <div className="flex-shrink-0 mt-0.5">
                  {log.status === 'success' ? <CheckCircle size={16} className="text-green-400" /> : <XCircle size={16} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-white font-medium">{log.account_name || 'Akun'}</span>
                    <span className="text-gray-500">→</span>
                    <a href={log.target_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 truncate max-w-xs text-xs">
                      {log.target_url}
                    </a>
                  </div>
                  {log.comment_text && <p className="text-gray-300 mb-1">"{log.comment_text}"</p>}
                  {log.error_message && <p className="text-red-400 text-xs">{log.error_message}</p>}
                  <p className="text-gray-500 text-xs">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
