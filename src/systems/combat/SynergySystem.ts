// Consecutive pair synergy detection from JSON data.
// Zero Phaser imports.

import synergiesData from '../../data/json/synergies.json';
import type { SynergyDefinition } from '../../data/types';
import type { CombatState } from './CombatState';

export class SynergySystem {
  private synergies: Map<string, SynergyDefinition>;

  constructor() {
    this.synergies = new Map();
    for (const s of synergiesData as SynergyDefinition[]) {
      const key = `${s.cardA}|${s.cardB}`;
      this.synergies.set(key, s);
    }
  }

  /**
   * Check if playing currentCardId after lastPlayedCardId triggers a synergy.
   * Returns the synergy definition if triggered, null otherwise.
   * Order matters: cardA must be last played, cardB must be current.
   */
  check(
    lastPlayedCardId: string | null,
    currentCardId: string,
    heroClass: string,
  ): SynergyDefinition | null {
    if (lastPlayedCardId === null) return null;

    const key = `${lastPlayedCardId}|${currentCardId}`;
    const synergy = this.synergies.get(key);
    if (!synergy) return null;

    // Check class restriction
    if (synergy.classRestriction && synergy.classRestriction !== heroClass) {
      return null;
    }

    return synergy;
  }
}

/**
 * Phase 9 (Task 5): synergy bonus types that are NOT routed through
 * CardResolver.applyEffect — they mutate CombatState directly. Currently
 * `cooldown_reduction` is the only such type; `nextCardCooldownReduction`
 * accumulates the shave so the next card's cooldown is shortened.
 *
 * Called from CombatEngine.executeCard AFTER CardResolver.resolve so the
 * synergy first runs through the normal effect dispatcher (no-op for
 * cooldown_reduction; populated cases for everything else) and THEN this
 * direct-mutation step picks up the leftover bonus types.
 */
export function applyDirectSynergyBonus(
  synergy: SynergyDefinition,
  state: CombatState,
): void {
  if (synergy.bonus.type === 'cooldown_reduction') {
    state.nextCardCooldownReduction += synergy.bonus.value;
  }
}
