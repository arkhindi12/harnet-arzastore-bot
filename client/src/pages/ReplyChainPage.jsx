import { useEffect, useState } from 'react';
import { MessageCircle, Plus, Play, Square, Trash2, RefreshCw } from 'lucide-react';
import api from '../utils/api';

export default function ReplyChainPage() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', post_urls: '', keywords: '', reply_template: '', reply_account_id: '', check_interval: 30, max_replies_per_run: 10,
    reply_mode: 'personal', page_id: '', page_name: ''
  });

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([api.get('/auto-replies'), api.get('/accounts')]);
      setItems(r1.data || []);
      setAccounts((r2.data || []).filter(a => a.status === 'active'));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.post_urls || !form.keywords || !form.reply_template || !form.reply_account_id) return alert('Lengkapi field wajib');
    await api.post('/auto-replies', {
      ...form,
      post_urls: form.post_urls.split('\n').map(x=>x.trim()).filter(Boolean),
      keywords: form.keywords.split(',').map(x=>x.trim()).filter(Boolean),
      check_interval: Number(form.check_interval) || 30,
      max_replies_per_run: Number(form.max_replies_per_run) || 10,
    });
    setShow(false); setForm({ name:'', post_urls:'', keywords:'', reply_template:'', reply_account_id:'', check_interval:30, max_replies_per_run:10, reply_mode:'personal', page_id:'', page_name:'' });
    load();
  };

  const start = async id => { await api.post(`/auto-replies/${id}/start`); load(); };
  const stop = async id => { await api.post(`/auto-replies/${id}/stop`); load(); };
  const del = async id => { if (!confirm('Hapus auto-reply ini?')) return; await api.delete(`/auto-replies/${id}`); load(); };

  return <div className="max-w-5xl mx-auto p-6">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><MessageCircle className="text-blue-400"/> Reply Chain / Auto Reply</h1>
        <p className="text-gray-400 text-sm mt-1">Pantau post, cari keyword komentar, lalu balas otomatis.</p>
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary flex items-center gap-2" onClick={load}><RefreshCw size={16}/>Refresh</button>
        <button className="btn-primary flex items-center gap-2" onClick={()=>setShow(true)}><Plus size={16}/>Buat Auto Reply</button>
      </div>
    </div>

    {show && <div className="mb-6 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
      <h2 className="font-bold text-white mb-4">Buat Auto Reply</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="label">Nama *</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div><label className="label">Akun Reply *</label><select className="input" value={form.reply_account_id} onChange={e=>setForm({...form,reply_account_id:e.target.value})}><option value="">Pilih akun</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="md:col-span-2"><label className="label">URL Post target * (1 per baris)</label><textarea className="input font-mono text-xs" rows={3} value={form.post_urls} onChange={e=>setForm({...form,post_urls:e.target.value})}/></div>
        <div><label className="label">Keyword komentar * (pisah koma)</label><input className="input" placeholder="minat, harga, ready" value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})}/></div>
        <div><label className="label">Mode</label><select className="input" value={form.reply_mode} onChange={e=>setForm({...form,reply_mode:e.target.value})}><option value="personal">Personal</option><option value="as_page">Sebagai Page</option></select></div>
        {form.reply_mode==='as_page' && <><div><label className="label">Page ID</label><input className="input" value={form.page_id} onChange={e=>setForm({...form,page_id:e.target.value})}/></div><div><label className="label">Page Name</label><input className="input" value={form.page_name} onChange={e=>setForm({...form,page_name:e.target.value})}/></div></>}
        <div><label className="label">Interval cek (menit)</label><input type="number" className="input" value={form.check_interval} onChange={e=>setForm({...form,check_interval:e.target.value})}/></div>
        <div><label className="label">Max reply/run</label><input type="number" className="input" value={form.max_replies_per_run} onChange={e=>setForm({...form,max_replies_per_run:e.target.value})}/></div>
        <div className="md:col-span-2"><label className="label">Template Balasan *</label><textarea className="input" rows={3} placeholder="Halo kak, masih ready. Cek inbox ya." value={form.reply_template} onChange={e=>setForm({...form,reply_template:e.target.value})}/></div>
      </div>
      <div className="flex gap-2 mt-4"><button className="btn-primary" onClick={save}>Simpan</button><button className="btn-secondary" onClick={()=>setShow(false)}>Batal</button></div>
    </div>}

    {loading ? <div className="text-gray-400">Loading...</div> : items.length===0 ? <div className="text-center py-16 text-gray-500 border border-dashed border-gray-700 rounded-2xl">Belum ada auto-reply.</div> : <div className="space-y-3">
      {items.map(it => <div key={it.id} className="p-4 bg-gray-900/70 border border-gray-700 rounded-2xl flex items-center justify-between">
        <div><div className="text-white font-semibold">{it.name}</div><div className="text-xs text-gray-400">Akun: {it.reply_account_name || '-'} • interval {it.check_interval}m • max {it.max_replies_per_run}/run • {it.status || 'idle'}</div></div>
        <div className="flex gap-2">{it.status==='running' ? <button className="btn-secondary" onClick={()=>stop(it.id)}><Square size={15}/></button> : <button className="btn-primary" onClick={()=>start(it.id)}><Play size={15}/></button>}<button className="btn-secondary text-red-300" onClick={()=>del(it.id)}><Trash2 size={15}/></button></div>
      </div>)}
    </div>}
  </div>;
}
