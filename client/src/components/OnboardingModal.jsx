import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, CheckCircle, ExternalLink, Copy, AlertTriangle } from 'lucide-react';
import api from '../utils/api';

const STEPS = [
  {
    id: 'welcome',
    title: 'Selamat Datang di ArzaBot! 🎉',
    subtitle: 'Ikuti panduan singkat ini untuk mulai otomasi Facebook kamu',
    icon: '🚀',
  },
  {
    id: 'install_extension',
    title: 'Install Ekstensi Cookie',
    subtitle: 'Kamu butuh ekstensi browser untuk mengambil cookies Facebook',
    icon: '🔧',
  },
  {
    id: 'get_cookies',
    title: 'Ambil Cookies Facebook',
    subtitle: 'Login ke Facebook lalu ambil cookies dengan ekstensi',
    icon: '🍪',
  },
  {
    id: 'add_account',
    title: 'Tambah Akun Facebook',
    subtitle: 'Paste cookies ke ArzaBot untuk mulai otomasi',
    icon: '👤',
  },
  {
    id: 'done',
    title: 'Siap Digunakan!',
    subtitle: 'Akun kamu sudah terhubung. Mulai eksplorasi fitur ArzaBot',
    icon: '✅',
  },
];

function StepInstallExtension() {
  const [copied, setCopied] = useState('');
  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-300 text-sm">Pilih salah satu ekstensi berikut sesuai browser kamu:</p>
      <div className="grid grid-cols-1 gap-3">
        {[
          { name: 'J2Team Cookies', browser: 'Chrome / Edge', url: 'https://chrome.google.com/webstore/detail/j2team-cookies/okpidcojinmlaakglciglbpcpajaibco', desc: 'Paling populer, export JSON' },
          { name: 'EditThisCookie', browser: 'Chrome / Edge', url: 'https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg', desc: 'Klasik, mudah dipakai' },
          { name: 'Cookie-Editor', browser: 'Firefox / Chrome', url: 'https://cookie-editor.com/', desc: 'Support semua browser' },
        ].map(ext => (
          <div key={ext.name} className="flex items-center justify-between bg-gray-800 rounded-xl p-3 border border-gray-700">
            <div>
              <p className="text-white font-medium text-sm">{ext.name}</p>
              <p className="text-gray-400 text-xs">{ext.browser} · {ext.desc}</p>
            </div>
            <a href={ext.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 text-xs hover:text-blue-300 bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-800/40">
              Install <ExternalLink size={11} />
            </a>
          </div>
        ))}
      </div>
      <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3">
        <p className="text-yellow-300 text-xs">⚠️ Pastikan kamu sudah <strong>login ke Facebook</strong> di browser yang sama sebelum lanjut ke langkah berikutnya.</p>
      </div>
    </div>
  );
}

function StepGetCookies() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {[
          { step: '1', text: 'Buka Facebook.com di browser kamu', icon: '🌐' },
          { step: '2', text: 'Login ke akun Facebook yang ingin diotomasi', icon: '🔑' },
          { step: '3', text: 'Klik ikon ekstensi Cookie di toolbar browser', icon: '🍪' },
          { step: '4', text: 'Klik tombol "Export" atau "Copy All" untuk menyalin semua cookies', icon: '📋' },
          { step: '5', text: 'Simpan hasil copy — kamu akan paste di langkah berikutnya', icon: '💾' },
        ].map(item => (
          <div key={item.step} className="flex items-start gap-3 bg-gray-800 rounded-xl p-3">
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            <div>
              <span className="text-blue-400 text-xs font-bold">Langkah {item.step}</span>
              <p className="text-gray-200 text-sm mt-0.5">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-3">
        <p className="text-blue-300 text-xs">💡 <strong>Tips:</strong> Gunakan akun Facebook yang sudah berumur minimal 3 bulan dan aktif posting untuk hasil terbaik. Akun baru lebih mudah kena checkpoint.</p>
      </div>
    </div>
  );
}

function StepAddAccount({ onAccountAdded }) {
  const [cookies, setCookies] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = async () => {
    if (!cookies.trim()) return setError('Paste cookies Facebook kamu dulu');
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/accounts', { name: 'Akun Facebook Saya', cookies: cookies.trim() });
      setSuccess('✅ Akun berhasil ditambahkan!');
      setTimeout(() => onAccountAdded?.(), 1500);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      if (msg.includes('expired') || msg.includes('valid')) {
        setError('❌ Cookies tidak valid atau sudah expired. Pastikan kamu sudah login Facebook dan ambil cookies yang benar.');
      } else if (msg.includes('Langganan')) {
        setError('❌ Batas akun tercapai untuk paket kamu. Upgrade paket untuk menambah lebih banyak akun.');
      } else {
        setError('❌ ' + msg);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">Paste Cookies Facebook kamu di sini:</label>
        <textarea
          className="w-full bg-gray-800 border border-gray-600 rounded-xl p-3 text-gray-200 text-xs font-mono min-h-[120px] resize-none focus:outline-none focus:border-blue-500"
          placeholder='[{"name":"c_user","value":"..."},{"name":"xs","value":"..."}]&#10;&#10;atau format: c_user=123; xs=abc; ...'
          value={cookies}
          onChange={e => setCookies(e.target.value)}
        />
        <p className="text-gray-500 text-xs mt-1">Format JSON (dari J2Team/Cookie-Editor) atau format string (key=value; ...)</p>
      </div>
      {error && <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3 text-red-300 text-sm">{error}</div>}
      {success && <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-3 text-green-300 text-sm">{success}</div>}
      <button onClick={handleAdd} disabled={loading || !cookies.trim()}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white">
        {loading ? '⏳ Memvalidasi & Menambahkan...' : '➕ Tambah Akun Facebook'}
      </button>
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
        <p className="text-gray-400 text-xs">🔒 <strong className="text-gray-300">Keamanan:</strong> Cookies disimpan terenkripsi di server kami dan hanya digunakan untuk otomasi yang kamu aktifkan. Kami tidak pernah mengakses akun kamu tanpa izin.</p>
      </div>
    </div>
  );
}

function StepDone() {
  const features = [
    { icon: '💬', name: 'Auto Komentar', desc: 'Komentar otomatis ke ratusan postingan' },
    { icon: '👥', name: 'Auto Join Grup', desc: 'Gabung grup target secara otomatis' },
    { icon: '📢', name: 'Post ke Grup', desc: 'Posting iklan ke banyak grup sekaligus' },
    { icon: '🔥', name: 'Account Warming', desc: 'Hangatkan akun baru supaya tidak kena checkpoint' },
    { icon: '🤖', name: 'Smart AI Comment', desc: 'Komentar yang relevan dengan konten postingan' },
  ];
  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <div className="text-5xl mb-3">🎊</div>
        <p className="text-gray-300 text-sm">Akun kamu sudah terhubung. Sekarang kamu bisa mulai menggunakan semua fitur ArzaBot!</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {features.map(f => (
          <div key={f.name} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
            <span className="text-xl">{f.icon}</span>
            <div>
              <p className="text-white text-sm font-medium">{f.name}</p>
              <p className="text-gray-400 text-xs">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(0);
  const [accountAdded, setAccountAdded] = useState(false);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const canNext = step !== 3 || accountAdded; // step add account harus selesai dulu

  const handleAccountAdded = () => {
    setAccountAdded(true);
    setTimeout(() => setStep(4), 500);
  };

  const renderContent = () => {
    switch (currentStep.id) {
      case 'welcome': return (
        <div className="space-y-4 text-center py-4">
          <div className="text-6xl">{currentStep.icon}</div>
          <div className="space-y-3">
            {[
              { icon: '⚡', text: 'Setup dalam 5 menit' },
              { icon: '🔒', text: 'Aman & terenkripsi' },
              { icon: '🤖', text: 'Otomasi 24/7 tanpa perlu online' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3 text-left">
                <span className="text-xl">{item.icon}</span>
                <span className="text-gray-200 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-400 text-xs">Panduan ini hanya butuh 5 menit. Kamu bisa skip kapan saja dan kembali lewat menu Bantuan.</p>
        </div>
      );
      case 'install_extension': return <StepInstallExtension />;
      case 'get_cookies': return <StepGetCookies />;
      case 'add_account': return <StepAddAccount onAccountAdded={handleAccountAdded} />;
      case 'done': return <StepDone />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-lg">{currentStep.title}</h2>
            <p className="text-gray-400 text-sm mt-0.5">{currentStep.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-blue-500' : 'bg-gray-700'}`} />
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-1.5">Langkah {step + 1} dari {STEPS.length}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-800">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-4 py-2 rounded-xl hover:bg-gray-800 transition-all">
            <ChevronLeft size={16} />
            {step === 0 ? 'Skip' : 'Kembali'}
          </button>

          {!isLast ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded-xl font-medium transition-all">
              {step === 3 && !accountAdded ? 'Tambah akun dulu' : 'Lanjut'}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={onClose}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm px-5 py-2 rounded-xl font-medium transition-all">
              <CheckCircle size={16} />
              Mulai Pakai ArzaBot
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
