// KeywordIntroService -- singleton that drives contextual keyword teaching.
//
// Lifecycle:
//   1. App start: someone calls init() to hydrate the seen-set from
//      MetaState (idb-keyval-backed).
//   2. Combat: CombatScene wires its `combat:card-played` listener into
//      handleCardPlayed(scene, cardDescription). For each unseen keyword
//      referenced by the card, the overlay is queued and shown one at a
//      time. While the overlay is visible, isPaused() returns true and
//      CombatScene.update() skips engine.tick().
//   3. On dismiss: the keyword is added to the in-memory seen set, the
//      MetaState is persisted (fire-and-forget), and the next queued
//      keyword (if any) shows next frame.
//
// The service is a module singleton because (a) the seen set is global
// per-player and (b) combat teaching must persist across scene remounts
// without re-loading IDB on every card play.

import Phaser from 'phaser';
import { detectKeywords, type KeywordDef } from '../../ui/KeywordDefinitions';
import { loadMetaState, saveMetaState } from '../MetaPersistence';
import { getLocale, type Locale } from '../../i18n/i18n';
import type { MetaState } from '../../state/MetaState';
import { openKeywordIntroOverlay } from '../../ui/KeywordIntroOverlay';

class KeywordIntroServiceImpl {
  private seen = new Set<string>();
  private metaRef: MetaState | null = null;
  private initialized = false;
  private queue: KeywordDef[] = [];
  private showingScene: Phaser.Scene | null = null;
  private isVisible = false;

  /** Load the persisted seen set into memory. Idempotent — safe to call on
   *  every scene boot. Returns the loaded MetaState so the caller can reuse
   *  it for other lookups. */
  async init(): Promise<MetaState> {
    if (!this.initialized) {
      this.metaRef = await loadMetaState();
      this.seen = new Set(this.metaRef.seenKeywords ?? []);
      this.initialized = true;
    }
    // Re-narrow: TS doesn't know metaRef is non-null after the if above.
    return this.metaRef!;
  }

  /** True while a keyword-intro overlay is on screen. Combat update loops
   *  poll this and skip engine ticks while it's true. */
  isPaused(): boolean {
    return this.isVisible;
  }

  /** Snapshot of seen keywords; used by GlossaryPanel to filter. */
  getSeenKeywords(): Set<string> {
    return new Set(this.seen);
  }

  /** Called by CombatScene on every card played. Detects keywords in the
   *  card's description, filters to unseen, and queues them up for the
   *  overlay. No-op if nothing unseen or the service isn't initialized. */
  handleCardPlayed(scene: Phaser.Scene, cardDescription: string, locale: Locale = getLocale()): void {
    if (!this.initialized) return;
    const kws = detectKeywords(cardDescription, locale);
    const unseen = kws.filter((kw) => !this.seen.has(kw.keyword));
    if (unseen.length === 0) return;

    // Queue everything but the first; show the first immediately.
    for (const kw of unseen) {
      // Avoid double-queuing the same keyword if two cards in close
      // succession both introduce it (one is already mid-overlay).
      if (this.queue.some((q) => q.keyword === kw.keyword)) continue;
      this.queue.push(kw);
    }
    if (!this.isVisible) this.showNext(scene);
  }

  private showNext(scene: Phaser.Scene): void {
    const next = this.queue.shift();
    if (!next) {
      this.isVisible = false;
      this.showingScene = null;
      return;
    }
    this.isVisible = true;
    this.showingScene = scene;
    openKeywordIntroOverlay(scene, next, () => this.onDismiss(next));
  }

  private onDismiss(shown: KeywordDef): void {
    this.markSeen(shown.keyword);
    const scene = this.showingScene;
    this.isVisible = false;
    // Schedule the next reveal on the next frame so the dismiss animation
    // has time to clear and the player isn't ambushed by an instant swap.
    if (scene) {
      scene.time.delayedCall(200, () => {
        // The scene may have shut down between the dismiss click and the
        // delayed callback (e.g., combat ended). Bail out cleanly.
        if (!scene.scene.isActive(scene.scene.key)) {
          this.queue = [];
          this.showingScene = null;
          return;
        }
        this.showNext(scene);
      });
    } else {
      this.queue = [];
    }
  }

  private markSeen(keyword: string): void {
    if (this.seen.has(keyword)) return;
    this.seen.add(keyword);
    if (this.metaRef) {
      // Defensive copy in case external code mutates metaRef.seenKeywords.
      const next = Array.from(this.seen);
      this.metaRef.seenKeywords = next;
      // Persist fire-and-forget. A failed write isn't user-visible — worst
      // case the player sees the same keyword intro again next session.
      saveMetaState(this.metaRef).catch((err) => {
        console.warn('[KeywordIntroService] save failed:', err);
      });
    }
  }

  /** Test seam — reset internal state between tests. */
  reset(): void {
    this.seen.clear();
    this.metaRef = null;
    this.initialized = false;
    this.queue = [];
    this.showingScene = null;
    this.isVisible = false;
  }
}

export const keywordIntro = new KeywordIntroServiceImpl();
