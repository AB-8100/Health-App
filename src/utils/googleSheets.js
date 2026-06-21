const SHEET_TITLE = 'Forma Health Data';
const SHEET_ID_KEY = 'forma_sheet_id';
const TOKEN_KEY = 'forma_gtoken';

let _accessToken = null;

// ── token storage ─────────────────────────────────────────────────────────────

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

export function getSheetUrl() {
  const id = getSheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
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

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function sheetsGet(sheetId, range) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${_accessToken}` } }
  );
  if (!res.ok) throw new Error(`Sheets GET ${res.status}`);
  return res.json();
}

async function sheetsBatchUpdate(sheetId, data) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${_accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    }
  );
  if (!res.ok) throw new Error(`Sheets batchUpdate ${res.status}`);
}

// ── spreadsheet creation ──────────────────────────────────────────────────────

async function createSpreadsheet() {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${_accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE },
      sheets: [
        { properties: { title: 'Profile',      index: 0 } },
        { properties: { title: 'Sessions',     index: 1 } },
        { properties: { title: 'Food Log',     index: 2 } },
        { properties: { title: 'Custom Foods', index: 3 } },
        { properties: { title: 'Settings',     index: 4 } },
        { properties: { title: 'Backup',       index: 5 } },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Create spreadsheet ${res.status}`);
  return (await res.json()).spreadsheetId;
}

// ── data formatters ───────────────────────────────────────────────────────────

function fmtProfile(profile = {}, plan = {}) {
  return [
    ['Field', 'Value'],
    ['Name',              profile.name       || ''],
    ['Age',               profile.age        || ''],
    ['Sex',               profile.sex        || ''],
    ['Height',            profile.height     ? `${profile.height} cm`  : ''],
    ['Weight',            profile.weight     ? `${profile.weight} kg`  : ''],
    ['Goal',              profile.goal       || ''],
    ['Training days/wk',  plan.splitDays     || 3],
    ['Tracks cycle',      profile.tracksCycle ? 'Yes' : 'No'],
  ];
}

function fmtSettings(s = {}) {
  return [
    ['Setting', 'Value'],
    ['Daily calories (base)',  s.dailyCaloriesBase || 1500],
    ['Gym day calorie boost',  s.gymDayBoost       || 250],
    ['Weight unit',            s.weightUnit        || 'kg'],
    ['Height unit',            s.heightUnit        || 'cm'],
  ];
}

function fmtSessions(sessions = []) {
  const header = ['Date', 'Workout', 'Duration (min)', 'Exercises', 'Session ID'];
  if (!sessions.length) return [header];
  return [
    header,
    ...sessions.map(s => [
      s.date ? new Date(s.date).toLocaleDateString() : '',
      s.workout || '',
      s.elapsed ? Math.round(s.elapsed / 60) : '',
      s.queue   ? s.queue.length : '',
      s.id      || '',
    ]),
  ];
}

function fmtFoodLog(foodLog = {}) {
  const header = ['Date', 'Food', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)'];
  const rows = [];
  for (const [date, day] of Object.entries(foodLog)) {
    for (const e of (day.entries || [])) {
      rows.push([
        date,
        e.name  || e.label || '',
        e.calories ?? e.kcal ?? '',
        e.protein  ?? '',
        e.carbs    ?? '',
        e.fat      ?? '',
      ]);
    }
  }
  return rows.length ? [header, ...rows] : [header];
}

function fmtCustomFoods(foods = []) {
  const header = ['Name', 'Calories (per 100g)', 'Protein (g)', 'Carbs (g)', 'Fat (g)'];
  if (!foods.length) return [header];
  return [
    header,
    ...foods.map(f => [
      f.name     || '',
      f.calories ?? f.kcal ?? '',
      f.protein  ?? '',
      f.carbs    ?? '',
      f.fat      ?? '',
    ]),
  ];
}

// ── public API ────────────────────────────────────────────────────────────────

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
    // Try new Backup tab first, fall back to legacy Data tab
    for (const range of ['Backup!A1', 'Data!A1']) {
      const data = await sheetsGet(sheetId, range);
      const raw = data.values?.[0]?.[0];
      if (raw) return JSON.parse(raw);
    }
    return null;
  } catch(e) {
    console.warn('Sheets load:', e.message);
    return null;
  }
}

export async function saveToSheets(appData) {
  const sheetId = getSheetId();
  if (!sheetId || !_accessToken) return;
  const { profile, plan, userSettings, completedSessions, foodLog, customFoods } = appData;
  try {
    await sheetsBatchUpdate(sheetId, [
      { range: 'Profile!A1',      values: fmtProfile(profile, plan)          },
      { range: 'Sessions!A1',     values: fmtSessions(completedSessions)      },
      { range: 'Food Log!A1',     values: fmtFoodLog(foodLog)                 },
      { range: 'Custom Foods!A1', values: fmtCustomFoods(customFoods)         },
      { range: 'Settings!A1',     values: fmtSettings(userSettings)           },
      { range: 'Backup!A1',       values: [[JSON.stringify(appData)]]          },
    ]);
  } catch(e) {
    console.warn('Sheets save:', e.message);
  }
}

let _sheetsTimer = null;
export function scheduleSaveToSheets(data) {
  clearTimeout(_sheetsTimer);
  _sheetsTimer = setTimeout(() => saveToSheets(data), 2500);
}
