import React from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, Sparkles, Bell } from 'lucide-react';

const COMING_SOON_FEATURES = {
  '/cookie-rotation': {
    title: 'Cookie Pool Rotation',
    desc: 'Upload beberapa cookie per akun (login dari device berbeda). Sistem rotasi otomatis supaya fingerprint bervariasi dan akun lebih tahan lama.',
    eta: 'Q3 2026',
  },
  '/post-predictor': {
    title: 'Post Performance Predictor',
    desc: 'Sebelum posting ke 50 grup, AI prediksi: kemungkinan kena spam filter, kemungkinan respons positif, dan jam terbaik untuk post ini.',
    eta: 'Q3 2026',
  },
  '/reply-chain': {
    title: 'Reply Chain Otomatis (Multi-Turn)',
    desc: 'Saat calon customer balas komentar ("DM kak", "WA?"), bot auto-reply dengan link WA + balas natural. Multi-turn conversation, bukan cuma 1 ronde.',
    eta: 'Q3 2026',
  },
  '/sentiment-guard': {
    title: 'Comment Sentiment Guard',
    desc: 'Bot auto-baca komentar di post kamu. Negatif? Auto-hide atau auto-reply sopan. Positif/buying-intent? Ping ke admin via Telegram + auto-reply CTA.',
    eta: 'Q3 2026',
  },
  '/cross-platform': {
    title: 'Cross-Platform Sync',
    desc: '1 post otomatis ter-share ke FB + WA Business Status + Telegram Channel + Instagram. Satu klik, semua platform terisi konten.',
    eta: 'Q4 2026',
  },
  '/content-calendar': {
    title: 'AI Content Calendar',
    desc: 'Upload foto produk + harga, AI generate 30 hari konten (caption, post, story). Jadwal otomatis ke berbagai akun. Set and forget.',
    eta: 'Q4 2026',
  },
  '/post-recycler': {
    title: 'Post Recycler (Evergreen Content)',
    desc: 'Post lama yang performanya bagus dipantau. Setelah 60 hari, AI rewrite caption, post ulang. Konten evergreen terus bekerja.',
    eta: 'Q4 2026',
  },
  '/voice-comment': {
    title: 'Voice Comment & Auto-Voice Reply',
    desc: 'Generate voice note pakai TTS untuk komentar Reels. Voice reply lebih jarang ke-flag dan engagement 3-5x lebih tinggi.',
    eta: 'Q4 2026',
  },
  '/marketplace-crosslist': {
    title: 'Marketplace Cross-Listing',
    desc: '1 listing posting otomatis di FB Marketplace + WhatsApp Catalog + Tokopedia/Shopee mirror. Multi-platform dari satu dashboard.',
    eta: 'Q4 2026',
  },
  '/smart-schedule': {
    title: 'Smart Schedule by Audience Timezone',
    desc: 'Input target audience (mis. "TKI di Saudi", "Mahasiswa Jakarta"). Sistem auto-pilih jam post terbaik berdasarkan timezone + jam aktif audiens.',
    eta: 'Q3 2026',
  },
  '/conversation-service': {
    title: 'Conversation-as-a-Service',
    desc: 'Tiap akun bot diset persona dan pemilik. Saat calon customer inbox, sistem balas dengan persona + nomor WA pemilik. 1 akun = 1 sales person otomatis.',
    eta: 'Q4 2026',
  },
};

export default function ComingSoonPage() {
  const location = useLocation();
  const feature = COMING_SOON_FEATURES[location.pathname] || {
    title: 'Fitur Segera Hadir',
    desc: 'Fitur ini sedang dalam pengembangan dan akan segera tersedia.',
    eta: 'Coming Soon',
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-3xl flex items-center justify-center">
          <Clock size={36} className="text-purple-400" />
        </div>

        <div className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-700/40 text-purple-300 text-xs px-3 py-1 rounded-full mb-4 font-semibold uppercase tracking-wider">
          <Sparkles size={12} /> Coming Soon · {feature.eta}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">{feature.title}</h1>
        <p className="text-gray-400 text-base leading-relaxed mb-8">{feature.desc}</p>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 text-left space-y-3">
          <div className="flex items-center gap-3">
            <Bell size={16} className="text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">Mau dinotifikasi saat fitur ini rilis?</p>
              <p className="text-gray-500 text-xs">Kamu akan otomatis dapat akses begitu fitur ini live. Tidak perlu daftar ulang.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="flex -space-x-2">
              {['B', 'S', 'A', 'R'].map((l, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border-2 border-gray-900 flex items-center justify-center text-white text-[10px] font-bold">{l}</div>
              ))}
            </div>
            <span className="text-gray-500 text-xs">+127 orang menunggu fitur ini</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3">
            <p className="text-purple-400 text-lg font-bold">AI</p>
            <p className="text-gray-500 text-[10px]">Powered</p>
          </div>
          <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3">
            <p className="text-blue-400 text-lg font-bold">Auto</p>
            <p className="text-gray-500 text-[10px]">Otomatis</p>
          </div>
          <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3">
            <p className="text-emerald-400 text-lg font-bold">Safe</p>
            <p className="text-gray-500 text-[10px]">Anti-Ban</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { COMING_SOON_FEATURES };
