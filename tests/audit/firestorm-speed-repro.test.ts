// REGRESSION: "Firestorm (and every time-windowed card) must work at any speed."
//
// Root cause (fixed): CombatHUD's hourglass flip is a 600ms REAL-time tween that
// used to set engine._hourglassFlipping=true, freezing ONLY the hero cooldown
// (CombatEngine.ts:86) while tickAuras kept decaying aura windows on the
// speed-scaled delta. At speed S the flip burned 600*S ms of game-time out of
// every window per card with the hero frozen, so Firestorm's "play 3 cards in
// 4s" threshold was unreachable at >=2x. Fix: the flip is now purely cosmetic
// (setHourglassFlipping is an inert no-op); the hero cooldown always advances.
//
// This test drives the REAL CombatEngine frame-by-frame (60fps) and FAITHFULLY
// models the scene's flip: when a card plays it calls engine.setHourglassFlipping
// for 600ms of REAL frames. It asserts Firestorm fires at every speed snap,
// including a dex-18 deck that reproduced the original 1.5x-works / 2x-fails bug.
//
// Run: npx vitest run tests/audit/firestorm-speed-repro.test.ts

import { describe, it, expect } from 'vitest';
import { CombatEngine } from '../../src/systems/combat/CombatEngine';
import { createCombatState } from '../../src/systems/combat/CombatState';
import { loadAllData } from '../../src/data/DataLoader';
import { setRun } from '../../src/state/RunState';
import type { RunState } from '../../src/state/RunState';
import type { EnemyDefinition } from '../../src/data/types';

function makeRun(deck: string[], dex = 0): RunState {
  return {
    version: 5,
    runId: 'fs-repro', seed: 'fs-repro', generation: 1, startedAt: 0,
    hero: {
      maxHP: 70, currentHP: 70,
      maxStamina: 30, currentStamina: 30,
      maxMana: 60, currentMana: 60,
      currentDefense: 0, strength: 1, defenseMultiplier: 0.8, moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0,
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

const DUMMY_ENEMY = {
  id: 'dummy', name: 'Dummy', type: 'normal',
  baseHP: 1_000_000, baseDefense: 0,
  attack: { damage: 0, pattern: 'single', specialEffect: null },
  attackCooldown: 10_000_000, affinity: null, behaviors: [],
} as unknown as EnemyDefinition;

const SPEEDS = [1, 1.5, 2, 3];
const FRAME_MS = 1000 / 60;            // real ms per frame at 60fps
const FLIP_REAL_MS = 600;              // CombatHUD.triggerHourglassFlip tween duration
const FLIP_FRAMES = Math.round(FLIP_REAL_MS / FRAME_MS); // real-time, speed-independent (~36)
const SIM_GAME_MS = 9000;

// Drive the engine frame-by-frame, faithfully reproducing the scene's flip:
// after each card play, the HUD spins the hourglass for FLIP_FRAMES real frames
// and notifies the engine via setHourglassFlipping.
function fireSpeed(deck: string[], speed: number, dex: number): boolean {
  const run = makeRun(deck, dex);
  setRun(run);
  const engine = new CombatEngine(createCombatState(run, DUMMY_ENEMY));
  const deltaMs = FRAME_MS * speed;

  let gameTime = 0;
  let prevPlays = 0;
  let flipFramesLeft = 0;
  let fired = false;

  while (gameTime < SIM_GAME_MS && !engine.isComplete()) {
    engine.setHourglassFlipping(flipFramesLeft > 0);
    engine.tick(deltaMs);
    gameTime += deltaMs;
    if (flipFramesLeft > 0) flipFramesLeft--;

    const plays = engine.getCardPlayCount();
    if (plays > prevPlays) { prevPlays = plays; flipFramesLeft = FLIP_FRAMES; }
    if (engine.getState().burnStacks > 0) fired = true;
  }
  return fired;
}

describe('Firestorm fires at every speed (hourglass flip is cosmetic)', () => {
  const deck = ['t2-air-fire', 't1-attack', 't1-defense'];

  it('fires regardless of speed with a fast (dex-18) deck — the case that broke at >=2x', () => {
    loadAllData();
    for (const speed of SPEEDS) {
      expect(fireSpeed(deck, speed, /*dex=*/18), `dex-18 deck @ ${speed}x`).toBe(true);
    }
  });

  it('fires regardless of speed with a baseline (dex-0) deck', () => {
    loadAllData();
    for (const speed of SPEEDS) {
      expect(fireSpeed(deck, speed, /*dex=*/0), `dex-0 deck @ ${speed}x`).toBe(true);
    }
  });
});
