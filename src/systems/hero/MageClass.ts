// Mage class definition with base stats and starter deck.
// No Phaser dependency. Pure data definitions.

// -- Base Stats --
// Phase 9: vitality/dexterity/intellect/spirit default to 0 (status system).
// Mage's INT will be elevated by relics/passives; base is 0 for class symmetry.

export const MAGE_BASE_STATS = {
  maxHP: 70,
  maxStamina: 30,
  maxMana: 60,
  strength: 1,
  defenseMultiplier: 0.8,
  vitality: 0,
  dexterity: 0,
  intellect: 0,
  spirit: 0,
  className: 'mage' as const,
};

// -- Starter Deck --
// 5 Tier-1 cards totalling 10 elements (1 physical + 9 elemental).
// Class element-budget rule (mage: 0-3 physical / 7-10 elemental).

export const MAGE_STARTER_DECK: string[] = [
  't1-fire-fire',
  't1-water-water',
  't1-fire-water',
  't1-air-earth',
  't1-attack-fire',
];

// -- Class Definition --

export interface MageClassDef {
  className: string;
  baseStats: typeof MAGE_BASE_STATS;
  starterDeck: string[];
}

export const MAGE: MageClassDef = {
  className: 'mage',
  baseStats: MAGE_BASE_STATS,
  starterDeck: MAGE_STARTER_DECK,
};
