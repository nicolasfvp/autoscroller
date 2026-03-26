import restConfig from '../data/rest-config.json';

export type RestChoice = 'rest' | 'train' | 'meditate';

export interface RestResult {
  choice: RestChoice;
  description: string;
}

interface CardInstance {
  id: string;
  name: string;
  bonusDamage?: number;
}

interface RunState {
  hero: { hp: number; maxHp: number; stamina: number; maxStamina: number; mana: number; maxMana: number };
  deck: { cards: CardInstance[]; order: string[] };
}

export function applyRestChoice(
  choice: RestChoice,
  runState: RunState,
  rng: () => number = () => Math.random()
): RestResult {
  switch (choice) {
    case 'rest': {
      const heal = Math.floor(runState.hero.maxHp * restConfig.hpRecoveryPercent);
      runState.hero.hp = Math.min(runState.hero.hp + heal, runState.hero.maxHp);
      return { choice, description: `Recovered ${heal} HP.` };
    }
    case 'train': {
      if (runState.deck.cards.length === 0) {
        return { choice, description: 'No cards to train.' };
      }
      const idx = Math.floor(rng() * runState.deck.cards.length);
      const card = runState.deck.cards[idx];
      card.bonusDamage = (card.bonusDamage ?? 0) + restConfig.trainDamageBonus;
      return { choice, description: `Boosted ${card.name} damage by +${restConfig.trainDamageBonus}.` };
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
