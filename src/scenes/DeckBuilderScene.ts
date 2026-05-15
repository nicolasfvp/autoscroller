// Deck builder overlay -- pre-run starter deck selection with element ratio + presets.
// See docs/CARDS_SYSTEM.md §6.

import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { COLORS, FONTS, createButton } from '../ui/StyleConstants';
import { getAllCards } from '../data/DataLoader';
import {
  validateStarterDeck,
  type DeckPreset,
} from '../systems/DeckBuilder';
import {
  STARTER_DECK_SIZE,
  CLASS_DECK_RATIO,
  PRESETS_PER_CLASS,
} from '../systems/ElementSystem';
import { saveMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';

export class DeckBuilderScene extends Scene {
  private className: string = 'warrior';
  private currentDeck: string[] = [];
  private selectedPresetIndex: number = 0;
  private onConfirm: ((deck: string[]) => void) | null = null;
  private deckText!: Phaser.GameObjects.Text;
  private validationText!: Phaser.GameObjects.Text;
  private presetButtons: Phaser.GameObjects.Text[] = [];
  private listGroup!: Phaser.GameObjects.Group;
  private metaState: MetaState | null = null;

  constructor() {
    super(SCENE_KEYS.DECK_BUILDER);
  }

  create(data: { className: string; presets?: DeckPreset[]; metaState?: MetaState; onConfirm?: (deck: string[]) => void }): void {
    this.className = data.className ?? 'warrior';
    this.onConfirm = data.onConfirm ?? null;
    this.metaState = data.metaState ?? null;

    const presets: DeckPreset[] = (this.metaState as any)?.deckPresets?.[this.className] ?? data.presets ?? [];
    this.selectedPresetIndex = 0;
    this.currentDeck = presets[0]?.cardIds ? [...presets[0].cardIds] : [];

    const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.9);
    this.time.delayedCall(100, () => {
      backdrop.setInteractive();
      backdrop.on('pointerdown', () => {});
    });

    this.add.text(400, 30, `Deck Builder — ${this.className}`, {
      ...FONTS.title, color: COLORS.accent, fontFamily: FONTS.family,
    }).setOrigin(0.5);

    const ratio = CLASS_DECK_RATIO[this.className];
    this.add.text(400, 65, `${STARTER_DECK_SIZE} cards · 10 elements total · ratio P[${ratio.physicalMin}-${ratio.physicalMax}] / E[${ratio.elementalMin}-${ratio.elementalMax}]`, {
      ...FONTS.small, color: COLORS.textSecondary, fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.renderPresets(presets);
    this.renderDeck();
    this.renderCardList();
    this.renderActions();
    this.refresh();
  }

  private renderPresets(presets: DeckPreset[]): void {
    this.add.text(120, 100, 'Presets', { ...FONTS.heading, color: COLORS.textPrimary, fontFamily: FONTS.family }).setOrigin(0.5);
    for (let i = 0; i < PRESETS_PER_CLASS; i++) {
      const y = 140 + i * 40;
      const p = presets[i];
      const label = p?.name ?? `Empty ${i + 1}`;
      const btn = this.add.text(120, y, label, {
        fontSize: '16px',
        color: i === this.selectedPresetIndex ? COLORS.accent : COLORS.textSecondary,
        fontFamily: FONTS.family,
        backgroundColor: '#222',
        padding: { x: 6, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.selectedPresetIndex = i;
        this.currentDeck = p?.cardIds ? [...p.cardIds] : [];
        this.refresh();
      });
      this.presetButtons.push(btn);
    }
  }

  private renderDeck(): void {
    this.add.text(400, 100, 'Current Deck', { ...FONTS.heading, color: COLORS.textPrimary, fontFamily: FONTS.family }).setOrigin(0.5);
    this.deckText = this.add.text(400, 230, '', {
      ...FONTS.body, color: COLORS.textPrimary, fontFamily: FONTS.family,
      align: 'center', wordWrap: { width: 280 },
    }).setOrigin(0.5);
    this.validationText = this.add.text(400, 380, '', {
      ...FONTS.small, color: '#ff9999', fontFamily: FONTS.family,
      align: 'center', wordWrap: { width: 280 },
    }).setOrigin(0.5);
  }

  private renderCardList(): void {
    this.listGroup = this.add.group();
    this.add.text(680, 100, 'Tier 1 Cards', { ...FONTS.heading, color: COLORS.textPrimary, fontFamily: FONTS.family }).setOrigin(0.5);

    const all = getAllCards().filter((c: any) => c.tier === 1);
    const startY = 130;
    const lineHeight = 14;
    all.slice(0, 28).forEach((c: any, i: number) => {
      const y = startY + i * lineHeight;
      const t = this.add.text(680, y, c.name, {
        fontSize: '11px',
        color: COLORS.textSecondary,
        fontFamily: FONTS.family,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        if (this.currentDeck.length < STARTER_DECK_SIZE) {
          this.currentDeck.push(c.id);
          this.refresh();
        }
      });
      t.on('pointerover', () => t.setColor(COLORS.accent));
      t.on('pointerout', () => t.setColor(COLORS.textSecondary));
      this.listGroup.add(t);
    });
  }

  private renderActions(): void {
    createButton(this, 200, 480, 'Save Preset', () => this.savePreset(), 'secondary');
    createButton(this, 400, 480, 'Clear', () => { this.currentDeck = []; this.refresh(); }, 'secondary');
    createButton(this, 600, 480, 'Start Run', () => this.confirmDeck(), 'primary');
  }

  private refresh(): void {
    this.presetButtons.forEach((b, i) => {
      b.setColor(i === this.selectedPresetIndex ? COLORS.accent : COLORS.textSecondary);
    });
    const lines = this.currentDeck.map((id, idx) => {
      const card = getAllCards().find((c) => c.id === id) as any;
      return `${idx + 1}. ${card?.name ?? id}`;
    });
    this.deckText.setText(lines.length > 0 ? lines.join('\n') : '(empty — pick 5 cards)');
    const v = validateStarterDeck(this.currentDeck, this.className);
    this.validationText.setText(v.valid ? `OK · ${v.physical}P / ${v.elemental}E` : v.errors.join('\n'));
    this.validationText.setColor(v.valid ? '#99ff99' : '#ff9999');
  }

  private savePreset(): void {
    const meta = this.metaState;
    if (!meta) return;
    if (!(meta as any).deckPresets) (meta as any).deckPresets = {};
    if (!(meta as any).deckPresets[this.className]) (meta as any).deckPresets[this.className] = [];
    const slot = this.selectedPresetIndex;
    while ((meta as any).deckPresets[this.className].length <= slot) {
      (meta as any).deckPresets[this.className].push({ name: `Preset ${(meta as any).deckPresets[this.className].length + 1}`, cardIds: [] });
    }
    (meta as any).deckPresets[this.className][slot] = {
      name: (meta as any).deckPresets[this.className][slot]?.name ?? `Preset ${slot + 1}`,
      cardIds: [...this.currentDeck],
    };
    saveMetaState(meta).catch(() => { /* ignore */ });
  }

  private confirmDeck(): void {
    const v = validateStarterDeck(this.currentDeck, this.className);
    if (!v.valid) return;
    if (this.onConfirm) this.onConfirm([...this.currentDeck]);
    this.scene.stop();
  }
}

