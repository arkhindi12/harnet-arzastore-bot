import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, Loader2, Calendar, RefreshCw } from 'lucide-react';
import api from '../utils/api';

async function refreshUserSession() {
  try {
    const res = await api.get('/auth/me');
    const fresh = res.data;
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    const updated = { ...stored, ...fresh };
    localStorage.setItem('user', JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

export default function PaymentResultPage({ type }) {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [verifying, setVerifying] = useState(true);
  const [status, setStatus] = useState(type);
  const [userData, setUserData] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    async function verify() {
      if (!orderId) { setVerifying(false); return; }
      try {
        const r = await api.post(`/payments/verify/${orderId}`);
        const newStatus = r.data.status === 'paid' ? 'finish'
          : r.data.status === 'pending' ? 'pending'
          : 'error';
        setStatus(newStatus);
        setPayment(r.data.payment);

        if (newStatus === 'finish') {
          const user = await refreshUserSession();
          setUserData(user);
        }
      } catch {
        setStatus(type);
      } finally {
        setVerifying(false);
      }
    }
    verify();
  }, [orderId]);

  useEffect(() => {
    if (status !== 'finish') return;
    if (countdown <= 0) {
      window.location.href = '/';
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="text-blue-400 animate-spin" />
        <p className="text-white font-semibold text-lg">Memverifikasi Pembayaran...</p>
        <p className="text-gray-400 text-sm">Mohon tunggu, kami sedang mengkonfirmasi pembayaran Anda</p>
      </div>
    );
  }

  if (status === 'finish') {
    const expiresAt = userData?.expires_at;
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-green-500/30">
            <CheckCircle size={52} className="text-green-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Pembayaran Berhasil! 🎉</h1>
          <p className="text-gray-400 mb-6">Langganan Anda telah aktif. Selamat menikmati semua fitur ArzaBot!</p>

          {expiresAt && (
            <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-green-300 mb-1">
                <Calendar size={16} />
                <span className="font-semibold">Masa Aktif Langganan</span>
              </div>
              <p className="text-white text-xl font-bold">{formatDate(expiresAt)}</p>
              {(() => {
                const days = Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
                return <p className="text-green-400 text-sm mt-1">{days} hari aktif</p>;
              })()}
            </div>
          )}

          {orderId && <p className="text-gray-600 text-xs mb-4">Order ID: {orderId}</p>}

          <div className="space-y-3">
            <button
              onClick={() => { window.location.href = '/'; }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Ke Dashboard
              <span className="bg-blue-500/40 text-xs px-1.5 py-0.5 rounded-full">{countdown}s</span>
            </button>
            <p className="text-gray-500 text-xs">Anda akan diarahkan otomatis dalam {countdown} detik</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 bg-yellow-900/40 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-yellow-500/30">
            <Clock size={52} className="text-yellow-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Menunggu Pembayaran</h1>
          <p className="text-gray-400 mb-4">Pembayaran Anda sedang diproses. Langganan akan aktif otomatis setelah pembayaran dikonfirmasi oleh bank atau penyedia layanan.</p>
          <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4 mb-6 text-left">
            <p className="text-yellow-300 text-sm font-semibold mb-2">Catatan penting:</p>
            <ul className="text-yellow-200/70 text-sm space-y-1">
              <li>• Transfer bank biasanya dikonfirmasi dalam 1-3 menit</li>
              <li>• Indomaret/Alfamart perlu konfirmasi manual oleh kasir</li>
              <li>• E-wallet biasanya langsung terkonfirmasi</li>
            </ul>
          </div>
          {orderId && <p className="text-gray-600 text-xs mb-4">Order ID: {orderId}</p>}
          <div className="space-y-3">
            <button
              onClick={async () => {
                setVerifying(true);
                try {
                  const r = await api.post(`/payments/verify/${orderId}`);
                  if (r.data.status === 'paid') {
                    setStatus('finish');
                    const user = await refreshUserSession();
                    setUserData(user);
                    setCountdown(5);
                  }
                } catch {}
                setVerifying(false);
              }}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Cek Status Pembayaran
            </button>
            <Link to="/pricing" className="btn-secondary w-full text-center block">Lihat Paket Lain</Link>
            <Link to="/" className="text-gray-500 hover:text-white text-sm transition-colors block">Kembali ke Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-red-500/30">
          <XCircle size={52} className="text-red-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Pembayaran Gagal</h1>
        <p className="text-gray-400 mb-6">Maaf, pembayaran Anda tidak berhasil. Silakan coba lagi atau pilih metode pembayaran lain.</p>
        {orderId && <p className="text-gray-600 text-xs mb-6">Order ID: {orderId}</p>}
        <div className="space-y-3">
          <Link to="/pricing" className="btn-primary w-full text-center block">Coba Lagi</Link>
          <Link to="/" className="text-gray-500 hover:text-white text-sm transition-colors block">Kembali ke Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
