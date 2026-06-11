// CARD-AGNOSTIC SPEED-INVARIANCE INVARIANT
//
// The combat sim is tick-driven: CombatScene.update calls engine.tick(delta*speed),
// and deltaMs is the engine's ONLY time input. Therefore combat MUST be
// speed-invariant in game-time: over a fixed game-time budget, the hero should
// play the SAME number of cards regardless of the speed multiplier.
//
// This is the structural twin of tests/audit/firestorm-speed-repro.ts. That test
// proves one card (Firestorm) recovers at every speed; this one proves the
// underlying *engine invariant* that made the Firestorm bug possible in the first
// place: hero card tempo must not drift with speed.
//
// The original bug (now fixed): CombatHUD.triggerHourglassFlip ran a 600ms REAL-time
// tween and set engine._hourglassFlipping=true, freezing ONLY the hero cooldown
// (CombatEngine.ts:86) while tickAuras kept decaying on the speed-scaled delta. At
// speed S the flip burned 600*S ms of game-time per card with the hero frozen, so
// the hero played FEWER cards as speed rose. We FAITHFULLY model that flip here
// (calling engine.setHourglassFlipping during 600ms of REAL frames after each play)
// so that a regression — re-coupling game-time to that wall-clock tween — would make
// this test fail again.
//
// Bound: counts at 1.5x / 2x / 3x must be within +/-1 of the 1x count. The +/-1
// tolerance is the irreducible tick-granularity slack: a card whose cooldown
// expires mid-frame waits up to one frame of game-time (50ms at 3x vs ~16.7ms at
// 1x) before it actually plays, so over a fixed budget the final count can differ
// by at most one card. Anything larger means time is leaking out of the sim.
//
// Run: npx vitest run tests/audit/speed-invariance.test.ts

import { describe, it, expect } from 'vitest';
import { CombatEngine } from '../../src/systems/combat/CombatEngine';
import { createCombatState } from '../../src/systems/combat/CombatState';
import { loadAllData } from '../../src/data/DataLoader';
import { setRun } from '../../src/state/RunState';
import type { RunState } from '../../src/state/RunState';
import type { EnemyDefinition } from '../../src/data/types';

// --- harness copied from tests/audit/firestorm-speed-repro.ts ---------------

function makeRun(deck: string[], dex = 0): RunState {
  return {
    version: 5,
    runId: 'speed-inv', seed: 'speed-inv', generation: 1, startedAt: 0,
    hero: {
      maxHP: 70, currentHP: 70,
      maxStamina: 30, currentStamina: 30,
      maxMana: 60, currentMana: 60,
      currentDefense: 0, strength: 1, defenseMultiplier: 0.8, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0,
      // Huge stamina/mana pools so cheap cards stay affordable for the whole
      // budget — the invariant must be about *timing*, never about running dry.
      statDeltas: { maxStamina: 400, maxMana: 400, dex },
      className: 'mage', runXP: 0, totalXP: 0,
    },
    deck: { active: [...deck], inventory: {}, upgraded: new Array(deck.length).fill(false), droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 15, difficultyMultiplier: 1 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    isInCombat: false, currentScene: 'Game', stopAtShop: true,
    combatSpeed: 1, mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
  } as unknown as RunState;
}

// Huge HP, 0 attack, effectively-infinite attack cooldown: the enemy can never
// kill the hero or end the fight, so the run lasts the full game-time budget.
const DUMMY_ENEMY = {
  id: 'dummy', name: 'Dummy', type: 'normal',
  baseHP: 1_000_000_000, baseDefense: 0,
  attack: { damage: 0, pattern: 'single', specialEffect: null },
  attackCooldown: 1_000_000_000, affinity: null, behaviors: [],
} as unknown as EnemyDefinition;

const SPEEDS = [1, 1.5, 2, 3];
const FRAME_MS = 1000 / 60;                              // real ms per frame at 60fps
const FLIP_REAL_MS = 600;                                // CombatHUD flip tween duration
const FLIP_FRAMES = Math.round(FLIP_REAL_MS / FRAME_MS); // real-time, speed-independent (~36)
const SIM_GAME_MS = 12000;                               // fixed game-time budget

interface RunResult {
  cardPlayCount: number;
  enemyBurnStacks: number;
}

// Drive the engine frame-by-frame for a fixed GAME-TIME budget. Each real frame
// advances game-time by FRAME_MS*speed (exactly what CombatScene.update does).
// After every card play we faithfully model the HUD flip: set
// engine.setHourglassFlipping(true) for FLIP_FRAMES *real* frames. If the engine
// ever re-couples game-time to that flip, the hero's tempo will drop as speed
// rises and the +/-1 invariant below will fail.
function runForBudget(deck: string[], speed: number, dex = 0): RunResult {
  const run = makeRun(deck, dex);
  setRun(run);
  const engine = new CombatEngine(createCombatState(run, DUMMY_ENEMY));
  const deltaMs = FRAME_MS * speed;

  let gameTime = 0;
  let prevPlays = 0;
  let flipFramesLeft = 0;
  let maxEnemyBurn = 0;

  while (gameTime < SIM_GAME_MS && !engine.isComplete()) {
    engine.setHourglassFlipping(flipFramesLeft > 0);
    engine.tick(deltaMs);
    gameTime += deltaMs;
    if (flipFramesLeft > 0) flipFramesLeft--;

    const plays = engine.getCardPlayCount();
    if (plays > prevPlays) { prevPlays = plays; flipFramesLeft = FLIP_FRAMES; }

    const burn = engine.getState().burnStacks;
    if (burn > maxEnemyBurn) maxEnemyBurn = burn;
  }

  return { cardPlayCount: engine.getCardPlayCount(), enemyBurnStacks: maxEnemyBurn };
}

describe('CARD-AGNOSTIC: hero card tempo is speed-invariant (flip is cosmetic)', () => {
  // Cheap, always-affordable, fast cards. Mix of stamina (attack/agility/defense)
  // and mana (fire) costs, each 1 resource against 400+ pools, so affordability
  // never gates play during the budget — only timing does.
  const deck = ['t1-attack', 't1-agility', 't1-defense', 't1-fire'];

  it('plays the same number of cards at 1.5x / 2x / 3x as at 1x (+/-1)', () => {
    loadAllData();

    const results = SPEEDS.map((speed) => ({ speed, ...runForBudget(deck, speed) }));
    const baseline = results.find((r) => r.speed === 1)!.cardPlayCount;

    // Surface the real numbers so the report can quote them verbatim.
    // (vitest prints this on failure; harmless on success.)
    const summary = results.map((r) => `${r.speed}x=${r.cardPlayCount}`).join('  ');

    for (const r of results) {
      expect(
        Math.abs(r.cardPlayCount - baseline),
        `cardPlayCount drifted with speed — game-time leaked into the sim. [${summary}]`,
      ).toBeLessThanOrEqual(1);
    }

    // Sanity: the budget must actually exercise multiple card plays, otherwise a
    // trivially-tiny count would pass the +/-1 bound vacuously. With dex=0 the
    // tempo deck (1.2-1.6s cooldowns) plays ~10 cards in the 12s budget; require
    // a healthy margin above the +/-1 slack so the invariant is non-trivial.
    expect(baseline, 'baseline should play a meaningful number of cards').toBeGreaterThanOrEqual(8);
  });

  it('a representative event_counter card (Firestorm) fires at EVERY speed', () => {
    loadAllData();
    // Firestorm + the fast cards: its 4s "play 3 cards" window must be reachable
    // at every speed. burnStacks>0 on the enemy is the proof it fired.
    const fsDeck = ['t2-air-fire', ...deck];
    for (const speed of SPEEDS) {
      const { enemyBurnStacks } = runForBudget(fsDeck, speed);
      expect(enemyBurnStacks, `Firestorm must fire at ${speed}x (enemy burnStacks>0)`).toBeGreaterThan(0);
    }
  });
});
