// DailyRunTicker — subscribes to the daily-runs wildcard topic and maintains
// an in-memory snapshot of every visible run on today's seed. Pure data
// module — UI consumers register an onChange listener and call getSnapshot().

import { mqttClient } from './MqttClient';
import { utcDateString } from './DailySeed';
import type { DailyRunUpdate } from './DailyRunBroadcaster';

const STALE_AFTER_MS = 30_000;
const CLEANUP_INTERVAL_MS = 5_000;

function isValidUpdate(x: unknown): x is DailyRunUpdate {
  if (!x || typeof x !== 'object') return false;
  const u = x as Record<string, unknown>;
  return (
    typeof u.runId === 'string' &&
    typeof u.nickname === 'string' &&
    typeof u.wave === 'number' &&
    typeof u.hpPct === 'number' &&
    typeof u.bossesDefeated === 'number' &&
    typeof u.alive === 'boolean' &&
    typeof u.className === 'string' &&
    typeof u.ts === 'number'
  );
}

export class DailyRunTicker {
  private readonly entries = new Map<string, DailyRunUpdate>();
  private readonly listeners = new Set<() => void>();
  private topic: string | null = null;
  private cleanupId: ReturnType<typeof setInterval> | null = null;
  private subscribedHandler: ((topic: string, payload: unknown) => void) | null = null;

  /**
   * Subscribe to today's daily-run topic. Idempotent — calling start() twice
   * with the same date is a no-op; calling with a different date re-subscribes.
   */
  start(date: Date = new Date()): void {
    const today = utcDateString(date);
    const nextTopic = `autoscroller/daily/${today}/runs/+`;
    if (this.topic === nextTopic) return;
    if (this.topic) this.stop();

    this.topic = nextTopic;
    this.subscribedHandler = (_topic: string, payload: unknown) => {
      if (!isValidUpdate(payload)) return;
      const prev = this.entries.get(payload.runId);
      // Reject older updates that arrive out-of-order (QoS 0, no ordering).
      if (prev && prev.ts > payload.ts) return;
      this.entries.set(payload.runId, payload);
      this.notify();
    };
    mqttClient.subscribe(nextTopic, this.subscribedHandler);

    this.cleanupId = setInterval(() => this.evictStale(), CLEANUP_INTERVAL_MS);
  }

  stop(): void {
    if (this.topic && this.subscribedHandler) {
      mqttClient.unsubscribe(this.topic, this.subscribedHandler);
    }
    this.topic = null;
    this.subscribedHandler = null;
    if (this.cleanupId) {
      clearInterval(this.cleanupId);
      this.cleanupId = null;
    }
    this.entries.clear();
    this.notify();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Sorted snapshot: alive runs first, then by wave DESC, then hpPct DESC,
   * then most-recent ts first. Dead runs sink to the bottom but stay visible.
   */
  getSnapshot(): DailyRunUpdate[] {
    return Array.from(this.entries.values()).sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.wave !== b.wave) return b.wave - a.wave;
      if (a.bossesDefeated !== b.bossesDefeated) return b.bossesDefeated - a.bossesDefeated;
      if (a.hpPct !== b.hpPct) return b.hpPct - a.hpPct;
      return b.ts - a.ts;
    });
  }

  /** Test/debug hook — inject an update without going through MQTT. */
  ingestForTest(update: DailyRunUpdate): void {
    const prev = this.entries.get(update.runId);
    if (prev && prev.ts > update.ts) return;
    this.entries.set(update.runId, update);
    this.notify();
  }

  /** Evict entries we haven't heard from in >30s. */
  evictStale(now: number = Date.now()): number {
    let evicted = 0;
    for (const [id, u] of this.entries) {
      if (now - u.ts > STALE_AFTER_MS) {
        this.entries.delete(id);
        evicted++;
      }
    }
    if (evicted > 0) this.notify();
    return evicted;
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try { fn(); } catch (err) { console.warn('[DailyRunTicker] listener error:', err); }
    });
  }
}

export const dailyRunTicker = new DailyRunTicker();
