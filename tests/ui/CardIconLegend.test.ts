import { describe, it, expect } from 'vitest';
import {
  BRIEF_ICON_DEFINITIONS,
  collectCardIcons,
} from '../../src/ui/CardIconLegend';
import { TOKEN_STYLES } from '../../src/ui/IconTokens';
import type { CardDefinition } from '../../src/data/types';

// Minimal CardDefinition builder — collectCardIcons only reads cost, elements,
// effects, exhaust, spend_armor and the upgraded overrides. Loosely typed so
// test fixtures can omit fields (e.g. effect `target`) the collector ignores.
function card(partial: Record<string, unknown>): CardDefinition {
  return partial as unknown as CardDefinition;
}

describe('BRIEF_ICON_DEFINITIONS', () => {
  it('every id is a renderable token in TOKEN_STYLES', () => {
    for (const id of Object.keys(BRIEF_ICON_DEFINITIONS)) {
      expect(TOKEN_STYLES, `missing token style for "${id}"`).toHaveProperty(id);
    }
  });

  it('every definition is a non-empty sentence', () => {
    for (const [id, def] of Object.entries(BRIEF_ICON_DEFINITIONS)) {
      expect(def.length, id).toBeGreaterThan(0);
      expect(def.trim().endsWith('.'), `${id} should end with a period`).toBe(true);
    }
  });
});

describe('collectCardIcons()', () => {
  it('lists cost, then description tokens in reading order', () => {
    const c = card({
      cost: { stamina: 1 },
      effects: [{ type: 'dot', stack: 'burn', value: 2, scale: { stat: 'int', per: 1, value: 1 } }],
    });
    expect(collectCardIcons(c)).toEqual(['stam', 'burn', 'int']);
  });

  it('ignores element gems (elements are not taught by this subtitle)', () => {
    const c = card({ elements: ['fire', 'water', 'earth'], effects: [] });
    expect(collectCardIcons(c)).toEqual([]);
  });

  it('never includes the Exhaust keyword (handled by the keyword tooltip)', () => {
    const c = card({
      exhaust: true,
      cost: { stamina: 1 },
      effects: [{ type: 'damage', value: 6 }],
    });
    expect(collectCardIcons(c)).not.toContain('exhaust');
  });

  it('picks a single primary cost icon (stamina > mana > defense)', () => {
    const c = card({ cost: { stamina: 2, mana: 1 }, effects: [] });
    expect(collectCardIcons(c)).toEqual(['stam']);
  });

  it('deduplicates an icon that is both a cost and named in the prose', () => {
    const c = card({
      cost: { mana: 2 },
      effects: [{ type: 'mana', value: 3 }], // "Gain 3[mana]"
    });
    expect(collectCardIcons(c)).toEqual(['mana']);
  });

  it('returns an empty list for a card with no explainable icons', () => {
    expect(collectCardIcons(card({ effects: [] }))).toEqual([]);
  });

  it('only ever returns ids that have a brief definition', () => {
    const c = card({
      cost: { stamina: 1 },
      elements: ['fire', 'water'],
      effects: [
        { type: 'damage', value: 7, scale: { stat: 'str', per: 1, value: 1 } },
        { type: 'armor', value: 5 },
        { type: 'heal', value: 3, scale: { stat: 'spi', per: 1, value: 1 } },
      ],
    });
    for (const id of collectCardIcons(c)) {
      expect(BRIEF_ICON_DEFINITIONS).toHaveProperty(id);
    }
  });

  it('honors the upgraded cost/effects when isUpgraded is true', () => {
    const c = card({
      cost: { stamina: 1 },
      effects: [{ type: 'damage', value: 7, scale: { stat: 'str', per: 1, value: 1 } }],
      upgraded: {
        cost: { mana: 1 },
        effects: [{ type: 'heal', value: 5, scale: { stat: 'spi', per: 1, value: 1 } }],
      },
    });
    expect(collectCardIcons(c, false)).toEqual(['stam', 'str']);
    expect(collectCardIcons(c, true)).toEqual(['mana', 'spi']);
  });
});
