// KeywordDefinitions -- single source of truth for combat keyword glossary.
//
// Used by KeywordTooltip to surface plain-English definitions of any
// combat keyword present in a card description. Definitions are written
// to reflect the actual behaviour implemented in src/systems/ (Stack/Shard
// /Element systems) so the player can spot-check by reading the engine.

export type KeywordCategory = 'stack' | 'modifier' | 'stat';

export interface KeywordDef {
  keyword: string;
  category: KeywordCategory;
  definition: string;
}

// Order within each category is alphabetical so the final list (stack ->
// modifier -> stat) is deterministic without sorting at runtime.
export const KEYWORD_DEFINITIONS: KeywordDef[] = [
  // Stack types ----------------------------------------------------------
  {
    keyword: 'Bleed',
    category: 'stack',
    definition: "Deals damage per tick equal to stacks. Doubled if the enemy attacked since the last tick. Stacks decay -1 per tick.",
  },
  {
    keyword: 'Burn',
    category: 'stack',
    definition: "While at least 1 stack is active, the enemy takes a fixed 2 damage per tick. Stacks do NOT decay — they accumulate as ammunition for Pyre detonators. The N in 'Burn N' counts how much ammo you applied, not the per-tick damage.",
  },
  {
    keyword: 'Poison',
    category: 'stack',
    definition: "Deals damage per tick equal to stacks. Stacks decay every 2nd tick (long-lasting DoT).",
  },
  {
    keyword: 'Rage',
    category: 'stack',
    definition: "A self-stack on the hero. Consumed by Berserk/Consume cards for bonus effects.",
  },
  {
    keyword: 'Slow',
    category: 'stack',
    definition: "Slows enemy attack cooldown by 8% per stack (cap 50%). Also deals stacks damage per tick. Stacks decay -1 per tick.",
  },
  {
    keyword: 'Stun',
    category: 'stack',
    definition: "While at least 1 stack is active, enemy cannot attack. Stacks decay -1 per tick. No damage.",
  },

  // Modifier keywords ----------------------------------------------------
  {
    keyword: 'Aura',
    category: 'modifier',
    definition: "A time-limited effect that stays on the bearer for N seconds. May tick periodically or arm a trigger; expires automatically.",
  },
  {
    keyword: 'Berserk',
    category: 'modifier',
    definition: "Bonus effect scales per Rage stack on the hero, OR triggers when hero's HP is below the listed % (e.g. Berserk (<50% HP)).",
  },
  {
    keyword: 'Bloodforge',
    category: 'modifier',
    definition: "Bonus effect fires each tick the hero suffers a self-applied DoT (Self Burn / Self Bleed).",
  },
  {
    keyword: 'Brace',
    category: 'modifier',
    definition: "Bonus effect triggers when the hero's armor is broken (depleted from above 0 to 0).",
  },
  {
    keyword: 'Cascade',
    category: 'modifier',
    definition: "Effect fires when the hero kills an enemy that was carrying the named stack.",
  },
  {
    keyword: 'Catalyze',
    category: 'modifier',
    definition: "Multiplies the current stacks of a named status on the target by a factor (e.g. Catalyze x2: doubles Poison).",
  },
  {
    keyword: 'Channel',
    category: 'modifier',
    definition: "The card requires a warm-up time before it activates, or its damage scales the longer the card slot waited past readiness.",
  },
  {
    keyword: 'Consume',
    category: 'modifier',
    definition: "Spends N stacks of the named status to enable an effect.",
  },
  {
    keyword: 'Convert',
    category: 'modifier',
    definition: "Spends N stacks of one status on the target to apply stacks of another status (e.g. Convert 3 Burn into Bleed).",
  },
  {
    keyword: 'Devour',
    category: 'modifier',
    definition: "Permanently removes one card slot from your deck for the remainder of this combat in exchange for a strong payoff.",
  },
  {
    keyword: 'DR',
    category: 'modifier',
    definition: "Damage Reduction — incoming damage to the hero is reduced by the listed percentage while the effect is active.",
  },
  {
    keyword: 'Drain',
    category: 'modifier',
    definition: "Hero heals for a portion of damage dealt.",
  },
  {
    keyword: 'Echo',
    category: 'modifier',
    definition: "The next N card resolutions repeat once, or the card re-applies its own effect after a short delay.",
  },
  {
    keyword: 'Empower',
    category: 'modifier',
    definition: "Aura that increases the hero's damage dealt by the listed % for the duration. Distinct from Empowered (a conditional trigger).",
  },
  {
    keyword: 'Empowered',
    category: 'modifier',
    definition: "Bonus effect triggers if the named condition is met (e.g. Empowered (if Burn): +X). Does NOT consume stacks.",
  },
  {
    keyword: 'Exhaust',
    category: 'modifier',
    definition: "The card can only resolve once per combat. After firing, the slot is disabled until next combat.",
  },
  {
    keyword: 'Expose',
    category: 'modifier',
    definition: "Reduces the enemy's Defense by the listed amount for the duration of the aura.",
  },
  {
    keyword: 'Fortified',
    category: 'modifier',
    definition: "Bonus effect triggers if the hero's current armor is at least the listed amount (e.g. Fortified 10: +6 Pierce).",
  },
  {
    keyword: 'Frost Echo',
    category: 'modifier',
    definition: "Effect fires each time the hero applies a Slow stack to an enemy.",
  },
  {
    keyword: 'Guard',
    category: 'modifier',
    definition: "Bonus effect triggers when the hero's HP drops below the listed % (e.g. Guard 50%: Armor 18).",
  },
  {
    keyword: 'Haste',
    category: 'modifier',
    definition: "Reduces hero card cooldowns by % for a duration.",
  },
  {
    keyword: 'Juggernaut',
    category: 'modifier',
    definition: "Effect fires when the hero gains Armor (optionally requires at least N gained at once).",
  },
  {
    keyword: 'Mitigate',
    category: 'modifier',
    definition: "Reduces incoming damage to the hero by the listed % for the duration.",
  },
  {
    keyword: 'On Hit',
    category: 'modifier',
    definition: "Effect re-fires each time the hero lands a damaging hit for the listed duration.",
  },
  {
    keyword: 'Overload',
    category: 'modifier',
    definition: "Powerful effect with a penalty: the card slot adds extra seconds to its next cooldown, or requires consuming stacks of a resource.",
  },
  {
    keyword: 'Pierce',
    category: 'modifier',
    definition: "Damage ignores enemy armor.",
  },
  {
    keyword: 'Pyre',
    category: 'modifier',
    definition: "Damage = value × current Burn stacks on the target. Consumes ALL Burn stacks when resolved.",
  },
  {
    keyword: 'Reflex',
    category: 'modifier',
    definition: "Effect fires every time the hero is hit, regardless of whether armor absorbed it. Persists for the aura's duration.",
  },
  {
    keyword: 'Reforce',
    category: 'modifier',
    definition: "While active, all Armor the hero gains is multiplied or has a flat bonus added (e.g. Reforce +50% Armor gained).",
  },
  {
    keyword: 'Rupture',
    category: 'modifier',
    definition: "Effect fires when the hero takes self-inflicted damage (HP-cost cards or Self DoT ticks).",
  },
  {
    keyword: 'Shatter',
    category: 'modifier',
    definition: "Bonus effect triggers when the enemy is currently Stunned.",
  },
  {
    keyword: 'Siphon',
    category: 'modifier',
    definition: "Hero heals for the listed % of damage dealt by this attack (capped at 50% of max HP per hit).",
  },
  {
    keyword: 'Spread',
    category: 'modifier',
    definition: "A fraction of the applied status is replicated onto nearby targets.",
  },
  {
    keyword: 'Stance',
    category: 'modifier',
    definition: "A passive aura on the hero that modifies subsequent actions for its duration (e.g. Stance 8s: hits +1 per Rage).",
  },
  {
    keyword: 'Steady',
    category: 'modifier',
    definition: "Bonus effect triggers while the hero's HP is at or above the listed %.",
  },
  {
    keyword: 'Strip',
    category: 'modifier',
    definition: "While active, the hero ignores the enemy's immunity to the named stack.",
  },
  {
    keyword: 'Threshold',
    category: 'modifier',
    definition: "Effect arms once the named enemy stack reaches the listed count (e.g. Threshold Slow ≥ 5).",
  },
  {
    keyword: 'Vengeance',
    category: 'modifier',
    definition: "Bonus effect triggers if the hero took HP damage within the last 2 seconds. Self-Burn/Bleed and unarmored hits enable this naturally.",
  },
  {
    keyword: 'Vulnerable',
    category: 'modifier',
    definition: "Target takes increased damage of the listed type or amount for the duration.",
  },
  {
    keyword: 'Weakened',
    category: 'modifier',
    definition: "While active, the hero's outgoing damage is reduced by the listed %.",
  },

  // Stat keywords --------------------------------------------------------
  {
    keyword: 'Armor',
    category: 'stat',
    definition: "Adds a damage-absorbing layer that depletes before HP.",
  },
  {
    keyword: 'Heal',
    category: 'stat',
    definition: "Restores HP to the target.",
  },
  {
    keyword: 'Scales',
    category: 'stat',
    definition: "Effect value increases with a hero stat (STR/DEX/VIT/etc).",
  },
];

const CATEGORY_ORDER: Record<KeywordCategory, number> = {
  stack: 0,
  modifier: 1,
  stat: 2,
};

/**
 * Detect all combat keywords present in `description`. Matches each
 * keyword as a standalone word (word boundaries on both sides), so
 * "Burning" does NOT match "Burn". Case-sensitive on the first letter
 * (only the canonical capitalisation counts).
 *
 * Returns each keyword at most once, sorted by category (stack ->
 * modifier -> stat) then alphabetically within category.
 */
export function detectKeywords(description: string): KeywordDef[] {
  if (!description) return [];
  const seen = new Set<string>();
  const hits: KeywordDef[] = [];
  for (const def of KEYWORD_DEFINITIONS) {
    if (seen.has(def.keyword)) continue;
    // \b is the standard JS word boundary -- matches the transition
    // between [A-Za-z0-9_] and non-word chars, which correctly excludes
    // suffixes like "Burning" / "Bleeds" while allowing punctuation/space
    // boundaries. The keyword itself contains only letters, so escaping
    // is unnecessary.
    const re = new RegExp(`\\b${def.keyword}\\b`);
    if (re.test(description)) {
      seen.add(def.keyword);
      hits.push(def);
    }
  }
  hits.sort((a, b) => {
    const c = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (c !== 0) return c;
    return a.keyword.localeCompare(b.keyword);
  });
  return hits;
}
