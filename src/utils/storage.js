import { scheduleSaveToSheets } from './googleSheets';

const LS_DATA_KEY = 'forma_data';
const LS_ACCOUNTS_KEY = 'forma_accounts';
const LS_SESSION_KEY = 'forma_session';

export function loadFromCache(userId) {
  const key = userId ? `forma_data_${userId}` : LS_DATA_KEY;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function saveToCache(data, userId) {
  const key = userId ? `forma_data_${userId}` : LS_DATA_KEY;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.warn('Forma: save failed', e); }
}

// Debounced local save
let _saveTimer = null;
export function scheduleSaveLocal(data, userId) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveToCache(data, userId), 1000);
}

// Save to localStorage + Google Sheets (if connected)
export function scheduleSaveAll(data, sheetsConnected, userId) {
  scheduleSaveLocal(data, userId);
  if (sheetsConnected) scheduleSaveToSheets(data);
}

// Account management
export function loadAccounts() {
  try { return JSON.parse(localStorage.getItem(LS_ACCOUNTS_KEY)) || []; } catch { return []; }
}

export function saveAccounts(accounts) {
  try { localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(accounts)); } catch(e) { console.warn('Forma: account save failed', e); }
}

export function loadSession() {
  try { return localStorage.getItem(LS_SESSION_KEY); } catch { return null; }
}

export function saveSession(userId) {
  try { localStorage.setItem(LS_SESSION_KEY, userId); } catch(e) {}
}

export function clearSession() {
  try { localStorage.removeItem(LS_SESSION_KEY); } catch(e) {}
}
