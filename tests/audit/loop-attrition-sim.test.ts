// Headless FULL-LOOP ATTRITION simulator.
//
// Unlike deck-battle-sim.test.ts (which rests the hero to FULL resolved HP and
// fights ONE isolated combat), this drives the real CombatEngine across a
// SEQUENCE of combats on a SINGLE persistent RunState — modelling the real
// game's war of attrition:
//   - HP persists between fights (CombatScene.ts:172 write-back).
//   - Stamina/mana recover only 50% of their deficit per fight (CombatState.ts:230).
//   - Armor resets to 0 each fight.
//   - Out-of-combat heals clamp to BASE maxHP (run.hero.maxHP, never the leveled
//     resolved max): shop +30% base (ShopScene.ts:761), Lodestone +8, Trailblazer
//     +5, Travel Boots +1/tile.
//   - runXP is earned per kill (normal 10 / elite 30 / boss 80, XPSystem.ts:8-12),
//     driving in-run leveling exactly as the real game.
//   - Enemy stats scale by 1 + bossKillCount*0.15 (LoopRunner.ts:245); bosses at
//     half that delta; elites get HP*1.6 / dmg*1.3 (CombatScene.ts:358).
//   - Real 6-boss rotation [doom_knight, iron_golem, bog_witch, desert_golem,
//     infernal_dragon, boss_iron_golem] (LoopRunner.ts:369) — NO lizard_king.
//
// Encounter density is PLAYER-DRIVEN (planning): a default loop is 15 basic tiles
// each 18% to spawn lost_lizard (min 2/loop); the player may place terrain combat
// tiles (50% spawn, drawing from terrain-enemies.json pools). The spec's
// `planning` block models how many terrain tiles of which type the player lays.
//
// Run: LOOP_SPEC=... LOOP_OUT=... npx vitest run tests/audit/loop-attrition-sim.test.ts
// (PowerShell: $env:LOOP_SPEC='...'; $env:LOOP_OUT='...'; npx vitest run ...)

import { describe, it } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { CombatEngine } from '../../src/systems/combat/CombatEngine';
import { createCombatState } from '../../src/systems/combat/CombatState';
import { scaleEnemyForLoop } from '../../src/systems/DifficultyScaler';
import { resolveHeroStats } from '../../src/systems/hero/HeroStatsResolver';
import { loadAllData, getCardById } from '../../src/data/DataLoader';
import { setRun } from '../../src/state/RunState';
import type { RunState } from '../../src/state/RunState';
import type { EnemyDefinition } from '../../src/data/types';
import enemiesJson from '../../src/data/json/enemies.json';
import terrainEnemies from '../../src/data/terrain-enemies.json';
import difficultyConfig from '../../src/data/difficulty.json';

// ── Real constants (mirrored from src so the harness is self-contained) ──
const BOSS_ROTATION = ['doom_knight', 'iron_golem', 'bog_witch', 'desert_golem', 'infernal_dragon', 'boss_iron_golem'];
const XP_PER = { normal: 10, elite: 30, boss: 80 } as const;
const PCT_PER_BOSS = (difficultyConfig as any).percentPerBossKill ?? 0.15;
const BASE_LOOP_LEN = (difficultyConfig as any).baseLoopLength ?? 15;
const BASIC_COMBAT_CHANCE = (difficultyConfig as any).basicTileCombatChance ?? 0.18;
const ELITE_CHANCE = (difficultyConfig as any).eliteChance ?? 0.15;
const BOSS_EVERY = (difficultyConfig as any).bossEveryNLoops ?? 10;
const LOOP_GROWTH: number[] = (difficultyConfig as any).loopGrowth?.schedule ?? [3, 2, 2, 1, 1];
const MAX_TILE_LEN = (difficultyConfig as any).loopGrowth?.maxTileLength ?? 40;
const TERRAIN_COMBAT_CHANCE = 0.5; // LoopRunner.COMBAT_TILE_SPAWN_CHANCE
const SIM_TICK_MS = 100;
const FIGHT_CAP_MS = 120_000; // a fight unfinished by 120s would deadlock-defeat the hero in-game

const ROSTER = enemiesJson as unknown as EnemyDefinition[];
const ENEMY_BY_ID: Record<string, EnemyDefinition> = Object.fromEntries(ROSTER.map((e) => [e.id, e]));

// ── seeded RNG (mulberry32) ──
function mulberry32(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlanningTerrain { terrain: string; count: number }
interface EnemyOverride {
  baseHP?: number; attackDamage?: number; baseDefense?: number; affinity?: string | null;
  behaviorsOff?: boolean;  // strip shield/drain/enrage/multi_hit behaviors[]
  multiHitOff?: boolean;   // strip only multi_hit behavior
  // patch params of matching behaviors[] entries (e.g. {type:'multi_hit',hitCount:2},
  // {type:'shield',shieldAmount:4}, {type:'drain',healPercent:12}, {type:'enrage',attackSpeedMultiplier:1.2})
  behaviorPatch?: Array<{ type: string } & Record<string, number>>;
}
interface CardOverride { cost?: any; cooldown?: number; exhaust?: boolean; effects?: any[]; effectsPatch?: Array<Record<string, any>> }
interface RunSpec {
  id: string;
  class: 'warrior' | 'mage';
  deck: string[];
  upgraded?: boolean[];
  relics?: string[];          // 'travel_boots' | 'trailblazers_brand' | 'lodestone_pendant' | 'hearty_meal' supported here
  stats?: Record<string, number>; // statDeltas (str/vit/dex/int/spi/maxHP/...)
  startLoop?: number;
  startBossKills?: number;    // bosses already killed at the band start (sets difficulty + loop growth)
  startRunXP?: number;        // runXP at band start (the build's leveling at this depth)
  loopsToSimulate?: number;   // simulate up to this many loops (or until death)
  visitsShop?: boolean;       // shop auto-heal between loops (default true)
  // planning: either fixed terrainTiles each loop, OR a pool to draw N random
  // terrains from per loop (more realistic variety across loops/reps).
  planning?: { terrainTiles?: PlanningTerrain[]; terrainPool?: string[]; tilesPerLoop?: number };
  repeats?: number;
  seed?: string;
  // ── balance LEVER knobs ──
  shopHealPct?: number;          // override shop heal fraction (default 0.30)
  loopCompleteHeal?: number;     // extra flat HP on loop completion (default 0)
  // Heal-cap: heals clamp to resolved (leveled) maxHP. DEFAULT TRUE now matches
  // the SHIPPED fix (HeroStatsResolver.resolvedMaxHP); set false to model the old
  // base-HP-capped behavior for A/B.
  healToResolvedMax?: boolean;
  enemyOverrides?: Record<string, EnemyOverride>;
  cardOverrides?: Record<string, CardOverride>;
}

// Apply per-card overrides to the live registry; returns a restore fn (copied from deck-battle-sim).
function applyCardOverrides(overrides?: Record<string, CardOverride>): () => void {
  if (!overrides) return () => {};
  const restores: Array<() => void> = [];
  for (const [cardId, patch] of Object.entries(overrides)) {
    const card = getCardById(cardId) as any;
    if (!card) throw new Error(`cardOverrides: unknown card '${cardId}'`);
    const original: any = { cost: card.cost, cooldown: card.cooldown, exhaust: card.exhaust, effects: JSON.parse(JSON.stringify(card.effects ?? [])) };
    restores.push(() => { card.cost = original.cost; card.cooldown = original.cooldown; card.exhaust = original.exhaust; card.effects = original.effects; });
    if (patch.cost !== undefined) card.cost = patch.cost;
    if (patch.cooldown !== undefined) card.cooldown = patch.cooldown;
    if (patch.exhaust !== undefined) card.exhaust = patch.exhaust;
    if (patch.effects !== undefined) card.effects = JSON.parse(JSON.stringify(patch.effects));
    else if (patch.effectsPatch) {
      card.effects = JSON.parse(JSON.stringify(card.effects ?? []));
      patch.effectsPatch.forEach((p, i) => { if (p && card.effects[i]) Object.assign(card.effects[i], p); });
    }
  }
  return () => { for (const r of restores) r(); };
}

// resolve the eligible enemy pool for a terrain at a loopCount (LootGenerator.getEnemyPoolForTerrain)
function poolFor(terrain: string, loopCount: number): string[] {
  const t = (terrainEnemies as any)[terrain];
  if (!t) return ['lost_lizard'];
  const ids = [...(t.base ?? [])];
  for (const [thr, arr] of Object.entries(t.addAtLoop ?? {})) {
    if (loopCount >= Number(thr)) ids.push(...(arr as string[]));
  }
  return ids.length ? ids : ['lost_lizard'];
}

function getLoopGrowth(bossKills: number): number {
  return LOOP_GROWTH[Math.min(bossKills, LOOP_GROWTH.length - 1)];
}

function makeRun(spec: RunSpec): RunState {
  const isMage = spec.class === 'mage';
  const base = isMage
    ? { maxHP: 70, maxStamina: 30, maxMana: 60, defenseMultiplier: 0.8 }
    : { maxHP: 100, maxStamina: 50, maxMana: 30, defenseMultiplier: 1 };
  const s = spec.stats ?? {};
  const statDeltas: Record<string, number> = {};
  for (const k of ['str', 'vit', 'dex', 'int', 'spi', 'maxHP', 'maxStamina', 'maxMana']) {
    if (s[k]) statDeltas[k] = s[k];
  }
  const deck = [...spec.deck];
  const upgraded = spec.upgraded && spec.upgraded.length === deck.length
    ? spec.upgraded
    : new Array(deck.length).fill(false);
  return {
    version: 5,
    runId: `loop-${spec.id}`,
    seed: `loop-${spec.id}`,
    generation: 1,
    startedAt: 0,
    hero: {
      maxHP: base.maxHP,
      currentHP: base.maxHP,            // real runs start at BASE maxHP (RunState.ts:339)
      maxStamina: base.maxStamina,
      currentStamina: base.maxStamina,
      maxMana: base.maxMana,
      currentMana: base.maxMana,
      currentDefense: 0,
      strength: 1,
      defenseMultiplier: base.defenseMultiplier,
      moveSpeed: 2,
      vitality: 0, dexterity: 0, intellect: 0, spirit: 0,
      statDeltas,
      className: spec.class,
      runXP: spec.startRunXP ?? 0,
      totalXP: 0,
    },
    deck: { active: deck, inventory: {}, upgraded, droppedCards: [] },
    loop: { count: spec.startLoop ?? 1, tiles: [], difficulty: 1, tileLength: BASE_LOOP_LEN, difficultyMultiplier: 1 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [...(spec.relics ?? [])],
    stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    isInCombat: false,
    currentScene: 'Game',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
  } as unknown as RunState;
}

interface Encounter { enemyId: string; isElite: boolean; isBoss: boolean }

// Build the ordered encounter list for one loop, faithful to LoopRunner.assignEnemies.
function buildLoopEncounters(spec: RunSpec, loopCount: number, bossKills: number, tileLen: number, rng: () => number): Encounter[] {
  const enc: Encounter[] = [];
  // basic tiles
  let basicEnemies = 0;
  for (let i = 0; i < tileLen; i++) {
    if (rng() < BASIC_COMBAT_CHANCE) {
      const isElite = rng() < ELITE_CHANCE;
      enc.push({ enemyId: 'lost_lizard', isElite, isBoss: false });
      basicEnemies++;
    }
  }
  // player-placed terrain combat tiles (fixed list)
  for (const pt of spec.planning?.terrainTiles ?? []) {
    for (let i = 0; i < pt.count; i++) {
      if (rng() < TERRAIN_COMBAT_CHANCE) {
        const pool = poolFor(pt.terrain, loopCount);
        const id = pool[Math.floor(rng() * pool.length)];
        const isElite = rng() < ELITE_CHANCE;
        enc.push({ enemyId: id, isElite, isBoss: false });
        basicEnemies++;
      }
    }
  }
  // player-placed terrain tiles drawn from a pool (random terrain each tile)
  const tpool = spec.planning?.terrainPool;
  const tperLoop = spec.planning?.tilesPerLoop ?? 0;
  if (tpool && tpool.length && tperLoop > 0) {
    for (let i = 0; i < tperLoop; i++) {
      if (rng() < TERRAIN_COMBAT_CHANCE) {
        const terrain = tpool[Math.floor(rng() * tpool.length)];
        const pool = poolFor(terrain, loopCount);
        const id = pool[Math.floor(rng() * pool.length)];
        const isElite = rng() < ELITE_CHANCE;
        enc.push({ enemyId: id, isElite, isBoss: false });
        basicEnemies++;
      }
    }
  }
  // min 2 enemies/loop floor (LoopRunner.ts:376)
  while (basicEnemies < 2) {
    enc.push({ enemyId: 'lost_lizard', isElite: false, isBoss: false });
    basicEnemies++;
  }
  // shuffle non-boss encounters (path order is effectively arbitrary vs planning)
  for (let i = enc.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [enc[i], enc[j]] = [enc[j], enc[i]];
  }
  // boss appended last on boss loops
  if (loopCount % BOSS_EVERY === 0) {
    enc.push({ enemyId: BOSS_ROTATION[bossKills % BOSS_ROTATION.length], isElite: false, isBoss: true });
  }
  return enc;
}

function buildEnemy(e: Encounter, difficultyMultiplier: number, loopCount: number, ovr?: EnemyOverride): EnemyDefinition {
  const baseDef = ENEMY_BY_ID[e.enemyId];
  if (!baseDef) throw new Error(`Unknown enemy ${e.enemyId}`);
  // apply enemy-level overrides to the BASE stats before scaling
  let def: any = { ...baseDef };
  if (ovr) {
    if (ovr.baseHP !== undefined) def.baseHP = ovr.baseHP;
    if (ovr.attackDamage !== undefined) def.attack = { ...def.attack, damage: ovr.attackDamage };
    if (ovr.baseDefense !== undefined) def.baseDefense = ovr.baseDefense;
    if (ovr.affinity !== undefined) def.affinity = ovr.affinity;
    if (ovr.behaviorsOff) def.behaviors = [];
    else if (ovr.multiHitOff && Array.isArray(def.behaviors)) def.behaviors = def.behaviors.filter((b: any) => b.type !== 'multi_hit');
    if (ovr.behaviorPatch && Array.isArray(def.behaviors)) {
      def.behaviors = def.behaviors.map((b: any) => {
        const p = ovr.behaviorPatch!.find((x) => x.type === b.type);
        return p ? { ...b, ...p } : b;
      });
    }
  }
  const scaled = scaleEnemyForLoop(def, loopCount, def.type === 'boss', difficultyMultiplier);
  const elite = e.isElite && def.type !== 'boss';
  return {
    ...def,
    type: elite ? ('elite' as any) : def.type,
    baseHP: elite ? Math.round(scaled.hp * 1.6) : scaled.hp,
    baseDefense: scaled.defense,
    attack: { ...def.attack, damage: elite ? Math.round(scaled.damage * 1.3) : scaled.damage },
  } as EnemyDefinition;
}

// One fight: returns won + final pools + damage dealt. Mutates nothing (caller writes back).
function fight(run: RunState, enemy: EnemyDefinition): { won: boolean; heroHP: number; heroStamina: number; heroMana: number; damage: number } {
  setRun(run);
  const state = createCombatState(run, enemy);
  const engine = new CombatEngine(state);
  let elapsed = 0;
  while (!engine.isComplete() && elapsed < FIGHT_CAP_MS) {
    engine.tick(SIM_TICK_MS);
    elapsed += SIM_TICK_MS;
  }
  const fs: any = engine.getState();
  const won = fs.enemyHP <= 0 && fs.heroHP > 0;
  const damage = (engine.getStats() as any)?.damageDealt ?? 0;
  return { won, heroHP: Math.max(0, fs.heroHP), heroStamina: fs.heroStamina, heroMana: fs.heroMana, damage };
}

interface RunResult {
  died: boolean;
  deathLoop: number | null;
  deathEnemy: string | null;
  deathWasBoss: boolean;
  loopsCleared: number;          // fully completed loops
  bossesKilled: number;
  hpEnteringBoss: Record<string, number>; // bossId -> % of base maxHP entering the boss fight
  bossResult: Record<string, 'win' | 'loss' | 'notReached'>;
  totalFights: number;
  totalDamage: number;
}

function simulateRunInner(spec: RunSpec, rep: number): RunResult {
  const run = makeRun(spec);
  const baseMaxHP = run.hero.maxHP;
  const rng = mulberry32(`${spec.seed ?? spec.id}#${rep}`);
  const loopsToSim = spec.loopsToSimulate ?? 12;
  const visitsShop = spec.visitsShop !== false;
  const heartyMeal = (spec.relics ?? []).includes('hearty_meal');
  const hasTravelBoots = (spec.relics ?? []).includes('travel_boots');
  const hasTrailblazer = (spec.relics ?? []).includes('trailblazers_brand');
  const hasLodestone = (spec.relics ?? []).includes('lodestone_pendant');
  const shopPct = spec.shopHealPct ?? 0.30;
  const loopHeal = spec.loopCompleteHeal ?? 0;
  // out-of-combat heals clamp to this cap. DEFAULT = resolved/leveled max (matches
  // the shipped fix); set healToResolvedMax:false to model the old base-HP cap.
  const hpCap = (): number => spec.healToResolvedMax === false ? baseMaxHP : resolveHeroStats(run).maxHP;

  let bossKills = spec.startBossKills ?? 0;
  // tile length reflects loop growth from bosses already killed at band start
  let tileLen = BASE_LOOP_LEN;
  for (let i = 0; i < bossKills; i++) tileLen = Math.min(MAX_TILE_LEN, tileLen + getLoopGrowth(i));
  // rested entering the band: start at full resolved HP / resources
  run.hero.currentHP = resolveHeroStats(run).maxHP;
  run.hero.currentStamina = run.hero.maxStamina;
  run.hero.currentMana = run.hero.maxMana;
  const res: RunResult = {
    died: false, deathLoop: null, deathEnemy: null, deathWasBoss: false,
    loopsCleared: 0, bossesKilled: 0, hpEnteringBoss: {}, bossResult: {}, totalFights: 0, totalDamage: 0,
  };

  let loopCount = spec.startLoop ?? 1;
  for (let l = 0; l < loopsToSim; l++) {
    run.loop.count = loopCount;
    run.loop.difficultyMultiplier = 1 + bossKills * PCT_PER_BOSS;
    const encounters = buildLoopEncounters(spec, loopCount, bossKills, tileLen, rng);
    let firstCombatTileThisLoop = true;

    for (const e of encounters) {
      // per-tile relic heal (Travel Boots fires on every tile; approximate as per combat tile)
      if (hasTravelBoots) run.hero.currentHP = Math.min(hpCap(), run.hero.currentHP + 1);
      if (hasTrailblazer && firstCombatTileThisLoop) {
        run.hero.currentHP = Math.min(hpCap(), run.hero.currentHP + 5);
        run.hero.currentStamina = Math.min(run.hero.maxStamina, run.hero.currentStamina + 1);
        run.hero.currentMana = Math.min(run.hero.maxMana, run.hero.currentMana + 1);
        firstCombatTileThisLoop = false;
      }

      if (e.isBoss) {
        res.hpEnteringBoss[e.enemyId] = +(run.hero.currentHP / baseMaxHP).toFixed(3);
      }
      const enemy = buildEnemy(e, run.loop.difficultyMultiplier, loopCount, spec.enemyOverrides?.[e.enemyId]);
      const r = fight(run, enemy);
      res.totalFights++;
      res.totalDamage += r.damage;
      run.hero.currentHP = r.heroHP;
      run.hero.currentStamina = r.heroStamina;
      run.hero.currentMana = r.heroMana;

      if (!r.won) {
        res.died = true; res.deathLoop = loopCount; res.deathEnemy = e.enemyId; res.deathWasBoss = e.isBoss;
        if (e.isBoss) res.bossResult[e.enemyId] = 'loss';
        return res;
      }
      // XP award per kill
      const kind = e.isBoss ? 'boss' : (e.isElite ? 'elite' : 'normal');
      run.hero.runXP = (run.hero.runXP ?? 0) + XP_PER[kind];
      if (e.isBoss) {
        res.bossResult[e.enemyId] = 'win';
        res.bossesKilled++;
        bossKills++;
        // loop growth applies after a boss kill (LoopRunner.ts:459)
        tileLen = Math.min(MAX_TILE_LEN, tileLen + getLoopGrowth(bossKills - 1));
      }
    }

    // loop completed
    res.loopsCleared++;
    if (hasLodestone) {
      run.hero.currentHP = Math.min(hpCap(), run.hero.currentHP + 8);
      run.hero.currentStamina = Math.min(run.hero.maxStamina, run.hero.currentStamina + 1);
      run.hero.currentMana = Math.min(run.hero.maxMana, run.hero.currentMana + 1);
    }
    if (loopHeal > 0) run.hero.currentHP = Math.min(hpCap(), run.hero.currentHP + loopHeal);
    // shop auto-heal (between loops, if the player visits the shop). Real game heals
    // shopPct of BASE maxHP and clamps to base; the hpCap() knob can raise the clamp.
    if (visitsShop) {
      const pct = shopPct * (heartyMeal ? 1.5 : 1.0);
      run.hero.currentHP = Math.min(run.hero.currentHP + Math.floor(baseMaxHP * pct), hpCap());
      if (heartyMeal) run.hero.currentStamina = Math.min(run.hero.maxStamina, run.hero.currentStamina + 2);
    }
    loopCount++;
  }
  return res;
}

function simulateRun(spec: RunSpec, rep: number): RunResult {
  const restore = applyCardOverrides(spec.cardOverrides);
  try { return simulateRunInner(spec, rep); } finally { restore(); }
}

interface RunSummary {
  id: string;
  class: string;
  deckSize: number;
  repeats: number;
  visitsShop: boolean;
  planning: string;
  deathRate: number;
  survivedAllRate: number;
  deathLoopHistogram: Record<string, number>;
  deathEnemyHistogram: Record<string, number>;
  avgLoopsCleared: number;
  avgBossesKilled: number;
  avgDamageDealt: number;
  // first-boss focus
  reachedFirstBossRate: number;
  firstBossWinRate: number;
  avgHpEnteringFirstBoss: number | null; // % of base maxHP, averaged over reps that reached it
  // per-boss aggregation (any boss faced in the band)
  bossesFaced: Record<string, { reached: number; won: number; winRate: number; avgHpEnter: number | null }>;
  meta?: { class: string; quality?: string; stage?: string; archetype?: string; variant?: string; boss?: string };
}

function summarize(spec: RunSpec, results: RunResult[]): RunSummary {
  const reps = results.length;
  const deaths = results.filter((r) => r.died).length;
  const deathLoopHist: Record<string, number> = {};
  const deathEnemyHist: Record<string, number> = {};
  for (const r of results) {
    if (r.died) {
      deathLoopHist[String(r.deathLoop)] = (deathLoopHist[String(r.deathLoop)] ?? 0) + 1;
      deathEnemyHist[r.deathEnemy ?? '?'] = (deathEnemyHist[r.deathEnemy ?? '?'] ?? 0) + 1;
    }
  }
  const firstBoss = BOSS_ROTATION[0];
  const reachedFB = results.filter((r) => firstBoss in r.bossResult).length;
  const wonFB = results.filter((r) => r.bossResult[firstBoss] === 'win').length;
  const hpEnter = results.filter((r) => firstBoss in r.hpEnteringBoss).map((r) => r.hpEnteringBoss[firstBoss]);
  const avgHpFB = hpEnter.length ? +(hpEnter.reduce((a, b) => a + b, 0) / hpEnter.length).toFixed(3) : null;
  // per-boss aggregation across all bosses any rep faced
  const bossesFaced: RunSummary['bossesFaced'] = {};
  const allBossIds = new Set<string>();
  for (const r of results) for (const b of Object.keys(r.bossResult)) allBossIds.add(b);
  for (const b of allBossIds) {
    const reached = results.filter((r) => b in r.bossResult).length;
    const won = results.filter((r) => r.bossResult[b] === 'win').length;
    const hps = results.filter((r) => b in r.hpEnteringBoss).map((r) => r.hpEnteringBoss[b]);
    bossesFaced[b] = {
      reached, won,
      winRate: reached ? +(won / reached).toFixed(3) : 0,
      avgHpEnter: hps.length ? +(hps.reduce((a, x) => a + x, 0) / hps.length).toFixed(3) : null,
    };
  }
  return {
    bossesFaced,
    meta: { class: spec.class, quality: (spec as any).quality, stage: (spec as any).stage, archetype: (spec as any).archetype, variant: (spec as any).variant, boss: (spec as any).boss },
    id: spec.id,
    class: spec.class,
    deckSize: spec.deck.length,
    repeats: reps,
    visitsShop: spec.visitsShop !== false,
    planning: JSON.stringify(spec.planning?.terrainPool ? { pool: spec.planning.terrainPool, perLoop: spec.planning.tilesPerLoop } : (spec.planning?.terrainTiles ?? [])),
    deathRate: +(deaths / reps).toFixed(3),
    survivedAllRate: +((reps - deaths) / reps).toFixed(3),
    deathLoopHistogram: deathLoopHist,
    deathEnemyHistogram: deathEnemyHist,
    avgLoopsCleared: +(results.reduce((a, r) => a + r.loopsCleared, 0) / reps).toFixed(2),
    avgBossesKilled: +(results.reduce((a, r) => a + r.bossesKilled, 0) / reps).toFixed(2),
    avgDamageDealt: Math.round(results.reduce((a, r) => a + r.totalDamage, 0) / reps),
    reachedFirstBossRate: +(reachedFB / reps).toFixed(3),
    firstBossWinRate: reachedFB ? +(wonFB / reachedFB).toFixed(3) : 0,
    avgHpEnteringFirstBoss: avgHpFB,
  };
}

describe('full-loop attrition simulation', () => {
  it('runs every run-spec and writes a results JSON', () => {
    loadAllData();
    const specPath = pathResolve(process.cwd(), process.env.LOOP_SPEC || 'tests/audit/loop-spec.json');
    const outPath = pathResolve(process.cwd(), process.env.LOOP_OUT || 'tests/audit/loop-results.json');
    if (!existsSync(specPath)) throw new Error(`Spec not found: ${specPath}. Set LOOP_SPEC.`);
    const spec = JSON.parse(readFileSync(specPath, 'utf-8')) as { runs: RunSpec[] } | RunSpec[];
    const runs: RunSpec[] = Array.isArray(spec) ? spec : spec.runs;

    const summaries: RunSummary[] = [];
    const detail: any[] = [];
    for (const rs of runs) {
      const reps = Math.max(1, rs.repeats ?? 20);
      const results: RunResult[] = [];
      for (let i = 0; i < reps; i++) results.push(simulateRun(rs, i));
      summaries.push(summarize(rs, results));
      detail.push({ id: rs.id, sampleRun: results[0], results });
    }
    writeFileSync(outPath, JSON.stringify({ meta: { specPath, count: summaries.length, tickMs: SIM_TICK_MS, fightCapMs: FIGHT_CAP_MS }, summaries, detail }, null, 2), 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`Wrote ${summaries.length} run summaries to ${outPath}`);
    // eslint-disable-next-line no-console
    for (const s of summaries) console.log(`${s.id}: deathRate=${s.deathRate} avgLoops=${s.avgLoopsCleared} reachFB=${s.reachedFirstBossRate} winFB=${s.firstBossWinRate} hpEnterFB=${s.avgHpEnteringFirstBoss}`);
  }, 600_000);
});
