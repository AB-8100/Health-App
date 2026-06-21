const SHEET_TITLE = 'Forma Health Data';
const SHEET_ID_KEY = 'forma_sheet_id';
const TOKEN_KEY = 'forma_gtoken';

let _accessToken = null;

// ── token storage ────────────────────────────────────────────────────────────

function readStoredToken() {
  try {
    const { token, expiresAt } = JSON.parse(localStorage.getItem(TOKEN_KEY));
    return Date.now() < expiresAt ? token : null;
  } catch { return null; }
}

function writeToken(token) {
  _accessToken = token;
  localStorage.setItem(TOKEN_KEY, JSON.stringify({
    token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  }));
}

// ── public status helpers ─────────────────────────────────────────────────────

export function getSheetId() {
  return localStorage.getItem(SHEET_ID_KEY) || null;
}

export function getSheetsStatus() {
  if (!getSheetId()) return 'disconnected';
  if (!readStoredToken()) return 'needs-reconnect';
  return 'connected';
}

export function initFromCache() {
  const token = readStoredToken();
  if (token) _accessToken = token;
  return Boolean(token && getSheetId());
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

function requestToken() {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not set — add it to your .env file'));
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not ready yet — try again in a moment'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ].join(' '),
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        writeToken(resp.access_token);
        resolve(resp.access_token);
      },
      error_callback: (err) => reject(new Error(err.message || 'Auth failed')),
    });
    client.requestAccessToken();
  });
}

// ── Sheets HTTP helpers ───────────────────────────────────────────────────────

async function sheetsGet(sheetId, range) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${_accessToken}` } }
  );
  if (!res.ok) throw new Error(`Sheets GET ${res.status}`);
  return res.json();
}

async function sheetsPut(sheetId, range, values) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${_accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    }
  );
  if (!res.ok) throw new Error(`Sheets PUT ${res.status}`);
}

async function createSpreadsheet() {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${_accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: 'Data' } }],
    }),
  });
  if (!res.ok) throw new Error(`Create sheet ${res.status}`);
  return (await res.json()).spreadsheetId;
}

// ── public API ─────────────────────────────────────────────────────────────────

export async function connectGoogle() {
  await requestToken();

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name='${SHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    )}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${_accessToken}` } }
  );
  const { files } = await searchRes.json();
  let sheetId = files?.[0]?.id;
  if (!sheetId) sheetId = await createSpreadsheet();
  localStorage.setItem(SHEET_ID_KEY, sheetId);
  return sheetId;
}

export function disconnectGoogle() {
  try { window.google?.accounts?.oauth2?.revoke(_accessToken, () => {}); } catch {}
  _accessToken = null;
  localStorage.removeItem(SHEET_ID_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export async function reconnectGoogle() {
  await requestToken();
}

export async function loadFromSheets() {
  const sheetId = getSheetId();
  if (!sheetId || !_accessToken) return null;
  try {
    const data = await sheetsGet(sheetId, 'Data!A1');
    const raw = data.values?.[0]?.[0];
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    console.warn('Sheets load:', e.message);
    return null;
  }
}

export async function saveToSheets(data) {
  const sheetId = getSheetId();
  if (!sheetId || !_accessToken) return;
  try {
    await sheetsPut(sheetId, 'Data!A1', [[JSON.stringify(data)]]);
  } catch(e) {
    console.warn('Sheets save:', e.message);
  }
}

let _sheetsTimer = null;
export function scheduleSaveToSheets(data) {
  clearTimeout(_sheetsTimer);
  _sheetsTimer = setTimeout(() => saveToSheets(data), 2500);
}
