import { describe, it, expect } from 'vitest';
import { computeHeroChips, computeEnemyChips } from '../../src/ui/EffectIcons';
import type { CombatState } from '../../src/systems/combat/CombatState';
import type { ActiveAura } from '../../src/systems/combat/StatusEffects';

function makeMinState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    heroAuras: [],
    enemyAuras: [],
    poisonStacks: 0,
    bleedStacks: 0,
    burnStacks: 0,
    stunStacks: 0,
    slowStacks: 0,
    rageStacks: 0,
    heroBurnStacks: 0,
    heroBleedStacks: 0,
    ...overrides,
  } as unknown as CombatState;
}

describe('computeEnemyChips', () => {
  it('returns empty array when no stacks or auras', () => {
    const chips = computeEnemyChips(makeMinState());
    expect(chips).toEqual([]);
  });

  it('emits one chip per non-zero enemy DoT stack, in deterministic order', () => {
    const chips = computeEnemyChips(makeMinState({
      poisonStacks: 3,
      bleedStacks: 2,
      burnStacks: 5,
      stunStacks: 1,
      slowStacks: 4,
    }));
    expect(chips.map(c => c.key)).toEqual([
      'enemy-poison', 'enemy-bleed', 'enemy-burn',
      'enemy-stun', 'enemy-slow',
    ]);
    expect(chips[0].label).toBe('3');
    expect(chips[2].label).toBe('5');
  });

  it('skips stacks that are zero', () => {
    const chips = computeEnemyChips(makeMinState({ poisonStacks: 2, bleedStacks: 0, burnStacks: 1 }));
    expect(chips.map(c => c.key)).toEqual(['enemy-poison', 'enemy-burn']);
  });

  it('aggregates enemy auras by modifier kind and shows max remaining ms', () => {
    const enemyAuras: ActiveAura[] = [
      { remainingMs: 3000, modifier: { kind: 'def', value: -2 } },
      { remainingMs: 5000, modifier: { kind: 'def', value: -1 } },
    ];
    const chips = computeEnemyChips(makeMinState({ enemyAuras }));
    expect(chips).toHaveLength(1);
    expect(chips[0].key).toBe('enemy-aura-def');
    expect(chips[0].label).toBe('-3 5.0s');
  });

  it('drops zero-sum aggregated auras', () => {
    const enemyAuras: ActiveAura[] = [
      { remainingMs: 3000, modifier: { kind: 'def', value: -2 } },
      { remainingMs: 5000, modifier: { kind: 'def', value: 2 } },
    ];
    const chips = computeEnemyChips(makeMinState({ enemyAuras }));
    expect(chips).toEqual([]);
  });
});

describe('computeHeroChips', () => {
  it('returns empty array when nothing is active', () => {
    expect(computeHeroChips(makeMinState())).toEqual([]);
  });

  it('emits chips for self-stacks (rage, burn, bleed)', () => {
    const chips = computeHeroChips(makeMinState({
      rageStacks: 4, heroBurnStacks: 2, heroBleedStacks: 1,
    }));
    expect(chips.map(c => c.key).sort()).toEqual(['hero-bleed', 'hero-burn', 'hero-rage']);
  });

  it('emits aggregated modifier-aura chip with cd_reduction formatted as percent', () => {
    const heroAuras: ActiveAura[] = [
      { remainingMs: 4000, modifier: { kind: 'cd_reduction', value: 0.25 } },
    ];
    const chips = computeHeroChips(makeMinState({ heroAuras }));
    expect(chips).toHaveLength(1);
    expect(chips[0].key).toBe('hero-aura-cd_reduction');
    expect(chips[0].label).toBe('+25% 4.0s');
  });

  it('emits armed-trigger chips for on_armor_break and on_hp_pct_below', () => {
    const heroAuras: ActiveAura[] = [
      { remainingMs: 5000, trigger: 'on_armor_break', then: { type: 'damage', value: 4, target: 'enemy' } },
      { remainingMs: 5000, trigger: 'on_hp_pct_below', threshold: 30, then: { type: 'heal', value: 5, target: 'self' } },
      { remainingMs: 5000, trigger: 'on_armor_break', then: { type: 'damage', value: 2, target: 'enemy' } },
    ];
    const chips = computeHeroChips(makeMinState({ heroAuras }));
    const armor = chips.find(c => c.key === 'hero-trigger-armor');
    const hp = chips.find(c => c.key === 'hero-trigger-hp');
    expect(armor?.label).toBe('x2');
    expect(hp?.label).toBe('armed');
  });

  it('leads with effective core-stat chips (readStat) and skips zero axes', () => {
    const chips = computeHeroChips(makeMinState({
      heroStrength: 12, heroVitality: 8, heroDexterity: 0, heroIntellect: 0, heroSpirit: 3,
    }));
    // STR, VIT, SPI present in order; DEX/INT are 0 → skipped.
    expect(chips.map(c => c.key)).toEqual(['hero-stat-str', 'hero-stat-vit', 'hero-stat-spi']);
    expect(chips.map(c => c.label)).toEqual(['12', '8', '3']);
  });

  it('folds active stat-auras into the stat total (no duplicate aura chip)', () => {
    const heroAuras: ActiveAura[] = [
      { remainingMs: 4000, modifier: { kind: 'str', value: 3 } },
    ];
    const chips = computeHeroChips(makeMinState({ heroStrength: 10, heroAuras }));
    expect(chips.find(c => c.key === 'hero-stat-str')?.label).toBe('13'); // 10 base + 3 aura
    expect(chips.some(c => c.key === 'hero-aura-str')).toBe(false);       // not shown twice
  });

  it('includes per-combat stat boosts in the stat total', () => {
    const chips = computeHeroChips(makeMinState({
      heroIntellect: 5,
      statBoostsThisCombat: { int: 2 },
    }));
    expect(chips.find(c => c.key === 'hero-stat-int')?.label).toBe('7'); // 5 base + 2 boost
  });

  it('still emits non-stat auras (e.g. cd_reduction) alongside the stat totals', () => {
    const heroAuras: ActiveAura[] = [
      { remainingMs: 4000, modifier: { kind: 'cd_reduction', value: 0.25 } },
    ];
    const chips = computeHeroChips(makeMinState({ heroStrength: 6, heroAuras }));
    expect(chips.map(c => c.key)).toContain('hero-stat-str');
    expect(chips.map(c => c.key)).toContain('hero-aura-cd_reduction');
  });
});
