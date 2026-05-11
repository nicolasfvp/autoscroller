// Phase 9 (Design v2): Phaser-free helpers for CharacterSelectScene.
// Class catalog + layout math extracted so unit tests can validate the
// LOCKED layout dimensions and the Shadowblade copy without booting Phaser.

import { SHADOWBLADE_PALETTE } from '../ui/StyleConstants';

export interface ClassOption {
  id: string;
  name: string;
  description: string;
  spriteKey: string;
  /** Phase 9: optional tint for placeholder visuals (Shadowblade per D-08). */
  spriteTint?: number;
  /** Phase 9: fallback colored rect when sprite texture not loaded. */
  fallbackColor: number;
  stats: { hp: number; stamina: number; mana: number };
  deckHint: string;
}

/**
 * The three v2 selectable classes. Shadowblade is unlocked by default
 * on first boot per D-10 (no XP/material gate).
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
  {
    id: 'shadowblade',
    name: 'Shadowblade',
    description: 'Stealth assassin.\nBuilds Combo Points, detonates finishers.',
    // D-08 placeholder: tint mage_idle with Shadowblade purple
    spriteKey: 'mage_idle',
    spriteTint: SHADOWBLADE_PALETTE.shadowblade,
    fallbackColor: SHADOWBLADE_PALETTE.shadowblade,
    // Shadowblade base stats from design/03 §2 / ShadowbladeClass.ts:
    // maxHP 60, maxStamina (energy) 50, maxMana 0
    stats: { hp: 60, stamina: 50, mana: 0 },
    deckHint: 'Backstab, Toxic Coat, Veil Guard',
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
 * UI-SPEC §Spacing FLAG: 3 cards × 230px wide + 2 × 24px gap = 738px,
 * fits in 800px canvas with 31px margin each side.
 *
 * Old v1 layout (2 cards × 280 + 1 × 40 = 600px) does not fit 3 cards.
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
