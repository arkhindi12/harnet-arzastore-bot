import { useState, useEffect } from 'react';

let cache = null;
let fetching = false;
const listeners = new Set();

function notify(data) {
  cache = data;
  listeners.forEach(fn => fn(data));
}

export function refreshBranding() {
  fetching = true;
  fetch('/api/branding')
    .then(r => r.json())
    .then(data => {
      notify({
        brand_name: data.brand_name || 'ArzaBot',
        brand_logo_url: data.brand_logo_url || '',
        brand_icon_url: data.brand_icon_url || '',
        brand_primary_color: data.brand_primary_color || '#2563eb',
        brand_tagline: data.brand_tagline || '',
        brand_logo_size: data.brand_logo_size || '100',
        favicon_url: data.favicon_url || '/favicon.svg',
      });
    })
    .catch(() => {})
    .finally(() => { fetching = false; });
}

export default function useBranding() {
  const [branding, setBranding] = useState(cache || {
    brand_name: 'ArzaBot',
    brand_logo_url: '',
    brand_icon_url: '',
    brand_primary_color: '#2563eb',
    brand_tagline: '',
    brand_logo_size: '100',
    favicon_url: '/favicon.svg',
  });

  useEffect(() => {
    listeners.add(setBranding);
    if (!cache && !fetching) {
      refreshBranding();
    }
    return () => listeners.delete(setBranding);
  }, []);

  return branding;
}
