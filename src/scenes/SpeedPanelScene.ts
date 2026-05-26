// SpeedPanelScene — persistent bottom-left hamburger panel with Map and Combat
// speed sliders. Collapsed by default; click ☰ to expand, × to collapse.

import { Scene } from 'phaser';
import { hasActiveRun, getRun } from '../state/RunState';
import { SCENE_KEYS } from '../state/SceneKeys';
import { MapSpeedSlider } from '../ui/MapSpeedSlider';

const SCALE = 0.5;
const PANEL_X = 8;
const PANEL_Y = 510;
const PANEL_W = Math.round(268 * SCALE); // 134
const PANEL_H = Math.round(116 * SCALE); // 58

const BTN_X = 8;
const BTN_Y = 572;
const BTN_W = 36;
const BTN_H = 22;

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

    const bg = this.add.graphics().setScrollFactor(0).setDepth(999);
    bg.fillStyle(0x0a0400, 0.85);
    bg.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 6);
    bg.lineStyle(1.5, 0x9a6030, 0.85);
    bg.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 6);
    this.panelGroup.add(bg);

    const sliderCenterX = PANEL_X + Math.round(8 * SCALE) + Math.round(90 * SCALE);
    const initialMap = hasActiveRun() ? (getRun().mapSpeed ?? 1) : 1;
    const initialCombat = hasActiveRun() ? (getRun().combatSpeed ?? 1) : 1;

    this.mapSlider = new MapSpeedSlider(
      this, sliderCenterX, PANEL_Y + Math.round(34 * SCALE),
      initialMap, (s) => { if (hasActiveRun()) getRun().mapSpeed = s; },
      'Map Speed', SCALE,
    );
    this.panelGroup.add(this.mapSlider);

    this.combatSlider = new MapSpeedSlider(
      this, sliderCenterX, PANEL_Y + Math.round(84 * SCALE),
      initialCombat, (s) => { if (hasActiveRun()) getRun().combatSpeed = s; },
      'Combat Speed', SCALE,
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
