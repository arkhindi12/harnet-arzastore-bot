import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useBranding from '../hooks/useBranding';
import {
  Facebook, MessageSquare, Users, Zap, Clock, Shield, BarChart2,
  Bot, Search, Play, Star, CheckCircle, ArrowRight, ChevronDown,
  Layers, Variable, Gift, Code2, Menu, X, Sparkles,
  Compass, UserPlus, Tag, Award, Activity, Brain, Share2,
  AlertTriangle, Eye, Target, Flame, ShieldCheck, TrendingUp
} from 'lucide-react';

const FEATURES = [
  { icon: Brain, color: 'from-fuchsia-500 to-purple-600', bg: 'bg-fuchsia-900/20 border-fuchsia-800/40', badge: 'BARU', title: 'AI Anti-Burnout per Akun', desc: 'Sistem otomatis menghitung fatigue tiap akun dan kasih cooldown adaptif. Akun tetap aman jangka panjang.' },
  { icon: Sparkles, color: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-900/20 border-indigo-800/40', badge: 'BARU', title: 'AI Comment Multi-Persona', desc: 'Tiap akun punya persona berbeda. Komentar antar akun terlihat manusiawi, anti-pola deteksi.' },
  { icon: Compass, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-900/20 border-blue-800/40', badge: 'BARU', title: 'Auto-Discover Grup Niche', desc: 'Cari ratusan grup sesuai keyword bisnis 1 klik. Lihat jumlah anggota, langsung import ke akun.' },
  { icon: UserPlus, color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-900/20 border-emerald-800/40', badge: 'BARU', title: 'Auto Join Grup + AI Answer', desc: 'Akun gabung grup bertahap. AI baca pertanyaan keanggotaan dan jawab natural per pertanyaan.' },
  { icon: Tag, color: 'from-pink-500 to-rose-500', bg: 'bg-pink-900/20 border-pink-800/40', badge: 'BARU', title: 'Auto Jual via Sell Something', desc: 'Posting listing otomatis lewat tombol Sell Something di grup jual-beli. Foto, harga, kategori otomatis.' },
  { icon: Award, color: 'from-yellow-500 to-amber-500', bg: 'bg-yellow-900/20 border-yellow-800/40', badge: 'BARU', title: 'Group Quality Score', desc: 'Tiap grup dapat skor A/B/C/D otomatis. Sistem prioritaskan grup score tinggi.' },
  { icon: Activity, color: 'from-red-500 to-orange-500', bg: 'bg-red-900/20 border-red-800/40', badge: 'BARU', title: 'Anti-Detection Dashboard', desc: 'Pantau risiko per akun: fatigue, fingerprint, cookie age, proxy health.' },
  { icon: Share2, color: 'from-teal-500 to-cyan-500', bg: 'bg-teal-900/20 border-teal-800/40', badge: 'BARU', title: 'Auto Share Post ke Grup', desc: 'Share 1 post ke puluhan grup otomatis. Hemat waktu promosi konten harian.' },
  { icon: MessageSquare, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-900/20 border-blue-800/30', title: 'Auto Komentar Multi-Akun', desc: 'Ratusan komentar per hari dari banyak akun. Support spintax, variabel dinamis, AI persona.' },
  { icon: Bot, color: 'from-purple-500 to-pink-500', bg: 'bg-purple-900/20 border-purple-800/30', title: 'Smart AI Multi-Provider', desc: 'Groq, OpenAI, Gemini, OpenRouter, Claude, atau endpoint custom.' },
  { icon: Shield, color: 'from-green-500 to-emerald-500', bg: 'bg-green-900/20 border-green-800/30', title: 'Anti-Checkpoint Berlapis', desc: 'Delay acak, jam operasional, rotasi akun, fatigue cooldown.' },
  { icon: Search, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-900/20 border-orange-800/30', title: 'Smart Monitor Keyword', desc: 'Pantau grup berdasarkan keyword. Bot otomatis komentar & balas DM prospek.' },
  { icon: Clock, color: 'from-indigo-500 to-blue-500', bg: 'bg-indigo-900/20 border-indigo-800/30', title: 'Jadwal & Auto-Rotate', desc: 'Mulai/stop kampanye otomatis, rotasi template per akun.' },
  { icon: BarChart2, color: 'from-teal-500 to-cyan-500', bg: 'bg-teal-900/20 border-teal-800/30', title: 'Analitik & A/B Test', desc: 'Pantau performa real-time, A/B test template otomatis.' },
  { icon: Users, color: 'from-violet-500 to-purple-500', bg: 'bg-violet-900/20 border-violet-800/30', title: 'Manajemen Tim', desc: 'Undang anggota tim, kelola kampanye bersama.' },
  { icon: Code2, color: 'from-slate-400 to-gray-500', bg: 'bg-slate-900/20 border-slate-800/30', title: 'API & Webhook', desc: 'REST API & webhook untuk integrasi custom.' },
  { icon: Gift, color: 'from-red-500 to-pink-500', bg: 'bg-red-900/20 border-red-800/30', title: 'Reseller & Referral', desc: 'Komisi uang tunai dari setiap pengguna yang Anda ajak.' },
  { icon: Zap, color: 'from-amber-500 to-yellow-400', bg: 'bg-amber-900/20 border-amber-800/30', title: 'Warming & UP Tools', desc: 'Warming akun baru, auto-UP postingan, auto-like feed.' },
];

function CountUp({ target, duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const num = parseInt(String(target).replace(/\D/g, '')) || 0;
        if (!num) { setCount(0); return; }
        const step = num / (duration / 16);
        let current = 0;
        const timer = setInterval(() => { current += step; if (current >= num) { setCount(num); clearInterval(timer); } else setCount(Math.floor(current)); }, 16);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);
  const suffix = String(target).replace(/[\d.,]/g, '').trim();
  return <span ref={ref}>{count.toLocaleString('id-ID')}{suffix}</span>;
}

// ===== HERO =====
function HeroSection({ registerLink }) {
  const words = ['Auto Komentar', 'Auto Join Grup', 'Auto Jual Produk', 'AI Anti-Burnout', 'Anti-Checkpoint'];
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(i => (i + 1) % words.length), 2400); return () => clearInterval(t); }, []);
  return (
    <section className="relative pt-14 pb-24 px-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"><div className="absolute -top-32 -left-20 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" /><div className="absolute -bottom-32 -right-20 w-[460px] h-[460px] bg-purple-600/20 rounded-full blur-[120px]" /></div>
      <div className="max-w-5xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/40 text-blue-200 text-xs sm:text-sm px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>
          Sudah dipercaya 500+ pebisnis online Indonesia
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
          <span className="block mb-2">Saat kamu tidur,</span>
          <span key={idx} className="inline-block bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent" style={{ animation: 'fadeUp 0.6s ease-out' }}>{words[idx]}</span>
          <span className="block mt-2">tetap jalan otomatis 24 jam.</span>
        </h1>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <p className="text-base sm:text-lg lg:text-xl text-gray-400 max-w-3xl mx-auto mb-8 leading-relaxed">
          Kelola puluhan akun Facebook dari satu dashboard. AI Anti-Burnout jaga akun aman, Auto Join + AI Answer gabung grup otomatis, Auto Jual via Sell Something posting listing tanpa sentuh. Pelanggan terus datang, kamu tinggal terima orderan.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <Link to={registerLink} className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold px-8 py-4 rounded-2xl text-base sm:text-lg transition-all shadow-xl shadow-blue-600/30 hover:-translate-y-0.5">
            Coba Gratis 3 Hari <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a href="#features" className="inline-flex items-center justify-center gap-2 bg-gray-800/60 hover:bg-gray-800 text-white font-semibold px-8 py-4 rounded-2xl text-base sm:text-lg transition-all border border-gray-700/60 backdrop-blur-sm">
            <Play size={16} className="text-blue-400" /> Lihat Fitur Lengkap
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm text-gray-500">
          <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> Tanpa kartu kredit</span>
          <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> Setup 5 menit</span>
          <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> Cancel kapan saja</span>
          <span className="flex items-center gap-1.5"><span className="flex">{[1,2,3,4,5].map(i=><Star key={i} size={12} className="text-yellow-400 fill-yellow-400" />)}</span><span className="text-gray-300 font-semibold ml-1">4.9/5</span></span>
        </div>
      </div>
    </section>
  );
}

// ===== PROBLEM AGITATION =====
function ProblemSection() {
  const pains = [
    { icon: Clock, title: 'Buang 3-5 jam/hari komentar manual', desc: 'Energi habis sebelum jualan. Hasilnya? Cuma 10-20 komentar yang tenggelam.' },
    { icon: AlertTriangle, title: 'Akun kena checkpoint terus', desc: 'Sudah hati-hati, tetap kena. Beli akun baru, kena lagi. Uang habis sia-sia.' },
    { icon: Eye, title: 'Tidak tahu target yang tepat', desc: 'Komentar di mana-mana tapi tidak ada yang beli. Buang peluru tanpa sasaran.' },
    { icon: Target, title: 'Tools lain mahal & fitur terbatas', desc: 'Bayar mahal, fitur itu-itu saja. Akun tetap kena banned, support lama.' },
  ];
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-gray-950 to-red-950/10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block bg-red-900/30 border border-red-700/40 text-red-300 text-xs px-3 py-1 rounded-full mb-4 font-semibold uppercase tracking-wider">Pernah ngalamin ini?</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Cara lama itu <span className="text-red-400">capek, mahal, dan beresiko</span>.</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Kalau kamu ngalamin salah satu dari ini, ArzaBot dibuat khusus untukmu.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pains.map((p, i) => (
            <div key={i} className="bg-red-950/15 border border-red-900/30 rounded-2xl p-5 flex items-start gap-4 hover:border-red-700/50 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-red-900/40 border border-red-700/40 flex items-center justify-center flex-shrink-0"><p.icon size={20} className="text-red-300" /></div>
              <div><h3 className="text-white font-semibold mb-1">{p.title}</h3><p className="text-gray-400 text-sm leading-relaxed">{p.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== BEFORE vs AFTER =====
function BeforeAfterSection() {
  const before = ['Komentar manual 3-5 jam/hari', 'Akun sering checkpoint', 'Tidak tahu grup potensial', 'Pelanggan sporadis', 'Upload listing manual satu-satu', 'Tidak tahu performa'];
  const after = ['Otomasi 24 jam, tidur tetap jalan', '0 checkpoint sebulan (AI Anti-Burnout)', 'Niche Discovery + Quality Score', 'Pelanggan baru masuk DM tiap hari', 'Auto Jual, Auto Share, Auto Join — 1 klik', 'Dashboard real-time + A/B test otomatis'];
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Hidup tanpa & dengan <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">ArzaBot</span></h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-red-950/30 to-gray-900/50 border border-red-900/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5"><span className="w-9 h-9 bg-red-900/40 border border-red-700/40 rounded-xl flex items-center justify-center"><X size={16} className="text-red-300" /></span><h3 className="text-white font-bold text-lg">Tanpa ArzaBot</h3></div>
            <ul className="space-y-3">{before.map((b, i) => <li key={i} className="flex items-start gap-2.5 text-gray-300 text-sm"><X size={16} className="text-red-400 flex-shrink-0 mt-0.5" />{b}</li>)}</ul>
          </div>
          <div className="bg-gradient-to-br from-emerald-950/30 to-blue-950/30 border border-emerald-700/40 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="flex items-center gap-2 mb-5 relative"><span className="w-9 h-9 bg-emerald-900/40 border border-emerald-700/40 rounded-xl flex items-center justify-center"><CheckCircle size={16} className="text-emerald-300" /></span><h3 className="text-white font-bold text-lg">Dengan ArzaBot</h3></div>
            <ul className="space-y-3 relative">{after.map((b, i) => <li key={i} className="flex items-start gap-2.5 text-gray-200 text-sm"><CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />{b}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===== LIVE FEED =====
function LiveFeedSection() {
  const base = [
    { who: 'Budi (Surabaya)', what: 'kampanye selesai · 248 komentar terkirim', icon: MessageSquare, color: 'text-emerald-400' },
    { who: 'Siti (Jakarta)', what: 'auto-join 5 grup niche fashion', icon: Compass, color: 'text-cyan-400' },
    { who: 'Reza (Medan)', what: 'listing terjual 15 menit setelah post', icon: Tag, color: 'text-pink-400' },
    { who: 'Dian (Bali)', what: 'upgrade Pro plan, 18 akun aktif', icon: TrendingUp, color: 'text-yellow-400' },
    { who: 'Joko (Bekasi)', what: 'AI generate 320 komentar bulan ini', icon: Bot, color: 'text-fuchsia-400' },
    { who: 'Lia (Semarang)', what: 'share 1 post ke 25 grup sukses', icon: Share2, color: 'text-teal-400' },
    { who: 'Ahmad (Bandung)', what: 'baru tambah akun ke-12', icon: UserPlus, color: 'text-blue-400' },
  ];
  const [items, setItems] = useState(base.slice(0, 4));
  useEffect(() => { let i = 4; const t = setInterval(() => { setItems(p => [base[i % base.length], ...p.slice(0, 3)]); i++; }, 3500); return () => clearInterval(t); }, []);
  return (
    <section className="py-16 px-4 bg-gray-900/40 border-y border-gray-800/40">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1 flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Aktivitas live</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Bisnis lain sedang scale-up. Kamu kapan?</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2"><p className="text-blue-400 text-lg font-bold"><CountUp target="10000" />+</p><p className="text-gray-500 text-[10px]">Komentar/hari</p></div>
            <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2"><p className="text-emerald-400 text-lg font-bold"><CountUp target="500" />+</p><p className="text-gray-500 text-[10px]">Pengguna</p></div>
            <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2"><p className="text-yellow-400 text-lg font-bold">99.9%</p><p className="text-gray-500 text-[10px]">Uptime</p></div>
          </div>
        </div>
        <div className="space-y-2">{items.map((a, i) => (
          <div key={`${a.who}-${i}`} className="bg-gray-800/40 border border-gray-700/40 rounded-xl px-4 py-3 flex items-center gap-3 text-sm" style={{ animation: i === 0 ? 'slideIn 0.4s ease-out' : 'none' }}>
            <a.icon size={16} className={a.color} /><span className="text-white font-medium">{a.who}</span><span className="text-gray-400 truncate flex-1">{a.what}</span><span className="text-gray-600 text-xs flex-shrink-0">baru saja</span>
          </div>
        ))}</div>
        <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </section>
  );
}

// ===== FEATURES =====
function FeaturesSection() {
  const [cat, setCat] = useState('all');
  const cats = [{id:'all',l:'Semua'},{id:'new',l:'🔥 Baru'},{id:'group',l:'Otomasi Grup'},{id:'safety',l:'Keamanan'},{id:'soon',l:'🚀 Coming Soon'}];

  const COMING_SOON = [
    { title: 'Cookie Pool Rotation', desc: 'Upload beberapa cookie per akun. Sistem rotasi otomatis supaya fingerprint bervariasi.', eta: 'Q3 2026' },
    { title: 'Reply Chain Multi-Turn', desc: 'Saat calon customer balas komentar, bot auto-reply multi-ronde sampai closing.', eta: 'Q3 2026' },
    { title: 'Comment Sentiment Guard', desc: 'Auto-hide komentar negatif, auto-reply positif. Reputation management otomatis.', eta: 'Q3 2026' },
    { title: 'Smart Schedule Timezone', desc: 'AI pilih jam post terbaik berdasarkan timezone & profil audiens target.', eta: 'Q3 2026' },
    { title: 'Post Performance Predictor', desc: 'AI prediksi kemungkinan kena spam filter & respons positif sebelum posting.', eta: 'Q3 2026' },
    { title: 'AI Content Calendar', desc: 'Upload foto produk, AI generate 30 hari konten + jadwal otomatis.', eta: 'Q4 2026' },
    { title: 'Post Recycler', desc: 'Post lama yang perform bagus di-rewrite AI & post ulang otomatis.', eta: 'Q4 2026' },
    { title: 'Cross-Platform Sync', desc: '1 post otomatis ke FB + WA Status + Telegram + Instagram.', eta: 'Q4 2026' },
    { title: 'Voice Comment (TTS)', desc: 'Generate voice note untuk komentar Reels. Engagement 3-5x lebih tinggi.', eta: 'Q4 2026' },
    { title: 'Marketplace Cross-Listing', desc: '1 listing ke FB Marketplace + Tokopedia + Shopee sekaligus.', eta: 'Q4 2026' },
    { title: 'Conversation-as-a-Service', desc: 'Tiap akun jadi sales person otomatis. AI balas inbox dengan persona + nomor WA.', eta: 'Q4 2026' },
  ];

  const filtered = cat === 'soon' ? [] : FEATURES.filter(f => {
    if (cat === 'all') return true;
    const t = f.title.toLowerCase();
    if (cat === 'new') return !!f.badge;
    if (cat === 'group') return /grup|group|sell|share|discover|join/i.test(t);
    if (cat === 'safety') return /anti|warming|checkpoint|detection/i.test(t);
    return true;
  });
  return (
    <section id="features" className="py-20 px-4 bg-gray-900/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-block bg-blue-900/30 border border-blue-700/40 text-blue-300 text-xs px-3 py-1 rounded-full mb-4 font-semibold uppercase tracking-wider">{FEATURES.length}+ fitur lengkap</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Senjata Lengkap yang Tidak Dimiliki Tools Lain</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Dari Auto Comment, Auto Join + AI Answer, hingga Auto Jual via Sell Something.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {cats.map(c => <button key={c.id} onClick={() => setCat(c.id)} className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${cat === c.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-gray-800/60 text-gray-400 hover:bg-gray-800 border border-gray-700/40'}`}>{c.l}</button>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cat === 'soon' ? (
            COMING_SOON.map((f, i) => (
              <div key={i} className="bg-purple-900/10 border border-purple-800/30 rounded-2xl p-5 hover:scale-[1.02] hover:border-purple-500/40 transition-all relative">
                <span className="absolute top-3 right-3 text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow">SOON</span>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-3 shadow-lg opacity-70"><Clock size={18} className="text-white" /></div>
                <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-2">{f.desc}</p>
                <span className="text-purple-400 text-xs font-medium">ETA: {f.eta}</span>
              </div>
            ))
          ) : (
            filtered.map((f, i) => (
            <div key={i} className={`${f.bg} border rounded-2xl p-5 hover:scale-[1.02] hover:border-white/20 transition-all relative`}>
              {f.badge && <span className="absolute top-3 right-3 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow">{f.badge}</span>}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3 shadow-lg`}><f.icon size={18} className="text-white" /></div>
              <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))
          )}
        </div>
      </div>
    </section>
  );
}

// ===== HOW IT WORKS =====
function HowSection() {
  const steps = [
    { n: '01', title: 'Tambah Akun & AI Key', desc: 'Import cookie Facebook lewat Cookie-Editor. Tambah AI key (Groq/0penAI/Gemini/custom). Auto-validasi 30 detik.' },
    { n: '02', title: 'Discover & Join Grup', desc: 'Cari grup sesuai keyword bisnis. Auto Join gabung bertahap, AI jawab pertanyaan keanggotaan.' },
    { n: '03', title: 'Otomasi Jalan 24/7', desc: 'Auto Comment, Auto Share, Auto Jual, Smart Monitor — semua paralel. Anti-Detection jaga akun aman.' },
  ];
  return (
    <section id="how" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Mulai Otomasi dalam 3 Langkah</h2><p className="text-gray-400 text-lg">Setup cuma 5 menit. Tidak perlu skill teknis.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((h, i) => (
            <div key={i} className="relative group">
              <div className="bg-gradient-to-br from-blue-950/40 to-gray-900/60 border border-blue-800/30 rounded-2xl p-6 h-full group-hover:border-blue-600/50 transition-colors">
                <span className="text-4xl font-black bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">{h.n}</span>
                <h3 className="text-white font-bold text-lg mt-3 mb-2">{h.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{h.desc}</p>
              </div>
              {i < 2 && <div className="hidden md:flex absolute top-1/2 -right-4 w-8 h-8 bg-gray-900 border border-gray-700 rounded-full items-center justify-center text-blue-400 z-10"><ArrowRight size={14} /></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== RESULTS =====
function ResultSection() {
  const cases = [
    { name: 'Toko Sepatu Bandung', metric: '3.2x', label: 'Penjualan dalam 60 hari', detail: 'Dari 5 akun manual jadi 18 akun otomatis.' },
    { name: 'Reseller Fashion Jakarta', metric: '+47', label: 'Pelanggan baru / minggu', detail: 'Auto Monitor + AI Comment, tidak pernah miss target.' },
    { name: 'Agen Properti Surabaya', metric: '0', label: 'Akun checkpoint sebulan', detail: 'AI Anti-Burnout & rotasi akun. Tahan jangka panjang.' },
  ];
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-gray-950 to-blue-950/10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12"><span className="inline-block bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-xs px-3 py-1 rounded-full mb-4 font-semibold uppercase tracking-wider">Hasil nyata pengguna</span><h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Bukan janji manis, ini hasilnya.</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cases.map((c, i) => (
            <div key={i} className="bg-gradient-to-br from-emerald-950/20 to-blue-950/20 border border-emerald-700/30 rounded-2xl p-6 hover:scale-[1.02] transition-transform">
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">{c.name}</p>
              <p className="text-4xl sm:text-5xl font-black bg-gradient-to-br from-emerald-300 to-blue-300 bg-clip-text text-transparent mb-2">{c.metric}</p>
              <p className="text-white font-semibold mb-2">{c.label}</p>
              <p className="text-gray-400 text-sm">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== TESTIMONIALS =====
function TestimonialSection() {
  const items = [
    { name: 'Budi Santoso', role: 'Toko Online Surabaya', text: 'Penjualan naik 3x lipat dalam 2 bulan. Komentar otomatis bikin produk tampil terus. ROI jelas banget.' },
    { name: 'Siti Rahayu', role: 'Dropshipper Jakarta', text: 'Setelah trial 3 hari langsung ketagihan. 20 akun jalan 24 jam tanpa saya pelototin.' },
    { name: 'Ahmad Fauzi', role: 'Reseller Fashion Bandung', text: 'AI Generate komentarnya natural. Sebulan 0 checkpoint. ROI 10x dari budget FB Ads.' },
  ];
  return (
    <section id="testimonials" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Yang sudah pakai bilang apa</h2><div className="flex items-center justify-center gap-1.5 mt-2 text-sm"><span className="flex">{[1,2,3,4,5].map(i=><Star key={i} size={18} className="text-yellow-400 fill-yellow-400" />)}</span><span className="text-white font-semibold ml-1">4.9/5</span><span className="text-gray-500">· 300+ ulasan</span></div></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <div key={i} className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 hover:border-blue-500/40 transition-colors">
              <div className="flex gap-0.5 mb-3">{[1,2,3,4,5].map(s=><Star key={s} size={14} className="text-yellow-400 fill-yellow-400" />)}</div>
              <p className="text-gray-200 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">{t.name[0]}</div><div><p className="text-white text-sm font-semibold">{t.name}</p><p className="text-gray-500 text-xs">{t.role}</p></div><CheckCircle size={14} className="text-emerald-500 ml-auto" /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== PRICING =====
function PricingSection({ registerLink }) {
  const [plans, setPlans] = useState([]);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [payResult, setPayResult] = useState(null);
  useEffect(() => {
    fetch('/api/plans').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length > 0) setPlans(data);
    }).catch(() => {});
  }, []);

  const formatPrice = (price) => {
    if (!price || price === 0) return 'GRATIS';
    return 'Rp ' + Number(price).toLocaleString('id-ID');
  };

  const displayPlans = plans.length > 0 ? plans.map(p => ({
    ...p,
    priceLabel: formatPrice(p.price),
    period: p.price > 0 ? `/ ${p.duration_days} hari` : `${p.duration_days} Hari`,
    color: p.is_popular ? 'blue' : (p.price === 0 ? 'gray' : 'purple'),
    popular: p.is_popular,
    features: Array.isArray(p.features) ? p.features : [],
  })) : [
    { id: 'trial', name: 'Trial', priceLabel: 'GRATIS', price: 0, period: '3 Hari', color: 'gray', features: ['5 Kampanye', '3 Akun FB', 'Semua Fitur Dasar'] },
    { id: 'pro', name: 'Pro', priceLabel: 'Terjangkau', price: 89000, period: '/bulan', color: 'blue', popular: true, features: ['Unlimited Kampanye', '20 Akun FB', 'Semua Fitur Premium'] },
  ];

  return (
    <section id="pricing" className="py-20 px-4 bg-gray-900/40 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/10 blur-3xl" /></div>
      <div className="max-w-5xl mx-auto text-center relative">
        <span className="inline-block bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-xs px-3 py-1 rounded-full mb-4 font-semibold uppercase tracking-wider">Garansi 7 hari uang kembali</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Investasi Kecil, ROI Berlipat</h2>
        <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">Coba gratis dulu. Tidak puas? Refund 100% tanpa pertanyaan.</p>
        <div className={`grid grid-cols-1 gap-6 mb-10 ${displayPlans.length === 2 ? 'sm:grid-cols-2 max-w-3xl mx-auto' : displayPlans.length >= 3 ? 'sm:grid-cols-3' : ''}`}>
          {displayPlans.map((p, i) => (
            <div key={p.id || i} className={`relative bg-gray-900 border ${p.popular ? 'border-blue-500 shadow-lg shadow-blue-500/20 sm:scale-105' : 'border-gray-700'} rounded-2xl p-6 text-left`}>
              {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1"><Flame size={11} /> POPULER</div>}
              <h3 className="text-white font-bold text-lg mb-1">{p.name}</h3>
              <div className="mb-5"><span className={`text-2xl sm:text-3xl font-extrabold ${p.color === 'blue' ? 'text-blue-400' : p.color === 'purple' ? 'text-purple-400' : 'text-white'}`}>{p.priceLabel}</span><span className="text-gray-500 text-sm ml-1">{p.period}</span></div>
              <ul className="space-y-2 mb-6">{p.features.map(f => <li key={f} className="flex items-start gap-2 text-sm text-gray-300"><CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />{f}</li>)}</ul>
              {p.price === 0 ? (
                <Link to={registerLink} className="block text-center py-3 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-colors">Mulai Gratis</Link>
              ) : (
                <button onClick={() => setCheckoutPlan(p)} className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${p.popular ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'}`}>Pilih Paket Ini</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400"><span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Garansi 7 hari</span><span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Cancel kapan saja</span><span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> QRIS & Transfer Bank</span></div>
      </div>
      {checkoutPlan && !payResult && <CheckoutModal plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} onSuccess={setPayResult} />}
      {payResult && <PaymentInfoModal data={payResult} onClose={() => { setPayResult(null); setCheckoutPlan(null); }} />}
    </section>
  );
}

function CheckoutModal({ plan, onClose, onSuccess }) {
  const [form, setForm] = useState({ username: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const ref = new URLSearchParams(location.search).get('ref') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/register-and-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, plan_id: plan.id, referral_code: ref || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal');
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Checkout: {plan.name}</h2>
            <p className="text-gray-400 text-sm">{plan.priceLabel} {plan.period}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Username *</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" required minLength={3} value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="username_kamu" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Email *</label>
            <input type="email" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@kamu.com" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Nomor HP (WhatsApp) *</label>
            <input type="tel" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500" required minLength={8} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="08xxxxxxxxxx" />
          </div>
          <p className="text-gray-500 text-xs">Password akan di-generate otomatis dan ditampilkan setelah checkout.</p>
          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl transition-all">
            {loading ? 'Memproses...' : 'Lanjut ke Pembayaran'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PaymentInfoModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg my-8">
        <div className="p-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><CheckCircle size={18} className="text-emerald-400" /> Akun Berhasil Dibuat!</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4 space-y-2">
            <p className="text-emerald-300 text-sm font-semibold">Simpan data login kamu:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-400">Username:</span><span className="text-white font-mono">{data.username}</span>
              <span className="text-gray-400">Password:</span><span className="text-white font-mono font-bold">{data.password}</span>
            </div>
            <p className="text-yellow-300 text-xs mt-2">⚠️ Catat password ini! Tidak bisa dilihat lagi setelah modal ditutup.</p>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4 space-y-2">
            <p className="text-blue-300 text-sm font-semibold">Detail Pembayaran</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-400">Order ID:</span><span className="text-white font-mono text-xs">{data.order_id}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Paket:</span><span className="text-white">{data.plan_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Harga:</span><span className="text-white">Rp {Number(data.plan_price).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Kode Unik:</span><span className="text-yellow-300 font-bold">+{data.unique_code}</span></div>
              <div className="flex justify-between border-t border-gray-700 pt-2 mt-2"><span className="text-white font-semibold">TOTAL TRANSFER:</span><span className="text-2xl font-extrabold text-emerald-400">Rp {Number(data.total_amount).toLocaleString('id-ID')}</span></div>
            </div>
          </div>

          {data.qris_image_url && (
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <p className="text-white text-sm font-semibold mb-2">Scan QRIS</p>
              <img src={data.qris_image_url} alt="QRIS" className="mx-auto max-w-[220px] rounded-lg border border-gray-700" />
              {data.qris_name && <p className="text-gray-400 text-xs mt-2">{data.qris_name}</p>}
            </div>
          )}

          {data.banks && data.banks.length > 0 && (
            <div className="space-y-2">
              <p className="text-white text-sm font-semibold">Transfer Bank</p>
              {data.banks.map((b, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{b.bank}</p>
                    <p className="text-blue-400 font-mono text-lg font-bold">{b.number}</p>
                    <p className="text-gray-400 text-xs">a.n. {b.name}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(b.number); }} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg">Copy</button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3">
            <p className="text-yellow-300 text-xs">Transfer dengan nominal TEPAT <strong>Rp {Number(data.total_amount).toLocaleString('id-ID')}</strong> (termasuk kode unik). Akun akan aktif setelah pembayaran dikonfirmasi admin.</p>
          </div>

          <button onClick={onClose} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl border border-gray-700 transition-colors">Tutup & Login</button>
        </div>
      </div>
    </div>
  );
}

// ===== FAQ =====
function FAQSection() {
  const faqs = [
    { q: 'Apakah akun Facebook saya aman?', a: 'Sangat aman. AI Anti-Burnout, delay acak, rotasi akun, fingerprint protection, proxy support. 99% pengguna tidak pernah checkpoint.' },
    { q: 'Bedanya dengan tools lain?', a: 'Kami punya fitur unik: AI Anti-Burnout, AI Multi-Persona, Auto Join + AI Answer, Auto Jual via Sell Something, Group Quality Score, Anti-Detection Dashboard. Belum ada tools lokal yang punya kombinasi ini.' },
    { q: 'Perlu skill teknis?', a: 'Tidak. Setup pakai Cookie-Editor, 5 menit selesai. Semua fitur ada wizard yang user-friendly.' },
    { q: 'Bisa pakai berapa akun?', a: 'Trial 3 akun, Pro 20 akun, Enterprise unlimited. Multi-akun paralel dengan proxy berbeda.' },
    { q: 'Bisa refund?', a: 'Bisa. Garansi 7 hari uang kembali, no questions asked.' },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10"><h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pertanyaan yang sering ditanya</h2></div>
        <div className="space-y-3">{faqs.map((f, i) => (
          <div key={i} className={`bg-gray-900/60 border rounded-2xl overflow-hidden transition-all ${open === i ? 'border-blue-500/40' : 'border-gray-800'}`}>
            <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"><span className="text-white font-medium">{f.q}</span><ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${open === i ? 'rotate-180 text-blue-400' : ''}`} /></button>
            {open === i && <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed border-t border-gray-800/50 pt-3">{f.a}</div>}
          </div>
        ))}</div>
      </div>
    </section>
  );
}

// ===== FINAL CTA =====
function FinalCTASection({ registerLink }) {
  return (
    <section className="py-24 px-4 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-pink-900/20 border-y border-blue-800/30 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"><div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" /><div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.15),transparent_50%)]" /></div>
      <div className="max-w-3xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 text-xs px-4 py-1.5 rounded-full mb-5"><Flame size={14} /> Trial 3 hari · tanpa kartu kredit</div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">Saatnya akun Facebook<br /><span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">kerja untukmu</span> — 24 jam.</h2>
        <p className="text-gray-300 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">Bergabung dengan 500+ pebisnis yang sudah scale-up. Coba gratis, batalkan kapan saja.</p>
        <Link to={registerLink} className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-bold px-10 py-5 rounded-2xl text-lg sm:text-xl transition-all shadow-2xl shadow-blue-600/30 hover:-translate-y-1">Mulai Trial Gratis Sekarang <ArrowRight size={20} /></Link>
        <p className="text-gray-400 text-sm mt-4">Aktif instan · Tanpa kartu kredit · Garansi 7 hari uang kembali</p>
      </div>
    </section>
  );
}

// ===== STICKY MOBILE =====
function StickyMobile({ registerLink }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const fn = () => setShow(window.scrollY > 600); window.addEventListener('scroll', fn); return () => window.removeEventListener('scroll', fn); }, []);
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform ${show ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="bg-gray-900/95 backdrop-blur-xl border-t border-gray-700/50 px-4 py-3 flex items-center gap-3 shadow-2xl">
        <div className="flex-1 min-w-0"><p className="text-white text-sm font-semibold truncate">Coba gratis 3 hari</p><p className="text-gray-500 text-xs truncate">Tanpa kartu kredit · 5 menit setup</p></div>
        <Link to={registerLink} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl flex-shrink-0 shadow-lg">Daftar</Link>
      </div>
    </div>
  );
}

// ===== MAIN =====
export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();
  const ref = new URLSearchParams(location.search).get('ref') || '';
  const registerLink = ref ? `/register?ref=${ref}` : '/register';
  const branding = useBranding();
  const brandName = branding.brand_name || 'ArzaBot';

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <nav className="sticky top-0 z-50 bg-gray-950/85 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">{branding.brand_logo_url ? <img src={branding.brand_logo_url} alt={brandName} className="h-9 max-w-[160px] object-contain" /> : <><div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30"><Facebook size={18} className="text-white" /></div><span className="text-white font-bold text-lg">{brandName}</span></>}</Link>
            <div className="hidden md:flex items-center gap-7"><a href="#features" className="text-gray-400 hover:text-white text-sm">Fitur</a><a href="#how" className="text-gray-400 hover:text-white text-sm">Cara Kerja</a><a href="#testimonials" className="text-gray-400 hover:text-white text-sm">Testimoni</a><a href="#pricing" className="text-gray-400 hover:text-white text-sm">Harga</a></div>
            <div className="hidden md:flex items-center gap-3"><Link to="/login" className="text-gray-400 hover:text-white text-sm px-4 py-2">Masuk</Link><Link to={registerLink} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm px-5 py-2 rounded-xl font-semibold shadow-lg shadow-blue-600/30">Coba Gratis</Link></div>
            <button onClick={() => setMobileMenu(m => !m)} className="md:hidden text-gray-400 hover:text-white">{mobileMenu ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
          {mobileMenu && <div className="md:hidden pb-4 space-y-2 border-t border-gray-800 pt-3"><a href="#features" onClick={()=>setMobileMenu(false)} className="block text-gray-400 hover:text-white text-sm py-2">Fitur</a><a href="#how" onClick={()=>setMobileMenu(false)} className="block text-gray-400 hover:text-white text-sm py-2">Cara Kerja</a><a href="#testimonials" onClick={()=>setMobileMenu(false)} className="block text-gray-400 hover:text-white text-sm py-2">Testimoni</a><a href="#pricing" onClick={()=>setMobileMenu(false)} className="block text-gray-400 hover:text-white text-sm py-2">Harga</a><div className="flex gap-2 pt-2"><Link to="/login" className="flex-1 text-center text-sm py-2 border border-gray-700 rounded-xl text-gray-300">Masuk</Link><Link to={registerLink} className="flex-1 text-center text-sm py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white font-medium">Daftar</Link></div></div>}
        </div>
      </nav>

      <HeroSection registerLink={registerLink} />
      <ProblemSection />
      <BeforeAfterSection />
      <LiveFeedSection />
      <FeaturesSection />
      <HowSection />
      <ResultSection />
      <TestimonialSection />
      <PricingSection registerLink={registerLink} />
      <FAQSection />
      <FinalCTASection registerLink={registerLink} />

      <footer className="py-10 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">{branding.brand_logo_url ? <img src={branding.brand_logo_url} alt={brandName} className="h-7 max-w-[130px] object-contain" /> : <><div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center"><Facebook size={15} className="text-white" /></div><span className="text-white font-bold">{brandName}</span></>}</div>
          <p className="text-gray-500 text-xs text-center">{brandName} © {new Date().getFullYear()}. Platform otomasi Facebook untuk pebisnis Indonesia.</p>
          <div className="flex items-center gap-4 text-sm"><Link to="/login" className="text-gray-500 hover:text-gray-300">Masuk</Link><Link to={registerLink} className="text-blue-400 hover:text-blue-300 font-medium">Daftar</Link></div>
        </div>
      </footer>

      <StickyMobile registerLink={registerLink} />
    </div>
  );
}
