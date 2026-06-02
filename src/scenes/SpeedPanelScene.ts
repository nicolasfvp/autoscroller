// SpeedPanelScene — persistent bottom-left hamburger panel with Map and Combat
// speed sliders. Collapsed by default; click ☰ to expand, × to collapse.

import { Scene } from 'phaser';
import { hasActiveRun, getRun } from '../state/RunState';
import { SCENE_KEYS } from '../state/SceneKeys';
import { MapSpeedSlider } from '../ui/MapSpeedSlider';

const SCALE = 0.5;
const PANEL_X = 8;
const PANEL_Y = 483;
const PANEL_W = 168;
const PANEL_H = 99;

const BTN_X = 8;
const BTN_Y = 584;
const BTN_W = 36;
const BTN_H = 16;

const VISIBLE_OVER = new Set<string>([
  SCENE_KEYS.GAME,
  SCENE_KEYS.COMBAT,
]);

export class SpeedPanelScene extends Scene {
  private mapSlider!: MapSpeedSlider;
  private combatSlider!: MapSpeedSlider;
  private container!: Phaser.GameObjects.Container;
  private panelGroup!: Phaser.GameObjects.Container;
  private btnLabel!: Phaser.GameObjects.Text;
  private wasVisible: boolean = false;
  private expanded: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.SPEED_PANEL });
  }

  create(): void {
    this.container = this.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    // ── Panel group (expanded content) ──────────────────────────────────────
    this.panelGroup = this.add.container(0, 0).setScrollFactor(0).setDepth(999);

    const panelCX = PANEL_X + PANEL_W / 2;
    const panelCY = PANEL_Y + PANEL_H / 2;
    const panelKey = this.textures.exists('speed_panel') ? 'speed_panel' : 'ui_panel';
    if (this.textures.exists(panelKey)) {
      const bg = this.add.image(panelCX, panelCY, panelKey).setScrollFactor(0).setDepth(999);
      bg.setScale(Math.min(PANEL_W / bg.width, PANEL_H / bg.height));
      this.panelGroup.add(bg);
    } else {
      const bg = this.add.graphics().setScrollFactor(0).setDepth(999);
      bg.fillStyle(0x0a0400, 0.85);
      bg.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 6);
      bg.lineStyle(1.5, 0x9a6030, 0.85);
      bg.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 6);
      this.panelGroup.add(bg);
    }

    // Center the sliders in the panel; fixed offsets from PANEL_Y give consistent
    // padding on all sides and prevent the map-slider handle from overlapping
    // the combat-slider title (was too close with the old SCALE-derived positions).
    const sliderCenterX = PANEL_X + PANEL_W / 2 - 10;
    const initialMap = hasActiveRun() ? (getRun().mapSpeed ?? 1) : 1;
    const initialCombat = hasActiveRun() ? (getRun().combatSpeed ?? 1) : 1;

    this.mapSlider = new MapSpeedSlider(
      this, sliderCenterX, PANEL_Y + 38,
      initialMap, (s) => { if (hasActiveRun()) getRun().mapSpeed = s; },
      '', SCALE,
    );
    this.panelGroup.add(this.mapSlider);

    this.combatSlider = new MapSpeedSlider(
      this, sliderCenterX, PANEL_Y + 74,
      initialCombat, (s) => { if (hasActiveRun()) getRun().combatSpeed = s; },
      '', SCALE,
    );
    this.panelGroup.add(this.combatSlider);

    this.panelGroup.setVisible(false);
    this.container.add(this.panelGroup);

    // ── Hamburger button ─────────────────────────────────────────────────────
    const btnBg = this.add.graphics().setScrollFactor(0).setDepth(1001);
    const drawBtn = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hover ? 0x2a1a0a : 0x0a0400, 0.92);
      btnBg.fillRoundedRect(BTN_X, BTN_Y, BTN_W, BTN_H, 5);
      btnBg.lineStyle(1.5, 0x9a6030, 0.9);
      btnBg.strokeRoundedRect(BTN_X, BTN_Y, BTN_W, BTN_H, 5);
    };
    drawBtn(false);
    this.container.add(btnBg);

    this.btnLabel = this.add.text(BTN_X + BTN_W / 2, BTN_Y + BTN_H / 2, '☰', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px',
      color: '#ccaa88',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.container.add(this.btnLabel);

    const hitZone = this.add.zone(BTN_X + BTN_W / 2, BTN_Y + BTN_H / 2, BTN_W, BTN_H)
      .setOrigin(0.5).setScrollFactor(0).setDepth(1003)
      .setInteractive({ useHandCursor: true });
    this.container.add(hitZone);

    hitZone.on('pointerover',  () => drawBtn(true));
    hitZone.on('pointerout',   () => drawBtn(false));
    hitZone.on('pointerdown',  () => this.toggle());

    this.setVisible(false);
  }

  private toggle(): void {
    this.expanded = !this.expanded;
    this.panelGroup.setVisible(this.expanded);
    this.btnLabel.setText(this.expanded ? '×' : '☰');
  }

  update(): void {
    const shouldShow = hasActiveRun() && this.anyVisibleSceneActive();
    if (shouldShow !== this.wasVisible) {
      this.setVisible(shouldShow);
      this.wasVisible = shouldShow;
      if (!shouldShow && this.expanded) {
        this.expanded = false;
        this.panelGroup.setVisible(false);
        this.btnLabel.setText('☰');
      }
    }

    if (shouldShow) {
      const run = getRun();
      this.mapSlider.setSpeed(run.mapSpeed ?? 1);
      this.combatSlider.setSpeed(run.combatSpeed ?? 1);
      this.scene.bringToTop();
    }
  }

  private anyVisibleSceneActive(): boolean {
    const mgr = this.scene.manager;
    for (const key of VISIBLE_OVER) {
      const s = mgr.getScene(key);
      if (s?.scene.isActive()) return true;
    }
    return false;
  }

  private setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
