const LS_DATA_KEY = 'forma_data';

export function loadFromCache() {
  try { return JSON.parse(localStorage.getItem(LS_DATA_KEY)); } catch { return null; }
}

export function saveToCache(data) {
  try { localStorage.setItem(LS_DATA_KEY, JSON.stringify(data)); } catch(e) { console.warn('Forma: save failed', e); }
}

// Debounced local save
let _saveTimer = null;
export function scheduleSaveLocal(data) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveToCache(data), 1000);
}
