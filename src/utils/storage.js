import { scheduleSaveToSheets } from './googleSheets';
import { saveUserData } from './supabase';

// ── Local cache (fast reads while Supabase loads) ─────────────────────────────

const cacheKey = (userId) => userId ? `forma_data_${userId}` : 'forma_data';

export function loadFromCache(userId) {
  try { return JSON.parse(localStorage.getItem(cacheKey(userId))); } catch { return null; }
}

export function saveToCache(data, userId) {
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(data)); } catch(e) { console.warn('Forma: local cache save failed', e); }
}

// ── Debounced saves ───────────────────────────────────────────────────────────

let _saveTimer = null;

export function scheduleSaveLocal(data, userId) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveToCache(data, userId), 1000);
}

export function scheduleSaveAll(data, sheetsConnected, userId) {
  scheduleSaveLocal(data, userId);
  if (userId) {
    saveUserData(userId, data).catch(e => console.warn('Forma: Supabase save failed', e));
  }
  if (sheetsConnected) scheduleSaveToSheets(data);
}
