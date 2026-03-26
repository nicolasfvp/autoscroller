// Warrior class definition with base stats and starter deck.
// No Phaser dependency. Pure data definitions.

// ── Base Stats ──────────────────────────────────────────────

export const WARRIOR_BASE_STATS = {
  maxHP: 100,
  maxStamina: 50,
  maxMana: 30,
  strength: 1,
  defenseMultiplier: 1,
  className: 'warrior' as const,
};

// ── Starter Deck ────────────────────────────────────────────

export const WARRIOR_STARTER_DECK: string[] = [
  'strike', 'strike', 'strike', 'strike',
  'defend', 'defend', 'defend', 'defend',
  'heavy-hit', 'fireball',
];

// ── Class Definition ────────────────────────────────────────

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
