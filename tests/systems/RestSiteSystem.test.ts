import { describe, it, expect } from 'vitest';
import { applyRestChoice, getRestChoices } from '../../src/systems/RestSiteSystem';

function makeRunState(overrides: any = {}): any {
  return {
    hero: { currentHP: 60, maxHP: 100, currentStamina: 50, maxStamina: 50, currentMana: 30, maxMana: 30, runXP: 0, totalXP: 0, currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2 },
    deck: {
      active: ['strike', 'defend', 'fireball'],
      inventory: {},
      upgraded: [false, false, false],
      droppedCards: [],
    },
    loop: { count: 1, tiles: [], difficulty: 1, tileLength: 15, positionInLoop: 0, difficultyMultiplier: 1.0 },
    economy: { gold: 100, tilePoints: 0, tileInventory: {}, materials: {} },
    relics: [],
    runId: 'test',
    generation: 1,
    startedAt: 0,
    isInCombat: false,
    currentScene: 'GameScene',
    stopAtShop: true,
    combatSpeed: 1,
    mapSpeed: 1,
    pool: { cards: [], relics: [], tiles: [] },
    ...overrides,
  };
}

describe('RestSiteSystem', () => {
  it('rest choice heals 30% of maxHP', () => {
    const run = makeRunState();
    const result = applyRestChoice('rest', run);
    // 30% of 100 = 30, so hp goes from 60 to 90
    expect(run.hero.currentHP).toBe(90);
    expect(result.choice).toBe('rest');
    expect(result.description).toContain('30');
  });

  it('rest choice does not exceed maxHP', () => {
    const run = makeRunState({ hero: { currentHP: 90, maxHP: 100, currentStamina: 50, maxStamina: 50, currentMana: 30, maxMana: 30, runXP: 0, totalXP: 0, currentDefense: 0, strength: 1, defenseMultiplier: 1, moveSpeed: 2 } });
    applyRestChoice('rest', run);
    expect(run.hero.currentHP).toBe(100);
  });

  it('train choice picks a card and returns description noting the upgrade', () => {
    const run = makeRunState();
    const result = applyRestChoice('train', run, () => 0);
    expect(result.choice).toBe('train');
    expect(result.description).toContain('strike');
    expect(result.description.toLowerCase()).toContain('upgrad');
  });

  it('train choice picks a different card based on rng', () => {
    const run = makeRunState();
    const result = applyRestChoice('train', run, () => 0.5);
    expect(result.choice).toBe('train');
    // rng=0.5 * 3 cards => idx 1 => 'defend'
    expect(result.description).toContain('defend');
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

  it('meditate (stamina branch) bumps both max AND current stamina by the same delta', () => {
    // Regression: previously only max was bumped, leaving the gained pool
    // invisible until natural regen filled it. Convention matches
    // PassiveSkillSystem.applyPassiveModifiersToCombatState.
    const run = makeRunState();
    const origMaxStamina = run.hero.maxStamina;
    const origCurrentStamina = run.hero.currentStamina;
    applyRestChoice('meditate', run, () => 0); // rng < 0.5 => stamina branch
    expect(run.hero.maxStamina).toBe(origMaxStamina + 5);
    expect(run.hero.currentStamina).toBe(origCurrentStamina + 5);
  });

  it('meditate choice picks mana when rng >= 0.5', () => {
    const run = makeRunState();
    const origCurrentMana = run.hero.currentMana;
    applyRestChoice('meditate', run, () => 0.5);
    expect(run.hero.maxMana).toBe(35);
    // Bug fix: current mana must also bump in lockstep.
    expect(run.hero.currentMana).toBe(origCurrentMana + 5);
  });

  it('getRestChoices returns 3 choices', () => {
    const choices = getRestChoices();
    expect(choices).toHaveLength(3);
    expect(choices.map(c => c.id)).toEqual(['rest', 'train', 'meditate']);
  });
});
