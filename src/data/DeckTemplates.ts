// Curated starter-deck templates per class.
//
// Each template is exactly 5 cards (STARTER_DECK_SIZE) totalling 10 elements
// (STARTER_ELEMENT_BUDGET), respecting the class ratio rules in
// systems/ElementSystem.ts:
//   - warrior: 7–10 physical / 0–3 elemental
//   - mage:    0–3 physical / 7–10 elemental
//
// Templates are hand-built around a coherent strategy (rage, armor, burn,
// freeze, …) so the player can pick a playstyle before the run starts.

export interface DeckTemplate {
  /** Stable id used by save/replay. */
  id: string;
  /** Display name shown on the template card. */
  name: string;
  /** One-line strategy hint. */
  description: string;
  /** Exactly 5 card ids — play order is preserved. */
  cardIds: string[];
}

export const WARRIOR_TEMPLATES: DeckTemplate[] = [
  {
    id: 'warrior-iron-wall',
    name: 'Iron Wall',
    description: 'Armor stacks high; punish hits with brace and reflected damage.',
    cardIds: [
      't2-defense-defense',
      't2-counter-defense',
      't2-attack-defense',
      't2-agility-defense',
      't2-defense-earth',
    ],
  },
  {
    id: 'warrior-berserker',
    name: 'Berserker',
    description: 'Bleed yourself for rage and turn pain into damage.',
    cardIds: [
      't2-attack-attack',
      't2-counter-counter',
      't2-attack-counter',
      't2-agility-counter',
      't2-attack-water',
    ],
  },
  {
    id: 'warrior-quickstrike',
    name: 'Quickstrike',
    description: 'Haste, multi-hit, and cooldown pressure from the agility axis.',
    cardIds: [
      't2-agility-agility',
      't2-agility-attack',
      't2-air-attack',
      't2-agility-air',
      't2-air-defense',
    ],
  },
  {
    id: 'warrior-emberguard',
    name: 'Emberguard',
    description: 'Steel and flame: burn the foe while your armor holds the line.',
    cardIds: [
      't2-attack-attack',
      't2-attack-defense',
      't2-attack-fire',
      't2-counter-fire',
      't2-defense-fire',
    ],
  },
  {
    id: 'warrior-stoneguard',
    name: 'Stoneguard',
    description: 'Slow and lock the enemy under crushing earth and bulwarks.',
    cardIds: [
      't2-defense-defense',
      't2-counter-defense',
      't2-attack-earth',
      't2-defense-earth',
      't2-agility-earth',
    ],
  },
  {
    id: 'warrior-vengeance',
    name: 'Vengeance',
    description: 'Counter-stance bleeds and vengeance windows finish the kill.',
    cardIds: [
      't2-counter-counter',
      't2-agility-counter',
      't2-counter-defense',
      't2-attack-counter',
      't2-counter-water',
    ],
  },
];

export const MAGE_TEMPLATES: DeckTemplate[] = [
  {
    id: 'mage-pyromancer',
    name: 'Pyromancer',
    description: 'Stack burn on the enemy and consume it for explosive damage.',
    cardIds: [
      't2-fire-fire',
      't2-air-fire',
      't2-earth-fire',
      't2-fire-water',
      't2-attack-fire',
    ],
  },
  {
    id: 'mage-frostbinder',
    name: 'Frostbinder',
    description: 'Heal, freeze, and stall — drown the enemy in cold water.',
    cardIds: [
      't2-water-water',
      't2-fire-water',
      't2-air-water',
      't2-earth-water',
      't2-attack-water',
    ],
  },
  {
    id: 'mage-stormcaller',
    name: 'Stormcaller',
    description: 'Air-driven haste and multi-strike, no card sits still for long.',
    cardIds: [
      't2-air-air',
      't2-air-fire',
      't2-air-water',
      't2-air-earth',
      't2-air-attack',
    ],
  },
  {
    id: 'mage-earthwarden',
    name: 'Earthwarden',
    description: 'Stun, slow, and elemental armor — set the pace, then crush it.',
    cardIds: [
      't2-earth-earth',
      't2-earth-fire',
      't2-earth-water',
      't2-air-earth',
      't2-defense-earth',
    ],
  },
  {
    id: 'mage-elementalist',
    name: 'Elementalist',
    description: 'One of each element. A balanced toolkit for any encounter.',
    cardIds: [
      't2-fire-fire',
      't2-water-water',
      't2-air-air',
      't2-earth-earth',
      't2-fire-water',
    ],
  },
  {
    id: 'mage-hexbinder',
    name: 'Hexbinder',
    description: 'Layer stun and slow until nothing the foe does happens on time.',
    cardIds: [
      't2-water-water',
      't2-earth-earth',
      't2-earth-water',
      't2-air-earth',
      't2-air-water',
    ],
  },
];

export const DECK_TEMPLATES_BY_CLASS: Record<string, DeckTemplate[]> = {
  warrior: WARRIOR_TEMPLATES,
  mage: MAGE_TEMPLATES,
};

export function getTemplatesForClass(className: string): DeckTemplate[] {
  return DECK_TEMPLATES_BY_CLASS[className] ?? WARRIOR_TEMPLATES;
}

/** Template used by the scripted tutorial. Single fixed deck, warrior. */
export const TUTORIAL_TEMPLATE_ID = 'warrior-iron-wall';

export function getTemplateById(id: string): DeckTemplate | undefined {
  for (const list of Object.values(DECK_TEMPLATES_BY_CLASS)) {
    const found = list.find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}
