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
  // v3: source:"armor" means "read hero Armor as the scaling stat". When the
  // effect base value is 0, the rendering elsewhere uses "= Armor × N" form
  // and this suffix is empty. Otherwise, give the formula explicitly.
  if (fx.scale.source === 'armor') {
    if (fx.value === 0) return '';
    const v = fx.scale.value ?? 1;
    const per = fx.scale.per ?? 1;
    const inc = v === 1 ? `+1 per ${per} Armor` : `+${v} per ${per} Armor`;
    return ` (${inc})`;
  }
  // v3: cross-stack source — the body already reads the source stack inline
  // (e.g. "Apply Poison equal to your Bleed"), so don't repeat as "(scales)".
  if (fx.scale.source === 'self_stack' || fx.scale.source === 'consumed_stack') {
    return '';
  }
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
  if (cond.hero_hp_pct_below !== undefined) return `Vengeance (<${cond.hero_hp_pct_below}% HP)`;
  if (cond.hero_hp_pct_atleast !== undefined) return 'Steady';
  if (cond.self_armor_atleast !== undefined) return `Fortified ${cond.self_armor_atleast}`;
  // v3 conditions
  if (cond.enemy_stunned === true) return 'Shatter';
  if (cond.enemy_stack_atleast)
    return `If enemy ${stackName(cond.enemy_stack_atleast.stack)} ≥ ${cond.enemy_stack_atleast.value}`;
  if (cond.self_stack_atleast)
    return `If your ${stackName(cond.self_stack_atleast.stack)} ≥ ${cond.self_stack_atleast.value}`;
  if (cond.devour_succeeded === true) return 'After Devour';
  void fx;
  return null;
}

function damageBody(fx: CardEffect, prefix: string | null): string {
  const v = fx.value;
  const p = !!fx.pierce_armor;
  const cond = fx.condition ?? {};

  // Self-damage cards: render as "Lose N HP", not "Deal N" (which implies enemy).
  if (fx.target === 'self') {
    const word = p ? 'HP (Pierce)' : 'HP';
    return `Lose ${v} ${word}${scaleSuffix(fx)}`;
  }

  // v3: consume_stack_value — damage per consumed stack. The "Consume(N) <stack>"
  // bookkeeping is baked into the fragment prefix by formatCardDescription, so
  // the body just states the per-stack payload.
  // value=0 means the contribution is entirely from the scale clause (e.g.
  // Crimson Spiral = Rage × STR), so drop the leading "0".
  if (fx.consume_stack_value) {
    const word = p ? 'Pierce' : 'damage';
    const num = v === 0 ? '' : `${v} `;
    return `${num}${word} per stack${multiHitSuffix(fx)}${scaleSuffix(fx)}`;
  }

  // v3: armor-source damage with value=0 means "= Armor × scale.value".
  if (fx.scale?.source === 'armor' && v === 0 && fx.scale.value) {
    const word = p ? 'Pierce' : 'damage';
    const mult = fx.scale.value === 1 ? '' : ` × ${fx.scale.value}`;
    return `${word} = Armor${mult}${multiHitSuffix(fx)}`;
  }

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
  const channelPrefix = fx.channel ? 'Channel: ' : '';
  const channelNote = fx.channel
    ? ` (scales with cooldown, up to +${Math.round(fx.channel.max_bonus * 100)}%)`
    : '';
  const trail = `${multiHitSuffix(fx)}${scaleSuffix(fx)}${channelNote}`;
  const siphonNote = fx.siphon ? ` Siphon ${Math.round(fx.siphon * 100)}%.` : '';
  if (prefix) return `${channelPrefix}${verbed}${trail}${siphonNote}`;
  return `${channelPrefix}${verbed}${trail}${siphonNote}`;
}

function dotBody(fx: CardEffect, prefix: string | null): string {
  const s = stackName(fx.stack);
  const cond = fx.condition ?? {};
  const isConditional = !!prefix;
  const isPerStack = !!cond.per_stack;
  const perHit = fx.per_hit ? ' per hit' : '';
  // Under a keyword prefix, dots read as "+N <Stack>" (a bonus stack application).
  if (isConditional && (isPerStack || cond.enemy_has_stack || cond.self_has_stack)) {
    return `+${fx.value} ${s}${perHit}${scaleSuffix(fx)}`;
  }
  if (fx.target === 'self_dot') return `Self ${s} ${fx.value}${perHit}${scaleSuffix(fx)}`;
  if (fx.target === 'aoe') return `${s} ${fx.value} AoE${perHit}${scaleSuffix(fx)}`;
  return `${s} ${fx.value}${perHit}${scaleSuffix(fx)}`;
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
      const tok = cost >= 99 ? 'All' : String(cost);
      return { prefix: `Consume(${tok}) ${s}`, body: '' };
    }
    // v3: spread — "Spread 50% Poison to all enemies"
    if (fx.spread) {
      const pct = Math.round(fx.spread.ratio * 100);
      const tgt = fx.spread.target === 'aoe' ? 'all enemies' : 'nearest';
      const max = fx.spread.max_targets ? ` (max ${fx.spread.max_targets})` : '';
      return { prefix: null, body: `Spread ${pct}% ${s} to ${tgt}${max}` };
    }
    // v3: cross-stack source (Necrotic Festering: apply Poison = your Bleed)
    if (fx.value === 0 && fx.scale?.source === 'self_stack' && fx.scale.stack) {
      return {
        prefix: null,
        body: `Apply ${s} equal to your ${stackName(fx.scale.stack)}${scaleSuffix(fx)}`,
      };
    }
    const sign = fx.value >= 0 ? '+' : '';
    return { prefix: null, body: `${sign}${fx.value} ${s}${scaleSuffix(fx)}` };
  }
  if (fx.type === 'heal' || fx.type === 'armor') {
    const prefix = prefixFromCondition(fx.condition, fx);
    // v3: when paired with consume_stack_value, body reads "Heal 4 per stack".
    // The formatCardDescription wrapper injects the "Consume(N) <stack>:" prefix.
    const perStack = fx.consume_stack_value ? ' per stack' : '';
    const body = fx.type === 'heal'
      ? `Heal ${fx.value}${perStack}${scaleSuffix(fx)}`
      : `Armor ${fx.value}${perStack}${scaleSuffix(fx)}`;
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

  // -- v3 archetype redesign effect types --

  if (fx.type === 'convert_stack') {
    const from = stackName(fx.from);
    const to = (fx.to as string) === 'armor' ? 'Armor' : stackName(fx.to);
    const amount = (fx.value ?? 0) >= 99 ? 'all' : String(fx.value);
    const factor = fx.factor && fx.factor !== 1 ? ` ×${fx.factor}` : '';
    const cap = fx.cap !== undefined ? ` (cap ${fx.cap})` : '';
    const prefix = prefixFromCondition(fx.condition, fx);
    return { prefix, body: `Convert ${amount} ${from} → ${to}${factor}${cap}${scaleSuffix(fx)}` };
  }

  if (fx.type === 'multiply_stack') {
    const s = stackName(fx.stack);
    const factor = fx.factor ?? 2;
    return { prefix: null, body: `Catalyze ×${factor} ${s}` };
  }

  if (fx.type === 'stack_boost') {
    const s = stackName(fx.stack);
    return { prefix: null, body: `+${fx.value} to every ${s} on target${scaleSuffix(fx)}` };
  }

  if (fx.type === 'echo') {
    const secs = fx.ttl_ms ? ` (${Math.round((fx.ttl_ms as number) / 1000)}s)` : '';
    const prefix = prefixFromCondition(fx.condition, fx);
    return { prefix, body: `Echo ${fx.value}${secs}` };
  }

  if (fx.type === 'cd_debt') {
    return { prefix: 'Overload', body: `next play +${fx.value.toFixed(1)}s CD` };
  }

  if (fx.type === 'devour') {
    const rarity = fx.devour?.rarity ? ` ${fx.devour.rarity}` : '';
    const count = fx.devour?.count ?? 1;
    return { prefix: null, body: `Devour ${count}${rarity} card from deck` };
  }

  if (fx.type === 'force_trigger_all_cards') {
    return { prefix: null, body: 'Trigger every card you own once' };
  }

  return { prefix: null, body: String((fx as { type: string }).type) };
}

function formatAuraThenList(then: CardEffect | CardEffect[] | undefined): string {
  if (!then) return '';
  const arr = Array.isArray(then) ? then : [then];
  return arr.map((e) => formatEffectStandalone(e)).join(' + ');
}

function formatAura(fx: CardEffect): string {
  const secs = Math.round((fx.ttl_ms ?? 0) / 1000);
  const dur = secs > 0 ? ` (${secs}s)` : fx.ttl_ms === null ? ' (permanent)' : '';
  const channelStr = fx.channel_ms ? ` after Channel ${Math.round(fx.channel_ms / 1000)}s` : '';
  const tickStr = fx.tick_ms ? ` every ${(fx.tick_ms / 1000).toFixed(1)}s` : '';
  const thenBody = formatAuraThenList(fx.then);
  const trig = fx.trigger;

  // v1 triggers
  if (trig === 'on_armor_break' && thenBody) return `Brace${channelStr}: ${thenBody}${dur}`;
  if (trig === 'on_hp_pct_below' && thenBody) {
    const th = fx.threshold ?? 50;
    return `Guard ${th}%: ${thenBody}${dur}`;
  }

  // v3 triggers
  if (trig === 'on_hit_dealt' && thenBody)   return `On Hit: ${thenBody}${dur}`;
  if (trig === 'on_hit_taken' && thenBody)   return `Reflex: ${thenBody}${dur}`;
  if (trig === 'on_armor_gained' && thenBody) {
    const min = fx.min_amount ? ` (≥${fx.min_amount})` : '';
    return `Juggernaut${min}: ${thenBody}${dur}`;
  }
  if (trig === 'on_self_damage' && thenBody) return `Rupture: ${thenBody}${dur}`;
  if (trig === 'on_self_dot_tick' && thenBody) return `Bloodforge: ${thenBody}${dur}`;
  if (trig === 'on_stack_threshold' && thenBody) {
    const s = stackName(fx.threshold_stack);
    const t = fx.threshold ?? 0;
    return `On ${s} ≥ ${t}: ${thenBody}${dur}`;
  }
  if (trig === 'on_enemy_stack_threshold' && thenBody) {
    const s = stackName(fx.threshold_stack);
    const t = fx.threshold ?? 0;
    return `Threshold ${s} ≥ ${t}: ${thenBody}${dur}`;
  }
  if (trig === 'on_kill_with_stack' && thenBody) {
    const s = stackName(fx.threshold_stack);
    return `Cascade (${s}): ${thenBody}${dur}`;
  }
  if (trig === 'on_slow_applied' && thenBody) return `Frost Echo: ${thenBody}${dur}`;
  if (trig === 'passive_armor_scaler' && fx.modifier) {
    // Falls through to modifier formatter below.
  }

  // Tick-only auras (Stagnant Bulwark / Dust Plague / Twinflame Flicker / Crimson Regen)
  if (fx.tick_ms && thenBody) {
    return `Aura${dur}${channelStr}${tickStr}: ${thenBody}`;
  }

  // Channel-only aura (warm-up then permanent passive — Wrathshell Vow tick part)
  if (fx.channel_ms && thenBody) {
    return `Aura${dur}${channelStr}: ${thenBody}`;
  }

  // Modifier auras
  if (fx.modifier) {
    const k = fx.modifier.kind;
    const v = fx.modifier.value;
    if (k === 'cd_reduction') return `Haste ${Math.round(v * 100)}%${dur}`;
    if (k === 'def') {
      if (fx.target === 'enemy') return `Expose ${Math.abs(v)}${dur}`;
      const sign = v >= 0 ? '+' : '';
      return `${sign}${v} Defense${dur}`;
    }
    // v3 modifier kinds
    if (k === 'burn_taken') return `Vulnerable Fire +${v}${dur}`;
    if (k === 'armor_bonus_pct') return `Reforce +${Math.round(v * 100)}% Armor gained${dur}`;
    if (k === 'armor_bonus_flat') return `Reforce +${v} flat Armor gained${dur}`;
    if (k === 'damage_taken_pct') {
      const pct = Math.round(Math.abs(v) * 100);
      return v < 0 ? `Mitigate ${pct}% incoming${dur}` : `Vulnerable +${pct}% incoming${dur}`;
    }
    if (k === 'damage_dealt_pct') {
      const pct = Math.round(Math.abs(v) * 100);
      return v >= 0 ? `Empower +${pct}% damage${dur}` : `Weakened −${pct}% damage${dur}`;
    }
    if (k === 'hero_hit_bonus') {
      if (fx.modifier.stack) return `Stance: hits +${v} per ${stackName(fx.modifier.stack)}${dur}`;
      return `Stance: hits +${v}${dur}`;
    }
    if (k === 'ignore_immunity') {
      const s = fx.modifier.stack ? ` ${stackName(fx.modifier.stack)}` : '';
      return `Strip${s} immunity${dur}`;
    }
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v} ${statName(k)}${dur}`;
  }
  return `Aura${dur}`;
}

function formatEffectStandalone(fx: CardEffect): string {
  const frag = fragmentForEffect(fx);
  if (frag.prefix && !frag.body) return frag.prefix; // e.g. "Consume(All) Rage"
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

type CardDescPick = Pick<CardDefinition, 'effects' | 'exhaust' | 'frenzy' | 'spend_armor' | 'cooldown_scale'>;

/** v3: collect the amount each stack is being consumed by within this card.
 *  Reads any `stack` effect with `consume_stack: true` and a negative value.
 *  Returns "All" for |value| >= 99, otherwise the numeric amount as a string. */
function buildConsumeAmounts(effects: CardEffect[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const fx of effects) {
    if (fx.type !== 'stack' || !fx.consume_stack || !fx.stack) continue;
    const amount = Math.abs(fx.value);
    out[fx.stack] = amount >= 99 ? 'All' : String(amount);
  }
  return out;
}

export function formatCardDescription(card: CardDescPick): string {
  const effects = card.effects ?? [];
  if (!effects.length) return '';
  const omitConsumeAll = hasBerserkSpend(effects);
  // v3: any stack named by a `consume_stack_value` damage/heal already shows
  // the consume amount via its own prefix ("Consume(N) Stack: ..."), so the
  // standalone `Consume(N) Stack` fragment becomes redundant — hide it.
  const consumedByValue = new Set<string>();
  for (const fx of effects) {
    if ((fx.type === 'damage' || fx.type === 'heal') && fx.consume_stack_value) {
      consumedByValue.add(fx.consume_stack_value);
    }
  }
  const isCoveredConsume = (fx: CardEffect): boolean =>
    fx.type === 'stack' && !!fx.consume_stack && !!fx.stack && consumedByValue.has(fx.stack);
  const consumeAmounts = buildConsumeAmounts(effects);

  // Lower to fragments, then merge consecutive same-prefix fragments. Effects
  // with `consume_stack_value` (or armor-source damage on a spend_armor card)
  // get a "Consume(N) <stack>" prefix injected so every spend reads the same.
  const frags: Fragment[] = [];
  for (const fx of effects) {
    if (omitConsumeAll && isRageConsumeAll(fx)) continue;
    if (isCoveredConsume(fx)) continue;
    let frag = fragmentForEffect(fx);
    if ((fx.type === 'damage' || fx.type === 'heal') && fx.consume_stack_value) {
      const s = stackName(fx.consume_stack_value);
      const amt = consumeAmounts[fx.consume_stack_value] ?? 'X';
      const combined = frag.prefix
        ? `${frag.prefix}, Consume(${amt}) ${s}`
        : `Consume(${amt}) ${s}`;
      frag = { prefix: combined, body: frag.body };
    } else if (
      fx.type === 'damage' &&
      fx.scale?.source === 'armor' &&
      fx.value === 0 &&
      card.spend_armor !== undefined
    ) {
      const amt = card.spend_armor === 'all' ? 'All' : String(card.spend_armor);
      const combined = frag.prefix
        ? `${frag.prefix}, Consume(${amt}) Armor`
        : `Consume(${amt}) Armor`;
      frag = { prefix: combined, body: frag.body };
    }
    frags.push(frag);
  }

  // v3: prepend card-level keyword markers so Exhaust/Frenzy are visible even
  // when the effect dispatcher doesn't surface them.
  const leading: string[] = [];
  if (card.exhaust) leading.push('Exhaust');
  if (card.frenzy) {
    const cdPct = Math.round((1 - card.frenzy.cd_mult) * 100);
    leading.push(`Frenzy: CD −${cdPct}% below ${card.frenzy.hero_hp_pct_below}% HP`);
  }
  // spend_armor: if the card has an armor-sourced damage effect, the damage
  // line is already prefixed via the special-case handling below; otherwise
  // we add a top-level note so the card still reads coherently.
  const hasArmorSourceDamage = effects.some(fx =>
    fx.type === 'damage' && fx.scale?.source === 'armor',
  );
  if (card.spend_armor !== undefined && !hasArmorSourceDamage) {
    const amt = card.spend_armor === 'all' ? 'All' : String(card.spend_armor);
    leading.push(`Consume(${amt}) Armor`);
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

  const effectLines = merged.map(f => {
    if (!f.prefix) return f.body;
    if (!f.body) return f.prefix; // standalone Consume(N) <stack>
    return `${f.prefix}: ${f.body}`;
  });
  const allParts = [...leading, ...effectLines].filter(Boolean);
  return allParts.join('. ') + '.';
}
