import cardsJson from '../data/json/cards.json';
import relicsData from '../data/json/relics.json';

export interface CardDef { id: string; unlockSource?: string; [key: string]: any; }
export interface RelicDef { id: string; unlockSource?: string; [key: string]: any; }
export interface TileDef { id: string; unlockSource?: string; [key: string]: any; }

const cardsData: CardDef[] = (cardsJson as any).cards;

export function getAvailableCards(metaUnlockedCards: string[]): CardDef[] {
  return cardsData.filter(card =>
    !card.unlockSource || metaUnlockedCards.includes(card.id)
  );
}

export function getAvailableRelics(metaUnlockedRelics: string[]): RelicDef[] {
  return (relicsData as RelicDef[]).filter(relic =>
    !relic.unlockSource || metaUnlockedRelics.includes(relic.id)
  );
}

export function getAvailableTiles(metaUnlockedTiles: string[]): TileDef[] {
  const baseTileIds = ['basic', 'forest', 'rest', 'event', 'treasure', 'boss'];
  const allTileIds = [...baseTileIds, ...metaUnlockedTiles.filter(id => !baseTileIds.includes(id))];
  return allTileIds.map(id => ({ id })) as TileDef[];
}
