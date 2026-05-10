import cardsJson from '../data/json/cards.json';
import relicsData from '../data/json/relics.json';
import enemiesData from '../data/json/enemies.json';
import { MetaState } from '../state/MetaState';

const cardsData: any[] = (cardsJson as any).cards;

export interface CategoryStatus {
  total: number;
  unlocked: number;
  items: Array<{ id: string; name: string; isUnlocked: boolean; unlockHint?: string }>;
}

export interface CollectionStatus {
  cards: CategoryStatus;
  relics: CategoryStatus;
  bosses: CategoryStatus;
  tiles: CategoryStatus;
}

function isUnlocked(item: any, unlockedList: string[]): boolean {
  return !item.unlockSource || unlockedList.includes(item.id);
}

function unlockHint(item: any): string | undefined {
  if (!item.unlockSource) return undefined;
  const sourceNames: Record<string, string> = {
    forge: 'Forge',
    library: 'Library',
    shrine: 'Shrine',
    workshop: 'Workshop',
    tavern: 'Tavern',
  };
  return `Unlock via ${sourceNames[item.unlockSource] || item.unlockSource} Lv.${item.unlockTier}`;
}

export function getCollectionStatus(metaState: MetaState): CollectionStatus {
  const cards = cardsData.map((c: any) => ({
    id: c.id,
    name: c.name,
    isUnlocked: isUnlocked(c, metaState.unlockedCards),
    unlockHint: unlockHint(c),
  }));

  const relics = (relicsData as any[]).map((r: any) => ({
    id: r.id,
    name: r.name,
    isUnlocked: isUnlocked(r, metaState.unlockedRelics),
    unlockHint: unlockHint(r),
  }));

  const bosses = (enemiesData as any[])
    .filter((e: any) => e.type === 'boss')
    .map((b: any) => ({
      id: b.id,
      name: b.name,
      isUnlocked: true,
    }));

  const baseTiles = ['basic', 'forest', 'shop', 'rest', 'event', 'treasure', 'boss'];
  const unlockableTiles = ['graveyard', 'swamp', 'volcano'];
  const allTiles = [...baseTiles, ...unlockableTiles];
  const tiles = allTiles.map(id => ({
    id,
    name: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    isUnlocked: baseTiles.includes(id) || metaState.unlockedTiles.includes(id),
    unlockHint: unlockableTiles.includes(id) ? 'Unlock via Workshop' : undefined,
  }));

  return {
    cards: { total: cards.length, unlocked: cards.filter(c => c.isUnlocked).length, items: cards },
    relics: { total: relics.length, unlocked: relics.filter(r => r.isUnlocked).length, items: relics },
    bosses: { total: bosses.length, unlocked: bosses.filter(b => b.isUnlocked).length, items: bosses },
    tiles: { total: tiles.length, unlocked: tiles.filter(t => t.isUnlocked).length, items: tiles },
  };
}

export function getCompletionPercent(metaState: MetaState): number {
  const status = getCollectionStatus(metaState);
  const totalItems = status.cards.total + status.relics.total + status.bosses.total + status.tiles.total;
  const unlockedItems = status.cards.unlocked + status.relics.unlocked + status.bosses.unlocked + status.tiles.unlocked;
  return Math.floor((unlockedItems / totalItems) * 100);
}

export function getItemDetails(
  itemId: string,
  metaState: MetaState
): { id: string; name: string; isUnlocked: boolean; unlockHint?: string; data: any } | undefined {
  const card = cardsData.find((c: any) => c.id === itemId);
  if (card) {
    return {
      id: card.id,
      name: card.name,
      isUnlocked: isUnlocked(card, metaState.unlockedCards),
      unlockHint: unlockHint(card),
      data: card,
    };
  }
  const relic = (relicsData as any[]).find((r: any) => r.id === itemId);
  if (relic) {
    return {
      id: relic.id,
      name: relic.name,
      isUnlocked: isUnlocked(relic, metaState.unlockedRelics),
      unlockHint: unlockHint(relic),
      data: relic,
    };
  }
  return undefined;
}
