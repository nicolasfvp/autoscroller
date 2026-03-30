// Registry of all playable hero classes.

import { WARRIOR } from './WarriorClass';
import { MAGE } from './MageClass';

export interface ClassDef {
  className: string;
  baseStats: {
    maxHP: number;
    maxStamina: number;
    maxMana: number;
    strength: number;
    defenseMultiplier: number;
    className: string;
  };
  starterDeck: string[];
}

export const CLASS_REGISTRY: Record<string, ClassDef> = {
  warrior: WARRIOR,
  mage: MAGE,
};

/** Sprite key prefix per class (maps to asset folders) */
export const CLASS_SPRITE_PREFIX: Record<string, string> = {
  warrior: 'hero',
  mage: 'mage',
};

export function getClassDef(className: string): ClassDef {
  return CLASS_REGISTRY[className] ?? WARRIOR;
}

export function getSpritePrefix(className: string): string {
  return CLASS_SPRITE_PREFIX[className] ?? 'hero';
}
