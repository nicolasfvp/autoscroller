// Inline event resolution -- random effects applied without blocking the game.
// Zero Phaser dependency (GameScene observes side-effect flags). Queues
// notifications via PendingLoot.

import { hasActiveRun, getRun, type RunState } from '../state/RunState';
import { addPendingLoot, type LootEntry } from './PendingLoot';
import { rand } from './SharedRNG';
import { addShardsAndConvert, type ShardInventory, type ElementInventory } from './ShardSystem';
import { ELEMENTS, type ElementId } from './ElementSystem';

interface EventResult {
  notifications: LootEntry[];
  /** If set, triggers a combat encounter with this enemy ID */
  combatEnemyId?: string;
  /** Temporary speed debuff duration in ms (applied by GameScene) */
  slowDurationMs?: number;
}

interface EventOption {
  weight: number;
  /** Marks the option as a beneficial outcome — informational for future tuning. */
  positive?: boolean;
  apply: (run: RunState) => EventResult;
}

// Low-tier enemy pool used by Cursed Treasure's forced fight. IDs verified
// against src/data/json/enemies.json — these are intentionally weak so the
// gold payout feels worth the risk even at later loops.
const CURSED_TREASURE_EASY_POOL = ['lost_lizard', 'pocket_cat', 'mush'];

const EVENT_TABLE: EventOption[] = [
  // ── Heal 20% HP (common positive)
  {
    weight: 18,
    positive: true,
    apply(run) {
      const heal = Math.floor(run.hero.maxHP * 0.2);
      run.hero.currentHP = Math.min(run.hero.currentHP + heal, run.hero.maxHP);
      return { notifications: [{ label: `+${heal} HP`, color: '#00ff00' }] };
    },
  },
  // ── Give gold (15-40, common positive)
  {
    weight: 18,
    positive: true,
    apply(run) {
      const amount = 15 + Math.floor(rand() * 26);
      run.economy.gold += amount;
      run.stats.goldEarned += amount;
      return { notifications: [{ label: `+${amount} Gold`, color: '#ffd700' }] };
    },
  },
  // ── Take damage (low, non-lethal)
  {
    weight: 14,
    apply(run) {
      const dmg = Math.floor(run.hero.maxHP * 0.08);
      run.hero.currentHP = Math.max(1, run.hero.currentHP - dmg);
      return { notifications: [{ label: `-${dmg} HP (trap!)`, color: '#ff4444' }] };
    },
  },
  // ── Pickpocket gold
  {
    weight: 9,
    apply(run) {
      const amount = Math.min(run.economy.gold, 5 + Math.floor(rand() * 16));
      if (amount <= 0) {
        return { notifications: [{ label: 'Pickpocket! (no gold)', color: '#ff8800' }] };
      }
      run.economy.gold -= amount;
      return { notifications: [{ label: `-${amount} Gold (pickpocket!)`, color: '#ff8800' }] };
    },
  },
  // ── Slow (temporary speed reduction)
  {
    weight: 9,
    apply() {
      return {
        notifications: [{ label: 'Slowed! (3s)', color: '#8888ff' }],
        slowDurationMs: 3000,
      };
    },
  },
  // ── Stamina/mana restore
  {
    weight: 5,
    positive: true,
    apply(run) {
      const staRestore = Math.floor(run.hero.maxStamina * 0.3);
      const manaRestore = Math.floor(run.hero.maxMana * 0.3);
      run.hero.currentStamina = Math.min(run.hero.currentStamina + staRestore, run.hero.maxStamina);
      run.hero.currentMana = Math.min(run.hero.currentMana + manaRestore, run.hero.maxMana);
      return { notifications: [{ label: `+${staRestore} STA, +${manaRestore} MP`, color: '#00ccff' }] };
    },
  },
  // ── Element Shrine: +2-4 shards of one random element
  {
    weight: 4,
    positive: true,
    apply(run) {
      const elementIds = Object.keys(ELEMENTS) as ElementId[];
      const elementId = elementIds[Math.floor(rand() * elementIds.length)];
      const amount = 2 + Math.floor(rand() * 3); // 2-4
      const delta: ShardInventory = { [elementId]: amount } as ShardInventory;
      if (!run.economy.shards) run.economy.shards = {};
      if (!run.economy.elements) run.economy.elements = {};
      addShardsAndConvert(
        run.economy.shards as ShardInventory,
        run.economy.elements as ElementInventory,
        delta,
      );
      const el = ELEMENTS[elementId];
      return {
        notifications: [{ label: `Element Shrine! +${amount} ${el.name} shard`, color: el.color }],
      };
    },
  },
  // ── Cursed Treasure: +gold burst then forced easy combat
  {
    weight: 9,
    apply(run) {
      const goldBurst = 30 + Math.floor(rand() * 31); // 30-60
      run.economy.gold += goldBurst;
      run.stats.goldEarned += goldBurst;
      const enemyId =
        CURSED_TREASURE_EASY_POOL[Math.floor(rand() * CURSED_TREASURE_EASY_POOL.length)];
      return {
        notifications: [{ label: `Cursed Treasure! +${goldBurst}g, fight follows`, color: '#ffaa00' }],
        combatEnemyId: enemyId,
      };
    },
  },
  // ── Hidden Path: bonus gold on each tile entered for the next 15 tiles
  {
    weight: 8,
    positive: true,
    apply(run) {
      run.economy.hiddenPathTilesRemaining = 15;
      run.economy.hiddenPathTileGold = 3;
      return {
        notifications: [{ label: 'Hidden Path! +3g per tile (15 tiles)', color: '#ffd700' }],
      };
    },
  },
  // ── Wandering Healer: full HP restore (rare strong positive)
  {
    weight: 5,
    positive: true,
    apply(run) {
      const heal = run.hero.maxHP - run.hero.currentHP;
      run.hero.currentHP = run.hero.maxHP;
      return {
        notifications: [{ label: `Wandering Healer! +${heal} HP (full restore)`, color: '#aaffaa' }],
      };
    },
  },
];

/**
 * Per-tile hook: while the Hidden Path event's counter is positive, every
 * tile crossed deposits a small gold bonus. Called from LoopRunner.onTileEntered.
 * Goes through getRun() (not the LoopRunState slice) since the live economy +
 * stats both live on RunState.
 */
export function applyHiddenPathTileBonus(): void {
  if (!hasActiveRun()) return;
  const run = getRun();
  const remaining = run.economy.hiddenPathTilesRemaining ?? 0;
  if (remaining <= 0) return;
  const bonus = run.economy.hiddenPathTileGold ?? 0;
  if (bonus > 0) {
    run.economy.gold += bonus;
    run.stats.goldEarned += bonus;
  }
  run.economy.hiddenPathTilesRemaining = remaining - 1;
}

/**
 * Resolve a random event inline and apply effects to RunState.
 * Returns combat enemy ID if the event triggers a fight.
 */
export function resolveInlineEvent(run: RunState): EventResult {
  const totalWeight = EVENT_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let roll = rand() * totalWeight;

  for (const option of EVENT_TABLE) {
    roll -= option.weight;
    if (roll <= 0) {
      const result = option.apply(run);
      addPendingLoot(result.notifications);
      return result;
    }
  }

  // Fallback
  const fallback = EVENT_TABLE[0].apply(run);
  addPendingLoot(fallback.notifications);
  return fallback;
}
