import restConfig from '../data/rest-config.json';
import type { RunState } from '../state/RunState';
import { rand } from './SharedRNG';
import type { SynergyBuff } from './SynergyResolver';
import { eventBus } from '../core/EventBus';

// B.1: tile-adjacency hpRecoveryBonus uplifts the rest tile heal amount.
let activeBuffs: SynergyBuff[] = [];

export function setActiveBuffs(buffs: SynergyBuff[]): void {
  activeBuffs = buffs ?? [];
}

export function getHpRecoveryBonus(): number {
  let bonus = 0;
  for (const buff of activeBuffs) {
    if (buff.type === 'hpRecoveryBonus') bonus += buff.value;
  }
  return bonus;
}

export type RestChoice = 'rest' | 'train' | 'meditate';

export interface RestResult {
  choice: RestChoice;
  description: string;
}

export function applyRestChoice(
  choice: RestChoice,
  runState: RunState,
  rng: () => number = () => rand()
): RestResult {
  // Phase 9 Task 5: rest_used relic trigger event. RelicSystem subscribers
  // can listen via `combat:rest-used` and apply effects to RunState. The
  // dispatchTriggerRelics(rest_used, ...) call is gated to in-combat-only
  // (it mutates CombatState), so out-of-combat rest sites emit the event
  // for HUD / future hook layers without re-entering CombatState.
  eventBus.emit('combat:rest-used', { choice });
  switch (choice) {
    case 'rest': {
      const recoveryPct = restConfig.hpRecoveryPercent * (1 + getHpRecoveryBonus());
      const heal = Math.floor(runState.hero.maxHP * recoveryPct);
      runState.hero.currentHP = Math.min(runState.hero.currentHP + heal, runState.hero.maxHP);
      return { choice, description: `Recovered ${heal} HP.` };
    }
    case 'train': {
      if (runState.deck.active.length === 0) {
        return { choice, description: 'No cards to train.' };
      }
      const idx = Math.floor(rng() * runState.deck.active.length);
      const cardId = runState.deck.active[idx];
      return { choice, description: `Boosted ${cardId} damage by +${restConfig.trainDamageBonus}.` };
    }
    case 'meditate': {
      const roll = rng();
      if (roll < 0.5) {
        runState.hero.maxStamina += restConfig.meditateBonusAmount;
        return { choice, description: `Increased max stamina by +${restConfig.meditateBonusAmount}.` };
      } else {
        runState.hero.maxMana += restConfig.meditateBonusAmount;
        return { choice, description: `Increased max mana by +${restConfig.meditateBonusAmount}.` };
      }
    }
  }
}

export function getRestChoices(): Array<{ id: RestChoice; name: string; description: string }> {
  return restConfig.choices.map(c => ({
    id: c.id as RestChoice,
    name: c.name,
    description: c.description,
  }));
}
