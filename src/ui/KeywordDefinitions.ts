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
    definition: "While active, the enemy takes 2 damage per tick. Stacks don't decay -- they accumulate as ammunition for Pyre cards.",
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
    keyword: 'Berserk',
    category: 'modifier',
    definition: "Bonus effect scales per Rage stack on the hero.",
  },
  {
    keyword: 'Brace',
    category: 'modifier',
    definition: "Bonus effect triggers when the hero's armor is broken.",
  },
  {
    keyword: 'Consume',
    category: 'modifier',
    definition: "Spends N stacks of the named status to enable an effect.",
  },
  {
    keyword: 'Drain',
    category: 'modifier',
    definition: "Hero heals for a portion of damage dealt.",
  },
  {
    keyword: 'Empowered',
    category: 'modifier',
    definition: "Bonus effect triggers if the named condition is met (e.g. Empowered (if Burn): +X). Does NOT consume stacks.",
  },
  {
    keyword: 'Expose',
    category: 'modifier',
    definition: "Reduces enemy armor or defense.",
  },
  {
    keyword: 'Fortified',
    category: 'modifier',
    definition: "Bonus effect triggers if the hero has Armor.",
  },
  {
    keyword: 'Guard',
    category: 'modifier',
    definition: "Percentage chance to trigger a bonus effect on a defensive event.",
  },
  {
    keyword: 'Haste',
    category: 'modifier',
    definition: "Reduces hero card cooldowns by % for a duration.",
  },
  {
    keyword: 'Pierce',
    category: 'modifier',
    definition: "Damage ignores enemy armor.",
  },
  {
    keyword: 'Pyre',
    category: 'modifier',
    definition: "Damage = value x current Burn stacks. Consumes ALL Burn stacks when resolved.",
  },
  {
    keyword: 'Steady',
    category: 'modifier',
    definition: "Bonus effect triggers if the hero did NOT take damage since the last card.",
  },
  {
    keyword: 'Taunt',
    category: 'modifier',
    definition: "Forces enemy to focus on the hero (placeholder -- currently no AI impact).",
  },
  {
    keyword: 'Vengeance',
    category: 'modifier',
    definition: "Bonus effect triggers if the hero took damage since the last card.",
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
