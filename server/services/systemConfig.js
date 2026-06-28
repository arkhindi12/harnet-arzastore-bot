// Helper: baca system config dari DB, fallback ke env, fallback ke default.
const db = require('../db/database');

const cache = new Map();
let cacheTime = 0;
const CACHE_TTL = 10000; // 10 detik cache

function loadAll() {
  if (Date.now() - cacheTime < CACHE_TTL && cache.size > 0) return;
  const rows = db.prepare('SELECT key, value FROM system_config').all();
  cache.clear();
  for (const r of rows) cache.set(r.key, r.value);
  cacheTime = Date.now();
}

function get(key, envKey, defaultValue) {
  loadAll();
  // Priority: DB > ENV > default
  const dbVal = cache.get(key);
  if (dbVal !== undefined && dbVal !== null && dbVal !== '') return dbVal;
  if (envKey && process.env[envKey] !== undefined) return process.env[envKey];
  return String(defaultValue);
}

function getInt(key, envKey, defaultValue) {
  return parseInt(get(key, envKey, defaultValue), 10) || defaultValue;
}

function getBool(key, envKey, defaultValue) {
  const v = get(key, envKey, defaultValue ? '1' : '0');
  return v !== '0' && v !== 'false';
}

function invalidateCache() {
  cacheTime = 0;
  cache.clear();
}

module.exports = { get, getInt, getBool, invalidateCache };
