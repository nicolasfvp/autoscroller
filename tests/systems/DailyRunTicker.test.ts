import { describe, it, expect, beforeEach } from 'vitest';
import { DailyRunTicker } from '../../src/systems/DailyRunTicker';
import type { DailyRunUpdate } from '../../src/systems/DailyRunBroadcaster';

function update(runId: string, partial: Partial<DailyRunUpdate> = {}): DailyRunUpdate {
  return {
    runId,
    nickname: runId,
    wave: 1,
    hpPct: 1,
    bossesDefeated: 0,
    alive: true,
    className: 'warrior',
    ts: Date.now(),
    ...partial,
  };
}

describe('DailyRunTicker.getSnapshot', () => {
  let ticker: DailyRunTicker;
  beforeEach(() => { ticker = new DailyRunTicker(); });

  it('alive runs sort before dead ones', () => {
    ticker.ingestForTest(update('a', { alive: false, wave: 9 }));
    ticker.ingestForTest(update('b', { alive: true, wave: 1 }));
    const snap = ticker.getSnapshot();
    expect(snap.map((u) => u.runId)).toEqual(['b', 'a']);
  });

  it('among alive, higher wave sorts first', () => {
    ticker.ingestForTest(update('lo', { wave: 1 }));
    ticker.ingestForTest(update('hi', { wave: 4 }));
    expect(ticker.getSnapshot().map((u) => u.runId)).toEqual(['hi', 'lo']);
  });

  it('same wave: higher bossesDefeated wins', () => {
    ticker.ingestForTest(update('a', { wave: 3, bossesDefeated: 1 }));
    ticker.ingestForTest(update('b', { wave: 3, bossesDefeated: 2 }));
    expect(ticker.getSnapshot().map((u) => u.runId)).toEqual(['b', 'a']);
  });

  it('same wave + bosses: higher hpPct wins', () => {
    ticker.ingestForTest(update('a', { wave: 3, hpPct: 0.5 }));
    ticker.ingestForTest(update('b', { wave: 3, hpPct: 0.9 }));
    expect(ticker.getSnapshot().map((u) => u.runId)).toEqual(['b', 'a']);
  });
});

describe('DailyRunTicker.evictStale', () => {
  it('removes entries older than 30s and notifies listeners', () => {
    const ticker = new DailyRunTicker();
    const now = 1_000_000;
    ticker.ingestForTest(update('fresh', { ts: now - 5_000 }));
    ticker.ingestForTest(update('stale', { ts: now - 35_000 }));

    let notified = 0;
    ticker.onChange(() => notified++);

    const evicted = ticker.evictStale(now);
    expect(evicted).toBe(1);
    expect(ticker.getSnapshot().map((u) => u.runId)).toEqual(['fresh']);
    expect(notified).toBeGreaterThan(0);
  });

  it('returns 0 and does not notify when nothing is stale', () => {
    const ticker = new DailyRunTicker();
    const now = 1_000_000;
    ticker.ingestForTest(update('fresh', { ts: now - 5_000 }));

    let notified = 0;
    ticker.onChange(() => notified++);

    const evicted = ticker.evictStale(now);
    expect(evicted).toBe(0);
    expect(notified).toBe(0);
  });
});

describe('DailyRunTicker out-of-order update rejection', () => {
  it('drops an older timestamp for the same runId', () => {
    const ticker = new DailyRunTicker();
    ticker.ingestForTest(update('a', { wave: 5, ts: 1000 }));
    ticker.ingestForTest(update('a', { wave: 3, ts: 500 }));
    const snap = ticker.getSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].wave).toBe(5);
  });

  it('accepts a newer timestamp for the same runId', () => {
    const ticker = new DailyRunTicker();
    ticker.ingestForTest(update('a', { wave: 1, ts: 500 }));
    ticker.ingestForTest(update('a', { wave: 7, ts: 1000 }));
    const snap = ticker.getSnapshot();
    expect(snap[0].wave).toBe(7);
  });
});
