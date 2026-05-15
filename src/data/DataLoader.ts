// Typed data loader for all static game definitions.
// Uses Vite static JSON imports (bundled at build time, no runtime fetch).
// Zero Phaser dependency.

import cardsData from './json/cards.json';
import enemiesData from './json/enemies.json';
import tilesData from './json/tiles.json';
import relicsData from './json/relics.json';
import difficultyData from './json/difficulty.json';
import heroStatsData from './json/hero-stats.json';
import enemyDropsData from './json/enemy-drops.json';

import type {
  CardDefinition,
  EnemyDefinition,
  TileTypeConfig,
  RelicDefinition,
  DifficultyConfig,
  HeroStatsConfig,
  EnemyDropTable,
} from './types';

// ── Cached typed data ───────────────────────────────────────

let cards: CardDefinition[] | null = null;
let enemies: EnemyDefinition[] | null = null;
let tiles: TileTypeConfig[] | null = null;
let relics: RelicDefinition[] | null = null;
let difficulty: Record<string, DifficultyConfig> | null = null;
let heroStats: HeroStatsConfig | null = null;
let enemyDrops: Record<string, EnemyDropTable> | null = null;
let starterDecks: Record<string, string[]> | null = null;

// ── Load all data ───────────────────────────────────────────

export function loadAllData(): void {
  const raw = cardsData as { cards: CardDefinition[]; starterDecks?: Record<string, string[]>; starterDeckIds?: string[] };
  cards = raw.cards;
  starterDecks = raw.starterDecks ?? (raw.starterDeckIds ? { warrior: raw.starterDeckIds } : {});
  enemies = enemiesData as EnemyDefinition[];
  tiles = tilesData as TileTypeConfig[];
  relics = relicsData as RelicDefinition[];
  difficulty = difficultyData as Record<string, DifficultyConfig>;
  heroStats = heroStatsData as HeroStatsConfig;
  enemyDrops = enemyDropsData as Record<string, EnemyDropTable>;
}

// ── Card accessors ──────────────────────────────────────────

export function getAllCards(): CardDefinition[] {
  if (!cards) throw new Error('Data not loaded -- call loadAllData() first');
  return cards;
}

export function getCardById(id: string): CardDefinition | undefined {
  return getAllCards().find((c) => c.id === id);
}

export function getStarterDeckIds(className: string = 'warrior'): string[] {
  if (!starterDecks) throw new Error('Data not loaded -- call loadAllData() first');
  return starterDecks[className] ?? starterDecks.warrior ?? [];
}

export function getStarterDeckForClass(className: string): string[] {
  return getStarterDeckIds(className);
}

// ── Enemy accessors ─────────────────────────────────────────

export function getAllEnemies(): EnemyDefinition[] {
  if (!enemies) throw new Error('Data not loaded -- call loadAllData() first');
  return enemies;
}

export function getEnemyById(id: string): EnemyDefinition | undefined {
  return getAllEnemies().find((e) => e.id === id);
}

// ── Tile accessors ──────────────────────────────────────────

export function getAllTiles(): TileTypeConfig[] {
  if (!tiles) throw new Error('Data not loaded -- call loadAllData() first');
  return tiles;
}

export function getTileByType(type: string): TileTypeConfig | undefined {
  return getAllTiles().find((t) => t.type === type);
}

// ── Relic accessors ─────────────────────────────────────────

export function getAllRelics(): RelicDefinition[] {
  if (!relics) throw new Error('Data not loaded -- call loadAllData() first');
  return relics;
}

export function getRelicById(id: string): RelicDefinition | undefined {
  return getAllRelics().find((r) => r.id === id);
}

// ── Difficulty accessors ────────────────────────────────────

export function getDifficultyConfig(level: string = 'normal'): DifficultyConfig {
  if (!difficulty) throw new Error('Data not loaded -- call loadAllData() first');
  const config = difficulty[level];
  if (!config) throw new Error(`Unknown difficulty level: ${level}`);
  return config;
}

// ── Hero stats accessors ────────────────────────────────────

export function getDefaultHeroStats(): HeroStatsConfig {
  if (!heroStats) throw new Error('Data not loaded -- call loadAllData() first');
  return heroStats;
}

// ── Enemy drops accessors ───────────────────────────────────

export function getEnemyDropTable(enemyType: string): EnemyDropTable | undefined {
  if (!enemyDrops) throw new Error('Data not loaded -- call loadAllData() first');
  return enemyDrops[enemyType];
}
