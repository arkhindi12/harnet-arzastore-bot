import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, UserPlus, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';

export default function RegisterPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '', confirm: '', referral_code: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setForm(p => ({ ...p, referral_code: ref.toUpperCase() }));
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Password tidak cocok');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/register', { username: form.username, password: form.password, referral_code: form.referral_code || undefined });
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mendaftar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Facebook size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">ArzaBot</h1>
          <p className="text-gray-400 mt-2">Buat akun baru</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="Buat username unik"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Minimal 6 karakter"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Konfirmasi Password</label>
              <input
                className="input"
                type="password"
                placeholder="Ulangi password"
                value={form.confirm}
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Kode Referral (Opsional)</label>
              <input
                className="input font-mono uppercase"
                type="text"
                placeholder="Masukkan kode referral jika ada"
                value={form.referral_code}
                onChange={e => setForm(p => ({ ...p, referral_code: e.target.value.toUpperCase() }))}
                maxLength={8}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              <UserPlus size={18} />
              {loading ? 'Memproses...' : 'Daftar'}
            </button>
          </form>
          <p className="text-center text-gray-400 text-sm mt-4">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
