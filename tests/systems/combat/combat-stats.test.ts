import { describe, it, expect } from 'vitest';
import { createEmptyCombatStats } from '../../../src/systems/combat/CombatStats';

describe('CombatStats', () => {
  it('createEmptyCombatStats returns object with all counters at 0', () => {
    const stats = createEmptyCombatStats('slime', 'Slime');

    expect(stats.damageDealt).toBe(0);
    expect(stats.damageReceived).toBe(0);
    expect(stats.cardsPlayed).toBe(0);
    expect(stats.synergiesTriggered).toBe(0);
    expect(stats.reshuffles).toBe(0);
    expect(stats.cardsSkipped).toBe(0);
  });

  it('createEmptyCombatStats stores enemy info', () => {
    const stats = createEmptyCombatStats('goblin', 'Goblin');

    expect(stats.enemyId).toBe('goblin');
    expect(stats.enemyName).toBe('Goblin');
  });

  it('createEmptyCombatStats sets result to ongoing', () => {
    const stats = createEmptyCombatStats('slime', 'Slime');

    expect(stats.result).toBe('ongoing');
  });

  it('stats are mutable (can accumulate during combat)', () => {
    const stats = createEmptyCombatStats('slime', 'Slime');
    stats.damageDealt += 10;
    stats.cardsPlayed += 1;

    expect(stats.damageDealt).toBe(10);
    expect(stats.cardsPlayed).toBe(1);
  });
});
