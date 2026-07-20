import { describe, it, expect } from 'vitest';
import { classifySessionTier, SESSION_TYPE_INTENSITY } from './sessionDisplay';

describe('classifySessionTier', () => {
  it('maps every configured keyword to its own tier', () => {
    Object.entries(SESSION_TYPE_INTENSITY).forEach(([tier, keywords]) => {
      keywords.forEach(kw => {
        expect(classifySessionTier(kw)).toBe(tier);
      });
    });
  });

  it('classifies an uploaded interval session as high', () => {
    expect(classifySessionTier('Interval 6x800m')).toBe('high');
  });

  it('classifies an easy recovery jog as low', () => {
    expect(classifySessionTier('Easy recovery jog')).toBe('low');
  });

  it('is case-insensitive', () => {
    expect(classifySessionTier('INTERVAL 400s')).toBe('high');
    expect(classifySessionTier('Interval')).toBe('high');
  });

  it('falls through cleanly with no matching keyword', () => {
    expect(classifySessionTier('Rest day')).toBeNull();
  });

  it('handles missing/empty input without crashing', () => {
    expect(classifySessionTier(undefined)).toBeNull();
    expect(classifySessionTier(null)).toBeNull();
    expect(classifySessionTier('')).toBeNull();
  });

  it('resolves ambiguous names to the highest-intensity keyword match', () => {
    // Contains both a low keyword ("easy"/"recovery") and a high keyword
    // ("interval") — highest tier should win (under-flagging is worse).
    expect(classifySessionTier('Easy interval recovery')).toBe('high');
  });
});
