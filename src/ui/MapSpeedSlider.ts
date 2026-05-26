import Phaser from 'phaser';
import { FONTS } from './StyleConstants';

const SNAP_VALUES = [0.5, 1, 1.5, 2, 3] as const;
const MIN_SPEED = SNAP_VALUES[0];
const MAX_SPEED = SNAP_VALUES[SNAP_VALUES.length - 1];

/**
 * MapSpeedSlider — draggable horizontal speed control for the map traversal
 * (independent of combat speed). Snaps to [0.5, 1, 1.5, 2, 3] but the handle
 * can be dragged continuously across the full track.
 */
export class MapSpeedSlider extends Phaser.GameObjects.Container {
  private trackBg!: Phaser.GameObjects.Graphics;
  private trackFill!: Phaser.GameObjects.Graphics;
  private handle!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private tickGraphics!: Phaser.GameObjects.Graphics;

  private readonly trackX: number;
  private readonly trackY: number;
  private readonly trackW: number;

  private currentSpeed: number;
  private onChange: (speed: number) => void;

  constructor(
    scene: Phaser.Scene,
    centerX: number,
    centerY: number,
    initialSpeed: number,
    onChange: (speed: number) => void,
    title: string = 'Map Speed',
    scale: number = 1,
  ) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setScrollFactor(0).setDepth(150).setScale(scale);

    this.currentSpeed = clampSnap(initialSpeed);
    this.onChange = onChange;

    const trackW = 180;
    const trackH = 6;
    this.trackW = trackW;
    this.trackX = centerX - trackW / 2;
    this.trackY = centerY;

    // Title label
    this.titleText = scene.add.text(centerX, centerY - 20, title, {
      fontFamily: FONTS.family,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#cccccc',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(150);
    this.add(this.titleText);

    // Track background (rounded dark bar)
    this.trackBg = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.trackBg.fillStyle(0x000000, 0.55);
    this.trackBg.fillRoundedRect(this.trackX, this.trackY - trackH / 2, trackW, trackH, 3);
    this.trackBg.lineStyle(1, 0x666666, 0.8);
    this.trackBg.strokeRoundedRect(this.trackX, this.trackY - trackH / 2, trackW, trackH, 3);
    this.add(this.trackBg);

    // Tick marks at snap values
    this.tickGraphics = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.tickGraphics.fillStyle(0xaaaaaa, 0.7);
    for (const v of SNAP_VALUES) {
      const tx = this.speedToX(v);
      this.tickGraphics.fillRect(tx - 1, this.trackY - 6, 2, 12);
    }
    this.add(this.tickGraphics);

    // Track fill (left of handle)
    this.trackFill = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.add(this.trackFill);

    // Handle (draggable knob)
    this.handle = scene.add.graphics().setScrollFactor(0).setDepth(151);
    this.add(this.handle);

    // Speed value label (right of slider)
    this.label = scene.add.text(this.trackX + trackW + 12, this.trackY, formatSpeed(this.currentSpeed), {
      fontFamily: FONTS.family,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#00e5ff',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(150);
    this.add(this.label);

    // Hit zone covers the full track + handle area for click-to-jump and drag
    const hitZone = scene.add.zone(centerX, centerY, trackW + 24, 28)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(152)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.add(hitZone);

    // pointer.x is in canvas-pixel coords (multiplied by the Graphics Quality
    // supersample). trackX/trackW live in 800×600 game-space, so funnel the
    // pointer through the camera before mapping it to a speed value. Without
    // this, the slider snaps to the wrong tick (the handle visually lands at
    // pointer.x / UI_SCALE, well off the cursor).
    const cam = scene.cameras.main;
    hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.applyPointerX(cam.getWorldPoint(pointer.x, pointer.y).x);
    });
    hitZone.on('drag', (pointer: Phaser.Input.Pointer) => {
      this.applyPointerX(cam.getWorldPoint(pointer.x, pointer.y).x);
    });

    this.redraw();
  }

  private applyPointerX(pointerX: number): void {
    const t = Phaser.Math.Clamp((pointerX - this.trackX) / this.trackW, 0, 1);
    const raw = MIN_SPEED + t * (MAX_SPEED - MIN_SPEED);
    const snapped = snapToNearest(raw);
    if (snapped === this.currentSpeed) return;
    this.currentSpeed = snapped;
    this.redraw();
    this.onChange(snapped);
  }

  private speedToX(speed: number): number {
    const t = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    return this.trackX + t * this.trackW;
  }

  private redraw(): void {
    const handleX = this.speedToX(this.currentSpeed);
    const trackH = 6;

    // Fill
    this.trackFill.clear();
    this.trackFill.fillStyle(0x00bcd4, 0.85);
    this.trackFill.fillRoundedRect(
      this.trackX,
      this.trackY - trackH / 2,
      Math.max(0, handleX - this.trackX),
      trackH,
      3,
    );

    // Handle
    this.handle.clear();
    this.handle.fillStyle(0x00e5ff, 1);
    this.handle.fillCircle(handleX, this.trackY, 8);
    this.handle.lineStyle(2, 0x003344, 1);
    this.handle.strokeCircle(handleX, this.trackY, 8);

    // Label
    this.label.setText(formatSpeed(this.currentSpeed));
  }

  /** External update if speed is changed elsewhere (e.g. on resume/load) */
  public setSpeed(speed: number): void {
    const snapped = clampSnap(speed);
    if (snapped === this.currentSpeed) return;
    this.currentSpeed = snapped;
    this.redraw();
  }

  public getSpeed(): number {
    return this.currentSpeed;
  }
}

function snapToNearest(raw: number): number {
  let best = SNAP_VALUES[0] as number;
  let bestDist = Math.abs(raw - best);
  for (const v of SNAP_VALUES) {
    const d = Math.abs(raw - v);
    if (d < bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best;
}

function clampSnap(speed: number): number {
  return snapToNearest(Phaser.Math.Clamp(speed, MIN_SPEED, MAX_SPEED));
}

function formatSpeed(speed: number): string {
  return Number.isInteger(speed) ? `${speed}.0x` : `${speed}x`;
}
