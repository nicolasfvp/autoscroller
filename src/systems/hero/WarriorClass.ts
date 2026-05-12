// Warrior class definition with base stats and starter deck.
// No Phaser dependency. Pure data definitions.

// -- Base Stats --
// Phase 9: vitality/dexterity/intellect/spirit default to 0 (status system).
// Relics, Forge unlocks, and Tavern progression will eventually grant points.
// Widening WARRIOR_BASE_STATS in lock-step with ClassRegistry.ClassDef.baseStats
// prevents Pitfall 2 (silent type widening hides missing-field bugs).

export const WARRIOR_BASE_STATS = {
  maxHP: 100,
  maxStamina: 50,
  maxMana: 30,
  strength: 1,
  defenseMultiplier: 1,
  vitality: 0,
  dexterity: 0,
  intellect: 0,
  spirit: 0,
  className: 'warrior' as const,
};

// -- Starter Deck --

export const WARRIOR_STARTER_DECK: string[] = [
  'defend', 'strike', 'defend', 'strike',
  'heavy-hit', 'defend', 'strike', 'defend',
  'strike', 'fireball',
];

// -- Class Definition --

export interface WarriorClassDef {
  className: string;
  baseStats: typeof WARRIOR_BASE_STATS;
  starterDeck: string[];
}

export const WARRIOR: WarriorClassDef = {
  className: 'warrior',
  baseStats: WARRIOR_BASE_STATS,
  starterDeck: WARRIOR_STARTER_DECK,
};
