// Lightweight runtime i18n engine.
//
// Single source of truth for the active UI language. Two locales are shipped:
//   - 'pt-br' (default) — full Brazilian Portuguese translation.
//   - 'en'             — original English text (kept as a fallback + option).
//
// Design constraints that drove this shape:
//   - Phaser locks canvas/scene config before any async MetaState (idb-keyval)
//     load can resolve, exactly like the graphics-quality preset. So the active
//     locale must be readable SYNCHRONOUSLY at module-init time. We mirror the
//     choice into localStorage (`autoscroller:lang`) and read that here; the
//     durable copy lives in MetaState and is reconciled on boot.
//   - `t()` must NEVER throw and must always return a string. A missing key
//     falls back to the English table, then to the raw key — so a half-finished
//     translation degrades to English/key text, never a crash or blank.

import enStrings from './strings/en.json';
import ptStrings from './strings/pt-br.json';

export type Locale = 'pt-br' | 'en';
export const SUPPORTED_LOCALES: readonly Locale[] = ['pt-br', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'pt-br';

/** Human-facing label for each locale (shown in the language switcher). */
export const LOCALE_LABEL: Record<Locale, string> = {
  'pt-br': 'Português',
  en: 'English',
};

/** Short tag for compact toggles ("PT" / "EN"). */
export const LOCALE_SHORT: Record<Locale, string> = {
  'pt-br': 'PT',
  en: 'EN',
};

const LS_KEY = 'autoscroller:lang';

type StringTable = Record<string, string>;
const TABLES: Record<Locale, StringTable> = {
  en: enStrings as StringTable,
  'pt-br': ptStrings as StringTable,
};

function isLocale(v: unknown): v is Locale {
  return v === 'pt-br' || v === 'en';
}

/** Read the synchronous localStorage mirror (set whenever the user picks a
 *  language). Returns null when unset or unavailable (SSR / private mode). */
function readStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LS_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

/** Initial locale when nothing is stored. The browser ships pt-BR (the
 *  product default). Test runners (vitest/node) fall back to English so the
 *  large body of existing English-copy assertions stays valid without
 *  per-test locale setup; pt-BR-specific tests call setLocale('pt-br'). */
function initialLocale(): Locale {
  try {
    if (typeof process !== 'undefined' &&
        (process.env?.VITEST || process.env?.NODE_ENV === 'test')) {
      return 'en';
    }
  } catch {
    /* `process` not defined in the browser bundle — fall through */
  }
  return DEFAULT_LOCALE;
}

const storedAtInit = readStoredLocale();
let current: Locale = storedAtInit ?? initialLocale();

/** True when an explicit locale was present in the localStorage mirror at boot
 *  (i.e. the player has chosen a language before). The reconciliation in
 *  main.ts only adopts the durable MetaState copy when this is false, so an
 *  explicit choice always wins over the save's default. */
export function wasLocaleExplicitlyStored(): boolean {
  return storedAtInit !== null;
}

type Listener = (locale: Locale) => void;
const listeners = new Set<Listener>();

export function getLocale(): Locale {
  return current;
}

/**
 * Switch the active locale. Writes the synchronous localStorage mirror and
 * notifies subscribers (DataLoader re-localization + scene restart wiring).
 * The durable MetaState copy is persisted separately by the caller (so the
 * engine stays free of the async persistence dependency).
 */
export function setLocale(locale: Locale): void {
  if (!isLocale(locale) || locale === current) return;
  current = locale;
  try {
    localStorage.setItem(LS_KEY, locale);
  } catch {
    /* private mode — in-memory only */
  }
  for (const cb of [...listeners]) {
    try {
      cb(locale);
    } catch (err) {
      console.warn('[i18n] locale listener failed:', err);
    }
  }
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Translate a key. Optional `{param}` placeholders are interpolated from
 * `params`. Resolution order: active locale → English → raw key. Never throws.
 *
 *   t('menu.play')                       → "Jogar"
 *   t('shop.cost', { gold: 25 })         → "Custa 25 de ouro"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const table = TABLES[current];
  let s = table[key];
  if (s === undefined) s = TABLES.en[key];
  if (s === undefined) s = key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (_m, name: string) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`,
    );
  }
  return s;
}

/** True when `key` has an explicit entry in the active or English table. Lets
 *  callers decide whether to fall back to a non-translated literal. */
export function hasKey(key: string): boolean {
  return TABLES[current][key] !== undefined || TABLES.en[key] !== undefined;
}
