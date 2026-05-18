// Keyword-driven card description formatter.
// Single source of truth for the human-readable text on every card view.
// Keywords (Pyre, Berserk, Empowered, Vengeance, Steady, Fortified, Brace,
// Guard, Haste, Expose, Pierce, Burn, Bleed, Poison, Slow, Stun, Rage,
// Consume, Drain, Taunt, Heal, Armor, Scales) are tooltip-linkable.
//
// Pipeline: each effect → { prefix, body }. Consecutive effects with the same
// prefix are merged with " + " so "Berserk: 5 Pierce + 1 Bleed" comes out of
// two underlying effects (a damage and a dot) that both share Berserk gating.

import type { CardDefinition, CardEffect, CardEffectCondition, StackId, StatId } from '../../data/types';

const STACK_NAME: Record<string, string> = {
  burn: 'Burn', bleed: 'Bleed', poison: 'Poison', slow: 'Slow', stun: 'Stun', rage: 'Rage',
};
const STAT_NAME: Record<string, string> = {
  str: 'STR', vit: 'VIT', dex: 'DEX', int: 'INT', spi: 'SPI',
};

function stackName(s?: StackId | string): string {
  if (!s) return '';
  return STACK_NAME[s] ?? s;
}
function statName(s?: StatId | string): string {
  if (!s) return '';
  return STAT_NAME[s] ?? String(s).toUpperCase();
}
function scaleSuffix(fx: CardEffect): string {
  if (!fx.scale) return '';
  if (fx.scale.source === 'armor') return ' (scales Armor)';
  return ` (scales ${statName(fx.scale.stat)})`;
}
function multiHitSuffix(fx: CardEffect): string {
  const extra = fx.multi_hit ?? 0;
  return extra > 0 ? ` ×${1 + extra}` : '';
}

// A formatted effect is either a "plain" line (no prefix) or a keyword-prefixed
// fragment. Keyword fragments with the same `prefix` can be merged with " + ".
interface Fragment {
  prefix: string | null;  // null = render the body as-is, no leading keyword
  body: string;
}

function prefixFromCondition(cond: CardEffectCondition | undefined, fx: CardEffect): string | null {
  if (!cond) return null;
  if (cond.enemy_has_stack === 'burn' && cond.per_stack) return 'Pyre';
  if (cond.enemy_has_stack && cond.per_stack) return `Per ${stackName(cond.enemy_has_stack)}`;
  if (cond.self_has_stack === 'rage' && cond.per_stack) return 'Berserk';
  if (cond.self_has_stack && cond.per_stack) return `Per ${stackName(cond.self_has_stack)}`;
  if (cond.enemy_has_stack) return `Empowered (if ${stackName(cond.enemy_has_stack)})`;
  if (cond.self_has_stack) return `Empowered (if ${stackName(cond.self_has_stack)})`;
  if (cond.hero_hp_pct_below !== undefined) return 'Vengeance';
  if (cond.hero_hp_pct_atleast !== undefined) return 'Steady';
  if (cond.self_armor_atleast !== undefined) return `Fortified ${cond.self_armor_atleast}`;
  void fx;
  return null;
}

function damageBody(fx: CardEffect, prefix: string | null): string {
  const v = fx.value;
  const p = !!fx.pierce_armor;
  const cond = fx.condition ?? {};

  // Per-stack reads — the value is "per-stack damage", no "Deal" verb.
  if (cond.per_stack && (cond.enemy_has_stack || cond.self_has_stack)) {
    return `${v}${p ? ' Pierce' : ''}${scaleSuffix(fx)}`;
  }
  // Conditional flat bonus (Empowered if X) — present as "+N"
  if (!cond.per_stack && (cond.enemy_has_stack || cond.self_has_stack)) {
    return `+${v}${p ? ' Pierce' : ''}${scaleSuffix(fx)}`;
  }
  // Gated full attack — keep "Deal N" / "N Pierce" verb form for clarity.
  const verbed = p ? `${v} Pierce` : `Deal ${v}`;
  const trail = `${multiHitSuffix(fx)}${scaleSuffix(fx)}`;
  if (prefix) return `${verbed}${trail}`;
  return `${verbed}${trail}`;
}

function dotBody(fx: CardEffect, prefix: string | null): string {
  const s = stackName(fx.stack);
  const cond = fx.condition ?? {};
  const isConditional = !!prefix;
  const isPerStack = !!cond.per_stack;
  // Under a keyword prefix, dots read as "+N <Stack>" (a bonus stack application).
  if (isConditional && (isPerStack || cond.enemy_has_stack || cond.self_has_stack)) {
    return `+${fx.value} ${s}${scaleSuffix(fx)}`;
  }
  if (fx.target === 'self_dot') return `Self ${s} ${fx.value}${scaleSuffix(fx)}`;
  return `${s} ${fx.value}${scaleSuffix(fx)}`;
}

function fragmentForEffect(fx: CardEffect): Fragment {
  if (fx.type === 'damage') {
    const prefix = prefixFromCondition(fx.condition, fx);
    return { prefix, body: damageBody(fx, prefix) };
  }
  if (fx.type === 'dot') {
    const prefix = prefixFromCondition(fx.condition, fx);
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
    const prefix = prefixFromCondition(fx.condition, fx);
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
  if (fx.type === 'buff') return {
    prefix: null,
    body: `+${fx.value} ${fx.scale?.stat ? statName(fx.scale.stat) : 'stat'}`,
  };
  if (fx.type === 'debuff_stat') return {
    prefix: null,
    body: `Enemy −${fx.value} ${fx.scale?.stat ? statName(fx.scale.stat) : 'stat'}`,
  };
  return { prefix: null, body: String((fx as { type: string }).type) };
}

function formatAura(fx: CardEffect): string {
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

function formatEffectStandalone(fx: CardEffect): string {
  const frag = fragmentForEffect(fx);
  return frag.prefix ? `${frag.prefix}: ${frag.body}` : frag.body;
}

export function formatEffect(fx: CardEffect): string {
  return formatEffectStandalone(fx);
}

function hasBerserkSpend(effects: CardEffect[]): boolean {
  return effects.some(fx =>
    (fx.type === 'damage' || fx.type === 'dot') &&
    (fx.condition as CardEffectCondition | undefined)?.self_has_stack === 'rage' &&
    (fx.condition as CardEffectCondition | undefined)?.per_stack === true,
  );
}
function isRageConsumeAll(fx: CardEffect): boolean {
  return fx.type === 'stack'
    && fx.stack === 'rage'
    && !!fx.consume_stack
    && Math.abs(fx.value) >= 99;
}

export function formatCardDescription(card: Pick<CardDefinition, 'effects'>): string {
  const effects = card.effects ?? [];
  if (!effects.length) return '';
  const omitConsumeAll = hasBerserkSpend(effects);

  // Lower to fragments, then merge consecutive same-prefix fragments.
  const frags: Fragment[] = [];
  for (const fx of effects) {
    if (omitConsumeAll && isRageConsumeAll(fx)) continue;
    frags.push(fragmentForEffect(fx));
  }

  const merged: Fragment[] = [];
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
