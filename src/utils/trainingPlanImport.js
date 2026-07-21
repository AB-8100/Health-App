// Parses a user-uploaded .xlsx training plan into the shape the app stores
// for an event training plan: { meta, phases, sessions }.
//
// Rather than depending on a full XLSX library (the popular ones ship with
// unpatched prototype-pollution/ReDoS advisories and we're parsing files
// straight from a <input type="file">), this reads the handful of OOXML
// parts we actually need — workbook.xml, the rels, sharedStrings.xml and
// the matching worksheet XML — with JSZip + the browser's built-in
// DOMParser, and locates whichever sheet has a header row matching the
// expected training-plan columns.
import JSZip from 'jszip';

const REQUIRED_HEADERS = ['date', 'wk', 'phase', 'discipline'];
const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

// Excel "Done" cells come through as either a real boolean (checkbox-style
// cell) or free text ("TRUE"/"FALSE", "Yes"/"No", "1"/"0", "x"/""). A plain
// `Boolean(str.trim())` treats any non-empty string as true — including the
// literal word "FALSE" — so explicitly recognise the falsy tokens instead.
const FALSY_DONE_TOKENS = new Set(['', 'false', 'no', 'n', '0']);
function parseDoneCell(raw) {
  if (typeof raw === 'boolean') return raw;
  return !FALSY_DONE_TOKENS.has(String(raw ?? '').trim().toLowerCase());
}

const PHASE_COLORS = { Foundation: '#15803D', Build: '#0369A1', Peak: '#9333EA', Taper: '#DC2626' };
const PHASE_COLOR_FALLBACK = ['#15803D', '#0369A1', '#9333EA', '#DC2626', '#D97706', '#0D9488'];

export function colorForPhase(label, index) {
  return PHASE_COLORS[label] || PHASE_COLOR_FALLBACK[index % PHASE_COLOR_FALLBACK.length];
}

const DISCIPLINE_TYPE_MAP = {
  swim: 'swim', run: 'run', bike: 'bike', cycle: 'bike', cycling: 'bike',
  rest: 'rest', conditioning: 'conditioning', strength: 'conditioning',
  gym: 'gym', brick: 'brick', race: 'race', yoga: 'yoga', walk: 'walk',
};

function disciplineToType(discipline) {
  const key = String(discipline ?? '').trim().toLowerCase();
  return DISCIPLINE_TYPE_MAP[key] || 'other';
}

// ── zip / xml plumbing ──────────────────────────────────────────────────────

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Malformed XML in workbook part');
  }
  return doc;
}

async function readXml(zip, path) {
  const entry = zip.file(path);
  if (!entry) throw new Error(`Missing part: ${path}`);
  return parseXml(await entry.async('text'));
}

function resolvePath(basePath, target) {
  if (target.startsWith('/')) return target.slice(1);
  return `${basePath}${target}`.replace(/\/\.\//g, '/');
}

async function resolveWorkbookPath(zip) {
  try {
    const rootRels = await readXml(zip, '_rels/.rels');
    const rel = Array.from(rootRels.getElementsByTagName('Relationship'))
      .find(r => /officeDocument\/2006\/relationships\/officeDocument$/.test(r.getAttribute('Type') || ''));
    if (rel) return resolvePath('', rel.getAttribute('Target'));
  } catch { /* fall through to default */ }
  return 'xl/workbook.xml';
}

function parseWorkbookSheets(doc) {
  return Array.from(doc.getElementsByTagNameNS(SS_NS, 'sheet')).map(el => ({
    name: el.getAttribute('name'),
    rId: el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
      || el.getAttribute('r:id'),
  }));
}

function parseRels(doc) {
  const map = {};
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    map[rel.getAttribute('Id')] = { target: rel.getAttribute('Target'), type: rel.getAttribute('Type') };
  }
  return map;
}

function parseSharedStrings(doc) {
  return Array.from(doc.getElementsByTagNameNS(SS_NS, 'si')).map(si => {
    const parts = Array.from(si.getElementsByTagNameNS(SS_NS, 't'));
    return parts.map(t => t.textContent).join('');
  });
}

// Splits a cell ref like "F23" into { col: 5, row: 23 } (0-indexed column).
function splitCellRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  const [, colStr, rowStr] = m;
  let col = 0;
  for (let i = 0; i < colStr.length; i++) col = col * 26 + (colStr.charCodeAt(i) - 64);
  return { col: col - 1, row: Number(rowStr) };
}

function cellValue(cellEl, sharedStrings) {
  const type = cellEl.getAttribute('t');
  if (type === 'inlineStr') {
    const t = cellEl.getElementsByTagNameNS(SS_NS, 't')[0];
    return t ? t.textContent : '';
  }
  const v = cellEl.getElementsByTagNameNS(SS_NS, 'v')[0];
  const raw = v ? v.textContent : '';
  if (type === 's') return sharedStrings[Number(raw)] ?? '';
  if (type === 'b') return raw === '1';
  return raw; // numeric or plain string ("str" formula results)
}

// Reads every row of a worksheet into an array of { col: value } maps,
// keyed by 0-indexed column, preserving blank cells as absent keys.
function readSheetRows(doc, sharedStrings) {
  const rows = [];
  for (const rowEl of Array.from(doc.getElementsByTagNameNS(SS_NS, 'row'))) {
    const rowNum = Number(rowEl.getAttribute('r'));
    const cells = {};
    for (const cellEl of Array.from(rowEl.getElementsByTagNameNS(SS_NS, 'c'))) {
      const ref = cellEl.getAttribute('r');
      const pos = ref ? splitCellRef(ref) : null;
      if (!pos) continue;
      cells[pos.col] = cellValue(cellEl, sharedStrings);
    }
    rows[rowNum] = cells;
  }
  return rows;
}

function matchHeader(headerRow) {
  if (!headerRow) return null;
  const byName = {};
  Object.entries(headerRow).forEach(([col, label]) => {
    const key = String(label ?? '').trim().toLowerCase();
    if (key) byName[key] = Number(col);
  });
  if (!REQUIRED_HEADERS.every(h => h in byName)) return null;
  return {
    date: byName['date'],
    day: byName['day'],
    wk: byName['wk'],
    phase: byName['phase'],
    discipline: byName['discipline'],
    duration: byName['distance/duration'],
    sessionType: byName['session type'],
    flag: byName['flag'],
    done: byName['done'],
  };
}

// Excel/Sheets date serials count days since 1899-12-30 (the de-facto epoch
// once you correct for the spreadsheet 1900 leap-year bug). Date cells are
// usually stored this way, but a cell explicitly typed `t="d"` (ISO 8601
// date) carries a plain "YYYY-MM-DD" string in <v> instead of a serial —
// without handling that too, every dated row in such a file would be
// silently dropped (Number("2026-01-05") is NaN) and the import would fail
// with "nothing to import" despite a well-formed date column.
function excelSerialToDateKey(serial) {
  if (typeof serial === 'string' && /^\d{4}-\d{2}-\d{2}/.test(serial.trim())) {
    return serial.trim().slice(0, 10);
  }
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  const utcMs = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(utcMs).toISOString().slice(0, 10);
}

// ── public API ───────────────────────────────────────────────────────────────

export async function parseTrainingPlanWorkbook(file) {
  let zip, workbookPath, basePath, sheets;
  try {
    const buffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
    workbookPath = await resolveWorkbookPath(zip);
    basePath = workbookPath.includes('/') ? workbookPath.slice(0, workbookPath.lastIndexOf('/') + 1) : '';
    sheets = parseWorkbookSheets(await readXml(zip, workbookPath));
  } catch {
    throw new Error("That doesn't look like a valid .xlsx file.");
  }
  if (!sheets.length) throw new Error('No sheets found in this workbook.');

  const relsPath = `${basePath}_rels/${workbookPath.slice(basePath.length)}.rels`;
  let relMap = {};
  try { relMap = parseRels(await readXml(zip, relsPath)); } catch { /* no rels — unusual but keep going */ }

  const sharedStringsRel = Object.values(relMap)
    .find(r => /relationships\/sharedStrings$/.test(r.type || ''));
  const sharedStrings = sharedStringsRel
    ? parseSharedStrings(await readXml(zip, resolvePath(basePath, sharedStringsRel.target)))
    : [];

  let matched = null;
  for (const sheet of sheets) {
    const rel = relMap[sheet.rId];
    if (!rel) continue;
    const path = resolvePath(basePath, rel.target);
    const entry = zip.file(path);
    if (!entry) continue;
    const doc = parseXml(await entry.async('text'));
    const rows = readSheetRows(doc, sharedStrings);
    // The header row isn't always the sheet's first non-blank row — real
    // exports commonly lead with a title ("Ironman UK Build") or metadata
    // ("Athlete: ...") row, sometimes followed by a blank spacer row. Only
    // checking the first non-blank row meant any such file was rejected
    // outright as "not a training plan" even though a valid header existed
    // a few rows down, so scan every row in the sheet for one instead.
    for (const row of rows) {
      const colMap = matchHeader(row);
      if (colMap) { matched = { rows, colMap, sheetName: sheet.name }; break; }
    }
    if (matched) break;
  }

  if (!matched) {
    throw new Error(
      "Couldn't find a training plan table in that file. Expected a sheet with columns " +
      "Date, Wk, Phase, Discipline (and ideally Distance/Duration, Session Type, Flag)."
    );
  }

  return buildPlanFromRows(matched.rows, matched.colMap, file.name);
}

function buildPlanFromRows(rows, colMap, sourceFileName) {
  const sessions = {};
  const phaseOrder = [];
  const phaseRange = {};
  let minDate = null, maxDate = null, maxWeek = 0;
  let raceRow = null;

  for (const row of rows) {
    if (!row) continue;
    const dateRaw = row[colMap.date];
    if (dateRaw === undefined || dateRaw === '') continue;
    const dateKey = excelSerialToDateKey(dateRaw);
    if (!dateKey) continue;

    const week = colMap.wk !== undefined ? Number(row[colMap.wk]) : null;
    const phase = colMap.phase !== undefined ? String(row[colMap.phase] ?? '').trim() : '';
    const discipline = colMap.discipline !== undefined ? String(row[colMap.discipline] ?? '').trim() : '';
    const durationRaw = colMap.duration !== undefined ? String(row[colMap.duration] ?? '').trim() : '';
    const sessionType = colMap.sessionType !== undefined ? String(row[colMap.sessionType] ?? '').trim() : '';
    const flag = colMap.flag !== undefined ? String(row[colMap.flag] ?? '').trim() : '';
    const done = colMap.done !== undefined ? parseDoneCell(row[colMap.done]) : false;

    if (!minDate || dateKey < minDate) minDate = dateKey;
    if (!maxDate || dateKey > maxDate) maxDate = dateKey;
    if (Number.isFinite(week) && week > maxWeek) maxWeek = week;

    if (phase && Number.isFinite(week)) {
      if (!phaseRange[phase]) { phaseRange[phase] = { min: week, max: week }; phaseOrder.push(phase); }
      else {
        phaseRange[phase].min = Math.min(phaseRange[phase].min, week);
        phaseRange[phase].max = Math.max(phaseRange[phase].max, week);
      }
    }

    if (!discipline) continue; // date row with no session defined (e.g. not yet planned)

    const duration = durationRaw && durationRaw !== '-' ? durationRaw : '';
    const type = disciplineToType(discipline);
    const session = { type, label: discipline, sessionType, duration, flag, done, week, phase };
    if (type === 'race') raceRow = session;

    if (!sessions[dateKey]) sessions[dateKey] = [];
    sessions[dateKey].push(session);
  }

  if (!minDate) throw new Error('No dated rows found — nothing to import.');

  const phases = phaseOrder.map((label, i) => ({
    label,
    weeks: [phaseRange[label].min, phaseRange[label].max],
    color: colorForPhase(label, i),
  }));

  const meta = {
    startDate: minDate,
    eventDate: maxDate,
    totalWeeks: maxWeek || phases.reduce((max, p) => Math.max(max, p.weeks[1]), 0) || 1,
    eventDistances: raceRow ? (raceRow.sessionType || raceRow.duration || '') : '',
  };

  return { meta, phases, sessions, sourceFileName, importedAt: new Date().toISOString() };
}
