import restConfig from '../data/rest-config.json';
import type { RunState } from '../state/RunState';
import { rand } from './SharedRNG';

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
  switch (choice) {
    case 'rest': {
      const heal = Math.floor(runState.hero.maxHP * restConfig.hpRecoveryPercent);
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
