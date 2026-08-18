import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SESSION_DISPLAY } from '../data/sessionDisplay';

const fetchActivityCatalogMock = vi.fn();
vi.mock('./overtrain', () => ({
  getActivityCatalog: (...args) => fetchActivityCatalogMock(...args),
  findRef: (name, rows) => rows?.find(r => r.name === name) || null,
}));

const {
  FALLBACK_CATALOG, getActivityCatalog, PICKER_EXCLUDED_TYPES,
  pickerTypes, rowsForType, defaultRowForType, DEFAULT_VARIANT_NAME,
} = await import('./activityCatalog');

beforeEach(() => {
  fetchActivityCatalogMock.mockReset();
});

describe('FALLBACK_CATALOG', () => {
  it('has rows', () => {
    expect(FALLBACK_CATALOG.length).toBeGreaterThan(0);
  });

  it('every row resolves to a real SESSION_DISPLAY entry (regression guard for the category-as-type bug)', () => {
    for (const row of FALLBACK_CATALOG) {
      expect(SESSION_DISPLAY[row.type], `${row.name} has type "${row.type}" with no SESSION_DISPLAY entry`).toBeDefined();
    }
  });

  it('has unique names', () => {
    const names = FALLBACK_CATALOG.map(r => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('getActivityCatalog', () => {
  it('returns the real fetch result when it has rows', async () => {
    fetchActivityCatalogMock.mockResolvedValue([{ name: 'Custom Row', type: 'other' }]);
    const rows = await getActivityCatalog();
    expect(rows).toEqual([{ name: 'Custom Row', type: 'other' }]);
  });

  it('falls back to FALLBACK_CATALOG when the fetch returns an empty array', async () => {
    fetchActivityCatalogMock.mockResolvedValue([]);
    const rows = await getActivityCatalog();
    expect(rows).toBe(FALLBACK_CATALOG);
  });
});

describe('pickerTypes', () => {
  it('excludes recovery/rest and dedupes, preserving first-seen order', () => {
    const types = pickerTypes(FALLBACK_CATALOG);
    expect(types).not.toContain('recovery');
    expect(types).not.toContain('rest');
    expect(new Set(types).size).toBe(types.length);
    expect(types[0]).toBe('team_sport');
  });

  it('respects PICKER_EXCLUDED_TYPES', () => {
    expect(PICKER_EXCLUDED_TYPES).toEqual(['recovery', 'rest']);
  });
});

describe('rowsForType', () => {
  it('returns every row of a given type', () => {
    const bikeRows = rowsForType(FALLBACK_CATALOG, 'bike');
    expect(bikeRows.length).toBe(4);
    expect(bikeRows.every(r => r.type === 'bike')).toBe(true);
  });

  it('returns an empty array for a type with no rows', () => {
    expect(rowsForType(FALLBACK_CATALOG, 'nonexistent')).toEqual([]);
  });
});

describe('defaultRowForType', () => {
  it('resolves the named default for a multi-row type', () => {
    for (const [type, name] of Object.entries(DEFAULT_VARIANT_NAME)) {
      const row = defaultRowForType(FALLBACK_CATALOG, type);
      expect(row?.name).toBe(name);
    }
  });

  it('falls back to the single row for a type with no DEFAULT_VARIANT_NAME entry', () => {
    expect(defaultRowForType(FALLBACK_CATALOG, 'walk')?.name).toBe('Walking');
    expect(defaultRowForType(FALLBACK_CATALOG, 'dance')?.name).toBe('Dancing (social / fitness class)');
    expect(defaultRowForType(FALLBACK_CATALOG, 'pilates')?.name).toBe('Pilates');
  });

  it('returns null for a type with no rows at all', () => {
    expect(defaultRowForType(FALLBACK_CATALOG, 'nonexistent')).toBeNull();
  });
});
