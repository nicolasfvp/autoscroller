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
// 5 Tier-1 cards totalling 10 elements (9 physical + 1 elemental).
// Class element-budget rule (warrior: 7-10 physical / 0-3 elemental).

export const WARRIOR_STARTER_DECK: string[] = [
  't1-attack-attack',
  't1-defense-defense',
  't1-attack-defense',
  't1-agility-agility',
  't1-attack-fire',
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
