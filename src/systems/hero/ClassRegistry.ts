// Registry of all playable hero classes.

import { WARRIOR } from './WarriorClass';
import { MAGE } from './MageClass';
import { SHADOWBLADE } from './ShadowbladeClass';

export interface ClassDef {
  className: string;
  baseStats: {
    maxHP: number;
    maxStamina: number;
    maxMana: number;
    strength: number;
    defenseMultiplier: number;
    // -- Phase 9: status system stat axes --
    vitality: number;
    dexterity: number;
    intellect: number;
    spirit: number;
    className: string;
  };
  starterDeck: string[];
}

export const CLASS_REGISTRY: Record<string, ClassDef> = {
  warrior: WARRIOR,
  mage: MAGE,
  shadowblade: SHADOWBLADE,
};

/** Sprite key prefix per class (maps to asset folders) */
export const CLASS_SPRITE_PREFIX: Record<string, string> = {
  warrior: 'hero',
  mage: 'mage',
  // D-08: Shadowblade ships with placeholder visuals. Reuse the mage sprite
  // prefix; Plan 4 wires the #7E5BEF tint to differentiate at render time.
  shadowblade: 'mage',
};

export function getClassDef(className: string): ClassDef {
  return CLASS_REGISTRY[className] ?? WARRIOR;
}

export function getSpritePrefix(className: string): string {
  return CLASS_SPRITE_PREFIX[className] ?? 'hero';
}
