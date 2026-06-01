// ForgeScene v4 — circular arc layout.
//
// Central circle: arco_forja.png ring with 8 shard slots + bigorna at center.
// Top bar: per-element inventory counts (×N).
// Bottom: FORGE / Clear buttons + cost/status banner.
// Logic unchanged: ForgeSystem (validateForge / executeForge / discoverRecipe).

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { FONTS } from '../ui/StyleConstants';
import { createWoodButton } from '../ui/WoodButton';
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
} from '../systems/ForgeSystem';
import type { ElementInventory } from '../systems/ShardSystem';
import { loadMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';
import { createCardVisual } from '../ui/CardVisual';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';

const FF   = FONTS.family;
const GOLD = '#ffd700';
const DIM  = '#aa8866';
const RED  = '#ff6655';
const EMBER = '#ffaa44';

const CANVAS_W = 800;
const CANVAS_H = 600;

// ── Arc layout ────────────────────────────────────────────────────────────────
const ARC_CX = 405;         // center X of the arc ring
const ARC_CY = 360;         // center Y of the arc ring
const ARC_W  = 506;         // display width of arco_forja.png
const SLOT_R = 162;         // radius to shard slot centers (tune to align with arc image)
const SLOT_ICON = 73;       // shard icon size (+40% −10% = +26%)
const ANVIL_W = 159;        // anvil display width (−10%)

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

// Banner.
const BANNER_Y = 530;

// ── Helper: position on the ring ─────────────────────────────────────────────
function ringPos(angleDeg: number, r: number): { x: number; y: number } {
  // User requested 75 degree offset to fix displacement (-85 + 10)
  const rad = (angleDeg - 75) * (Math.PI / 180);
  return { x: ARC_CX + r * Math.sin(rad), y: ARC_CY - r * Math.cos(rad) };
}

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
      loadMetaState().then((m) => { this.metaState = m; }).catch(() => {});
      this.dynLayer = this.add.container(0, 0);
      this.beamsGfx = this.add.graphics();
      this.renderForge();
      this.beamPulse = 0;
      this.events.on('update', (_t: number, dt: number) => {
        this.beamPulse = (this.beamPulse + dt * 0.0009) % 1;
        this.drawBeams();
      });
      createWoodButton(this, 75, CANVAS_H - 28, '← Leave', () => this.close(),
        { width: 120, height: 34, fontSize: 13 });
      TutorialOverlay.mountIfActive(this);
      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[ForgeScene] create error:', err);
      this.close();
    }
  }

  // ── Static chrome ─────────────────────────────────────────────────────────
  private buildStaticChrome(): void {
    // Background.
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x000000);
    if (this.textures.exists('forge_background')) {
      if (!this.anims.exists('forge_fire')) {
        this.anims.create({
          key: 'forge_fire',
          frames: this.anims.generateFrameNumbers('forge_background', { start: 0, end: 7 }),
          frameRate: 10, repeat: -1,
        });
      }
      const bg = this.add.sprite(CANVAS_W / 2, CANVAS_H / 2, 'forge_background');
      bg.setScale(Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height)).setAlpha(0.90);
      bg.play('forge_fire');
    } else if (this.textures.exists('forge_backdrop_v2')) {
      const bg = this.add.image(CANVAS_W / 2, CANVAS_H / 2, 'forge_backdrop_v2');
      bg.setScale(Math.max(CANVAS_W / bg.width, CANVAS_H / bg.height)).setAlpha(0.86);
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
    if (this.textures.exists('bigorna')) {
      this.add.image(ARC_CX - 5, ARC_CY + 120, 'bigorna').setDisplaySize(ANVIL_W, ANVIL_W);
    }

    // Arc ring.
    if (this.textures.exists('arco_forja')) {
      this.add.image(ARC_CX, ARC_CY, 'arco_forja').setDisplaySize(ARC_W, ARC_W);
    }

    // Gold readout.
    this.add.rectangle(CANVAS_W - 14, 116, 148, 26, 0x1a0a04, 0.88)
      .setOrigin(1, 0.5).setStrokeStyle(2, 0xd4a04a);
    this.goldText = this.add.text(CANVAS_W - 22, 116, `♦ ${getRun().economy.gold} Gold`, {
      fontSize: '13px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0.5);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  private renderForge(): void {
    this.dynLayer.removeAll(true);
    const run = getRun();
    this.goldText.setText(`♦ ${run.economy.gold} Gold`);
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
    const TOP_BAR_ORDER: ElementId[] = ['attack', 'defense', 'agility', 'counter', 'fire', 'earth', 'air', 'water'];
    const SLOT_W  = CANVAS_W / TOP_BAR_ORDER.length; // 100px
    const ICON_Y  = 56;   // vertical center of icon + count (aligns with baked "×")

    for (let i = 0; i < TOP_BAR_ORDER.length; i++) {
      const id    = TOP_BAR_ORDER[i];
      const count = (elementInv[id] ?? 0) + (shardInv[id] ?? 0);
      const cx    = SLOT_W * (i + 0.5);

      // First 6 slots: +20px right; all 8 slots: 35px icon.
      const first6  = i < 6;
      const iconPx  = 35;
      const iconOx  = first6 ? -14 : -34;
      const cntOx   = first6 ?   6 : -14;

      const sigilKey  = `forge_sigil_${id}`;
      const fallback  = resolveIconKey(this.textures, id);
      const iconKey   = this.textures.exists(sigilKey) ? sigilKey : (fallback ?? null);
      if (iconKey) {
        const icon = this.add.image(cx + iconOx, ICON_Y, iconKey);
        icon.setScale(iconPx / icon.width);
        icon.setAlpha(count > 0 ? 1 : 0.3);
        this.dynLayer.add(icon);
      }

      this.dynLayer.add(
        this.add.text(cx + cntOx, ICON_Y, `${count}`, {
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
      const { x: cx, y: cy } = ringPos(angleDeg, SLOT_R);
      const available = (elementInv[id] ?? 0) - (slotUsage[id] ?? 0);
      const selected  = this.forgeSlots.includes(id);
      const usable    = available > 0 && slotsLeft && !selected;
      const elem      = ELEMENTS[id];
      const elemColor = parseInt(elem.color.replace('#', ''), 16);

      // Slot glow for selected/usable.
      if (selected) {
        const glow = this.add.graphics();
        glow.fillStyle(elemColor, 0.35);
        glow.fillCircle(cx, cy, SLOT_ICON * 0.72);
        glow.lineStyle(2.5, elemColor, 0.9);
        glow.strokeCircle(cx, cy, SLOT_ICON * 0.72);
        this.dynLayer.add(glow);
      } else if (usable) {
        const halo = this.add.graphics();
        halo.lineStyle(1.5, elemColor, 0.45);
        halo.strokeCircle(cx, cy, SLOT_ICON * 0.65);
        this.dynLayer.add(halo);
      }

      // Shard icon.
      let iconObj: Phaser.GameObjects.Image | null = null;
      const sigilKey  = `forge_sigil_${id}`;
      const iconKey   = resolveIconKey(this.textures, id);
      const texKey    = this.textures.exists(sigilKey) ? sigilKey : iconKey;
      if (texKey) {
        iconObj = this.add.image(cx, cy, texKey).setDisplaySize(SLOT_ICON, SLOT_ICON);
        iconObj.setAlpha(1);
        if (selected) iconObj.setTint(0xffffff);
        this.dynLayer.add(iconObj);
      }

      // (Count badge and Element label removed by user request)

      // Click zone and hover.
      if (selected || usable) {
        let hitTarget: Phaser.GameObjects.GameObject;
        
        if (iconObj) {
          iconObj.setInteractive({ useHandCursor: true });
          hitTarget = iconObj;
          
          iconObj.on('pointerover', () => {
            if (iconObj) this.tweens.add({ targets: iconObj, displayWidth: SLOT_ICON * 1.35, displayHeight: SLOT_ICON * 1.35, duration: 150, ease: 'Sine.easeOut', overwrite: true });
          });
          iconObj.on('pointerout', () => {
            if (iconObj) this.tweens.add({ targets: iconObj, displayWidth: SLOT_ICON, displayHeight: SLOT_ICON, duration: 150, ease: 'Sine.easeOut', overwrite: true });
          });
        } else {
          const zone = this.add.zone(cx, cy, SLOT_ICON * 1.4, SLOT_ICON * 1.4).setInteractive({ useHandCursor: true });
          this.dynLayer.add(zone);
          hitTarget = zone;
        }

        if (selected) {
          hitTarget.on('pointerdown', () => {
            const idx = this.forgeSlots.indexOf(id);
            if (idx >= 0) { this.forgeSlots.splice(idx, 1); this.renderForge(); }
          });
        } else {
          hitTarget.on('pointerdown', () => { this.forgeSlots.push(id); this.renderForge(); });
        }
      }
    }
  }

  // ── Center: card preview (overlays bigorna when recipe found) ─────────────
  private renderCenterContent(forgeLevel: number): void {
    const run = getRun();
    const elementInv = (run.economy.elements ?? {}) as ElementInventory;
    const card = this.forgeSlots.length >= 2 ? findCardForElements(this.forgeSlots) : null;
    const tier = this.forgeSlots.length as 1 | 2 | 3;
    const cost = this.forgeSlots.length >= 2 ? getForgeGoldCost(tier, forgeLevel) : 0;
    const deckSize = run.deck.active.length;
    const validation = this.forgeSlots.length >= 2
      ? validateForge(this.forgeSlots, elementInv, run.economy.gold, forgeLevel, deckSize, 15)
      : null;

    if (card) {
      // Card preview floats in the center, above the bigorna.
      const visual = createCardVisual(this, ARC_CX, ARC_CY - 18, card.id, { scale: 0.52 });
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

    // Status banner (above buttons).
    let costText = '';
    let statusText = '';
    let statusColor = GOLD;
    if (card) {
      costText = `⚒ ${cost} Gold + ${this.forgeSlots.length} elements`;
      if (validation && !validation.ok) {
        statusText = forgeReason(validation.reason ?? 'invalid', tier, forgeLevel);
        statusColor = RED;
      } else if (!isTierUnlocked(tier, forgeLevel)) {
        statusText = `Tier ${tier} requires Forge Lv ${FORGE_TIER_UNLOCK[tier as CardTier]}`;
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
        this.add.rectangle(ARC_CX, BANNER_Y, 400, 24, 0x0a0400, 0.85)
          .setStrokeStyle(1.5, 0xd4a04a, 0.8),
      );
      if (costText) {
        this.dynLayer.add(
          this.add.text(ARC_CX - 6, BANNER_Y, costText, {
            fontSize: '11px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
            stroke: '#000', strokeThickness: 2,
          }).setOrigin(1, 0.5),
        );
        this.dynLayer.add(
          this.add.text(ARC_CX, BANNER_Y, ' ● ', {
            fontSize: '8px', color: '#d4a04a', fontFamily: FF,
          }).setOrigin(0.5),
        );
      }
      if (statusText) {
        this.dynLayer.add(
          this.add.text(ARC_CX + (costText ? 6 : 0), BANNER_Y, statusText, {
            fontSize: '11px', fontStyle: 'bold', color: statusColor, fontFamily: FF,
            stroke: '#000', strokeThickness: 2,
          }).setOrigin(costText ? 0 : 0.5, 0.5),
        );
      }
    }
  }

  // ── Energy beams from selected slots to center ────────────────────────────
  private drawBeams(): void {
    if (!this.beamsGfx) return;
    this.beamsGfx.clear();

    for (let i = 0; i < this.forgeSlots.length; i++) {
      const id = this.forgeSlots[i];
      const slot = CIRCLE_SLOTS.find(s => s.id === id);
      if (!slot) continue;

      const { x: sx0, y: sy0 } = ringPos(slot.angleDeg, SLOT_R);
      const tx = ARC_CX;
      const ty = ARC_CY;
      const elemColor = parseInt(ELEMENTS[id].color.replace('#', ''), 16);

      const dx = tx - sx0; const dy = ty - sy0;
      const dist = Math.hypot(dx, dy) || 1;
      const sx = sx0 + (dx / dist) * (SLOT_ICON * 0.5 + 2);
      const sy = sy0 + (dy / dist) * (SLOT_ICON * 0.5 + 2);

      this.beamsGfx.lineStyle(7, elemColor, 0.16);
      this.beamsGfx.beginPath();
      this.beamsGfx.moveTo(sx, sy);
      this.beamsGfx.lineTo(tx, ty);
      this.beamsGfx.strokePath();

      this.beamsGfx.lineStyle(2, elemColor, 0.82);
      this.beamsGfx.beginPath();
      this.beamsGfx.moveTo(sx, sy);
      this.beamsGfx.lineTo(tx, ty);
      this.beamsGfx.strokePath();

      const t = (this.beamPulse + i * 0.33) % 1;
      const px = sx + (tx - sx) * t;
      const py = sy + (ty - sy) * t;
      this.beamsGfx.fillStyle(0xffffff, 0.9);
      this.beamsGfx.fillCircle(px, py, 3);
      this.beamsGfx.fillStyle(elemColor, 0.5);
      this.beamsGfx.fillCircle(px, py, 6);
    }
  }

  // ── Action buttons ─────────────────────────────────────────────────────────
  private renderActions(_forgeLevel: number): void {
    // Buttons (Clear, Forge, Library) removed per user request.
  }

  // ── Forge execution ────────────────────────────────────────────────────────
  // executeForgeAction() was removed as per user request to remove bottom buttons.

  private close(): void {
    tutorialDirector.advanceIfMatches('forge-craft');
    const parent = this.parentSceneKey;
    const isSleeping = this.scene.isSleeping(parent);
    this.scene.stop();
    if (isSleeping) this.scene.wake(parent); else this.scene.resume(parent);
  }

  private cleanup(): void {
    this.dynLayer?.destroy(true);
    this.beamsGfx?.destroy();
    (this as any).dynLayer = null;
    (this as any).beamsGfx = null;
  }
}

function forgeReason(reason: string, tier: number, forgeLevel: number): string {
  switch (reason) {
    case 'tier_locked':            return `Tier ${tier} requires Forge Lv ${FORGE_TIER_UNLOCK[tier as CardTier]} (now ${forgeLevel}).`;
    case 'no_card':                return 'No card matches that combination.';
    case 'insufficient_elements':  return 'Not enough element units.';
    case 'insufficient_gold':      return 'Not enough gold.';
    case 'deck_full':              return 'Deck full (max 15 cards).';
    default:                       return '';
  }
}
