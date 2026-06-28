import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, CreditCard, Clock, ArrowRight } from 'lucide-react';

export default function PaywallOverlay() {
  const [blocked, setBlocked] = useState(null);

  useEffect(() => {
    const handler = (e) => setBlocked(e.detail);
    window.addEventListener('subscription-blocked', handler);
    return () => window.removeEventListener('subscription-blocked', handler);
  }, []);

  if (!blocked) return null;

  const isPending = blocked.code === 'PAYMENT_PENDING';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md text-center p-8">
        <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-2xl flex items-center justify-center">
          {isPending ? <Clock size={32} className="text-yellow-400" /> : <Lock size={32} className="text-orange-400" />}
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {isPending ? 'Pembayaran Belum Selesai' : 'Langganan Tidak Aktif'}
        </h2>

        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          {isPending
            ? 'Akun kamu sudah terdaftar tapi pembayaran belum dikonfirmasi. Selesaikan pembayaran untuk mengakses semua fitur.'
            : 'Masa langganan kamu sudah habis. Perpanjang langganan untuk melanjutkan menggunakan semua fitur.'}
        </p>

        <div className="space-y-3">
          <Link
            to={isPending ? '/payment/pending-info' : '/pricing'}
            onClick={() => setBlocked(null)}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl transition-all"
          >
            <CreditCard size={16} />
            {isPending ? 'Lihat Instruksi Pembayaran' : 'Perpanjang Langganan'}
            <ArrowRight size={16} />
          </Link>

          <button
            onClick={() => setBlocked(null)}
            className="w-full py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors"
          >
            Tutup
          </button>
        </div>

        <p className="text-gray-600 text-xs mt-4">
          {isPending
            ? 'Sudah transfer? Tunggu konfirmasi admin (maks 1x24 jam) atau hubungi support.'
            : 'Butuh bantuan? Hubungi admin via WhatsApp.'}
        </p>
      </div>
    </div>
  );
}
