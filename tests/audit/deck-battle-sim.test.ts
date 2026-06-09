// Headless FULL-COMBAT deck-vs-enemy batch simulator.
//
// Unlike card-audit-sim-v2 (which runs single cards through CardResolver in
// isolation), this drives the real CombatEngine tick loop with a faithfully
// constructed RunState — so it measures whole-DECK viability across a run
// progression: win-rate, time-to-kill, HP cushion, against the live enemy /
// boss roster.
//
// Driven by JSON so agents can author their own matchup batteries:
//   SIM_SPEC = path to input matchup spec (default tests/audit/sim-matchups.json)
//   SIM_OUT  = path to output results    (default tests/audit/sim-battle-results.json)
//
// Run: SIM_SPEC=... SIM_OUT=... npx vitest run tests/audit/deck-battle-sim.test.ts
// (PowerShell: $env:SIM_SPEC='...'; $env:SIM_OUT='...'; npx vitest run ...)
//
// A matchup entry (see Matchup type below) specifies the class, deck (5-15 card
// ids), optional per-position upgrade flags, a hero stat/level/relic profile,
// and the enemy id + loop multiplier (+isBoss). Each matchup is simulated
// `repeats` times (default 3) to average over RNG (some cards use rand()).

import { describe, it } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { CombatEngine } from '../../src/systems/combat/CombatEngine';
import { createCombatState } from '../../src/systems/combat/CombatState';
import { scaleEnemyForLoop } from '../../src/systems/DifficultyScaler';
import { loadAllData, getCardById } from '../../src/data/DataLoader';
import { setRun } from '../../src/state/RunState';
import type { RunState } from '../../src/state/RunState';
import type { EnemyDefinition } from '../../src/data/types';
import enemiesJson from '../../src/data/json/enemies.json';

// EventBus is a real singleton; the engine only emits on it. No mock needed
// headless, but the listeners are empty so emits are cheap.

interface StatProfile {
  str?: number; vit?: number; dex?: number; int?: number; spi?: number;
  maxHP?: number; maxStamina?: number; maxMana?: number;
}

interface Matchup {
  id: string;
  label?: string;
  archetype?: string;
  stage?: string;           // 'early' | 'mid' | 'late' (free-form tag)
  class: 'warrior' | 'mage';
  deck: string[];
  /** Per-position upgrade flags (length matches deck) OR a set of upgraded card ids. */
  upgraded?: boolean[] | string[];
  /** Stat investment layered on top of class base + runXP level (statDeltas). */
  stats?: StatProfile;
  /** XP earned this run — drives the realistic in-run level bonus. */
  runXP?: number;
  relics?: string[];
  enemy: string;            // id from enemies.json
  enemyOverride?: Partial<EnemyDefinition>; // optional custom enemy (HP, attack, affinity, ...)
  /**
   * Per-card balance overrides applied (then reverted) around this matchup —
   * lets the questioning phase test PROPOSED card changes (CD cut, value lift,
   * pierce, exhaust toggle, consume coefficients) WITHOUT editing cards.json.
   * Shape: { "<cardId>": { cost?, cooldown?, exhaust?, effects?, effectsPatch? } }.
   * `effects` replaces the whole array; `effectsPatch[i]` shallow-merges into
   * effects[i] (use for `value`, `pierce_armor`, `multi_hit`, `stack`,
   * `consume_stack_value`, etc.). For the magic elemMult rate, set the
   * SIM_ELEM_RATE env var on the vitest run instead.
   */
  cardOverrides?: Record<string, { cost?: any; cooldown?: number; exhaust?: boolean; effects?: any[]; effectsPatch?: Array<Record<string, any>> }>;
  loopMultiplier?: number;  // difficulty multiplier (1 + bossKills*0.10)
  isBoss?: boolean;
  loopCount?: number;       // cosmetic / for reporting
  repeats?: number;
}

interface MatchupResult {
  id: string;
  label?: string;
  archetype?: string;
  stage?: string;
  class: string;
  enemy: string;
  enemyType: string;
  loopMultiplier: number;
  isBoss: boolean;
  deckSize: number;
  enemyScaledHP: number;
  enemyScaledDamage: number;
  enemyScaledDefense: number;
  repeats: number;
  wins: number;
  winRate: number;
  deaths: number;
  timeouts: number;
  avgTtkMs: number | null;        // avg time-to-kill on WINS
  avgHeroHpPctOnWin: number | null;
  avgHeroHpPctOverall: number;     // losses count as 0
  avgDamageDealt: number;
  avgCardsPlayed: number;
  avgReshuffles: number;
  /** Composite robustness score: winRate + 0.25*avgHpCushion (0..~1.25). */
  score: number;
  errors: string[];
}

const SIM_TICK_MS = 100;
const SIM_MAX_MS = 180_000; // 3 min sim cap (engine self-fails at 5 min deadlock)

function applyUpgrades(deck: string[], upgraded?: boolean[] | string[]): boolean[] {
  if (!upgraded) return new Array(deck.length).fill(false);
  if (upgraded.length === 0) return new Array(deck.length).fill(false);
  if (typeof upgraded[0] === 'boolean') {
    const arr = upgraded as boolean[];
    return deck.map((_, i) => arr[i] ?? false);
  }
  const set = new Set(upgraded as string[]);
  return deck.map((id) => set.has(id));
}

function makeRun(m: Matchup): RunState {
  const isMage = m.class === 'mage';
  const base = isMage
    ? { maxHP: 70, maxStamina: 30, maxMana: 60, defenseMultiplier: 0.8 }
    : { maxHP: 100, maxStamina: 50, maxMana: 30, defenseMultiplier: 1 };
  const s = m.stats ?? {};
  // Stat investment goes through statDeltas (matches event/relic grants in-game).
  const statDeltas: Record<string, number> = {};
  if (s.str) statDeltas.str = s.str;
  if (s.vit) statDeltas.vit = s.vit;
  if (s.dex) statDeltas.dex = s.dex;
  if (s.int) statDeltas.int = s.int;
  if (s.spi) statDeltas.spi = s.spi;
  if (s.maxHP) statDeltas.maxHP = s.maxHP;
  if (s.maxStamina) statDeltas.maxStamina = s.maxStamina;
  if (s.maxMana) statDeltas.maxMana = s.maxMana;

  const deck = [...m.deck];
  const upgraded = applyUpgrades(deck, m.upgraded);

  return {
    version: 5,
    runId: `sim-${m.id}`,
    seed: `sim-${m.id}`,
    generation: 1,
    startedAt: 0,
    hero: {
      maxHP: base.maxHP,
      // Enter at FULL *resolved* maxHP (rested-hero benchmark). createCombatState
      // clamps current* to the resolved maxes (base + runXP leveling + VIT*5 +
      // relic/stat deltas), so a high sentinel makes the hero start full rather
      // than at base maxHP. (Bug fix: previously seeded base.maxHP, which started
      // a leveled hero at ~66% HP and understated survival ~40% of maxHP.)
      currentHP: 1_000_000,
      maxStamina: base.maxStamina,
      currentStamina: 1_000_000,
      maxMana: base.maxMana,
      currentMana: 1_000_000,
      currentDefense: 0,
      strength: 1,
      defenseMultiplier: base.defenseMultiplier,
      moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0,
      statDeltas,
      className: m.class,
      runXP: m.runXP ?? 0,
      totalXP: 0,
    },
    deck: {
      active: deck,
      inventory: {},
      upgraded,
      droppedCards: [],
    },
    loop: { count: m.loopCount ?? 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [...(m.relics ?? [])],
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
  } as unknown as RunState;
}

function makeEnemy(m: Matchup): EnemyDefinition {
  const roster = enemiesJson as unknown as EnemyDefinition[];
  const baseEnemy = roster.find((e) => e.id === m.enemy);
  if (!baseEnemy && !m.enemyOverride) {
    throw new Error(`Unknown enemy id: ${m.enemy}`);
  }
  const merged = { ...(baseEnemy ?? {}), ...(m.enemyOverride ?? {}) } as EnemyDefinition;
  const mult = m.loopMultiplier ?? 1.0;
  const scaled = scaleEnemyForLoop(
    { baseHP: merged.baseHP, attack: { damage: merged.attack.damage }, baseDefense: merged.baseDefense, goldReward: merged.goldReward },
    1,
    !!m.isBoss,
    mult,
  );
  return {
    ...merged,
    baseHP: scaled.hp,
    baseDefense: scaled.defense,
    attack: { ...merged.attack, damage: scaled.damage },
  };
}

/**
 * Apply per-card overrides to the loaded card registry (mutates the live objects
 * getCardById returns). Returns a restore fn. Process-local: each vitest process
 * has its own module instance, so parallel agents never collide.
 */
function applyCardOverrides(overrides?: Matchup['cardOverrides']): () => void {
  if (!overrides) return () => {};
  const restores: Array<() => void> = [];
  for (const [cardId, patch] of Object.entries(overrides)) {
    const card = getCardById(cardId) as any;
    if (!card) throw new Error(`cardOverrides: unknown card '${cardId}'`);
    const original: any = {
      cost: card.cost, cooldown: card.cooldown, exhaust: card.exhaust,
      effects: JSON.parse(JSON.stringify(card.effects ?? [])),
    };
    restores.push(() => {
      card.cost = original.cost; card.cooldown = original.cooldown;
      card.exhaust = original.exhaust; card.effects = original.effects;
    });
    if (patch.cost !== undefined) card.cost = patch.cost;
    if (patch.cooldown !== undefined) card.cooldown = patch.cooldown;
    if (patch.exhaust !== undefined) card.exhaust = patch.exhaust;
    if (patch.effects !== undefined) {
      card.effects = JSON.parse(JSON.stringify(patch.effects));
    } else if (patch.effectsPatch) {
      card.effects = JSON.parse(JSON.stringify(card.effects ?? []));
      patch.effectsPatch.forEach((p, i) => {
        if (p && card.effects[i]) Object.assign(card.effects[i], p);
      });
    }
  }
  return () => { for (const r of restores) r(); };
}

function simulateOnce(m: Matchup): { won: boolean; timeout: boolean; ttkMs: number; heroHpPct: number; damage: number; cards: number; reshuffles: number } {
  const restore = applyCardOverrides(m.cardOverrides);
  try {
  const run = makeRun(m);
  setRun(run);
  const enemy = makeEnemy(m);
  const state = createCombatState(run, enemy);
  const heroMaxHP = state.heroMaxHP;
  const engine = new CombatEngine(state);

  let elapsed = 0;
  while (!engine.isComplete() && elapsed < SIM_MAX_MS) {
    engine.tick(SIM_TICK_MS);
    elapsed += SIM_TICK_MS;
  }
  const finalState = engine.getState();
  const stats = engine.getStats();
  const timeout = !engine.isComplete();
  const won = finalState.enemyHP <= 0 && finalState.heroHP > 0;
  const heroHpPct = heroMaxHP > 0 ? Math.max(0, finalState.heroHP) / heroMaxHP : 0;
  return {
    won,
    timeout,
    ttkMs: elapsed,
    heroHpPct: won ? heroHpPct : 0,
    damage: stats.damageDealt,
    cards: stats.cardsPlayed,
    reshuffles: stats.reshuffles,
  };
  } finally {
    restore();
  }
}

function runMatchup(m: Matchup): MatchupResult {
  const repeats = Math.max(1, m.repeats ?? 3);
  const errors: string[] = [];
  let wins = 0, deaths = 0, timeouts = 0;
  let ttkSum = 0, ttkCount = 0;
  let hpWinSum = 0, hpWinCount = 0;
  let hpOverallSum = 0;
  let dmgSum = 0, cardsSum = 0, reshSum = 0;
  let enemyScaledHP = 0, enemyScaledDamage = 0, enemyScaledDefense = 0, enemyType = 'normal';

  for (let i = 0; i < repeats; i++) {
    try {
      const r = simulateOnce(m);
      if (r.won) {
        wins++;
        ttkSum += r.ttkMs; ttkCount++;
        hpWinSum += r.heroHpPct; hpWinCount++;
      } else if (r.timeout) {
        timeouts++;
      } else {
        deaths++;
      }
      hpOverallSum += r.heroHpPct;
      dmgSum += r.damage; cardsSum += r.cards; reshSum += r.reshuffles;
    } catch (e: any) {
      errors.push(`repeat ${i}: ${e?.message ?? String(e)}`);
    }
  }

  // Capture scaled enemy stats once for reporting.
  try {
    const enemy = makeEnemy(m);
    enemyScaledHP = enemy.baseHP;
    enemyScaledDamage = enemy.attack.damage;
    enemyScaledDefense = enemy.baseDefense;
    enemyType = enemy.type;
  } catch (e: any) {
    errors.push(`enemy build: ${e?.message ?? String(e)}`);
  }

  const winRate = repeats > 0 ? wins / repeats : 0;
  const avgHpCushion = hpWinCount > 0 ? hpWinSum / hpWinCount : 0;
  return {
    id: m.id,
    label: m.label,
    archetype: m.archetype,
    stage: m.stage,
    class: m.class,
    enemy: m.enemy,
    enemyType,
    loopMultiplier: m.loopMultiplier ?? 1.0,
    isBoss: !!m.isBoss,
    deckSize: m.deck.length,
    enemyScaledHP,
    enemyScaledDamage,
    enemyScaledDefense,
    repeats,
    wins,
    winRate: +winRate.toFixed(3),
    deaths,
    timeouts,
    avgTtkMs: ttkCount > 0 ? Math.round(ttkSum / ttkCount) : null,
    avgHeroHpPctOnWin: hpWinCount > 0 ? +(hpWinSum / hpWinCount).toFixed(3) : null,
    avgHeroHpPctOverall: +(hpOverallSum / repeats).toFixed(3),
    avgDamageDealt: Math.round(dmgSum / repeats),
    avgCardsPlayed: Math.round(cardsSum / repeats),
    avgReshuffles: +(reshSum / repeats).toFixed(2),
    score: +(winRate + 0.25 * avgHpCushion).toFixed(3),
    errors,
  };
}

describe('deck battle simulation (full combat)', () => {
  it('runs every matchup in the spec and writes a results JSON', () => {
    loadAllData();

    const specPath = pathResolve(process.cwd(), process.env.SIM_SPEC || 'tests/audit/sim-matchups.json');
    const outPath = pathResolve(process.cwd(), process.env.SIM_OUT || 'tests/audit/sim-battle-results.json');

    if (!existsSync(specPath)) {
      throw new Error(`Spec file not found: ${specPath}. Set SIM_SPEC or create tests/audit/sim-matchups.json`);
    }
    const spec = JSON.parse(readFileSync(specPath, 'utf-8')) as { matchups: Matchup[] } | Matchup[];
    const matchups: Matchup[] = Array.isArray(spec) ? spec : spec.matchups;

    const results: MatchupResult[] = [];
    for (const m of matchups) {
      results.push(runMatchup(m));
    }

    const out = {
      meta: {
        specPath,
        count: results.length,
        tickMs: SIM_TICK_MS,
        maxMs: SIM_MAX_MS,
      },
      results,
    };
    writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`Wrote ${results.length} matchup results to ${outPath}`);
  }, 600_000);
});
