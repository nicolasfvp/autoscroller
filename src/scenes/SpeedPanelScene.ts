// SpeedPanelScene — persistent bottom-left panel showing Map and Combat speed
// sliders. Stays alive across GameScene ↔ CombatScene transitions; sliders
// read/write run.mapSpeed and run.combatSpeed directly so values survive scene
// switches without per-scene wiring.

import { Scene } from 'phaser';
import { hasActiveRun, getRun } from '../state/RunState';
import { SCENE_KEYS } from '../state/SceneKeys';
import { MapSpeedSlider } from '../ui/MapSpeedSlider';

const PANEL_X = 8;
const PANEL_Y = 478;
const PANEL_W = 268;
const PANEL_H = 110;

// Scene keys we want the panel to be visible over. Map + Combat only;
// PlanningOverlay, menus, city hub, etc. all hide the panel.
const VISIBLE_OVER = new Set<string>([
  SCENE_KEYS.GAME,
  SCENE_KEYS.COMBAT,
]);

export class SpeedPanelScene extends Scene {
  private mapSlider!: MapSpeedSlider;
  private combatSlider!: MapSpeedSlider;
  private container!: Phaser.GameObjects.Container;
  private wasVisible: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.SPEED_PANEL });
  }

  create(): void {
    this.container = this.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    // Panel chrome
    const bg = this.add.graphics().setScrollFactor(0).setDepth(999);
    bg.fillStyle(0x0a0400, 0.78);
    bg.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);
    bg.lineStyle(2, 0x9a6030, 0.85);
    bg.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);
    this.container.add(bg);

    // Sliders — each MapSpeedSlider is its own container with the track,
    // handle, title, and value label baked in.
    const sliderCenterX = PANEL_X + 16 + 90; // 90 = half of 180px track width
    const initialMap = hasActiveRun() ? (getRun().mapSpeed ?? 1) : 1;
    const initialCombat = hasActiveRun() ? (getRun().combatSpeed ?? 1) : 1;

    this.mapSlider = new MapSpeedSlider(this, sliderCenterX, PANEL_Y + 30, initialMap, (s) => {
      if (hasActiveRun()) getRun().mapSpeed = s;
    }, 'Map Speed');
    this.container.add(this.mapSlider);

    this.combatSlider = new MapSpeedSlider(this, sliderCenterX, PANEL_Y + 80, initialCombat, (s) => {
      if (hasActiveRun()) getRun().combatSpeed = s;
    }, 'Combat Speed');
    this.container.add(this.combatSlider);

    this.setVisible(false);
  }

  update(): void {
    // Show the panel only when sitting on top of GameScene / CombatScene /
    // PlanningOverlay. Other scenes (menu, city hub, etc.) hide it.
    const shouldShow = hasActiveRun() && this.anyVisibleSceneActive();
    if (shouldShow !== this.wasVisible) {
      this.setVisible(shouldShow);
      this.wasVisible = shouldShow;
    }

    if (shouldShow) {
      // Keep sliders in sync if RunState was mutated outside the slider (e.g.
      // save/load, settings reset). Cheap no-op when values match.
      const run = getRun();
      this.mapSlider.setSpeed(run.mapSpeed ?? 1);
      this.combatSlider.setSpeed(run.combatSpeed ?? 1);

      // Stay above whatever scene was launched last. bringToTop on the scene
      // manager is cheap and idempotent; doing it every frame keeps the panel
      // visible even after CombatScene calls bringToTop() on itself.
      this.scene.bringToTop();
    }
  }

  private anyVisibleSceneActive(): boolean {
    const mgr = this.scene.manager;
    for (const key of VISIBLE_OVER) {
      const s = mgr.getScene(key);
      if (s && (s.scene.isActive() || s.scene.isPaused() || s.scene.isSleeping())) {
        // Only show when at least one of the target scenes is *running*
        // (active) — paused/sleeping means a modal sits on top, so the panel
        // would just clutter the screen.
        if (s.scene.isActive()) return true;
      }
    }
    return false;
  }

  private setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
