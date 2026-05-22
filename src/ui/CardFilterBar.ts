// CardFilterBar — reusable filter widget for card browsing UIs.
// Hosts an element dropdown, three tier checkboxes, and a search text input.
// The search input is implemented as a real HTML <input> appended to
// document.body and synced to the canvas position each frame; this keeps a
// native caret + IME working and dodges the Phaser DOM container's pointer
// hit-testing quirks.
//
// API is shaped for parallel agents (DeckBuilder/Collection/Library) to drop
// the same bar in without coupling — the pure `applyFilters` function is
// exported separately so callers can also re-run filtering on a deck slice.

import Phaser from 'phaser';
import type { CardDefinition, ElementId } from '../data/types';
import { FONTS } from './StyleConstants';
// Pure helpers re-exported from this module for ergonomic consumer imports
// (`import { applyFilters, CardFilterBar } from '../ui/CardFilterBar'`).
// Tests should import directly from the pure module to avoid pulling Phaser
// into a node-environment vitest run.
export {
  applyFilters,
  FILTER_ELEMENT_OPTIONS,
  ELEMENT_LABEL_TO_ID,
  type CardFilters,
} from './CardFilterBar.pure';
import { ELEMENT_LABEL_TO_ID, FILTER_ELEMENT_OPTIONS, type CardFilters } from './CardFilterBar.pure';

// ── Visual constants ───────────────────────────────────────
const BAR_HEIGHT = 44;
const PADDING_X  = 12;
const FF = FONTS.family;

// Colors (kept inline rather than via StyleConstants because the bar lives
// over many backdrops and needs a consistent dark theme).
const BG_FILL   = 0x1a1a2e;
const BG_STROKE = 0x9a6030;
const TEXT      = '#ffffff';
const ACCENT    = '#ffd700';

// Silence unused-warning for ElementId — re-exported via the pure module.
type _Unused = ElementId | CardDefinition;

export class CardFilterBar extends Phaser.GameObjects.Container {
  private filters: CardFilters;
  private onChange: (filters: CardFilters) => void;
  private barWidth: number;

  // Sub-elements we need to mutate after construction.
  private dropdownLabel!: Phaser.GameObjects.Text;
  private tierLabels: Array<{ tier: 1 | 2 | 3; box: Phaser.GameObjects.Rectangle; check: Phaser.GameObjects.Text }> = [];
  private dropdownPanel: Phaser.GameObjects.Container | null = null;
  private inputEl: HTMLInputElement | null = null;

  // Bound listeners we have to remove on destroy to avoid leaks.
  private resizeListener: (() => void) | null = null;
  private inputListener: ((e: Event) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    onChange: (filters: CardFilters) => void,
  ) {
    super(scene, x, y);
    scene.add.existing(this);

    this.barWidth = width;
    this.onChange = onChange;
    this.filters = {
      element: 'All',
      tiers: new Set<1 | 2 | 3>([1, 2, 3]),
      search: '',
    };

    this.buildBackground();
    this.buildDropdown();
    this.buildTierCheckboxes();
    this.buildSearchInput();

    // Clean up DOM input and dropdown panel when the parent scene shuts down.
    scene.events.once('shutdown', this.handleSceneShutdown, this);
    scene.events.once('destroy', this.handleSceneShutdown, this);
  }

  // ── Public API ─────────────────────────────────────────

  getFilters(): CardFilters {
    // Return a defensive copy so external code can't accidentally mutate
    // our Set and bypass change notification.
    return {
      element: this.filters.element,
      tiers: new Set(this.filters.tiers),
      search: this.filters.search,
    };
  }

  destroy(fromScene?: boolean): void {
    this.teardownDomInput();
    this.teardownDropdownPanel();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    if (this.scene) {
      this.scene.events.off('shutdown', this.handleSceneShutdown, this);
      this.scene.events.off('destroy', this.handleSceneShutdown, this);
    }
    super.destroy(fromScene);
  }

  // ── Internal builders ──────────────────────────────────

  private buildBackground(): void {
    const bg = this.scene.add.rectangle(0, 0, this.barWidth, BAR_HEIGHT, BG_FILL, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, BG_STROKE);
    this.add(bg);
  }

  private buildDropdown(): void {
    // Layout: leftmost 160px is the dropdown.
    const dropX = PADDING_X;
    const dropY = (BAR_HEIGHT - 28) / 2;
    const dropW = 150;
    const dropH = 28;

    const box = this.scene.add.rectangle(dropX, dropY, dropW, dropH, 0x2a1408, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, 0x7a4820)
      .setInteractive({ useHandCursor: true });
    this.add(box);

    const label = this.scene.add.text(
      dropX + 8,
      dropY + dropH / 2,
      `Element: ${this.filters.element}`,
      { fontSize: '12px', fontStyle: 'bold', color: TEXT, fontFamily: FF },
    ).setOrigin(0, 0.5);
    this.add(label);
    this.dropdownLabel = label;

    const caret = this.scene.add.text(dropX + dropW - 12, dropY + dropH / 2, '▾', {
      fontSize: '12px', color: ACCENT, fontFamily: FF,
    }).setOrigin(0.5);
    this.add(caret);

    box.on('pointerover', () => box.setStrokeStyle(2, 0xffd700));
    box.on('pointerout',  () => box.setStrokeStyle(1.5, 0x7a4820));
    box.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev?: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      this.toggleDropdownPanel();
    });
  }

  private buildTierCheckboxes(): void {
    // Tier checkboxes laid out to the right of the dropdown.
    const baseX = PADDING_X + 150 + 16;
    const baseY = (BAR_HEIGHT - 18) / 2;
    const cellW = 56;

    [1, 2, 3].forEach((tier, i) => {
      const t = tier as 1 | 2 | 3;
      const cx = baseX + i * cellW;
      const box = this.scene.add.rectangle(cx, baseY, 18, 18, 0x2a1408, 0.95)
        .setOrigin(0, 0)
        .setStrokeStyle(1.5, 0x7a4820)
        .setInteractive({ useHandCursor: true });
      const check = this.scene.add.text(cx + 9, baseY + 9, '✓', {
        fontSize: '14px', fontStyle: 'bold', color: ACCENT, fontFamily: FF,
      }).setOrigin(0.5);
      const label = this.scene.add.text(cx + 24, baseY + 9, `T${tier}`, {
        fontSize: '12px', fontStyle: 'bold', color: TEXT, fontFamily: FF,
      }).setOrigin(0, 0.5);

      this.add(box); this.add(check); this.add(label);
      this.tierLabels.push({ tier: t, box, check });

      box.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev?: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        if (this.filters.tiers.has(t)) {
          this.filters.tiers.delete(t);
        } else {
          this.filters.tiers.add(t);
        }
        this.refreshTierVisuals();
        this.emitChange();
      });
    });
  }

  private refreshTierVisuals(): void {
    for (const entry of this.tierLabels) {
      entry.check.setVisible(this.filters.tiers.has(entry.tier));
    }
  }

  private buildSearchInput(): void {
    // Native <input>, absolutely positioned over the canvas. The Phaser DOM
    // element API (`scene.add.dom`) works in this codebase (see TavernPanelScene)
    // but loses focus when it bubbles up to a scrolling parent. A bare-metal
    // input gives us the most reliable keyboard behavior across browsers.
    const canvas = this.scene.game.canvas;
    if (!canvas) return;

    const el = document.createElement('input');
    el.type = 'text';
    el.placeholder = 'Search…';
    el.setAttribute('data-card-filter-bar', '1');
    el.style.position = 'absolute';
    el.style.background = '#2a1408';
    el.style.color = TEXT;
    el.style.border = '1.5px solid #7a4820';
    el.style.borderRadius = '3px';
    el.style.padding = '0 8px';
    el.style.fontSize = '12px';
    el.style.fontFamily = FF;
    el.style.outline = 'none';
    el.style.zIndex = '1000';
    el.style.boxSizing = 'border-box';

    document.body.appendChild(el);
    this.inputEl = el;

    this.inputListener = () => {
      this.filters.search = (el.value || '').toLowerCase();
      this.emitChange();
    };
    el.addEventListener('input', this.inputListener);

    this.resizeListener = () => this.syncInputPosition();
    window.addEventListener('resize', this.resizeListener);

    // Sync once now, and again next frame in case the canvas was just laid out.
    this.syncInputPosition();
    this.scene.time.delayedCall(0, () => this.syncInputPosition());
  }

  private syncInputPosition(): void {
    if (!this.inputEl) return;
    const canvas = this.scene.game.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Local coords of the search input region inside this container.
    const searchLocalX = this.barWidth - PADDING_X - 200;
    const searchLocalY = (BAR_HEIGHT - 26) / 2;
    const searchW = 200;
    const searchH = 26;
    // Scale canvas-internal coords to client pixels (Phaser may letterbox).
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    const left = rect.left + (this.x + searchLocalX) * sx;
    const top  = rect.top  + (this.y + searchLocalY) * sy;
    this.inputEl.style.left   = `${left}px`;
    this.inputEl.style.top    = `${top}px`;
    this.inputEl.style.width  = `${searchW * sx}px`;
    this.inputEl.style.height = `${searchH * sy}px`;
  }

  // ── Dropdown panel ─────────────────────────────────────

  private toggleDropdownPanel(): void {
    if (this.dropdownPanel) {
      this.teardownDropdownPanel();
      return;
    }
    const panel = this.scene.add.container(this.x + PADDING_X, this.y + BAR_HEIGHT + 2);
    panel.setDepth(this.depth + 10);

    const optionH = 22;
    const panelW = 150;
    const panelH = FILTER_ELEMENT_OPTIONS.length * optionH + 4;
    const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x0a0400, 0.97)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, 0x9a6030);
    panel.add(bg);

    FILTER_ELEMENT_OPTIONS.forEach((opt, i) => {
      const y = 2 + i * optionH;
      const row = this.scene.add.rectangle(0, y, panelW, optionH, 0x1a1a2e, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const txt = this.scene.add.text(8, y + optionH / 2, opt, {
        fontSize: '12px',
        color: opt === this.filters.element ? ACCENT : TEXT,
        fontFamily: FF,
        fontStyle: opt === this.filters.element ? 'bold' : 'normal',
      }).setOrigin(0, 0.5);
      panel.add(row); panel.add(txt);

      row.on('pointerover', () => row.setFillStyle(0x3a2008, 0.9));
      row.on('pointerout',  () => row.setFillStyle(0x1a1a2e, 0));
      row.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev?: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation?.();
        this.filters.element = opt;
        this.dropdownLabel.setText(`Element: ${opt}`);
        this.teardownDropdownPanel();
        this.emitChange();
      });
    });

    this.dropdownPanel = panel;
  }

  private teardownDropdownPanel(): void {
    if (this.dropdownPanel) {
      this.dropdownPanel.destroy(true);
      this.dropdownPanel = null;
    }
  }

  // ── Lifecycle helpers ──────────────────────────────────

  private teardownDomInput(): void {
    if (this.inputEl) {
      if (this.inputListener) this.inputEl.removeEventListener('input', this.inputListener);
      if (this.inputEl.parentNode) this.inputEl.parentNode.removeChild(this.inputEl);
      this.inputEl = null;
      this.inputListener = null;
    }
  }

  private handleSceneShutdown(): void {
    // The scene is going away — clean up DOM artefacts immediately even if
    // destroy() hasn't been called explicitly.
    this.teardownDomInput();
    this.teardownDropdownPanel();
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
  }

  private emitChange(): void {
    try {
      this.onChange(this.getFilters());
    } catch (err) {
      console.error('[CardFilterBar] onChange callback threw:', err);
    }
  }
}

// Re-export pure ELEMENT_LABEL_TO_ID for the no-Phaser warning workaround;
// this line is a no-op consumer of the imports above.
void ELEMENT_LABEL_TO_ID;
void (null as unknown as _Unused);
