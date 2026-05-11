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
// Magic-heavy deck: more spells, fewer physical cards

export const MAGE_STARTER_DECK: string[] = [
  'fireball', 'fireball', 'strike',
  'heal', 'fireball', 'defend',
  'strike',
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
