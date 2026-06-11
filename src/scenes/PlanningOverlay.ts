import { Scene } from 'phaser';
import { LoopRunner, type LoopRunState, TILE_SIZE } from '../systems/LoopRunner';
import { getAllPlaceableTiles, getTileConfig, type TileSlot, type TileSlotType } from '../systems/TileRegistry';
import { TileVisual, PlanningTileVisual, LANDMARK_MAP } from '../ui/TileVisual';
import { getRun } from '../state/RunState';
import { SCENE_KEYS } from '../state/SceneKeys';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { t } from '../i18n/i18n';
import { localizedImageButton } from '../ui/LocalizedButton';

/**
 * PlanningOverlay -- planning phase UI with miniature loop grid and tile inventory panel.
 * Launched on top of paused GameScene. Delegates tile placement to LoopRunner.
 */
export class PlanningOverlay extends Scene {
  private loopRunner!: LoopRunner;
  private loopRunState!: LoopRunState;
  private selectedTileKey: string | null = null;
  private tileVisuals: TileVisual[] = [];
  private inventoryCards: Phaser.GameObjects.Container[] = [];
  /** Wave 5: separate cards for the subtile-only second row. */
  private subtileInventoryCards: Phaser.GameObjects.Container[] = [];
  private selectedCardIndex: number = -1;
  /** Wave 5: when true, slot clicks remove placed tiles instead of placing. */
  private removeMode: boolean = false;
  private scrollOffset: number = 0;
  private gridContainer!: Phaser.GameObjects.Container;
  private gridGeometry!: { cellW: number; period: number; centerX: number };
  private gridMask: Phaser.GameObjects.Graphics | null = null;
  /** Reserved-slot decoration overlays, parallel to tileVisuals. Recreated by buildLoopGrid. */
  private reservedDecorations: Phaser.GameObjects.GameObject[] = [];
  /** Pending tooltip show; cancelled on pointerout. */
  private tooltipTimer?: Phaser.Time.TimerEvent;
  /** The currently displayed tooltip container (text + bg). Destroyed on hide. */
  private tooltipObj?: Phaser.GameObjects.Container;
  private bgImg1?: Phaser.GameObjects.Image;
  private bgImg2?: Phaser.GameObjects.Image;
  private bgDisplayW = 0;

  // Inventory drag-and-drop state
  private dragGhost: Phaser.GameObjects.Container | null = null;
  private draggingTileKey: string | null = null;
  private onDragMove?: (pointer: Phaser.Input.Pointer) => void;
  private onDragUp?: (pointer: Phaser.Input.Pointer) => void;

  // Drag-scroll input handlers — stored so cleanup() can remove them. The
  // overlay's `scene.events` listeners use `this` as the context, but the
  // global input listeners need the original references to off() correctly.
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerUp?: () => void;
  private onWheel?: (
    pointer: Phaser.Input.Pointer,
    objects: Phaser.GameObjects.GameObject[],
    dx: number,
    dy: number,
  ) => void;

  constructor() {
    super(SCENE_KEYS.PLANNING);
  }

  create(data: { loopRunner: LoopRunner; loopRunState: LoopRunState }): void {
    this.scene.bringToTop();
    this.loopRunner = data.loopRunner;
    this.loopRunState = data.loopRunState;
    this.selectedTileKey = null;
    this.selectedCardIndex = -1;
    this.scrollOffset = 0;
    this.tileVisuals = [];
    this.inventoryCards = [];

    const fontFamily = 'VT323';

    // Background - two full-res images scroll horizontally in a seamless loop.
    // The 2560×1440 source is scaled so height=600; display width ≈ 1067px.
    if (this.textures.exists('bg_tile_selection')) {
      const src = this.textures.get('bg_tile_selection').source[0];
      const scale = 600 / src.height;
      this.bgDisplayW = Math.ceil(src.width * scale);
      this.bgImg1 = this.add.image(this.bgDisplayW / 2, 300, 'bg_tile_selection').setScale(scale);
      this.bgImg2 = this.add.image(this.bgDisplayW * 1.5, 300, 'bg_tile_selection').setScale(scale);
    } else {
      this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    }

    // Loop layout strip at y=240
    this.gridContainer = this.add.container(0, 0);
    this.buildLoopGrid();

    // Belt window pillars — animated spritesheet (4 frames, 512×512 each).
    if (this.textures.exists('belt_pillar')) {
      if (!this.anims.exists('pillar_flame')) {
        this.anims.create({
          key: 'pillar_flame',
          frames: this.anims.generateFrameNumbers('belt_pillar', { start: 0, end: 3 }),
          frameRate: 8,
          repeat: -1,
        });
      }
      // Frame is 512×512 but pillar content is tall and narrow.
      // Scale so display height = 117px (original pilar.png ratio 96:281).
      const FRAME_SIZE = 512;
      const TARGET_H = 155;
      const scale = TARGET_H / FRAME_SIZE;
      const makeP = (x: number) =>
        this.add.sprite(x, 180, 'belt_pillar')
          .setScale(scale)
          .setDepth(10)
          .play('pillar_flame');
      makeP(130);
      makeP(670);
    }

    // Tile inventory panel at y=300
    this.buildInventoryPanel(fontFamily);

    // Left-side info panels
    this.buildEconomyPanel(fontFamily);
    this.buildCharacterPanel(fontFamily);

    // All 4 action icons in one extended box — top-left, away from the edge
    // Layout: [Deck] [Relic] [Shop] [Forge] with 58px spacing, box starts at x=20
    const ICON_SIZE = 37;
    const ICON_Y = 55;
    const LABEL_Y = 79;
    const serifFont = 'VT323';
    const [dX, rX, sX, fX] = [56, 107, 159, 210];

    if (this.textures.exists('deck_relic_table')) {
      this.add.image(133, 58, 'deck_relic_table').setDisplaySize(247, 84);
    }

    const deckIcon = this.add.image(dX, ICON_Y, 'deck_icon').setDisplaySize(ICON_SIZE, ICON_SIZE).setInteractive({ useHandCursor: true });
    this.add.text(dX, LABEL_Y, t('planning.deck'), { fontSize: '10px', color: '#ffffff', fontFamily: serifFont }).setOrigin(0.5);
    deckIcon.on('pointerover', () => deckIcon.setTint(0xffdd88));
    deckIcon.on('pointerout',  () => deckIcon.clearTint());
    deckIcon.on('pointerdown', () => {
      this.scene.sleep();
      this.scene.launch(SCENE_KEYS.DECK_CUSTOMIZATION, { parentScene: SCENE_KEYS.PLANNING });
    });

    const relicIcon = this.add.image(rX, ICON_Y, 'relic_icon').setDisplaySize(ICON_SIZE, ICON_SIZE).setInteractive({ useHandCursor: true });
    this.add.text(rX, LABEL_Y, t('planning.relic'), { fontSize: '10px', color: '#ffffff', fontFamily: serifFont }).setOrigin(0.5);
    relicIcon.on('pointerover', () => relicIcon.setTint(0xffdd88));
    relicIcon.on('pointerout',  () => relicIcon.clearTint());
    relicIcon.on('pointerdown', () => {
      this.scene.sleep();
      this.scene.launch(SCENE_KEYS.RELIC_VIEWER, { parentScene: SCENE_KEYS.PLANNING });
    });

    const shopIcon = this.add.image(sX, ICON_Y, 'shop_icon').setDisplaySize(ICON_SIZE, ICON_SIZE).setInteractive({ useHandCursor: true });
    this.add.text(sX, LABEL_Y, t('planning.shop'), { fontSize: '10px', color: '#ffffff', fontFamily: serifFont }).setOrigin(0.5);
    shopIcon.on('pointerover', () => shopIcon.setTint(0xffdd88));
    shopIcon.on('pointerout',  () => shopIcon.clearTint());
    shopIcon.on('pointerdown', () => this.openSubScene(SCENE_KEYS.SHOP));

    const forgeIcon = this.add.image(fX, ICON_Y, 'forge_icon').setDisplaySize(ICON_SIZE, ICON_SIZE).setInteractive({ useHandCursor: true });
    this.add.text(fX, LABEL_Y, t('planning.forge'), { fontSize: '10px', color: '#ffffff', fontFamily: serifFont }).setOrigin(0.5);
    forgeIcon.on('pointerover', () => forgeIcon.setTint(0xffdd88));
    forgeIcon.on('pointerout',  () => forgeIcon.clearTint());
    forgeIcon.on('pointerdown', () => this.openSubScene(SCENE_KEYS.FORGE));

    // "Don't stop here for: 1 / 5 / 10 / 25" — auto-skips the next N planning
    // phases. Boss-loop planning (1 loop before the boss tile spawns) always
    // stops regardless of the chosen value; the skip counter is consumed by
    // GameScene's loop-completed handler.
    this.buildSkipLoopsRow(fontFamily);

    // Bottom center: Start Loop button (English baked art; pt-BR text variant).
    const startLoop = () => {
      // Tutorial: 'boss-preview' is the last planning-phase step — Start
      // Loop completes it and hands control to GameScene for the wrap-up.
      tutorialDirector.advanceIfMatches('boss-preview');
      // Sync spent TP/gold back to RunState before resuming GameScene, so
      // the resume handler doesn't refund the just-spent points by copying
      // a stale RunState.economy back into loopRunState.
      const run = getRun();
      run.economy.gold = this.loopRunState.economy.gold;
      run.economy.tilePoints = this.loopRunState.economy.tilePoints;
      this.loopRunner.confirmPlanning();
      this.tweens.add({
        targets: this.cameras.main,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.scene.stop();
          this.scene.wake(SCENE_KEYS.GAME);
        },
      });
    };

    localizedImageButton(this, 405, 548, 'btn_start_loop_scene', t('btn.startLoop'), 220, startLoop);

    this.buildShopForgeButtons(fontFamily);

    // Wave 5: Remove Mode toggle. Lives next to Start Loop on its own row
    // so it's discoverable without crowding the existing button line.
    this.buildRemoveModeButton(fontFamily);

    // Enable drag scroll for long loops
    this.setupDragScroll();

    this.events.on('shutdown', this.cleanup, this);

    // Re-sync economy + inventory from RunState when we wake (e.g. after the
    // Shop/Forge sub-scene closes). Without this, gold spent in the shop is
    // refunded next time Start Loop syncs LoopRunState → RunState.
    this.events.on('wake', () => this.syncFromRunStateOnWake());

    // Tutorial top-up: the first planning phase only awards a few TP. After
    // the player spends 3 TP on a combat tile, they don't have enough for
    // the 2 TP subtile the next step asks them to place. Grant a one-time
    // bump + one free ambush subtile so the scripted run can complete.
    // Guarded by a flag on the run so it only fires once.
    if (tutorialDirector.isActive() && tutorialDirector.getCurrentStep()?.id !== 'complete') {
      const run = getRun();
      const flag = (run as { _tutorialPlanningBootstrapped?: boolean });
      if (!flag._tutorialPlanningBootstrapped) {
        flag._tutorialPlanningBootstrapped = true;
        // Enough for one combat tile (3 TP) + one subtile (2 TP) with margin.
        this.loopRunState.economy.tilePoints = Math.max(this.loopRunState.economy.tilePoints, 6);
        // Scripted shop→forge budget: 1 common relic (90g) + 2 elements
        // (2×50g) + the tier-2 forge cost (50g) = 240g. Grant 250 so the flow
        // can't dead-end on gold and the player ends with a small cushion.
        // The Shop/Forge read run.economy.gold, which openSubScene syncs from
        // this loopRunState value before launching.
        this.loopRunState.economy.gold = Math.max(this.loopRunState.economy.gold, 250);
        run.economy.gold = this.loopRunState.economy.gold;
        // Stake a free subtile in inventory so 'place-subtile' is reachable
        // even if TP runs low on edge-case difficulty changes.
        const inv = this.loopRunState.tileInventory;
        if (!inv.some(t => t.tileType === 'subtile_ambush')) {
          inv.push({ tileType: 'subtile_ambush', count: 1 });
        }
        run.economy.tilePoints = this.loopRunState.economy.tilePoints;
        run.economy.tileInventory = {
          ...(run.economy.tileInventory ?? {}),
          subtile_ambush: ((run.economy.tileInventory ?? {}).subtile_ambush ?? 0) + 1,
        };
        // Inventory panel was already drawn with stale values during create();
        // refresh it now so the new TP balance + free subtile show up.
        this.refreshInventory();
      }
    }

    // Scripted tutorial overlay — covers planning-intro, place-tile,
    // forge-intro, boss-preview steps. The overlay subscribes to director
    // changes itself, so we don't re-mount on wake (that would stack a
    // duplicate container on every Forge round-trip).
    const overlay = TutorialOverlay.mountIfActive(this);
    if (overlay) {
      // place-tile: spotlight the path strip + main tile inventory so the
      // player can pick a combat tile and drop it on the path. Panel uses
      // 'top-fixed' so it sits at y=12 and doesn't cover the inventory.
      overlay.setStepRect('place-tile', {
        x: 20, y: 150, width: 760, height: 330,
      });
      // place-subtile: spotlight the path (so the player sees the cyan
      // reserved slots that just spawned) plus the dedicated subtile row.
      overlay.setStepRect('place-subtile', {
        x: 20, y: 150, width: 760, height: 330,
      });
      // shop-intro: spotlight the Shop button (3rd in the Deck/Relic/Shop/Forge
      // icon row at x≈159) — the player buys the relic + elements there before
      // the forge step.
      overlay.setStepRect('shop-intro', {
        x: 141, y: 38, width: 36, height: 56,
      });
      // forge-intro: spotlight the Forge button — now in the top-left
      // 4-icon row (Deck/Relic/Shop/Forge), not the bottom edge.
      overlay.setStepRect('forge-intro', {
        x: 192, y: 38, width: 36, height: 56,
      });
      // boss-preview: spotlight the Start Loop image button at the bottom.
      overlay.setStepRect('boss-preview', {
        x: 320, y: 520, width: 180, height: 55,
      });
    }
  }

  private syncFromRunStateOnWake(): void {
    const run = getRun();
    this.loopRunState.economy.gold = run.economy.gold;
    this.loopRunState.economy.tilePoints = run.economy.tilePoints;
    // tileInventory shape: RunState stores Record<string,count>; LoopRunState
    // stores Array<{tileType,count}>. Re-derive the array view so the
    // inventory panel reflects anything purchased in the shop.
    this.loopRunState.tileInventory = Object.entries(run.economy.tileInventory ?? {})
      .filter(([, count]) => count > 0)
      .map(([tileType, count]) => ({ tileType, count }));
    this.refreshInventory();
  }

  private buildLoopGrid(): void {
    const tiles = this.loopRunState.loop.tiles;
    const scale = 0.49;
    const tileSize = Math.round(TILE_SIZE * scale);
    const gap = 6;
    const cellW = tileSize + gap;
    // Show every slot — buffers included — so the displayed loop matches
    // the actual loop length the hero will traverse. Buffers stay
    // non-clickable; they're just no longer invisible.
    const period = tiles.length * cellW;
    const centerX = 400;
    const y = 205;

    this.gridGeometry = { cellW, period, centerX };

    // Clear existing
    for (const tv of this.tileVisuals) {
      tv.destroy();
    }
    this.tileVisuals = [];
    for (const deco of this.reservedDecorations) deco.destroy();
    this.reservedDecorations = [];
    this.gridContainer.removeAll(true);

    for (let i = 0; i < tiles.length; i++) {
      const slot = tiles[i];
      // Initial position; updateTilePositions() handles the wrap math.
      const tv = new PlanningTileVisual(this, 0, y, slot, scale, i, true);
      tv.setData('beltSlot', i);
      this.gridContainer.add(tv);
      this.tileVisuals.push(tv);

      // Buffer tiles are part of the path but not editable and not shown —
      // they still occupy a slot so the displayed loop length matches the
      // hero's traversal, but they render invisibly.
      if (slot.type === 'buffer') {
        tv.setVisible(false);
        continue;
      }

      // Wave 5: reserved (empty) slot decoration. The slot already renders
      // a sparse "extension of host terrain" sprite (tile_reserved_<terrain>),
      // so the only added hint here is a faint cyan border so the player can
      // still spot reservation targets at a glance.
      if (slot.type === 'basic' && slot.reserved) {
        const glow = this.add.rectangle(0, y, tileSize + 4, tileSize + 4, 0x00ffcc, 0.18)
          .setStrokeStyle(1, 0x00ffcc, 0.7);
        glow.setData('beltSlot', i);
        this.gridContainer.add(glow);
        this.gridContainer.sendToBack(glow);
        this.reservedDecorations.push(glow);

        tv.onClick(() => this.onSlotClicked(i));
        continue;
      }

      // Empty (non-reserved) basic slots: clickable for normal-tile placement.
      if (slot.type === 'basic') {
        tv.setAlpha(0.6);
        tv.onClick(() => this.onSlotClicked(i));
        continue;
      }

      // Wave 5: placed (non-basic, non-buffer, non-boss) tiles are clickable
      // so Remove Mode can target them. Boss tiles stay locked.
      if (slot.type !== 'boss') {
        tv.onClick(() => this.onSlotClicked(i));
      }
    }

    // Clip belt to a horizontal window so tiles fade at the edges rather
    // than wrapping at the full canvas boundary. The wrap math still runs
    // at the original leftBound/rightBound; the mask just hides it.
    if (this.gridMask) { this.gridMask.destroy(); this.gridMask = null; }
    this.gridMask = this.make.graphics();
    this.gridMask.fillStyle(0xffffff);
    this.gridMask.fillRect(130, y - tileSize - 24, 540, tileSize + 60);
    this.gridContainer.setMask(this.gridMask.createGeometryMask());

    this.updateTilePositions();
  }

  /**
   * Reposition every belt tile so the strip behaves as an infinite loop:
   * tile 0 follows the last tile and vice versa. The belt spans `period`
   * pixels; each tile at slot k naturally sits at `centerX - period/2 +
   * cellW/2 + k * cellW`. Adding scrollOffset and wrapping into the
   * visible window range keeps a copy of the strip on screen no matter
   * how far the user drags.
   */
  private updateTilePositions(): void {
    if (!this.gridGeometry) return;
    const { cellW, period, centerX } = this.gridGeometry;
    if (period <= 0) return;

    // Wrap window: anything outside [-cellW, 800 + cellW] gets shifted by
    // ±period until it lands inside. `cellW` of slack on either side keeps
    // tiles entering/leaving from being clipped before they reach the edge.
    const leftBound = -cellW;
    const rightBound = 800 + cellW;
    const baseLeft = centerX - period / 2 + cellW / 2;

    const placeAt = (obj: Phaser.GameObjects.GameObject & { x: number }, slot: number) => {
      let x = baseLeft + slot * cellW + this.scrollOffset;
      x = ((x - leftBound) % period + period) % period + leftBound;
      if (x > rightBound) x -= period;
      obj.x = x;
    };

    // Fade tiles near the pillar edges (x=50 left, x=750 right).
    const PILLAR_L = 130;
    const PILLAR_R = 670;
    const FADE_ZONE = 140; // pixels over which alpha goes 0→1
    const pillarAlpha = (x: number): number => {
      const fromLeft  = (x - PILLAR_L) / FADE_ZONE;
      const fromRight = (PILLAR_R - x) / FADE_ZONE;
      return Math.min(1, Math.max(0, Math.min(fromLeft, fromRight)));
    };

    for (const tv of this.tileVisuals) {
      placeAt(tv, tv.getData('beltSlot') as number);
      tv.setAlpha(pillarAlpha(tv.x));
    }
    // Wave 5: keep reserved-slot decorations aligned with their host tile.
    for (const deco of this.reservedDecorations) {
      const slot = deco.getData('beltSlot') as number;
      placeAt(deco as Phaser.GameObjects.GameObject & { x: number }, slot);
      (deco as Phaser.GameObjects.GameObject & { setAlpha: (a: number) => void })
        .setAlpha(pillarAlpha((deco as unknown as { x: number }).x));
    }
  }

  private onSlotClicked(slotIndex: number): void {
    // Wave 5: Remove Mode short-circuits placement. Clicking a placed
    // (non-basic, non-buffer, non-boss) tile triggers loopRunner.removeTile
    // which handles the 50% refund and orphan-subtile cascade.
    if (this.removeMode) {
      const removed = this.loopRunner.removeTile(slotIndex);
      if (removed) {
        this.buildLoopGrid();
        this.refreshInventory();
      } else {
        const slot = this.loopRunState.loop.tiles[slotIndex];
        if (slot?.type === 'boss') this.showToast(t('planning.toastBossCannotRemove'));
        else if (slot?.type === 'basic') this.showToast(t('planning.toastSlotEmpty'));
        else this.showToast(t('planning.toastCannotRemoveTile'));
      }
      return;
    }

    if (!this.selectedTileKey) return;

    // Tutorial gating: only the on-script tile type may be placed during the
    // 'place-tile' / 'place-subtile' steps. The inventory pickers already dim
    // off-script tiles, but this also guards the drag-drop path and any
    // selection carried over from the previous step — without it the player
    // could still burn TP on a wrong tile and softlock the scripted run.
    if (!this.tutorialAllowsPlacing(getTileConfig(this.selectedTileKey).type, this.selectedTileKey)) {
      this.showToast(this.tutorialAllowedTileType() === 'subtile'
        ? t('planning.toastPlaceSubtileReserved')
        : t('planning.toastPlaceCombatTile'));
      return;
    }

    const placedKey = this.selectedTileKey;
    const success = this.loopRunner.placeTile(slotIndex, placedKey);
    if (success) {
      const placedConfig = getTileConfig(placedKey);
      // Tutorial advances are type-gated so the player can't shortcut the
      // sequence by, say, placing a treasure tile when we asked for combat:
      //   - 'place-tile'    → only fires on a combat tile (type='terrain')
      //   - 'place-subtile' → only fires on a subtile
      if (placedConfig.type === 'terrain') {
        tutorialDirector.advanceIfMatches('place-tile');
      } else if (placedConfig.type === 'subtile') {
        tutorialDirector.advanceIfMatches('place-subtile');
      }
      // Deduct tile points if purchasing (not from inventory)
      const config = placedConfig;
      const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === placedKey);
      if (invEntry && invEntry.count > 0) {
        invEntry.count--;
      } else {
        this.loopRunState.economy.tilePoints -= config.tilePointCost;
      }
      // Refresh grid and inventory — keep tile selected for multi-placement (feedback #4)
      this.buildLoopGrid();
      this.refreshInventory();
      // Only deselect if we can no longer afford or have copies
      const config2 = getTileConfig(this.selectedTileKey!);
      const invEntry2 = this.loopRunState.tileInventory.find(t => t.tileType === this.selectedTileKey);
      const canStillPlace = (invEntry2 && invEntry2.count > 0) || this.loopRunState.economy.tilePoints >= config2.tilePointCost;
      if (!canStillPlace) {
        this.selectedTileKey = null;
        this.selectedCardIndex = -1;
      }
    } else {
      const slot = this.loopRunState.loop.tiles[slotIndex];
      if (this.loopRunner.getState() !== 'planning') {
        this.showToast(t('planning.toastCannotPlaceNow'));
      } else if (!slot) {
        this.showToast(t('planning.toastInvalidSlot'));
      } else if (slot.type === 'boss') {
        this.showToast(t('planning.toastBossCannotReplace'));
      } else if (slot.type === 'buffer') {
        this.showToast(t('planning.toastBufferCannotReplace'));
      } else if (slot.type === 'basic' && slot.reserved) {
        this.showToast(t('planning.toastReservedNeedsSubtile'));
      } else {
        this.showToast(t('planning.toastSlotOccupied'));
      }
    }
  }

  private buildInventoryPanel(_fontFamily: string): void {
    const boardKey = this.textures.exists('tile_inventory_panel') ? 'tile_inventory_panel' : 'tile_selection_board';
    const board = this.add.image(400, 367, boardKey);
    // tile_inventory_panel: debug-layout scale=0.2592 → displayWidth=514
    // tile_selection_board: original scale kept at 655/width
    board.setScale(boardKey === 'tile_inventory_panel' ? 514 / board.width : 655 / board.width);

    this.refreshInventory();
  }

  private refreshInventory(): void {
    const fontFamily = 'VT323';

    if (this.selectedTileKey && !this.tutorialAllowsPlacing(getTileConfig(this.selectedTileKey).type, this.selectedTileKey)) {
      this.selectedTileKey = null;
      this.selectedCardIndex = -1;
    }

    for (const card of this.inventoryCards) card.destroy();
    this.inventoryCards = [];
    for (const card of this.subtileInventoryCards) card.destroy();
    this.subtileInventoryCards = [];

    const allPlaceable = getAllPlaceableTiles();
    const unlockedTileKeys = new Set(getRun().pool?.tiles ?? []);
    const inPool = (key: string) => unlockedTileKeys.size === 0 || unlockedTileKeys.has(key);
    // Subtiles are landmarks placed on reserved slots — they don't go in the left tile slot
    const allTiles = allPlaceable.filter(t => inPool(t.key) && t.type !== 'subtile');
    const subtileSlotsExist = this.hasOpenReservedSlot();

    // ── Layout from debug-layout.json (timestamp 2026-06-06T22:08) ────────────
    // Tile cards: x=194.1, 272.6, 351.1 @ y=336 (step≈78.5)
    // Landmark cards row0: x=442.5,501.1,561,617.6 @ y=340; row1: y≈409
    const FRAME         = 52;
    const TILE_XS       = [194.1, 272.6, 351.1];
    const TILE_Y        = 336;

    // Section labels — fontSize from debug-layout (~16.6px)
    const labelStyle = { fontSize: '16px', color: '#c4a84a', fontFamily, fontStyle: 'italic' };
    this.inventoryCards.push(this.add.text(247.3, 297.1, t('planning.sectionTiles'),     labelStyle).setOrigin(0.5) as any);
    this.inventoryCards.push(this.add.text(550.8, 297,   t('planning.sectionLandmarks'), labelStyle).setOrigin(0.5) as any);

    // ── LEFT SLOT: all tiles ──────────────────────────────────────────────────
    const TILE_COLS = TILE_XS.length;
    allTiles.forEach((tileConfig, idx) => {
      const col = idx % TILE_COLS;
      const row = Math.floor(idx / TILE_COLS);
      const x   = TILE_XS[col];
      const y   = TILE_Y + row * 80;
      const container = this.add.container(x, y);

      const frame = this.add.image(0, 0, 'tile_frame').setDisplaySize(FRAME, FRAME);
      container.add(frame);

      const isSubtile = tileConfig.type === 'subtile';
      const pseudoSlot: TileSlot = {
        type: tileConfig.type,
        terrain: tileConfig.terrain,
        kind: isSubtile ? tileConfig.key : undefined,
        subtileEffect: isSubtile ? tileConfig.effect : undefined,
        defeatedThisLoop: false,
      };

      const previewSize = Math.round(FRAME * 0.65);
      const scale = previewSize / TILE_SIZE;
      const preview = new PlanningTileVisual(this, 0, 0, pseudoSlot, scale, 0, false);
      if (['rest', 'event', 'treasure', 'boss', 'terrain'].includes(pseudoSlot.type)) preview.hideFloor();
      preview.hideLandmark();
      container.add(preview);

      const nameText = this.add.text(0, FRAME / 2 + 6, tileConfig.name, {
        fontSize: '11px', color: '#ffdca0', fontFamily,
      }).setOrigin(0.5);
      container.add(nameText);

      const costText = this.add.text(0, FRAME / 2 + 18, t('planning.tilePointCost', { cost: tileConfig.tilePointCost }), {
        fontSize: '10px', color: '#c4a84a', fontFamily, fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(costText);

      const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === tileConfig.key);
      const freeCount = invEntry?.count ?? 0;
      if (freeCount > 0) {
        container.add(this.add.text(FRAME / 2 - 4, -FRAME / 2 + 4, `x${freeCount}`, {
          fontSize: '10px', color: '#ffffff', fontFamily, fontStyle: 'bold',
          backgroundColor: '#333333', padding: { x: 2, y: 1 },
        }).setOrigin(1, 0));
      }

      const canAfford  = freeCount > 0 || this.loopRunState.economy.tilePoints >= tileConfig.tilePointCost;
      const hasSlot    = isSubtile ? subtileSlotsExist : this.hasOpenNormalSlot();
      const contextOk  = !this.removeMode && hasSlot && this.tutorialAllowsPlacing(tileConfig.type, tileConfig.key);
      const enabled    = canAfford && contextOk;

      frame.setInteractive({ useHandCursor: enabled });
      this.attachTooltip(frame, x, y - FRAME / 2, tileConfig.description, tileConfig.key);
      frame.on('pointerover', () => { container.setScale(this.selectedCardIndex === idx ? 1.15 : 1.1); frame.setTint(0xdddddd); });
      frame.on('pointerout',  () => { container.setScale(this.selectedCardIndex === idx ? 1.05 : 1.0); frame.clearTint(); });

      if (!enabled) {
        container.setAlpha(0.5);
        if (!canAfford) costText.setColor('#880000');
      } else {
        frame.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.selectInventoryTile(idx, tileConfig.key);
          this.startInventoryDrag(pointer, tileConfig.key, {
            type: tileConfig.type,
            terrain: tileConfig.terrain,
            kind: isSubtile ? tileConfig.key : undefined,
            subtileEffect: isSubtile ? tileConfig.effect : undefined,
            defeatedThisLoop: false,
          });
        });
      }

      this.inventoryCards.push(container);
    });

    // ── RIGHT SLOT: subtile landmarks only ────────────────────────────────────
    // Biome/special landmarks (forest, graveyard, swamp, desert, lava, event,
    // treasure, boss) appear automatically when the tile is placed — they are
    // not shown here. Only subtile landmarks are listed so the player knows
    // which subtile effect each landmark represents.
    // Only show subtile landmarks that are unlocked (in pool) — same gate as the tile slot
    const subtileLandmarkEntries = Object.entries(LANDMARK_MAP).filter(
      ([tileKey, texKey]) => tileKey.startsWith('subtile_') && this.textures.exists(texKey) && inPool(tileKey)
    );

    const LM_FRAME  = 44;
    // Exact positions from debug-layout (2026-06-06T22:08)
    const LM_XS = [442.5, 501.1, 561, 617.6];
    const LM_YS = [340, 409.3];
    const LM_COLS = LM_XS.length;

    // Index offset so selectInventoryTile can find these cards in inventoryCards array
    const lmIndexOffset = allTiles.length + 2; // +2 for the two label texts pushed before tiles

    subtileLandmarkEntries.forEach(([tileKey, texKey], idx) => {
      const col = idx % LM_COLS;
      const row = Math.floor(idx / LM_COLS);
      const x   = LM_XS[col];
      const y   = LM_YS[row] ?? (LM_YS[LM_YS.length - 1] + (row - LM_YS.length + 1) * 70);
      const container = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, LM_FRAME, LM_FRAME, 0x111111, 0.7)
        .setStrokeStyle(1, 0x886633, 0.8);
      container.add(bg);

      const img = this.add.image(0, 0, texKey);
      const src = this.textures.get(texKey).getSourceImage() as HTMLImageElement;
      img.setScale((LM_FRAME * 0.85) / Math.max(src.width, src.height));
      container.add(img);

      const label = tileKey.replace('subtile_', '').replace(/_/g, ' ');
      container.add(this.add.text(0, LM_FRAME / 2 + 6, label, {
        fontSize: '10px', color: '#ffdca0', fontFamily,
      }).setOrigin(0.5));

      // Subtile landmarks are draggable — they get placed on reserved slots
      const tileConfig = getAllPlaceableTiles().find(t => t.key === tileKey);
      if (tileConfig) {
        const invEntry = this.loopRunState.tileInventory.find(t => t.tileType === tileKey);
        const freeCount = invEntry?.count ?? 0;
        const canAfford  = freeCount > 0 || this.loopRunState.economy.tilePoints >= tileConfig.tilePointCost;
        const contextOk  = !this.removeMode && subtileSlotsExist && this.tutorialAllowsPlacing(tileConfig.type, tileKey);
        const enabled    = canAfford && contextOk;
        const cardIndex  = lmIndexOffset + idx;

        bg.setInteractive({ useHandCursor: enabled });
        this.attachTooltip(bg, x, y - LM_FRAME / 2, tileConfig.description, tileKey);
        bg.on('pointerover', () => { container.setScale(this.selectedCardIndex === cardIndex ? 1.15 : 1.1); bg.setStrokeStyle(1, 0xffd700, 1); });
        bg.on('pointerout',  () => { container.setScale(this.selectedCardIndex === cardIndex ? 1.05 : 1.0); bg.setStrokeStyle(1, 0x886633, 0.8); });

        if (!enabled) {
          container.setAlpha(0.5);
        } else {
          bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.selectInventoryTile(cardIndex, tileKey);
            this.startInventoryDrag(pointer, tileKey, {
              type: tileConfig.type,
              terrain: tileConfig.terrain,
              kind: tileKey,
              subtileEffect: tileConfig.effect,
              defeatedThisLoop: false,
            });
          });
        }
      }

      this.inventoryCards.push(container);
    });
  }

  private selectInventoryTile(cardIndex: number, tileKey: string): void {
    // Deselect previous
    if (this.selectedCardIndex >= 0 && this.inventoryCards[this.selectedCardIndex]) {
      this.inventoryCards[this.selectedCardIndex].setScale(1);
    }

    if (this.selectedCardIndex === cardIndex) {
      // Toggle off
      this.selectedTileKey = null;
      this.selectedCardIndex = -1;
      return;
    }

    this.selectedTileKey = tileKey;
    this.selectedCardIndex = cardIndex;

    // Highlight selected card
    if (this.inventoryCards[cardIndex]) {
      this.inventoryCards[cardIndex].setScale(1.05);
    }
  }

  private setupDragScroll(): void {
    let dragging = false;
    let dragMoved = false;
    let startPointerX = 0;
    let startOffset = 0;
    const DRAG_THRESHOLD = 4; // pixels — below this, treat as a click

    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY > 130 && pointer.worldY < 230) {
        dragging = true;
        dragMoved = false;
        startPointerX = pointer.worldX;
        startOffset = this.scrollOffset;
      }
    };
    this.input.on('pointerdown', this.onPointerDown);

    this.onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = pointer.worldX - startPointerX;
      if (Math.abs(dx) > DRAG_THRESHOLD) dragMoved = true;
      // No clamp — the belt wraps via updateTilePositions().
      this.scrollOffset = startOffset + dx;
      this.updateTilePositions();
    };
    this.input.on('pointermove', this.onPointerMove);

    this.onPointerUp = () => {
      dragging = false;
      // Fold scrollOffset back into [0, period) so future drags don't grow
      // unbounded and lose precision over many loops.
      if (this.gridGeometry && this.gridGeometry.period > 0 && dragMoved) {
        const p = this.gridGeometry.period;
        this.scrollOffset = ((this.scrollOffset % p) + p) % p;
      }
    };
    this.input.on('pointerup', this.onPointerUp);

    // Mouse wheel scrolls horizontally too — handy for trackpads.
    this.onWheel = (
      pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
    ) => {
      if (pointer.worldY < 130 || pointer.worldY > 230) return;
      this.scrollOffset -= dy;
      this.updateTilePositions();
    };
    this.input.on('wheel', this.onWheel);
  }

  /**
   * "Don't stop here for: 1 / 5 / 10 / 25" toggle row.
   * Sets `run.skipLoopsRemaining = N`, which GameScene consumes in its
   * loop-completed handler. Boss-loop planning ignores the counter.
   */
  private buildSkipLoopsRow(_fontFamily: string): void {
    const run = getRun();

    // Panel background: 2626×1052 → display at 210×84px
    const PANEL_W = 210;
    const PANEL_H = Math.round(PANEL_W * 1052 / 2626);
    const PANEL_X = PANEL_W / 2 + 40;
    const PANEL_Y = 545;

    if (this.textures.exists('skip_loop_panel')) {
      this.add.image(PANEL_X, PANEL_Y, 'skip_loop_panel')
        .setDisplaySize(PANEL_W, PANEL_H);
    }

    // Buttons: centered inside the lower portion of the panel
    const GAP = 10;
    const numScale = (17 * 1.2) / 500;
    const numDisplayW = 500 * numScale;
    const BTN_Y = PANEL_Y + PANEL_H * 0.22;
    const optionValues = [1, 5, 10, 25] as const;
    const keys = ['btn_skip_1', 'btn_skip_5', 'btn_skip_10', 'btn_skip_25'] as const;
    const btnImgs: Phaser.GameObjects.Image[] = [];

    const totalBtnW = optionValues.length * numDisplayW + (optionValues.length - 1) * GAP;
    const btnStartX = PANEL_X - totalBtnW / 2 + numDisplayW / 2;

    const refresh = () => {
      const current = run.skipLoopsRemaining ?? 0;
      btnImgs.forEach((img, i) => {
        img.clearTint();
        if (optionValues[i] === current) img.setTint(0xffd700);
      });
    };

    optionValues.forEach((value, idx) => {
      const x = btnStartX + idx * (numDisplayW + GAP);
      const img = this.add.image(x, BTN_Y, keys[idx])
        .setScale(numScale)
        .setInteractive({ useHandCursor: true });

      img.on('pointerover', () => { if ((run.skipLoopsRemaining ?? 0) !== value) img.setTint(0xdddddd); });
      img.on('pointerout',  () => refresh());
      img.on('pointerdown', () => {
        const current = run.skipLoopsRemaining ?? 0;
        run.skipLoopsRemaining = current === value ? 0 : value;
        refresh();
      });
      btnImgs.push(img);
    });

    refresh();
  }

  /** Wave 5: Remove Mode toggle. When active, slot clicks remove placed tiles. */
  private buildRemoveModeButton(fontFamily: string): void {
    // Panel: 275×135 source → 180×88px, anchored top-right
    const PW = 180;
    const PH = Math.round(PW * 135 / 275);
    const PX = 800 - PW / 2 - 48;
    const PY = 600 - PH / 2 - 8;

    if (this.textures.exists('remove_tiles_panel')) {
      this.add.image(PX, PY, 'remove_tiles_panel').setDisplaySize(PW, PH);
    }

    // Toggle label in the slot (lower-center of the panel)
    const label = this.add.text(PX - 18, PY + PH * 0.22 - 3, t('planning.toggleOff'), {
      fontSize: '15px', fontStyle: 'bold', color: '#aaddff', fontFamily,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const refresh = () => {
      label.setText(this.removeMode ? t('planning.toggleOn') : t('planning.toggleOff'));
      label.setColor(this.removeMode ? '#ff4433' : '#aaddff');
    };

    label.on('pointerover', () => label.setAlpha(0.8));
    label.on('pointerout',  () => label.setAlpha(1));
    label.on('pointerdown', () => {
      this.removeMode = !this.removeMode;
      if (this.removeMode) {
        this.selectedTileKey = null;
        if (this.selectedCardIndex >= 0 && this.inventoryCards[this.selectedCardIndex]) {
          this.inventoryCards[this.selectedCardIndex].setScale(1);
        }
        if (this.selectedCardIndex >= 0 && this.subtileInventoryCards[this.selectedCardIndex]) {
          this.subtileInventoryCards[this.selectedCardIndex].setScale(1);
        }
        this.selectedCardIndex = -1;
      }
      refresh();
      this.refreshInventory();
    });

    refresh();
  }

  /**
   * Scripted-tutorial gating: during the 'place-tile' / 'place-subtile' steps
   * the player must place exactly the on-script tile type. Returns the
   * required type, or null when no restriction applies (normal play, or any
   * other tutorial step). The spotlight rect alone can't enforce this — it
   * exposes the whole inventory — so placing an off-script tile would burn TP
   * and softlock the run. Callers use this to disable every other picker.
   */
  private tutorialAllowedTileType(): TileSlotType | null {
    if (!tutorialDirector.isActive()) return null;
    const step = tutorialDirector.getCurrentStep();
    if (step?.id === 'place-tile') return 'terrain';
    if (step?.id === 'place-subtile') return 'subtile';
    return null;
  }

  private tutorialAllowedTileKey(): string | null {
    if (!tutorialDirector.isActive()) return null;
    const step = tutorialDirector.getCurrentStep();
    if (step?.id === 'place-tile') return 'forest';
    return null;
  }

  /** True when a tile of `tileType`/`tileKey` may be placed under the current
   *  tutorial gate (always true outside the gated steps). */
  private tutorialAllowsPlacing(tileType: TileSlotType, tileKey?: string): boolean {
    const allowedKey = this.tutorialAllowedTileKey();
    if (allowedKey !== null) return tileKey === allowedKey;
    const allowed = this.tutorialAllowedTileType();
    return allowed === null || allowed === tileType;
  }

  /** Wave 5: any basic slot that is NOT reserved — target for normal tiles.
   *  Enemy-bearing slots count: the enemy is pinned and carries onto the tile. */
  private hasOpenNormalSlot(): boolean {
    return this.loopRunState.loop.tiles.some(t => t.type === 'basic' && !t.reserved);
  }

  /** Wave 5: any basic slot that IS reserved — target for subtile placement.
   *  Enemy-bearing slots count: the enemy is pinned and carries onto the subtile. */
  private hasOpenReservedSlot(): boolean {
    return this.loopRunState.loop.tiles.some(t => t.type === 'basic' && t.reserved === true);
  }

  /**
   * Attach 800ms-hover tooltip showing `description` to a frame. Cancels
   * on pointerout. Only fires when the tile config carries a description.
   */
  private static readonly TILE_TOOLTIP_KEYS: Record<string, string> = {
    'forest':            'tile_tooltip_forest',
    'graveyard':         'tile_tooltip_graveyard',
    'swamp':             'tile_tooltip_swamp',
    'desert':            'tile_tooltip_desert',
    'lava':              'tile_tooltip_lava',
    'event':             'tile_tooltip_event',
    'treasure':          'tile_tooltip_treasure',
    'subtile_ambush':    'tile_tooltip_ambush',
    'subtile_magma':     'tile_tooltip_magma',
    'subtile_manawell':  'tile_tooltip_manawell',
    'subtile_camp':      'tile_tooltip_camp',
    'subtile_burnaltar': 'tile_tooltip_burnaltar',
    'subtile_bleedtotem':'tile_tooltip_bleedtotem',
    'subtile_resonance': 'tile_tooltip_resonance',
    'subtile_warhorn':   'tile_tooltip_warhorn',
  };

  private attachTooltip(
    frame: Phaser.GameObjects.GameObject,
    worldX: number,
    worldY: number,
    description: string | undefined,
    tileKey?: string,
  ): void {
    if (!description) return;
    const interactive = frame as Phaser.GameObjects.GameObject & {
      on: (ev: string, fn: () => void) => void;
    };
    interactive.on('pointerover', () => {
      this.tooltipTimer?.remove();
      this.tooltipTimer = this.time.delayedCall(800, () => {
        this.showTooltip(worldX, worldY, description, tileKey);
      });
    });
    interactive.on('pointerout', () => {
      this.tooltipTimer?.remove();
      this.tooltipTimer = undefined;
      this.hideTooltip();
    });
  }

  private showTooltip(anchorX: number, anchorY: number, text: string, tileKey?: string): void {
    this.hideTooltip();

    // Use styled image asset when available
    const imgKey = tileKey ? PlanningOverlay.TILE_TOOLTIP_KEYS[tileKey] : undefined;
    if (imgKey && this.textures.exists(imgKey)) {
      const img = this.add.image(0, 0, imgKey);
      const scale = 196 / img.width;
      img.setScale(scale);
      let cy = anchorY - img.displayHeight / 2 - 10;
      if (cy - img.displayHeight / 2 < 8) cy = anchorY + img.displayHeight / 2 + 10;
      const container = this.add.container(anchorX, cy, [img]);
      container.setDepth(2000);
      this.tooltipObj = container;
      return;
    }

    // Fallback: programmatic text tooltip
    const fontFamily = 'VT323';
    const label = this.add.text(0, 0, text, {
      fontSize: '12px', color: '#ffffff', fontFamily,
      wordWrap: { width: 220 }, align: 'center',
    }).setOrigin(0.5);
    const pad = 8;
    const w = label.width + pad * 2;
    const h = label.height + pad * 2;
    const bg = this.add.rectangle(0, 0, w, h, 0x101010, 0.92)
      .setStrokeStyle(1, 0xffd700, 0.9);
    let cy = anchorY - 44;
    if (cy - h / 2 < 8) cy = anchorY + 44;
    const container = this.add.container(anchorX, cy, [bg, label]);
    container.setDepth(2000);
    this.tooltipObj = container;
  }

  private hideTooltip(): void {
    if (this.tooltipObj) {
      this.tooltipObj.destroy(true);
      this.tooltipObj = undefined;
    }
  }

  private buildEconomyPanel(fontFamily: string): void {
    const run = getRun();
    const cx = 403;
    const cy = 58;
    const panelW = 216;
    const panelH = 70;
    const top = cy - panelH / 2;

    if (this.textures.exists('deck_relic_table')) {
      this.add.image(cx, cy, 'deck_relic_table').setDisplaySize(Math.round(panelW * 1.2), Math.round(panelH * 1.2));
    } else {
      this.add.rectangle(cx, cy, Math.round(panelW * 1.2), Math.round(panelH * 1.2), 0x0a0a1a, 0.88).setStrokeStyle(1, 0x334455, 1);
    }

    this.add.text(cx, top + 9, t('planning.loopCount', { count: this.loopRunState.loop.count }), {
      fontSize: '11px', fontStyle: 'bold', color: '#aaddff', fontFamily,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.rectangle(cx, top + 17, panelW - 14, 1, 0x334455, 0.8);

    // Three icon + value + label groups — uniform font matches the rest of the app
    const serifFont = 'VT323';
    const ICON_H    = 21;
    const GAP       = 4;  // gap between icon and value text
    // Natural aspect ratio per icon (source W / source H)
    const iconAspect: Record<string, number> = {
      'icon_coin':  210 / 209,   // ~square
      'icon_brick': 258 / 223,   // slightly wide
      'icon_card':  223 / 327,   // portrait → narrower
    };
    const iconY  = top + 37;
    const labelY = top + 57;
    const items: [string, string, string, string][] = [
      ['icon_coin',  `${this.loopRunState.economy.gold}`,         '#f0c040', t('planning.gold') ],
      ['icon_brick', `${this.loopRunState.economy.tilePoints}`,  '#00e5ff', t('planning.tilePoints')],
      ['icon_card',  `${run.deck.active.length}`,                '#ffffff', t('planning.cards')],
    ];

    const cellW = panelW / items.length;
    items.forEach(([iconKey, value, color, label], i) => {
      const cellCx = cx - panelW / 2 + cellW * i + cellW / 2;
      const iw = Math.round(ICON_H * (iconAspect[iconKey] ?? 1));

      // Render value text first to measure its width, then center the whole group
      const valText = this.add.text(0, iconY, value, {
        fontSize: '11px', fontStyle: 'bold', color,
        fontFamily: serifFont,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0.5);

      const groupW   = iw + GAP + valText.width;
      const groupLeft = cellCx - groupW / 2;

      if (this.textures.exists(iconKey)) {
        this.add.image(groupLeft + iw / 2, iconY, iconKey).setDisplaySize(iw, ICON_H);
      }
      valText.setX(groupLeft + iw + GAP);

      this.add.text(cellCx, labelY, label, {
        fontSize: '10px', color: '#ffffff',
        fontFamily: serifFont,
      }).setOrigin(0.5, 0.5);
    });
  }

  private buildCharacterPanel(fontFamily: string): void {
    const run = getRun();
    const hero = run.hero;
    // To the right of the economy panel (which ends at ~x=540), same y level
    const cx = 670;
    const cy = 58;
    const panelW = 200;
    const panelH = 70;
    const top = cy - panelH / 2;

    if (this.textures.exists('deck_relic_table')) {
      this.add.image(cx, cy, 'deck_relic_table').setDisplaySize(Math.round(panelW * 1.2), Math.round(panelH * 1.2));
    } else {
      this.add.rectangle(cx, cy, Math.round(panelW * 1.2), Math.round(panelH * 1.2), 0x0a0a1a, 0.88).setStrokeStyle(1, 0x334455, 1);
    }

    const className = hero.className ?? 'warrior';
    this.add.text(cx, top + 9, className.toUpperCase(), {
      fontSize: '10px', fontStyle: 'bold', color: '#ffd700', fontFamily,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.rectangle(cx, top + 17, panelW - 14, 1, 0x334455, 0.8);

    // Chibi sprite — animated if the pocket spritesheet exists for this class
    const spriteKey  = `hero_chibi_${className}`;
    const spriteX    = cx - panelW / 2 + 21;
    const spriteSize = 42;
    const barsStartX = spriteX + spriteSize / 2 + 6;
    const barW       = cx + panelW / 2 - 58 - barsStartX;

    if (this.textures.exists(spriteKey)) {
      const chibi = this.add.sprite(spriteX, cy + 6, spriteKey);
      chibi.setDisplaySize(spriteSize, spriteSize);
      const animKey = `${spriteKey}_idle`;
      if (this.anims.exists(animKey)) this.anims.remove(animKey);
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: this.textures.get(spriteKey).frameTotal - 2 }),
        frameRate: 8,
        repeat: -1,
      });
      chibi.play(animKey);
    } else {
      this.add.rectangle(spriteX, cy + 6, spriteSize, spriteSize, 0x223344, 0.7)
        .setStrokeStyle(1, 0x446688, 0.6);
      this.add.text(spriteX, cy + 8, '?', {
        fontSize: '14px', color: '#446688', fontFamily,
      }).setOrigin(0.5);
    }

    const valX = cx + panelW / 2 - 8;
    const barH = 9;

    const bars: [string, number, number, string][] = [
      [t('planning.barHp'),  hero.currentHP,       hero.maxHP,       '#cc3333'],
      [t('planning.barSta'), hero.currentStamina,  hero.maxStamina,  '#cc8833'],
      [t('planning.barMp'),  hero.currentMana,     hero.maxMana,     '#3355cc'],
    ];

    bars.forEach(([label, cur, max, color], i) => {
      const by = top + 28 + i * 16;
      this.add.text(barsStartX, by, label, {
        fontSize: '9px', color: '#aaaaaa', fontFamily,
      }).setOrigin(0, 0.5);
      const trackX = barsStartX + 22;
      const trackW = barW;
      this.add.rectangle(trackX + trackW / 2, by, trackW, barH, 0x222222, 1)
        .setStrokeStyle(1, 0x444444, 0.6);
      const frac = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
      if (frac > 0) {
        const fillW = trackW * frac;
        this.add.rectangle(trackX + fillW / 2, by, fillW, barH, Number.parseInt(color.slice(1), 16), 1);
      }
      this.add.text(valX, by, `${cur}/${max}`, {
        fontSize: '9px', color: '#ffffff', fontFamily, stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0.5);
    });
  }

  private startInventoryDrag(
    pointer: Phaser.Input.Pointer,
    tileKey: string,
    pseudoSlot: TileSlot,
  ): void {
    this.endInventoryDrag(); // cancel any prior drag
    this.draggingTileKey = tileKey;

    // Build sprite key the same way TileVisual does: tile_<terrain|kind|type>
    const terrainKey = pseudoSlot.terrain ?? pseudoSlot.kind ?? pseudoSlot.type;
    const spriteKey  = `tile_${terrainKey}`;
    const GHOST_SIZE = 52;

    // Use this.add.image / this.add.rectangle — these are on the display list
    // from the moment they're created, so dragGhost.add() can properly reparent
    // them (TileVisual children aren't, causing the off-screen rendering bug).
    // pointer.worldX/worldY convert from backing-store pixels to 800×600 world
    // space, accounting for the UI_SCALE camera zoom. Using pointer.x/y would
    // place the ghost UI_SCALE times too far from the origin (bottom-right drift).
    this.dragGhost = this.add.container(pointer.worldX, pointer.worldY);
    if (this.textures.exists(spriteKey)) {
      const img = this.add.image(0, 0, spriteKey).setDisplaySize(GHOST_SIZE, GHOST_SIZE);
      this.dragGhost.add(img);
    } else {
      const cfg  = getTileConfig(tileKey);
      const rect = this.add.rectangle(0, 0, GHOST_SIZE, GHOST_SIZE, cfg.color);
      this.dragGhost.add(rect);
    }
    this.dragGhost.setDepth(600).setAlpha(0.82);

    this.onDragMove = (p: Phaser.Input.Pointer) => {
      this.dragGhost?.setPosition(p.worldX, p.worldY);
    };

    this.onDragUp = (p: Phaser.Input.Pointer) => {
      if (this.draggingTileKey) {
        const slotIndex = this.findGridSlotAt(p.worldX, p.worldY);
        if (slotIndex !== -1) {
          this.selectedTileKey = this.draggingTileKey;
          this.onSlotClicked(slotIndex);
        }
      }
      this.endInventoryDrag();
    };

    this.input.on('pointermove', this.onDragMove);
    this.input.on('pointerup', this.onDragUp);
  }

  private endInventoryDrag(): void {
    if (this.onDragMove) { this.input.off('pointermove', this.onDragMove); this.onDragMove = undefined; }
    if (this.onDragUp)   { this.input.off('pointerup',   this.onDragUp);   this.onDragUp   = undefined; }
    if (this.dragGhost)  { this.dragGhost.destroy(true); this.dragGhost = null; }
    this.draggingTileKey = null;
  }

  private findGridSlotAt(x: number, y: number): number {
    const SNAP_RADIUS = 50;
    let bestSlot = -1;
    let bestDist = SNAP_RADIUS;

    for (const tv of this.tileVisuals) {
      const slotIdx = tv.getData('beltSlot') as number;
      const slot = this.loopRunState.loop.tiles[slotIdx];
      if (!slot || slot.type === 'buffer') continue;

      // gridContainer is at (0,0), so tv.x/tv.y are world coords
      const dist = Math.hypot(tv.x - x, tv.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestSlot = slotIdx;
      }
    }

    return bestSlot;
  }

  /** Shop/Forge are now rendered inline in create() alongside Deck/Relic. */
  private buildShopForgeButtons(_fontFamily: string): void { /* no-op */ }

  private openSubScene(sceneKey: string): void {
    // Tutorial: opening a sub-scene from planning completes its "click the X
    // button" step. Shop is the new gate before the forge (the player buys the
    // elements there); Forge stays the step after.
    if (sceneKey === SCENE_KEYS.FORGE) {
      tutorialDirector.advanceIfMatches('forge-intro');
    } else if (sceneKey === SCENE_KEYS.SHOP) {
      tutorialDirector.advanceIfMatches('shop-intro');
    }
    // Sync TP/gold back to RunState so the sub-scene sees the up-to-date
    // economy (planning may have spent TP placing tiles).
    const run = getRun();
    run.economy.gold = this.loopRunState.economy.gold;
    run.economy.tilePoints = this.loopRunState.economy.tilePoints;

    this.scene.sleep();
    this.scene.launch(sceneKey, { parentScene: SCENE_KEYS.PLANNING });
  }

  private showToast(message: string): void {
    const fontFamily = 'VT323';
    const toast = this.add.text(400, 560, message, {
      fontSize: '14px', color: '#ff0000', fontFamily,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      duration: 1500,
      onComplete: () => toast.destroy(),
    });
  }

  update(): void {
    if (!this.bgImg1 || !this.bgImg2) return;
    const speed = 0.12;
    this.bgImg1.x -= speed;
    this.bgImg2.x -= speed;
    const halfW = this.bgDisplayW / 2;
    if (this.bgImg1.x + halfW < 0) this.bgImg1.x = this.bgImg2.x + this.bgDisplayW;
    if (this.bgImg2.x + halfW < 0) this.bgImg2.x = this.bgImg1.x + this.bgDisplayW;
  }

  private cleanup(): void {
    this.endInventoryDrag();

    // Cancel pending tooltip + drop any visible tooltip so the timer
    // doesn't fire into a destroyed scene.
    this.tooltipTimer?.remove();
    this.tooltipTimer = undefined;
    this.hideTooltip();

    // Destroy belt tile visuals; the container is destroyed below.
    for (const tv of this.tileVisuals) {
      tv.destroy();
    }
    this.tileVisuals = [];

    for (const card of this.inventoryCards) {
      card.destroy();
    }
    this.inventoryCards = [];
    // Wave 5: also clean up the subtile inventory row.
    for (const card of this.subtileInventoryCards) {
      card.destroy();
    }
    this.subtileInventoryCards = [];
    this.reservedDecorations = [];
    if (this.gridMask) { this.gridMask.destroy(); this.gridMask = null; }

    if (this.gridContainer) {
      this.gridContainer.destroy(true);
      this.gridContainer = undefined as unknown as Phaser.GameObjects.Container;
    }

    // Remove the global pointer/wheel handlers attached in setupDragScroll —
    // otherwise they re-stack each time the overlay is re-entered.
    if (this.onPointerDown) {
      this.input.off('pointerdown', this.onPointerDown);
      this.onPointerDown = undefined;
    }
    if (this.onPointerMove) {
      this.input.off('pointermove', this.onPointerMove);
      this.onPointerMove = undefined;
    }
    if (this.onPointerUp) {
      this.input.off('pointerup', this.onPointerUp);
      this.onPointerUp = undefined;
    }
    if (this.onWheel) {
      this.input.off('wheel', this.onWheel);
      this.onWheel = undefined;
    }
  }
}
