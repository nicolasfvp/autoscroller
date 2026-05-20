import { describe, it, expect } from 'vitest';
import {
  KEYWORD_DEFINITIONS,
  detectKeywords,
} from '../../src/ui/KeywordDefinitions';

describe('KeywordDefinitions', () => {
  describe('KEYWORD_DEFINITIONS', () => {
    it('includes every spec keyword exactly once', () => {
      const expected = [
        // Stack types
        'Burn', 'Bleed', 'Poison', 'Slow', 'Stun', 'Rage',
        // Modifier keywords
        'Pyre', 'Empowered', 'Vengeance', 'Steady', 'Fortified', 'Brace',
        'Guard', 'Berserk', 'Haste', 'Expose', 'Pierce', 'Consume',
        'Drain', 'Taunt',
        // Stat keywords
        'Heal', 'Armor', 'Scales',
      ];
      const keywords = KEYWORD_DEFINITIONS.map(d => d.keyword);
      for (const k of expected) {
        expect(keywords).toContain(k);
      }
      // No duplicates in the source of truth
      expect(new Set(keywords).size).toBe(keywords.length);
    });

    it('every definition is non-empty', () => {
      for (const def of KEYWORD_DEFINITIONS) {
        expect(def.definition.length).toBeGreaterThan(0);
      }
    });
  });

  describe('detectKeywords()', () => {
    it('detects Burn as a standalone word', () => {
      const hits = detectKeywords('Apply 3 Burn to the enemy.');
      expect(hits.map(h => h.keyword)).toContain('Burn');
    });

    it('does NOT detect Burn inside "Burning"', () => {
      const hits = detectKeywords('The Burning forest crackles.');
      expect(hits.map(h => h.keyword)).not.toContain('Burn');
    });

    it('does NOT detect Bleed inside "Bleeds"', () => {
      // Bleeds has Bleed as prefix; word boundary should reject it.
      const hits = detectKeywords('Target Bleeds heavily.');
      expect(hits.map(h => h.keyword)).not.toContain('Bleed');
    });

    it('deduplicates a keyword that appears multiple times', () => {
      const hits = detectKeywords('Burn the target. Then Burn again. Final Burn.');
      const burnCount = hits.filter(h => h.keyword === 'Burn').length;
      expect(burnCount).toBe(1);
    });

    it('orders results: stack -> modifier -> stat, alphabetical within each', () => {
      const desc = 'Scales with STR. Apply Burn, then Pyre. Also Heal and Bleed.';
      const hits = detectKeywords(desc);
      const keywords = hits.map(h => h.keyword);
      // Expected ordering for the detected subset:
      //   stack:    Bleed, Burn   (alphabetical)
      //   modifier: Pyre
      //   stat:     Heal, Scales  (alphabetical)
      expect(keywords).toEqual(['Bleed', 'Burn', 'Pyre', 'Heal', 'Scales']);
    });

    it('returns empty array when no keywords present', () => {
      expect(detectKeywords('A boring description.')).toEqual([]);
    });

    it('returns empty array for empty / falsy input', () => {
      expect(detectKeywords('')).toEqual([]);
    });

    it('is case-sensitive on first letter (does not match "burn")', () => {
      const hits = detectKeywords('burn the candle.');
      expect(hits.map(h => h.keyword)).not.toContain('Burn');
    });

    it('matches keywords adjacent to punctuation', () => {
      const hits = detectKeywords('Apply Burn, Bleed; and Poison.');
      const keywords = hits.map(h => h.keyword);
      expect(keywords).toContain('Burn');
      expect(keywords).toContain('Bleed');
      expect(keywords).toContain('Poison');
    });
  });
});
