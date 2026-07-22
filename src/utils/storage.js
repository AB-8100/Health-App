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
let _pendingLocalSave = null; // { data, userId } — mirrors whatever the debounce timer would write

export function scheduleSaveLocal(data, userId) {
  _pendingLocalSave = { data, userId };
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveToCache(data, userId);
    _pendingLocalSave = null;
  }, 1000);
}

// Writes the still-pending debounced local-cache save immediately, if one is
// queued. On mobile, the OS can suspend/reload the page's JS at any time
// once it's backgrounded — there's no reliable "about to unload" moment to
// wait for — so the 1s debounce leaves a window where a just-made edit (e.g.
// deleting a session) exists only in React state and hasn't reached
// localStorage yet. bootstrapUser's cache-vs-Supabase reconciliation trusts
// whichever has the newer `savedAt`, so if the page comes back with neither
// the debounced local write nor the fire-and-forget Supabase write landed,
// the edit is silently lost and the old data reappears. Flushing on
// visibilitychange (registered below) closes that window.
export function flushPendingLocalSave() {
  if (!_pendingLocalSave) return;
  clearTimeout(_saveTimer);
  saveToCache(_pendingLocalSave.data, _pendingLocalSave.userId);
  _pendingLocalSave = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingLocalSave();
  });
  window.addEventListener('pagehide', flushPendingLocalSave);
}

export function scheduleSaveAll(data, sheetsConnected, userId) {
  scheduleSaveLocal(data, userId);
  if (userId) {
    saveUserData(userId, data).catch(e => console.warn('Forma: Supabase save failed', e));
  }
  if (sheetsConnected) scheduleSaveToSheets(data);
}
