// TEMP adversarial harness-correctness probe. Confirms:
//  (1) hero enters combat at FULL resolved maxHP (not base maxHP),
//  (2) resolved STR/INT/VIT/maxHP from runXP match the leveling formula,
//  (3) createCombatState seeds heroHP == heroMaxHP == resolveHeroStats(run).maxHP.
import { describe, it, expect } from 'vitest';
import { resolveHeroStats } from '../../src/systems/hero/HeroStatsResolver';
import { createCombatState } from '../../src/systems/combat/CombatState';
import { loadAllData } from '../../src/data/DataLoader';
import { setRun } from '../../src/state/RunState';
import type { RunState } from '../../src/state/RunState';
import enemiesJson from '../../src/data/json/enemies.json';
import { scaleEnemyForLoop } from '../../src/systems/DifficultyScaler';

function makeRun(cls: 'warrior' | 'mage', runXP: number): RunState {
  const isMage = cls === 'mage';
  const base = isMage
    ? { maxHP: 70, maxStamina: 30, maxMana: 60, defenseMultiplier: 0.8 }
    : { maxHP: 100, maxStamina: 50, maxMana: 30, defenseMultiplier: 1 };
  return {
    version: 5, runId: 'probe', seed: 'probe', generation: 1, startedAt: 0,
    hero: {
      maxHP: base.maxHP, currentHP: 1_000_000,
      maxStamina: base.maxStamina, currentStamina: 1_000_000,
      maxMana: base.maxMana, currentMana: 1_000_000,
      currentDefense: 0, strength: 1, defenseMultiplier: base.defenseMultiplier,
      moveSpeed: 2, vitality: 0, dexterity: 0, intellect: 0, spirit: 0,
      statDeltas: {}, className: cls, runXP, totalXP: 0,
    },
    deck: { active: ['t1-attack', 't1-defense', 't1-earth', 't1-fire', 't1-water'], inventory: {}, upgraded: [false,false,false,false,false], droppedCards: [] },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 20 },
    economy: { gold: 0, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [], stats: { damageDealt: 0, cardsPlayed: 0, combosTriggered: 0, goldEarned: 0 },
    isInCombat: false, currentScene: 'Game', stopAtShop: true, combatSpeed: 1, mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
  } as unknown as RunState;
}

describe('harness seed probe', () => {
  it('prints resolved stats and seeded combat HP per stage', () => {
    loadAllData();
    const stages: Array<[string, number]> = [
      ['loop2',120],['loop5',336],['loop8',480],['boss1',560],['loop15',900],
      ['boss2',1150],['loop25',1450],['boss3',1700],['boss4',2300],['boss5',2900],['boss6',3600],['boss7',4400],
    ];
    const roster = enemiesJson as any[];
    const dummy = roster.find(e => e.id === 'lost_lizard');
    for (const cls of ['warrior','mage'] as const) {
      for (const [stage, xp] of stages) {
        const run = makeRun(cls, xp);
        setRun(run);
        const resolved = resolveHeroStats(run);
        const scaled = scaleEnemyForLoop(
          { baseHP: dummy.baseHP, attack: { damage: dummy.attack.damage }, baseDefense: dummy.baseDefense, goldReward: dummy.goldReward },
          1, false, 1.0,
        );
        const enemy = { ...dummy, baseHP: scaled.hp, baseDefense: scaled.defense, attack: { ...dummy.attack, damage: scaled.damage } };
        const cs = createCombatState(run, enemy as any);
        // eslint-disable-next-line no-console
        console.log(`${cls}\t${stage}\txp=${xp}\tmaxHP=${resolved.maxHP}\tstr=${resolved.str}\tint=${resolved.int}\tvit=${resolved.vit}\tdex=${resolved.dex}\t| csHP=${cs.heroHP}\tcsMaxHP=${cs.heroMaxHP}\tcsSTR=${cs.heroStrength}\tcsINT=${cs.heroIntellect}`);
        // Full-HP seeding assertion
        expect(cs.heroHP).toBe(cs.heroMaxHP);
        expect(cs.heroMaxHP).toBe(resolved.maxHP);
        expect(cs.heroStrength).toBe(resolved.str);
        expect(cs.heroIntellect).toBe(resolved.int);
        expect(cs.heroVitality).toBe(resolved.vit);
      }
    }
  });
});
