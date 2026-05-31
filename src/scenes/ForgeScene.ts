// ForgeScene v3 — split-pane "triangle convergence" layout.
//
// LEFT pane: a triangle of three rune sockets (1 on top, 2 on bottom) with the
// card altar at the centroid. Animated energy beams stream from each filled
// socket toward the altar, visualising "elements converging into a card".
//
// RIGHT pane: a tall blacksmith's rack of eight niches (2 cols × 4 rows). Each
// niche holds an ornate forged-sigil for one element with the available count
// stamped beside it.
//
// Logic is unchanged from earlier revisions — pure presentation rewrite over
// the existing ForgeSystem (validateForge / executeForge / discoverRecipe).

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { FONTS } from '../ui/StyleConstants';
import { createWoodButton } from '../ui/WoodButton';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import {
  ELEMENTS,
  FORGE_TIER_UNLOCK,
  resolveIconKey,
  type ElementId,
  type CardTier,
} from '../systems/ElementSystem';
import {
  findCardForElements,
  getForgeGoldCost,
  isTierUnlocked,
  validateForge,
  executeForge,
  discoverRecipe,
} from '../systems/ForgeSystem';
import type { ElementInventory } from '../systems/ShardSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';
import { createCardVisual } from '../ui/CardVisual';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';

const FF    = FONTS.family;
const GOLD  = '#ffd700';
const WHITE = '#ffffff';
const DIM   = '#aa8866';
const RED   = '#ff6655';
const EMBER = '#ffaa44';

// Canvas (Phaser world is 800x600 for this game).
const CANVAS_W = 800;
const CANVAS_H = 600;

// ── LEFT pane (forge zone) — centred around x=LEFT_CX ─────────────────────
const LEFT_CX = 220;

const SOCKET_R = 32;
// 1 socket on top, 2 on bottom — vertices of an upward-pointing triangle.
const SOCKET_POS: ReadonlyArray<{ x: number; y: number }> = [
  { x: LEFT_CX,      y: 120 }, // top apex
  { x: LEFT_CX - 95, y: 410 }, // bottom-left
  { x: LEFT_CX + 95, y: 410 }, // bottom-right
];

// Card altar at the centroid of the triangle.
const ALTAR_CX   = LEFT_CX;
const ALTAR_CY   = 265;
const ALTAR_W    = 170;
const ALTAR_H    = 210;
const CARD_SCALE = 0.55;

// Cost/status banner sits below bottom sockets.
const BANNER_Y = 458;
// Action button row.
const ACTION_Y = 515;

// ── RIGHT pane (inventory rack) ───────────────────────────────────────────
const RACK_CX = 615;
const RACK_CY = 325;
// Rack source (forge-inventory-rack-v2.jpeg) fills its 896×1280 frame edge to
// edge — no JPEG bezel to crop. We just scale it to RACK_W × RACK_H. The
// aspect ratio (0.7) is preserved by these numbers.
const RACK_W  = 342;
const RACK_H  = 488;

// Niche centres as percentages of the displayed rack area.
// Measured by scripts/measure-rack.mjs against the v2 source image.
const RACK_COL_PCT = [0.27, 0.70];
const RACK_ROW_PCT = [0.17, 0.39, 0.61, 0.82];

// Inventory ordering: physical column on the LEFT, elemental on the RIGHT.
const RACK_ELEMENTS: ElementId[][] = [
  ['attack',  'fire'],
  ['defense', 'water'],
  ['agility', 'air'],
  ['counter', 'earth'],
];

export class ForgeScene extends Scene {
  private goldText!: Phaser.GameObjects.Text;
  private dynLayer!: Phaser.GameObjects.Container;
  private beamsGfx!: Phaser.GameObjects.Graphics;
  private metaState: MetaState | null = null;
  private forgeSlots: ElementId[] = [];
  private parentSceneKey: string = SCENE_KEYS.PLANNING;
  private beamPulse = 0;

  constructor() { super(SCENE_KEYS.FORGE); }

  init(data?: { parentScene?: string }): void {
    this.parentSceneKey = data?.parentScene ?? SCENE_KEYS.PLANNING;
    this.forgeSlots = [];
  }

  create(): void {
    try {
      this.scene.bringToTop();

      this.buildStaticChrome();

      loadMetaState().then((m) => { this.metaState = m; }).catch(() => { /* ignore */ });

      this.dynLayer = this.add.container(0, 0);
      this.beamsGfx = this.add.graphics();

      this.renderForge();

      this.beamPulse = 0;
      this.events.on('update', (_t: number, dt: number) => {
        this.beamPulse = (this.beamPulse + dt * 0.0009) % 1;
        this.drawBeams();
      });

      // Leave Forge — top-left corner, WoodButton for consistency with other scenes.
      createWoodButton(this, 85, 30, '← Leave', () => this.close(),
        { width: 130, height: 36, fontSize: 14 });

      TutorialOverlay.mountIfActive(this);
      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[ForgeScene] Critical error in create():', err);
      this.close();
    }
  }

  // ── Static chrome (backdrop, title, gold readout, rack) ───────────────────
  private buildStaticChrome(): void {
    // Solid black base.
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x000000, 1);

    // Forge backdrop — animated spritesheet preferred, static fallback.
    if (this.textures.exists('forge_background')) {
      if (!this.anims.exists('forge_fire')) {
        this.anims.create({
          key: 'forge_fire',
          frames: this.anims.generateFrameNumbers('forge_background', { start: 0, end: 7 }),
          frameRate: 10,
          repeat: -1,
        });
      }
      const bg = this.add.sprite(CANVAS_W / 2, CANVAS_H / 2, 'forge_background');
      const scale = Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height);
      bg.setScale(scale).setAlpha(0.92);
      bg.play('forge_fire');
    } else if (this.textures.exists('forge_backdrop_v2')) {
      const bg = this.add.image(CANVAS_W / 2, CANVAS_H / 2, 'forge_backdrop_v2');
      const scale = Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height);
      bg.setScale(scale).setAlpha(0.88);
    }

    // Atmospheric vignette.
    const vign = this.add.graphics();
    vign.fillStyle(0x000000, 0.45);
    vign.fillRect(0, 0, CANVAS_W, 60);
    vign.fillRect(0, CANVAS_H - 40, CANVAS_W, 40);
    vign.fillStyle(0x000000, 0.30);
    vign.fillRect(0, 60, 30, CANVAS_H - 100);
    vign.fillRect(CANVAS_W - 30, 60, 30, CANVAS_H - 100);

    // Title.
    this.add.bitmapText(CANVAS_W / 2, 30, 'game_font_gold', 'THE FORGE', 26)
      .setOrigin(0.5).setLetterSpacing(6);

    // Gold readout — top-right.
    this.add.rectangle(CANVAS_W - 16, 30, 150, 28, 0x1a0a04, 0.88)
      .setOrigin(1, 0.5)
      .setStrokeStyle(2, 0xd4a04a, 1);
    this.goldText = this.add.text(CANVAS_W - 24, 30, `♦ ${getRun().economy.gold} Gold`, {
      fontSize: '14px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0.5);

    // Inventory rack on the right pane — the v2 source fills its frame edge
    // to edge with no bezel to crop, so a plain setDisplaySize is enough.
    if (this.textures.exists('forge_inventory_rack')) {
      this.add.image(RACK_CX, RACK_CY, 'forge_inventory_rack')
        .setDisplaySize(RACK_W, RACK_H);
    }

    // Left-pane subtitle.
    this.add.text(LEFT_CX, 68, 'Infuse three runes — they converge into one card', {
      fontSize: '11px', fontStyle: 'italic', color: '#d8b88a', fontFamily: FF,
      stroke: '#000', strokeThickness: 2,
      wordWrap: { width: 380 }, align: 'center',
    }).setOrigin(0.5);

    // Right-pane subtitle ("ELEMENT INVENTORY" label).
    this.add.text(RACK_CX, 68, 'ELEMENT RACK', {
      fontSize: '12px', fontStyle: 'bold', color: '#d8b88a', fontFamily: FF,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setLetterSpacing(4);
  }

  /** Rebuild socket frames, altar contents, sigil overlays, status, buttons. */
  private renderForge(): void {
    this.dynLayer.removeAll(true);

    const forgeLevel = this.metaState?.buildings.forge.level ?? 0;

    const run = getRun();
    this.goldText.setText(`♦ ${run.economy.gold} Gold`);

    const elementInv = (run.economy.elements ?? {}) as ElementInventory;
    const shardInv = (run.economy.shards ?? {}) as Record<string, number>;
    const slotUsage: Record<string, number> = {};
    for (const id of this.forgeSlots) slotUsage[id] = (slotUsage[id] ?? 0) + 1;

    this.renderSockets();
    this.renderAltar(forgeLevel);
    this.renderInventoryRack(elementInv, shardInv, slotUsage);
    this.renderActions(forgeLevel);
  }

  // ── Sockets (triangle vertices) ───────────────────────────────────────────
  private renderSockets(): void {
    for (let i = 0; i < 3; i++) {
      const { x: cx, y: cy } = SOCKET_POS[i];
      const id = this.forgeSlots[i];

      if (this.textures.exists('forge_rune_socket')) {
        const sock = this.add.image(cx, cy, 'forge_rune_socket')
          .setDisplaySize(SOCKET_R * 2.6, SOCKET_R * 2.6)
          .setBlendMode(Phaser.BlendModes.SCREEN);
        sock.setAlpha(id ? 1 : 0.62);
        this.dynLayer.add(sock);
      } else {
        const ring = this.add.graphics();
        ring.lineStyle(3, id ? 0xffd700 : 0x8a6a30, id ? 1 : 0.7);
        ring.strokeCircle(cx, cy, SOCKET_R);
        this.dynLayer.add(ring);
      }

      // Inner dark well.
      const well = this.add.graphics();
      well.fillStyle(0x000000, 0.78);
      well.fillCircle(cx, cy, SOCKET_R * 0.6);
      well.lineStyle(2, id ? 0xffd700 : 0x6a4020, id ? 1 : 0.55);
      well.strokeCircle(cx, cy, SOCKET_R * 0.6);
      this.dynLayer.add(well);

      if (id) {
        const elemColor = parseInt(ELEMENTS[id].color.replace('#', ''), 16);
        const glow = this.add.graphics();
        glow.fillStyle(elemColor, 0.42);
        glow.fillCircle(cx, cy, SOCKET_R * 0.55);
        this.dynLayer.add(glow);

        // Prefer the ornate forge sigil; otherwise use the painterly v2 icon
        // (or legacy pixel-art token) resolved by ElementSystem.resolveIconKey.
        const sigilKey = `forge_sigil_${id}`;
        const iconKey  = resolveIconKey(this.textures, id);
        if (this.textures.exists(sigilKey)) {
          const sig = this.add.image(cx, cy, sigilKey)
            .setDisplaySize(SOCKET_R * 1.3, SOCKET_R * 1.3)
            .setBlendMode(Phaser.BlendModes.SCREEN);
          this.dynLayer.add(sig);
        } else if (iconKey) {
          this.dynLayer.add(
            this.add.image(cx, cy, iconKey).setDisplaySize(34, 34),
          );
        }
        // Element name under the socket.
        this.dynLayer.add(
          this.add.text(cx, cy + SOCKET_R + 6, ELEMENTS[id].name, {
            fontSize: '10px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
            stroke: '#000', strokeThickness: 2,
          }).setOrigin(0.5),
        );

        // Click to un-slot.
        const hit = this.add.zone(cx, cy, SOCKET_R * 2, SOCKET_R * 2)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => { this.forgeSlots.splice(i, 1); this.renderForge(); });
        this.dynLayer.add(hit);
      } else {
        this.dynLayer.add(
          this.add.text(cx, cy, '○', {
            fontSize: '18px', color: '#6a4020', fontFamily: FF,
          }).setOrigin(0.5),
        );
        this.dynLayer.add(
          this.add.text(cx, cy + SOCKET_R + 6, `Slot ${i + 1}`, {
            fontSize: '9px', fontStyle: 'italic', color: DIM, fontFamily: FF,
          }).setOrigin(0.5),
        );
      }
    }
  }

  // ── Central card altar ────────────────────────────────────────────────────
  private renderAltar(forgeLevel: number): void {
    if (this.textures.exists('forge_card_altar')) {
      const alt = this.add.image(ALTAR_CX, ALTAR_CY, 'forge_card_altar')
        .setDisplaySize(ALTAR_W + 60, ALTAR_H + 78)
        .setBlendMode(Phaser.BlendModes.SCREEN);
      this.dynLayer.add(alt);
    } else {
      const fb = this.add.graphics();
      fb.fillStyle(0x0a0400, 0.85);
      fb.fillRect(ALTAR_CX - ALTAR_W / 2, ALTAR_CY - ALTAR_H / 2, ALTAR_W, ALTAR_H);
      fb.lineStyle(2, 0xd4a04a, 0.95);
      fb.strokeRect(ALTAR_CX - ALTAR_W / 2, ALTAR_CY - ALTAR_H / 2, ALTAR_W, ALTAR_H);
      this.dynLayer.add(fb);
    }

    const run = getRun();
    const elementInv = (run.economy.elements ?? {}) as ElementInventory;

    const card = this.forgeSlots.length >= 2 ? findCardForElements(this.forgeSlots) : null;
    // Tier maps 1:1 to element count — see ForgeSystem.validateForge (1 elem = T1,
    // 2 = T2, 3 = T3). Previously this was `length - 1`, which displayed the T2
    // cost for a T3 recipe and let users hit `insufficient_gold` mid-attempt.
    const tier = this.forgeSlots.length as 1 | 2 | 3;
    const cost = this.forgeSlots.length >= 2 ? getForgeGoldCost(tier, forgeLevel) : 0;
    const deckSize = run.deck.active.length;
    const validation = this.forgeSlots.length >= 2
      ? validateForge(this.forgeSlots, elementInv, run.economy.gold, forgeLevel, deckSize, 15)
      : null;

    if (card) {
      const visual = createCardVisual(this, ALTAR_CX, ALTAR_CY - 4, card.id, { scale: CARD_SCALE });
      this.dynLayer.add(visual);
    } else {
      const headline = this.forgeSlots.length >= 1 ? '???' : 'Empty';
      const subline = this.forgeSlots.length >= 1
        ? 'Tap a sigil\nto add to the recipe'
        : 'Pick 1-3 sigils\nfrom the rack';
      this.dynLayer.add(
        this.add.text(ALTAR_CX, ALTAR_CY - 22, headline, {
          fontSize: '30px', fontStyle: 'bold',
          color: this.forgeSlots.length >= 1 ? EMBER : DIM,
          fontFamily: FF, stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5),
      );
      this.dynLayer.add(
        this.add.text(ALTAR_CX, ALTAR_CY + 28, subline, {
          fontSize: '11px', color: '#d8b88a', fontFamily: FF, align: 'center',
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );
    }

    // Banner: cost + status, just below the altar (and above the buttons).
    let costText = '';
    let statusText = '';
    let statusColor = GOLD;
    if (card) {
      costText = `⚒ ${cost} Gold + ${this.forgeSlots.length} elements`;
      if (validation && !validation.ok) {
        statusText = forgeReason(validation.reason ?? 'invalid', tier, forgeLevel);
        statusColor = RED;
      } else if (!isTierUnlocked(tier, forgeLevel)) {
        statusText = `Tier ${tier} needs Forge Lv ${FORGE_TIER_UNLOCK[tier as CardTier]}`;
        statusColor = RED;
      } else {
        statusText = '✦ Ready to forge ✦';
        statusColor = '#9bff9b';
      }
    } else if (this.forgeSlots.length >= 2) {
      statusText = 'No card matches that combination.';
      statusColor = RED;
    }

    if (costText || statusText) {
      this.dynLayer.add(
        this.add.rectangle(LEFT_CX, BANNER_Y, 360, 28, 0x0a0400, 0.85)
          .setStrokeStyle(1.5, 0xd4a04a, 0.85),
      );
    }
    if (costText) {
      this.dynLayer.add(
        this.add.text(LEFT_CX - 8, BANNER_Y, costText, {
          fontSize: '11px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0.5),
      );
      this.dynLayer.add(
        this.add.text(LEFT_CX, BANNER_Y, '●', {
          fontSize: '8px', color: '#d4a04a', fontFamily: FF,
        }).setOrigin(0.5),
      );
    }
    if (statusText) {
      this.dynLayer.add(
        this.add.text(LEFT_CX + (costText ? 8 : 0), BANNER_Y, statusText, {
          fontSize: '11px', fontStyle: 'bold', color: statusColor, fontFamily: FF,
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(costText ? 0 : 0.5, 0.5),
      );
    }
  }

  // ── Energy beams from each filled socket converging on the altar ──────────
  private drawBeams(): void {
    if (!this.beamsGfx) return;
    this.beamsGfx.clear();

    // Altar attachment points (perimeter — looks like beams "enter" the altar).
    const altarTop    = { x: ALTAR_CX,                y: ALTAR_CY - ALTAR_H / 2 + 10 };
    const altarBL     = { x: ALTAR_CX - ALTAR_W / 2 + 18, y: ALTAR_CY + ALTAR_H / 2 - 10 };
    const altarBR     = { x: ALTAR_CX + ALTAR_W / 2 - 18, y: ALTAR_CY + ALTAR_H / 2 - 10 };
    const targets = [altarTop, altarBL, altarBR];

    for (let i = 0; i < 3; i++) {
      const id = this.forgeSlots[i];
      if (!id) continue;
      const { x: sx0, y: sy0 } = SOCKET_POS[i];
      const tx = targets[i].x;
      const ty = targets[i].y;
      const elemColor = parseInt(ELEMENTS[id].color.replace('#', ''), 16);

      // Source point on the socket perimeter, nearest the target.
      const dx = tx - sx0;
      const dy = ty - sy0;
      const dist = Math.hypot(dx, dy) || 1;
      const sx = sx0 + (dx / dist) * (SOCKET_R + 2);
      const sy = sy0 + (dy / dist) * (SOCKET_R + 2);

      // Wide soft beam.
      this.beamsGfx.lineStyle(8, elemColor, 0.18);
      this.beamsGfx.beginPath();
      this.beamsGfx.moveTo(sx, sy);
      this.beamsGfx.lineTo(tx, ty);
      this.beamsGfx.strokePath();

      // Sharp inner beam.
      this.beamsGfx.lineStyle(2, elemColor, 0.85);
      this.beamsGfx.beginPath();
      this.beamsGfx.moveTo(sx, sy);
      this.beamsGfx.lineTo(tx, ty);
      this.beamsGfx.strokePath();

      // Travelling pulse.
      const t = (this.beamPulse + i * 0.33) % 1;
      const px = sx + (tx - sx) * t;
      const py = sy + (ty - sy) * t;
      this.beamsGfx.fillStyle(0xffffff, 0.95);
      this.beamsGfx.fillCircle(px, py, 3);
      this.beamsGfx.fillStyle(elemColor, 0.5);
      this.beamsGfx.fillCircle(px, py, 7);
    }
  }

  // ── Inventory rack (right pane) ───────────────────────────────────────────
  private renderInventoryRack(
    elementInv: ElementInventory,
    shardInv: Record<string, number>,
    slotUsage: Record<string, number>,
  ): void {
    const rackLeft = RACK_CX - RACK_W / 2;
    const rackTop  = RACK_CY - RACK_H / 2;
    const nicheSize = Math.min(RACK_W * 0.28, RACK_H * 0.16); // visual size per niche

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        const id = RACK_ELEMENTS[row][col];
        const nx = rackLeft + RACK_W * RACK_COL_PCT[col];
        const ny = rackTop  + RACK_H * RACK_ROW_PCT[row];
        const elem = ELEMENTS[id];
        const elemColor = parseInt(elem.color.replace('#', ''), 16);
        const available = (elementInv[id] ?? 0) - (slotUsage[id] ?? 0);
        const shards = shardInv[id] ?? 0;
        const slotsLeft = this.forgeSlots.length < 3;
        const usable = available > 0 && slotsLeft;

        // Sigil — sits in the niche.
        const sigilKey = `forge_sigil_${id}`;
        const fallbackIconKey = resolveIconKey(this.textures, id);
        if (this.textures.exists(sigilKey)) {
          const sig = this.add.image(nx, ny, sigilKey)
            .setDisplaySize(nicheSize, nicheSize)
            .setBlendMode(Phaser.BlendModes.SCREEN);
          sig.setAlpha(usable ? 1 : 0.5);
          this.dynLayer.add(sig);
        } else if (fallbackIconKey) {
          const ic = this.add.image(nx, ny, fallbackIconKey)
            .setDisplaySize(nicheSize * 0.7, nicheSize * 0.7);
          ic.setAlpha(usable ? 1 : 0.4);
          this.dynLayer.add(ic);
        }

        // Subtle element-colour glow ring when usable.
        if (usable) {
          const halo = this.add.graphics();
          halo.lineStyle(2, elemColor, 0.55);
          halo.strokeCircle(nx, ny, nicheSize * 0.55);
          this.dynLayer.add(halo);
        }

        // Count badge — small dark coin in the lower-right of the niche.
        const badgeX = nx + nicheSize * 0.46;
        const badgeY = ny + nicheSize * 0.40;
        this.dynLayer.add(
          this.add.circle(badgeX, badgeY, 12, 0x1a0a04, 0.92)
            .setStrokeStyle(1.5, usable ? 0xd4a04a : 0x6a4020, usable ? 1 : 0.7),
        );
        this.dynLayer.add(
          this.add.text(badgeX, badgeY, `${available}`, {
            fontSize: '13px', fontStyle: 'bold', color: usable ? GOLD : DIM, fontFamily: FF,
            stroke: '#000', strokeThickness: 2,
          }).setOrigin(0.5),
        );

        // Tiny shard progress dot strip below the niche.
        if (shards > 0) {
          const dotsY = ny + nicheSize * 0.65;
          for (let s = 0; s < 10; s++) {
            const dx = nx - 22 + s * 5;
            this.dynLayer.add(
              this.add.circle(dx, dotsY, 1.6,
                s < shards ? elemColor : 0x3a2a1a,
                s < shards ? 0.95 : 0.6),
            );
          }
        }

        // Element name — small label above the niche.
        this.dynLayer.add(
          this.add.text(nx, ny - nicheSize * 0.55, elem.name, {
            fontSize: '10px', fontStyle: 'bold', color: usable ? WHITE : DIM, fontFamily: FF,
            stroke: '#000', strokeThickness: 2,
          }).setOrigin(0.5),
        );

        // Click hit zone — covers the full niche.
        if (usable) {
          const hit = this.add.zone(nx, ny, nicheSize * 1.05, nicheSize * 1.05)
            .setInteractive({ useHandCursor: true });
          hit.on('pointerdown', () => { this.forgeSlots.push(id); this.renderForge(); });
          this.dynLayer.add(hit);
        }
      }
    }
  }

  // ── Action button row (in the LEFT pane below the banner) ─────────────────
  private renderActions(forgeLevel: number): void {
    const y = ACTION_Y;
    const run = getRun();
    const elementInv = (run.economy.elements ?? {}) as ElementInventory;
    const card = this.forgeSlots.length >= 2 ? findCardForElements(this.forgeSlots) : null;
    const deckSize = run.deck.active.length;
    const validation = this.forgeSlots.length >= 2
      ? validateForge(this.forgeSlots, elementInv, run.economy.gold, forgeLevel, deckSize, 15)
      : null;
    const forgeable = !!(card && validation && validation.ok);

    const makeButton = (
      x: number, w: number, h: number, label: string, fontSize: number,
      color: string, fillHex: number, enabled: boolean, onClick: () => void,
    ): void => {
      const bg = this.add.rectangle(x, y, w, h, fillHex, enabled ? 0.92 : 0.45)
        .setStrokeStyle(2, enabled ? 0xd4a04a : 0x5a3a1a, enabled ? 1 : 0.6);
      const txt = this.add.text(x, y, label, {
        fontSize: `${fontSize}px`, fontStyle: 'bold', color: enabled ? color : DIM, fontFamily: FF,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setStrokeStyle(2.5, 0xffe8a0, 1); txt.setColor(WHITE); });
        bg.on('pointerout',  () => { bg.setStrokeStyle(2, 0xd4a04a, 1);   txt.setColor(color); });
        bg.on('pointerdown', onClick);
      }
      this.dynLayer.add([bg, txt]);
    };

    // Cluster the action buttons inside the LEFT pane.
    makeButton(LEFT_CX - 110, 84, 30, '↺ Clear', 12, '#aaddff', 0x1a0a04,
      this.forgeSlots.length > 0,
      () => { this.forgeSlots = []; this.renderForge(); });

    const forgeFill = forgeable ? 0x6a3a08 : 0x1a0a04;
    makeButton(LEFT_CX, 130, 36, '⚒ FORGE', 16, forgeable ? '#fff5c0' : DIM, forgeFill, forgeable,
      () => this.executeForgeAction());

    makeButton(LEFT_CX + 110, 84, 30, '📖 Library', 12, '#aaddff', 0x1a0a04, true,
      () => {
        this.scene.launch(SCENE_KEYS.LIBRARY, { parentKey: SCENE_KEYS.FORGE });
        this.scene.pause();
      });
  }

  private executeForgeAction(): void {
    const run = getRun();
    const forgeLevel = this.metaState?.buildings.forge.level ?? 0;
    const elementInv = (run.economy.elements ?? {}) as ElementInventory;
    const deckSize = run.deck.active.length;
    const validation = validateForge(this.forgeSlots, elementInv, run.economy.gold, forgeLevel, deckSize, 15);
    if (!validation.ok) return;
    const knownRecipes = this.metaState?.forgeRecipes ?? [];
    const result = executeForge(
      this.forgeSlots,
      elementInv,
      (amt) => { run.economy.gold -= amt; },
      forgeLevel,
      knownRecipes as any,
    );
    run.deck.droppedCards.push(result.cardId);

    if (result.isNewRecipe && this.metaState) {
      this.metaState.forgeRecipes = discoverRecipe(knownRecipes as any, this.forgeSlots, result.cardId) as any;
      saveMetaState(this.metaState).catch(() => { /* ignore */ });
    }

    AudioManager.playSFX(this, 'sfx_cashing', 0.6);

    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 0.9);
    flash.fillCircle(ALTAR_CX, ALTAR_CY, 40);
    this.tweens.add({
      targets: flash, alpha: 0, scale: 4, duration: 450, ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });

    this.forgeSlots = [];
    this.renderForge();
  }

  private close(): void {
    tutorialDirector.advanceIfMatches('forge-craft');
    const parent = this.parentSceneKey;
    const isSleeping = this.scene.isSleeping(parent);
    this.scene.stop();
    if (isSleeping) this.scene.wake(parent); else this.scene.resume(parent);
  }

  private cleanup(): void {
    if (this.dynLayer) {
      this.dynLayer.destroy(true);
      this.dynLayer = null as any;
    }
    if (this.beamsGfx) {
      this.beamsGfx.destroy();
      this.beamsGfx = null as any;
    }
  }
}

function forgeReason(reason: string, tier: number, forgeLevel: number): string {
  switch (reason) {
    case 'tier_locked':
      return `Tier ${tier} needs Forge Lv ${FORGE_TIER_UNLOCK[tier as CardTier]} (currently ${forgeLevel}).`;
    case 'no_card':                return 'No card matches that combination.';
    case 'insufficient_elements':  return 'Not enough element units.';
    case 'insufficient_gold':      return 'Not enough gold.';
    case 'deck_full':              return 'Deck full (max 15 cards).';
    default:                       return '';
  }
}
