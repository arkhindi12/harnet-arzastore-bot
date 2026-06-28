const axios = require('axios');
const db = require('../db/database');



// Migrate groq_keys → multi-provider AI keys
try { db.exec("ALTER TABLE groq_keys ADD COLUMN provider TEXT DEFAULT 'groq'"); } catch {}
try { db.exec("ALTER TABLE groq_keys ADD COLUMN model TEXT"); } catch {}
try { db.exec("ALTER TABLE groq_keys ADD COLUMN base_url TEXT"); } catch {}

// Migrate campaigns: smart AI comment
try { db.exec("ALTER TABLE campaigns ADD COLUMN ai_smart_comment INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN ai_topic TEXT"); } catch {}
try { db.exec("ALTER TABLE campaigns ADD COLUMN ai_tone TEXT DEFAULT 'natural'"); } catch {}

const PROVIDERS = {
  groq: {
    label: 'Groq',
    base_url: 'https://api.groq.com/openai/v1/chat/completions',
    default_model: 'llama-3.3-70b-versatile',
    fallback_models: ['llama-3.1-8b-instant', 'gemma2-9b-it'],
  },
  openai: {
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1/chat/completions',
    default_model: 'gpt-4o-mini',
    fallback_models: ['gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  openrouter: {
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1/chat/completions',
    default_model: 'meta-llama/llama-3.1-8b-instruct:free',
    fallback_models: ['google/gemma-2-9b-it:free', 'mistralai/mistral-7b-instruct:free'],
  },
  anthropic: {
    label: 'Anthropic Claude',
    base_url: 'https://api.anthropic.com/v1/messages',
    default_model: 'claude-3-5-haiku-20241022',
    fallback_models: ['claude-3-haiku-20240307'],
  },
  gemini: {
    label: 'Google Gemini',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/models',
    default_model: 'gemini-1.5-flash',
    fallback_models: ['gemini-1.5-flash-8b'],
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    base_url: null,
    default_model: null,
    fallback_models: [],
  },
};

function getProviderConfig(key) {
  const cfg = PROVIDERS[key.provider || 'groq'] || PROVIDERS.custom;
  return {
    ...cfg,
    base_url: key.base_url || cfg.base_url,
    default_model: key.model || cfg.default_model,
  };
}

// Resolve URL untuk endpoint 0penAI-compatible chat completions.
// Terima input apa saja: "http://host/v1", "http://host/v1/", "http://host/v1/chat/completions".
function resolve0penAIChatUrl(rawUrl) {
  if (!rawUrl) return null;
  let u = rawUrl.trim().replace(/\s+/g, '');
  if (u.endsWith('/')) u = u.slice(0, -1);
  if (/\/chat\/completions$/i.test(u)) return u;
  // Kalau user kasih path lain seperti /v1/messages, biarkan apa adanya supaya provider khusus tidak terganggu
  if (/\/(messages|completions|generate|chat)$/i.test(u)) return u;
  return `${u}/chat/completions`;
}

async function callProvider(key, messages, opts = {}) {
  const cfg = getProviderConfig(key);
  const model = opts.model || cfg.default_model;
  const provider = key.provider || 'groq';

  if (!cfg.base_url) throw new Error('Base URL kosong untuk provider custom. Isi base URL di key.');
  if (!model) throw new Error('Model belum diset untuk key ini.');

  // Anthropic format berbeda
  if (provider === 'anthropic') {
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system');
    const res = await axios.post(cfg.base_url, {
      model,
      max_tokens: opts.max_tokens || 1024,
      system: systemMsg,
      messages: userMsgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    }, {
      headers: {
        'x-api-key': key.api_key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    const text = res.data?.content?.[0]?.text?.trim();
    return { text, model };
  }

  // Gemini format berbeda
  if (provider === 'gemini') {
    const url = `${cfg.base_url}/${model}:generateContent?key=${key.api_key}`;
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const userMsgs = messages.filter(m => m.role !== 'system');
    const body = {
      contents: userMsgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: opts.temperature ?? 0.8, maxOutputTokens: opts.max_tokens || 1024 },
    };
    if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg }] };
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return { text, model };
  }

  // OpenAI-compatible (groq, openai, openrouter, custom)
  const headers = { 'Authorization': `Bearer ${key.api_key}`, 'Content-Type': 'application/json' };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:3000';
    headers['X-Title'] = 'ArzaBot';
  }
  const endpoint = resolve0penAIChatUrl(cfg.base_url);
  if (!endpoint) throw new Error('Base URL tidak valid');
  const res = await axios.post(endpoint, {
    model,
    messages,
    max_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature ?? 0.8,
  }, { headers, timeout: 30000 });
  const text = res.data?.choices?.[0]?.message?.content?.trim();
  return { text, model };
}

function getActiveKeys(userId, providerFilter = null) {
  let sql = `SELECT * FROM groq_keys
    WHERE user_id = ? AND status = 'active'
    AND (reset_at IS NULL OR reset_at < datetime('now'))`;
  const params = [userId];
  if (providerFilter) { sql += ' AND provider = ?'; params.push(providerFilter); }
  sql += ' ORDER BY last_used ASC NULLS FIRST, created_at ASC';
  return db.prepare(sql).all(...params);
}

function markKeyRateLimited(keyId) {
  db.prepare(`UPDATE groq_keys SET status='rate_limited', reset_at=datetime('now','+60 seconds'), updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(keyId);
  setTimeout(() => {
    db.prepare(`UPDATE groq_keys SET status='active', reset_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(keyId);
  }, 65000);
}

function markKeyUsed(keyId) {
  db.prepare(`UPDATE groq_keys SET last_used=CURRENT_TIMESTAMP, requests_today=requests_today+1, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(keyId);
}

async function generateText(userId, messages, opts = {}) {
  const keys = getActiveKeys(userId, opts.provider || null);
  if (!keys.length) throw new Error('Tidak ada AI key aktif. Tambahkan key di Pengaturan > AI Keys.');

  let lastError = null;
  for (const key of keys) {
    const cfg = getProviderConfig(key);
    const modelChain = opts.model ? [opts.model] : [cfg.default_model, ...(cfg.fallback_models || [])].filter(Boolean);

    for (const model of modelChain) {
      try {
        const result = await callProvider(key, messages, { ...opts, model });
        if (!result.text) throw new Error('Respons kosong dari API');
        markKeyUsed(key.id);
        return { text: result.text, model: result.model || model, provider: key.provider || 'groq', keyLabel: key.label || `Key ${key.id.slice(-4)}` };
      } catch (err) {
        const status = err.response?.status;
        if (status === 429 || status === 413) {
          markKeyRateLimited(key.id);
          lastError = `Key "${key.label || key.id.slice(-4)}" rate limited (${status})`;
          break; // pindah ke key berikutnya
        }
        if (status === 401 || status === 403) {
          db.prepare(`UPDATE groq_keys SET status='invalid', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(key.id);
          lastError = `Key "${key.label || key.id.slice(-4)}" tidak valid (${status})`;
          break;
        }
        // Model error: coba model fallback berikutnya
        if (status === 404 || status === 400) {
          lastError = `Model ${model} gagal: ${err.response?.data?.error?.message || err.message}`;
          continue;
        }
        lastError = err.response?.data?.error?.message || err.message;
      }
    }
  }
  throw new Error(lastError || 'Semua AI key gagal. Coba lagi atau tambahkan key baru.');
}

async function validateKey(apiKey, provider = 'groq', model = null, baseUrl = null) {
  const fakeKey = { api_key: apiKey, provider, model, base_url: baseUrl };
  try {
    const result = await callProvider(fakeKey, [{ role: 'user', content: 'Hi' }], { max_tokens: 5 });
    return { valid: !!result.text, model: result.model };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    let detail = data?.error?.message || data?.message || err.message;
    if (status === 404) {
      detail = `Endpoint tidak ditemukan (404). Cek Base URL — biasanya diisi tanpa /chat/completions, contoh "https://api.example.com/v1". URL akhir yang dipanggil: ${err.config?.url || '?'}`;
    } else if (status === 401 || status === 403) {
      detail = `API key ditolak (${status}). ${detail}`;
    } else if (status) {
      detail = `HTTP ${status}: ${detail}`;
    }
    return { valid: false, error: detail };
  }
}

function listProviders() {
  return Object.entries(PROVIDERS).map(([k, v]) => ({
    id: k,
    label: v.label,
    base_url: v.base_url,
    default_model: v.default_model,
    fallback_models: v.fallback_models,
  }));
}

// Fetch daftar model dari API provider
async function fetchModels(provider, apiKey, baseUrl = null) {
  if (!apiKey) throw new Error('API key kosong');
  const cfg = PROVIDERS[provider] || PROVIDERS.custom;

  try {
    if (provider === 'gemini') {
      // Gemini: GET /v1beta/models?key=API_KEY
      const url = `${baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models?key=${apiKey}`;
      const res = await axios.get(url, { timeout: 15000 });
      const models = (res.data?.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => ({
          id: m.name?.replace(/^models\//, '') || m.displayName,
          name: m.displayName || m.name,
          description: m.description || '',
        }));
      return models;
    }

    if (provider === 'anthr0pic') {
      // CL4ude: GET /v1/models dengan x-api-key
      const res = await axios.get('https://api.anthr0pic.com/v1/models', {
        headers: { 'x-api-key': apiKey, 'anthr0pic-version': '2023-06-01' },
        timeout: 15000,
      });
      return (res.data?.data || []).map(m => ({
        id: m.id,
        name: m.display_name || m.id,
        description: '',
      }));
    }

    // OpenAI-compatible: groq, openai, openrouter, custom
    // GET /models dengan Bearer token
    let modelsUrl;
    if (baseUrl) {
      // Replace /chat/completions dengan /models kalau ada
      modelsUrl = baseUrl.replace(/\/chat\/completions$/, '') + '/models';
    } else if (provider === 'groq') {
      modelsUrl = 'https://api.groq.com/openai/v1/models';
    } else if (provider === 'openai') {
      modelsUrl = 'https://api.openai.com/v1/models';
    } else if (provider === 'openrouter') {
      modelsUrl = 'https://openrouter.ai/api/v1/models';
    } else {
      throw new Error('Base URL diperlukan untuk provider custom');
    }

    const res = await axios.get(modelsUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 15000,
    });
    const data = res.data?.data || res.data?.models || [];
    return data.map(m => ({
      id: m.id || m.name,
      name: m.name || m.id,
      description: m.description || (m.context_length ? `Context: ${m.context_length} tokens` : ''),
      pricing: m.pricing || null,
    })).filter(m => m.id);
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error?.message || err.response?.data?.message || err.message;
    throw new Error(`Gagal fetch models${status ? ` (${status})` : ''}: ${detail}`);
  }
}

module.exports = { generateText, validateKey, listProviders, fetchModels, PROVIDERS };
