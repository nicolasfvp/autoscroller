// Card description + integrity guard.
//
// Enforces the design contract (see card-text-verify.test.ts): every card's
// stored `description` must equal formatCardDescription(card) byte-for-byte,
// for both the base and upgraded forms. This is the "stricter snapshot check"
// that card-text-verify.test.ts anticipated — it stops reworks from leaving the
// stored text out of sync with the effects (the card face renders the generated
// text, so drift means the stored string lies to search / keyword-intro).
//
// Also asserts there are no structural integrity ERRORS in the effect data
// (unknown effect types, stack/stat ids, missing required fields, etc.).

import { describe, it, expect } from 'vitest';
import { formatCardDescription } from '../../src/systems/cards/CardText';
import cardsJson from '../../src/data/json/cards.json';
import type { CardDefinition, CardEffect } from '../../src/data/types';

const cards = cardsJson.cards as unknown as CardDefinition[];

const STATS = new Set(['str', 'vit', 'dex', 'int', 'spi']);
const STACKS = new Set(['poison', 'bleed', 'burn', 'stun', 'slow', 'rage']);
const EFFECT_TYPES = new Set([
  'damage', 'heal', 'armor', 'stamina', 'mana', 'debuff', 'buff', 'debuff_stat',
  'dot', 'stack', 'aura', 'cd_debt', 'convert_stack', 'multiply_stack',
  'stack_boost', 'devour', 'stat_gain',
]);
const TARGETS = new Set(['enemy', 'self', 'self_dot', 'aoe', 'enemy_nearest', 'self_deck']);

describe('card description guard — stored matches formatter', () => {
  it('every stored description equals formatCardDescription(card)', () => {
    const drift: string[] = [];
    for (const card of cards) {
      const base = formatCardDescription({ effects: card.effects, exhaust: card.exhaust, spend_armor: card.spend_armor });
      if (base && (card.description ?? '') !== base) {
        drift.push(`[${card.id}] stored "${card.description}" != generated "${base}"`);
      }
      if (card.upgraded?.description !== undefined) {
        const up = formatCardDescription({
          effects: card.upgraded.effects ?? card.effects,
          exhaust: card.exhaust,
          spend_armor: card.spend_armor,
        });
        if (up && card.upgraded.description !== up) {
          drift.push(`[${card.id} upgraded] stored "${card.upgraded.description}" != generated "${up}"`);
        }
      }
    }
    expect(drift).toEqual([]);
  });
});

describe('card effect integrity', () => {
  it('no structural integrity errors', () => {
    const errors: string[] = [];
    const seen = new Set<string>();

    const checkEffect = (card: CardDefinition, fx: CardEffect, path: string): void => {
      const e = (msg: string) => errors.push(`[${card.id}] ${path}: ${msg}`);
      if (!EFFECT_TYPES.has(fx.type)) e(`unknown effect type "${fx.type}"`);
      if (fx.target !== undefined && !TARGETS.has(fx.target)) e(`unknown target "${fx.target}"`);
      if (typeof fx.value !== 'number' || Number.isNaN(fx.value)) e(`value not a number (${fx.value})`);
      if (fx.type === 'dot' && !fx.stack) e('dot missing `stack`');
      if (fx.stack !== undefined && !STACKS.has(fx.stack)) e(`unknown stack "${fx.stack}"`);
      if (fx.type === 'stat_gain') {
        if (!fx.stat) e('stat_gain missing `stat`');
        else if (!STATS.has(fx.stat)) e(`stat_gain unknown stat "${fx.stat}"`);
      }
      if (fx.stat !== undefined && !STATS.has(fx.stat)) e(`unknown stat "${fx.stat}"`);
      if (fx.scale?.stat !== undefined && !STATS.has(fx.scale.stat)) e(`scale.stat unknown "${fx.scale.stat}"`);
      if (fx.scale?.stack !== undefined && !STACKS.has(fx.scale.stack)) e(`scale.stack unknown "${fx.scale.stack}"`);
      if (fx.type === 'convert_stack') {
        if (!fx.from) e('convert_stack missing `from`');
        else if (!STACKS.has(fx.from)) e(`convert_stack unknown from "${fx.from}"`);
        const toStr = String(fx.to ?? '');
        if (!fx.to) e('convert_stack missing `to`');
        else if (!STACKS.has(toStr) && toStr !== 'armor') e(`convert_stack unknown to "${toStr}"`);
      }
      if (fx.then) {
        const arr = Array.isArray(fx.then) ? fx.then : [fx.then];
        arr.forEach((sub, i) => checkEffect(card, sub, `${path}.then[${i}]`));
      }
    };

    for (const card of cards) {
      if (seen.has(card.id)) errors.push(`[${card.id}] duplicate id`);
      seen.add(card.id);
      for (const k of ['id', 'name', 'category', 'effects', 'cooldown', 'targeting'] as const) {
        if ((card as Record<string, unknown>)[k] === undefined) errors.push(`[${card.id}] missing required field "${k}"`);
      }
      (card.effects ?? []).forEach((fx, i) => checkEffect(card, fx, `effects[${i}]`));
    }

    expect(errors).toEqual([]);
  });
});
