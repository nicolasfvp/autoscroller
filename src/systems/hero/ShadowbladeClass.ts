// Shadowblade class definition with base stats and starter deck.
// No Phaser dependency. Pure data definitions.
//
// Phase 9 (Design v2). The class identity is mechanical (CP build -> CP spend;
// Stealth window; Poison DoT), not visual. D-08: ships with the mage sprite
// prefix as a placeholder; Plan 4 wires the tint.

// -- Base Stats --
// Per design/03_shadowblade.md §2 + §3 (locked). DEX 8 is the class-defining
// stat: -16% card cooldown floor + +8% dodge baseline.

export const SHADOWBLADE_BASE_STATS = {
  maxHP: 60,
  maxStamina: 50,       // displayed as "Energy" in UI (Plan 4 swaps the label)
  maxMana: 20,
  strength: 1,
  defenseMultiplier: 0.8,
  vitality: 0,
  dexterity: 8,
  intellect: 1,
  spirit: 0,
  className: 'shadowblade' as const,
};

// -- Starter Deck (10 cards) --
// Per design/03 §4: 4x Backstab (CP build), 2x Eviscerate (CP spend), 2x
// Shadowstep (panic + damage rider), 1x Toxic Coat (poison setup), 1x
// Veil Guard (block one hit).

export const SHADOWBLADE_STARTER_DECK: string[] = [
  'backstab', 'backstab', 'backstab', 'backstab',
  'eviscerate', 'eviscerate',
  'shadowstep', 'shadowstep',
  'toxic-coat',
  'veil-guard',
];

// -- Class Definition --
// Mirrors WarriorClass.ts / MageClass.ts shape exactly. ClassDef in
// ClassRegistry is structurally typed, so the narrow interface below is
// assignable.

export interface ShadowbladeClassDef {
  className: string;
  baseStats: typeof SHADOWBLADE_BASE_STATS;
  starterDeck: string[];
}

export const SHADOWBLADE: ShadowbladeClassDef = {
  className: 'shadowblade',
  baseStats: SHADOWBLADE_BASE_STATS,
  starterDeck: SHADOWBLADE_STARTER_DECK,
};
