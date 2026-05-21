// DailyRunBroadcaster — publishes the local player's Daily Run progress over MQTT.
//
// Single instance per session (singleton). Started when the player enters a
// Daily Run and stopped on death / return-to-menu. Survives the GameScene <->
// CombatScene swap because it lives at module level rather than being owned
// by any scene.
//
// Topic: autoscroller/daily/<UTC-date>/runs/<runId>
// Payload: DailyRunUpdate (JSON, see types below).

import { eventBus, type GameEvents } from '../core/EventBus';
import { mqttClient } from './MqttClient';
import { hasActiveRun, getRun } from '../state/RunState';
import { utcDateString } from './DailySeed';

const PUBLISH_INTERVAL_MS = 2_500;

export interface DailyRunUpdate {
  runId: string;
  nickname: string;
  wave: number;
  hpPct: number; // 0..1
  bossesDefeated: number;
  alive: boolean;
  className: string;
  ts: number;
}

class DailyRunBroadcasterSingleton {
  private runId: string | null = null;
  private nickname: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** When true, suppress further publishes (we've already sent the death frame). */
  private finished = false;
  private subscribed = false;

  private onCombatEnd = (e: GameEvents['combat:end']) => {
    if (!this.runId) return;
    if (e.result === 'defeat') {
      // Final alive:false frame, then stop — per spec ticker should show '--'
      // for HP on dead runs.
      this.publishOnce({ alive: false, hpPct: 0 });
      this.stop();
    } else {
      // Victory over an enemy is a meaningful tick — push immediately so the
      // ticker reflects the new HP/wave state without waiting for the timer.
      this.publishOnce();
    }
  };

  private onLoopCompleted = (_: GameEvents['loop:completed']) => {
    if (!this.runId) return;
    this.publishOnce();
  };

  private onRunCleared = () => {
    // Defensive: someone called clearRun() (e.g., back to MainMenu) without
    // calling stop() first. Treat as silent shutdown.
    if (this.runId) this.stop();
  };

  /**
   * Begin broadcasting for the active run. Safe to call multiple times —
   * subsequent calls with the same runId are no-ops.
   */
  start(runId: string, nickname: string): void {
    if (this.runId === runId && this.intervalId) return;
    // If we were running a previous run, tear it down cleanly first.
    if (this.runId) this.stop();

    this.runId = runId;
    this.nickname = nickname;
    this.finished = false;

    if (!this.subscribed) {
      eventBus.on('combat:end', this.onCombatEnd);
      eventBus.on('loop:completed', this.onLoopCompleted);
      eventBus.on('run:cleared', this.onRunCleared);
      this.subscribed = true;
    }

    // First publish ASAP so the ticker picks us up immediately, then on cadence.
    this.publishOnce();
    this.intervalId = setInterval(() => this.publishOnce(), PUBLISH_INTERVAL_MS);
  }

  /**
   * Stop publishing. Does NOT send a final alive:false frame on its own —
   * call notifyDeath() before stop() if the player died.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.subscribed) {
      eventBus.off('combat:end', this.onCombatEnd);
      eventBus.off('loop:completed', this.onLoopCompleted);
      eventBus.off('run:cleared', this.onRunCleared);
      this.subscribed = false;
    }
    this.runId = null;
    this.nickname = null;
    this.finished = false;
  }

  isActive(): boolean {
    return this.runId !== null;
  }

  /** Build a DailyRunUpdate from current RunState. Returns null if no active run. */
  private buildPayload(overrides?: Partial<DailyRunUpdate>): DailyRunUpdate | null {
    if (!this.runId || !this.nickname) return null;
    if (!hasActiveRun()) return null;
    const run = getRun();
    const maxHP = Math.max(1, run.hero.maxHP);
    const hpPct = Math.max(0, Math.min(1, run.hero.currentHP / maxHP));
    const wave = (run.loop?.count ?? 0) + 1; // 1-indexed for display
    const alive = run.hero.currentHP > 0;
    return {
      runId: this.runId,
      nickname: this.nickname,
      wave,
      hpPct: Math.round(hpPct * 100) / 100,
      bossesDefeated: run.loop?.bossesDefeated ?? 0,
      alive,
      className: run.hero.className ?? 'warrior',
      ts: Date.now(),
      ...overrides,
    };
  }

  private publishOnce(overrides?: Partial<DailyRunUpdate>): void {
    if (this.finished) return;
    const payload = this.buildPayload(overrides);
    if (!payload) return;
    // Mark finished BEFORE publishing the death frame so the next event-driven
    // call (e.g., a delayed loop:completed) can't race a second publish in.
    if (payload.alive === false) this.finished = true;
    const topic = `autoscroller/daily/${utcDateString()}/runs/${payload.runId}`;
    mqttClient.publish(topic, payload, { qos: 0, retain: false });
  }

  /**
   * Tab-close / page-unload safe shutdown. Publishes one final alive:false
   * and tries to flush before the page goes away. Used as a beforeunload hook.
   */
  publishFinalAndStop(): void {
    if (!this.runId) return;
    this.publishOnce({ alive: false, hpPct: 0 });
    this.stop();
  }
}

export const dailyRunBroadcaster = new DailyRunBroadcasterSingleton();
