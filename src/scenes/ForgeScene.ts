// ForgeScene v4 — circular arc layout.
//
// Central circle: arco_forja.png ring with 8 shard slots + bigorna at center.
// Top bar: per-element inventory counts (×N).
// Bottom: FORGE / Clear buttons + cost/status banner.
// Logic unchanged: ForgeSystem (validateForge / executeForge / discoverRecipe).

import { Scene } from 'phaser';
import { getRun, setRun } from '../state/RunState';
import { FONTS } from '../ui/StyleConstants';
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
import { disableCardFaceInput } from '../ui/CardFace';
import { showCardDetail } from '../ui/CardDetailPopup';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { saveManager } from '../core/SaveManager';

const FF   = FONTS.family;
const GOLD = '#ffd700';
const DIM  = '#aa8866';
const RED  = '#ff6655';
const EMBER = '#ffaa44';

const CANVAS_W = 800;
const CANVAS_H = 600;

// ── Arc layout ────────────────────────────────────────────────────────────────
const ARC_CX = 405;
const ARC_CY = 360;
const SLOT_R = 162;
const SLOT_ICON = 73;

const CIRCLE_SLOTS: Array<{ id: ElementId; angleDeg: number }> = [
  { id: 'agility', angleDeg: 0   },
  { id: 'attack',  angleDeg: 45  },
  { id: 'defense', angleDeg: 90  },
  { id: 'counter', angleDeg: 135 },
  { id: 'earth',   angleDeg: 180 },
  { id: 'water',   angleDeg: 225 },
  { id: 'air',     angleDeg: 270 },
  { id: 'fire',    angleDeg: 315 },
];


// Shard ring positions (debug-layout 2026-06-02)
const RING_POSITIONS: Record<ElementId, { x: number; y: number }> = {
  agility: { x: 186.4, y: 288.8 },
  attack:  { x: 281,   y: 173.5 },
  defense: { x: 506.6, y: 177.6 },
  counter: { x: 605.3, y: 291.5 },
  earth:   { x: 577.9, y: 414.1 },
  water:   { x: 508.7, y: 522   },
  air:     { x: 276.7, y: 522   },
  fire:    { x: 213.7, y: 413.4 },
};

// Per-element display size override for ring shards (debug-layout 2026-06-02)
const RING_DISPLAY_SIZES: Partial<Record<ElementId, number>> = {
  agility: 77,
  attack:  76,
  defense: 88,
  counter: 79,
  earth:   76,
  water:   79,
  air:     82,
  fire:    79,
};

// Top bar icon and count positions (unchanged)
const TOP_BAR_LAYOUT: Record<ElementId, { ix: number; iy: number; isize: number; tx: number; ty: number }> = {
  attack:  { ix: 46.5,  iy: 54.4, isize: 45, tx: 93.9,  ty: 63.9 },
  defense: { ix: 145.5, iy: 54.9, isize: 52, tx: 196.1, ty: 65   },
  agility: { ix: 248.1, iy: 54.4, isize: 45, tx: 292.9, ty: 63.9 },
  counter: { ix: 347.6, iy: 54.9, isize: 47, tx: 393.9, ty: 62.3 },
  fire:    { ix: 448.6, iy: 54.4, isize: 45, tx: 488.1, ty: 63.4 },
  earth:   { ix: 537.6, iy: 53.4, isize: 47, tx: 578.7, ty: 63.9 },
  air:     { ix: 629.2, iy: 54.9, isize: 47, tx: 667.1, ty: 65   },
  water:   { ix: 716,   iy: 55.5, isize: 47, tx: 756.6, ty: 64.4 },
};

// ── Helper: position on the ring (fallback if id not in RING_POSITIONS) ───────
function ringPos(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (angleDeg - 75) * (Math.PI / 180);
  return { x: ARC_CX + r * Math.sin(rad), y: ARC_CY - r * Math.cos(rad) };
}

// Bigorna target position
const ANVIL_X = 395.8;
const ANVIL_Y = 477.9;
const ANVIL_DROP_R = 60; // raio de aceite do drop sobre a bigorna

export class ForgeScene extends Scene {
  private goldText!: Phaser.GameObjects.Text;
  private dynLayer!: Phaser.GameObjects.Container;
  private beamsGfx!: Phaser.GameObjects.Graphics;
  private anvilGlow!: Phaser.GameObjects.Graphics;
  private confirmPanel: Phaser.GameObjects.Container | null = null;
  private metaState: MetaState | null = null;
  private forgeSlots: ElementId[] = [];
  /** Recipe queued by the Forge recipe library; consumed on the next resume. */
  private pendingRecipe: ElementId[] | null = null;
  private parentSceneKey: string = SCENE_KEYS.PLANNING;
  private beamPulse = 0;
  // Drag state
  private dragGhost:  Phaser.GameObjects.Image | null = null;
  private dragId:     ElementId | null = null;
  private onPtrMove:  ((p: Phaser.Input.Pointer) => void) | null = null;
  private onPtrUp:    ((p: Phaser.Input.Pointer) => void) | null = null;
  private dwarfSpeakForge: ((text: string, canForge: boolean, onForge: () => void) => void) | null = null; // set by buildDwarfNPC
  // Named handlers/timers so they can be unregistered in cleanup (the scene
  // instance is reused across stop/start, so anonymous .on() listeners would
  // accumulate — each stale 'update' listener keeps advancing beamPulse).
  private onUpdate = (_t: number, dt: number): void => {
    this.beamPulse = (this.beamPulse + dt * 0.00035) % 1;
    this.drawBeams();
  };
  private onDwarfGlobalPointerDown: ((p: Phaser.Input.Pointer) => void) | null = null;

  constructor() { super(SCENE_KEYS.FORGE); }

  init(data?: { parentScene?: string }): void {
    this.parentSceneKey = data?.parentScene ?? SCENE_KEYS.PLANNING;
    this.forgeSlots = [];
  }

  create(): void {
    try {
      this.scene.bringToTop();
      this.buildStaticChrome();
      loadMetaState().then((m) => { this.metaState = m; }).catch(() => {});
      this.dynLayer = this.add.container(0, 0).setDepth(4);
      this.beamsGfx = this.add.graphics().setDepth(4);
      this.renderForge();
      this.beamPulse = 0;
      this.events.on('update', this.onUpdate, this);
      const leaveImg = this.add.image(0, 0, 'btn_forge_leave');
      leaveImg.setScale(120 / leaveImg.width);
      const LEAVE_X = 75;
      const LEAVE_Y = CANVAS_H - 28;
      const leaveCont = this.add.container(LEAVE_X, LEAVE_Y, [leaveImg])
        .setSize(120, 34).setInteractive({ useHandCursor: true });
      leaveCont.on('pointerover', () => this.tweens.add({ targets: leaveCont, scale: 1.05, duration: 100 }));
      leaveCont.on('pointerout', () => this.tweens.add({ targets: leaveCont, scale: 1, duration: 100 }));
      leaveCont.on('pointerdown', () => this.close());

      const recipesImg = this.add.image(0, 0, 'btn_recipes');
      recipesImg.setScale(130 / recipesImg.width);
      const recipesH = Math.round(recipesImg.height * (130 / recipesImg.width));
      const leaveH   = Math.round(leaveImg.height   * (120 / leaveImg.width));
      const recipesCont = this.add.container(LEAVE_X, LEAVE_Y - leaveH / 2 - recipesH / 2 - 6, [recipesImg])
        .setSize(130, recipesH).setInteractive({ useHandCursor: true });
      recipesCont.on('pointerover', () => this.tweens.add({ targets: recipesCont, scale: 1.05, duration: 100 }));
      recipesCont.on('pointerout', () => this.tweens.add({ targets: recipesCont, scale: 1, duration: 100 }));
      recipesCont.on('pointerdown', () => this.openRecipeLibrary());
      this.buildDwarfNPC();
      TutorialOverlay.mountIfActive(this);
      this.events.on('shutdown', this.cleanup, this);
      this.events.on('resume', this.handleResume, this);
    } catch (err) {
      console.error('[ForgeScene] create error:', err);
      this.close();
    }
  }

  // ── Static chrome ─────────────────────────────────────────────────────────
  private buildStaticChrome(): void {
    // Background estático (primeiro frame da forge).
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x000000);
    if (this.textures.exists('forge_frame_01')) {
      const bg = this.add.image(CANVAS_W / 2, CANVAS_H / 2, 'forge_frame_01');
      bg.setScale(Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height)).setAlpha(0.90);
    } else if (this.textures.exists('forge_backdrop_v2')) {
      const bg = this.add.image(CANVAS_W / 2, CANVAS_H / 2, 'forge_backdrop_v2');
      bg.setScale(Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height)).setAlpha(0.86);
    }

    // Fornalha animada — atrás da bigorna (depth -1).
    if (this.textures.exists('forge_fire_sheet')) {
      if (!this.anims.exists('forge_fire')) {
        this.anims.create({
          key: 'forge_fire',
          frames: this.anims.generateFrameNumbers('forge_fire_sheet', { start: 0, end: 7 }),
          frameRate: 10, repeat: -1,
        });
      }
      const fire = this.add.sprite(401.1, 338.4, 'forge_fire_sheet');
      fire.setScale(0.6815).setDepth(1);
      fire.play('forge_fire');
    }

    // Shard inventory bar — forge_moldure at very top, full canvas width.
    if (this.textures.exists('forge_moldure')) {
      const mold = this.add.image(0, 0, 'forge_moldure');
      mold.setScale(CANVAS_W / mold.width);
      mold.setOrigin(0, 0);
    }

    // Vignette — side edges only; top handled by forge_moldure, bottom removed.
    const vig = this.add.graphics();
    vig.fillStyle(0x000000, 0.28);
    vig.fillRect(0, 100, 28, CANVAS_H - 148);
    vig.fillRect(CANVAS_W - 28, 100, 28, CANVAS_H - 148);

    // Bigorna (anvil) at center — drawn first so it's behind the arc.
    // anvilGlow is drawn behind the anvil image and pulsed when slots are active.
    this.anvilGlow = this.add.graphics();
    if (this.textures.exists('bigorna')) {
      this.add.image(395.8, 477.9, 'bigorna').setScale(0.1508).setDepth(3);
    }

    // Arc ring — fixed scale from debug-layout (preserves aspect ratio).
    if (this.textures.exists('arco_forja')) {
      this.add.image(ARC_CX, ARC_CY, 'arco_forja').setScale(0.5172).setDepth(2);
    }

    // Gold readout — same layout as ShopScene: panel image + coin icon + text.
    const GOLD_W = 148;
    const goldCX = CANVAS_W - 14 - GOLD_W / 2;
    const goldPanelY = 116;
    const gb = this.add.container(goldCX, goldPanelY);
    if (this.textures.exists('shop_gold_panel')) {
      const gp = this.add.image(0, 0, 'shop_gold_panel');
      gp.setScale(GOLD_W / gp.width);
      gb.add(gp);
    } else {
      gb.add(this.add.rectangle(0, 0, GOLD_W, 26, 0x1a0a04, 0.88).setStrokeStyle(2, 0xd4a04a));
    }
    if (this.textures.exists('icon_coin')) {
      gb.add(this.add.image(-GOLD_W / 2 + 18, 0, 'icon_coin').setDisplaySize(18, 18));
    }
    this.goldText = this.add.text(8, 0, `${getRun().economy.gold} g`, {
      fontSize: '14px', fontStyle: 'bold', color: GOLD,
      fontFamily: FF, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    gb.add(this.goldText);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  private renderForge(): void {
    this.dynLayer.removeAll(true);
    const run = getRun();
    this.goldText.setText(`${run.economy.gold} g`);
    const forgeLevel = this.metaState?.buildings.forge.level ?? 0;
    const elementInv = (run.economy.elements ?? {}) as ElementInventory;
    const shardInv   = (run.economy.shards ?? {}) as Record<string, number>;
    const slotUsage: Record<string, number> = {};
    for (const id of this.forgeSlots) slotUsage[id] = (slotUsage[id] ?? 0) + 1;

    this.renderTopBar(elementInv, shardInv);
    this.renderShardCircle(elementInv, slotUsage);
    this.renderCenterContent(forgeLevel);
    this.renderActions(forgeLevel);
  }

  // ── Top bar: overlay icons + counts onto forge_moldure ────────────────────
  // Slot order matches the baked labels in forge_moldure.png (left→right).
  // Bar display dimensions: 800×99px (native 1404×173 scaled by width).
  // ICON_Y / CNT_X_OFF can be tuned if visual alignment needs adjustment.
  private renderTopBar(
    elementInv: ElementInventory,
    shardInv: Record<string, number>,
  ): void {
    const ORDER: ElementId[] = ['attack', 'defense', 'agility', 'counter', 'fire', 'earth', 'air', 'water'];

    for (const id of ORDER) {
      const count  = (elementInv[id] ?? 0) + (shardInv[id] ?? 0);
      const layout = TOP_BAR_LAYOUT[id];

      const iconKey = resolveIconKey(this.textures, id);
      if (iconKey) {
        const icon = this.add.image(layout.ix, layout.iy, iconKey);
        icon.setScale(layout.isize / icon.width);
        icon.setAlpha(count > 0 ? 1 : 0.3);
        this.dynLayer.add(icon);
      }

      this.dynLayer.add(
        this.add.text(layout.tx, layout.ty, `${count}`, {
          fontSize: '11px', fontStyle: 'bold',
          color: count > 0 ? GOLD : DIM, fontFamily: FF,
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5),
      );
    }
  }

  // ── Shard circle ──────────────────────────────────────────────────────────
  private renderShardCircle(
    elementInv: ElementInventory,
    slotUsage: Record<string, number>,
  ): void {
    const slotsLeft = this.forgeSlots.length < 3;

    for (const { id, angleDeg } of CIRCLE_SLOTS) {
      const { x: cx, y: cy } = RING_POSITIONS[id] ?? ringPos(angleDeg, SLOT_R);
      const available = (elementInv[id] ?? 0) - (slotUsage[id] ?? 0);
      const selected  = this.forgeSlots.includes(id);
      const usable    = available > 0 && slotsLeft;
      // Shard icon
      const texKey = resolveIconKey(this.textures, id);
      if (!texKey) continue;

      const sz      = RING_DISPLAY_SIZES[id] ?? SLOT_ICON;
      const iconObj = this.add.image(cx, cy, texKey).setDisplaySize(sz, sz);
      const inSlotCount = slotUsage[id] ?? 0;
      if (inSlotCount > 0 && usable)   iconObj.setTint(0xffd700); // dourado: tem na slot, ainda pode adicionar
      else if (selected && !usable)     iconObj.setTint(0xffffff); // branco: slot cheia (todos consumidos)
      if (!usable && !selected)         iconObj.setAlpha(0.35);
      this.dynLayer.add(iconObj);

      // Comportamento do ícone:
      // - usable (ainda há shards disponíveis E slots livres): arrastar adiciona.
      //   Se já há algum na slot (inSlotCount > 0), tap curto sem arrastar remove um.
      // - esgotado na slot (!usable, inSlotCount > 0): clique simples remove um.
      if (usable) {
        iconObj.setInteractive({ useHandCursor: true });
        iconObj.on('pointerover', () => {
          this.tweens.add({ targets: iconObj, displayWidth: sz * 1.25, displayHeight: sz * 1.25, duration: 120, ease: 'Sine.easeOut', overwrite: true });
        });
        iconObj.on('pointerout', () => {
          this.tweens.add({ targets: iconObj, displayWidth: sz, displayHeight: sz, duration: 120, ease: 'Sine.easeOut', overwrite: true });
        });
        iconObj.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
          // Se já está na slot: tap remove, drag adiciona mais.
          const tapRemove = inSlotCount > 0 ? () => {
            const idx = this.forgeSlots.lastIndexOf(id);
            if (idx >= 0) { this.forgeSlots.splice(idx, 1); this.dismissConfirmPanel(); this.renderForge(); }
          } : undefined;
          this.startDrag(id, texKey, sz, ptr, tapRemove);
        });
      } else if (inSlotCount > 0) {
        // Todos os disponíveis já estão na slot: clique remove um.
        iconObj.setInteractive({ useHandCursor: true });
        iconObj.on('pointerdown', () => {
          const idx = this.forgeSlots.lastIndexOf(id);
          if (idx >= 0) { this.forgeSlots.splice(idx, 1); this.dismissConfirmPanel(); this.renderForge(); }
        });
      }
    }
  }

  // ── Drag manual ───────────────────────────────────────────────────────────
  private ptrToWorld(p: Phaser.Input.Pointer): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: cam.scrollX + p.x / cam.zoom, y: cam.scrollY + p.y / cam.zoom };
  }

  private startDrag(id: ElementId, texKey: string, sz: number, ptr: Phaser.Input.Pointer, onTapCancel?: () => void): void {
    // Cancela drag anterior se houver
    this.cancelDrag();

    const wp      = this.ptrToWorld(ptr);
    const startX  = ptr.x;
    const startY  = ptr.y;
    let   hasMoved = false;

    this.dragId    = id;
    this.dragGhost = this.add.image(wp.x, wp.y, texKey)
      .setDisplaySize(sz * 0.85, sz * 0.85)
      .setAlpha(0.82)
      .setDepth(20);

    this.onPtrMove = (p: Phaser.Input.Pointer) => {
      if (this.dragGhost) {
        const w = this.ptrToWorld(p);
        this.dragGhost.setPosition(w.x, w.y);
        if (!hasMoved && Phaser.Math.Distance.Between(p.x, p.y, startX, startY) > 6) {
          hasMoved = true;
        }
      }
    };

    this.onPtrUp = (p: Phaser.Input.Pointer) => {
      const w = this.ptrToWorld(p);
      const dist = Phaser.Math.Distance.Between(w.x, w.y, ANVIL_X, ANVIL_Y);
      const dropped = dist <= ANVIL_DROP_R && this.dragId !== null && this.forgeSlots.length < 3;

      if (dropped && this.dragId) {
        // Animação do ghost voando para bigorna
        const ghost = this.dragGhost;
        this.dragGhost = null;
        this.tweens.add({
          targets: ghost, x: ANVIL_X, y: ANVIL_Y,
          scaleX: 0, scaleY: 0, alpha: 0,
          duration: 180, ease: 'Sine.easeIn',
          onComplete: () => ghost?.destroy(),
        });
        this.forgeSlots.push(this.dragId);
        this.dragId = null;
        this.removeDragListeners();
        this.dismissConfirmPanel();
        this.renderForge();
      } else {
        // Drop inválido — se o ponteiro mal se moveu e há callback de tap, executa-o
        const wasTap = !hasMoved;
        this.cancelDrag();
        if (wasTap && onTapCancel) onTapCancel();
      }
    };

    this.input.on('pointermove', this.onPtrMove);
    this.input.on('pointerup',   this.onPtrUp);
  }

  private cancelDrag(): void {
    if (this.dragGhost) { this.dragGhost.destroy(); this.dragGhost = null; }
    this.dragId = null;
    this.removeDragListeners();
  }

  private removeDragListeners(): void {
    if (this.onPtrMove) { this.input.off('pointermove', this.onPtrMove); this.onPtrMove = null; }
    if (this.onPtrUp)   { this.input.off('pointerup',   this.onPtrUp);   this.onPtrUp   = null; }
  }

  // ── Center: card preview (overlays bigorna when recipe found) ─────────────
  private renderCenterContent(forgeLevel: number): void {
    // Resolve a card for 1–3 selected shards so single-element (tier 1) recipes
    // also show their card and can be forged, not just 2–3 element combos.
    const card = this.forgeSlots.length >= 1 ? findCardForElements(this.forgeSlots) : null;

    if (card) {
      const visual = createCardVisual(this, ARC_CX - 5, ARC_CY - 68, card.id, { scale: 0.754 });
      disableCardFaceInput(visual);
      visual.setInteractive({ useHandCursor: true });
      visual.on('pointerdown', () => this.promptForgeForCard(card.id, forgeLevel));
      this.dynLayer.add(visual);
    } else if (this.forgeSlots.length >= 2) {
      this.dynLayer.add(
        this.add.text(ARC_CX, ARC_CY - 10, '???', {
          fontSize: '28px', fontStyle: 'bold', color: EMBER, fontFamily: FF,
          stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5),
      );
      this.dynLayer.add(
        this.add.text(ARC_CX, ARC_CY + 24, 'No matching recipe', {
          fontSize: '10px', color: RED, fontFamily: FF,
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );
    } else if (this.forgeSlots.length === 1) {
      this.dynLayer.add(
        this.add.text(ARC_CX, ARC_CY - 10, '???', {
          fontSize: '28px', fontStyle: 'bold', color: '#d8b88a', fontFamily: FF,
          stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5),
      );
    }
  }

  // Open the expanded card + dwarf forge prompt for the current forgeSlots.
  // Shared by the center-card click and recipes loaded from the library.
  private promptForgeForCard(cardId: string, forgeLevel: number): void {
    const run = getRun();
    const elementInv = (run.economy.elements ?? {}) as ElementInventory;
    const tier = this.forgeSlots.length as 1 | 2 | 3;
    const cost = getForgeGoldCost(tier, forgeLevel);
    const validation = validateForge(this.forgeSlots, elementInv, run.economy.gold, forgeLevel, run.deck.active.length, 15);
    const canForge = !!(validation?.ok && isTierUnlocked(tier, forgeLevel));
    const elemNames = [...new Set(this.forgeSlots)].join(', ');
    let line: string;
    if (canForge && cost <= 0) {
      // Tier 1 is free — no gold line.
      line = `Just yer ${this.forgeSlots.length} ${elemNames} shard\nan' it's yours.\nShall I forge it?`;
    } else if (canForge) {
      line = `This'll cost ye ${cost} gold\nan' ${this.forgeSlots.length} ${elemNames} shards.\nShall I forge it?`;
    } else if (validation && !validation.ok) {
      line = forgeReasonDwarf(validation.reason ?? 'invalid', tier, forgeLevel, cost);
    } else {
      line = `Tier ${tier} is locked, friend.\nUpgrade the forge first!`;
    }
    // Abre a carta expandida sem backdrop (anão fala ao lado)
    showCardDetail(this, cardId, undefined, undefined, true, true);
    // Anão fala com opções de forge (delay pequeno para não ser interceptado pelo backdrop)
    if (this.dwarfSpeakForge) {
      const speak = this.dwarfSpeakForge;
      this.time.delayedCall(50, () => speak(line, canForge, () => this.executeForgeAction(cardId, forgeLevel)));
    }
  }

  // ── Recipe library ──────────────────────────────────────────────────────────
  // Launch the card library in forge mode (cards expose a "send to anvil"
  // button). The forge is paused so it regains focus via the resume event.
  private openRecipeLibrary(): void {
    this.dismissConfirmPanel();
    this.scene.launch(SCENE_KEYS.LIBRARY, { parentKey: SCENE_KEYS.FORGE, forgeMode: true });
    this.scene.pause();
  }

  /** Queue a recipe selected in the library; loaded onto the anvil on resume. */
  loadRecipeFromLibrary(elements: ElementId[]): void {
    this.pendingRecipe = (elements ?? []).slice(0, 3);
  }

  // Fired when the library (or any overlay) closes and the forge resumes.
  // Drops a queued recipe's elements onto the anvil, ready to forge — the
  // player confirms by clicking the anvil card (no auto-prompt).
  private handleResume(): void {
    this.cancelDrag(); // clear any drag ghost left from before the overlay
    const loaded = this.pendingRecipe;
    this.pendingRecipe = null;
    if (loaded && loaded.length > 0) {
      this.forgeSlots = loaded.slice(0, 3);
    }
    this.dismissConfirmPanel();
    this.renderForge();
  }

  private dismissConfirmPanel(): void {
    if (!this.confirmPanel) return;
    const p = this.confirmPanel;
    this.confirmPanel = null;
    this.tweens.add({
      targets: p, alpha: 0, duration: 140, ease: 'Sine.easeIn',
      onComplete: () => p.destroy(true),
    });
  }

  // ── Forge execution ────────────────────────────────────────────────────────
  private executeForgeAction(_cardId: string, forgeLevel: number): void {
    this.dismissConfirmPanel();
    const run = getRun();
    const elementInv = (run.economy.elements ?? {}) as ElementInventory;

    try {
      const result = executeForge(
        this.forgeSlots,
        elementInv,
        (amount) => { run.economy.gold -= amount; },
        forgeLevel,
        (this.metaState?.forgeRecipes ?? []) as any,
      );

      run.deck.active.push(result.cardId);
      if (result.isNewRecipe && this.metaState) {
        this.metaState.forgeRecipes = discoverRecipe(
          (this.metaState.forgeRecipes ?? []) as any,
          this.forgeSlots,
          result.cardId,
        );
        saveMetaState(this.metaState).catch(() => {});
      }

      setRun(run);
      saveManager.save(run).catch(() => {});
    } catch (err) {
      console.error('[ForgeScene] executeForge failed:', err);
    }

    this.forgeSlots = [];
    tutorialDirector.advanceIfMatches('forge-craft');
    this.renderForge();
  }

  // ── Linhas tracejadas dos shards selecionados para a bigorna ─────────────
  private drawBeams(): void {
    if (!this.beamsGfx) return;
    this.beamsGfx.clear();
    this.anvilGlow?.clear();

    // Endpoint bem acima da bigorna (topo visual do asset)
    const AY = ANVIL_Y - 52;

    // Agrupa por elemento para calcular "força" (count)
    const countMap: Partial<Record<ElementId, number>> = {};
    for (const id of this.forgeSlots) countMap[id] = (countMap[id] ?? 0) + 1;

    // Linha de drag ao vivo (enquanto arrasta)
    if (this.dragGhost && this.dragId) {
      const slot = CIRCLE_SLOTS.find(s => s.id === this.dragId);
      if (slot) {
        const { x: sx, y: sy } = RING_POSITIONS[this.dragId!] ?? ringPos(slot.angleDeg, SLOT_R);
        const gx = this.dragGhost.x;
        const gy = this.dragGhost.y;
        const col = Number.parseInt(ELEMENTS[this.dragId!].color.replace('#', ''), 16);
        this.drawDashedLine(sx, sy, gx, gy, col, 2.5, 0.55, 10, 6);
      }
    }

    // Uma linha por elemento único (não por slot individual)
    const drawn = new Set<ElementId>();
    let lineIdx = 0;
    for (const id of this.forgeSlots) {
      if (drawn.has(id)) continue;
      drawn.add(id);

      const slot = CIRCLE_SLOTS.find(s => s.id === id);
      if (!slot) continue;

      const { x: sx, y: sy } = RING_POSITIONS[id] ?? ringPos(slot.angleDeg, SLOT_R);
      const elemColor = Number.parseInt(ELEMENTS[id].color.replace('#', ''), 16);
      const count     = countMap[id] ?? 1;

      // Espessura e opacidade crescem com o count
      const thickness = 3 + (count - 1) * 2;   // 3 / 5 / 7
      const alpha     = 0.60 + (count - 1) * 0.2; // 0.60 / 0.80 / 1.0

      this.drawDashedLine(sx, sy, ANVIL_X, AY, elemColor, thickness, alpha, 12, 7);

      // Bolinha animada percorrendo a linha
      const t  = (this.beamPulse + lineIdx * 0.37) % 1;
      const px = sx + (ANVIL_X - sx) * t;
      const py = sy + (AY - sy) * t;
      this.beamsGfx.fillStyle(0xffffff, 0.9);
      this.beamsGfx.fillCircle(px, py, 3);
      this.beamsGfx.fillStyle(elemColor, 0.65);
      this.beamsGfx.fillCircle(px, py, 6);

      lineIdx++;
    }

    // Borda da bigorna pisca quando há shards na slot
    if (this.forgeSlots.length > 0 && this.anvilGlow) {
      const glowAlpha = 0.4 + Math.sin(this.beamPulse * Math.PI * 2) * 0.35;
      const glowColor = this.forgeSlots.length >= 2 ? 0xffd700 : 0xaaddff;
      const glowR     = 38 + Math.sin(this.beamPulse * Math.PI * 2) * 4;
      this.anvilGlow.lineStyle(3, glowColor, glowAlpha);
      this.anvilGlow.strokeCircle(ANVIL_X, ANVIL_Y - 4, glowR);
      this.anvilGlow.lineStyle(6, glowColor, glowAlpha * 0.35);
      this.anvilGlow.strokeCircle(ANVIL_X, ANVIL_Y - 4, glowR + 6);
    }
  }

  private drawDashedLine(
    x1: number, y1: number, x2: number, y2: number,
    color: number, thickness: number, alpha: number,
    dashLen: number, gapLen: number,
  ): void {
    const dx   = x2 - x1;
    const dy   = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const ux   = dx / dist;
    const uy   = dy / dist;
    const step = dashLen + gapLen;

    this.beamsGfx.lineStyle(thickness, color, alpha);
    let d = 0;
    while (d < dist) {
      const dEnd = Math.min(d + dashLen, dist);
      this.beamsGfx.beginPath();
      this.beamsGfx.moveTo(x1 + ux * d,    y1 + uy * d);
      this.beamsGfx.lineTo(x1 + ux * dEnd, y1 + uy * dEnd);
      this.beamsGfx.strokePath();
      d += step;
    }
  }

  // ── Action buttons ─────────────────────────────────────────────────────────
  private renderActions(_forgeLevel: number): void {
    // Buttons (Clear, Forge, Library) removed per user request.
  }


  private close(): void {
    tutorialDirector.advanceIfMatches('forge-craft');
    const parent = this.parentSceneKey;
    const sleeping = this.scene.isSleeping(parent);
    const paused   = this.scene.isPaused(parent);
    this.scene.stop();
    if (sleeping)     this.scene.wake(parent);
    else if (paused)  this.scene.resume(parent);
    else              this.scene.start(parent);
  }

  // ── Forge dwarf NPC ──────────────────────────────────────────────────────────
  private buildDwarfNPC(): void {
    const LINES = [
      "Toss in yer shards an'\nI'll smith somethin'\nfine for ya!",
      "What're ye combining\ntoday, adventurer?",
      "The forge hungers\nfor elements!",
      "Pick yer shards,\nI'll do the rest.",
      "Every great blade\nstarts right here.",
      "Combine wisely,\nwarrior.",
      "Need somethin'\nforged? Let's go!",
    ];

    const NPC_X     = 744.1;
    const NPC_Y     = 604.6;
    const NPC_SCALE = 0.18;

    const idleKey = this.textures.exists('dwarf_hands_on_hips') ? 'dwarf_hands_on_hips' : null;
    const talkKey = this.textures.exists('dwarf_talking')       ? 'dwarf_talking'       : null;
    if (!idleKey) return;

    const dwarf = this.add.image(NPC_X, NPC_Y, idleKey)
      .setScale(NPC_SCALE).setOrigin(0.5, 1).setDepth(10);

    let activeBubble: Phaser.GameObjects.Container | null = null;
    let fadeTimer:    Phaser.Time.TimerEvent | null = null;
    let typeTimer:    Phaser.Time.TimerEvent | null = null;
    let lastLineIdx   = -1;

    const showBubble = (delayMs: number) => {
      // Cancela balão anterior
      if (fadeTimer)  { fadeTimer.remove();  fadeTimer  = null; }
      if (typeTimer)  { typeTimer.remove();  typeTimer  = null; }
      if (activeBubble) { activeBubble.destroy(); activeBubble = null; }
      dwarf.setTexture(idleKey);

      // Escolhe linha diferente da anterior
      let idx: number;
      do { idx = Math.floor(Math.random() * LINES.length); } while (idx === lastLineIdx && LINES.length > 1);
      lastLineIdx = idx;
      const fullText = LINES[idx];

      // Mede o balão com o texto completo para definir tamanho fixo
      const PAD_X = 14;
      const PAD_Y = 10;
      const FONT_SIZE = 18; // VT323 @ 18px lê bem em tamanho pequeno
      const WRAP_W    = 160;

      const tmp = this.add.bitmapText(0, -9999, 'vt323_white', fullText, FONT_SIZE)
        .setMaxWidth(WRAP_W);
      const TW = Math.ceil(tmp.width)  + PAD_X * 2;
      const TH = Math.ceil(tmp.height) + PAD_Y * 2;
      tmp.destroy();

      const BX = NPC_X - TW / 2 - 28;
      const BY = NPC_Y - dwarf.displayHeight - TH / 2 - 8;

      const bubble = this.add.container(BX, BY).setDepth(11).setAlpha(0);
      activeBubble  = bubble;

      // Fundo
      const bg = this.add.graphics();
      bg.fillStyle(0x080808, 0.93);
      bg.fillRoundedRect(-TW / 2, -TH / 2, TW, TH, 6);
      bg.lineStyle(1.5, 0xd4a04a, 0.9);
      bg.strokeRoundedRect(-TW / 2, -TH / 2, TW, TH, 6);
      // Rabinho
      bg.fillStyle(0x080808, 0.93);
      bg.fillTriangle(TW / 2 - 16, TH / 2, TW / 2 - 4, TH / 2, TW / 2 - 4, TH / 2 + 10);
      bg.lineStyle(1.5, 0xd4a04a, 0.9);
      bg.strokeTriangle(TW / 2 - 16, TH / 2, TW / 2 - 4, TH / 2, TW / 2 - 4, TH / 2 + 10);

      // Label começa vazio — typewriter vai preenchendo
      const label = this.add.bitmapText(0, 0, 'vt323_white', '', FONT_SIZE)
        .setMaxWidth(WRAP_W)
        .setOrigin(0.5);

      bubble.add([bg, label]);

      // Fade in + troca para boca aberta
      this.tweens.add({
        targets: bubble, alpha: 1, duration: 250, ease: 'Sine.easeOut', delay: delayMs,
        onStart: () => { if (talkKey) dwarf.setTexture(talkKey); },
        onComplete: () => {
          // Typewriter: 1 caracter a cada 40ms
          let charIdx = 0;
          typeTimer = this.time.addEvent({
            delay: 40,
            repeat: fullText.length - 1,
            callback: () => {
              if (!label.active) return;
              charIdx++;
              label.setText(fullText.substring(0, charIdx));
            },
          });
        },
      });

      // Duração total: delay + fade-in + typewriter + pausa leitura + fade-out
      const typewriterMs = fullText.length * 40;
      const totalDelay   = delayMs + 250 + typewriterMs + 2200;

      fadeTimer = this.time.delayedCall(totalDelay, () => {
        if (!bubble.active) return;
        this.tweens.add({
          targets: bubble, alpha: 0, duration: 400, ease: 'Sine.easeIn',
          onComplete: () => {
            bubble.destroy();
            if (activeBubble === bubble) {
              activeBubble = null;
              dwarf.setTexture(idleKey);
            }
          },
        });
      });
    };

    const closeBubble = () => {
      if (fadeTimer)  { fadeTimer.remove();  fadeTimer  = null; }
      if (typeTimer)  { typeTimer.remove();  typeTimer  = null; }
      if (!activeBubble) return;
      const bubble = activeBubble;
      activeBubble = null;
      this.tweens.add({
        targets: bubble, alpha: 0, duration: 220, ease: 'Sine.easeIn',
        onComplete: () => {
          bubble.destroy();
          dwarf.setTexture(idleKey);
        },
      });
    };

    // Balão especial para forge — texto customizado + botões FORGE/DISMISS
    const showForgeBubble = (text: string, canForge: boolean, onForge: () => void) => {
      if (fadeTimer)  { fadeTimer.remove();  fadeTimer  = null; }
      if (typeTimer)  { typeTimer.remove();  typeTimer  = null; }
      if (activeBubble) { activeBubble.destroy(); activeBubble = null; }
      if (talkKey) dwarf.setTexture(talkKey);

      const PAD_X     = 14;
      const PAD_Y     = 11;
      const FONT_SIZE = 16;
      const WRAP_W    = 162;
      const BTN_H     = canForge ? 36 : 0;

      const tmp = this.add.bitmapText(0, -9999, 'vt323_white', text, FONT_SIZE).setMaxWidth(WRAP_W);
      const TW = Math.ceil(tmp.width)  + PAD_X * 2;
      const TH = Math.ceil(tmp.height) + PAD_Y * 2 + BTN_H;
      tmp.destroy();

      const BX = NPC_X - TW / 2 - 28;
      const BY = NPC_Y - dwarf.displayHeight - TH / 2 + 2;

      const bubble = this.add.container(BX, BY).setDepth(11).setAlpha(0);
      activeBubble = bubble;

      const bg = this.add.graphics();
      bg.fillStyle(0x080808, 0.95);
      bg.fillRoundedRect(-TW / 2, -TH / 2, TW, TH, 6);
      bg.lineStyle(1.5, 0xd4a04a, 0.9);
      bg.strokeRoundedRect(-TW / 2, -TH / 2, TW, TH, 6);
      bg.fillStyle(0x080808, 0.95);
      bg.fillTriangle(TW / 2 - 16, TH / 2, TW / 2 - 4, TH / 2, TW / 2 - 4, TH / 2 + 10);
      bg.lineStyle(1.5, 0xd4a04a, 0.9);
      bg.strokeTriangle(TW / 2 - 16, TH / 2, TW / 2 - 4, TH / 2, TW / 2 - 4, TH / 2 + 10);
      bubble.add(bg);

      // Texto plain durante typewriter; colorido ao final
      const textOffY = canForge ? -BTN_H / 2 : 0;
      const label = this.add.bitmapText(0, textOffY, 'vt323_white', '', FONT_SIZE)
        .setMaxWidth(WRAP_W).setOrigin(0.5);
      bubble.add(label);

      // Botões FORGE e DISMISS (só se canForge)
      if (canForge) {
        const BTN_Y_OFF = TH / 2 - BTN_H / 2 - PAD_Y / 2;
        const makeBtn = (ox: number, texKey: string, onClick: () => void) => {
          const img = this.add.image(ox, BTN_Y_OFF, texKey).setScale(0.038)
            .setInteractive({ useHandCursor: true });
          img.on('pointerover', () => img.setTint(0xffffcc));
          img.on('pointerout',  () => img.clearTint());
          img.on('pointerdown', (ptr: Phaser.Input.Pointer) => { ptr.event.stopPropagation(); onClick(); });
          bubble.add(img);
        };
        makeBtn(-45, 'btn_forge_action', () => { closeBubble(); onForge(); });
        makeBtn(45, 'btn_dismiss', () => closeBubble());
      }

      this.tweens.add({
        targets: bubble, alpha: 1, duration: 200, ease: 'Sine.easeOut',
        onComplete: () => {
          let charIdx = 0;
          typeTimer = this.time.addEvent({
            delay: 35, repeat: text.length - 1,
            callback: () => {
              if (!label.active) return;
              charIdx++;
              label.setText(text.substring(0, charIdx));
            },
          });
        },
      });

      // Auto-fecha só se não tiver botão forge (mensagem de erro)
      if (!canForge) {
        const totalDelay = 200 + text.length * 35 + 3000;
        fadeTimer = this.time.delayedCall(totalDelay, () => {
          if (!bubble.active) return;
          this.tweens.add({
            targets: bubble, alpha: 0, duration: 400, ease: 'Sine.easeIn',
            onComplete: () => { bubble.destroy(); if (activeBubble === bubble) { activeBubble = null; dwarf.setTexture(idleKey); } },
          });
        });
      }
    };

    this.dwarfSpeakForge = showForgeBubble;

    // Aparece automaticamente ao entrar
    showBubble(400);

    // Clique no anão → nova fala
    dwarf.setInteractive({ useHandCursor: true });
    dwarf.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      ptr.event.stopPropagation();
      showBubble(0);
    });

    // Clique fora do anão → fecha o balão
    this.onDwarfGlobalPointerDown = () => {
      if (activeBubble && !this.dragId) closeBubble();
    };
    this.input.on('pointerdown', this.onDwarfGlobalPointerDown);
  }

  private cleanup(): void {
    this.events.off('shutdown', this.cleanup, this);
    this.events.off('update', this.onUpdate, this);
    this.events.off('resume', this.handleResume, this);
    if (this.onDwarfGlobalPointerDown) {
      this.input.off('pointerdown', this.onDwarfGlobalPointerDown);
      this.onDwarfGlobalPointerDown = null;
    }
    this.cancelDrag();
    this.dynLayer?.destroy(true);
    this.beamsGfx?.destroy();
    (this as any).dynLayer = null;
    (this as any).beamsGfx = null;
  }
}



function forgeReasonDwarf(reason: string, tier: number, _forgeLevel: number, cost: number): string {
  switch (reason) {
    case 'tier_locked':           return `Tier ${tier} needs\nForge Lv ${FORGE_TIER_UNLOCK[tier as CardTier]}.\nUpgrade first, friend!`;
    case 'no_card':               return `Hmm... no recipe\nmatches that combo.\nTry somethin' else!`;
    case 'insufficient_elements': return `Not enough shards\nfor this one.\nGather more!`;
    case 'insufficient_gold':     return `Need ${cost} gold for\nthis forge. Yer\nwallet's too light!`;
    case 'deck_full':             return `Yer deck's full!\nBanish a card first\nthen come back.`;
    default:                      return `Can't forge that\nright now, friend.`;
  }
}

