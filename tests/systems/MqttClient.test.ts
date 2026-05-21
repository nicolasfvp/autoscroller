import { describe, it, expect } from 'vitest';
import { matchesFilter } from '../../src/systems/MqttClient';

describe('matchesFilter', () => {
  it('exact match', () => {
    expect(matchesFilter('a/b/c', 'a/b/c')).toBe(true);
  });

  it('mismatch on differing segment', () => {
    expect(matchesFilter('a/b/c', 'a/b/d')).toBe(false);
  });

  it('+ wildcard matches one segment', () => {
    expect(matchesFilter('a/+/c', 'a/x/c')).toBe(true);
    expect(matchesFilter('a/+/c', 'a/y/c')).toBe(true);
  });

  it('+ does not match across segment boundary', () => {
    expect(matchesFilter('a/+/c', 'a/x/y/c')).toBe(false);
  });

  it('# wildcard matches all remaining segments', () => {
    expect(matchesFilter('a/#', 'a/b/c/d')).toBe(true);
    expect(matchesFilter('a/#', 'a')).toBe(true);
  });

  it('Daily Run topic filter matches a runId', () => {
    const filter = 'autoscroller/daily/2026-05-20/runs/+';
    expect(matchesFilter(filter, 'autoscroller/daily/2026-05-20/runs/abc123')).toBe(true);
    expect(matchesFilter(filter, 'autoscroller/daily/2026-05-21/runs/abc123')).toBe(false);
  });

  it('different segment counts do not match (without #)', () => {
    expect(matchesFilter('a/b', 'a/b/c')).toBe(false);
    expect(matchesFilter('a/b/c', 'a/b')).toBe(false);
  });
});
