// KeywordDefinitions -- single source of truth for combat keyword glossary.
//
// Used by KeywordTooltip to surface plain-English definitions of any
// combat keyword present in a card description. Definitions are written
// to reflect the actual behaviour implemented in src/systems/ (Stack/Shard
// /Element systems) so the player can spot-check by reading the engine.
//
// Post-audit (CARD_AUDIT.md §11.E): the glossary ships only the four
// kept keywords (Brace, Vengeance, Haste, Exhaust). All other former
// entries are dropped — those mechanics are now rendered as prose or
// icon tokens directly in card text. The `KeywordCategory` type still
// includes 'stack' and 'stat' even though no entries use them, so
// consumers that switch on the union don't need a churn change.

export type KeywordCategory = 'stack' | 'modifier' | 'stat';

export interface KeywordDef {
  keyword: string;
  category: KeywordCategory;
  definition: string;
}

// Order within each category is alphabetical so the final list (stack ->
// modifier -> stat) is deterministic without sorting at runtime.
export const KEYWORD_DEFINITIONS: KeywordDef[] = [
  // Modifier keywords ----------------------------------------------------
  {
    keyword: 'Brace',
    category: 'modifier',
    definition: "Bonus effect triggers when your [armor] is broken (depleted from above 0 to 0).",
  },
  {
    keyword: 'Exhaust',
    category: 'modifier',
    definition: "The card can only resolve once per combat. After firing, the slot is disabled until next combat.",
  },
  {
    keyword: 'Haste',
    category: 'modifier',
    definition: "Reduces your card cooldowns by the listed percentage for the listed duration.",
  },
  {
    keyword: 'Vengeance',
    category: 'modifier',
    definition: "Bonus effect triggers if you took [HP] damage within the last 2 seconds. Self-damage and unarmored hits enable this naturally.",
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
