import eventsData from '../data/events.json';
import { getAvailableCards, getAvailableRelics } from './UnlockManager';
import type { RunState } from '../state/RunState';
import { rand } from './SharedRNG';

export interface EventUnlockState {
  unlockedCards: string[];
  unlockedRelics: string[];
}

export type EventChoiceEffect = 'gain_hp' | 'lose_hp' | 'gain_gold' | 'lose_gold' | 'add_card' | 'remove_card' | 'gain_relic' | 'add_curse' | 'gain_material' | 'lose_material' | 'upgrade_card';

export interface EventChoice {
  text: string;
  effects: Array<{ type: EventChoiceEffect; value?: number | string; material?: string }>;
  requirement?: { minGold?: number; minHP?: number; minMaterial?: Record<string, number> };
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
  weight?: number;
}

export interface EventOutcome {
  description: string;
  effects: Array<{ type: string; value: number | string; applied: boolean }>;
}

const events: EventDefinition[] = eventsData as EventDefinition[];

export function getRandomEvent(): EventDefinition {
  const totalWeight = events.reduce((sum, e) => sum + (e.weight ?? 1.0), 0);
  // Math.random() can return 0 — use a `< 0` boundary so the first event
  // doesn't get picked just because the roll started at exactly 0.
  let roll = rand() * totalWeight;
  for (const event of events) {
    roll -= event.weight ?? 1.0;
    if (roll < 0) return event;
  }
  return events[events.length - 1];
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
  if (choice.requirement?.minHP !== undefined && runState.hero.currentHP < choice.requirement.minHP) {
    return false;
  }
  if (choice.requirement?.minMaterial) {
    for (const [mat, amount] of Object.entries(choice.requirement.minMaterial)) {
      if ((runState.economy.materials[mat] ?? 0) < amount) {
        return false;
      }
    }
  }
  return true;
}

export function resolveEventChoice(eventId: string, choiceIndex: number, runState: RunState, unlockState?: EventUnlockState): EventOutcome {
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
        const before = runState.hero.currentHP;
        runState.hero.currentHP = Math.min(runState.hero.currentHP + amount, runState.hero.maxHP);
        const healed = runState.hero.currentHP - before;
        descriptions.push(`Gained ${healed} HP`);
        appliedEffects.push({ type: 'gain_hp', value: amount, applied: true });
        break;
      }
      case 'lose_hp': {
        // Clamp to non-negative so a typo'd negative value can't heal the
        // hero through the wrong effect type. (gain_hp exists for that.)
        const amount = Math.max(0, typeof val === 'number' ? val : 0);
        runState.hero.currentHP = Math.max(runState.hero.currentHP - amount, 1);
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
        // Report what was actually lost, not the requested amount —
        // otherwise a player with 20g facing a 30g cost sees "Lost 30 gold"
        // even though only 20 was deducted.
        const actuallyLost = Math.min(amount, runState.economy.gold);
        runState.economy.gold = Math.max(runState.economy.gold - amount, 0);
        descriptions.push(`Lost ${actuallyLost} gold`);
        appliedEffects.push({ type: 'lose_gold', value: actuallyLost, applied: true });
        break;
      }
      case 'add_card': {
        const cardId = typeof val === 'string' ? val : 'strike';
        let resolvedId = cardId;
        let resolvedFromEmptyPool = false;
        if (cardId === 'random_rare' || cardId === 'random') {
          // Filter by unlock state when available, pick from available pool
          const availableCards = getAvailableCards(unlockState?.unlockedCards ?? []);
          const rareCards = cardId === 'random_rare'
            ? availableCards.filter(c => c.rarity === 'rare' || c.rarity === 'uncommon')
            : availableCards;
          if (rareCards.length > 0) {
            resolvedId = rareCards[Math.floor(rand() * rareCards.length)].id;
          } else if (availableCards.length > 0) {
            // Fall back to *any* available card rather than the silent 'strike'
            // sentinel — at least the player gets something they don't already
            // have in their starter deck a dozen times.
            resolvedId = availableCards[Math.floor(rand() * availableCards.length)].id;
            resolvedFromEmptyPool = true;
          } else {
            resolvedId = 'strike';
            resolvedFromEmptyPool = true;
          }
        }
        runState.deck.active.push(resolvedId);
        descriptions.push(`Added card: ${resolvedId}`);
        // mark via the description rather than extending the schema
        if (resolvedFromEmptyPool && cardId !== 'strike') {
          descriptions[descriptions.length - 1] = `Added card: ${resolvedId} (no rare available)`;
        }
        appliedEffects.push({ type: 'add_card', value: resolvedId, applied: true });
        break;
      }
      case 'remove_card': {
        const mode = typeof val === 'string' ? val : 'random';
        if (mode === 'random') {
          if (runState.deck.active.length > 3) {
            const idx = Math.floor(rand() * runState.deck.active.length);
            const removed = runState.deck.active.splice(idx, 1)[0];
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
        let resolvedId = relicId;
        if (relicId === 'random' || relicId === 'rare') {
          // Filter by unlock state when available, pick from available pool
          const availableRelics = getAvailableRelics(unlockState?.unlockedRelics ?? []);
          const filtered = relicId === 'rare'
            ? availableRelics.filter(r => r.rarity === 'rare' || r.rarity === 'epic' || r.rarity === 'legendary')
            : availableRelics;
          if (filtered.length > 0) {
            resolvedId = filtered[Math.floor(rand() * filtered.length)].id;
          } else {
            resolvedId = 'bronze_scale';
          }
        }
        runState.relics.push(resolvedId);
        descriptions.push(`Gained relic: ${resolvedId}`);
        appliedEffects.push({ type: 'gain_relic', value: resolvedId, applied: true });
        break;
      }
      case 'add_curse': {
        const curseId = typeof val === 'string' ? val : 'pain';
        runState.deck.active.push(curseId);
        descriptions.push(`Cursed! ${curseId} added to deck`);
        appliedEffects.push({ type: 'add_curse', value: curseId, applied: true });
        break;
      }
      case 'gain_material': {
        const material = effect.material as string;
        const amount = typeof val === 'number' ? val : 0;
        if (material) {
          runState.economy.materials[material] = (runState.economy.materials[material] ?? 0) + amount;
          descriptions.push(`Gained ${amount} ${material}`);
          appliedEffects.push({ type: 'gain_material', value: amount, applied: true });
        }
        break;
      }
      case 'lose_material': {
        const material = effect.material as string;
        const amount = typeof val === 'number' ? val : 0;
        if (material) {
          const current = runState.economy.materials[material] ?? 0;
          runState.economy.materials[material] = Math.max(0, current - amount);
          descriptions.push(`Lost ${amount} ${material}`);
          appliedEffects.push({ type: 'lose_material', value: amount, applied: true });
        }
        break;
      }
      case 'upgrade_card': {
        descriptions.push('A card in your deck was upgraded!');
        appliedEffects.push({ type: 'upgrade_card', value: val ?? 'random', applied: true });
        break;
      }
    }
  }

  return {
    description: descriptions.join('. ') + '.',
    effects: appliedEffects,
  };
}
