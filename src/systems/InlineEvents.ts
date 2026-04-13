// Inline event resolution -- random effects applied without blocking the game.
// Events can: heal, give gold, damage, take gold, slow hero, trigger easy combat, or spawn rare enemy.
// Zero Phaser dependency. Queues notifications via PendingLoot.

import type { RunState } from '../state/RunState';
import { addPendingLoot, type LootEntry } from './PendingLoot';

interface EventResult {
  notifications: LootEntry[];
  /** If set, triggers a combat encounter with this enemy ID */
  combatEnemyId?: string;
  /** Temporary speed debuff duration in ms (applied by GameScene) */
  slowDurationMs?: number;
}

interface EventOption {
  weight: number;
  apply: (run: RunState) => EventResult;
}

// Easy enemy pool for random battle events
const EASY_ENEMIES = ['slime', 'goblin'];
// Rare event enemy (gives more gold)
const RARE_ENEMY = 'elite_knight';

const EVENT_TABLE: EventOption[] = [
  // Heal 20% HP
  {
    weight: 20,
    apply(run) {
      const heal = Math.floor(run.hero.maxHP * 0.2);
      run.hero.currentHP = Math.min(run.hero.currentHP + heal, run.hero.maxHP);
      return { notifications: [{ label: `+${heal} HP`, color: '#00ff00' }] };
    },
  },
  // Give gold (15-40)
  {
    weight: 20,
    apply(run) {
      const amount = 15 + Math.floor(Math.random() * 26);
      run.economy.gold += amount;
      return { notifications: [{ label: `+${amount} Gold`, color: '#ffd700' }] };
    },
  },
  // Random easy battle
  {
    weight: 15,
    apply() {
      const enemyId = EASY_ENEMIES[Math.floor(Math.random() * EASY_ENEMIES.length)];
      return {
        notifications: [{ label: 'Ambush!', color: '#ff4444' }],
        combatEnemyId: enemyId,
      };
    },
  },
  // Rare enemy (more gold reward)
  {
    weight: 5,
    apply() {
      return {
        notifications: [{ label: 'Rare Enemy!', color: '#ff00ff' }],
        combatEnemyId: RARE_ENEMY,
      };
    },
  },
  // Take damage (low, non-lethal)
  {
    weight: 15,
    apply(run) {
      const dmg = Math.floor(run.hero.maxHP * 0.08);
      run.hero.currentHP = Math.max(1, run.hero.currentHP - dmg);
      return { notifications: [{ label: `-${dmg} HP (trap!)`, color: '#ff4444' }] };
    },
  },
  // Lose gold
  {
    weight: 10,
    apply(run) {
      const amount = Math.min(run.economy.gold, 5 + Math.floor(Math.random() * 16));
      if (amount <= 0) {
        return { notifications: [{ label: 'Pickpocket! (no gold)', color: '#ff8800' }] };
      }
      run.economy.gold -= amount;
      return { notifications: [{ label: `-${amount} Gold (pickpocket!)`, color: '#ff8800' }] };
    },
  },
  // Slow (temporary speed reduction)
  {
    weight: 10,
    apply() {
      return {
        notifications: [{ label: 'Slowed! (3s)', color: '#8888ff' }],
        slowDurationMs: 3000,
      };
    },
  },
  // Stamina/mana restore
  {
    weight: 5,
    apply(run) {
      const staRestore = Math.floor(run.hero.maxStamina * 0.3);
      const manaRestore = Math.floor(run.hero.maxMana * 0.3);
      run.hero.currentStamina = Math.min(run.hero.currentStamina + staRestore, run.hero.maxStamina);
      run.hero.currentMana = Math.min(run.hero.currentMana + manaRestore, run.hero.maxMana);
      return { notifications: [{ label: `+${staRestore} STA, +${manaRestore} MP`, color: '#00ccff' }] };
    },
  },
];

/**
 * Resolve a random event inline and apply effects to RunState.
 * Returns combat enemy ID if the event triggers a fight.
 */
export function resolveInlineEvent(run: RunState): EventResult {
  const totalWeight = EVENT_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;

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
