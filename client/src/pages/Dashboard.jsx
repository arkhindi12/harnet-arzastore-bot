import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Megaphone, CheckCircle, XCircle, Play, TrendingUp, Crown, Shield, MessageSquare, UserCheck, BarChart2, Gift, Zap } from 'lucide-react';
import api from '../utils/api';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className={`text-2xl sm:text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('-400', '-900')}`}>
          <Icon size={22} className={color} />
        </div>
      </div>
    </div>
  );
}

function ROICard({ accountCount, campaignCount }) {
  const [commentsPerDay, setCommentsPerDay] = useState(20);
  const [conversionRate, setConversionRate] = useState(2);
  const [avgOrderValue, setAvgOrderValue] = useState(150000);

  const dailyComments = accountCount * commentsPerDay;
  const monthlyComments = dailyComments * 30;
  const monthlyLeads = Math.round(monthlyComments * conversionRate / 100);
  const monthlyRevenue = monthlyLeads * avgOrderValue;
  const estimatedAdValue = Math.round(monthlyComments * 500);

  return (
    <div className="card bg-gradient-to-br from-green-900/10 to-teal-900/10 border-green-800/30">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><BarChart2 size={18} className="text-green-400" /> Estimasi ROI Kampanye</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">Hitung dampak bisnis</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="label">Komentar/akun/hari</label>
          <input type="range" min={5} max={50} value={commentsPerDay} onChange={e => setCommentsPerDay(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5"><span>5</span><span className="text-green-400 font-medium">{commentsPerDay}/akun</span><span>50</span></div>
        </div>
        <div>
          <label className="label">Tingkat konversi (%)</label>
          <input type="range" min={0.5} max={10} step={0.5} value={conversionRate} onChange={e => setConversionRate(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5"><span>0.5%</span><span className="text-green-400 font-medium">{conversionRate}%</span><span>10%</span></div>
        </div>
        <div>
          <label className="label">Rata-rata nilai order (Rp)</label>
          <input type="range" min={50000} max={1000000} step={50000} value={avgOrderValue} onChange={e => setAvgOrderValue(+e.target.value)} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500 mt-0.5"><span>50rb</span><span className="text-green-400 font-medium">{(avgOrderValue/1000).toFixed(0)}rb</span><span>1jt</span></div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Komentar/bulan', value: monthlyComments.toLocaleString('id-ID'), icon: MessageSquare, color: 'text-blue-400' },
          { label: 'Prospek/bulan', value: monthlyLeads.toLocaleString('id-ID'), icon: Users, color: 'text-purple-400' },
          { label: 'Est. Penjualan', value: `Rp${(monthlyRevenue/1000000).toFixed(1)}jt`, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Nilai Iklan Hemat', value: `Rp${(estimatedAdValue/1000000).toFixed(1)}jt`, icon: Zap, color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-800/60 rounded-xl p-3 text-center">
            <Icon size={16} className={`${color} mx-auto mb-1`} />
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-gray-600 text-xs mt-3">*Estimasi berdasarkan {accountCount} akun aktif dan {campaignCount} kampanye. Angka aktual tergantung kualitas target dan template.</p>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/users'),
    ]).then(([sRes, uRes]) => {
      setStats(sRes.data);
      setUsers(uRes.data.slice(0, 8));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isExpired = (e) => e && new Date(e) < new Date();
  const daysLeft = (e) => e ? Math.ceil((new Date(e) - new Date()) / 86400000) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Crown size={22} className="text-yellow-400" /> Dashboard Admin
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Ringkasan seluruh platform ArzaBot</p>
        </div>
        <Link to="/admin" className="btn-primary flex items-center gap-2 text-sm">
          <Users size={15} /> Kelola User
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total User" value={stats.totalUsers} color="text-blue-400" sub={`${stats.activeUsers} aktif`} />
          <StatCard icon={XCircle} label="Langganan Habis" value={stats.expiredUsers} color="text-red-400" />
          <StatCard icon={Shield} label="Total Akun FB" value={stats.totalAccounts} color="text-green-400" sub={`${stats.activeAccounts} valid`} />
          <StatCard icon={MessageSquare} label="Total Komentar" value={(stats.totalComments || 0).toLocaleString()} color="text-purple-400" sub={`${stats.runningCampaigns} kampanye aktif`} />
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Pengguna Terbaru</h2>
          <Link to="/admin" className="text-blue-400 hover:text-blue-300 text-sm">Kelola semua →</Link>
        </div>
        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Belum ada pengguna</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-3">User</th>
                  <th className="text-center py-2 px-3">Akun FB</th>
                  <th className="text-center py-2 px-3">Kampanye</th>
                  <th className="text-left py-2 px-3">Masa Aktif</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map(u => {
                  const expired = isExpired(u.expires_at);
                  const days = daysLeft(u.expires_at);
                  return (
                    <tr key={u.id} className="hover:bg-gray-800/40">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${u.role === 'admin' ? 'bg-yellow-900 text-yellow-300' : 'bg-blue-900 text-blue-300'}`}>
                            {u.username[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{u.username}</p>
                            {u.full_name && <p className="text-gray-500 text-xs">{u.full_name}</p>}
                          </div>
                          {u.role === 'admin' && <Crown size={11} className="text-yellow-400" />}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-white">{u.account_count}</td>
                      <td className="py-3 px-3 text-center text-white">{u.campaign_count}</td>
                      <td className="py-3 px-3 text-xs">
                        {!u.expires_at ? <span className="text-gray-500">Tanpa batas</span>
                          : expired ? <span className="text-red-400 font-semibold">Habis</span>
                          : <span className={days <= 7 ? 'text-yellow-400 font-semibold' : 'text-green-400'}>{days} hari lagi</span>}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {u.is_active
                          ? <span className="text-green-400 text-xs bg-green-900/30 px-2 py-0.5 rounded-full">Aktif</span>
                          : <span className="text-red-400 text-xs bg-red-900/30 px-2 py-0.5 rounded-full">Nonaktif</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Tambah User Baru', desc: 'Buat akun user baru, atur masa berlaku langganan, dan tentukan role.', link: '/admin', color: 'blue' },
          { title: 'Kelola Langganan', desc: 'Perpanjang, nonaktifkan, atau hapus akun pengguna yang sudah habis masa aktifnya.', link: '/admin', color: 'yellow' },
          { title: 'Monitor Aktivitas', desc: 'Pantau jumlah kampanye, akun FB, dan komentar terkirim per pengguna.', link: '/analytics', color: 'purple' },
        ].map(({ title, desc, link, color }) => (
          <Link key={title} to={link} className={`bg-${color}-900/20 border border-${color}-800/30 rounded-xl p-4 hover:bg-${color}-900/30 transition-colors block`}>
            <h3 className="text-white font-semibold mb-2">{title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function UserDashboard({ user }) {
  const [accounts, setAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/accounts'),
      api.get('/campaigns'),
    ]).then(([accRes, campRes]) => {
      setAccounts(accRes.data);
      setCampaigns(campRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const activeAccounts = accounts.filter(a => a.status === 'active').length;
  const invalidAccounts = accounts.filter(a => a.status === 'invalid').length;
  const checkpointAccounts = accounts.filter(a => a.status === 'checkpoint').length;
  const problematicAccounts = accounts.filter(a => a.status === 'problematic').length;
  const proxyReadyAccounts = accounts.filter(a => a.proxy).length;
  const warmingReadyAccounts = accounts.filter(a => a.status === 'active' && a.proxy).length;
  const runningCampaigns = campaigns.filter(c => c.status === 'running').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

  const expiryInfo = () => {
    if (!user?.expires_at) return null;
    const days = Math.ceil((new Date(user.expires_at) - new Date()) / 86400000);
    if (days < 0) return { text: 'Langganan Anda telah habis', color: 'red' };
    if (days <= 7) return { text: `Langganan habis dalam ${days} hari`, color: 'yellow' };
    return { text: `Aktif hingga ${new Date(user.expires_at).toLocaleDateString('id-ID')}`, color: 'green' };
  };

  const expiry = expiryInfo();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Ringkasan aktivitas auto-comment Anda</p>
      </div>

      {expiry && (
        <div className={`flex items-center gap-2 bg-${expiry.color}-900/30 border border-${expiry.color}-700/50 rounded-xl px-4 py-3 text-${expiry.color}-300 text-sm`}>
          <UserCheck size={16} />
          {expiry.text}. Hubungi administrator untuk perpanjangan.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Akun" value={accounts.length} color="text-blue-400" sub={`${activeAccounts} aktif, ${invalidAccounts + checkpointAccounts + problematicAccounts} butuh cek`} />
        <StatCard icon={Shield} label="Siap Warming" value={warmingReadyAccounts} color="text-green-400" sub={`${proxyReadyAccounts} akun pakai proxy`} />
        <StatCard icon={Megaphone} label="Total Kampanye" value={campaigns.length} color="text-purple-400" sub={`${runningCampaigns} berjalan`} />
        <StatCard icon={Play} label="Kampanye Selesai" value={completedCampaigns} color="text-orange-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-blue-900/10 border-blue-800/30">
          <p className="text-gray-400 text-sm mb-2">Kesehatan Akun</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-green-300">Aktif</span><span className="text-white font-semibold">{activeAccounts}</span></div>
            <div className="flex justify-between"><span className="text-yellow-300">Checkpoint</span><span className="text-white font-semibold">{checkpointAccounts}</span></div>
            <div className="flex justify-between"><span className="text-orange-300">Bermasalah</span><span className="text-white font-semibold">{problematicAccounts}</span></div>
            <div className="flex justify-between"><span className="text-red-300">Invalid</span><span className="text-white font-semibold">{invalidAccounts}</span></div>
          </div>
        </div>
        <div className="card bg-green-900/10 border-green-800/30">
          <p className="text-gray-400 text-sm mb-2">Readiness</p>
          <p className="text-3xl font-bold text-green-400">{accounts.length ? Math.round((activeAccounts / accounts.length) * 100) : 0}%</p>
          <p className="text-gray-500 text-xs mt-1">akun aktif dari total akun terdaftar</p>
          <p className="text-gray-400 text-xs mt-3">{warmingReadyAccounts} akun aktif dengan proxy siap untuk warming yang lebih stabil.</p>
        </div>
        <div className="card bg-yellow-900/10 border-yellow-800/30">
          <p className="text-gray-400 text-sm mb-2">Rekomendasi Cepat</p>
          <p className="text-yellow-200 text-sm leading-relaxed">
            {checkpointAccounts > 0 ? `${checkpointAccounts} akun perlu diselesaikan checkpoint.` : invalidAccounts > 0 ? `${invalidAccounts} akun perlu update cookie.` : proxyReadyAccounts < activeAccounts ? 'Tambahkan proxy/User-Agent untuk meningkatkan stabilitas.' : 'Kondisi akun terlihat cukup sehat.'}
          </p>
        </div>
      </div>

      <ROICard accountCount={activeAccounts} campaignCount={campaigns.length} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Akun Terbaru</h2>
            <Link to="/accounts" className="text-blue-400 hover:text-blue-300 text-sm">Lihat semua →</Link>
          </div>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Users size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">Belum ada akun ditambahkan</p>
              <Link to="/accounts" className="text-blue-400 text-sm mt-2 inline-block hover:text-blue-300">Tambah akun →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.slice(0, 5).map(acc => (
                <div key={acc.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-blue-300 text-sm font-bold">
                      {acc.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{acc.name}</p>
                      <p className="text-gray-500 text-xs">{acc.last_used ? `Terakhir: ${new Date(acc.last_used).toLocaleDateString('id-ID')}` : 'Belum digunakan'}</p>
                    </div>
                  </div>
                  <span className={`badge-${acc.status}`}>{acc.status === 'active' ? 'Aktif' : acc.status === 'checkpoint' ? 'Checkpoint' : acc.status === 'problematic' ? 'Bermasalah' : 'Invalid'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Kampanye Terbaru</h2>
            <Link to="/campaigns" className="text-blue-400 hover:text-blue-300 text-sm">Lihat semua →</Link>
          </div>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">Belum ada kampanye dibuat</p>
              <Link to="/campaigns" className="text-blue-400 text-sm mt-2 inline-block hover:text-blue-300">Buat kampanye →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 5).map(camp => (
                <Link to={`/campaigns/${camp.id}`} key={camp.id} className="flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-lg px-4 py-3 block transition-colors">
                  <div>
                    <p className="text-white text-sm font-medium">{camp.name}</p>
                    <p className="text-gray-500 text-xs">{Array.isArray(camp.targets) ? camp.targets.length : 0} target • {Array.isArray(camp.account_ids) ? camp.account_ids.length : 0} akun</p>
                  </div>
                  <span className={`badge-${camp.status}`}>
                    {camp.status === 'running' ? 'Berjalan' : camp.status === 'completed' ? 'Selesai' : camp.status === 'failed' ? 'Gagal' : camp.status === 'stopped' ? 'Dihentikan' : 'Menunggu'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Panduan Penggunaan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Tambah Akun Facebook', desc: 'Import cookies Facebook dari browser extension. Gunakan EditThisCookie atau Cookie-Editor untuk mengekspor cookies.', color: 'blue' },
            { step: '2', title: 'Buat Kampanye', desc: 'Masukkan URL target (postingan halaman/grup/profil), template komentar dengan spintax, dan pilih akun.', color: 'purple' },
            { step: '3', title: 'Jalankan Kampanye', desc: 'Klik Mulai pada kampanye. Sistem akan mengirim komentar otomatis dengan delay acak untuk keamanan.', color: 'green' },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className={`bg-${color}-900/20 border border-${color}-800/30 rounded-xl p-4`}>
              <div className={`w-8 h-8 bg-${color}-600 rounded-lg flex items-center justify-center text-white font-bold text-sm mb-3`}>
                {step}
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ user }) {
  if (user?.role === 'admin') return <AdminDashboard />;
  return <UserDashboard user={user} />;
}
