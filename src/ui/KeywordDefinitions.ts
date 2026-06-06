// KeywordDefinitions -- single source of truth for combat keyword glossary.
//
// Used by KeywordTooltip to surface plain-English definitions of any
// combat keyword present in a card description. Definitions are written
// to reflect the actual behaviour implemented in src/systems/ (Stack/Shard
// /Element systems) so the player can spot-check by reading the engine.
//
// Post-audit (CARD_AUDIT.md §11.E): the glossary ships five modifier
// keywords (Brace, Exhaust, Haste, Pierce, Vengeance) — the four kept
// post-audit keywords plus Pierce, re-added so the armor-bypassing
// "Pierce" damage word that CardText still emits has a definition (it
// reads like Brace/Vengeance but had no entry, leaving players unable to
// learn it). All other former entries are dropped — those mechanics are
// now rendered as prose or icon tokens directly in card text. The
// `KeywordCategory` type still includes 'stack' and 'stat' even though no
// entries use them, so consumers that switch on the union don't need a
// churn change.

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
    definition: "Triggers its bonus when your [armor] breaks (drops to 0).",
  },
  {
    keyword: 'Exhaust',
    category: 'modifier',
    definition: "This card only gets played once per combat.",
  },
  {
    keyword: 'Haste',
    category: 'modifier',
    definition: "Lowers your card cooldowns by the shown % for a few seconds.",
  },
  {
    keyword: 'Pierce',
    category: 'modifier',
    definition: "Damage that ignores [armor] and hits [HP] directly.",
  },
  {
    keyword: 'Vengeance',
    category: 'modifier',
    definition: "Triggers its bonus if you lost [HP] in the last 2 seconds.",
  },
];

// ── Token glossary (stacks + stats) ────────────────────────────────────
//
// Separate from KEYWORD_DEFINITIONS on purpose: the five modifier keywords
// are *detected inside card text* (and feed synergy detection via
// detectKeywords), while the entries below are the colored TOKENS the engine
// renders as combat chips (🔥 Burn, 😡 Rage, STR/VIT/…). They never need to be
// detected in prose, so they live in their own always-visible reference list
// surfaced by the glossary panel.
//
// Definitions mirror the live engine so a player can spot-check them:
//   - Stacks: src/systems/combat/CombatEngine.ts (tickActiveDoTs) +
//     src/systems/combat/StatusEffects.ts + EnemyAI cooldown handling.
//   - Stats: src/systems/hero/HeroStatsResolver.ts + CardResolver damage/heal.
export const TOKEN_GLOSSARY: KeywordDef[] = [
  // Stacks --------------------------------------------------------------
  {
    keyword: 'Burn',
    category: 'stack',
    definition: 'Fire damage-over-time on the enemy. Each combat tick deals damage equal to the stack count (capped around 8/tick). Burn does NOT decay on its own — it stays until a Pyre/detonator card consumes it. INT-scaled cards apply more Burn.',
  },
  {
    keyword: 'Bleed',
    category: 'stack',
    definition: 'Physical damage-over-time on the enemy. Each tick deals 1 per stack — or 2 per stack if the enemy attacked since the last tick — then loses 1 stack. Rewards aggressive, fast-swinging fights. DEX-scaled cards apply more Bleed.',
  },
  {
    keyword: 'Poison',
    category: 'stack',
    definition: 'Lingering damage-over-time on the enemy. Each tick deals damage equal to the stack count and the stack decays slowly (about 1 every other tick), so it out-lasts Bleed. INT-scaled cards apply more Poison.',
  },
  {
    keyword: 'Stun',
    category: 'stack',
    definition: 'Crowd control on the enemy. While any Stun stacks remain, the enemy’s attack cooldown is frozen so it cannot act. Deals no damage; loses 1 stack each tick. INT-scaled cards apply more Stun.',
  },
  {
    keyword: 'Slow',
    category: 'stack',
    definition: 'Soft crowd control on the enemy. Slows the enemy’s attack cooldown (about 8% per stack, capped near 50%) and deals a small tick of damage equal to the stack count; loses 1 stack each tick.',
  },
  {
    keyword: 'Rage',
    category: 'stack',
    definition: 'A self stack on the hero. Does no damage by itself — instead it powers Berserk effects and detonators that scale with or spend your current Rage. Persists across the fight until a card consumes it.',
  },
  {
    keyword: 'Armor',
    category: 'stack',
    definition: 'Temporary defense on the hero. Absorbs incoming damage before it reaches HP. Spent down as you take hits; some cards spend or convert it. Brace effects fire when your Armor breaks (drops from above 0 to 0). VIT boosts armor gained.',
  },
  // Stats ---------------------------------------------------------------
  {
    keyword: 'Strength',
    category: 'stat',
    definition: 'STR. A global damage multiplier: card damage is multiplied by ~1 + (STR−1) × 0.25 (STR 1 = baseline, 4 = +75%, 10 = +225%). Lifts every attack you play.',
  },
  {
    keyword: 'Dexterity',
    category: 'stat',
    definition: 'DEX. Governs the Agility line and Bleed scaling — DEX-tagged cards apply more Bleed and convert/scale more efficiently the higher your DEX.',
  },
  {
    keyword: 'Intellect',
    category: 'stat',
    definition: 'INT. Powers the magic line — INT-tagged cards apply more Burn, Poison and Stun, and several spells add flat damage per point of INT.',
  },
  {
    keyword: 'Vitality',
    category: 'stat',
    definition: 'VIT. Boosts your survivability: raises Max HP (about +5 HP per point) and increases the Armor your defense cards grant.',
  },
  {
    keyword: 'Spirit',
    category: 'stat',
    definition: 'SPI. Amplifies healing received — every heal is increased by 15% per point of SPI.',
  },
];

/** Bracketed-token / abbreviation aliases -> canonical TOKEN_GLOSSARY keyword. */
const TOKEN_ALIASES: Record<string, string> = {
  // stat abbreviations
  str: 'Strength',
  dex: 'Dexterity',
  int: 'Intellect',
  vit: 'Vitality',
  spi: 'Spirit',
  strength: 'Strength',
  dexterity: 'Dexterity',
  intellect: 'Intellect',
  vitality: 'Vitality',
  spirit: 'Spirit',
  // stacks (full names; HP/armor synonyms)
  burn: 'Burn',
  bleed: 'Bleed',
  poison: 'Poison',
  stun: 'Stun',
  slow: 'Slow',
  rage: 'Rage',
  armor: 'Armor',
};

const TOKEN_INDEX: Map<string, KeywordDef> = new Map(
  TOKEN_GLOSSARY.map((d) => [d.keyword.toLowerCase(), d]),
);

/**
 * Resolve a token name to its TOKEN_GLOSSARY definition. Accepts bracketed
 * forms (`[burn]`), abbreviations (`str`, `STR`), and full names
 * (`Strength`); case-insensitive. Returns undefined for unknown tokens.
 */
export function lookupToken(token: string): KeywordDef | undefined {
  if (!token) return undefined;
  const cleaned = token.trim().replace(/^\[+/, '').replace(/\]+$/, '').trim().toLowerCase();
  if (!cleaned) return undefined;
  const canonical = TOKEN_ALIASES[cleaned];
  if (canonical) return TOKEN_INDEX.get(canonical.toLowerCase());
  return TOKEN_INDEX.get(cleaned);
}

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
