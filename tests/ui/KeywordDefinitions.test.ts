import { describe, it, expect } from 'vitest';
import {
  KEYWORD_DEFINITIONS,
  detectKeywords,
} from '../../src/ui/KeywordDefinitions';

// Post-audit (CARD_AUDIT.md §11.E): the glossary now ships exactly four
// keywords. All former stack/stat keywords and most modifier keywords were
// dropped — their mechanics are rendered as prose or icon tokens directly
// in card text now. The tests below pin that contract.

describe('KeywordDefinitions', () => {
  describe('KEYWORD_DEFINITIONS', () => {
    it('ships exactly the 4 kept keywords (Brace, Vengeance, Haste, Exhaust)', () => {
      const expected = ['Brace', 'Exhaust', 'Haste', 'Vengeance'];
      const keywords = KEYWORD_DEFINITIONS.map((d) => d.keyword).sort();
      expect(keywords).toEqual(expected);
      // No duplicates in the source of truth
      expect(new Set(keywords).size).toBe(keywords.length);
    });

    it('every kept entry is a modifier', () => {
      for (const def of KEYWORD_DEFINITIONS) {
        expect(def.category).toBe('modifier');
      }
    });

    it('every definition is non-empty', () => {
      for (const def of KEYWORD_DEFINITIONS) {
        expect(def.definition.length).toBeGreaterThan(0);
      }
    });
  });

  describe('detectKeywords()', () => {
    it('detects Brace as a standalone word', () => {
      const hits = detectKeywords('Brace: gain bonus armor.');
      expect(hits.map((h) => h.keyword)).toContain('Brace');
    });

    it('detects Vengeance, Haste, and Exhaust', () => {
      const hits = detectKeywords('Exhaust. Vengeance: gain Haste 20% for 4s.');
      const keywords = hits.map((h) => h.keyword);
      expect(keywords).toContain('Vengeance');
      expect(keywords).toContain('Haste');
      expect(keywords).toContain('Exhaust');
    });

    it('does NOT detect dropped keywords like Burn / Bleed', () => {
      const hits = detectKeywords('Apply 3 Burn. Then Bleed the target.');
      const keywords = hits.map((h) => h.keyword);
      expect(keywords).not.toContain('Burn');
      expect(keywords).not.toContain('Bleed');
    });

    it('does NOT detect Brace inside "Bracelet"', () => {
      const hits = detectKeywords('A shiny Bracelet drops.');
      expect(hits.map((h) => h.keyword)).not.toContain('Brace');
    });

    it('does NOT detect Haste inside "Hasten"', () => {
      const hits = detectKeywords('Hasten the fall.');
      expect(hits.map((h) => h.keyword)).not.toContain('Haste');
    });

    it('deduplicates a keyword that appears multiple times', () => {
      const hits = detectKeywords('Exhaust. Then Exhaust again. Final Exhaust.');
      const count = hits.filter((h) => h.keyword === 'Exhaust').length;
      expect(count).toBe(1);
    });

    it('orders results alphabetically within the modifier category', () => {
      // All kept entries are modifiers, so ordering reduces to alphabetical.
      const desc = 'Vengeance: Brace. Then Haste. Finally Exhaust.';
      const hits = detectKeywords(desc);
      const keywords = hits.map((h) => h.keyword);
      expect(keywords).toEqual(['Brace', 'Exhaust', 'Haste', 'Vengeance']);
    });

    it('returns empty array when no keywords present', () => {
      expect(detectKeywords('A boring description.')).toEqual([]);
    });

    it('returns empty array for empty / falsy input', () => {
      expect(detectKeywords('')).toEqual([]);
    });

    it('is case-sensitive on first letter (does not match "brace")', () => {
      const hits = detectKeywords('brace yourself.');
      expect(hits.map((h) => h.keyword)).not.toContain('Brace');
    });

    it('matches keywords adjacent to punctuation', () => {
      const hits = detectKeywords('Brace, Vengeance; and Haste.');
      const keywords = hits.map((h) => h.keyword);
      expect(keywords).toContain('Brace');
      expect(keywords).toContain('Vengeance');
      expect(keywords).toContain('Haste');
    });
  });
});
