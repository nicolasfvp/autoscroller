// ForgeScene -- standalone recipe-crafting overlay, launched from PlanningOverlay.
// UI is adapted from the legacy ShopScene.modalForge; forge is no longer part
// of the shop categories (per design: direct access from the planning phase).

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { FONTS } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import {
  ELEMENTS,
  PHYSICAL_ELEMENTS,
  ELEMENTAL_ELEMENTS,
  type ElementId,
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

const FF    = FONTS.family;
const GOLD  = '#ffd700';
const WHITE = '#ffffff';
const DIM   = '#998877';
const RED   = '#ff6655';

const PANEL_W     = 470;
const PANEL_CX    = 400;
const PANEL_LEFT  = PANEL_CX - PANEL_W / 2;
const PANEL_RIGHT = PANEL_CX + PANEL_W / 2;

function colX(col: number, cols: number, itemW: number, gapW: number): number {
  const total = cols * itemW + (cols - 1) * gapW;
  const left  = PANEL_LEFT + (PANEL_W - total) / 2;
  return left + col * (itemW + gapW) + itemW / 2;
}

export class ForgeScene extends Scene {
  private goldText!: Phaser.GameObjects.Text;
  private container!: Phaser.GameObjects.Container;
  private metaState: MetaState | null = null;
  private forgeSlots: ElementId[] = [];
  /** Scene to wake/resume on close. Defaults to PlanningOverlay. */
  private parentSceneKey: string = SCENE_KEYS.PLANNING;

  constructor() { super(SCENE_KEYS.FORGE); }

  init(data?: { parentScene?: string }): void {
    this.parentSceneKey = data?.parentScene ?? SCENE_KEYS.PLANNING;
    this.forgeSlots = [];
  }

  create(): void {
    try {
      this.scene.bringToTop();

      // Dim backdrop + side rails (matches ShopScene's panel chrome).
      this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
      this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x130800, 0.92);
      this.add.rectangle(PANEL_LEFT, 300, 3, 600, 0x9a6030, 0.5);
      this.add.rectangle(PANEL_RIGHT, 300, 3, 600, 0x9a6030, 0.5);

      // Header
      this.add.rectangle(PANEL_CX, 24, PANEL_W, 48, 0x0a0400, 0.95);
      this.add.rectangle(PANEL_CX, 47, PANEL_W, 2, 0x9a6030, 0.7);
      this.add.text(PANEL_CX, 24, 'FORGE', {
        fontSize: '23px', fontStyle: 'bold', color: GOLD,
        fontFamily: FF, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);

      // Gold readout
      this.add.rectangle(PANEL_RIGHT - 4, 8, 130, 18, 0x3a2008, 0.92).setOrigin(1, 0).setStrokeStyle(1, 0x9a6030);
      this.goldText = this.add.text(PANEL_RIGHT - 8, 9, `♦ ${getRun().economy.gold} Gold`, {
        fontSize: '12px', fontStyle: 'bold', color: GOLD, fontFamily: FF, stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0);

      // Fire-and-forget meta load — recipe discovery uses it; rendering doesn't
      // depend on it being ready.
      loadMetaState().then((m) => { this.metaState = m; }).catch(() => { /* ignore */ });

      this.renderForge();

      // Close button (parallels ShopScene's "Leave Shop")
      const leave = this.add.text(PANEL_CX, 592, 'Leave Forge', {
        fontSize: '21px', fontStyle: 'bold', color: GOLD, fontFamily: FF, stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }).setShadow(2, 2, '#000', 2, true, true);
      leave.on('pointerover', () => leave.setColor(WHITE));
      leave.on('pointerout',  () => leave.setColor(GOLD));
      leave.on('pointerdown', () => this.close());

      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[ForgeScene] Critical error in create():', err);
      this.close();
    }
  }

  /** Rebuild the slot/inventory/preview UI from scratch (cheap; called on every change). */
  private renderForge(): void {
    if (this.container) this.container.destroy(true);
    this.container = this.add.container(0, 0);

    // TEMPORARY: forge restrictions disabled — see ForgeSystem.FORGE_OVERRIDE_LEVEL.
    const forgeLevel = 0;

    const run = getRun();
    this.goldText.setText(`♦ ${run.economy.gold} Gold`);

    const elementInv = (run.economy.elements ?? {}) as ElementInventory;
    const shardInv = (run.economy.shards ?? {}) as Record<string, number>;
    const slotUsage: Record<string, number> = {};
    for (const slotId of this.forgeSlots) {
      slotUsage[slotId] = (slotUsage[slotId] ?? 0) + 1;
    }

    // Inventory grid (8 elements, 2×4)
    const invStartY = 100;
    const cellW = 100;
    const cellH = 46;
    const rowGap = 4;
    const colGap = 6;
    [PHYSICAL_ELEMENTS, ELEMENTAL_ELEMENTS].forEach((row, rowIdx) => {
      row.forEach((id, colIdx) => {
        const x = colX(colIdx, 4, cellW, colGap);
        const y = invStartY + rowIdx * (cellH + rowGap) + cellH / 2;
        const elem = ELEMENTS[id];
        const elemColor = parseInt(elem.color.replace('#', ''), 16);
        const available = (elementInv[id] ?? 0) - (slotUsage[id] ?? 0);
        const shards = shardInv[id] ?? 0;
        const usable = available > 0 && this.forgeSlots.length < 4;

        const bg = this.add.rectangle(x, y, cellW, cellH, elemColor, usable ? 0.4 : 0.18)
          .setStrokeStyle(1.5, elemColor, usable ? 0.95 : 0.4);
        if (usable) {
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerover', () => bg.setStrokeStyle(2, 0xffffff, 1));
          bg.on('pointerout',  () => bg.setStrokeStyle(1.5, elemColor, 0.95));
          bg.on('pointerdown', () => { this.forgeSlots.push(id); this.renderForge(); });
        }
        const name = this.add.text(x - cellW / 2 + 6, y - cellH / 2 + 4, elem.name, {
          fontSize: '11px', fontStyle: 'bold', color: usable ? WHITE : DIM, fontFamily: FF,
        });
        const cnt = this.add.text(x + cellW / 2 - 6, y - cellH / 2 + 4, `${available}`, {
          fontSize: '16px', fontStyle: 'bold', color: usable ? GOLD : DIM, fontFamily: FF,
        }).setOrigin(1, 0);
        const shardLine = this.add.text(x + cellW / 2 - 6, y + cellH / 2 - 4, `+${shards}/10 shards`, {
          fontSize: '9px', color: shards > 0 ? '#c0c0c0' : DIM, fontFamily: FF,
        }).setOrigin(1, 1);
        this.container.add([bg, name, cnt, shardLine]);
      });
    });

    // Recipe slots
    const slotsY = invStartY + 2 * (cellH + rowGap) + 14;
    const slotW = 100;
    const slotH = 36;
    const slotGap = 6;
    this.container.add(this.add.text(PANEL_CX, slotsY - 14, 'Recipe', {
      fontSize: '12px', fontStyle: 'bold', color: DIM, fontFamily: FF,
    }).setOrigin(0.5));
    for (let i = 0; i < 4; i++) {
      const x = colX(i, 4, slotW, slotGap);
      const y = slotsY + slotH / 2;
      const id = this.forgeSlots[i];
      const fill = id ? parseInt(ELEMENTS[id].color.replace('#', ''), 16) : 0x1e1008;
      const slot = this.add.rectangle(x, y, slotW, slotH, fill, id ? 0.55 : 0.6)
        .setStrokeStyle(1.5, id ? 0xffffff : 0x4a3020, id ? 0.7 : 0.5);
      const label = this.add.text(x, y, id ? ELEMENTS[id].name : 'empty', {
        fontSize: '12px', fontStyle: 'bold', color: id ? WHITE : DIM, fontFamily: FF,
      }).setOrigin(0.5);
      if (id) {
        slot.setInteractive({ useHandCursor: true });
        slot.on('pointerdown', () => { this.forgeSlots.splice(i, 1); this.renderForge(); });
      }
      this.container.add([slot, label]);
    }

    // Preview area
    const previewY = slotsY + slotH + 18;
    const CARD_AREA_H = 130;
    const PREVIEW_RECT_H = CARD_AREA_H + 44;
    const cardAreaCenterY = previewY + CARD_AREA_H / 2;

    this.container.add(
      this.add.rectangle(PANEL_CX, previewY + PREVIEW_RECT_H / 2, PANEL_W - 30, PREVIEW_RECT_H, 0x130800, 0.6)
        .setStrokeStyle(1.5, 0x7a4820),
    );

    const card = this.forgeSlots.length >= 2 ? findCardForElements(this.forgeSlots) : null;
    const tier = (this.forgeSlots.length - 1) as 1 | 2 | 3;
    const cost = this.forgeSlots.length >= 2 ? getForgeGoldCost(tier, forgeLevel) : 0;
    const deckSize = run.deck.active.length;
    const validation = this.forgeSlots.length >= 2
      ? validateForge(this.forgeSlots, elementInv, run.economy.gold, forgeLevel, deckSize, 15)
      : null;

    let costText = '';
    let statusText = '';
    let statusColor = GOLD;

    if (card) {
      costText = `Cost: ${cost} gold + ${this.forgeSlots.length} elements`;
      if (validation && !validation.ok) {
        statusText = forgeReason(validation.reason ?? 'invalid', tier, forgeLevel);
        statusColor = RED;
      } else if (!isTierUnlocked(tier, forgeLevel)) {
        statusText = `Tier ${tier} needs Forge Lv ${tier === 2 ? 2 : 4}`;
        statusColor = RED;
      } else {
        statusText = 'Ready to forge';
        statusColor = '#88ff88';
      }
    } else if (this.forgeSlots.length >= 2) {
      statusText = 'No card matches that combination.';
      statusColor = RED;
    }

    if (card) {
      const visual = createCardVisual(this, PANEL_CX, cardAreaCenterY, card.id, { scale: 0.5 });
      this.container.add(visual);
    } else {
      const headline = this.forgeSlots.length >= 2 ? '???' : 'Pick 2-4 elements';
      const subline = this.forgeSlots.length >= 2
        ? 'Tap an element above to swap, or Clear to reset.'
        : 'Tap an element above to add to the recipe.';
      this.container.add([
        this.add.text(PANEL_CX, cardAreaCenterY - 14, headline, {
          fontSize: '22px', fontStyle: 'bold', color: DIM, fontFamily: FF,
        }).setOrigin(0.5),
        this.add.text(PANEL_CX, cardAreaCenterY + 18, subline, {
          fontSize: '11px', color: WHITE, fontFamily: FF, align: 'center',
          wordWrap: { width: PANEL_W - 60 },
        }).setOrigin(0.5),
      ]);
    }

    const costY = previewY + CARD_AREA_H + 8;
    const statusY = costY + 18;
    this.container.add([
      this.add.text(PANEL_CX, costY, costText, {
        fontSize: '12px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
      }).setOrigin(0.5),
      this.add.text(PANEL_CX, statusY, statusText, {
        fontSize: '11px', fontStyle: 'bold', color: statusColor, fontFamily: FF,
      }).setOrigin(0.5),
    ]);

    // Action buttons (Clear / Library / Forge)
    const actionsY = previewY + PREVIEW_RECT_H + 22;
    const clearBtn = this.add.text(PANEL_CX - 80, actionsY, '↺ Clear', {
      fontSize: '14px', fontStyle: 'bold', color: '#aaddff', fontFamily: FF,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    clearBtn.on('pointerover', () => clearBtn.setColor(WHITE));
    clearBtn.on('pointerout',  () => clearBtn.setColor('#aaddff'));
    clearBtn.on('pointerdown', () => { this.forgeSlots = []; this.renderForge(); });

    const libBtn = this.add.text(PANEL_CX, actionsY, '📖 Library', {
      fontSize: '14px', fontStyle: 'bold', color: '#aaddff', fontFamily: FF,
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    libBtn.on('pointerover', () => libBtn.setColor(WHITE));
    libBtn.on('pointerout',  () => libBtn.setColor('#aaddff'));
    libBtn.on('pointerdown', () => {
      this.scene.launch(SCENE_KEYS.LIBRARY, { parentKey: SCENE_KEYS.FORGE });
      this.scene.pause();
    });

    const forgeable = !!(card && validation && validation.ok);
    const forgeBtn = this.add.text(PANEL_CX + 80, actionsY, '⚒ Forge', {
      fontSize: '16px', fontStyle: 'bold', color: forgeable ? GOLD : DIM, fontFamily: FF,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    if (forgeable) {
      forgeBtn.setInteractive({ useHandCursor: true });
      forgeBtn.on('pointerover', () => forgeBtn.setColor(WHITE));
      forgeBtn.on('pointerout',  () => forgeBtn.setColor(GOLD));
      forgeBtn.on('pointerdown', () => this.executeForgeAction());
    }
    this.container.add([clearBtn, libBtn, forgeBtn]);
  }

  private executeForgeAction(): void {
    const run = getRun();
    const forgeLevel = 6; // TEMPORARY: forge restrictions disabled
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
    this.forgeSlots = [];
    this.renderForge();
  }

  private close(): void {
    const parent = this.parentSceneKey;
    const isSleeping = this.scene.isSleeping(parent);
    this.scene.stop();
    if (isSleeping) this.scene.wake(parent); else this.scene.resume(parent);
  }

  private cleanup(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null as any;
    }
  }
}

function forgeReason(reason: string, tier: number, forgeLevel: number): string {
  switch (reason) {
    case 'tier_locked':
      return `Tier ${tier} needs Forge Lv ${tier === 2 ? 2 : 4} (currently ${forgeLevel}).`;
    case 'no_card':                return 'No card matches that combination.';
    case 'insufficient_elements':  return 'Not enough element units.';
    case 'insufficient_gold':      return 'Not enough gold.';
    case 'deck_full':              return 'Deck full (max 15 cards).';
    default:                       return '';
  }
}
