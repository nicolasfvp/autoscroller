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
  FORGE_TIER_UNLOCK,
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

      // Atmospheric dim backdrop. The forge_table asset provides the wood
      // frame + gold "FORGE" banner + anvil/tools illustration, so we drop
      // the bespoke rectangle chrome that used to fake it.
      this.add.rectangle(400, 300, 800, 600, 0x0a0400, 0.85);
      if (this.textures.exists('forge_table')) {
        // Asset is 1056x976. Display ~640x592 centred so it fills the
        // canvas vertically with room for the Leave Forge text below.
        this.add.image(400, 296, 'forge_table').setDisplaySize(648, 596);
      } else {
        // Fallback to the old rectangle chrome if the asset is missing.
        this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x130800, 0.92);
        this.add.rectangle(PANEL_LEFT, 300, 3, 600, 0x9a6030, 0.5);
        this.add.rectangle(PANEL_RIGHT, 300, 3, 600, 0x9a6030, 0.5);
        this.add.rectangle(PANEL_CX, 24, PANEL_W, 48, 0x0a0400, 0.95);
        this.add.text(PANEL_CX, 24, 'FORGE', {
          fontSize: '23px', fontStyle: 'bold', color: GOLD,
          fontFamily: FF, stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true);
      }

      // Gold readout — top-right corner, sized to fit inside the wood frame.
      this.add.rectangle(PANEL_RIGHT - 4, 14, 130, 22, 0x3a2008, 0.85)
        .setOrigin(1, 0)
        .setStrokeStyle(1.5, 0xd4a04a, 0.9);
      this.goldText = this.add.text(PANEL_RIGHT - 8, 16, `♦ ${getRun().economy.gold} Gold`, {
        fontSize: '13px', fontStyle: 'bold', color: GOLD, fontFamily: FF, stroke: '#000', strokeThickness: 2,
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

      // Scripted tutorial overlay — 'forge-craft' step is intentionally
      // spotlightless. The player needs the full forge UI (elements, slots,
      // craft, leave) so the overlay falls back to a passive hint panel.
      TutorialOverlay.mountIfActive(this);

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

    // Inventory grid (8 elements, 2×4). Cells now carry the existing token
    // sprite (icon_attack, icon_fire, …) instead of being plain rectangles —
    // matches the visual language of the rest of the UI (CardFace uses the
    // same icons for cost/effect tokens).
    const invStartY = 96;
    const cellW = 100;
    const cellH = 54;
    const rowGap = 6;
    const colGap = 6;
    [PHYSICAL_ELEMENTS, ELEMENTAL_ELEMENTS].forEach((row, rowIdx) => {
      row.forEach((id, colIdx) => {
        const x = colX(colIdx, 4, cellW, colGap);
        const y = invStartY + rowIdx * (cellH + rowGap) + cellH / 2;
        const elem = ELEMENTS[id];
        const elemColor = parseInt(elem.color.replace('#', ''), 16);
        const available = (elementInv[id] ?? 0) - (slotUsage[id] ?? 0);
        const shards = shardInv[id] ?? 0;
        const usable = available > 0 && this.forgeSlots.length < 3;

        // Cell background: dark wood inset with element-colored stroke.
        const bg = this.add.rectangle(x, y, cellW, cellH, 0x1a0c04, usable ? 0.88 : 0.5)
          .setStrokeStyle(2, elemColor, usable ? 0.95 : 0.35);
        if (usable) {
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerover', () => bg.setStrokeStyle(2.5, 0xffe8a0, 1));
          bg.on('pointerout',  () => bg.setStrokeStyle(2, elemColor, 0.95));
          bg.on('pointerdown', () => { this.forgeSlots.push(id); this.renderForge(); });
        }
        this.container.add(bg);

        // Element token icon — left side of the cell.
        const iconKey = `icon_${id}`;
        if (this.textures.exists(iconKey)) {
          const icon = this.add.image(x - cellW / 2 + 18, y, iconKey).setDisplaySize(28, 28);
          if (!usable) icon.setAlpha(0.45);
          this.container.add(icon);
        }

        // Name label, right-aligned in the remaining space.
        const name = this.add.text(x - cellW / 2 + 36, y - 12, elem.name, {
          fontSize: '12px', fontStyle: 'bold', color: usable ? WHITE : DIM, fontFamily: FF,
          stroke: '#000', strokeThickness: 2,
        });
        // Count: large gold number bottom-right.
        const cnt = this.add.text(x + cellW / 2 - 6, y - 12, `${available}`, {
          fontSize: '18px', fontStyle: 'bold', color: usable ? GOLD : DIM, fontFamily: FF,
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0);
        // Shard progress — tiny grey text at the bottom of the cell.
        const shardLine = this.add.text(x, y + cellH / 2 - 9, `${shards}/10 shards`, {
          fontSize: '9px', color: shards > 0 ? '#c0c0c0' : DIM, fontFamily: FF,
        }).setOrigin(0.5, 1);
        this.container.add([name, cnt, shardLine]);
      });
    });

    // Recipe slots
    const slotsY = invStartY + 2 * (cellH + rowGap) + 18;
    const slotW = 110;
    const slotH = 40;
    const slotGap = 8;
    // Gold "Recipe" header to match the forge_table banner styling.
    this.container.add(this.add.text(PANEL_CX, slotsY - 16, 'RECIPE', {
      fontSize: '13px', fontStyle: 'bold', color: GOLD, fontFamily: FF,
      stroke: '#000', strokeThickness: 2, letterSpacing: 2,
    }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) {
      const x = colX(i, 3, slotW, slotGap);
      const y = slotsY + slotH / 2;
      const id = this.forgeSlots[i];
      const fill = id ? parseInt(ELEMENTS[id].color.replace('#', ''), 16) : 0x1a0c04;
      const slot = this.add.rectangle(x, y, slotW, slotH, fill, id ? 0.65 : 0.85)
        .setStrokeStyle(2, id ? 0xffd700 : 0x6a4020, id ? 0.95 : 0.6);
      this.container.add(slot);

      if (id) {
        // Icon + element name when filled.
        const iconKey = `icon_${id}`;
        if (this.textures.exists(iconKey)) {
          const icon = this.add.image(x - slotW / 2 + 18, y, iconKey).setDisplaySize(24, 24);
          this.container.add(icon);
        }
        const label = this.add.text(x + 6, y, ELEMENTS[id].name, {
          fontSize: '12px', fontStyle: 'bold', color: WHITE, fontFamily: FF,
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        this.container.add(label);
        slot.setInteractive({ useHandCursor: true });
        slot.on('pointerover', () => slot.setStrokeStyle(2.5, 0xffe8a0, 1));
        slot.on('pointerout',  () => slot.setStrokeStyle(2, 0xffd700, 0.95));
        slot.on('pointerdown', () => { this.forgeSlots.splice(i, 1); this.renderForge(); });
      } else {
        const label = this.add.text(x, y, 'empty', {
          fontSize: '12px', fontStyle: 'italic', color: DIM, fontFamily: FF,
        }).setOrigin(0.5);
        this.container.add(label);
      }
    }

    // Preview area — slightly taller, wood-inset look.
    const previewY = slotsY + slotH + 14;
    const CARD_AREA_H = 134;
    const PREVIEW_RECT_H = CARD_AREA_H + 44;
    const cardAreaCenterY = previewY + CARD_AREA_H / 2;

    this.container.add(
      this.add.rectangle(PANEL_CX, previewY + PREVIEW_RECT_H / 2, PANEL_W - 38, PREVIEW_RECT_H, 0x0a0400, 0.7)
        .setStrokeStyle(2, 0xd4a04a, 0.9),
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
        statusText = `Tier ${tier} needs Forge Lv ${FORGE_TIER_UNLOCK[tier as CardTier]}`;
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
      const headline = this.forgeSlots.length >= 1 ? '???' : 'Pick 1-3 elements';
      const subline = this.forgeSlots.length >= 1
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
    // Tutorial: 'forge-craft' completes when the player leaves the forge.
    // We don't require a successful craft — the player may not have enough
    // elements yet — just exposure to the screen.
    tutorialDirector.advanceIfMatches('forge-craft');
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
      return `Tier ${tier} needs Forge Lv ${FORGE_TIER_UNLOCK[tier as CardTier]} (currently ${forgeLevel}).`;
    case 'no_card':                return 'No card matches that combination.';
    case 'insufficient_elements':  return 'Not enough element units.';
    case 'insufficient_gold':      return 'Not enough gold.';
    case 'deck_full':              return 'Deck full (max 15 cards).';
    default:                       return '';
  }
}
