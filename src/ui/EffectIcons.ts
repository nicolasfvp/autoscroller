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
  /** Phaser texture key for the icon image (e.g. "icon_burn"). */
  iconKey: string;
  /** Value text rendered next to the icon (e.g. "3", "+2 4.0s"). */
  label: string;
  /** Hex color (e.g. "#ff8a3d") applied to the label text. */
  color: string;
  /** Short tooltip / sr-only description (for future hover affordance). */
  tooltip: string;
}

const STACK_META: Record<string, { iconKey: string; color: string; name: string }> = {
  poison: { iconKey: 'icon_poison',  color: '#7ed957', name: 'Poison' },
  bleed:  { iconKey: 'icon_bleed',   color: '#ff4d4d', name: 'Bleed' },
  burn:   { iconKey: 'icon_burn',    color: '#ff8a3d', name: 'Burn' },
  stun:   { iconKey: 'icon_stun',    color: '#ffe066', name: 'Stun' },
  slow:   { iconKey: 'icon_slow',    color: '#6ec5ff', name: 'Slow' },
  rage:   { iconKey: 'icon_rage',    color: '#ff6b6b', name: 'Rage' },
};

const MOD_META: Record<AuraModifierKind, { iconKey: string; color: string; name: string }> = {
  str:               { iconKey: 'icon_str',     color: '#ff8844', name: 'STR' },
  vit:               { iconKey: 'icon_vit',     color: '#ff6666', name: 'VIT' },
  dex:               { iconKey: 'icon_dex',     color: '#f0a020', name: 'DEX' },
  int:               { iconKey: 'icon_int',     color: '#9966ff', name: 'INT' },
  spi:               { iconKey: 'icon_spi',     color: '#22cc44', name: 'SPI' },
  def:               { iconKey: 'icon_armor',   color: '#9fd6ff', name: 'DEF' },
  cd_reduction:      { iconKey: 'icon_agility', color: '#ffd700', name: 'Haste' },
  burn_taken:        { iconKey: 'icon_burn',    color: '#ff8a3d', name: 'Vuln Fire' },
  armor_bonus_pct:   { iconKey: 'icon_armor',   color: '#9fd6ff', name: 'Reforce' },
  armor_bonus_flat:  { iconKey: 'icon_armor',   color: '#9fd6ff', name: 'Reforce' },
  damage_taken_pct:  { iconKey: 'icon_defense', color: '#88e0ff', name: 'Mitigate' },
  damage_dealt_pct:  { iconKey: 'icon_attack',  color: '#ffaa44', name: 'Empower' },
  hero_hit_bonus:    { iconKey: 'icon_counter', color: '#ffaa44', name: 'Stance' },
  ignore_immunity:   { iconKey: 'icon_poison',  color: '#c490ff', name: 'Pierce Imm.' },
  fire_damage_taken_pct: { iconKey: 'icon_fire', color: '#ff5a3d', name: 'Vuln Fire' },
  stack_gain_mult:   { iconKey: 'icon_bleed',   color: '#ff4d4d', name: 'Stack ×' },
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

  const armor = Math.max(0, Math.floor(state.heroDefense ?? 0));
  if (armor > 0) {
    chips.push({
      key: 'hero-armor',
      iconKey: 'icon_armor',
      label: `${armor}`,
      color: '#9fd6ff',
      tooltip: `Armor: absorbs ${armor} damage`,
    });
  }

  for (const agg of aggregateAuras(state.heroAuras)) {
    if (agg.totalValue === 0) continue;
    const meta = MOD_META[agg.kind];
    chips.push({
      key: `hero-aura-${agg.kind}`,
      iconKey: meta.iconKey,
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
      iconKey: 'icon_defense',
      label: armorBreak > 1 ? `x${armorBreak}` : 'armed',
      color: '#9fd6ff',
      tooltip: 'Armed: fires when armor breaks',
    });
  }
  if (hpBelow > 0) {
    chips.push({
      key: 'hero-trigger-hp',
      iconKey: 'icon_HP',
      label: hpBelow > 1 ? `x${hpBelow}` : 'armed',
      color: '#ff6666',
      tooltip: 'Armed: fires when HP drops below threshold',
    });
  }

  if (state.rageStacks > 0) {
    const m = STACK_META.rage;
    chips.push({ key: 'hero-rage', iconKey: m.iconKey, label: `${state.rageStacks}`, color: m.color, tooltip: `${m.name}: ${state.rageStacks}` });
  }
  if (state.heroBurnStacks > 0) {
    const m = STACK_META.burn;
    chips.push({ key: 'hero-burn', iconKey: m.iconKey, label: `${state.heroBurnStacks}`, color: m.color, tooltip: `Self ${m.name}: ${state.heroBurnStacks}` });
  }
  if (state.heroBleedStacks > 0) {
    const m = STACK_META.bleed;
    chips.push({ key: 'hero-bleed', iconKey: m.iconKey, label: `${state.heroBleedStacks}`, color: m.color, tooltip: `Self ${m.name}: ${state.heroBleedStacks}` });
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
  ];
  for (const [k, v] of stackPairs) {
    if (v > 0) {
      const meta = STACK_META[k];
      chips.push({ key: `enemy-${k}`, iconKey: meta.iconKey, label: `${v}`, color: meta.color, tooltip: `${meta.name}: ${v}` });
    }
  }

  for (const agg of aggregateAuras(state.enemyAuras)) {
    if (agg.totalValue === 0) continue;
    const meta = MOD_META[agg.kind];
    chips.push({
      key: `enemy-aura-${agg.kind}`,
      iconKey: meta.iconKey,
      label: `${formatModValue(agg.kind, agg.totalValue)} ${formatSeconds(agg.maxRemainingMs)}`,
      color: meta.color,
      tooltip: `${meta.name} debuff (${formatSeconds(agg.maxRemainingMs)} left)`,
    });
  }

  return chips;
}
