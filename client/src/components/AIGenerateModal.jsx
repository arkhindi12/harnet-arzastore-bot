import { useState } from 'react';
import api from '../utils/api';

const TYPES = [
  { value: 'comment', label: '💬 Komentar Promosi', placeholder: 'Contoh: Sepatu sneakers murah berkualitas' },
  { value: 'description', label: '📝 Deskripsi Produk', placeholder: 'Contoh: Tas kulit wanita branded second' },
  { value: 'title', label: '🏷️ Judul Iklan', placeholder: 'Contoh: Laptop gaming second core i7' },
  { value: 'reply', label: '↩️ Template Balasan', placeholder: 'Contoh: Toko baju online, balas pertanyaan harga' },
  { value: 'group_post', label: '📢 Konten Posting Grup', placeholder: 'Contoh: Jual HP iPhone 13 second mulus' },
  { value: 'spintax', label: '🔀 Template Spintax', placeholder: 'Contoh: Produk skincare anti aging' },
  { value: 'keyword', label: '🔑 Kata Kunci Monitor', placeholder: 'Contoh: sepatu nike, jual sneakers' },
  { value: 'custom', label: '✏️ Custom / Bebas', placeholder: 'Deskripsikan apa yang ingin dibuat...' },
];

export default function AIGenerateModal({ onInsert, onClose, defaultType = 'comment' }) {
  const [type, setType] = useState(defaultType);
  const [context, setContext] = useState('');
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(5);
  const [keyInfo, setKeyInfo] = useState('');

  const selectedType = TYPES.find(t => t.value === type) || TYPES[0];

  const generate = async () => {
    if (!context.trim()) { setError('Topik/context wajib diisi'); return; }
    setLoading(true); setError(''); setResult(''); setKeyInfo('');
    try {
      const endpoint = batchMode ? '/ai/generate/batch' : '/ai/generate';
      const body = batchMode
        ? { type, context, count: batchCount }
        : { type, context, extra_instruction: extra };
      const res = await api.post(endpoint, body);
      setResult(res.data.text);
      setKeyInfo(`Model: ${res.data.model} • Key: ${res.data.keyLabel}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Gagal generate teks');
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = () => {
    if (onInsert && result) { onInsert(result); onClose(); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div className="card" style={{ width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:'1.1rem', display:'flex', alignItems:'center', gap:8 }}>
            <span>✨</span> AI Generate Teks
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize:'1.3rem', lineHeight:1, padding:'0 6px' }}>×</button>
        </div>

        <div>
          <label className="label">Jenis Konten</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  padding:'6px 10px', borderRadius:8, border:'1px solid',
                  borderColor: type === t.value ? '#a855f7' : '#374151',
                  background: type === t.value ? 'rgba(168,85,247,0.15)' : 'transparent',
                  color: type === t.value ? '#c084fc' : '#9ca3af',
                  cursor:'pointer', fontSize:'0.8rem', textAlign:'left',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Topik / Produk / Context <span style={{ color:'#ef4444' }}>*</span></label>
          <input
            className="input" value={context}
            onChange={e => setContext(e.target.value)}
            placeholder={selectedType.placeholder}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && generate()}
          />
        </div>

        {!batchMode && (
          <div>
            <label className="label">Instruksi Tambahan (opsional)</label>
            <input className="input" value={extra} onChange={e => setExtra(e.target.value)}
              placeholder="Contoh: gunakan bahasa santai, sertakan nomor WA 0812xxx" />
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.875rem', color:'#9ca3af' }}>
            <input type="checkbox" checked={batchMode} onChange={e => setBatchMode(e.target.checked)} />
            Mode Batch
          </label>
          {batchMode && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:'0.8rem', color:'#9ca3af' }}>Jumlah variasi:</span>
              <select className="input" value={batchCount} onChange={e => setBatchCount(Number(e.target.value))}
                style={{ width:70, padding:'4px 8px' }}>
                {[3,5,7,10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', color:'#f87171', fontSize:'0.875rem' }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={generate} disabled={loading} className="btn-primary" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {loading ? (
            <><span style={{ display:'inline-block', width:16, height:16, border:'2px solid #fff3', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 1s linear infinite' }} />Generating...</>
          ) : '✨ Generate'}
        </button>

        {result && (
          <div>
            <label className="label" style={{ display:'flex', justifyContent:'space-between' }}>
              <span>Hasil</span>
              {keyInfo && <span style={{ fontSize:'0.7rem', color:'#6b7280' }}>{keyInfo}</span>}
            </label>
            <textarea
              className="input" rows={8} value={result}
              onChange={e => setResult(e.target.value)}
              style={{ resize:'vertical', fontFamily:'monospace', fontSize:'0.85rem' }}
            />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              {onInsert && (
                <button onClick={handleInsert} className="btn-primary" style={{ flex:1 }}>
                  ✅ Gunakan Teks Ini
                </button>
              )}
              <button onClick={() => navigator.clipboard.writeText(result)} className="btn-ghost" style={{ flex:1 }}>
                📋 Salin
              </button>
              <button onClick={generate} disabled={loading} className="btn-ghost">
                🔄 Buat Lagi
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
