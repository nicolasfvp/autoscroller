// Shadowblade mechanic test scaffolds (D-13 b).
// Wave 0 state: tests COMPILE AND RUN. Most are it.todo (skipped) until
// Plan 3 implements CombatEngine + CardResolver branches for the new
// effect types (gain_combo, consume_combo, stealth, dot, buff, etc.).
//
// The one test that IS green at Wave 0 is the stat-delta propagation
// test, which exercises HeroStatsResolver from Plan 1 directly.

import { describe, it, expect } from 'vitest';
import { createNewRun } from '../../../src/state/RunState';
import { resolveHeroStats } from '../../../src/systems/hero/HeroStatsResolver';

describe('Shadowblade -- Combo Points (Wave 0 scaffold, RED until Plan 3)', () => {
  it.todo('gain_combo effect increments comboPoints by value');
  it.todo('comboPoints clamps at comboPointsCap (5)');
  it.todo('chalice-of-five-blades relic raises comboPointsCap to 8');
  it.todo('consume_combo zeros comboPoints and multiplies damage by old CP value');
  it.todo('finisher card at CP=0 still resolves (no damage from CP component)');
});

describe('Shadowblade -- Stealth (Wave 0 scaffold, RED until Plan 3)', () => {
  it.todo('stealth effect increments stealthCharges and sets evadeNextHit=true');
  it.todo('evadeNextHit blocks one enemy hit and resets to false');
  it.todo('Stealth bonus damage on AoE applies to primary target only (Pitfall 6)');
  it.todo('Stealth charges cap at stealthCap=4');
});

describe('Shadowblade -- Poison / DoT (Wave 0 scaffold, RED until Plan 3)', () => {
  it.todo('dot effect with stack=poison adds poisonStacks');
  it.todo('poison ticks every card play (DoT cadence per INDEX ss7 #2)');
  it.todo('per-tick damage = stacks * (1 + floor(DEX/4)) (RESEARCH A2)');
  it.todo('poisonDecayDisabled prevents the -1 stack decay tick (widows-kiss / empress-fang)');
  it.todo('poison persists across cards but not across combats (combat state reset)');
});

describe('Stat scaling (Wave 0 scaffold, RED until Plan 3)', () => {
  it.todo('DEX reduces card cooldown by 2% per point, capped at 60%');
  it.todo('INT adds +1 flat damage per point on magic-category effects');
  it.todo('STR multiplies physical damage as today');

  it('VIT statDelta propagates through resolveHeroStats (GREEN at Wave 0)', () => {
    const run = createNewRun(undefined, 1, 'warrior');
    run.hero.statDeltas = { vit: 3 };
    const resolved = resolveHeroStats(run);
    expect(resolved.vit).toBe(3);
    // The "VIT adds +5 maxHP per point" rule is Plan 3 -- here we just
    // assert the delta wiring works.
  });

  it.todo('VIT adds +5 maxHP per point (Plan 3)');
  it.todo('SPI scales healing received');
  it.todo('SPI scales stamina regen on shuffle');
});

describe('New SynergyDefinition.bonus types (Wave 0 scaffold, RED until Plan 3)', () => {
  it.todo('bonus.type=combo_point grants CP to hero');
  it.todo('bonus.type=stealth grants Stealth charge');
  it.todo('bonus.type=dot adds the named stack (poison/bleed/burn)');
  it.todo('bonus.type=stat_buff temporarily buffs the named CombatState stat');
  it.todo('bonus.type=cooldown_reduction shortens next-card cooldown');
});

describe('New tile adjacency rules (Wave 0 scaffold, RED until Plan 3)', () => {
  it.todo('Library + Shop grants cardUpgradeDiscount 0.20');
  it.todo('Arena + Combat tile grants damageBonus 0.15');
  it.todo('Shrine of Pact + Boss grants statBuff bonus');
  // Plan 3 fills in the remaining 3 adjacency rules from design/04 ss7.
});
