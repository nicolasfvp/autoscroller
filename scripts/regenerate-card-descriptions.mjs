#!/usr/bin/env node
// Bakes keyword-driven descriptions into cards.json so editor tooling and
// forge previews stay in sync with the in-game text. Mirrors the runtime
// formatter in src/systems/cards/CardText.ts — if you edit one, edit both.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsPath = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');

const STACK_NAME = { burn: 'Burn', bleed: 'Bleed', poison: 'Poison', shock: 'Shock', rage: 'Rage' };
const STAT_NAME = { str: 'STR', vit: 'VIT', dex: 'DEX', int: 'INT', spi: 'SPI' };

const stackName = (s) => s ? (STACK_NAME[s] ?? s) : '';
const statName = (s) => s ? (STAT_NAME[s] ?? String(s).toUpperCase()) : '';
function scaleSuffix(fx) {
  if (!fx.scale) return '';
  if (fx.scale.source === 'armor') return ' (scales Armor)';
  return ` (scales ${statName(fx.scale.stat)})`;
}
function multiHitSuffix(fx) {
  const extra = fx.multi_hit ?? 0;
  return extra > 0 ? ` ×${1 + extra}` : '';
}

function prefixFromCondition(cond) {
  if (!cond) return null;
  if (cond.enemy_has_stack && cond.per_stack) return 'Ignite';
  if (cond.self_has_stack === 'rage' && cond.per_stack) return 'Berserk';
  if (cond.self_has_stack && cond.per_stack) return `Per ${stackName(cond.self_has_stack)}`;
  if (cond.enemy_has_stack) return `Empowered (if ${stackName(cond.enemy_has_stack)})`;
  if (cond.self_has_stack) return `Empowered (if ${stackName(cond.self_has_stack)})`;
  if (cond.hero_hp_pct_below !== undefined) return 'Vengeance';
  if (cond.hero_hp_pct_atleast !== undefined) return 'Steady';
  if (cond.self_armor_atleast !== undefined) return `Fortified ${cond.self_armor_atleast}`;
  return null;
}

function damageBody(fx) {
  const v = fx.value;
  const p = !!fx.pierce_armor;
  const cond = fx.condition ?? {};
  if (cond.per_stack && (cond.enemy_has_stack || cond.self_has_stack)) {
    return `${v}${p ? ' Pierce' : ''}${scaleSuffix(fx)}`;
  }
  if (!cond.per_stack && (cond.enemy_has_stack || cond.self_has_stack)) {
    return `+${v}${p ? ' Pierce' : ''}${scaleSuffix(fx)}`;
  }
  const verbed = p ? `${v} Pierce` : `Deal ${v}`;
  return `${verbed}${multiHitSuffix(fx)}${scaleSuffix(fx)}`;
}

function dotBody(fx, prefix) {
  const s = stackName(fx.stack);
  const cond = fx.condition ?? {};
  const isConditional = !!prefix;
  const isPerStack = !!cond.per_stack;
  if (isConditional && (isPerStack || cond.enemy_has_stack || cond.self_has_stack)) {
    return `+${fx.value} ${s}${scaleSuffix(fx)}`;
  }
  if (fx.target === 'self_dot') return `Self ${s} ${fx.value}${scaleSuffix(fx)}`;
  return `${s} ${fx.value}${scaleSuffix(fx)}`;
}

function fragmentForEffect(fx) {
  if (fx.type === 'damage') {
    const prefix = prefixFromCondition(fx.condition);
    return { prefix, body: damageBody(fx) };
  }
  if (fx.type === 'dot') {
    const prefix = prefixFromCondition(fx.condition);
    return { prefix, body: dotBody(fx, prefix) };
  }
  if (fx.type === 'stack') {
    const s = stackName(fx.stack);
    if (fx.consume_stack) {
      const cost = Math.abs(fx.value);
      const tok = cost >= 99 ? 'X' : String(cost);
      return { prefix: null, body: `Consume(${tok}) ${s}` };
    }
    const sign = fx.value >= 0 ? '+' : '';
    return { prefix: null, body: `${sign}${fx.value} ${s}` };
  }
  if (fx.type === 'heal' || fx.type === 'armor') {
    const prefix = prefixFromCondition(fx.condition);
    const body = fx.type === 'heal'
      ? `Heal ${fx.value}${scaleSuffix(fx)}`
      : `Armor ${fx.value}${scaleSuffix(fx)}`;
    return { prefix, body };
  }
  if (fx.type === 'stamina' || fx.type === 'mana') {
    const name = fx.type === 'stamina' ? 'Stamina' : 'Mana';
    if (fx.target === 'enemy') return { prefix: null, body: `Drain ${Math.abs(fx.value)} ${name}` };
    const sign = fx.value >= 0 ? '+' : '';
    return { prefix: null, body: `${sign}${fx.value} ${name}` };
  }
  if (fx.type === 'taunt') return { prefix: null, body: 'Taunt' };
  if (fx.type === 'aura') return { prefix: null, body: formatAura(fx) };
  if (fx.type === 'debuff') return { prefix: null, body: `Enemy −${fx.value} Defense` };
  if (fx.type === 'buff') return { prefix: null, body: `+${fx.value} ${fx.scale?.stat ? statName(fx.scale.stat) : 'stat'}` };
  if (fx.type === 'debuff_stat') return { prefix: null, body: `Enemy −${fx.value} ${fx.scale?.stat ? statName(fx.scale.stat) : 'stat'}` };
  return { prefix: null, body: String(fx.type) };
}

function formatAura(fx) {
  const secs = Math.round((fx.ttl_ms ?? 0) / 1000);
  const dur = secs > 0 ? ` (${secs}s)` : '';
  if (fx.trigger === 'on_armor_break' && fx.then) return `Brace: ${formatEffectStandalone(fx.then)}`;
  if (fx.trigger === 'on_hp_pct_below' && fx.then) {
    const th = fx.threshold ?? 50;
    return `Guard ${th}%: ${formatEffectStandalone(fx.then)}${dur}`;
  }
  if (fx.modifier) {
    const k = fx.modifier.kind;
    const v = fx.modifier.value;
    if (k === 'cd_reduction') return `Haste ${Math.round(v * 100)}%${dur}`;
    if (k === 'def') {
      if (fx.target === 'enemy') return `Expose ${Math.abs(v)}${dur}`;
      const sign = v >= 0 ? '+' : '';
      return `${sign}${v} Defense${dur}`;
    }
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v} ${statName(k)}${dur}`;
  }
  return `Aura${dur}`;
}

function formatEffectStandalone(fx) {
  const frag = fragmentForEffect(fx);
  return frag.prefix ? `${frag.prefix}: ${frag.body}` : frag.body;
}

function hasBerserkSpend(effects) {
  return effects.some(fx =>
    (fx.type === 'damage' || fx.type === 'dot')
    && fx.condition?.self_has_stack === 'rage'
    && fx.condition?.per_stack === true,
  );
}
function isRageConsumeAll(fx) {
  return fx.type === 'stack' && fx.stack === 'rage' && fx.consume_stack && Math.abs(fx.value) >= 99;
}

function formatCardDescription(card) {
  const effects = card.effects ?? [];
  if (!effects.length) return '';
  const omit = hasBerserkSpend(effects);
  const frags = [];
  for (const fx of effects) {
    if (omit && isRageConsumeAll(fx)) continue;
    frags.push(fragmentForEffect(fx));
  }
  const merged = [];
  for (const f of frags) {
    const last = merged[merged.length - 1];
    if (last && last.prefix && f.prefix && last.prefix === f.prefix) {
      const extra = f.body.replace(/^\+/, '');
      last.body = `${last.body} + ${extra}`;
    } else {
      merged.push({ ...f });
    }
  }
  return merged.map(f => f.prefix ? `${f.prefix}: ${f.body}` : f.body).join('. ') + '.';
}

// ── main ─────────────────────────────────────────────────
const data = JSON.parse(readFileSync(cardsPath, 'utf-8'));
let updated = 0;
for (const card of data.cards) {
  const next = formatCardDescription(card);
  if (next && next !== card.description) {
    card.description = next;
    updated++;
  }
  if (card.upgraded?.effects) {
    const upNext = formatCardDescription({ effects: card.upgraded.effects });
    if (upNext && upNext !== card.upgraded.description) {
      card.upgraded.description = upNext;
      updated++;
    }
  }
}
writeFileSync(cardsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Updated ${updated} description(s) across ${data.cards.length} cards.`);
