// Pure chip-builder for combat status icons. Given a CombatState, returns the
// list of chips to render under the hero and enemy panels. Phaser-free so the
// transformation is unit-testable in isolation; the visual side (rectangles,
// text objects) lives in CombatHUD.

import type { CombatState } from '../systems/combat/CombatState';
import type { AuraModifierKind } from '../data/types';
import type { ActiveAura } from '../systems/combat/StatusEffects';

export interface EffectChip {
  /** Stable identity (for diff / pool slotting). */
  key: string;
  /** Emoji or short glyph rendered as the chip icon. */
  icon: string;
  /** Value text rendered next to the icon (e.g. "3", "+2 4.0s"). */
  label: string;
  /** Hex color (e.g. "#ff8a3d") applied to the label text. */
  color: string;
  /** Short tooltip / sr-only description (for future hover affordance). */
  tooltip: string;
}

const STACK_META: Record<string, { icon: string; color: string; name: string }> = {
  poison: { icon: '☠', color: '#7ed957', name: 'Poison' },
  bleed:  { icon: '🩸', color: '#ff4d4d', name: 'Bleed' },
  burn:   { icon: '🔥', color: '#ff8a3d', name: 'Burn' },
  stun:   { icon: '💫', color: '#ffe066', name: 'Stun' },
  slow:   { icon: '🐌', color: '#6ec5ff', name: 'Slow' },
  arcane: { icon: '🔮', color: '#c490ff', name: 'Arcane' },
  rage:   { icon: '😡', color: '#ff6b6b', name: 'Rage' },
};

const MOD_META: Record<AuraModifierKind, { icon: string; color: string; name: string }> = {
  str: { icon: '💪', color: '#ff8844', name: 'STR' },
  vit: { icon: '❤', color: '#ff6666', name: 'VIT' },
  dex: { icon: '🍃', color: '#f0a020', name: 'DEX' },
  int: { icon: '🧠', color: '#9966ff', name: 'INT' },
  spi: { icon: '✨', color: '#22cc44', name: 'SPI' },
  def: { icon: '🛡', color: '#9fd6ff', name: 'DEF' },
  cd_reduction: { icon: '⏱', color: '#ffd700', name: 'Haste' },
};

interface AggregatedMod {
  kind: AuraModifierKind;
  totalValue: number;
  maxRemainingMs: number;
}

function aggregateAuras(auras: ActiveAura[] | undefined | null): AggregatedMod[] {
  if (!auras || auras.length === 0) return [];
  const map = new Map<AuraModifierKind, AggregatedMod>();
  for (const a of auras) {
    if (!a.modifier) continue;
    const existing = map.get(a.modifier.kind);
    if (existing) {
      existing.totalValue += a.modifier.value;
      existing.maxRemainingMs = Math.max(existing.maxRemainingMs, a.remainingMs);
    } else {
      map.set(a.modifier.kind, {
        kind: a.modifier.kind,
        totalValue: a.modifier.value,
        maxRemainingMs: a.remainingMs,
      });
    }
  }
  return [...map.values()];
}

function formatSeconds(ms: number): string {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`;
}

function formatModValue(kind: AuraModifierKind, value: number): string {
  if (kind === 'cd_reduction') {
    const pct = Math.round(value * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function computeHeroChips(state: CombatState): EffectChip[] {
  const chips: EffectChip[] = [];

  for (const agg of aggregateAuras(state.heroAuras)) {
    if (agg.totalValue === 0) continue;
    const meta = MOD_META[agg.kind];
    chips.push({
      key: `hero-aura-${agg.kind}`,
      icon: meta.icon,
      label: `${formatModValue(agg.kind, agg.totalValue)} ${formatSeconds(agg.maxRemainingMs)}`,
      color: meta.color,
      tooltip: `${meta.name} buff (${formatSeconds(agg.maxRemainingMs)} left)`,
    });
  }

  let armorBreak = 0;
  let hpBelow = 0;
  if (state.heroAuras) {
    for (const a of state.heroAuras) {
      if (a.trigger === 'on_armor_break') armorBreak++;
      else if (a.trigger === 'on_hp_pct_below') hpBelow++;
    }
  }
  if (armorBreak > 0) {
    chips.push({
      key: 'hero-trigger-armor',
      icon: '🔱',
      label: armorBreak > 1 ? `x${armorBreak}` : 'armed',
      color: '#9fd6ff',
      tooltip: 'Armed: fires when armor breaks',
    });
  }
  if (hpBelow > 0) {
    chips.push({
      key: 'hero-trigger-hp',
      icon: '💔',
      label: hpBelow > 1 ? `x${hpBelow}` : 'armed',
      color: '#ff6666',
      tooltip: 'Armed: fires when HP drops below threshold',
    });
  }

  if (state.rageStacks > 0) {
    const m = STACK_META.rage;
    chips.push({ key: 'hero-rage', icon: m.icon, label: `${state.rageStacks}`, color: m.color, tooltip: `${m.name}: ${state.rageStacks}` });
  }
  if (state.heroBurnStacks > 0) {
    const m = STACK_META.burn;
    chips.push({ key: 'hero-burn', icon: m.icon, label: `${state.heroBurnStacks}`, color: m.color, tooltip: `Self ${m.name}: ${state.heroBurnStacks}` });
  }
  if (state.heroBleedStacks > 0) {
    const m = STACK_META.bleed;
    chips.push({ key: 'hero-bleed', icon: m.icon, label: `${state.heroBleedStacks}`, color: m.color, tooltip: `Self ${m.name}: ${state.heroBleedStacks}` });
  }

  return chips;
}

export function computeEnemyChips(state: CombatState): EffectChip[] {
  const chips: EffectChip[] = [];

  const stackPairs: Array<[keyof typeof STACK_META, number]> = [
    ['poison', state.poisonStacks],
    ['bleed', state.bleedStacks],
    ['burn', state.burnStacks],
    ['stun', state.stunStacks],
    ['slow', state.slowStacks],
    ['arcane', state.arcaneStacks],
  ];
  for (const [k, v] of stackPairs) {
    if (v > 0) {
      const meta = STACK_META[k];
      chips.push({ key: `enemy-${k}`, icon: meta.icon, label: `${v}`, color: meta.color, tooltip: `${meta.name}: ${v}` });
    }
  }

  for (const agg of aggregateAuras(state.enemyAuras)) {
    if (agg.totalValue === 0) continue;
    const meta = MOD_META[agg.kind];
    chips.push({
      key: `enemy-aura-${agg.kind}`,
      icon: meta.icon,
      label: `${formatModValue(agg.kind, agg.totalValue)} ${formatSeconds(agg.maxRemainingMs)}`,
      color: meta.color,
      tooltip: `${meta.name} debuff (${formatSeconds(agg.maxRemainingMs)} left)`,
    });
  }

  return chips;
}
