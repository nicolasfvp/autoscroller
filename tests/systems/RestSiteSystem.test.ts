import { describe, it, expect } from 'vitest';
import { applyRestChoice, getRestChoices } from '../../src/systems/RestSiteSystem';

function makeRunState(overrides: any = {}) {
  return {
    hero: { hp: 60, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 },
    deck: {
      cards: [
        { id: 'strike', name: 'Strike', bonusDamage: 0 },
        { id: 'defend', name: 'Defend', bonusDamage: 0 },
        { id: 'fireball', name: 'Fireball', bonusDamage: 0 },
      ],
      order: ['strike', 'defend', 'fireball'],
    },
    loop: { count: 1, length: 15, tiles: [], positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 100, tilePoints: 0, metaLoot: 0 },
    tileInventory: [],
    relics: [],
    ...overrides,
  };
}

describe('RestSiteSystem', () => {
  it('rest choice heals 30% of maxHp', () => {
    const run = makeRunState();
    const result = applyRestChoice('rest', run);
    // 30% of 100 = 30, so hp goes from 60 to 90
    expect(run.hero.hp).toBe(90);
    expect(result.choice).toBe('rest');
    expect(result.description).toContain('30');
  });

  it('rest choice does not exceed maxHp', () => {
    const run = makeRunState({ hero: { hp: 90, maxHp: 100, stamina: 50, maxStamina: 50, mana: 30, maxMana: 30, xp: 0 } });
    applyRestChoice('rest', run);
    expect(run.hero.hp).toBe(100);
  });

  it('train choice adds +2 bonusDamage to a card', () => {
    const run = makeRunState();
    applyRestChoice('train', run, () => 0); // deterministic: always pick first card
    expect(run.deck.cards[0].bonusDamage).toBe(2);
  });

  it('train choice stacks bonusDamage', () => {
    const run = makeRunState();
    run.deck.cards[0].bonusDamage = 4;
    applyRestChoice('train', run, () => 0); // pick first card
    expect(run.deck.cards[0].bonusDamage).toBe(6);
  });

  it('meditate choice increases maxStamina or maxMana by 5', () => {
    const run = makeRunState();
    const origStamina = run.hero.maxStamina;
    const origMana = run.hero.maxMana;
    applyRestChoice('meditate', run, () => 0); // rng < 0.5 => stamina
    const staminaIncreased = run.hero.maxStamina === origStamina + 5;
    const manaIncreased = run.hero.maxMana === origMana + 5;
    expect(staminaIncreased || manaIncreased).toBe(true);
  });

  it('meditate choice picks mana when rng >= 0.5', () => {
    const run = makeRunState();
    applyRestChoice('meditate', run, () => 0.5);
    expect(run.hero.maxMana).toBe(35);
  });

  it('getRestChoices returns 3 choices', () => {
    const choices = getRestChoices();
    expect(choices).toHaveLength(3);
    expect(choices.map(c => c.id)).toEqual(['rest', 'train', 'meditate']);
  });
});
