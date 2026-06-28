import { useState, useEffect } from "react";
import { Calendar, Plus, Play, Trash2, Clock, Repeat } from "lucide-react";
import api from "../utils/api";

export default function ContentCalendarPage() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState({});
  const [form, setForm] = useState({
    title: "", content: "", media_url: "", account_ids: [], target_groups: [],
    scheduled_at: "", repeat_type: "none", repeat_interval: 1, post_type: "group"
  });

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get("/content-calendar"),
        api.get("/accounts"),
        api.get("/niche-groups").catch(() => ({ data: [] }))
      ]);
      setItems(r1.data || []);
      setAccounts((r2.data || []).filter(a => a.status === "active"));
      setGroups(r3.data || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || !form.content || !form.scheduled_at || !form.account_ids.length)
      return alert("Lengkapi field wajib");
    await api.post("/content-calendar", { ...form, scheduled_at: new Date(form.scheduled_at).toISOString() });
    setShowForm(false);
    setForm({ title:"", content:"", media_url:"", account_ids:[], target_groups:[], scheduled_at:"", repeat_type:"none", repeat_interval:1, post_type:"group" });
    load();
  };

  const del = async id => { if (!confirm("Hapus jadwal ini?")) return; await api.delete("/content-calendar/" + id); load(); };
  const runNow = async id => { try { await api.post("/content-calendar/" + id + "/run-now"); alert("Selesai!"); load(); } catch(e) { alert(e.response?.data?.error || "Gagal"); } };
  const toggleAccount = id => setForm(f => ({ ...f, account_ids: f.account_ids.includes(id) ? f.account_ids.filter(x => x !== id) : [...f.account_ids, id] }));
  const toggleGroup = id => setForm(f => ({ ...f, target_groups: f.target_groups.includes(id) ? f.target_groups.filter(x => x !== id) : [...f.target_groups, id] }));
  const loadLogs = async id => { if (logs[id]) return; const r = await api.get("/content-calendar/" + id + "/logs"); setLogs(l => ({ ...l, [id]: r.data || [] })); };

  const statusClass = s => s === "scheduled" ? "bg-blue-900/40 text-blue-300" : s === "running" ? "bg-yellow-900/40 text-yellow-300" : s === "done" ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300";

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Calendar className="text-blue-400" /> Content Calendar</h1>
          <p className="text-gray-400 text-sm mt-1">Jadwalkan posting ke grup / profil secara otomatis.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}><Plus size={16} /> Buat Jadwal</button>
      </div>

      {showForm && (
        <div className="mb-6 p-5 bg-gray-900 border border-gray-700 rounded-2xl">
          <h2 className="font-bold text-white mb-4">Buat Jadwal Posting</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Judul *</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="label">Isi Post *</label><textarea className="input" rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
            <div><label className="label">Media URL (opsional)</label><input className="input" placeholder="https://..." value={form.media_url} onChange={e => setForm({ ...form, media_url: e.target.value })} /></div>
            <div><label className="label">Tipe Post</label><select className="input" value={form.post_type} onChange={e => setForm({ ...form, post_type: e.target.value })}><option value="group">Ke Grup</option><option value="profile">Ke Profil</option></select></div>
            <div className="md:col-span-2">
              <label className="label">Akun Target *</label>
              <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-lg p-2 bg-gray-800">
                {accounts.map(a => (<div key={a.id} className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer" onClick={() => toggleAccount(a.id)}><input type="checkbox" readOnly checked={form.account_ids.includes(a.id)} /><span className="text-sm">{a.name}</span></div>))}
              </div>
            </div>
            {form.post_type === "group" && (
              <div className="md:col-span-2">
                <label className="label">Grup Target (kosong = semua)</label>
                <div className="max-h-40 overflow-y-auto border border-gray-700 rounded-lg p-2 bg-gray-800">
                  {groups.slice(0, 100).map(g => (<div key={g.id} className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer" onClick={() => toggleGroup(g.id)}><input type="checkbox" readOnly checked={form.target_groups.includes(g.id)} /><span className="text-sm truncate">{g.name}</span></div>))}
                </div>
              </div>
            )}
            <div><label className="label">Tanggal & Waktu *</label><input type="datetime-local" className="input" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><label className="label">Ulangi</label><select className="input" value={form.repeat_type} onChange={e => setForm({ ...form, repeat_type: e.target.value })}><option value="none">Tidak</option><option value="hourly">Tiap Jam</option><option value="daily">Tiap Hari</option><option value="weekly">Tiap Minggu</option></select></div>
              {form.repeat_type !== "none" && <div><label className="label">Interval</label><input type="number" min="1" className="input w-20" value={form.repeat_interval} onChange={e => setForm({ ...form, repeat_interval: Number(e.target.value) })} /></div>}
            </div>
          </div>
          <div className="flex gap-2 mt-4"><button className="btn-primary" onClick={save}>Simpan</button><button className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button></div>
        </div>
      )}

      {loading ? <div className="text-gray-400">Loading...</div> : items.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border border-dashed border-gray-700 rounded-2xl">Belum ada jadwal.</div>
      ) : (
        <div className="space-y-4">
          {items.map(it => (
            <div key={it.id} className="p-4 bg-gray-900/70 border border-gray-700 rounded-2xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-white">{it.title}</h3>
                    <span className={"badge " + statusClass(it.status)}>{it.status}</span>
                    <span className="text-xs text-gray-500">{it.post_type}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{it.content.substring(0, 120)}{it.content.length > 120 ? "..." : ""}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                    <span className="flex items-center gap-1"><Clock size={12} />{new Date(it.scheduled_at).toLocaleString("id-ID")}</span>
                    {it.repeat_type !== "none" && <span className="flex items-center gap-1"><Repeat size={12} />{it.repeat_type} x{it.repeat_interval}</span>}
                    {it.run_count > 0 && <span>{it.run_count}x dijalankan</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button className="btn-secondary" title="Jalankan sekarang" onClick={() => runNow(it.id)}><Play size={14} /></button>
                  <button className="btn-secondary text-red-300" onClick={() => del(it.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              {it.error_msg && <div className="mt-2 text-xs text-red-400">Error: {it.error_msg}</div>}
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-200" onClick={() => loadLogs(it.id)}>Log eksekusi</summary>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {(logs[it.id] || []).map(log => (
                    <div key={log.id} className={"p-2 rounded " + (log.status === "success" ? "bg-green-900/20" : "bg-red-900/20")}>
                      <div className="flex justify-between text-gray-400"><span>{log.target || "profile"}</span><span>{new Date(log.created_at).toLocaleTimeString("id-ID")}</span></div>
                      <div className={log.status === "success" ? "text-green-300" : "text-red-300"}>{log.message}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
