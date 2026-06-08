// CardIconLegend -- brief, one-line explanations for every icon a full card
// can display, plus a collector that lists (in reading order) the icons present
// on a given card.
//
// Consumed by CardIconSubtitle: the rotating bottom-of-screen caption that
// teaches the icons on whatever full card is currently shown. The definitions
// here are deliberately SHORT (a single predicate clause) — the long-form
// reference lives in KeywordDefinitions (TOKEN_GLOSSARY / KEYWORD_DEFINITIONS)
// and the glossary modal. Keep both in sync with the live engine.
//
// Each entry is written as a predicate that reads naturally after the icon
// glyph the caption renders in front of it, e.g. the caption builds
// "[burn] " + "deals damage over time …" so the icon IS the subject.
//
// Every key MUST also be a recognized token in IconTokens.TOKEN_STYLES so the
// caption can render its colored glyph; a test enforces this.

import { formatCardDescription } from '../systems/cards/CardText';
import { tokenizeText } from './IconTokens';
import type { CardDefinition } from '../data/types';

/** token id (lowercase) -> brief predicate clause (no leading subject). */
export const BRIEF_ICON_DEFINITIONS: Record<string, string> = {
  // ── Resource costs (header primary slot) ───────────────────────────────
  stam: 'is the energy most physical cards spend to be played.',
  mana: 'is the energy most magic cards spend to be played.',

  // ── Stacks (status chips) ──────────────────────────────────────────────
  burn: 'deals fire damage over time and can be detonated by some cards. Scales with [int].',
  bleed: 'deals damage over time, harder while the enemy attacks. Scales with [dex].',
  poison: 'deals slow-decaying damage over time. Scales with [int].',
  slow: "lengthens the enemy's attack cooldown and chips small damage.",
  stun: "freezes the enemy's attacks while any stacks remain.",
  rage: 'is a stack you build to power Berserk effects and detonators.',
  armor: 'absorbs incoming damage before it reaches your [HP].',
  hp: 'is your health — the run ends if it reaches 0.',

  // ── Stats (scaling axes) ───────────────────────────────────────────────
  str: 'boosts the damage of every attack you play.',
  vit: 'raises your Max [HP] and the [armor] your cards grant.',
  dex: 'lowers card cooldowns and boosts [bleed].',
  int: 'boosts [burn], [poison], [stun] and spell damage.',
  spi: 'amplifies all the healing you receive.',
  // Note: elements (fire/water/…) and the Exhaust keyword are intentionally NOT
  // here — elements are excluded from this subtitle, and Exhaust is taught by
  // the keyword tooltip/glossary (KeywordDefinitions.KEYWORD_DEFINITIONS).
};

/**
 * List, in card reading order, every explainable icon present on `card`:
 *   1. the single primary cost icon (stamina > mana), as drawn in the header's
 *      primary slot;
 *   2. every recognized bracketed token in the card's description prose
 *      ([burn], [str], [armor], [HP], gained [mana]/[stam], …), in first
 *      appearance order.
 *
 * Element gems (fire/water/…) are deliberately excluded, and the Exhaust
 * keyword is left to the keyword tooltip — neither has a brief definition here.
 *
 * Deduplicated (an icon shown twice is taught once) and filtered to ids that
 * actually have a brief definition, so callers can cycle the result directly.
 *
 * `isUpgraded` selects the upgraded cost/effects when present, matching what
 * the upgraded card face renders.
 */
export function collectCardIcons(card: CardDefinition, isUpgraded = false): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined): void => {
    if (!raw) return;
    const id = raw.toLowerCase();
    if (!(id in BRIEF_ICON_DEFINITIONS)) return;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };

  // 1. Primary cost — the header shows exactly one resource icon.
  const cost = (isUpgraded && card.upgraded?.cost) ? card.upgraded.cost : card.cost;
  if (cost?.stamina) push('stam');
  else if (cost?.mana) push('mana');

  // 2. Description tokens. The non-dynamic formatting emits stat scalers as
  // "([str])" bracket tokens, so this also captures scaling axes referenced by
  // the prose. (Dynamic mode would instead emit [[v:N:stat]] value tokens, which
  // we don't want here — plain formatting is the stable source.)
  const effects = (isUpgraded && card.upgraded?.effects) ? card.upgraded.effects : card.effects;
  const desc = formatCardDescription({
    effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
  });
  for (const seg of tokenizeText(desc)) {
    if (seg.type === 'token') push(seg.token);
  }

  return out;
}
