import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, Copy, QrCode, CreditCard, Clock, AlertTriangle, ArrowLeft, Upload, Image } from 'lucide-react';
import api from '../utils/api';

function UploadProofBox({ orderId }) {
  const [uploading, setUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('order_id', orderId);
        const res = await api.post('/payments/upload-proof', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setProofUrl(res.data.proof_url);
        setSuccess(true);
      } catch (err) { alert(err.response?.data?.error || 'Gagal upload'); }
      finally { setUploading(false); }
    };
    input.click();
  };

  return (
    <div className="card border-blue-800/30 bg-blue-900/10">
      <h3 className="text-blue-300 font-semibold text-sm flex items-center gap-2 mb-3"><Upload size={14} /> Upload Bukti Transfer</h3>
      {success && proofUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-700/40">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-emerald-300 text-xs">Bukti berhasil diupload! Admin akan mengkonfirmasi.</span>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 inline-block"><img src={proofUrl} alt="Bukti" className="max-h-40 rounded object-contain" /></div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-400 text-xs">Sudah transfer? Upload bukti agar admin bisa langsung konfirmasi.</p>
          <button onClick={handleUpload} disabled={uploading} className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 transition-colors">
            <Image size={16} /> {uploading ? 'Mengupload...' : 'Pilih Foto Bukti Transfer'}
          </button>
          <p className="text-gray-600 text-[10px]">JPG, PNG, WEBP. Max 5MB.</p>
        </div>
      )}
    </div>
  );
}

export default function ManualPaymentPage() {
  const location = useLocation();
  const data = location.state;
  const [copied, setCopied] = useState('');

  const copyText = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!data || !data.order_id) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertTriangle size={48} className="text-yellow-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Data pembayaran tidak ditemukan</h1>
        <p className="text-gray-400 mb-6">Halaman ini hanya bisa diakses setelah checkout dari halaman harga.</p>
        <Link to="/pricing" className="btn-primary inline-flex items-center gap-2"><ArrowLeft size={16} /> Kembali ke Harga</Link>
      </div>
    );
  }

  const formatRp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center">
          <CreditCard size={28} className="text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Instruksi Pembayaran</h1>
        <p className="text-gray-400 text-sm">Selesaikan pembayaran untuk mengaktifkan akun kamu</p>
      </div>

      {/* Order Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2"><Clock size={16} className="text-yellow-400" /> Menunggu Pembayaran</h2>
          <span className="text-xs bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 px-2.5 py-1 rounded-full font-semibold">PENDING</span>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">Order ID</span><span className="text-white font-mono text-xs">{data.order_id}</span></div>
          {data.plan_name && <div className="flex justify-between"><span className="text-gray-400">Paket</span><span className="text-white">{data.plan_name}</span></div>}
          <div className="flex justify-between"><span className="text-gray-400">Harga Paket</span><span className="text-white">{formatRp(data.plan_price)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Kode Unik</span><span className="text-yellow-300 font-bold">+{data.unique_code}</span></div>
          <div className="flex justify-between border-t border-gray-700 pt-3 mt-3">
            <span className="text-white font-semibold text-base">TOTAL TRANSFER</span>
            <span className="text-2xl font-extrabold text-emerald-400">{formatRp(data.total_amount)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => copyText(String(data.total_amount), 'amount')} className="btn-secondary text-xs flex items-center gap-1.5">
            <Copy size={12} /> {copied === 'amount' ? 'Tersalin!' : 'Copy Nominal'}
          </button>
        </div>
      </div>

      {/* QRIS */}
      {data.qris_image_url && (
        <div className="card text-center">
          <h2 className="text-white font-semibold flex items-center justify-center gap-2 mb-4"><QrCode size={16} className="text-blue-400" /> Bayar via QRIS</h2>
          <div className="bg-white rounded-xl p-4 inline-block mx-auto">
            <img src={data.qris_image_url} alt="QRIS" className="max-w-[240px] mx-auto" />
          </div>
          {data.qris_name && <p className="text-gray-400 text-sm mt-3">{data.qris_name}</p>}
          <p className="text-gray-500 text-xs mt-2">Scan dengan GoPay, OVO, DANA, ShopeePay, atau aplikasi bank yang support QRIS</p>
        </div>
      )}

      {/* Bank Transfer */}
      {data.banks && data.banks.length > 0 && (
        <div className="card">
          <h2 className="text-white font-semibold flex items-center gap-2 mb-4"><CreditCard size={16} className="text-purple-400" /> Transfer Bank</h2>
          <div className="space-y-3">
            {data.banks.map((bank, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-semibold text-sm">{bank.bank}</p>
                  <p className="text-blue-400 font-mono text-xl font-bold tracking-wider mt-1">{bank.number}</p>
                  <p className="text-gray-400 text-xs mt-1">a.n. {bank.name}</p>
                </div>
                <button
                  onClick={() => copyText(bank.number, `bank-${i}`)}
                  className="btn-secondary text-xs flex-shrink-0 flex items-center gap-1.5"
                >
                  <Copy size={12} /> {copied === `bank-${i}` ? 'Tersalin!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Important Notes */}
      <div className="card border-yellow-700/40 bg-yellow-900/10">
        <h3 className="text-yellow-300 font-semibold text-sm flex items-center gap-2 mb-3"><AlertTriangle size={14} /> Penting!</h3>
        <ul className="space-y-2 text-sm text-yellow-200/80">
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            Transfer dengan nominal <strong className="text-yellow-100">TEPAT {formatRp(data.total_amount)}</strong> (termasuk kode unik {data.unique_code})
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            Jangan transfer kurang atau lebih dari nominal di atas
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            Akun akan aktif otomatis setelah pembayaran dikonfirmasi admin (maks 1x24 jam)
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            Simpan bukti transfer untuk konfirmasi jika diperlukan
          </li>
        </ul>
      </div>

      {/* Login info jika dari landing (ada password) */}
      {data.password && (
        <div className="card border-emerald-700/40 bg-emerald-900/10">
          <h3 className="text-emerald-300 font-semibold text-sm flex items-center gap-2 mb-3"><CheckCircle size={14} /> Data Login Kamu</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-400">Username:</span><span className="text-white font-mono">{data.username}</span>
            <span className="text-gray-400">Password:</span>
            <span className="text-white font-mono font-bold flex items-center gap-2">
              {data.password}
              <button onClick={() => copyText(data.password, 'pwd')} className="text-gray-500 hover:text-white"><Copy size={12} /></button>
              {copied === 'pwd' && <span className="text-emerald-400 text-xs">Tersalin!</span>}
            </span>
          </div>
          <p className="text-yellow-300 text-xs mt-3">⚠️ Catat password ini! Kamu bisa login sekarang di <Link to="/login" className="text-blue-400 underline">/login</Link></p>
        </div>
      )}

      {/* Upload Bukti */}
      {data.order_id && <UploadProofBox orderId={data.order_id} />}

      <div className="flex gap-3">
        <Link to="/pricing" className="btn-secondary flex-1 justify-center"><ArrowLeft size={14} /> Kembali</Link>
        <Link to="/login" className="btn-primary flex-1 justify-center">Login Sekarang</Link>
      </div>
    </div>
  );
}
