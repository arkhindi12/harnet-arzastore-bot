import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Crown, Star, Clock, Users, Megaphone, Loader2, CreditCard, Shield } from 'lucide-react';
import api from '../utils/api';

const PAYMENT_ICONS = [
  { name: 'GoPay', color: '#00AED6' },
  { name: 'OVO', color: '#4C3494' },
  { name: 'DANA', color: '#118EEA' },
  { name: 'ShopeePay', color: '#EE4D2D' },
  { name: 'QRIS', color: '#E8192C' },
  { name: 'BCA', color: '#006CB8' },
  { name: 'BNI', color: '#FF6600' },
  { name: 'BRI', color: '#003087' },
  { name: 'Mandiri', color: '#003087' },
  { name: 'Indomaret', color: '#E31837' },
];

function PlanCard({ plan, user, onBuy, buying }) {
  const features = Array.isArray(plan.features) ? plan.features : [];

  const formatPrice = (p) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p);
  const pricePerDay = Math.round(plan.price / plan.duration_days);

  return (
    <div className={`relative flex flex-col rounded-2xl border-2 transition-all duration-200 ${
      plan.is_popular
        ? 'border-blue-500 bg-gradient-to-b from-blue-900/30 to-gray-900 shadow-xl shadow-blue-500/10'
        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
    }`}>
      {plan.is_popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
            <Star size={10} /> PALING POPULER
          </span>
        </div>
      )}
      {plan.badge && !plan.is_popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-orange-600 text-white text-xs font-bold px-4 py-1 rounded-full">{plan.badge}</span>
        </div>
      )}

      <div className="p-6 flex-1">
        <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
        {plan.description && <p className="text-gray-400 text-sm mb-4">{plan.description}</p>}

        <div className="mb-4">
          <div className="flex items-end gap-1">
            <span className="text-2xl sm:text-4xl font-black text-white break-all">{formatPrice(plan.price)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-400 text-sm flex items-center gap-1"><Clock size={13} /> {plan.duration_days} hari</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500 text-sm">~{formatPrice(pricePerDay)}/hari</span>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {plan.max_accounts > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Users size={14} className="text-blue-400 flex-shrink-0" />
              Maks. {plan.max_accounts} akun Facebook
            </div>
          )}
          {plan.max_accounts === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Users size={14} className="text-blue-400 flex-shrink-0" />
              Unlimited akun Facebook
            </div>
          )}
          {plan.max_campaigns > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Megaphone size={14} className="text-purple-400 flex-shrink-0" />
              Maks. {plan.max_campaigns} kampanye aktif
            </div>
          )}
          {plan.max_campaigns === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Megaphone size={14} className="text-purple-400 flex-shrink-0" />
              Unlimited kampanye
            </div>
          )}
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <Check size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 pt-0">
        {user ? (
          <button
            onClick={() => onBuy(plan)}
            disabled={buying === plan.id}
            className={`w-full py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
              plan.is_popular
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {buying === plan.id ? <><Loader2 size={18} className="animate-spin" /> Memproses...</> : <><CreditCard size={16} /> Beli Sekarang</>}
          </button>
        ) : (
          <a href="/login" className={`w-full py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
            plan.is_popular ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}>
            Login untuk Membeli
          </a>
        )}
      </div>
    </div>
  );
}

export default function PricingPage({ user }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/plans').then(r => setPlans(r.data)).catch(() => setPlans([])).finally(() => setLoading(false));
  }, []);

  const loadSnapScript = (clientKey, isProduction) => {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-snap]');
      if (existingScript && window.snap) { resolve(); return; }
      if (existingScript) existingScript.remove();

      const script = document.createElement('script');
      script.src = isProduction
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey);
      script.setAttribute('data-snap', '1');
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleBuy = async (plan) => {
    if (!user) return navigate('/login');
    setBuying(plan.id); setError('');
    try {
      const res = await api.post('/payments/create', { plan_id: plan.id });
      const data = res.data;

      // Manual payment flow
      if (data.method === 'manual') {
        navigate('/payment/manual', { state: data });
        setBuying(null);
        return;
      }

      // Midtrans flow
      const { snap_token, client_key, is_production, order_id } = data;
      await loadSnapScript(client_key, is_production);
      window.snap.pay(snap_token, {
        onSuccess: () => { setBuying(null); window.location.href = `/payment/finish?order_id=${order_id}`; },
        onPending: () => { setBuying(null); navigate(`/payment/pending?order_id=${order_id}`); },
        onError: () => { setError('Pembayaran gagal. Silakan coba lagi.'); setBuying(null); },
        onClose: () => setBuying(null),
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal memproses pembayaran.');
      setBuying(null);
    }
  };

  return (
    <div className="space-y-10">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-sm px-4 py-1.5 rounded-full mb-4">
          <Zap size={14} /> Harga Terjangkau, Fitur Lengkap
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Pilih Paket Langganan</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">Akses semua fitur otomasi Facebook. Bayar sekali, aktif sesuai paket pilihan Anda.</p>
      </div>

      {error && (
        <div className="max-w-md mx-auto bg-red-900/30 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm text-center">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16">
          <Crown size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Belum ada paket tersedia. Hubungi administrator.</p>
        </div>
      ) : (
        <div className={`grid gap-6 max-w-5xl mx-auto ${
          plans.length === 1 ? 'grid-cols-1 max-w-sm' :
          plans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' :
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          {plans.map(plan => (
            <PlanCard key={plan.id} plan={plan} user={user} onBuy={handleBuy} buying={buying} />
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className="card text-center">
          <p className="text-gray-400 text-sm mb-4 flex items-center justify-center gap-2"><Shield size={14} className="text-green-400" /> Pembayaran aman & terenkripsi melalui Midtrans</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PAYMENT_ICONS.map(pm => (
              <span key={pm.name} className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ borderColor: pm.color + '44' }}>
                {pm.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
