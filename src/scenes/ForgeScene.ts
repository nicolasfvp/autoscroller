// Forge overlay scene -- in-run card crafting from element units + gold.
// Slot-based: pick 2-4 element-unit tokens, see preview, click Forge.
// See docs/CARDS_SYSTEM.md §5.

import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { getRun } from '../state/RunState';
import { saveMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';
import { COLORS, FONTS, createButton } from '../ui/StyleConstants';
import {
  ELEMENTS,
  ALL_ELEMENT_IDS,
  type ElementId,
  canonicalCardId,
} from '../systems/ElementSystem';
import {
  findCardForElements,
  getForgeGoldCost,
  isTierUnlocked,
  validateForge,
  executeForge,
  discoverRecipe,
  type ForgeRecipe,
} from '../systems/ForgeSystem';
import type { ElementInventory } from '../systems/ShardSystem';

export class ForgeScene extends Scene {
  private slots: ElementId[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private elementButtons: Map<ElementId, Phaser.GameObjects.Container> = new Map();
  private previewText!: Phaser.GameObjects.Text;
  private previewName!: Phaser.GameObjects.Text;
  private previewCost!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private forgeBtn!: Phaser.GameObjects.Text;
  private goldLabel!: Phaser.GameObjects.Text;
  private forgeLevel: number = 0;
  private metaState: MetaState | null = null;

  constructor() {
    super(SCENE_KEYS.FORGE);
  }

  create(data?: { metaState?: MetaState }): void {
    this.metaState = data?.metaState ?? null;
    this.forgeLevel = this.metaState?.buildings?.forge?.level ?? 0;

    // Backdrop
    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);
    this.time.delayedCall(100, () => {
      backdrop.setInteractive();
      backdrop.on('pointerdown', () => this.closeScene());
    });

    // Title
    this.add.text(400, 30, 'Forge', {
      ...FONTS.title,
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.add.text(400, 60, `Forge Lv ${this.forgeLevel} — discount ${Math.round(getDiscountForLevel(this.forgeLevel) * 100)}%`, {
      ...FONTS.small,
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    // Element inventory panel (left)
    this.renderElementInventory(this.metaState);

    // Slot panel (center)
    this.renderSlots();

    // Preview & action (right)
    this.renderPreview();

    // Close button
    createButton(this, 750, 30, 'X', () => this.closeScene(), 'secondary');

    this.refreshPreview();
  }

  private renderElementInventory(_meta: any): void {
    void _meta;
    this.add.text(120, 100, 'Elements', { ...FONTS.heading, color: COLORS.textPrimary, fontFamily: FONTS.family }).setOrigin(0.5);
    const run = safeGetRun();
    const elements: ElementInventory = (run?.economy.elements ?? {}) as ElementInventory;
    const startY = 140;
    ALL_ELEMENT_IDS.forEach((id, i) => {
      const y = startY + i * 50;
      const elem = ELEMENTS[id];
      const color = parseInt(elem.color.replace('#', ''), 16);
      const card = this.add.rectangle(120, y, 200, 40, color, 0.4).setStrokeStyle(2, 0xffffff, 0.5);
      const name = this.add.text(40, y - 8, elem.name, { fontSize: '14px', color: '#ffffff', fontFamily: FONTS.family });
      const count = this.add.text(195, y - 8, `${elements[id] ?? 0}`, { fontSize: '16px', color: COLORS.accent, fontFamily: FONTS.family, fontStyle: 'bold' }).setOrigin(1, 0);
      const container = this.add.container(0, 0, [card, name, count]);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => card.setStrokeStyle(2, 0xffffff, 1.0));
      card.on('pointerout', () => card.setStrokeStyle(2, 0xffffff, 0.5));
      card.on('pointerdown', () => this.addToSlot(id));
      this.elementButtons.set(id, container);
    });
  }

  private renderSlots(): void {
    this.add.text(400, 100, 'Recipe Slots', { ...FONTS.heading, color: COLORS.textPrimary, fontFamily: FONTS.family }).setOrigin(0.5);
    const startY = 160;
    for (let i = 0; i < 4; i++) {
      const y = startY + i * 60;
      const rect = this.add.rectangle(400, y, 240, 50, 0x2a2a40, 0.7).setStrokeStyle(1, 0x4a4a60);
      void rect;
      const txt = this.add.text(400, y, '(empty)', {
        ...FONTS.body,
        color: COLORS.textSecondary,
        fontFamily: FONTS.family,
      }).setOrigin(0.5);
      this.slotTexts.push(txt);
    }
    createButton(this, 400, 430, 'Clear Slots', () => this.clearSlots(), 'secondary');
    this.goldLabel = this.add.text(400, 460, '', {
      ...FONTS.body,
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);
  }

  private renderPreview(): void {
    this.add.text(680, 100, 'Preview', { ...FONTS.heading, color: COLORS.textPrimary, fontFamily: FONTS.family }).setOrigin(0.5);
    this.previewName = this.add.text(680, 150, '???', {
      ...FONTS.heading,
      color: COLORS.accent,
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: 220 },
    }).setOrigin(0.5);
    this.previewText = this.add.text(680, 230, 'Select 2-4 elements.', {
      ...FONTS.body,
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: 220 },
    }).setOrigin(0.5);
    this.previewCost = this.add.text(680, 360, '', {
      ...FONTS.body,
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);
    this.statusText = this.add.text(680, 420, '', {
      ...FONTS.small,
      color: '#ff9999',
      fontFamily: FONTS.family,
      align: 'center',
      wordWrap: { width: 220 },
    }).setOrigin(0.5);
    this.forgeBtn = createButton(this, 680, 480, '⚒ Forge', () => this.tryForge(), 'primary');
  }

  private addToSlot(id: ElementId): void {
    if (this.slots.length >= 4) return;
    this.slots.push(id);
    this.updateSlotTexts();
    this.refreshPreview();
  }

  private clearSlots(): void {
    this.slots = [];
    this.updateSlotTexts();
    this.refreshPreview();
  }

  private updateSlotTexts(): void {
    for (let i = 0; i < 4; i++) {
      const id = this.slots[i];
      this.slotTexts[i].setText(id ? ELEMENTS[id].name : '(empty)');
      this.slotTexts[i].setColor(id ? COLORS.textPrimary : COLORS.textSecondary);
    }
  }

  private refreshPreview(): void {
    const run = safeGetRun();
    const gold = run?.economy.gold ?? 0;
    this.goldLabel.setText(`Gold: ${gold}`);

    if (this.slots.length < 2) {
      this.previewName.setText('???');
      this.previewText.setText('Select 2-4 elements.');
      this.previewCost.setText('');
      this.statusText.setText('');
      return;
    }

    const card = findCardForElements(this.slots);
    if (!card) {
      this.previewName.setText('???');
      this.previewText.setText('No matching card.');
      this.previewCost.setText('');
      this.statusText.setText(`id would be ${canonicalCardId(this.slots)}`);
      return;
    }

    this.previewName.setText(card.name);
    this.previewText.setText(card.description ?? '');
    const tier = (this.slots.length - 1) as 1 | 2 | 3;
    const cost = getForgeGoldCost(tier, this.forgeLevel);
    this.previewCost.setText(`Cost: ${cost} gold + elements`);

    if (!run) {
      this.statusText.setText('No active run.');
      return;
    }

    const deckSize = run.deck.active.length + run.deck.droppedCards.length;
    const validation = validateForge(
      this.slots,
      (run.economy.elements ?? {}) as ElementInventory,
      run.economy.gold,
      this.forgeLevel,
      deckSize,
      15,
    );
    if (!validation.ok) {
      const reason = validation.reason ?? 'invalid';
      this.statusText.setText(reasonText(reason, tier));
    } else if (!isTierUnlocked(tier, this.forgeLevel)) {
      this.statusText.setText(`Tier ${tier} locked. Need Forge Lv ${this.forgeLevel + 1}.`);
    } else {
      this.statusText.setText('Ready to forge.');
    }
  }

  private tryForge(): void {
    const run = safeGetRun();
    if (!run) return;
    const deckSize = run.deck.active.length + run.deck.droppedCards.length;
    const validation = validateForge(
      this.slots,
      (run.economy.elements ?? {}) as ElementInventory,
      run.economy.gold,
      this.forgeLevel,
      deckSize,
      15,
    );
    if (!validation.ok) return;

    const meta = this.metaState;
    const knownRecipes: ForgeRecipe[] = (meta as any)?.forgeRecipes ?? [];
    const result = executeForge(
      this.slots,
      (run.economy.elements ?? {}) as ElementInventory,
      (amt) => { run.economy.gold -= amt; },
      this.forgeLevel,
      knownRecipes,
    );
    run.deck.droppedCards.push(result.cardId);

    if (result.isNewRecipe && meta) {
      (meta as any).forgeRecipes = discoverRecipe(knownRecipes, this.slots, result.cardId);
      saveMetaState(meta).catch(() => { /* ignore */ });
    }

    this.clearSlots();
  }

  private closeScene(): void {
    this.scene.stop();
  }
}

function reasonText(reason: string, tier: number): string {
  switch (reason) {
    case 'tier_locked': return `Tier ${tier} locked.`;
    case 'no_card':     return 'No matching card.';
    case 'insufficient_elements': return 'Not enough element units.';
    case 'insufficient_gold': return 'Not enough gold.';
    case 'deck_full':   return 'Deck full (15 cards).';
    default: return '';
  }
}

function getDiscountForLevel(level: number): number {
  const table: Record<number, number> = { 0: 0, 1: 0, 2: 0.10, 3: 0.15, 4: 0.20, 5: 0.25, 6: 0.30 };
  return table[Math.max(0, Math.min(6, level))] ?? 0;
}

function safeGetRun(): ReturnType<typeof getRun> | null {
  try { return getRun(); } catch { return null; }
}
