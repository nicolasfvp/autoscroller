import eventsData from '../data/events.json';

export type EventChoiceEffect = 'gain_hp' | 'lose_hp' | 'gain_gold' | 'lose_gold' | 'add_card' | 'remove_card' | 'gain_relic' | 'add_curse';

export interface EventChoice {
  text: string;
  effects: Array<{ type: EventChoiceEffect; value?: number | string }>;
  requirement?: { minGold?: number; minHP?: number };
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
}

export interface EventOutcome {
  description: string;
  effects: Array<{ type: string; value: number | string; applied: boolean }>;
}

interface RunState {
  hero: { hp: number; maxHp: number };
  deck: { cards: any[]; order: string[] };
  economy: { gold: number; tilePoints: number; metaLoot: number };
  relics: string[];
}

const events: EventDefinition[] = eventsData as EventDefinition[];

export function getRandomEvent(): EventDefinition {
  return events[Math.floor(Math.random() * events.length)];
}

export function getEvent(id: string): EventDefinition | undefined {
  return events.find(e => e.id === id);
}

export function getAllEvents(): EventDefinition[] {
  return [...events];
}

export function isChoiceAvailable(choice: EventChoice, runState: RunState): boolean {
  if (choice.requirement?.minGold !== undefined && runState.economy.gold < choice.requirement.minGold) {
    return false;
  }
  if (choice.requirement?.minHP !== undefined && runState.hero.hp < choice.requirement.minHP) {
    return false;
  }
  return true;
}

export function resolveEventChoice(eventId: string, choiceIndex: number, runState: RunState): EventOutcome {
  const event = getEvent(eventId);
  if (!event) {
    return { description: 'Unknown event.', effects: [] };
  }

  const choice = event.choices[choiceIndex];
  if (!choice) {
    return { description: 'Invalid choice.', effects: [] };
  }

  if (choice.effects.length === 0) {
    return { description: `You chose: ${choice.text}. Nothing happened.`, effects: [] };
  }

  const appliedEffects: EventOutcome['effects'] = [];
  const descriptions: string[] = [];

  for (const effect of choice.effects) {
    const val = effect.value;
    switch (effect.type) {
      case 'gain_hp': {
        const amount = typeof val === 'number' ? val : 0;
        const before = runState.hero.hp;
        runState.hero.hp = Math.min(runState.hero.hp + amount, runState.hero.maxHp);
        const healed = runState.hero.hp - before;
        descriptions.push(`Gained ${healed} HP`);
        appliedEffects.push({ type: 'gain_hp', value: amount, applied: true });
        break;
      }
      case 'lose_hp': {
        const amount = typeof val === 'number' ? val : 0;
        runState.hero.hp = Math.max(runState.hero.hp - amount, 1);
        descriptions.push(`Lost ${amount} HP`);
        appliedEffects.push({ type: 'lose_hp', value: amount, applied: true });
        break;
      }
      case 'gain_gold': {
        const amount = typeof val === 'number' ? val : 0;
        runState.economy.gold += amount;
        descriptions.push(`Gained ${amount} gold`);
        appliedEffects.push({ type: 'gain_gold', value: amount, applied: true });
        break;
      }
      case 'lose_gold': {
        const amount = typeof val === 'number' ? val : 0;
        runState.economy.gold = Math.max(runState.economy.gold - amount, 0);
        descriptions.push(`Lost ${amount} gold`);
        appliedEffects.push({ type: 'lose_gold', value: amount, applied: true });
        break;
      }
      case 'add_card': {
        const cardId = typeof val === 'string' ? val : 'strike';
        // Placeholder: random_rare maps to 'fury'
        const resolvedId = cardId === 'random_rare' ? 'fury' : cardId;
        runState.deck.order.push(resolvedId);
        descriptions.push(`Added card: ${resolvedId}`);
        appliedEffects.push({ type: 'add_card', value: resolvedId, applied: true });
        break;
      }
      case 'remove_card': {
        const mode = typeof val === 'string' ? val : 'random';
        if (mode === 'random') {
          if (runState.deck.order.length > 3) {
            const idx = Math.floor(Math.random() * runState.deck.order.length);
            const removed = runState.deck.order.splice(idx, 1)[0];
            descriptions.push(`Removed card: ${removed}`);
            appliedEffects.push({ type: 'remove_card', value: removed, applied: true });
          } else {
            descriptions.push('Deck too small to remove a card');
            appliedEffects.push({ type: 'remove_card', value: 'none', applied: false });
          }
        } else if (mode === 'choose') {
          // Pending user choice - mark as not applied
          descriptions.push('Choose a card to remove');
          appliedEffects.push({ type: 'remove_card', value: 'choose', applied: false });
        }
        break;
      }
      case 'gain_relic': {
        const relicId = typeof val === 'string' ? val : 'random';
        // Placeholder: random/rare map to placeholder relic ids
        const resolvedId = relicId === 'random' ? 'mysterious_amulet' : relicId === 'rare' ? 'ancient_relic' : relicId;
        runState.relics.push(resolvedId);
        descriptions.push(`Gained relic: ${resolvedId}`);
        appliedEffects.push({ type: 'gain_relic', value: resolvedId, applied: true });
        break;
      }
      case 'add_curse': {
        // No-op placeholder
        descriptions.push('A curse was placed (no effect yet)');
        appliedEffects.push({ type: 'add_curse', value: val ?? 'unknown', applied: false });
        break;
      }
    }
  }

  return {
    description: descriptions.join('. ') + '.',
    effects: appliedEffects,
  };
}
