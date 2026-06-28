import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, Trash2, Edit3, Save, X, Power, MessageCircle, Phone, Clock, Eye, RefreshCw, Send, CheckCircle } from 'lucide-react';
import api from '../utils/api';

function BotModal({ editBot, onClose, onSaved }) {
  const isEdit = !!editBot;
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    type: editBot?.type || 'page',
    account_id: editBot?.account_id || '',
    page_id: editBot?.page_id || '',
    page_name: editBot?.page_name || '',
    page_access_token: editBot?.page_access_token || '',
    persona_name: editBot?.persona_name || 'CS',
    persona_style: editBot?.persona_style || 'ramah dan profesional',
    product_info: editBot?.product_info || '',
    wa_number: editBot?.wa_number || '',
    max_rounds: editBot?.max_rounds || 5,
    greeting_message: editBot?.greeting_message || '',
    closing_message: editBot?.closing_message || '',
    business_hours_start: editBot?.business_hours_start ?? 8,
    business_hours_end: editBot?.business_hours_end ?? 22,
    auto_reply_delay_sec: editBot?.auto_reply_delay_sec || 30,
    poll_interval_sec: editBot?.poll_interval_sec || 180,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/accounts').then(r => setAccounts(r.data.filter(a => a.status === 'active'))).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (isEdit) await api.put(`/conversation/bots/${editBot.id}`, form);
      else await api.post('/conversation/bots', form);
      onSaved();
    } catch (err) { setError(err.response?.data?.error || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold">{isEdit ? 'Edit Bot' : 'Buat Bot Conversation'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

          {/* Type selector */}
          {!isEdit && (
            <div>
              <label className="label">Tipe Bot</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm(p => ({ ...p, type: 'page' }))} className={`p-3 rounded-xl border text-left ${form.type === 'page' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800/50'}`}>
                  <p className="text-white text-sm font-semibold">📄 Facebook Page</p>
                  <p className="text-gray-400 text-xs mt-1">Via Graph API (real-time, ringan)</p>
                </button>
                <button type="button" onClick={() => setForm(p => ({ ...p, type: 'personal' }))} className={`p-3 rounded-xl border text-left ${form.type === 'personal' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800/50'}`}>
                  <p className="text-white text-sm font-semibold">👤 Akun Personal</p>
                  <p className="text-gray-400 text-xs mt-1">Via browser polling (semi real-time)</p>
                </button>
              </div>
            </div>
          )}

          {form.type === 'page' ? (
            <>
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-3 text-xs text-blue-300 space-y-1">
                <p className="font-semibold">Cara mendapatkan Page Access Token:</p>
                <p>1. Buka <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="underline">Graph API Explorer</a></p>
                <p>2. Pilih App → pilih Page → Generate Token</p>
                <p>3. Permission: <code>pages_messaging</code>, <code>pages_manage_metadata</code></p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="label">Page ID *</label><input className="input" required value={form.page_id} onChange={e => setForm(p => ({ ...p, page_id: e.target.value }))} placeholder="123456789012345" /></div>
                <div><label className="label">Nama Page</label><input className="input" value={form.page_name} onChange={e => setForm(p => ({ ...p, page_name: e.target.value }))} placeholder="Toko Rina Fashion" /></div>
              </div>
              <div><label className="label">Page Access Token *</label><input className="input font-mono text-xs" required type="password" value={form.page_access_token} onChange={e => setForm(p => ({ ...p, page_access_token: e.target.value }))} placeholder="EAAxxxxxxx..." /></div>
            </>
          ) : (
            <>
              <div className="bg-purple-900/20 border border-purple-800/30 rounded-xl p-3 text-xs text-purple-300 space-y-1">
                <p className="font-semibold">Mode Personal Inbox:</p>
                <p>• Bot akan polling inbox Facebook tiap {form.poll_interval_sec || 180} detik</p>
                <p>• Baca pesan baru → AI generate reply → kirim otomatis</p>
                <p>• Pakai browser (lewat antrian, tidak berat)</p>
              </div>
              <div>
                <label className="label">Pilih Akun Facebook *</label>
                <select className="input" required value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}>
                  <option value="">Pilih akun...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Interval Polling (detik)</label>
                <input className="input" type="number" min={60} max={600} value={form.poll_interval_sec} onChange={e => setForm(p => ({ ...p, poll_interval_sec: e.target.value }))} />
                <p className="text-gray-500 text-xs mt-1">Seberapa sering cek inbox. Min 60 detik. Makin kecil = makin responsif tapi makin berat.</p>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nama Persona Bot</label>
              <input className="input" value={form.persona_name} onChange={e => setForm(p => ({ ...p, persona_name: e.target.value }))} placeholder="Rina" />
            </div>
            <div>
              <label className="label">Gaya Bicara</label>
              <input className="input" value={form.persona_style} onChange={e => setForm(p => ({ ...p, persona_style: e.target.value }))} placeholder="ramah, pakai emoji, soft-selling" />
            </div>
          </div>

          <div>
            <label className="label">Info Produk / Bisnis</label>
            <textarea className="input min-h-[100px]" value={form.product_info} onChange={e => setForm(p => ({ ...p, product_info: e.target.value }))} placeholder="Jual dress wanita 89rb-150rb. Bahan katun premium. Ready size S-XL. COD area Bandung. Free ongkir Shopee." />
            <p className="text-gray-500 text-xs mt-1">AI akan pakai info ini untuk menjawab pertanyaan customer tentang produk/harga.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Nomor WhatsApp (untuk closing)</label>
              <input className="input" value={form.wa_number} onChange={e => setForm(p => ({ ...p, wa_number: e.target.value }))} placeholder="0812-xxxx-xxxx" />
            </div>
            <div>
              <label className="label">Max Ronde Percakapan</label>
              <input className="input" type="number" min={2} max={20} value={form.max_rounds} onChange={e => setForm(p => ({ ...p, max_rounds: e.target.value }))} />
              <p className="text-gray-500 text-xs mt-1">Setelah N ronde, bot arahkan ke WA.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Jam Aktif Mulai</label>
              <input className="input" type="number" min={0} max={23} value={form.business_hours_start} onChange={e => setForm(p => ({ ...p, business_hours_start: e.target.value }))} />
            </div>
            <div>
              <label className="label">Jam Aktif Akhir</label>
              <input className="input" type="number" min={0} max={23} value={form.business_hours_end} onChange={e => setForm(p => ({ ...p, business_hours_end: e.target.value }))} />
            </div>
            <div>
              <label className="label">Delay Reply (detik)</label>
              <input className="input" type="number" min={5} max={120} value={form.auto_reply_delay_sec} onChange={e => setForm(p => ({ ...p, auto_reply_delay_sec: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center"><Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Bot'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConversationsModal({ bot, onClose }) {
  const [convs, setConvs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/conversation/bots/${bot.id}/conversations?limit=30`).then(r => setConvs(r.data)).finally(() => setLoading(false));
  }, [bot.id]);

  const viewMessages = async (conv) => {
    setSelected(conv);
    const r = await api.get(`/conversation/conversations/${conv.id}/messages`);
    setMessages(r.data.messages || []);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2"><MessageCircle size={16} /> Percakapan: {bot.page_name || bot.page_id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-hidden flex">
          {/* List */}
          <div className="w-1/3 border-r border-gray-800 overflow-y-auto">
            {loading ? <div className="p-4 text-center"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div> :
              convs.length === 0 ? <p className="p-4 text-gray-500 text-xs text-center">Belum ada percakapan</p> :
              convs.map(c => (
                <button key={c.id} onClick={() => viewMessages(c)} className={`w-full text-left px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-800/50 ${selected?.id === c.id ? 'bg-blue-900/20' : ''}`}>
                  <p className="text-white text-xs font-medium truncate">{c.sender_name || `User ${c.sender_id?.slice(-6)}`}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.status === 'active' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-gray-800 text-gray-500'}`}>{c.status}</span>
                    <span className="text-gray-500 text-[10px]">{c.round_count} ronde</span>
                  </div>
                </button>
              ))
            }
          </div>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!selected ? <p className="text-gray-500 text-sm text-center py-10">Pilih percakapan di kiri</p> :
              messages.length === 0 ? <p className="text-gray-500 text-sm text-center py-10">Tidak ada pesan</p> :
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'bot' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.role === 'bot' ? 'bg-blue-600/20 border border-blue-700/40 text-blue-100' : 'bg-gray-800 border border-gray-700 text-gray-200'}`}>
                    <p>{m.text}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{new Date(m.time).toLocaleTimeString('id-ID')}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConversationPage() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBot, setEditBot] = useState(null);
  const [convsBot, setConvsBot] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/conversation/bots').then(r => setBots(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id) => {
    await api.post(`/conversation/bots/${id}/toggle`);
    load();
  };
  const handleDelete = async (id) => {
    if (!confirm('Hapus bot ini? Semua log percakapan juga akan dihapus.')) return;
    await api.delete(`/conversation/bots/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Bot size={22} className="text-purple-400" /> Conversation Service</h1>
          <p className="text-gray-400 mt-1 text-sm">AI auto-reply inbox Facebook Page. Setiap page jadi sales person otomatis 24 jam.</p>
        </div>
        <button onClick={() => { setEditBot(null); setShowModal(true); }} className="btn-primary"><Plus size={16} /> Buat Bot</button>
      </div>

      <div className="card border-blue-800/30 bg-blue-900/10">
        <p className="text-blue-300 text-sm font-semibold mb-2">Cara Setup:</p>
        <ol className="text-blue-200/80 text-xs space-y-1 list-decimal list-inside">
          <li>Buat Facebook App di <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline">developers.facebook.com</a></li>
          <li>Tambahkan produk "Messenger" → subscribe ke page kamu</li>
          <li>Set Webhook URL: <code className="text-emerald-300 bg-gray-800 px-1.5 py-0.5 rounded">{window.location.origin}/api/conversation/webhook</code></li>
          <li>Verify Token: <code className="text-emerald-300 bg-gray-800 px-1.5 py-0.5 rounded">arzabot_webhook_verify_2026</code></li>
          <li>Subscribe field: <code className="text-emerald-300">messages</code></li>
          <li>Generate Page Access Token dengan permission <code>pages_messaging</code></li>
          <li>Buat bot di bawah ini dengan token tersebut</li>
        </ol>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : bots.length === 0 ? (
        <div className="card text-center py-10">
          <Bot size={40} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Belum ada bot. Buat bot pertama untuk mulai auto-reply inbox page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map(bot => (
            <div key={bot.id} className="card">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm">{bot.type === 'personal' ? (bot.account_name || 'Personal') : (bot.page_name || `Page ${bot.page_id}`)}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${bot.type === 'personal' ? 'bg-purple-500/15 text-purple-300' : 'bg-blue-500/15 text-blue-300'}`}>
                      {bot.type === 'personal' ? '👤 Personal' : '📄 Page'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${bot.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700/40 text-gray-400'}`}>
                      {bot.is_active ? '● Aktif' : '○ Off'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">Persona: {bot.persona_name} · {bot.persona_style}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px] mb-3">
                {bot.wa_number && <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 flex items-center gap-1"><Phone size={9} /> {bot.wa_number}</span>}
                <span className="px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-300"><Clock size={9} className="inline mr-1" />{bot.business_hours_start}-{bot.business_hours_end}h</span>
                <span className="px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-300">Max {bot.max_rounds} ronde</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300"><Send size={9} className="inline mr-1" />{bot.total_messages_sent} pesan</span>
                {bot.type === 'personal' && <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">Poll: {bot.poll_interval_sec}s</span>}
                {bot.type === 'personal' && bot.last_poll && <span className="px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-400">Last: {new Date(bot.last_poll).toLocaleTimeString('id-ID')}</span>}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => handleToggle(bot.id)} className="btn-secondary text-xs"><Power size={12} /> {bot.is_active ? 'Matikan' : 'Aktifkan'}</button>
                <button onClick={() => setConvsBot(bot)} className="btn-secondary text-xs"><Eye size={12} /> Percakapan</button>
                <button onClick={() => { setEditBot(bot); setShowModal(true); }} className="btn-secondary text-xs"><Edit3 size={12} /></button>
                <button onClick={() => handleDelete(bot.id)} className="btn-danger text-xs"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <BotModal editBot={editBot} onClose={() => { setShowModal(false); setEditBot(null); }} onSaved={() => { setShowModal(false); setEditBot(null); load(); }} />}
      {convsBot && <ConversationsModal bot={convsBot} onClose={() => setConvsBot(null)} />}
    </div>
  );
}
