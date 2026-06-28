import React, { useState, useEffect } from 'react';
import { Gift, Copy, Users, Calendar, CheckCircle, Share2, Star, ExternalLink } from 'lucide-react';
import api from '../utils/api';

export default function ReferralPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applyMsg, setApplyMsg] = useState(null);
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/referrals/my');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/?ref=${data.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyReferral = async () => {
    if (!applyCode.trim()) return;
    setApplyLoading(true);
    setApplyMsg(null);
    try {
      const res = await api.post('/referrals/apply', { code: applyCode.trim() });
      setApplyMsg({ type: 'success', text: res.data.message });
      setApplyCode('');
    } catch (err) {
      setApplyMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menerapkan kode' });
    } finally { setApplyLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Gift size={22} className="text-pink-400" /> Program Referral</h1>
          <p className="text-gray-400 text-sm mt-1">Undang teman, dapatkan bonus perpanjangan langganan gratis</p>
        </div>
      </div>

      {data && (
        <>
          <div className="card bg-gradient-to-br from-pink-900/30 to-purple-900/30 border-pink-800/40">
            <div className="flex items-center gap-2 mb-4">
              <Star size={18} className="text-pink-400" />
              <span className="text-white font-semibold">Kode Referral Kamu</span>
              {data.is_reseller && <span className="px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 text-xs border border-yellow-800/50">Reseller</span>}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 bg-gray-900 border border-pink-800/50 rounded-xl px-4 py-3 font-mono text-2xl font-bold text-pink-300 tracking-widest text-center">
                {data.referral_code}
              </div>
              <button onClick={copyCode} className="flex items-center gap-2 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-colors text-sm">
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {copied ? 'Disalin!' : 'Salin'}
              </button>
            </div>

            <button onClick={copyLink} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm border border-gray-700">
              <Share2 size={15} /> Salin Link Undangan
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-blue-400">{data.total_referrals}</p>
              <p className="text-gray-400 text-sm mt-1">Total Referral</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-400">+{data.total_bonus_days}</p>
              <p className="text-gray-400 text-sm mt-1">Total Bonus Hari</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-yellow-400">{data.is_reseller ? `${data.reseller_margin}%` : '7 hari'}</p>
              <p className="text-gray-400 text-sm mt-1">{data.is_reseller ? 'Komisi per Referral' : 'Bonus per Referral'}</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Users size={16} /> Riwayat Referral</h3>
            {data.referrals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users size={36} className="mx-auto mb-2 opacity-30" />
                <p>Belum ada yang mendaftar via kode kamu</p>
                <p className="text-xs mt-1">Bagikan kode referral untuk mulai mendapatkan bonus</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.referrals.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-blue-300 text-sm font-bold">
                        {r.referred_username?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{r.referred_username}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-400">+{r.bonus_days} hari</span>
                      <span className="text-gray-500">{new Date(r.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Gift size={16} /> Gunakan Kode Referral Orang Lain</h3>
            <p className="text-gray-400 text-sm mb-3">Masukkan kode referral dari teman untuk memberi mereka bonus perpanjangan langganan</p>
            <div className="flex gap-2">
              <input
                value={applyCode}
                onChange={e => setApplyCode(e.target.value.toUpperCase())}
                placeholder="Masukkan kode (contoh: A1B2C3D4)"
                className="input font-mono"
                maxLength={8}
              />
              <button onClick={applyReferral} disabled={applyLoading || !applyCode.trim()} className="btn-primary whitespace-nowrap">
                {applyLoading ? 'Memproses...' : 'Gunakan'}
              </button>
            </div>
            {applyMsg && (
              <div className={`mt-3 p-3 rounded-xl text-sm ${applyMsg.type === 'success' ? 'bg-green-900/30 text-green-300 border border-green-800/50' : 'bg-red-900/30 text-red-300 border border-red-800/50'}`}>
                {applyMsg.text}
              </div>
            )}
          </div>

          <div className="card bg-blue-900/10 border-blue-800/30">
            <h3 className="text-white font-semibold mb-3">Cara Kerja Program Referral</h3>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Bagikan kode atau link referral kamu kepada teman' },
                { step: '2', text: 'Teman mendaftar menggunakan kode/link referral kamu' },
                { step: '3', text: 'Kamu otomatis mendapat bonus perpanjangan 7 hari' },
                { step: '4', text: 'Semakin banyak referral, semakin panjang langgananmu!' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{s.step}</span>
                  <p className="text-gray-300 text-sm">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
