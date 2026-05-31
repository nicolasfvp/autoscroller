// SynergyDetection -- detects whether a candidate card or relic synergizes
// with the player's current deck. Used by the Shop UI to apply
// a "glow" highlight on items that combo with what the player already runs.
//
// Rule (per beginner-mode spec):
//   - A card synergizes with the deck if it shares ≥1 keyword with ≥2 cards
//     already in the deck. So a single dot of Bleed in the deck doesn't
//     light up new Bleed cards yet — but as soon as the deck has 2 Bleed
//     cards, every new Bleed-bearing card glows.
//   - A relic synergizes the same way: extract keywords from its rendered
//     description and apply the same ≥2-deck-cards threshold.

import { detectKeywords } from '../../ui/KeywordDefinitions';
import type { CardDefinition } from '../../data/types';
import { formatCardDescription } from './CardText';

const SYNERGY_THRESHOLD = 2;

interface KeywordSource {
  description?: string;
  effects?: CardDefinition['effects'];
  exhaust?: boolean;
  spend_armor?: CardDefinition['spend_armor'];
}

/**
 * Combine the static description + the dynamic rendered description from
 * formatCardDescription so synergy detection picks up both author-written
 * keyword tags ("Vengeance", "Pyre") and engine-generated tags ("Scales
 * STR", "Burn N"). Mirrors the haystack assembly in CardFilterBar.applyFilters.
 */
function extractText(source: KeywordSource): string {
  const dyn = source.effects
    ? formatCardDescription({
        effects: source.effects,
        exhaust: source.exhaust,
        spend_armor: source.spend_armor,
      })
    : '';
  return `${source.description ?? ''} ${dyn}`.trim();
}

/**
 * Count how many cards in `deck` mention each keyword. Returns a Map keyed
 * by canonical keyword name. Cards without an `effects` field fall back to
 * just their description text.
 */
function deckKeywordCounts(deck: CardDefinition[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of deck) {
    const text = extractText(card);
    const kws = detectKeywords(text);
    // Dedupe within a single card: a card that mentions "Burn" twice still
    // counts as one Burn source for synergy purposes.
    const seen = new Set<string>();
    for (const kw of kws) {
      if (seen.has(kw.keyword)) continue;
      seen.add(kw.keyword);
      counts.set(kw.keyword, (counts.get(kw.keyword) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * True iff `card` shares at least one keyword with ≥ SYNERGY_THRESHOLD
 * cards already in `deck`. Cards in `deck` that are identical to `card`
 * (by id) are excluded from the count, so a card doesn't self-synergize
 * when the deck already contains a copy of it.
 */
export function cardSynergizesWithDeck(
  card: CardDefinition,
  deck: CardDefinition[],
): boolean {
  const cardText = extractText(card);
  const cardKws = detectKeywords(cardText);
  if (cardKws.length === 0) return false;

  const filteredDeck = deck.filter((d) => d.id !== card.id);
  const counts = deckKeywordCounts(filteredDeck);

  for (const kw of cardKws) {
    if ((counts.get(kw.keyword) ?? 0) >= SYNERGY_THRESHOLD) return true;
  }
  return false;
}

/**
 * Same rule as cards but driven by an arbitrary description string — used
 * for relics in the shop, where we don't have CardDefinition effects to
 * render dynamically. The caller supplies the relic's display description
 * directly.
 */
export function relicSynergizesWithDeck(
  relicDescription: string,
  deck: CardDefinition[],
): boolean {
  const kws = detectKeywords(relicDescription);
  if (kws.length === 0) return false;

  const counts = deckKeywordCounts(deck);
  for (const kw of kws) {
    if ((counts.get(kw.keyword) ?? 0) >= SYNERGY_THRESHOLD) return true;
  }
  return false;
}
