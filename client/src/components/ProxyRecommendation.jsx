import React, { useState, useEffect } from 'react';
import { Shield, ExternalLink, ChevronDown, ChevronUp, Star, AlertTriangle } from 'lucide-react';

export default function ProxyRecommendation() {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/proxy-recommendation')
      .then(r => r.json())
      .then(d => { if (d?.providers?.length) setData(d); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="card border-blue-800/30 bg-gradient-to-br from-blue-950/20 to-purple-950/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{data.title || 'Rekomendasi Proxy'}</h3>
            {data.subtitle && <p className="text-gray-400 text-xs mt-1 leading-relaxed">{data.subtitle}</p>}
          </div>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="btn-secondary text-xs flex-shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Tutup' : 'Lihat'}
        </button>
      </div>

      {data.cta && (
        <div className="mt-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-200/80 text-xs leading-relaxed">{data.cta}</p>
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left py-2 font-medium">Provider</th>
                  <th className="text-left py-2 font-medium">Harga</th>
                  <th className="text-left py-2 font-medium hidden sm:table-cell">Kelebihan</th>
                  <th className="text-right py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.providers.map((p, i) => (
                  <tr key={i} className={`border-b border-gray-800/50 ${p.recommended ? 'bg-blue-900/10' : ''}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{p.name}</span>
                        {p.recommended && <Star size={12} className="text-yellow-400 fill-yellow-400" />}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-emerald-400 font-semibold whitespace-nowrap">{p.price}</td>
                    <td className="py-2.5 pr-3 text-gray-400 text-xs hidden sm:table-cell">{p.pros}</td>
                    <td className="py-2.5 text-right">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium">
                        Beli <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-gray-300">Format proxy yang didukung:</p>
            <p className="font-mono text-blue-300">http://user:pass@host:port</p>
            <p className="font-mono text-blue-300">socks5://user:pass@host:port</p>
            <p className="mt-2">Tips: Beli paket <strong className="text-white">rotating residential</strong> dengan target <strong className="text-white">Indonesia (ID)</strong>. Isi di kolom Proxy saat edit akun.</p>
          </div>
        </div>
      )}
    </div>
  );
}
