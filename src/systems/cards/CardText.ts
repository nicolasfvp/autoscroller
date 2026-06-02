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
      prefix: `If enemy has at least ${v}${stackTok(s)}`,
      key: `enemy_stack_at:${s}:${v}`,
      relative: true,
    };
  }
  if (c.self_stack_atleast) {
    const v = c.self_stack_atleast.value;
    const s = c.self_stack_atleast.stack;
    return {
      prefix: `If you have at least ${v}${stackTok(s)}`,
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

/** True for "deal N more" / "apply N more [stack]" wording inside a gate. */
function useRelativePhrasing(fx: CardEffect, gate: CondGate | null): boolean {
  if (!gate) return false;
  if (gate.relative) return true;
  // enemy_has_stack / self_has_stack with scale or pierce read as separate actions.
  const hasScale = !!fx.scale && fx.scale.source !== 'armor';
  if (fx.type === 'damage' && (hasScale || fx.pierce_armor)) return true;
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

  // Self-damage: "Lose N[HP]".
  if (fx.target === 'self') {
    const pcs = pierce ? ' (Pierce)' : '';
    return `Lose ${v}[HP]${pcs}${scaler}`;
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
    if (pierce) {
      return `Deal ${lead}${statS} Pierce per ${stackTok(stk)} consumed${target}`;
    }
    return `Deal ${lead}${statS} per ${stackTok(stk)} consumed${target}`;
  }

  // Armor-source damage: "Deal N([str]) [Pierce] per K[armor] you have/consumed".
  if (fx.scale?.source === 'armor') {
    const per = fx.scale.per ?? 1;
    const inc = fx.scale.value ?? 1;
    const statS = fx.scale.stat ? `(${statTok(fx.scale.stat)})` : '';
    const armorRef = spendingArmor ? 'consumed' : 'you have';
    // "per [armor] consumed" (spend-all) reads cleaner without the "1".
    const perArmor = (per === 1 && spendingArmor)
      ? `[armor] ${armorRef}`
      : `${per}[armor] ${armorRef}`;
    if (v === 0) {
      // "Deal damage equal to your [armor]" / "Deal 2 Pierce per [armor] consumed".
      if (per === 1 && inc === 1 && !pierce && !spendingArmor) {
        return `Deal damage equal to your [armor]`;
      }
      if (pierce) {
        if (per === 1 && inc === 1 && !spendingArmor) return `Deal Pierce per 1[armor] you have${aoe}`;
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

  // Non-relative gated damage with no scale and no pierce → "+N damage".
  if (gate && !relative) {
    if (!fx.scale && !pierce) return `+${v} damage`;
    if (!fx.scale && pierce) return `+${v} Pierce`;
    // Scale + non-relative — treat as relative anyway.
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
    return `Apply ${v}${stk}${scaler} for each ${stackTok(src)} ${side}`;
  }
  if (fx.consume_stack_value) {
    return `Apply ${v}${stk}${scaler} per ${stackTok(fx.consume_stack_value)} consumed`;
  }

  if (relative) return `apply ${v} more ${stk}${scaler}${aoe}`;
  return `Apply ${v}${stk}${scaler}${aoe}`;
}

// Heal rendering — "Heal N([spi])".
function healBody(fx: CardEffect, gate: CondGate | null): string {
  const v = fx.value;
  const scaler = scalerSuffix(fx);
  const relative = useRelativePhrasing(fx, gate);
  if (fx.consume_stack_value) {
    return `Heal ${v}${scaler} per ${stackTok(fx.consume_stack_value)} consumed`;
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

  // consume_stack with value < 0 → handled by buildConsumeSpec; this shouldn't print.
  if (fx.consume_stack) return '';

  // Cross-stack source ("value 0 + scale.source: self_stack").
  if (v === 0 && fx.scale?.source === 'self_stack' && fx.scale.stack) {
    return `Apply 1${stk}${scaler} for each ${stackTok(fx.scale.stack)} on yourself`;
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
    return `Apply ${v}${stk}${scaler} for each ${stackTok(src)} ${side}`;
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

// Cross-stack converter rendering. CARD_AUDIT §11.F drops the "Convert"
// keyword entirely — the body now reads as a per-stack apply ("Apply N[to]
// per [from] consumed", with the consumed stack reflected in the cost block).
function convertBody(fx: CardEffect): string {
  const from = stackTok(fx.from);
  // `fx.to` is typed as StackId but a few JSON entries use "armor" as a
  // pseudo-target — bypass the union via string comparison.
  const toStr = String(fx.to ?? '');
  const isArmor = toStr === 'armor';
  const to = isArmor ? '[armor]' : stackTok(fx.to);
  const amount = (fx.value ?? 0) >= 99 ? 'all' : String(fx.value);
  const factor = fx.factor && fx.factor !== 1 ? fx.factor : 1;
  const cap = fx.cap !== undefined ? ` (max ${fx.cap})` : '';
  // The convert scaler scales the per-consumed FACTOR, so the sentinel must be
  // keyed to the displayed lead number — NOT fx.value (which is the "spend N"
  // amount; 99 == spend-all). Use statScaleInline with that lead.

  // Spend-all variant: "Apply N[to] per [from] consumed" (factor scales).
  if (amount === 'all') {
    if (isArmor) {
      return `Gain 1${statScaleInline(fx, 1)}[armor] per ${from} consumed${cap}`;
    }
    return `Apply ${factor}${statScaleInline(fx, factor)}${to} per ${from} consumed${cap}`;
  }

  // Fixed-amount variant: "Apply N[to] (from consumed [from])".
  const N = Number(amount);
  if (isArmor) {
    return `Gain ${N}${statScaleInline(fx, N)}[armor] (from consumed ${from})${cap}`;
  }
  const outN = N * factor;
  return `Apply ${outN}${statScaleInline(fx, outN)}${to} (from consumed ${from})`;
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
  return `Next card delays ${fx.value} more seconds`;
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
  const cap = fx.max_per_combat !== undefined ? ` (max ${fx.max_per_combat} per combat)` : '';
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
      return minAmt ? `if you gain ${minAmt}+ [armor]` : 'if you gain [armor]';
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
      return `when you reach ${t}${s}`;
    }
    case 'on_enemy_stack_threshold': {
      const s = stackTok(fx.threshold_stack);
      const t = fx.threshold ?? 0;
      return `when enemy has at least ${t}${s}`;
    }
    case 'on_hp_pct_below': {
      const th = fx.threshold ?? 50;
      return `if you have less than ${th}%[HP]`;
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
    if (fx.target === 'enemy') return `${dur}: enemy has −${Math.abs(v)} Defense`;
    const sign = v >= 0 ? '+' : '';
    return `${dur}: ${sign}${v} Defense`;
  }
  if (k === 'damage_taken_pct') {
    const pct = Math.round(Math.abs(v) * 100);
    const phrase = v < 0 ? `take ${pct}% less damage` : `take ${pct}% more damage`;
    return secs > 0 ? `${dur}: ${phrase}` : phrase;
  }
  if (k === 'damage_dealt_pct') {
    const pct = Math.round(Math.abs(v) * 100);
    const phrase = v >= 0 ? `deal ${pct}% more damage` : `deal ${pct}% less damage`;
    return `${dur}: ${phrase}`;
  }
  if (k === 'burn_taken')      return `${dur}: enemy takes +${v} from [burn]`;
  if (k === 'armor_bonus_pct') return `${dur}: every [armor] you gain is +${Math.round(v * 100)}%`;
  if (k === 'armor_bonus_flat') return `${dur}: every [armor] you gain is +${v}`;
  if (k === 'hero_hit_bonus') {
    const stk = fx.modifier!.stack;
    return stk
      ? `${dur}: every attack deals ${v} more damage per ${stackTok(stk)}`
      : `${dur}: every attack deals ${v} more damage`;
  }
  if (k === 'ignore_immunity') {
    const s = fx.modifier!.stack ? stackTok(fx.modifier!.stack) : '';
    return `${dur}: ignore enemy ${s} immunity`;
  }
  if (k === 'fire_damage_taken_pct') {
    return `${dur}: enemy takes +${Math.round(Math.abs(v) * 100)}% [fire] damage`;
  }
  if (k === 'stack_gain_mult') {
    const s = fx.modifier!.stack ? stackTok(fx.modifier!.stack) : '';
    const pct = Math.round(v * 100);
    return v === 1 ? `${dur}: double all ${s} gained` : `${dur}: ${s} gains +${pct}%`;
  }
  const sign = v >= 0 ? '+' : '';
  return `${dur}: ${sign}${v} ${statTok(k)}`;
}

function formatEventCounterAura(fx: CardEffect, dur: string): string {
  const phrase = eventCounterPhrase(fx.event_counter!);
  const body = lcFirst(effectListBody(fx.then));
  const clause = phrase ? `${phrase}, ${body}` : body;
  return dur ? `${dur}: ${clause}` : clause;
}

function formatTickAura(fx: CardEffect, dur: string): string {
  const interval = fx.tick_ms! / 1000;
  const intervalStr = interval === Math.floor(interval) ? `${interval}` : interval.toFixed(1);
  const unit = interval === 1 ? 'second' : 'seconds';
  return `${dur}: every ${intervalStr} ${unit}, ${lcFirst(effectListBody(fx.then))}`;
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
  if (dur) return `${dur}: ${trigPhrase}, ${body}${cd}`;
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
  const gate = condFromEffect(fx);
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
    case 'convert_stack':body = convertBody(fx); break;
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

/**
 * Skip emitter for stack effects that are pure consume bookkeeping. The cost
 * block (rendered separately by the visual layer) shows the consumed amount;
 * the body's per-consumed-stack payoff already names the stack.
 */
function isPureConsumeStack(fx: CardEffect): boolean {
  return fx.type === 'stack' && !!fx.consume_stack && !fx.spread;
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
  let out: string;
  try {
    out = buildCardDescription(card);
  } finally {
    dynamicBuild = false;
    spendingArmor = false;
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

function buildCardDescription(card: CardDescPick): string {
  const effects = card.effects ?? [];
  if (!effects.length) return '';

  // Build fragments and skip bookkeeping effects.
  const frags: Fragment[] = [];
  const devourGated = hasDevourConsumer(effects);
  for (const fx of effects) {
    if (isPureConsumeStack(fx)) continue;
    if (devourGated && isDevourBookkeeping(fx)) continue;
    const f = fragmentForEffect(fx);
    if (!f.body) continue;
    frags.push(f);
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

  // Card-level keyword prefixes (Exhaust). Exhaust always leads.
  const leading: string[] = [];
  if (card.exhaust) leading.push('Exhaust');

  // spend_armor without an armor-source damage effect: prefix the body so the
  // card still reads coherently (rare; today only paired w/ armor-source dmg).
  const hasArmorSourceDamage = effects.some(fx =>
    fx.type === 'damage' && fx.scale?.source === 'armor',
  );
  if (card.spend_armor !== undefined && !hasArmorSourceDamage) {
    leading.push(`Consume all[armor]`);
  }

  // Capitalize the first letter of each sentence. Most bodies already lead with
  // a capital; this fixes the lowercase-by-convention ones (multiply_stack /
  // stack_boost: "double the [burn]") when they start a sentence. Words after a
  // gate colon stay lowercase because they're inside a part, not its first char.
  const capFirst = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const parts = [...leading, ...sentences].filter(Boolean).map(capFirst);
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
