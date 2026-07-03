import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseTrainingPlanWorkbook, colorForPhase } from './trainingPlanImport';

// Builds a minimal-but-real .xlsx (OOXML) package in memory so these tests
// exercise the actual parser (JSZip + DOMParser over workbook.xml / rels /
// worksheet XML), not a mocked-out shortcut. Cells are written as
// `t="inlineStr"` so the test doesn't also need a sharedStrings.xml part.
const SS_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function colLetter(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(rowNum, colIdx, value) {
  const ref = `${colLetter(colIdx)}${rowNum}`;
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  const escaped = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<c r="${ref}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
}

function worksheetXmlFor(rows) {
  const rowsXml = rows.map((row, ri) => {
    const cells = row.map((v, ci) => cellXml(ri + 1, ci, v)).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="${SS_NS}"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

// sheets: array of { name, rows } — rows is an array of arrays of cell values
function buildXlsx(sheets) {
  const sheetEls = sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="${SS_NS}" xmlns:r="${REL_NS}">` +
    `<sheets>${sheetEls}</sheets>` +
    `</workbook>`;

  const relEls = sheets.map((s, i) =>
    `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join('');
  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEls}</Relationships>`;

  const zip = new JSZip();
  zip.file('xl/workbook.xml', workbookXml);
  zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml);
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, worksheetXmlFor(s.rows)));
  return zip;
}

// A stand-in for the browser File object — parseTrainingPlanWorkbook only
// ever calls `.arrayBuffer()` and reads `.name`. Accepts either a plain rows
// array (single "Plan" sheet) or an explicit array of { name, rows } sheets.
async function fakeFile(rowsOrSheets, name = 'plan.xlsx') {
  const sheets = Array.isArray(rowsOrSheets[0])
    ? [{ name: 'Plan', rows: rowsOrSheets }]
    : rowsOrSheets;
  const zip = buildXlsx(sheets);
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return { name, arrayBuffer: async () => buffer };
}

const HEADER = ['Date', 'Wk', 'Phase', 'Discipline', 'Distance/Duration', 'Session Type', 'Flag', 'Done'];

// Excel/Sheets date serial for a given UTC calendar date, matching the
// parser's own epoch (see excelSerialToDateKey) so tests aren't tied to a
// magic number.
function excelSerial(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

describe('parseTrainingPlanWorkbook', () => {
  it('parses a well-formed plan into { meta, phases, sessions }', async () => {
    const rows = [
      HEADER,
      [excelSerial(2026, 1, 5), 1, 'Foundation', 'Swim', '30 min', 'Endurance', '', ''],
      [excelSerial(2026, 1, 6), 1, 'Foundation', 'Run', '45 min', 'Tempo', '', 'TRUE'],
      [excelSerial(2026, 1, 7), 1, 'Foundation', 'Rest', '', '', '', ''],
      [excelSerial(2026, 2, 2), 5, 'Build', 'Bike', '60 min', 'Intervals', 'Key session', ''],
      [excelSerial(2026, 5, 4), 18, 'Taper', 'Race', 'Half Ironman', '', '', ''],
    ];
    const file = await fakeFile(rows, 'my-plan.xlsx');
    const parsed = await parseTrainingPlanWorkbook(file);

    expect(parsed.sourceFileName).toBe('my-plan.xlsx');
    expect(parsed.meta.startDate).toBe('2026-01-05');
    expect(parsed.meta.eventDate).toBe('2026-05-04');
    expect(parsed.meta.totalWeeks).toBe(18);
    expect(parsed.meta.eventDistances).toBe('Half Ironman');

    expect(parsed.phases.map(p => p.label)).toEqual(['Foundation', 'Build', 'Taper']);
    expect(parsed.phases[0].weeks).toEqual([1, 1]);
    expect(parsed.phases[0].color).toBe(colorForPhase('Foundation', 0));

    // A row with an explicit "Rest" discipline still produces a session
    // (rest is a real, displayed session type) — only rows with a blank
    // discipline cell are skipped entirely.
    expect(parsed.sessions['2026-01-07'][0].type).toBe('rest');

    expect(parsed.sessions['2026-01-05']).toEqual([
      { type: 'swim', label: 'Swim', sessionType: 'Endurance', duration: '30 min', flag: '', done: false, week: 1, phase: 'Foundation' },
    ]);
    // "Done" column: TRUE parses to true
    expect(parsed.sessions['2026-01-06'][0].done).toBe(true);
    expect(parsed.sessions['2026-02-02'][0]).toMatchObject({ type: 'bike', flag: 'Key session' });
    expect(parsed.sessions['2026-05-04'][0].type).toBe('race');
  });

  // Regression test for the Boolean(str) coercion bug: `Boolean('FALSE')` is
  // `true` in JS, so the literal word "FALSE" (or "No"/"0"/an empty string)
  // in the Done column was being read as completed.
  it('treats FALSE/No/0/blank Done cells as not done, not just blank ones', async () => {
    const rows = [
      HEADER,
      [excelSerial(2026, 1, 5), 1, 'Foundation', 'Swim', '', '', '', 'FALSE'],
      [excelSerial(2026, 1, 6), 1, 'Foundation', 'Run', '', '', '', 'No'],
      [excelSerial(2026, 1, 7), 1, 'Foundation', 'Bike', '', '', '', '0'],
      [excelSerial(2026, 1, 8), 1, 'Foundation', 'Yoga', '', '', '', ''],
      [excelSerial(2026, 1, 9), 1, 'Foundation', 'Walk', '', '', '', 'TRUE'],
      [excelSerial(2026, 1, 10), 1, 'Foundation', 'Gym', '', '', '', 'Yes'],
    ];
    const file = await fakeFile(rows);
    const parsed = await parseTrainingPlanWorkbook(file);

    expect(parsed.sessions['2026-01-05'][0].done).toBe(false);
    expect(parsed.sessions['2026-01-06'][0].done).toBe(false);
    expect(parsed.sessions['2026-01-07'][0].done).toBe(false);
    expect(parsed.sessions['2026-01-08'][0].done).toBe(false);
    expect(parsed.sessions['2026-01-09'][0].done).toBe(true);
    expect(parsed.sessions['2026-01-10'][0].done).toBe(true);
  });

  it('reads a real boolean-typed Done cell (t="b") correctly', async () => {
    const rows = [
      HEADER,
      [excelSerial(2026, 1, 5), 1, 'Foundation', 'Swim', '', '', '', false],
      [excelSerial(2026, 1, 6), 1, 'Foundation', 'Run', '', '', '', true],
    ];
    const file = await fakeFile(rows);
    const parsed = await parseTrainingPlanWorkbook(file);

    expect(parsed.sessions['2026-01-05'][0].done).toBe(false);
    expect(parsed.sessions['2026-01-06'][0].done).toBe(true);
  });

  it('maps unrecognised disciplines to "other" and known ones via the alias table', async () => {
    const rows = [
      HEADER,
      [excelSerial(2026, 1, 5), 1, 'Foundation', 'Cycling', '', '', '', ''],
      [excelSerial(2026, 1, 6), 1, 'Foundation', 'Strength', '', '', '', ''],
      [excelSerial(2026, 1, 7), 1, 'Foundation', 'Kayaking', '', '', '', ''],
    ];
    const file = await fakeFile(rows);
    const parsed = await parseTrainingPlanWorkbook(file);

    expect(parsed.sessions['2026-01-05'][0].type).toBe('bike');
    expect(parsed.sessions['2026-01-06'][0].type).toBe('conditioning');
    expect(parsed.sessions['2026-01-07'][0].type).toBe('other');
  });

  it('finds the training-plan sheet even when it is not the first sheet', async () => {
    const notesRows = [['Notes'], ['Coach comments go here']];
    const planRows = [
      HEADER,
      [excelSerial(2026, 1, 5), 1, 'Foundation', 'Swim', '', '', '', ''],
    ];
    const file = await fakeFile([
      { name: 'Notes', rows: notesRows },
      { name: 'Plan', rows: planRows },
    ]);
    const parsed = await parseTrainingPlanWorkbook(file);
    expect(parsed.sessions['2026-01-05'][0].label).toBe('Swim');
  });

  it('rejects a workbook whose only sheet is missing a required header column', async () => {
    const rows = [
      ['Date', 'Wk', 'Phase'], // missing "Discipline"
      [excelSerial(2026, 1, 5), 1, 'Foundation'],
    ];
    const file = await fakeFile(rows);
    await expect(parseTrainingPlanWorkbook(file)).rejects.toThrow(/training plan table/i);
  });

  it('rejects a workbook with no dated rows', async () => {
    const rows = [HEADER];
    const file = await fakeFile(rows);
    await expect(parseTrainingPlanWorkbook(file)).rejects.toThrow(/nothing to import/i);
  });

  it('rejects a file that is not a valid xlsx/zip', async () => {
    const file = { name: 'not-a-workbook.xlsx', arrayBuffer: async () => new TextEncoder().encode('hello').buffer };
    await expect(parseTrainingPlanWorkbook(file)).rejects.toThrow(/doesn't look like a valid/i);
  });
});

describe('colorForPhase', () => {
  it('uses the fixed palette for known phase labels regardless of index', () => {
    expect(colorForPhase('Foundation', 3)).toBe('#15803D');
    expect(colorForPhase('Taper', 0)).toBe('#DC2626');
  });

  it('falls back to a cycling palette for custom phase labels', () => {
    expect(colorForPhase('Custom Phase', 0)).toBe('#15803D');
    expect(colorForPhase('Custom Phase', 6)).toBe('#15803D'); // wraps after 6 fallback colors
  });
});
