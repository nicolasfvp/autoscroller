// Mage class definition with base stats and starter deck.
// No Phaser dependency. Pure data definitions.

// ── Base Stats ──────────────────────────────────────────────

export const MAGE_BASE_STATS = {
  maxHP: 70,
  maxStamina: 30,
  maxMana: 60,
  strength: 1,
  defenseMultiplier: 0.8,
  className: 'mage' as const,
};

// ── Starter Deck ────────────────────────────────────────────
// Magic-heavy deck: more spells, fewer physical cards

export const MAGE_STARTER_DECK: string[] = [
  'fireball', 'fireball', 'arcane-shield', 'strike',
  'heal', 'fireball', 'mana-drain', 'defend',
  'strike', 'rejuvenate',
];

// ── Class Definition ────────────────────────────────────────

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
