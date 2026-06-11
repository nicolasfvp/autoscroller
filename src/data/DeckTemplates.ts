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
    description: 'Armor stacks high; Brace counters and Shield Bash turn your wall into a weapon.',
    // Bulwark/Iron Reckoning/Parrying/Bramble all stack armor, so Shield Bash
    // (deal = armor) hits hard and Bramble's >=10-armor clause stays live;
    // Bulwark's Brace feeds rage into Iron Reckoning's per-rage attack bonus.
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
    description: 'Bank Rage from every blow, then Iron Reckoning turns it into raw damage.',
    // Rage payoff is Iron Reckoning (the ONLY card that spends/scales rage).
    // Reckless + Bloodprice + Bulwark's Brace bank rage; Iron Reckoning makes
    // every attack scale with it; Quickstrike rides the buff.
    cardIds: [
      't2-attack-attack',
      't2-defense-defense',
      't2-counter-defense',
      't2-attack-counter',
      't2-agility-attack',
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
    name: 'Emberrend',
    description: 'Open wounds, then set them ablaze — bleed feeds the burn.',
    // Bleed first (Razor + Sidestep) so Kindle's "+3 if enemy bleeds" and
    // Cinderscar's Vengeance->bleed clause both light up; Flame Dart adds
    // direct damage + burn. No armor, so Shield Bash is intentionally absent.
    cardIds: [
      't2-counter-counter',
      't2-agility-counter',
      't2-attack-fire',
      't2-counter-fire',
      't2-agility-fire',
    ],
  },
  {
    id: 'warrior-stoneguard',
    name: 'Stoneguard',
    description: 'Stack armor, then earth-forged blows that strike harder the higher your wall.',
    // Pure armor-bruiser: warrior earth cards have no slow/stun, so this is a
    // wall that scales offense off armor (Granite Lunge +1/4 armor, Bramble
    // Pierce >=10 armor), not a control deck.
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
    description: 'Bleed the foe and bleed yourself — every wound you take sharpens the counter.',
    // Self-harm (Bloodprice HP loss + Bloodtide self-bleed) keeps the Vengeance
    // window open for Sidestep/Hollow Echo; Bloodtide heals back the cost.
    cardIds: [
      't2-counter-counter',
      't2-attack-counter',
      't2-agility-counter',
      't2-air-counter',
      't2-counter-water',
    ],
  },
];

export const MAGE_TEMPLATES: DeckTemplate[] = [
  {
    id: 'mage-pyromancer',
    name: 'Pyromancer',
    description: 'Stack burn on the enemy and consume it for explosive damage.',
    // Kindle/Magma/Firestorm pile burn BEFORE Pyre, so Pyre detonates a full
    // stack each rotation (it sat first previously and consumed nothing turn 1);
    // Steam Surge then punishes the leftover burn.
    cardIds: [
      't2-attack-fire',
      't2-earth-fire',
      't2-air-fire',
      't2-fire-fire',
      't2-fire-water',
    ],
  },
  {
    id: 'mage-frostbinder',
    name: 'Frostbinder',
    description: 'Heal, freeze, and stall — drown the enemy in cold water.',
    // Mist Step replaces Crimson Tithe (which gave a mage only dead Rage): it
    // adds Slow + heal, so the deck actually freezes AND stalls.
    cardIds: [
      't2-water-water',
      't2-fire-water',
      't2-air-water',
      't2-earth-water',
      't2-agility-water',
    ],
  },
  {
    id: 'mage-stormcaller',
    name: 'Stormcaller',
    description: 'Air-driven haste and multi-strike, no card sits still for long.',
    // Gale Cut replaces Bedrock Snare (a control card whose stun/slow clauses
    // could never fire here). Firestorm sits early so its 4s window catches the
    // haste-accelerated flurry of follow-up cards.
    cardIds: [
      't2-air-air',
      't2-air-fire',
      't2-air-attack',
      't2-agility-air',
      't2-air-water',
    ],
  },
  {
    id: 'mage-earthwarden',
    name: 'Earthwarden',
    description: 'Stun, slow, and elemental armor — set the pace, then crush it.',
    // Bedrock Snare follows Tremor Lock so the slow->stun combo (Tremor's 4
    // Slow feeds Bedrock's ">=4 Slow -> Stun") fires every rotation.
    cardIds: [
      't2-earth-earth',
      't2-air-earth',
      't2-earth-fire',
      't2-earth-water',
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
    // Tremor Lock -> Bedrock Snare adjacency drives the slow->stun lock;
    // Frostbind adds a second stun source and Misting Veil/Mire Bloom sustain.
    cardIds: [
      't2-earth-earth',
      't2-air-earth',
      't2-water-water',
      't2-earth-water',
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
