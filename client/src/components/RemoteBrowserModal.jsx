import { useEffect, useRef, useState } from 'react';
import { X, Monitor, RefreshCw, ArrowLeft, ArrowRight, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../utils/api';

export default function RemoteBrowserModal({ account, onClose }) {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting|streaming|saved|error
  const [error, setError] = useState('');
  const [urlBar, setUrlBar] = useState('https://www.facebook.com');
  const [cookiesSaved, setCookiesSaved] = useState(false);
  const W = 1280, H = 720;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await api.post('/remote-browser/start', { account_id: account.id });
        if (cancelled) return;
        const token = localStorage.getItem('token');
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${proto}://${window.location.host}/ws/remote-browser/${account.id}?token=${token}`;
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;
        ws.onopen = () => setStatus('streaming');
        ws.onclose = () => { if (!cancelled) setStatus(s => s === 'saved' ? s : 'error'); };
        ws.onerror = () => setError('Koneksi WebSocket gagal');
        ws.onmessage = (e) => {
          if (typeof e.data === 'string') {
            try {
              const msg = JSON.parse(e.data);
              if (msg.type === 'cookies_saved') {
                setCookiesSaved(true);
                setStatus('saved');
              }
            } catch {}
            return;
          }
          // binary = JPEG frame
          const blob = new Blob([e.data], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0, W, H);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        };
      } catch (e) {
        if (!cancelled) { setStatus('error'); setError(e.response?.data?.error || e.message); }
      }
    }
    init();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      api.post('/remote-browser/close', { account_id: account.id }).catch(() => {});
    };
  }, [account.id]);

  // Relay canvas input → backend via REST (simpler than WS)
  const sendInput = (event) => api.post('/remote-browser/input', { account_id: account.id, event }).catch(() => {});

  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onCanvasClick = (e) => { const p = getCanvasCoords(e); sendInput({ type: 'click', ...p }); };
  const onCanvasDblClick = (e) => { const p = getCanvasCoords(e); sendInput({ type: 'dblclick', ...p }); };
  const onCanvasMove = (e) => { const p = getCanvasCoords(e); sendInput({ type: 'move', ...p }); };
  const onCanvasScroll = (e) => { const p = getCanvasCoords(e); sendInput({ type: 'scroll', ...p, deltaX: e.deltaX, deltaY: e.deltaY }); };
  const onCanvasKey = (e) => { e.preventDefault(); sendInput({ type: 'keydown', key: e.key }); };

  const navigate = (url) => { const u = url.startsWith('http') ? url : 'https://' + url; setUrlBar(u); sendInput({ type: 'navigate', url: u }); };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl flex flex-col w-full max-w-5xl max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 gap-3">
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-blue-400" />
            <span className="text-white font-semibold text-sm">Browser Akun: {account.name}</span>
            {status === 'saved' && <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle size={12} /> Login tersimpan!</span>}
            {status === 'starting' && <span className="text-yellow-400 text-xs">Memulai browser…</span>}
            {status === 'error' && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={12} /> {error}</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Nav bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-950">
          <button onClick={() => sendInput({ type: 'back' })} className="text-gray-400 hover:text-white"><ArrowLeft size={15} /></button>
          <button onClick={() => sendInput({ type: 'forward' })} className="text-gray-400 hover:text-white"><ArrowRight size={15} /></button>
          <button onClick={() => sendInput({ type: 'reload' })} className="text-gray-400 hover:text-white"><RotateCcw size={15} /></button>
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white outline-none focus:border-blue-500"
            value={urlBar}
            onChange={e => setUrlBar(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate(urlBar)}
          />
          <button onClick={() => navigate(urlBar)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg">Go</button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-black relative" style={{ minHeight: 400 }}>
          {status === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Memulai browser + proxy…</p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={W} height={H}
            className="max-w-full max-h-full cursor-pointer outline-none"
            tabIndex={0}
            onClick={onCanvasClick}
            onDoubleClick={onCanvasDblClick}
            onMouseMove={onCanvasMove}
            onWheel={onCanvasScroll}
            onKeyDown={onCanvasKey}
          />
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500 flex items-center gap-4">
          <span>🔒 Browser berjalan di server pakai proxy akun ini</span>
          <span>•</span>
          <span>Sistem otomatis simpan cookies saat <strong className="text-emerald-400">c_user</strong> terdeteksi</span>
          {cookiesSaved && <span className="text-emerald-400 font-medium ml-auto">✅ Cookies berhasil disimpan!</span>}
        </div>
      </div>
    </div>
  );
}
