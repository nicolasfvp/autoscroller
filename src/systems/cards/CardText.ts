// New card-description formatter (CARD_AUDIT §1, §11, §12).
//
// Output uses the bracketed-icon prose convention. Single source of truth for
// the human-readable text on every card view.
//
// Conventions enforced here:
//   - Stack/stat references are icon tokens: [burn] [str] [armor] [HP] etc.
//   - Stat scalers glue to the number they scale: "Deal 9([str])."
//   - No comparison operators: "more then 50%[HP]", "at least 10[armor]".
//   - No "Aura Ns:": "For N seconds: ..."
//   - No "(scales STR)": trailing "([str])".
//   - Aura triggers are prose ("every time you hit an enemy") except Brace
//     and Vengeance which stay as named keywords.
//   - Conditional gates are inline prose (no Empowered/Guard/Fortified/
//     Shatter/Berserk keywords).
//   - Brace/Vengeance/Haste/Exhaust remain as keyword prefixes.
//   - The cost block (rendered elsewhere) shows consumed resources; the body
//     describes per-consumed-stack payoffs in plain prose.

import type { CardDefinition, CardEffect, CardEffectCondition, StackId, StatId } from '../../data/types';

// -- Icon tokens --------------------------------------------------------

const STACK_TOKEN: Record<string, string> = {
  burn: '[burn]', bleed: '[bleed]', poison: '[poison]', slow: '[slow]', stun: '[stun]', rage: '[rage]',
};
const STAT_TOKEN: Record<string, string> = {
  str: '[str]', vit: '[vit]', dex: '[dex]', int: '[int]', spi: '[spi]',
};
function stackTok(s?: StackId | string): string {
  if (!s) return '';
  return STACK_TOKEN[s] ?? `[${s}]`;
}
function statTok(s?: StatId | string): string {
  if (!s) return '';
  return STAT_TOKEN[s] ?? `[${s}]`;
}

// ── Dynamic scaled-value markup ───────────────────────────────────────────
// When `dynamicBuild` is active, scaler clauses are emitted as an invisible
// sentinel carrying the scale parameters instead of the literal "([str])".
// formatCardDescription then rewrites each "<number><sentinel>" into either the
// RESOLVED value (a [[v:N:stat]] token rendered bigger + colored) or the
// "(base + inc per [stat])" equation (while SHIFT is held). See applyDynamic().
let dynamicBuild = false;
// True while formatting a card that consumes its armor (card.spend_armor set).
// Read by the armor-source damage body so it says "per [armor] consumed"
// rather than "per [armor] you have".
let spendingArmor = false;
// Base-action keys present unconditionally on the card being formatted. A gated
// "deal N more" / "apply N more" only reads right when one of these establishes
// a hit for the bonus to add onto; otherwise the gated effect IS the whole
// action and reads absolute. Populated per-card in formatCardDescription.
let baseEffectKeys: Set<string> = new Set();
// True while formatting a card carrying the "Pyre keyword" — a damage effect
// gated by enemy_has_stack:'burn' + per_stack. The engine auto-consumes ALL burn
// right after that hit (CardResolver Pyre semantic), even with no explicit
// consume effect. When set, the detonation clause appends ", then consume all
// [burn]" and buildConsumeClauses suppresses any redundant hoisted burn consume.
let pyreBurnKeyword = false;
// Stacks read by a `consume_stack_value` detonator on the card being formatted.
// Such a stack's explicit consume is the detonator's fuel and is hoisted to a
// leading "Consume all [X]" clause. A consume of a stack NOT in this set is a
// standalone cost (e.g. Stormrage's rage) and is rendered inline in array order
// so it doesn't read as happening before effects that gate on that stack.
let consumeValueFuel: Set<string> = new Set();
// `consume_stack_value` stacks the card ACTUALLY consumes from the same side the
// snapshot reads (enemy pool for poison/bleed/burn/stun/slow, hero pool for
// rage). Only these read as "per [X] consumed"; a mismatch (e.g. Necrotic
// Festering reads enemy bleed but consumes its own) reads "per [X] on enemy".
let consumedValueStacks: Set<string> = new Set();
// Single `consume_stack_value` detonator whose fuel the card also consumes AND
// that sits alongside a flat hit: fold the consume into the detonator clause
// ("Consume all [X] and deal N ... per [X] consumed") instead of hoisting a
// separate leading "Consume all [X]". stack -> "all" | "N".
let detonatorFold: Map<string, string> = new Map();
// 2+ identical `consume_stack_value` detonators (Tremor Detonate): collapse into a
// single "Consume all [A], [B] and [C] and deal N per stack consumed" clause.
let multiDetonator: { stacks: string[]; proto: CardEffect } | null = null;
// Brine Crucible: a spend-all convert immediately followed by a flat application
// of the produced stack — fold the consume into the convert clause and tag the
// flat application as "plus" so the reader doesn't parse "Apply N[X]" twice.
let brineFold = false;
const SENT_OPEN = String.fromCharCode(1);
const SENT_CLOSE = String.fromCharCode(2);
function sentinel(base: number, inc: number, per: number, stat: string): string {
  return `${SENT_OPEN}${base}:${inc}:${per}:${stat}${SENT_CLOSE}`;
}

// Returns "([str])" or "" for a CardEffect's scale clause. The scaler glues
// directly to the number it scales — the caller decides where to place it.
function scalerSuffix(fx: CardEffect): string {
  if (!fx.scale) return '';
  // Body-driven scale sources (armor / consumed stacks / self stacks) already
  // narrate their math inline; don't double-emit a stat tag.
  const src = fx.scale.source;
  if (src === 'armor' || src === 'consumed_stack' || src === 'self_stack' ||
      src === 'enemy_pre_consume_stack' || src === 'missing_hp_pct' || src === 'rage') {
    return '';
  }
  if (!fx.scale.stat) return '';
  if (dynamicBuild) {
    if (fx.scale.per <= 0 || fx.scale.value === 0) return '';
    return sentinel(fx.value, fx.scale.value, fx.scale.per, fx.scale.stat);
  }
  return `(${statTok(fx.scale.stat)})`;
}

// Like scalerSuffix but for inline per-stack / per-consumed clauses where the
// scaled number is a promoted lead value rather than fx.value. Mirrors the
// original `fx.scale?.stat ? "([stat])" : ""` exactly when not in dynamic mode
// (so canonical output is unchanged), and emits a sentinel keyed to `base`
// when dynamic.
function statScaleInline(fx: CardEffect, base: number): string {
  if (!fx.scale?.stat) return '';
  if (dynamicBuild) {
    if (fx.scale.per <= 0 || fx.scale.value === 0) return '';
    return sentinel(base, fx.scale.value, fx.scale.per, fx.scale.stat);
  }
  return `(${statTok(fx.scale.stat)})`;
}

// -- Targeting helpers --------------------------------------------------

function aoeSuffix(fx: CardEffect): string {
  if (fx.target === 'aoe') return ' to all enemies';
  if (fx.target === 'enemy_nearest') return ' to the nearest enemy';
  return '';
}

// -- Condition formatting ----------------------------------------------

interface CondGate {
  /** What appears before the colon: "Vengeance", "Brace", "If enemy has [burn]", ... */
  prefix: string;
  /** Stable signature used to merge consecutive same-condition effects. */
  key: string;
  /** Whether this is a "relative bonus" gate (uses "more"). */
  relative: boolean;
}

function condFromEffect(fx: CardEffect): CondGate | null {
  const c = fx.condition;
  if (!c) return null;
  // Vengeance — kept keyword.
  if (c.took_damage_within_ms !== undefined) {
    return { prefix: 'Vengeance', key: 'vengeance', relative: true };
  }
  // Berserk-style low-HP gate.
  if (c.hero_hp_pct_below !== undefined) {
    return {
      prefix: `If you have less than ${c.hero_hp_pct_below}%[HP]`,
      key: `hp_below:${c.hero_hp_pct_below}`,
      relative: true,
    };
  }
  if (c.hero_hp_pct_atleast !== undefined) {
    return {
      prefix: `If you have more than ${c.hero_hp_pct_atleast}%[HP]`,
      key: `hp_atleast:${c.hero_hp_pct_atleast}`,
      relative: true,
    };
  }
  if (c.self_armor_atleast !== undefined) {
    return {
      prefix: `If [armor] is at least ${c.self_armor_atleast}`,
      key: `armor:${c.self_armor_atleast}`,
      relative: true,
    };
  }
  if (c.enemy_stunned === true) {
    return { prefix: 'If enemy is [stun]', key: 'enemy_stunned', relative: true };
  }
  if (c.enemy_stack_atleast) {
    const v = c.enemy_stack_atleast.value;
    const s = c.enemy_stack_atleast.stack;
    return {
      prefix: `If enemy has ${v} or more ${stackTok(s)}`,
      key: `enemy_stack_at:${s}:${v}`,
      relative: true,
    };
  }
  if (c.self_stack_atleast) {
    const v = c.self_stack_atleast.value;
    const s = c.self_stack_atleast.stack;
    return {
      prefix: `If you have ${v} or more ${stackTok(s)}`,
      key: `self_stack_at:${s}:${v}`,
      relative: true,
    };
  }
  // Per-stack reads are NOT a gate — they multiply the value. Handled inline.
  if (c.per_stack) return null;
  if (c.enemy_has_stack) {
    return {
      prefix: `If enemy has ${stackTok(c.enemy_has_stack)}`,
      key: `enemy_has:${c.enemy_has_stack}`,
      // Without scale/pierce, a flat damage bonus reads as "+N damage"; the
      // damage formatter checks `relative` to decide between "+N" and "more".
      relative: false,
    };
  }
  if (c.self_has_stack) {
    return {
      prefix: `If you have ${stackTok(c.self_has_stack)}`,
      key: `self_has:${c.self_has_stack}`,
      relative: false,
    };
  }
  if (c.devour_succeeded === true) {
    return {
      prefix: 'Permanently remove 1 common card from your deck this combat',
      key: 'devour',
      relative: false,
    };
  }
  return null;
}

// -- Body formatters ----------------------------------------------------

/** A stable key for an effect's "base action" kind. Used to decide whether a
 *  gated bonus has an unconditional counterpart to add onto. Bookkeeping
 *  (consume / spread) and resource/aura effects don't establish a hittable base. */
function effectBaseKey(fx: CardEffect): string | null {
  switch (fx.type) {
    // Pierce is observably distinct from a normal hit, so a Pierce bonus only
    // reads as "more" when an unconditional Pierce hit exists (and vice versa).
    case 'damage':    return fx.pierce_armor ? 'damage:pierce' : 'damage';
    case 'dot':       return fx.stack ? `dot:${fx.stack}` : 'dot';
    case 'heal':      return 'heal';
    case 'armor':     return 'armor';
    case 'stack':     return (fx.consume_stack || fx.spread) ? null : (fx.stack ? `stack:${fx.stack}` : 'stack');
    case 'stat_gain': return fx.stat ? `stat_gain:${fx.stat}` : 'stat_gain';
    default:          return null;
  }
}

/** Unconditional base-action keys on a card (gated effects excluded). */
function collectBaseEffectKeys(effects?: CardEffect[]): Set<string> {
  const keys = new Set<string>();
  for (const fx of effects ?? []) {
    if (fx.condition) continue;
    const k = effectBaseKey(fx);
    if (k) keys.add(k);
  }
  return keys;
}

/** True for "deal N more" / "apply N more [stack]" wording inside a gate — only
 *  when the card also lands an unconditional hit of the same kind for the bonus
 *  to add onto. Without that base, the gated effect reads absolute. */
function useRelativePhrasing(fx: CardEffect, gate: CondGate | null): boolean {
  if (!gate) return false;
  const key = effectBaseKey(fx);
  const hasBase = !!key && baseEffectKeys.has(key);
  if (gate.relative) return hasBase;
  // enemy_has_stack / self_has_stack with scale or pierce read as separate actions.
  const hasScale = !!fx.scale && fx.scale.source !== 'armor';
  if (fx.type === 'damage' && (hasScale || fx.pierce_armor)) return hasBase;
  // A stack-applying effect gated on the enemy/you already having that stack is an
  // EXTRA application on top of the unconditional base — read it as "N more" rather
  // than repeating the identical "Apply N[stack]" clause verbatim.
  if (fx.type === 'dot') return hasBase;
  return false;
}

function multiHitTimes(fx: CardEffect): number {
  const extra = fx.multi_hit ?? 0;
  return 1 + extra;
}

function timesWord(n: number, scaler: string): string {
  if (n <= 1) return '';
  if (n === 2) return ` twice${scaler ? '' : ''}`;
  if (n === 3) return ' three times';
  if (n === 4) return ' four times';
  if (n === 5) return ' five times';
  return ` ${n} times`;
}

// Damage rendering (no leading condition prefix).
function damageBody(fx: CardEffect, gate: CondGate | null): string {
  const v = fx.value;
  const pierce = !!fx.pierce_armor;
  const word = pierce ? 'Pierce' : '';
  const relative = useRelativePhrasing(fx, gate);
  const scaler = scalerSuffix(fx);
  const aoe = aoeSuffix(fx);

  // Self-damage: "Lose N[HP]". `pierce_armor` on self-damage means the HP cost
  // skips your own armor — spelled out in prose ("(Pierce)" is the enemy-facing
  // word and reads as nonsense applied to your own HP loss).
  if (fx.target === 'self') {
    const pcs = pierce ? ', ignoring your [armor]' : '';
    return `Lose ${v}[HP]${scaler}${pcs}`;
  }

  // Per-stack scaling — "Deal N([scale]) [Pierce] per [stack] on enemy".
  const c = fx.condition ?? {};
  if (c.per_stack && (c.enemy_has_stack || c.self_has_stack)) {
    const stk = c.enemy_has_stack ?? c.self_has_stack!;
    const side = c.enemy_has_stack ? 'on enemy' : 'on yourself';
    // value=0 with scale.value=N means the scale.value is the per-stack
    // damage; promote it into the leading number.
    const lead = v === 0 ? (fx.scale?.value ?? 1) : v;
    // Sentinel base must be the TRUE base (fx.value) so resolved == CardResolver's
    // value + floor(stat/per)*scale.value. For value:0 detonators the printed
    // `lead` is the promoted scale.value, but the resolver's base is 0 — using
    // `lead` here would double-count the increment.
    const statS = statScaleInline(fx, fx.value);
    // Pyre keyword: damage gated by enemy_has_stack:'burn' + per_stack reads the
    // enemy's burn to scale, then the engine consumes ALL of it (CardResolver
    // Pyre semantic). Read it consume-first, in the order it happens.
    if (c.enemy_has_stack === 'burn' && c.per_stack) {
      const dmgWord = pierce ? 'Pierce' : 'damage';
      return `Consume all [burn] and deal ${lead}${statS} ${dmgWord} per [burn] consumed${aoe}`;
    }
    if (pierce) {
      return `Deal ${lead}${statS} Pierce per ${stackTok(stk)} ${side}${aoe}`;
    }
    return `Deal ${lead}${statS} damage per ${stackTok(stk)} ${side}${aoe}`;
  }

  // consume_stack_value: damage scales by stacks consumed within this cast.
  // value=0 with scale.value=N means "deal N per stack consumed" — promote
  // the scale.value into the leading number ("Deal 2([str]) Pierce per ...").
  if (fx.consume_stack_value) {
    const stk = fx.consume_stack_value;
    const target = fx.target === 'aoe' ? ' to all enemies' : '';
    const lead = v === 0 ? (fx.scale?.value ?? 1) : v;
    // Sentinel base must be the TRUE base (fx.value) so resolved == CardResolver's
    // value + floor(stat/per)*scale.value. For value:0 detonators the printed
    // `lead` is the promoted scale.value, but the resolver's base is 0 — using
    // `lead` here would double-count the increment.
    const statS = statScaleInline(fx, fx.value);
    const phrase = consumeValuePhrase(stk);
    const tail = pierce ? ` Pierce per ${stackTok(stk)} ${phrase}` : ` per ${stackTok(stk)} ${phrase}`;
    // Fold the consume into the detonator clause when the card spends this stack
    // and lands a separate flat hit — reads consume-first, in the order it happens.
    const foldAmt = detonatorFold.get(stk);
    if (foldAmt !== undefined) {
      return `Consume ${foldAmt} ${stackTok(stk)} and deal ${lead}${statS}${tail}${target}`;
    }
    return `Deal ${lead}${statS}${tail}${target}`;
  }

  // Armor-source damage: "Deal N Pierce per K[armor] you have/consumed".
  // The resolver reads heroDefense for source:"armor" and IGNORES scale.stat
  // (see CardResolver), so no "([stat])" suffix — it would falsely imply the
  // hit scales off that stat.
  if (fx.scale?.source === 'armor') {
    const per = fx.scale.per ?? 1;
    const inc = fx.scale.value ?? 1;
    const statS = '';
    const armorRef = spendingArmor ? 'consumed' : 'you have';
    // "per [armor]" reads cleaner than "per 1[armor]" — drop the "1" whenever the
    // rate is one bonus per point (a multi-point rate like "per 2[armor]" keeps it).
    const perArmor = (per === 1)
      ? `[armor] ${armorRef}`
      : `${per}[armor] ${armorRef}`;
    if (v === 0) {
      // Batch C: the literal armor hit (Shield Bash) lands a number equal to
      // current armor whether or not it pierces, so keep the clean "equal to
      // your [armor]" wording even though it now carries pierce_armor.
      if (per === 1 && inc === 1 && !spendingArmor) {
        return `Deal damage equal to your [armor]`;
      }
      // "Deal 2 Pierce per [armor] consumed" etc.
      if (pierce) {
        return `Deal ${inc}${statS} Pierce per ${perArmor}${aoe}`;
      }
      return `Deal ${inc}${statS} damage per ${perArmor}${aoe}`;
    }
    const w = pierce ? ' Pierce' : '';
    const t = timesWord(multiHitTimes(fx), '');
    return `Deal ${v}${w}${t}, +${inc}${statS} damage per ${perArmor}${aoe}`;
  }

  // Relative phrasing inside a gate — "deal N([str]) more [Pierce]".
  if (relative) {
    const pcs = pierce ? ' Pierce' : '';
    // per_hit bonus inside a gate: "each hit deals N([str]) more [Pierce]".
    if (fx.per_hit) return `each hit deals ${v}${scaler} more${pcs}${aoe}`;
    const times = multiHitTimes(fx);
    const t = timesWord(times, scaler);
    if (times >= 2) return `deal ${v}${scaler}${pcs}${t} more${aoe}`;
    return `deal ${v}${scaler} more${pcs}${aoe}`;
  }

  // Gated damage that is not a relative bonus.
  if (gate && !relative) {
    // A per_hit bonus replays on each hit of a preceding multi-hit attack — surface
    // that ("each hit also deals N") instead of reading as one standalone hit.
    if (fx.per_hit) {
      const pcs = pierce ? ' Pierce' : '';
      return `each hit also deals ${v}${scaler}${pcs}${aoe}`;
    }
    // No unconditional hit to add onto → the gated hit IS the attack; read it
    // absolute ("Deal N"), never "+N"/"more" implying a phantom base. Capital
    // to match standalone gate/aura bodies (joinBodies lowercases it if it ends
    // up as a non-leading clause).
    if (!baseEffectKeys.has(pierce ? 'damage:pierce' : 'damage')) {
      const pcs = pierce ? ' Pierce' : '';
      const t = timesWord(multiHitTimes(fx), scaler);
      return `Deal ${v}${scaler}${pcs}${t}${aoe}`;
    }
    // Bonus added on top of an existing unconditional hit.
    if (!fx.scale && !pierce) return `+${v} damage`;
    if (!fx.scale && pierce) return `+${v} Pierce`;
    return `deal ${v}${scaler}${pierce ? ' Pierce' : ''}${aoe}`;
  }

  // Unconditional damage — "Deal N([str]) [Pierce] [twice/three times] [to all enemies]".
  const times = multiHitTimes(fx);
  const t = timesWord(times, scaler);
  if (pierce) {
    return `Deal ${v}${scaler} Pierce${t}${aoe}`;
  }
  return `Deal ${v}${scaler}${t}${aoe}`;
  void word;
}

// DoT (stack-application) rendering. Scaler goes AFTER the icon —
// "Apply 1[bleed]([dex])", "Apply 3[poison]([int]) to all enemies".
function dotBody(fx: CardEffect, gate: CondGate | null): string {
  const v = fx.value;
  const stk = stackTok(fx.stack);
  const scaler = scalerSuffix(fx);
  const aoe = aoeSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  const perHit = !!fx.per_hit;

  if (fx.target === 'self_dot') {
    if (relative) return `apply ${v}${stk}${scaler} more to yourself`;
    return `Apply ${v}${stk}${scaler} to yourself`;
  }

  if (perHit) {
    if (relative) return `each hit applies ${v} more ${stk}${scaler}`;
    return `each hit applies ${v}${stk}${scaler}`;
  }

  // Per-stack: "apply 1[bleed] per [burn] consumed/on enemy".
  const c = fx.condition ?? {};
  if (c.per_stack && (c.enemy_has_stack || c.self_has_stack)) {
    const src = c.enemy_has_stack ?? c.self_has_stack!;
    const side = c.enemy_has_stack ? 'on enemy' : 'on yourself';
    return `Apply ${v}${stk}${scaler} per ${stackTok(src)} ${side}`;
  }
  if (fx.consume_stack_value) {
    return `Apply ${v}${stk}${scaler} per ${stackTok(fx.consume_stack_value)} ${consumeValuePhrase(fx.consume_stack_value)}`;
  }

  // Relative bonus ("apply N more") drops any AoE suffix — the base clause it adds
  // onto already established the "to all enemies" scope.
  if (relative) return `apply ${v} more ${stk}${scaler}`;
  return `Apply ${v}${stk}${scaler}${aoe}`;
}

// Heal rendering — "Heal N([spi])".
function healBody(fx: CardEffect, gate: CondGate | null): string {
  const v = fx.value;
  const scaler = scalerSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  if (fx.consume_stack_value) {
    return `Heal ${v}${scaler} per ${stackTok(fx.consume_stack_value)} ${consumeValuePhrase(fx.consume_stack_value)}`;
  }
  if (relative) return `heal ${v}${scaler} more`;
  return `Heal ${v}${scaler}`;
}

// Armor rendering — "Gain N[armor]([vit])".
function armorBody(fx: CardEffect, gate: CondGate | null): string {
  const v = fx.value;
  const scaler = scalerSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  if (relative) return `gain ${v} more [armor]${scaler}`;
  return `Gain ${v}[armor]${scaler}`;
}

// Stack (raw apply/grant, not a DoT) rendering.
function stackBody(fx: CardEffect, gate: CondGate | null): string {
  const v = fx.value;
  const stk = stackTok(fx.stack);
  const scaler = scalerSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);

  // Spread: "for each 2[poison] applied, apply 1[poison] to up to N other enemies".
  if (fx.spread) {
    const pct = Math.round(fx.spread.ratio * 100);
    const max = fx.spread.max_targets ? ` to up to ${fx.spread.max_targets} other enemies` : '';
    return `${pct}% of enemy's ${stk} spreads${max}`;
  }

  // Ungated consumes are stated by the leading "Consume N [stack]" clause
  // (skipped upstream by isPureConsumeStack). A GATED consume reaches here so
  // it folds into its condition sentence ("...and consume N [rage]").
  if (fx.consume_stack) return `consume ${consumeAmountFx(fx)} ${stk}`;

  // Cross-stack source ("value 0 + scale.source: self_stack").
  if (v === 0 && fx.scale?.source === 'self_stack' && fx.scale.stack) {
    return `Apply 1${stk}${scaler} per ${stackTok(fx.scale.stack)} on yourself`;
  }

  // Rage gain (target self) — special §11.H Wrathshell Vow places scaler
  // BEFORE the icon: "Gain 6([str])[rage]". The visual "rage is something
  // you carry" reads better this way.
  if (fx.target === 'self' && fx.stack === 'rage') {
    if (relative) return `gain ${v}${scaler} more ${stk}`;
    if (v >= 0) return `Gain ${v}${scaler}${stk}`;
    return `Lose ${Math.abs(v)}${scaler}${stk}`;
  }

  // Per-stack: "Apply N[stack] for each [src] on enemy/yourself".
  const cps = fx.condition ?? {};
  if (cps.per_stack && (cps.enemy_has_stack || cps.self_has_stack)) {
    const src = cps.enemy_has_stack ?? cps.self_has_stack!;
    const side = cps.enemy_has_stack ? 'on enemy' : 'on yourself';
    return `Apply ${v}${stk}${scaler} per ${stackTok(src)} ${side}`;
  }

  const aoe = aoeSuffix(fx);
  // Generic stack application. Scaler glues AFTER the icon.
  if (relative) return `apply ${v} more ${stk}${scaler}${aoe}`;
  return `Apply ${v}${stk}${scaler}${aoe}`;
}

// Stamina/mana rendering.
function resourceBody(fx: CardEffect): string {
  const tok = fx.type === 'stamina' ? '[stam]' : '[mana]';
  if (fx.value === 0) return '';
  const scaler = scalerSuffix(fx);
  if (fx.value < 0) return `Lose ${Math.abs(fx.value)}${tok}${scaler}`;
  return `Gain ${fx.value}${tok}${scaler}`;
}

// Cross-stack converter rendering. The consumed cost is stated explicitly:
// ungated converts emit a leading "Consume N [from]" clause (buildConsumeClauses)
// and this body describes only the production; a GATED convert folds the cost
// inline so it stays attached to the condition ("Consume 5 [bleed] and apply...").
function convertBody(fx: CardEffect, gate: CondGate | null): string {
  const from = stackTok(fx.from);
  // `fx.to` is typed as StackId but a few JSON entries use "armor" as a
  // pseudo-target — bypass the union via string comparison.
  const toStr = String(fx.to ?? '');
  const isArmor = toStr === 'armor';
  const to = isArmor ? '[armor]' : stackTok(fx.to);
  const amount = consumeAmount(fx.value ?? 0);

  // Self-target convert into a stack with no hero-side pool (the hero only has
  // rage/burn/bleed/armor) silently discards the produced stack — so it is a
  // pure consume with no payoff. Describe it honestly rather than promising a
  // stack that never lands.
  if (fx.target === 'self' && !['rage', 'burn', 'bleed', 'armor'].includes(toStr)) {
    return `Consume ${amount} ${from} (no ${to} is produced)`;
  }

  const factor = fx.factor && fx.factor !== 1 ? fx.factor : 1;
  const cap = fx.cap !== undefined ? ` (max ${fx.cap})` : '';
  // The convert scaler scales the per-consumed FACTOR, so the sentinel must be
  // keyed to the displayed lead number — NOT fx.value (which is the "spend N"
  // amount; 99 == spend-all). Use statScaleInline with that lead.

  // Production clause. The "([stat])" scaler glues AFTER the token, matching
  // the stack-application convention ("Apply 2[bleed]([dex])").
  let out: string;
  if (amount === 'all') {
    // Spend-all variant: "Apply N[to] per [from] consumed" (factor scales).
    // Brine fold states the consume inline ("Consume all [from] and apply ...").
    const lead = brineFold && !isArmor ? `Consume all ${from} and apply` : (isArmor ? 'Gain' : 'Apply');
    out = isArmor
      ? `Gain 1${to}${statScaleInline(fx, 1)} per ${from} consumed${cap}`
      : `${lead} ${factor}${to}${statScaleInline(fx, factor)} per ${from} consumed${cap}`;
  } else {
    // Fixed-amount variant — the leading/gate "Consume N [from]" states the cost.
    const N = Number(amount);
    out = isArmor
      ? `Gain ${N}${to}${statScaleInline(fx, N)}${cap}`
      : `Apply ${N * factor}${to}${statScaleInline(fx, N * factor)}`;
  }

  // Gated converts fold the consume cost into the condition sentence.
  if (gate) return `Consume ${amount} ${from} and ${lcFirst(out)}`;
  return out;
}

// Multiply_stack rendering ("double the [poison] on enemy").
function multiplyBody(fx: CardEffect): string {
  const stk = stackTok(fx.stack);
  const factor = fx.factor ?? 2;
  const onWho = fx.target === 'self' ? 'on yourself' : 'on enemy';
  if (factor === 2) return `double the ${stk} ${onWho}`;
  return `multiply ${stk} ${onWho} by ${factor}`;
}

// Stack_boost rendering. Runtime adds value×(current stacks), i.e. multiplies
// the total by (1 + value) — see CardResolver stack_boost (add = value*cur).
// So value:1 doubles, value:2 triples. Render that, not a misleading "Add N".
function stackBoostBody(fx: CardEffect): string {
  const stk = stackTok(fx.stack);
  const onWho = fx.target === 'self' ? 'on yourself' : 'on enemy';
  const factor = (fx.value ?? 0) + 1;
  if (factor === 2) return `double the ${stk} ${onWho}`;
  if (factor === 3) return `triple the ${stk} ${onWho}`;
  return `multiply the ${stk} ${onWho} by ${factor}`;
}

// cd_debt / devour / debuff / buff / debuff_stat.
function cdDebtBody(fx: CardEffect): string {
  // cd_debt pushes the extra seconds onto THIS card's next cooldown (see
  // CardResolver 'cd_debt' case), not the next card played — phrase it accurately.
  return `This card delays ${fx.value} more seconds next time`;
}
function buffBody(fx: CardEffect): string {
  const stat = fx.scale?.stat ? statTok(fx.scale.stat) : '';
  const sign = fx.value >= 0 ? '+' : '';
  return `${sign}${fx.value} ${stat}`;
}
function debuffStatBody(fx: CardEffect): string {
  const stat = fx.scale?.stat ? statTok(fx.scale.stat) : 'a stat';
  return `enemy has −${fx.value} ${stat}`;
}

// Permanent per-combat stat boost — "Gain N[stat] this combat (max M per combat)".
function statGainBody(fx: CardEffect, gate: CondGate | null): string {
  const st = statTok(fx.stat);
  // The "(max M per combat)" note is only meaningful when one play can't reach the
  // cap. When the grant already equals/exceeds the cap it fires once regardless, so
  // the parenthetical is noise — drop it.
  const cap = (fx.max_per_combat !== undefined && Math.abs(fx.value) < fx.max_per_combat)
    ? ` (max ${fx.max_per_combat} per combat)`
    : '';
  const lead = `${fx.value}${st}`;
  if (useRelativePhrasing(fx, gate)) return `gain ${lead} this combat${cap}`;
  return `Gain ${lead} this combat${cap}`;
}
function debuffBody(fx: CardEffect): string {
  return `enemy has −${fx.value} Defense`;
}

// -- Aura formatting ----------------------------------------------------

/** Lowercases the first character of `s` (leaves the rest alone). Used to
 *  splice a sub-effect body into a larger prose clause like
 *  "For 15 seconds: every 2 seconds, <body>". */
function lcFirst(s: string): string {
  if (!s) return s;
  return s[0].toLowerCase() + s.slice(1);
}

function effectListBody(then: CardEffect | CardEffect[] | undefined): string {
  if (!then) return '';
  const arr = Array.isArray(then) ? then : [then];
  return arr
    .map((e) => {
      const f = fragmentForEffect(e);
      if (!f.body) return f.gatePrefix ?? '';
      // Preserve the condition gate on a `then` payload (e.g. a tick heal that
      // only fires below 50% HP) instead of silently dropping it.
      return f.gatePrefix ? `${f.gatePrefix}: ${f.body}` : f.body;
    })
    .filter(Boolean)
    .join(' and ');
}

// Prose for an event_counter aura's trigger condition. "if you apply [bleed]
// 3+ times", "each time you lose [HP]", "if you gain 12+ [armor]", etc.
function eventCounterPhrase(ec: NonNullable<CardEffect['event_counter']>): string {
  const stack = ec.filter?.stack;
  const minAmt = ec.filter?.min_amount;
  const n = ec.threshold ?? 1;
  const each = !!ec.repeat || n <= 1;
  switch (ec.event) {
    case 'armor_gained':
      return minAmt ? `if you gain at least ${minAmt}[armor]` : 'if you gain [armor]';
    case 'card_played':
      return `if you play ${n} or more cards`;
    case 'stack_applied':
      return `if you apply ${stackTok(stack)} ${n}+ times`;
    case 'stack_consumed':
      return `if you consume ${minAmt ?? n}+ ${stackTok(stack)}`;
    case 'hp_lost':
      return each ? 'each time you lose [HP]' : `if you lose [HP] ${n}+ times`;
    case 'heal_received':
      return each ? 'each time you heal' : `if you heal ${n}+ times`;
    default:
      return '';
  }
}

function auraTriggerPhrase(fx: CardEffect): string {
  switch (fx.trigger) {
    case 'on_hit_dealt':       return 'every time you hit an enemy';
    case 'on_hit_taken':       return 'every time you take damage';
    case 'on_self_damage':     return 'every time you lose [HP]';
    case 'on_self_dot_tick':   return 'every time a self DoT ticks';
    case 'on_slow_applied':    return 'every time you apply [slow]';
    case 'on_armor_gained': {
      const n = fx.min_amount ?? 1;
      return `every time you gain at least ${n}[armor]`;
    }
    case 'on_kill_with_stack': {
      const s = stackTok(fx.threshold_stack);
      return `every time you kill an enemy with ${s}`;
    }
    case 'on_stack_threshold': {
      const s = stackTok(fx.threshold_stack);
      const t = fx.threshold ?? 0;
      return `if you have ${t} or more ${s}`;
    }
    case 'on_enemy_stack_threshold': {
      const s = stackTok(fx.threshold_stack);
      const t = fx.threshold ?? 0;
      return `if enemy has ${t} or more ${s}`;
    }
    case 'on_hp_pct_below': {
      const th = fx.threshold ?? 50;
      // The aura arms once and self-removes on its first sub-threshold trigger
      // (single-shot), so phrase it as a one-time drop, not a sustained "while".
      return `the first time you drop below ${th}%[HP]`;
    }
    default: return '';
  }
}

function formatModifierAura(fx: CardEffect, dur: string, secs: number): string {
  const k = fx.modifier!.kind;
  const v = fx.modifier!.value;
  if (k === 'cd_reduction') {
    const pct = Math.round(v * 100);
    return secs > 0 ? `Haste ${pct}% for ${secs} seconds` : `Haste ${pct}%`;
  }
  if (k === 'def') {
    if (fx.target === 'enemy') return `${dur}, enemy has −${Math.abs(v)} Defense`;
    const sign = v >= 0 ? '+' : '';
    return `${dur}, ${sign}${v} Defense`;
  }
  if (k === 'damage_taken_pct') {
    const pct = Math.round(Math.abs(v) * 100);
    const phrase = v < 0 ? `take ${pct}% less damage` : `take ${pct}% more damage`;
    return secs > 0 ? `${dur}, ${phrase}` : phrase;
  }
  if (k === 'damage_dealt_pct') {
    const pct = Math.round(Math.abs(v) * 100);
    const phrase = v >= 0 ? `deal ${pct}% more damage` : `deal ${pct}% less damage`;
    return `${dur}, ${phrase}`;
  }
  if (k === 'burn_taken')      return `${dur}, enemy takes +${v} from [burn]`;
  if (k === 'armor_bonus_pct') return `${dur}, every [armor] you gain is +${Math.round(v * 100)}%`;
  if (k === 'armor_bonus_flat') return `${dur}, every [armor] you gain is +${v}`;
  if (k === 'hero_hit_bonus') {
    const stk = fx.modifier!.stack;
    return stk
      ? `${dur}, every attack deals ${v} more damage per ${stackTok(stk)}`
      : `${dur}, every attack deals ${v} more damage`;
  }
  if (k === 'ignore_immunity') {
    const s = fx.modifier!.stack ? stackTok(fx.modifier!.stack) : '';
    return `${dur}, ignore enemy ${s} immunity`;
  }
  if (k === 'fire_damage_taken_pct') {
    return `${dur}, enemy takes +${Math.round(Math.abs(v) * 100)}% [fire] damage`;
  }
  if (k === 'stack_gain_mult') {
    const s = fx.modifier!.stack ? stackTok(fx.modifier!.stack) : '';
    const pct = Math.round(v * 100);
    return v === 1 ? `${dur}, double all ${s} gained` : `${dur}, ${s} gains +${pct}%`;
  }
  const sign = v >= 0 ? '+' : '';
  return `${dur}, ${sign}${v}${statTok(k)}`;
}

function formatEventCounterAura(fx: CardEffect, dur: string): string {
  const phrase = eventCounterPhrase(fx.event_counter!);
  const body = lcFirst(effectListBody(fx.then));
  const clause = phrase ? `${phrase}, ${body}` : body;
  return dur ? `${dur}, ${clause}` : clause;
}

function formatTickAura(fx: CardEffect, dur: string): string {
  const interval = fx.tick_ms! / 1000;
  const intervalStr = interval === Math.floor(interval) ? `${interval}` : interval.toFixed(1);
  const unit = interval === 1 ? 'second' : 'seconds';
  return `${dur}, every ${intervalStr} ${unit}, ${lcFirst(effectListBody(fx.then))}`;
}

function formatTriggerAura(fx: CardEffect, dur: string): string {
  const trigPhrase = auraTriggerPhrase(fx);
  if (!trigPhrase) return dur || '';
  const body = lcFirst(effectListBody(fx.then));
  const cd = fx.cooldown_ms ? ` No more than once every ${Math.round(fx.cooldown_ms / 1000)} seconds.` : '';
  const trig = fx.trigger;
  if (trig === 'on_stack_threshold' || trig === 'on_enemy_stack_threshold') {
    return `${trigPhrase}: ${body}${cd}`;
  }
  if (dur) return `${dur}, ${trigPhrase}, ${body}${cd}`;
  return `${trigPhrase}: ${body}${cd}`;
}

// Format an aura effect into prose. Returns the body without a trailing period.
function formatAura(fx: CardEffect): string {
  const combatLong = fx.ttl_ms === null || (typeof fx.ttl_ms === 'number' && fx.ttl_ms >= 999999);
  const secs = (!combatLong && fx.ttl_ms) ? Math.round((fx.ttl_ms as number) / 1000) : 0;
  let dur: string;
  if (combatLong)    dur = 'For the rest of combat';
  else if (secs > 0) dur = `For ${secs} seconds`;
  else               dur = '';
  const trig = fx.trigger;

  if (trig === 'on_armor_break')                                            return `Brace: ${effectListBody(fx.then)}`;
  if (fx.event_counter)                                                     return formatEventCounterAura(fx, dur);
  if ((!trig || trig === 'passive_armor_scaler') && fx.modifier && !fx.tick_ms) return formatModifierAura(fx, dur, secs);
  if (!trig && fx.tick_ms && fx.then)                                       return formatTickAura(fx, dur);
  return formatTriggerAura(fx, dur);
}

// -- Single-effect fragment --------------------------------------------

interface Fragment {
  /** Condition-gate signature ("vengeance", "armor:10", null = unconditional). */
  gateKey: string | null;
  /** Prose prefix when the gate fires (no trailing colon). */
  gatePrefix: string | null;
  /** Inner body without the gate. */
  body: string;
  /** True if this fragment should NOT be merged into a sibling sentence. */
  standalone?: boolean;
}

function fragmentForEffect(fx: CardEffect): Fragment {
  // A folded detonator states its own consume + scaling inline ("Consume all [X]
  // and deal N per [X] consumed"), so its enemy_has_stack gate is redundant — the
  // per-consumed value is already zero when the enemy has none. Drop the gate.
  const folded = fx.type === 'damage' && !!fx.consume_stack_value && detonatorFold.has(fx.consume_stack_value);
  const gate = folded ? null : condFromEffect(fx);
  const gateKey = gate?.key ?? null;
  const gatePrefix = gate?.prefix ?? null;

  let body: string;
  switch (fx.type) {
    case 'damage':       body = damageBody(fx, gate); break;
    case 'dot':          body = dotBody(fx, gate); break;
    case 'heal':         body = healBody(fx, gate); break;
    case 'armor':        body = armorBody(fx, gate); break;
    case 'stack':        body = stackBody(fx, gate); break;
    case 'stamina':
    case 'mana':         body = resourceBody(fx); break;
    case 'aura':         body = formatAura(fx); break;
    case 'convert_stack':body = convertBody(fx, gate); break;
    case 'multiply_stack':body = multiplyBody(fx); break;
    case 'stack_boost':  body = stackBoostBody(fx); break;
    case 'cd_debt':      body = cdDebtBody(fx); break;
    case 'debuff':       body = debuffBody(fx); break;
    case 'buff':         body = buffBody(fx); break;
    case 'debuff_stat':  body = debuffStatBody(fx); break;
    case 'stat_gain':    body = statGainBody(fx, gate); break;
    case 'devour':
      // exhaust_next variant has its own prose; deck-card devour is consumed
      // by the devour_succeeded gate elsewhere and prints nothing here.
      body = fx.devour?.exhaust_next ? 'Exhaust the next card in order' : '';
      break;
    default:
      body = '';
  }
  // Overload self-penalty: append the lockout note to the resolved body.
  if (fx.overload_lockout_ms && body) {
    const s = Math.round(fx.overload_lockout_ms / 1000);
    body = `${body} and this card delays ${s} more seconds next time`;
  }
  return { gateKey, gatePrefix, body };
}

/** Public per-effect formatter — used by synergy detection and tests. */
export function formatEffect(fx: CardEffect): string {
  const frag = fragmentForEffect(fx);
  if (!frag.body) return frag.gatePrefix ?? '';
  if (frag.gatePrefix) {
    // Capitalize the body's first character if the gate prefix is set, since
    // "Vengeance: deal 3 more" requires the body to be lowercase. The body
    // formatters already produce lowercase for relative/conditional cases.
    return `${frag.gatePrefix}: ${frag.body}`;
  }
  return frag.body;
}

// -- Top-level card formatter ------------------------------------------

type CardDescPick = Pick<CardDefinition, 'effects' | 'exhaust' | 'spend_armor'>;

export interface CardDescOptions {
  /** When false, strip the "([stat])" scaler suffixes from the prose. Default
   *  true (preserves the canonical output every existing caller/test relies on). */
  showScalers?: boolean;
  /** Dynamic scaled-value mode. When provided, every scaled number is shown
   *  RESOLVED against `stats` (as a [[v:N:stat]] token the card renderer draws
   *  bigger + colored) by default, or as the "(base + inc per [stat])" equation
   *  while `shift` is true. This is what the card face passes. */
  dynamic?: { stats: Record<StatId, number>; shift: boolean };
}

/** Matches a stat-scaler suffix like "([str])" / "([dex])". Used to strip
 *  scalers from the prose when showScalers is false. */
const SCALER_SUFFIX_RE = /\(\[(?:str|vit|dex|int|spi)\]\)/g;

/** Reads the named stat from a partial stats record (missing = 0). */
function statValue(stats: Record<StatId, number>, stat: string): number {
  return (stats as Record<string, number>)[stat] ?? 0;
}

/**
 * Rewrite the sentinel-bearing build output into the final dynamic prose. Each
 * scaled clause is "<number><descriptor><sentinel base:inc:per:stat>", where the
 * descriptor is whatever the scaler attaches to (an icon and/or words like
 * " more [armor]"). The number is replaced in place — by the resolved value
 * token (default) or the "(base + inc per [stat])" equation (SHIFT) — and the
 * descriptor is preserved. `descriptor` excludes digits and sentinels so it
 * binds to the NEAREST preceding number. Any leftover sentinel or body-driven
 * "([stat])" we don't transform is then stripped.
 */
function applyDynamicReplacements(
  out: string,
  stats: Record<StatId, number>,
  shift: boolean,
): string {
  // \x01 / \x02 are SENT_OPEN / SENT_CLOSE.
  const re = /(\d+)([^\x01\x02\d]*?)\x01(-?\d+):(-?\d+):(\d+):(str|vit|dex|int|spi)\x02/g;
  let result = out.replace(re, (_m, _num, mid, base, inc, per, stat) => {
    const b = Number.parseInt(base, 10);
    const i = Number.parseInt(inc, 10);
    const p = Number.parseInt(per, 10);
    const desc = mid ?? '';
    if (shift) {
      const perStr = p > 1 ? `${p} ` : '';
      // base 0 (value:0 detonators) reads as a pure per-stat rate, no "0 +".
      const lhs = b === 0 ? '' : `${b} + `;
      return `(${lhs}${i} per ${perStr}[${stat}])${desc}`;
    }
    const resolved = b + Math.floor(statValue(stats, stat) / p) * i;
    return `[[v:${resolved}:${stat}]]${desc}`;
  });
  // Strip any leftover sentinels and any body-driven "([stat])" we don't transform.
  result = result
    .replace(/\x01[^\x02]*\x02/g, '')
    .replace(SCALER_SUFFIX_RE, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ \./g, '.')
    .trim();
  return result;
}

// -- Explicit consume-cost clauses -------------------------------------

/** "all" for the spend-all sentinel (|value| >= 99), else the absolute count.
 *  Cards encode "consume everything" as value -99 / -999 / 99. */
function consumeAmount(value: number): string {
  return Math.abs(value) >= 99 ? 'all' : String(Math.abs(value));
}

/** Consume-amount label for a consume effect, honoring `consume_fraction`
 *  (partial-consume detonators): 0.5 → "half", other fractions → "NN%", else
 *  falls back to the value-based label ("all" / "N"). */
function consumeAmountFx(fx: { value?: number; consume_fraction?: number }): string {
  if (fx.consume_fraction != null) {
    return fx.consume_fraction === 0.5 ? 'half' : `${Math.round(fx.consume_fraction * 100)}%`;
  }
  return consumeAmount(fx.value ?? 0);
}

/** Trailing phrase for a `consume_stack_value` scaler. "consumed" when the card
 *  truly consumes the pool the snapshot reads; otherwise it just reads the live
 *  count ("on enemy" / "on yourself", per the snapshot side). */
function consumeValuePhrase(stack: string): string {
  if (consumedValueStacks.has(stack)) return 'consumed';
  return (stack === 'rage' || stack.startsWith('hero_')) ? 'on yourself' : 'on enemy';
}

/** Joins icon tokens for one consume sentence: "[a]", "[a] and [b]",
 *  "[a], [b] and [c]". */
function joinTokens(tokens: string[]): string {
  if (tokens.length <= 1) return tokens[0] ?? '';
  if (tokens.length === 2) return `${tokens[0]} and ${tokens[1]}`;
  return `${tokens.slice(0, -1).join(', ')} and ${tokens[tokens.length - 1]}`;
}

/**
 * Build the leading "Consume N [resource]" sentences for everything an UNGATED
 * effect spends: consumed stacks, convert_stack `from`, and spend_armor. Stacks
 * spent at the same amount share one sentence ("Consume all [poison], [bleed]
 * and [burn]"). Gated consumes/converts are excluded here — they fold into
 * their own condition sentence (stackBody / convertBody).
 */
function buildConsumeClauses(card: CardDescPick): string[] {
  const byAmount = new Map<string, string[]>();
  const order: string[] = [];
  const add = (amount: string, token: string): void => {
    if (!byAmount.has(amount)) { byAmount.set(amount, []); order.push(amount); }
    const arr = byAmount.get(amount)!;
    if (!arr.includes(token)) arr.push(token);
  };

  for (const fx of card.effects ?? []) {
    if (fx.condition) continue; // gated → folded into its condition sentence
    if (fx.type === 'stack' && fx.consume_stack && fx.value < 0) {
      // Pyre-keyword cards express the burn consume inline on the detonation
      // clause ("...on enemy, then consume all [burn]"); don't ALSO hoist it to
      // the front, which would imply burn is gone before the per-burn hit reads it.
      if (pyreBurnKeyword && fx.stack === 'burn') continue;
      // Only hoist a consume that fuels a "per [X] consumed" detonator. A
      // standalone consume cost (e.g. Stormrage's rage, which a later effect
      // gates on) renders inline in array order instead — see isPureConsumeStack.
      if (fx.stack && !consumeValueFuel.has(fx.stack)) continue;
      // A folded / collapsed detonator states its own consume inline, so don't
      // ALSO hoist a leading "Consume all [X]".
      if (fx.stack && detonatorFold.has(fx.stack)) continue;
      if (fx.stack && multiDetonator && multiDetonator.stacks.includes(fx.stack)) continue;
      add(consumeAmountFx(fx), stackTok(fx.stack));
    } else if (fx.type === 'convert_stack' && fx.from) {
      // Brine fold states the convert's consume inline on the production clause.
      if (brineFold) continue;
      add(consumeAmount(fx.value ?? 0), stackTok(fx.from));
    }
  }
  if (card.spend_armor !== undefined) {
    add(card.spend_armor === 'all' ? 'all' : String(card.spend_armor), '[armor]');
  }

  return order.map(amount => `Consume ${amount} ${joinTokens(byAmount.get(amount)!)}`);
}

/**
 * Skip emitter for UNGATED consume bookkeeping. A consume whose cost is stated
 * by the leading "Consume N [stack]" clause (buildConsumeClauses) — i.e. a Pyre
 * burn consume or a detonator's fuel — would be redundant as a body, so skip it.
 * A standalone consume cost (not detonator fuel, e.g. Stormrage's rage) is NOT
 * skipped: it renders inline in array order via stackBody ("Consume N [rage]"),
 * which keeps it after the effects that gate on that stack. A gated consume is
 * never skipped either — it folds into its condition sentence.
 */
function isPureConsumeStack(fx: CardEffect): boolean {
  if (!(fx.type === 'stack' && !!fx.consume_stack && !fx.spread && !fx.condition)) return false;
  if (pyreBurnKeyword && fx.stack === 'burn') return true;
  return !!fx.stack && consumeValueFuel.has(fx.stack);
}

/** Standalone devour bookkeeping (no condition gate consumers): hide it. */
function isDevourBookkeeping(fx: CardEffect): boolean {
  return fx.type === 'devour';
}

/**
 * Detect whether `effects` contains any condition with `devour_succeeded`. If
 * so, the devour effect itself is consumed by the gate prefix and shouldn't be
 * emitted on its own line.
 */
function hasDevourConsumer(effects: CardEffect[]): boolean {
  return effects.some(fx => fx.condition?.devour_succeeded === true);
}

export function formatCardDescription(card: CardDescPick, options?: CardDescOptions): string {
  const dyn = options?.dynamic;
  // Toggle sentinel emission for the synchronous build, then restore.
  dynamicBuild = !!dyn;
  spendingArmor = card.spend_armor !== undefined;
  baseEffectKeys = collectBaseEffectKeys(card.effects);
  const fxs = card.effects ?? [];
  pyreBurnKeyword = fxs.some(
    (fx) => fx.type === 'damage' && fx.condition?.enemy_has_stack === 'burn' && fx.condition?.per_stack === true,
  );
  consumeValueFuel = new Set<string>();
  for (const fx of fxs) {
    if (fx.consume_stack_value) consumeValueFuel.add(fx.consume_stack_value);
  }
  consumedValueStacks = new Set();
  for (const fx of fxs) {
    const x = fx.consume_stack_value;
    if (!x) continue;
    // The snapshot reads the hero pool for rage/hero_*, the enemy pool otherwise.
    const snapshotSide = (x === 'rage' || x.startsWith('hero_')) ? 'self' : 'enemy';
    const consumed = fxs.some((o) => {
      const oSide = o.target === 'self' ? 'self' : 'enemy';
      if (o.type === 'stack' && o.consume_stack && o.stack === x) return oSide === snapshotSide;
      if (o.type === 'convert_stack' && o.from === x) return oSide === snapshotSide;
      return false;
    });
    if (consumed) consumedValueStacks.add(x);
  }
  // Detonator rendering. `consume_stack_value` damage hits that read a stack the
  // card also consumes ("per [X] consumed").
  const csvDamage = fxs.filter((fx) => fx.type === 'damage' && fx.consume_stack_value && consumedValueStacks.has(fx.consume_stack_value));
  multiDetonator = null;
  const detSig = (fx: CardEffect): string =>
    `${fx.value}|${fx.pierce_armor ? 1 : 0}|${fx.scale ? `${fx.scale.stat}:${fx.scale.per}:${fx.scale.value}` : ''}`;
  if (csvDamage.length >= 2 && csvDamage.every((fx) => detSig(fx) === detSig(csvDamage[0]))) {
    // Tremor Detonate: 2+ identical detonators collapse into one "per stack consumed".
    multiDetonator = { stacks: csvDamage.map((fx) => fx.consume_stack_value!), proto: csvDamage[0] };
  }
  detonatorFold = new Map();
  const hasFlatDamage = fxs.some((fx) => fx.type === 'damage' && !fx.condition && !fx.consume_stack_value && (fx.target === 'enemy' || fx.target === 'aoe'));
  if (!multiDetonator && hasFlatDamage) {
    // Single detonator alongside a flat hit (Drowning Lance, Thunderstrike Catalyst):
    // fold the consume into the detonator clause so the flat hit can lead.
    for (const fx of csvDamage) {
      const stk = fx.consume_stack_value!;
      const consume = fxs.find((o) => o.type === 'stack' && o.consume_stack && o.stack === stk && o.value < 0);
      detonatorFold.set(stk, consume ? consumeAmountFx(consume) : 'all');
    }
  }
  brineFold = false;
  for (let i = 0; i < fxs.length - 1; i++) {
    const a = fxs[i], b = fxs[i + 1];
    if (a.type === 'convert_stack' && consumeAmount(a.value ?? 0) === 'all' && a.to && String(a.to) !== 'armor'
        && b.type === 'dot' && b.stack === a.to && b.value === (a.factor ?? 1)) {
      brineFold = true;
    }
  }
  let out: string;
  try {
    out = buildCardDescription(card);
  } finally {
    dynamicBuild = false;
    spendingArmor = false;
    baseEffectKeys = new Set();
    pyreBurnKeyword = false;
    consumeValueFuel = new Set();
    consumedValueStacks = new Set();
    detonatorFold = new Map();
    multiDetonator = null;
    brineFold = false;
  }

  if (dyn) {
    return applyDynamicReplacements(out, dyn.stats, dyn.shift);
  }
  if (options?.showScalers === false) {
    // Drop the "([stat])" clauses and tidy the spacing they leave behind.
    return out
      .replace(SCALER_SUFFIX_RE, '')
      .replace(/ {2,}/g, ' ')
      .replace(/ \./g, '.')
      .trim();
  }
  return out;
}

/** Render key for a "plain" damage effect — one with nothing that changes its
 *  rendering beyond the raw value. Two consecutive effects sharing this key read
 *  identically, so they collapse to "Deal N twice/three times". null = not
 *  collapsible. */
function renderableDamageKey(fx: CardEffect): string | null {
  if (fx.type !== 'damage') return null;
  if (fx.condition || fx.scale || fx.pierce_armor || fx.consume_stack_value || fx.per_hit || fx.multi_hit || fx.overload_lockout_ms) return null;
  if (fx.target !== 'enemy') return null;
  return `damage:${fx.value}`;
}

/** Collapse consecutive identical plain-damage effects into one with multi_hit so
 *  "Deal 4. Deal 4." renders as "Deal 4 twice." Rendering-only; the stored effects
 *  are untouched. Non-collapsible effects keep their original object reference. */
function collapseIdenticalDamage(effects: CardEffect[]): CardEffect[] {
  const out: (CardEffect & { __ck?: string })[] = [];
  for (const fx of effects) {
    const k = renderableDamageKey(fx);
    const last = out[out.length - 1];
    if (k !== null && last && last.__ck === k) {
      last.multi_hit = (last.multi_hit ?? 0) + 1;
      continue;
    }
    if (k !== null) out.push({ ...fx, __ck: k });
    else out.push(fx);
  }
  for (const e of out) delete e.__ck;
  return out;
}

/** The single collapsed clause for a multi-detonator card (Tremor Detonate). */
function multiDetonatorClause(): string {
  const proto = multiDetonator!.proto;
  const lead = proto.value === 0 ? (proto.scale?.value ?? 1) : proto.value;
  const statS = statScaleInline(proto, proto.value);
  const pierceW = proto.pierce_armor ? ' Pierce' : '';
  const tokens = multiDetonator!.stacks.map((s) => stackTok(s));
  return `Consume all ${joinTokens(tokens)} and deal ${lead}${statS}${pierceW} per stack consumed`;
}

// ── Rendering-only effect reorders ────────────────────────────────────────

/** Move a UNIQUE gated relative-bonus next to the base effect it modifies, when an
 *  unrelated clause splits them (Frostbind: Vengeance stun sits after the base stun,
 *  not after the armor). Only fires when the gate appears exactly once, so it can
 *  never split a multi-effect gate (e.g. Razor Cadence's two Vengeance payoffs). */
function reorderUniqueGatedBonus(effects: CardEffect[]): CardEffect[] {
  const out = effects.slice();
  for (let i = 0; i < out.length; i++) {
    const fx = out[i];
    const gate = condFromEffect(fx);
    if (!gate || !useRelativePhrasing(fx, gate)) continue;
    const sameGate = out.filter((o) => { const g = condFromEffect(o); return g !== null && g.key === gate.key; });
    if (sameGate.length !== 1) continue;
    const key = effectBaseKey(fx);
    let baseIdx = -1;
    for (let j = 0; j < i; j++) if (!out[j].condition && effectBaseKey(out[j]) === key) baseIdx = j;
    if (baseIdx === -1 || baseIdx === i - 1) continue;
    out.splice(i, 1);
    out.splice(baseIdx + 1, 0, fx);
    i = baseIdx + 1;
  }
  return out;
}

/** A pure timed stat-buff aura ("For N seconds, +1[dex]") with no trigger/tick/payoff. */
function isStatBuffAura(fx: CardEffect): boolean {
  return fx.type === 'aura' && !!fx.modifier && !fx.trigger && !fx.tick_ms && !fx.event_counter && !fx.then
    && ['str', 'vit', 'dex', 'int', 'spi'].includes(fx.modifier.kind);
}

/** Move lingering stat-buff auras after the instant effects so the timed buff reads
 *  last (Mist Step: heal/stam/slow, then "For 6 seconds, +1[dex]"). */
function moveTrailingStatBuffAura(effects: CardEffect[]): CardEffect[] {
  if (!effects.some(isStatBuffAura)) return effects;
  return [...effects.filter((fx) => !isStatBuffAura(fx)), ...effects.filter(isStatBuffAura)];
}

// ── Sentence-level post-passes (aura merges, AoE scoping) ──────────────────

/** Collapse a Vengeance aura that only extends the duration of an identical base
 *  aura into "Vengeance: +N seconds" (Razor Stance). */
function applyVengeanceDurationExtension(sentences: string[]): string[] {
  return sentences.map((s, i) => {
    const m = s.match(/^Vengeance: For (\d+) seconds, (.+)$/);
    if (!m || i === 0) return s;
    const prev = sentences[i - 1].match(/^For \d+ seconds, (.+)$/);
    if (prev && prev[1] === m[2]) return `Vengeance: +${m[1]} seconds`;
    return s;
  });
}

/** Merge consecutive scaled resource gains sharing a verb + scaler into one
 *  sentence (Crimson Tithe: "Gain 1[stam]([spi]) and 1[mana]([spi])"). */
function mergeScaledResourceGains(sentences: string[]): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    const m = s.match(/^Gain \d+\[(?:stam|mana)\](\(\[[a-z]+\]\))$/);
    const prev = out[out.length - 1];
    if (m && prev) {
      const pm = prev.match(/(\(\[[a-z]+\]\))$/);
      if (/^Gain /.test(prev) && pm && pm[1] === m[1]) {
        out[out.length - 1] = `${prev} and ${s.slice('Gain '.length)}`;
        continue;
      }
    }
    out.push(s);
  }
  return out;
}

/** Longest common prefix of a and b, trimmed back to the last clause boundary
 *  (", " or ": ") so the shared lead-in ends cleanly. "" = nothing mergeable. */
function commonClausePrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const p = a.slice(0, i);
  const cut = Math.max(p.lastIndexOf(', '), p.lastIndexOf(': '));
  return cut === -1 ? '' : p.slice(0, cut + 2);
}

/** Join two clause tails under a shared prefix, eliding a repeated leading verb
 *  when the first tail is simple ("Apply 3[poison] and 2[burn]"). */
function joinTails(prefix: string, tailA: string, tailB: string): string {
  const verb = (t: string): string | null => { const m = t.match(/^(gain|apply|deal) /i); return m ? m[1].toLowerCase() : null; };
  const va = verb(tailA), vb = verb(tailB);
  const simpleA = !tailA.includes(', ') && !tailA.includes('this combat') && !tailA.includes('(max');
  let second: string;
  if (va && vb && va === vb && simpleA) second = tailB.slice(tailB.indexOf(' ') + 1);
  else second = tailB[0].toLowerCase() + tailB.slice(1);
  return `${prefix}${tailA} and ${second}`;
}

/** Merge two adjacent aura sentences sharing a duration / "Brace:" lead-in, or
 *  null if they don't merge. Handles the CRM case (a gated tick clause + a passive
 *  modifier clause) by stating the passive clause first and de-nesting the gate. */
function tryMergeAura(a: string, b: string): string | null {
  const auraLike = (s: string) => s.startsWith('For ') || s.startsWith('Brace: ');
  if (!auraLike(a) || !auraLike(b)) return null;
  if (a.startsWith('For ') !== b.startsWith('For ')) return null;
  const prefix = commonClausePrefix(a, b);
  if (!prefix) return null;
  const tailA = a.slice(prefix.length);
  const tailB = b.slice(prefix.length);
  if (!tailA || !tailB) return null;
  const aGate = tailA.includes(': ');
  const bGate = tailB.includes(': ');
  if (aGate !== bGate) {
    // One tail carries an inner condition gate; state the unconditional clause
    // first, then de-nest the gated one (": Heal" → ", heal").
    const gated = aGate ? tailA : tailB;
    const plain = aGate ? tailB : tailA;
    const fixed = gated.replace(/: ([A-Z])/, (_m, c) => `, ${c.toLowerCase()}`);
    return `${prefix}${plain} and ${fixed[0].toLowerCase()}${fixed.slice(1)}`;
  }
  return joinTails(prefix, tailA, tailB);
}

function mergeAuraSentences(sentences: string[]): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    const prev = out[out.length - 1];
    const merged = prev ? tryMergeAura(prev, s) : null;
    if (merged) out[out.length - 1] = merged;
    else out.push(s);
  }
  return out;
}

/** When every sentence targets all enemies, state the scope once up front
 *  ("To all enemies: ...") instead of repeating "to all enemies" per clause. */
function aoeScopeOnce(sentences: string[]): string[] {
  const SUF = ' to all enemies';
  if (sentences.length < 2) return sentences;
  if (!sentences.every((s) => s.endsWith(SUF) && !s.includes(': '))) return sentences;
  const tails = sentences.map((s) => { const t = s.slice(0, -SUF.length); return t[0].toLowerCase() + t.slice(1); });
  return [`To all enemies: ${tails.join(' and ')}`];
}

function buildCardDescription(card: CardDescPick): string {
  let effects = collapseIdenticalDamage(card.effects ?? []);
  if (!effects.length) return '';
  // Rendering-only reorders for readability.
  effects = reorderUniqueGatedBonus(effects);
  effects = moveTrailingStatBuffAura(effects);

  // Build fragments and skip bookkeeping effects.
  const frags: Fragment[] = [];
  const devourGated = hasDevourConsumer(effects);
  let multiDetonatorEmitted = false;
  let prevWasBrineConvert = false;
  for (const fx of effects) {
    if (isPureConsumeStack(fx)) continue;
    if (devourGated && isDevourBookkeeping(fx)) continue;
    // Multi-detonator: emit one combined clause for the first detonator, skip the rest.
    if (multiDetonator && fx.type === 'damage' && fx.consume_stack_value && multiDetonator.stacks.includes(fx.consume_stack_value)) {
      if (!multiDetonatorEmitted) {
        multiDetonatorEmitted = true;
        frags.push({ gateKey: null, gatePrefix: null, body: multiDetonatorClause() });
      }
      continue;
    }
    // Brine fold: the flat application right after the convert tags onto its clause
    // as ", plus N[stack]" rather than reading "Apply N[stack]" a second time.
    if (brineFold && prevWasBrineConvert && fx.type === 'dot') {
      const body = fragmentForEffect(fx).body.replace(/^Apply /, '');
      if (frags.length) frags[frags.length - 1].body += `, plus ${body}`;
      prevWasBrineConvert = false;
      continue;
    }
    prevWasBrineConvert = false;
    const f = fragmentForEffect(fx);
    if (!f.body) continue;
    frags.push(f);
    if (brineFold && fx.type === 'convert_stack') prevWasBrineConvert = true;
  }

  // Merge consecutive same-gate fragments. The gate prefix is emitted once,
  // and the bodies are joined with " and ". The first body after the gate
  // is lowercased; subsequent bodies are stripped of leading capital and
  // joined with " and ".
  const sentences: string[] = [];
  let pending: { gatePrefix: string | null; bodies: string[] } | null = null;
  const flush = () => {
    if (!pending) return;
    const { gatePrefix, bodies } = pending;
    if (gatePrefix) {
      sentences.push(`${gatePrefix}: ${joinBodies(bodies)}`);
    } else {
      // Each body is its own sentence when unconditional.
      for (const b of bodies) sentences.push(b);
    }
    pending = null;
  };

  for (const f of frags) {
    if (!pending) {
      pending = { gatePrefix: f.gatePrefix, bodies: [f.body] };
      continue;
    }
    if (pending.gatePrefix === f.gatePrefix) {
      pending.bodies.push(f.body);
    } else {
      flush();
      pending = { gatePrefix: f.gatePrefix, bodies: [f.body] };
    }
  }
  flush();

  // Sentence-level simplifications: collapse Vengeance duration-extensions, merge
  // same-verb resource gains, merge same-window / duplicate-gate auras, and state a
  // shared "to all enemies" scope once.
  let finalSentences = applyVengeanceDurationExtension(sentences);
  finalSentences = mergeScaledResourceGains(finalSentences);
  finalSentences = mergeAuraSentences(finalSentences);
  finalSentences = aoeScopeOnce(finalSentences);

  // Card-level keyword prefixes. Exhaust always leads, then the explicit
  // "Consume N [resource]" cost clauses (the card no longer shows cost icons,
  // so every consumed stack / armor must read in prose).
  const leading: string[] = [];
  if (card.exhaust) leading.push('Exhaust');
  leading.push(...buildConsumeClauses(card));

  // Capitalize the first letter of each sentence. Most bodies already lead with
  // a capital; this fixes the lowercase-by-convention ones (multiply_stack /
  // stack_boost: "double the [burn]") when they start a sentence. Words after a
  // gate colon stay lowercase because they're inside a part, not its first char.
  const capFirst = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const parts = [...leading, ...finalSentences].filter(Boolean).map(capFirst);
  if (!parts.length) return '';
  return parts.join('. ') + '.';
}

/**
 * Joins body fragments for a single-gate sentence. The first body keeps its
 * leading case (already lowercased by relative formatters when appropriate);
 * subsequent bodies are lowercased at the leading character.
 */
function joinBodies(bodies: string[]): string {
  if (bodies.length === 0) return '';
  if (bodies.length === 1) return bodies[0];
  // The head keeps its case (relative formatters already lowercase it; a
  // standalone first body stays capitalized, matching the Brace/aura
  // convention). Subsequent bodies join with " and " and are lowercased.
  const head = bodies[0];
  const tail = bodies.slice(1).map(b => b.length === 0 ? b : (b[0].toLowerCase() + b.slice(1)));
  return [head, ...tail].join(' and ');
}

// Re-export the predicate so existing call-sites (CombatScene preview text,
// CardDetailPopup, CardVisual, SynergyDetection, CardFilterBar) can continue
// to use the same entry points without code-flow changes.

void hasBerserkSpend; // retained-name reservation removed; placeholder.
function hasBerserkSpend(_effects: CardEffect[]): boolean { void _effects; return false; }
function isRageConsumeAll(_fx: CardEffect): boolean { void _fx; return false; }
void isRageConsumeAll;
void STACK_TOKEN; void STAT_TOKEN;

// Silence unused-name warning for the legacy types alias used by callers.
export type { CardDefinition, CardEffect, CardEffectCondition, StackId, StatId };
