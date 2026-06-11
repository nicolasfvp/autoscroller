// DailySeed — date/seed helpers + deterministic class/deck derivation for Daily Run.
//
// Every player worldwide playing the same UTC day must get an identical run
// configuration (class + 5-card deck + enemy seed). We derive the whole config
// from a single SeededRNG('daily-YYYY-MM-DD') so two browsers in different
// timezones still agree on what "today" is.

import { SeededRNG } from './SeededRNG';
import { CLASS_REGISTRY } from './hero/ClassRegistry';
import cardsJson from '../data/json/cards.json';

const NICKNAME_KEY = 'autoscroller:nickname';
const STARTER_DECK_SIZE = 5;

const ALL_T1_CARD_IDS: string[] = (cardsJson as { cards: { id: string }[] }).cards
  .filter((c) => c.id.startsWith('t1-'))
  .map((c) => c.id);

/** Today's date in UTC as YYYY-MM-DD. */
export function utcDateString(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Seed string used for the daily run's RNG. */
export function dailySeedString(date: Date = new Date()): string {
  return `daily-${utcDateString(date)}`;
}

export interface DailyRunConfig {
  /** The class id (e.g. 'warrior') used for the run. Random per day. */
  className: string;
  /** Exactly STARTER_DECK_SIZE unique t1 card ids. Random per day. */
  starterDeck: string[];
  /** The seed string this config was derived from. */
  seed: string;
}

/** Shared class+deck picker. The map/enemy `seed` is carried through unchanged
 *  so callers control the daily map identity independently of the RNG used to
 *  pick class/deck. */
function buildConfig(rng: SeededRNG, seed: string): DailyRunConfig {
  const classIds = Object.keys(CLASS_REGISTRY).sort(); // stable order
  const className = rng.pick(classIds);
  // Shuffle a copy of the t1 pool and take the first N. Sorted source keeps
  // the shuffle reproducible regardless of cards.json declaration order.
  const pool = [...ALL_T1_CARD_IDS].sort();
  rng.shuffle(pool);
  const starterDeck = pool.slice(0, STARTER_DECK_SIZE);
  return { className, starterDeck, seed };
}

/**
 * Pure, deterministic: same seed → same class + deck. Kept for the ticker and
 * any consumer that needs the canonical per-day config.
 */
export function deriveDailyRunConfig(seed: string): DailyRunConfig {
  return buildConfig(new SeededRNG(`${seed}-config`), seed);
}

/**
 * Class + deck are randomized per run (fresh entropy each call), but the
 * returned `seed` still points at the day's map/enemy seed so every daily
 * shares the same course — only the loadout varies. Used by the daily-run
 * entrypoint so each attempt rolls a new class/deck.
 */
export function randomDailyRunConfig(seed: string): DailyRunConfig {
  const entropy = `${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return buildConfig(new SeededRNG(entropy), seed);
}

/** Picks "anon-XXXX" (4 base36 chars). */
export function generateDefaultNickname(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `anon-${suffix}`;
}

/** Read the saved nickname, or null if none has been set. */
export function getStoredNickname(): string | null {
  try {
    const v = localStorage.getItem(NICKNAME_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Persist nickname, trimmed and capped at 16 chars. */
export function setStoredNickname(nickname: string): string {
  const clean = nickname.trim().slice(0, 16) || generateDefaultNickname();
  try {
    localStorage.setItem(NICKNAME_KEY, clean);
  } catch {
    // localStorage can throw in privacy mode; we just lose persistence.
  }
  return clean;
}

/** Convenience: read existing, or generate+store a default. */
export function ensureNickname(): string {
  const existing = getStoredNickname();
  if (existing) return existing;
  return setStoredNickname(generateDefaultNickname());
}
