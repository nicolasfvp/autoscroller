// CardIconSubtitle -- a rotating "subtitle" caption pinned to the bottom of the
// screen that teaches the icons on whichever FULL card (with a description
// panel) is currently shown.
//
// Behaviour (per the feature spec):
//   - When a full card mounts, collect its icons (CardIconLegend.collectCardIcons).
//   - After ~1s on screen, the first icon's brief explanation fades in at the
//     bottom of the canvas.
//   - Every ~3s it switches to the next icon, cycling around the full set.
//   - Tears itself down when the owning card is destroyed (hover-out, popup
//     dismiss, scene shutdown) — or when a new full card takes over.
//
// There is at most ONE active subtitle at a time: full cards with a description
// appear one-at-a-time in this game (detail popup, library preview, deck-editor
// hover preview), so the latest mount owns the caption. The single hook is in
// CardFace.createCardFace (description branch), so every present and future
// full-card surface is covered automatically.

import Phaser from 'phaser';
import { LAYOUT, FONTS } from './StyleConstants';
import { renderTokenText } from './IconTokens';
import { getBriefIconDefinition, collectCardIcons } from './CardIconLegend';
import { getLocale } from '../i18n/i18n';
import type { CardDefinition } from '../data/types';

const INITIAL_DELAY_MS = 1000; // "after a second of it on the screen"
const CYCLE_MS = 3000;         // "after 3 seconds of it displaying, switch"
const FADE_MS = 220;
const DEPTH = 9500;            // above cards/popups (≤500) and the side panel (9000),
                               // below the glossary modal (11000).
const MAX_TEXT_WIDTH = 540;
const FONT_SIZE = 15;
const PAD_X = 20;
const PAD_Y = 11;
const BOTTOM_MARGIN = 16;
const TEXT_COLOR = '#ece2c4';
const DOT_GAP = 12;
const DOT_RADIUS = 2.5;
const DOT_ROW_GAP = 8;

interface SubtitleState {
  scene: Phaser.Scene;
  owner: Phaser.GameObjects.GameObject;
  icons: string[];
  index: number;
  root: Phaser.GameObjects.Container | null;
  startTimer: Phaser.Time.TimerEvent | null;
  cycleTimer: Phaser.Time.TimerEvent | null;
  onShutdown: () => void;
}

let state: SubtitleState | null = null;

/** Stop and remove any active subtitle (timers, visuals, scene listeners). */
export function hideCardIconSubtitle(): void {
  teardown();
}

function teardown(): void {
  if (!state) return;
  const s = state;
  state = null;
  if (s.startTimer) s.startTimer.remove(false);
  if (s.cycleTimer) s.cycleTimer.remove(false);
  if (s.root && s.root.active) {
    // Phaser 3.80 doesn't auto-remove a tween when its target is destroyed —
    // kill the in-flight fade so it can't write alpha to a dead container.
    s.scene.tweens.killTweensOf(s.root);
    s.root.destroy(true);
  }
  s.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, s.onShutdown);
  s.scene.events.off(Phaser.Scenes.Events.DESTROY, s.onShutdown);
}

/**
 * Begin (or replace) the bottom subtitle for a freshly-mounted full card.
 * No-op when the card carries no explainable icons. Wires teardown to the
 * card container's destroy event and the scene's shutdown/destroy.
 */
export function activateCardIconSubtitle(
  scene: Phaser.Scene,
  card: CardDefinition,
  isUpgraded: boolean,
  owner: Phaser.GameObjects.GameObject,
): void {
  const icons = collectCardIcons(card, isUpgraded);

  // A new full card takes over: drop the previous subtitle regardless.
  teardown();
  if (icons.length === 0) return;

  const onShutdown = () => teardown();
  const s: SubtitleState = {
    scene,
    owner,
    icons,
    index: 0,
    root: null,
    startTimer: null,
    cycleTimer: null,
    onShutdown,
  };
  state = s;

  // Tear down when this specific card goes away (guarded so a stale listener
  // from a replaced card can't kill the current one).
  owner.once('destroy', () => {
    if (state === s) teardown();
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  scene.events.once(Phaser.Scenes.Events.DESTROY, onShutdown);

  s.startTimer = scene.time.delayedCall(INITIAL_DELAY_MS, () => {
    if (state !== s) return;
    showIcon(0);
    if (s.icons.length > 1) {
      s.cycleTimer = scene.time.addEvent({
        delay: CYCLE_MS,
        loop: true,
        callback: () => {
          if (state !== s) return;
          showIcon((s.index + 1) % s.icons.length);
        },
      });
    }
  });
}

function showIcon(i: number): void {
  const s = state;
  if (!s) return;
  const { scene } = s;

  if (s.root && s.root.active) {
    scene.tweens.killTweensOf(s.root);
    s.root.destroy(true);
  }
  s.root = null;
  s.index = i;

  const id = s.icons[i];
  const brief = getBriefIconDefinition(id, getLocale());
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);

  // Caption text — the leading "[id]" renders as the colored icon glyph, so the
  // icon itself is the subject of the sentence (e.g. 🔥 "deals damage…").
  const text = renderTokenText(scene, 0, 0, `[${id}] ${brief}`, {
    fontSize: `${FONT_SIZE}px`,
    color: TEXT_COLOR,
    fontFamily: FONTS.body,
    wrapWidth: MAX_TEXT_WIDTH,
    align: 'center',
    lineSpacing: 3,
  });
  const textH = (text.getData('tokenTextHeight') as number | undefined) ?? FONT_SIZE;
  // Centered alignment puts the visual center at MAX_TEXT_WIDTH/2; getBounds
  // gives the real (possibly narrower) text width to size the panel snugly.
  const actualW = Math.min(MAX_TEXT_WIDTH, Math.max(40, text.getBounds().width));

  const showDots = s.icons.length > 1;
  const dotsRowH = showDots ? DOT_ROW_GAP + DOT_RADIUS * 2 : 0;
  const bgW = actualW + PAD_X * 2;
  const bgH = textH + dotsRowH + PAD_Y * 2;

  // Background — reuse the hover-panel texture for visual parity with the
  // keyword side panel; fall back to a dark/gold rounded-ish rectangle.
  const texKey = scene.textures.exists('panel_hover_frame')
    ? 'panel_hover_frame'
    : (scene.textures.exists('panel_hover') ? 'panel_hover' : null);
  if (texKey) {
    root.add(scene.add.image(0, 0, texKey).setOrigin(0.5).setDisplaySize(bgW, bgH));
  } else {
    root.add(
      scene.add.rectangle(0, 0, bgW, bgH, 0x0e0b06, 0.92)
        .setOrigin(0.5)
        .setStrokeStyle(1, 0x7a5018),
    );
  }

  // Shift the text left by half the wrap width so its centered content lands on
  // the panel center; top-anchor it inside the vertical padding.
  const top = -bgH / 2 + PAD_Y;
  text.setPosition(-MAX_TEXT_WIDTH / 2, top);
  root.add(text);

  // Progress dots — which icon of how many, when more than one cycles.
  if (showDots) {
    // DOT_ROW_GAP between the text bottom and the dot top; the dot's lower
    // edge then lands exactly dotsRowH below the text, so PAD_Y stays symmetric.
    const dotsY = top + textH + DOT_ROW_GAP + DOT_RADIUS;
    const startX = -((s.icons.length - 1) * DOT_GAP) / 2;
    for (let k = 0; k < s.icons.length; k++) {
      const active = k === i;
      root.add(
        scene.add.circle(
          startX + k * DOT_GAP,
          dotsY,
          DOT_RADIUS,
          active ? 0xffe6a8 : 0x6b5a36,
          active ? 1 : 0.7,
        ),
      );
    }
  }

  root.setPosition(LAYOUT.centerX, LAYOUT.canvasHeight - BOTTOM_MARGIN - bgH / 2);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: FADE_MS, ease: 'Sine.easeOut' });

  s.root = root;
}
