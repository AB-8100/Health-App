import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFromCache, scheduleSaveLocal, flushPendingLocalSave } from './storage';

// Regression coverage for the mobile backgrounding bug: a delete/remove made
// just before the OS suspends or reloads the page must not be lost because
// the 1s debounce on the localStorage write hadn't fired yet.
describe('flushPendingLocalSave', () => {
  const userId = 'user-1';

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the pending debounced save immediately when flushed', () => {
    scheduleSaveLocal({ eventOverrides: { '2026-02-01': [] } }, userId);
    // Nothing written yet — the 1s debounce hasn't elapsed.
    expect(loadFromCache(userId)).toBeNull();

    flushPendingLocalSave();

    expect(loadFromCache(userId)).toEqual({ eventOverrides: { '2026-02-01': [] } });
  });

  it('is a no-op when nothing is pending', () => {
    expect(() => flushPendingLocalSave()).not.toThrow();
    expect(loadFromCache(userId)).toBeNull();
  });

  it('does not double-write once the debounce timer itself has fired', () => {
    scheduleSaveLocal({ profile: { name: 'A' } }, userId);
    vi.advanceTimersByTime(1000);
    expect(loadFromCache(userId)).toEqual({ profile: { name: 'A' } });

    // A later flush with nothing newly pending must not throw or clobber.
    flushPendingLocalSave();
    expect(loadFromCache(userId)).toEqual({ profile: { name: 'A' } });
  });

  it('retains the saved weekly day order for a user after cache hydration', () => {
    const dayOrder = {
      '2026-01-05': ['activity:Walk', 'gym:Push'],
      '2026-01-06': ['event_plan:Swim', 'activity:Mobility'],
    };

    scheduleSaveLocal({ dayOrder }, userId);
    expect(loadFromCache(userId)).toEqual({ dayOrder });
  });
});
