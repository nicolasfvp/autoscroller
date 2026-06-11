// TutorialDirector — scripted first-run tutorial orchestrator.
//
// Owns the step manifest and the player's progress through it. Each scene
// that participates in the tutorial (CharacterSelect, DeckCustomization,
// Game, Combat, Planning, Forge) checks isActive() in create() and mounts
// a TutorialOverlay tied to the current step.
//
// The director itself is an in-memory singleton, but its progress is
// snapshot()'d into the run save by SaveManager and restore()'d by MainMenu on
// Continue, so a reload mid-tutorial resumes at the same step. The run the
// tutorial drives is just a real run with a fixed seed/class/deck. Completion
// flips MetaState.tutorialSeen so subsequent boots skip the scripted flow.
//
// Steps advance either by:
//   - 'event': scene calls director.advanceIfMatches(stepId), wired to the
//     gameplay event that completes the lesson (e.g. card placed, combat
//     started). Director rejects out-of-order advances.
//   - 'click': overlay shows a "Next →" / "Got it" button.

import { SCENE_KEYS } from '../../state/SceneKeys';
import { t } from '../../i18n/i18n';

export type TutorialStepAdvance = 'click' | 'event';

/**
 * Serializable tutorial progress, persisted inside the run save so a reload +
 * Continue resumes the scripted flow at the same step. The director itself is
 * an in-memory singleton; this is its save/restore payload.
 */
export interface TutorialProgress {
  active: boolean;
  /** Index into TUTORIAL_STEPS, or -1 when inactive. */
  stepIndex: number;
}

export interface TutorialStep {
  /** Stable id used by scenes to assert progress. */
  id: string;
  /** Scene key this step belongs to. Overlay only mounts on this scene. */
  scene: string;
  /** Short headline shown bold at the top of the panel. */
  title: string;
  /** Body copy explaining the mechanic + what the player must do. */
  body: string;
  /** How this step ends. */
  advance: TutorialStepAdvance;
  /**
   * Optional spotlight rect in scene coordinates. The dim overlay cuts a
   * hole here and only this rect receives clicks. Omit for a centered modal.
   */
  spotlight?: { x: number; y: number; width: number; height: number };
  /** Where to anchor the text panel relative to the spotlight.
   *  'top-fixed' pins to y=12 regardless of the spotlight — use when a step's
   *  spotlight is near the bottom and you want the panel out of the way. */
  panelAnchor?: 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top-fixed';
  /** Optional: hide the Next button even when advance==='click'. Use rarely. */
  hideNext?: boolean;
}

/**
 * The full scripted manifest. Order matters — director.advance walks it
 * linearly. Step ids are stable so scene wiring can name them.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // 1. Welcome — lands on CharacterSelect, modal style.
  {
    id: 'welcome',
    scene: SCENE_KEYS.CHARACTER_SELECT,
    title: 'Welcome, hero.',
    body:
      "This run is your training ground. I'll walk you through every system step by step.\n\n" +
      "You can't take a wrong turn here — the path is scripted. Just follow the highlights.",
    advance: 'click',
    panelAnchor: 'center',
  },
  // 2. Pick the Warrior (locked).
  {
    id: 'pick-warrior',
    scene: SCENE_KEYS.CHARACTER_SELECT,
    title: 'Pick a class.',
    body:
      "Two classes — Warrior swings steel, Mage hurls elements. For the tutorial we'll run the Warrior.\n\n" +
      "Click the Warrior card to confirm.",
    advance: 'event',
  },
  // 3. Deck review — opens automatically after the class is locked in.
  //    Teaches that the deck plays itself top-to-bottom and that the
  //    player can reorder cards. Closes via the Back button (the same
  //    event hook that the in-run deck panel uses).
  {
    id: 'deck-review',
    scene: SCENE_KEYS.DECK_CUSTOMIZATION,
    title: 'Meet your deck.',
    body:
      "These are your 5 starter cards. In combat they play themselves on cooldown, TOP to BOTTOM.\n\n" +
      "• Hover any card to read what it does.\n" +
      "• DRAG a card onto another slot to swap their order — front-load fast attacks, back-load big finishers.\n\n" +
      "When you're ready, click BACK to start the run.",
    advance: 'event',
    panelAnchor: 'top-fixed',
  },
  // 4. Map + autoscroll explanation. Lives on GameScene.
  {
    id: 'map-intro',
    scene: SCENE_KEYS.GAME,
    title: 'The loop walks itself.',
    body:
      "Your hero auto-scrolls right through a looped path of tiles. You don't move them — you decide what's on the path.\n\n" +
      "Each loop, tiles trigger encounters: combat, treasure, events, and bosses.\n\n" +
      "Watch the hero approach the first tile…",
    advance: 'click',
    panelAnchor: 'top',
  },
  // 5. Combat starts — explain auto-play, cooldowns, and the keyword-intro
  //    hand-off. The KeywordIntroService handles the actual first-encounter
  //    pause for keywords, so we only NEED to mention it here; no separate
  //    combat-keyword step (it would stack on top of the real teach pause).
  {
    id: 'combat-intro',
    scene: SCENE_KEYS.COMBAT,
    title: 'Combat is automatic.',
    body:
      "Cards in your deck play themselves on cooldown, top to bottom.\n\n" +
      "Light cards cycle fast and chip damage. Heavy cards hit hard but recharge slowly.\n\n" +
      "When a card uses a new KEYWORD (Vengeance, Brace, Haste, Pierce, Exhaust), the game pauses on its own to teach it.\n\n" +
      "Sit back — your deck handles the rest.",
    advance: 'click',
    panelAnchor: 'top',
  },
  // 7. After victory → loop completed → PlanningOverlay opens.
  {
    id: 'planning-intro',
    scene: SCENE_KEYS.PLANNING,
    title: 'Plan the next loop.',
    body:
      "Every time you finish a loop, planning opens. Spend TILE POINTS (TP, top-right) to shape the next pass:\n\n" +
      "• Place tiles on the path: combat, treasure, events.\n" +
      "• Reserved slots (cyan border) accept SUBTILES — small buffs for adjacent fights.\n" +
      "• Toggle Remove Mode to take a tile off and get 50% TP back.",
    advance: 'click',
    panelAnchor: 'bottom',
  },
  // 8. Force-place a combat tile (terrain). Body steers the player toward
  //    the leftmost icons (Forest/Graveyard/Swamp/Desert/Lava) so the next
  //    step (subtile) has a reserved slot to land in.
  {
    id: 'place-tile',
    scene: SCENE_KEYS.PLANNING,
    title: 'Place a combat tile.',
    body:
      "Pick the FOREST tile from the inventory (leftmost icon).\n\n" +
      "Then click an empty slot on the path above to drop it in.",
    advance: 'event',
    panelAnchor: 'top-fixed',
  },
  // 8b. Subtile placement — the combat tile we just placed reserved its
  //     neighbour slots (cyan border). Drop a subtile in one of them.
  {
    id: 'place-subtile',
    scene: SCENE_KEYS.PLANNING,
    title: 'Drop a subtile.',
    body:
      "Combat tiles reserve their neighbour slots (cyan border). Subtiles go there and BUFF the adjacent fight.\n\n" +
      "Pick one from the smaller row below (Ambush, Mana Well, Magma Burst…) and click an open reserved slot.",
    advance: 'event',
    panelAnchor: 'top-fixed',
  },
  // 8c. Open the merchant. The forge needs ELEMENTS and the player has none
  //     yet, so we route through the shop first to buy a relic + 2 elements.
  {
    id: 'shop-intro',
    scene: SCENE_KEYS.PLANNING,
    title: 'Visit the merchant.',
    body:
      "Forging needs ELEMENTS — and the merchant sells them.\n\n" +
      "Click the SHOP button (top-left icon row) to step inside.",
    advance: 'event',
    panelAnchor: 'bottom',
  },
  // 8d. Buy a relic. The tutorial shop is forced to a single affordable common
  //     relic so the gold budget (relic + 2 elements + forge) always balances.
  {
    id: 'shop-buy-relic',
    scene: SCENE_KEYS.SHOP,
    title: 'Buy a relic.',
    body:
      "RELICS are passive artifacts — buy one and it works for the rest of the run, no equipping.\n\n" +
      "Click the relic on the shelf to purchase it.",
    advance: 'event',
    panelAnchor: 'bottom',
  },
  // 8e. Buy 2 elements. Any two work — every pair maps to a tier-2 card. Only
  //     buying is allowed here (selling is disabled during the tutorial).
  {
    id: 'shop-buy-elements',
    scene: SCENE_KEYS.SHOP,
    title: 'Buy two elements.',
    body:
      "ELEMENTS normally drop from defeated enemies — and here you can buy or sell them too.\n\n" +
      "Buy any TWO now (tap a −50g button twice). You'll forge them into a card next.",
    advance: 'event',
    panelAnchor: 'top',
  },
  // 8f. Leave the shop — returns to planning with the forge step armed.
  {
    id: 'shop-leave',
    scene: SCENE_KEYS.SHOP,
    title: 'Leave the shop.',
    body: "That's everything you need here. Click LEAVE SHOP to head back to planning.",
    advance: 'event',
    panelAnchor: 'top',
  },
  // 9. Forge — open it, craft a card from the two elements just bought.
  {
    id: 'forge-intro',
    scene: SCENE_KEYS.PLANNING,
    title: 'Forge a card.',
    body:
      "Click the FORGE button (top-left icon row of the planning screen).\n\n" +
      "The forge turns elements into new cards. You just bought two — combine them into a tier-2 card.",
    advance: 'event',
    panelAnchor: 'bottom',
  },
  {
    id: 'forge-craft',
    scene: SCENE_KEYS.FORGE,
    title: 'Combine elements.',
    body: "Tap your two element sigils on the rack to load the runes, then press ⚒ FORGE. Leave when the card is made.",
    advance: 'event',
    panelAnchor: 'top-fixed',
  },
  // 10. Boss tile preview.
  {
    id: 'boss-preview',
    scene: SCENE_KEYS.PLANNING,
    title: 'Bosses every few loops.',
    body:
      "Every few loops, a BOSS tile spawns at the end of the path. Beat it to safely exit the run with full rewards.\n\n" +
      "Die mid-loop and you keep only a fraction of what you earned.\n\n" +
      "Click START LOOP to send your hero out.",
    advance: 'event',
    panelAnchor: 'top-fixed',
  },
  // 12. Wrap up.
  {
    id: 'complete',
    scene: SCENE_KEYS.GAME,
    title: "That's it.",
    body:
      "You've seen everything you need: your deck, the loop, combat keywords, planning, and the forge.\n\n" +
      "Good luck out there.",
    advance: 'click',
    panelAnchor: 'center',
  },
];

/**
 * Resolve a step's title/body through i18n by its stable id, leaving every
 * other field untouched. The English literals baked into TUTORIAL_STEPS act as
 * the fallback if a key is missing (t() degrades to English then the raw key).
 */
function localizeStep(step: TutorialStep): TutorialStep {
  return { ...step, title: t(`tutorial.${step.id}.title`), body: t(`tutorial.${step.id}.body`) };
}

class TutorialDirectorImpl {
  private active = false;
  private currentIndex = -1;
  private listeners = new Set<() => void>();

  /** Begin the scripted tutorial. Idempotent: re-calling resets to step 0. */
  start(): void {
    this.active = true;
    this.currentIndex = 0;
    this.notify();
  }

  /** True while the player is inside the scripted run. */
  isActive(): boolean {
    return this.active;
  }

  /** True while a CLICK-advance step targets the given scene. Used by
   *  CombatScene to pause its tick loop while a "press Next to continue"
   *  modal is on screen — same gating pattern the KeywordIntroService uses. */
  shouldPauseScene(sceneKey: string): boolean {
    const s = this.getCurrentStep();
    return !!s && s.scene === sceneKey && s.advance === 'click';
  }

  /** Current step, or null if not active / off the end. */
  getCurrentStep(): TutorialStep | null {
    if (!this.active) return null;
    if (this.currentIndex < 0 || this.currentIndex >= TUTORIAL_STEPS.length) return null;
    return localizeStep(TUTORIAL_STEPS[this.currentIndex]);
  }

  /** Step relevant to this scene right now, or null. Helper for scene mounts. */
  getStepForScene(sceneKey: string): TutorialStep | null {
    const s = this.getCurrentStep();
    return s && s.scene === sceneKey ? localizeStep(s) : null;
  }

  /**
   * Advance the tutorial IF the current step id matches. Scenes pass their
   * expected id so a stale event from a previous step is a no-op. Returns
   * true on advance.
   */
  advanceIfMatches(stepId: string): boolean {
    const s = this.getCurrentStep();
    if (!s || s.id !== stepId) return false;
    this.advance();
    return true;
  }

  /** Unconditional advance (used by overlay "Next" buttons). */
  advance(): void {
    if (!this.active) return;
    this.currentIndex++;
    if (this.currentIndex >= TUTORIAL_STEPS.length) {
      this.complete();
      return;
    }
    this.notify();
  }

  /** Mark tutorial finished; flips the active flag so scenes skip overlays. */
  complete(): void {
    this.active = false;
    this.currentIndex = -1;
    this.notify();
  }

  /** Serialize current progress for persistence in the run save. */
  snapshot(): TutorialProgress {
    return { active: this.active, stepIndex: this.currentIndex };
  }

  /**
   * Restore progress from a saved snapshot (run resume). Used to override the
   * blanket start() the menu fires on every first-run boot so a continued run
   * resumes the tutorial at its saved step. A missing/inactive snapshot, or an
   * out-of-range index (e.g. a legacy save predating this field), deactivates
   * the director so non-tutorial runs aren't left with a ghost overlay.
   */
  restore(snap: TutorialProgress | null | undefined): void {
    if (!snap || !snap.active || snap.stepIndex < 0 || snap.stepIndex >= TUTORIAL_STEPS.length) {
      this.active = false;
      this.currentIndex = -1;
    } else {
      this.active = true;
      this.currentIndex = snap.stepIndex;
    }
    this.notify();
  }

  /** Subscribe to step-change notifications. Returns an unsubscribe fn. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch (err) { console.warn('[TutorialDirector] listener threw:', err); }
    }
  }
}

export const tutorialDirector = new TutorialDirectorImpl();
