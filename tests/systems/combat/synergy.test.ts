import { describe, it, expect } from 'vitest';
import { SynergySystem } from '../../../src/systems/combat/SynergySystem';

describe('SynergySystem', () => {
  const system = new SynergySystem();

  it('check("defend","strike") returns Counter Attack synergy for warrior class', () => {
    const result = system.check('defend', 'strike', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Counter Attack!');
    expect(result!.bonus.type).toBe('damage');
    expect(result!.bonus.value).toBe(15);
  });

  it('check("defend","strike") returns null for non-warrior class (class-restricted)', () => {
    const result = system.check('defend', 'strike', 'mage');
    expect(result).toBeNull();
  });

  it('check("heal","fireball") returns Channeled Fire for any class', () => {
    const result = system.check('heal', 'fireball', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Channeled Fire!');

    const result2 = system.check('heal', 'fireball', 'mage');
    expect(result2).not.toBeNull();
    expect(result2!.displayName).toBe('Channeled Fire!');
  });

  it('check("strike","defend") returns null (order matters)', () => {
    const result = system.check('strike', 'defend', 'warrior');
    expect(result).toBeNull();
  });

  it('check("strike","strike") returns null (not a defined pair)', () => {
    const result = system.check('strike', 'strike', 'warrior');
    expect(result).toBeNull();
  });

  it('check("heavy-hit","heavy-hit") returns Berserker Rage for warrior', () => {
    const result = system.check('heavy-hit', 'heavy-hit', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Berserker Rage!');
    expect(result!.bonus.value).toBe(40);
  });

  it('returns null when lastPlayedCardId is null', () => {
    const result = system.check(null, 'strike', 'warrior');
    expect(result).toBeNull();
  });

  it('check("mana-drain","arcane-shield") returns Arcane Conversion for any class', () => {
    const result = system.check('mana-drain', 'arcane-shield', 'warrior');
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe('Arcane Conversion!');
    expect(result!.bonus.type).toBe('armor');
    expect(result!.bonus.value).toBe(12);
  });
});
