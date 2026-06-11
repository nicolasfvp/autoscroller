import cardsJson from '../data/json/cards.json';
import relicsData from '../data/json/relics.json';
import enemiesData from '../data/json/enemies.json';
import { MetaState } from '../state/MetaState';
import { DEFAULT_SUBTILES } from './UnlockManager';
import { getLocale } from '../i18n/i18n';

const cardsData: any[] = (cardsJson as any).cards;

// ── pt-BR Compendium localization ────────────────────────────────────────
// Card/relic/boss names arrive already localized (DataLoader overlay mutates
// the JSON singletons in place). Only the tile catalog + unlock hints, built
// here from literals, need translating.
const SOURCE_NAMES_PT: Record<string, string> = {
  forge: 'Forja', library: 'Biblioteca', shrine: 'Santuário', workshop: 'Oficina', tavern: 'Taverna',
};
const TILE_NAMES_PT: Record<string, string> = {
  basic: 'Básico', forest: 'Floresta', event: 'Evento', treasure: 'Tesouro', boss: 'Chefe',
  graveyard: 'Cemitério', swamp: 'Pântano', desert: 'Deserto', lava: 'Lava',
};
const SUBTILE_NAMES_PT: Record<string, string> = {
  subtile_ambush: 'Emboscada', subtile_bleedtotem: 'Totem de Sangramento',
  subtile_burnaltar: 'Altar de Queimadura', subtile_camp: 'Acampamento',
  subtile_magma: 'Fenda de Magma', subtile_manawell: 'Poço de Mana',
  subtile_resonance: 'Ressonância', subtile_warhorn: 'Trompa de Guerra',
};

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
  const sourceNamesEn: Record<string, string> = {
    forge: 'Forge', library: 'Library', shrine: 'Shrine', workshop: 'Workshop', tavern: 'Tavern',
  };
  if (getLocale() === 'pt-br') {
    const src = SOURCE_NAMES_PT[item.unlockSource] || item.unlockSource;
    return `Desbloqueia na ${src} Nv.${item.unlockTier}`;
  }
  return `Unlock via ${sourceNamesEn[item.unlockSource] || item.unlockSource} Lv.${item.unlockTier}`;
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

  // Tile catalog mirrors what the Preloader actually ships (public/assets/map/tiles).
  // — Base region tiles: always available.
  // — Special tiles: event/treasure/boss are seeded into runs from the start.
  // — Unlockable region tiles: gated behind the Workshop.
  // — Subtiles: combat amplifier tiles (camps, totems, altars, etc.). Gated
  //   behind the Workshop alongside the region tiles — the player unlocks them
  //   via meta.unlockedTiles before they can be placed.
  const baseTiles = ['basic', 'forest', 'event', 'treasure', 'boss'];
  const unlockableTiles = ['graveyard', 'swamp', 'desert', 'lava'];
  const subtileNames: Record<string, string> = {
    subtile_ambush: 'Ambush',
    subtile_bleedtotem: 'Bleed Totem',
    subtile_burnaltar: 'Burn Altar',
    subtile_camp: 'Camp',
    subtile_magma: 'Magma Vent',
    subtile_manawell: 'Mana Well',
    subtile_resonance: 'Resonance',
    subtile_warhorn: 'War Horn',
  };
  const subtileIds = Object.keys(subtileNames);
  const allTiles = [...baseTiles, ...unlockableTiles, ...subtileIds];
  const isPt = getLocale() === 'pt-br';
  const workshopHint = isPt ? 'Desbloqueia na Oficina' : 'Unlock via Workshop';
  const enTileName = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const tiles = allTiles.map(id => {
    const isSubtile = subtileNames[id] !== undefined;
    const name = isSubtile
      ? (isPt ? (SUBTILE_NAMES_PT[id] ?? subtileNames[id]) : subtileNames[id])
      : (isPt ? (TILE_NAMES_PT[id] ?? enTileName(id)) : enTileName(id));
    return {
      id,
      name,
      isUnlocked: baseTiles.includes(id) || DEFAULT_SUBTILES.includes(id) || metaState.unlockedTiles.includes(id),
      unlockHint: ((unlockableTiles.includes(id) || isSubtile) && !DEFAULT_SUBTILES.includes(id)) ? workshopHint : undefined,
    };
  });

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
  const enemy = (enemiesData as any[]).find((e: any) => e.id === itemId);
  if (enemy) {
    return {
      id: enemy.id,
      name: enemy.name,
      isUnlocked: true,
      // Synthesize a description from enemy stats since enemies.json doesn't
      // carry one — keeps the detail popup useful for the Bosses tab.
      data: {
        description: `${enemy.type === 'boss' ? 'Boss' : 'Enemy'} — ${enemy.baseHP} HP, ${enemy.attack?.damage ?? 0} ATK`,
        effect: Array.isArray(enemy.behaviors) && enemy.behaviors.length > 0
          ? enemy.behaviors.map((b: any) => b.type).join(', ')
          : undefined,
      },
    };
  }
  return undefined;
}
