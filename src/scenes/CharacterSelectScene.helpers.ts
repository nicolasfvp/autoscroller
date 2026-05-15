// Phase 9 (Design v2): Phaser-free helpers for CharacterSelectScene.
// Class catalog + layout math extracted so unit tests can validate the
// LOCKED layout dimensions without booting Phaser.

export interface ClassOption {
  id: string;
  name: string;
  description: string;
  spriteKey: string;
  /** Phase 9: optional tint for placeholder visuals. */
  spriteTint?: number;
  /** Phase 9: fallback colored rect when sprite texture not loaded. */
  fallbackColor: number;
  stats: { hp: number; stamina: number; mana: number };
  deckHint: string;
}

/**
 * The two selectable classes.
 */
export const CLASS_CARDS: ClassOption[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'Balanced melee fighter.\nHigh HP and stamina.',
    spriteKey: 'hero_idle',
    fallbackColor: 0x4488ff,
    stats: { hp: 100, stamina: 50, mana: 30 },
    deckHint: 'Strikes, Defends, Heavy Hit',
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'Powerful spellcaster.\nHigh mana, low HP.',
    spriteKey: 'mage_idle',
    fallbackColor: 0x9944ff,
    stats: { hp: 70, stamina: 30, mana: 60 },
    deckHint: 'Fireballs, Heals, Mana Drain',
  },
];

export function getClassCards(): ClassOption[] {
  return CLASS_CARDS;
}

export interface CardLayout {
  cardW: number;
  cardH: number;
  gap: number;
  totalW: number;
  startX: number;
  margin: number;
}

/**
 * UI-SPEC §Spacing FLAG: cards are 230px wide with 24px gaps. With 2 classes
 * the layout fits comfortably inside the 800px canvas.
 */
export function computeCardLayout(canvasWidth = 800, classCount = CLASS_CARDS.length): CardLayout {
  const cardW = 230;
  const cardH = 400;
  const gap = 24;
  const totalW = classCount * cardW + (classCount - 1) * gap;
  const margin = (canvasWidth - totalW) / 2;
  const startX = margin + cardW / 2;  // x-center of first card
  return { cardW, cardH, gap, totalW, startX, margin };
}
