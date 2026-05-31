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
  return `(${statTok(fx.scale.stat)})`;
}

// -- Targeting helpers --------------------------------------------------

function aoeSuffix(fx: CardEffect): string {
  return fx.target === 'aoe' ? ' to all enemies' : '';
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
      prefix: `If you have less then ${c.hero_hp_pct_below}%[HP]`,
      key: `hp_below:${c.hero_hp_pct_below}`,
      relative: true,
    };
  }
  if (c.hero_hp_pct_atleast !== undefined) {
    return {
      prefix: `If you have more then ${c.hero_hp_pct_atleast}%[HP]`,
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
    const statS = fx.scale?.stat ? `(${statTok(fx.scale.stat)})` : '';
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
    const statS = fx.scale?.stat ? `(${statTok(fx.scale.stat)})` : '';
    if (pierce) {
      return `Deal ${lead}${statS} Pierce per ${stackTok(stk)} consumed${target}`;
    }
    return `Deal ${lead}${statS} per ${stackTok(stk)} consumed${target}`;
  }

  // Armor-source damage: "Deal N([str]) [Pierce] per K[armor] you have".
  if (fx.scale?.source === 'armor') {
    const per = fx.scale.per ?? 1;
    const inc = fx.scale.value ?? 1;
    const statS = fx.scale.stat ? `(${statTok(fx.scale.stat)})` : '';
    if (v === 0) {
      // "Deal damage equal to your [armor]" / "Deal 2 Pierce per 1[armor]..."
      if (per === 1 && inc === 1 && !pierce) {
        return `Deal damage equal to your [armor]`;
      }
      if (pierce) {
        if (per === 1 && inc === 1) return `Deal Pierce per 1[armor] you have`;
        return `Deal ${inc}${statS} Pierce per ${per}[armor] you have`;
      }
      return `Deal ${inc}${statS} damage per ${per}[armor] you have`;
    }
    const w = pierce ? ' Pierce' : '';
    return `Deal ${v}${w}, +${inc}${statS} damage per ${per}[armor] you have${aoe}`;
  }

  // Relative phrasing inside a gate — "deal N([str]) more [Pierce]".
  if (relative) {
    const pcs = pierce ? ' Pierce' : '';
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
  const aoe = fx.target === 'aoe' ? ' to all enemies' : '';
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

  // Generic stack application. Scaler glues AFTER the icon.
  if (relative) return `apply ${v} more ${stk}${scaler}`;
  return `Apply ${v}${stk}${scaler}`;
}

// Stamina/mana rendering.
function resourceBody(fx: CardEffect): string {
  const tok = fx.type === 'stamina' ? '[stam]' : '[mana]';
  if (fx.value === 0) return '';
  const sign = fx.value > 0 ? '+' : '-';
  return `Gain ${sign === '+' ? '' : '-'}${Math.abs(fx.value)}${tok}`.replace(/Gain -/, 'Lose ');
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
  const scaler = scalerSuffix(fx);

  // Spend-all variant: "Apply N[to] per [from] consumed" (factor scales).
  if (amount === 'all') {
    if (isArmor) {
      return `Gain 1${scaler}[armor] per ${from} consumed${cap}`;
    }
    const perOutput = factor === 1
      ? `Apply 1${scaler}${to}`
      : `Apply ${factor}${scaler}${to}`;
    return `${perOutput} per ${from} consumed${cap}`;
  }

  // Fixed-amount variant: "Apply N[to] (from consumed [from])".
  const N = Number(amount);
  if (isArmor) {
    return `Gain ${N}${scaler}[armor] (from consumed ${from})${cap}`;
  }
  const outN = N * factor;
  return `Apply ${outN}${scaler}${to} (from consumed ${from})`;
}

// Multiply_stack rendering ("double the [poison] on enemy").
function multiplyBody(fx: CardEffect): string {
  const stk = stackTok(fx.stack);
  const factor = fx.factor ?? 2;
  const onWho = fx.target === 'self' ? 'on yourself' : 'on enemy';
  if (factor === 2) return `double the ${stk} ${onWho}`;
  return `multiply ${stk} ${onWho} by ${factor}`;
}

// Stack_boost rendering ("Add N to every [burn] on enemy").
function stackBoostBody(fx: CardEffect): string {
  const stk = stackTok(fx.stack);
  const scaler = scalerSuffix(fx);
  const onWho = fx.target === 'self' ? 'on yourself' : 'on enemy';
  return `Add ${fx.value}${scaler} to every ${stk} ${onWho}`;
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
  return arr.map((e) => fragmentForEffect(e).body).filter(Boolean).join(' and ');
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
      return `if you have less then ${th}%[HP]`;
    }
    default: return '';
  }
}

// Format an aura effect into prose. Returns the body without a trailing period.
function formatAura(fx: CardEffect): string {
  const secs = fx.ttl_ms ? Math.round((fx.ttl_ms as number) / 1000) : 0;
  const dur = secs > 0 ? `For ${secs} seconds` : (fx.ttl_ms === null ? 'For the rest of combat' : '');
  const trig = fx.trigger;

  // Brace — kept keyword. Brace duration is omitted from prose.
  if (trig === 'on_armor_break') {
    const body = effectListBody(fx.then);
    return `Brace: ${body}`;
  }

  // Modifier-only auras: Haste / DR (damage_taken_pct) / Empower (damage_dealt_pct) / Reforce (armor_bonus_pct) / Vulnerable / etc.
  if (!trig && fx.modifier && !fx.tick_ms) {
    const k = fx.modifier.kind;
    const v = fx.modifier.value;
    if (k === 'cd_reduction') {
      const pct = Math.round(v * 100);
      return secs > 0 ? `Haste ${pct}% for ${secs} seconds` : `Haste ${pct}%`;
    }
    if (k === 'def') {
      if (fx.target === 'enemy') {
        return `${dur}: enemy has −${Math.abs(v)} Defense`;
      }
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
    if (k === 'burn_taken') {
      return `${dur}: enemy takes +${v} from [burn]`;
    }
    if (k === 'armor_bonus_pct') {
      return `${dur}: every [armor] you gain is +${Math.round(v * 100)}%`;
    }
    if (k === 'armor_bonus_flat') {
      return `${dur}: every [armor] you gain is +${v}`;
    }
    if (k === 'hero_hit_bonus') {
      if (fx.modifier.stack) {
        return `${dur}: every attack deals ${v} more damage per ${stackTok(fx.modifier.stack)}`;
      }
      return `${dur}: every attack deals ${v} more damage`;
    }
    if (k === 'ignore_immunity') {
      const s = fx.modifier.stack ? stackTok(fx.modifier.stack) : '';
      return `${dur}: ignore enemy ${s} immunity`;
    }
    // Stat-axis modifier: +N [stat].
    const sign = v >= 0 ? '+' : '';
    return `${dur}: ${sign}${v} ${statTok(k)}`;
  }

  // Tick-only periodic aura: "For Ns: every Ks, <effects>". The body that
  // follows the "every Ks," prose comes from a sub-effect formatter that
  // capitalises by default — lowercase it for inline reading.
  if (!trig && fx.tick_ms && fx.then) {
    const interval = fx.tick_ms / 1000;
    const intervalStr = (interval === Math.floor(interval)) ? `${interval}` : interval.toFixed(1);
    const body = lcFirst(effectListBody(fx.then));
    return `${dur}: every ${intervalStr} seconds, ${body}`;
  }

  // Trigger-driven aura.
  const trigPhrase = auraTriggerPhrase(fx);
  if (trigPhrase) {
    const body = lcFirst(effectListBody(fx.then));
    const cd = fx.cooldown_ms ? ` No more than once every ${Math.round(fx.cooldown_ms / 1000)} seconds.` : '';
    // Threshold triggers don't need an enclosing duration (they're keyed off state).
    if (trig === 'on_stack_threshold' || trig === 'on_enemy_stack_threshold') {
      return `${trigPhrase}: ${body}${cd}`;
    }
    if (dur) return `${dur}: ${trigPhrase}, ${body}${cd}`;
    return `${trigPhrase}: ${body}${cd}`;
  }

  // Empty aura wrapper (no trigger, no modifier, no tick): rare; just emit duration.
  return dur || '';
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
    case 'devour':       body = ''; break; // Handled by gate (devour_succeeded).
    default:
      body = '';
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

export function formatCardDescription(card: CardDescPick): string {
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

  const parts = [...leading, ...sentences].filter(Boolean);
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
