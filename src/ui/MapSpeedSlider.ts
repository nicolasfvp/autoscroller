import Phaser from 'phaser';
import { FONTS } from './StyleConstants';

const SNAP_VALUES = [0.5, 1, 1.5, 2, 3] as const;
const MIN_SPEED = SNAP_VALUES[0];
const MAX_SPEED = SNAP_VALUES[SNAP_VALUES.length - 1];

export class MapSpeedSlider extends Phaser.GameObjects.Container {
  private readonly trackBg!: Phaser.GameObjects.Graphics;
  private readonly trackFill!: Phaser.GameObjects.Graphics;
  private readonly handle!: Phaser.GameObjects.Graphics;
  private readonly label!: Phaser.GameObjects.Text;
  private readonly titleText!: Phaser.GameObjects.Text;
  private readonly tickGraphics!: Phaser.GameObjects.Graphics;

  private readonly trackX: number;
  private readonly trackY: number;
  private readonly trackW: number;

  private currentSpeed: number;
  private readonly onChange: (speed: number) => void;

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
    this.setScrollFactor(0).setDepth(150);

    this.currentSpeed = clampSnap(initialSpeed);
    this.onChange = onChange;

    const s = scale;
    const trackW = Math.round(180 * s);
    const trackH = Math.max(3, Math.round(6 * s));
    const handleR = Math.max(3, Math.round(8 * s));
    this.trackW = trackW;
    this.trackX = centerX - trackW / 2;
    this.trackY = centerY;

    // Title label
    this.titleText = scene.add.text(centerX, centerY - Math.round(13 * s), title, {
      fontFamily: FONTS.family,
      fontSize: `${Math.max(9, Math.round(11 * s))}px`,
      fontStyle: 'bold',
      color: '#cccccc',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(150);
    this.add(this.titleText);

    // Track background
    this.trackBg = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.trackBg.fillStyle(0x000000, 0.55);
    this.trackBg.fillRoundedRect(this.trackX, this.trackY - trackH / 2, trackW, trackH, 2);
    this.trackBg.lineStyle(1, 0x666666, 0.8);
    this.trackBg.strokeRoundedRect(this.trackX, this.trackY - trackH / 2, trackW, trackH, 2);
    this.add(this.trackBg);

    // Tick marks
    this.tickGraphics = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.tickGraphics.fillStyle(0xaaaaaa, 0.7);
    const tickH = Math.max(4, Math.round(12 * s));
    for (const v of SNAP_VALUES) {
      const tx = this.speedToX(v);
      this.tickGraphics.fillRect(tx - 1, this.trackY - tickH / 2, 2, tickH);
    }
    this.add(this.tickGraphics);

    // Track fill
    this.trackFill = scene.add.graphics().setScrollFactor(0).setDepth(150);
    this.add(this.trackFill);

    // Handle
    this.handle = scene.add.graphics().setScrollFactor(0).setDepth(151);
    this.add(this.handle);

    // Speed value label
    this.label = scene.add.text(this.trackX + trackW + Math.round(8 * s), this.trackY, formatSpeed(this.currentSpeed), {
      fontFamily: FONTS.family,
      fontSize: `${Math.max(10, Math.round(14 * s))}px`,
      fontStyle: 'bold',
      color: '#00e5ff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(150);
    this.add(this.label);

    // Hit zone
    const hitZone = scene.add.zone(centerX, centerY, trackW + Math.round(24 * s), Math.round(28 * s))
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

    this.redraw(handleR, trackH);
    this._handleR = handleR;
    this._trackH = trackH;
  }

  private readonly _handleR: number = 8;
  private readonly _trackH: number = 6;

  private applyPointerX(pointerX: number): void {
    const t = Phaser.Math.Clamp((pointerX - this.trackX) / this.trackW, 0, 1);
    const raw = MIN_SPEED + t * (MAX_SPEED - MIN_SPEED);
    const snapped = snapToNearest(raw);
    if (snapped === this.currentSpeed) return;
    this.currentSpeed = snapped;
    this.redraw(this._handleR, this._trackH);
    this.onChange(snapped);
  }

  private speedToX(speed: number): number {
    const t = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    return this.trackX + t * this.trackW;
  }

  private redraw(handleR: number, trackH: number): void {
    const handleX = this.speedToX(this.currentSpeed);

    this.trackFill.clear();
    this.trackFill.fillStyle(0x00bcd4, 0.85);
    this.trackFill.fillRoundedRect(
      this.trackX,
      this.trackY - trackH / 2,
      Math.max(0, handleX - this.trackX),
      trackH,
      2,
    );

    this.handle.clear();
    this.handle.fillStyle(0x00e5ff, 1);
    this.handle.fillCircle(handleX, this.trackY, handleR);
    this.handle.lineStyle(1.5, 0x003344, 1);
    this.handle.strokeCircle(handleX, this.trackY, handleR);

    this.label.setText(formatSpeed(this.currentSpeed));
  }

  public setSpeed(speed: number): void {
    const snapped = clampSnap(speed);
    if (snapped === this.currentSpeed) return;
    this.currentSpeed = snapped;
    this.redraw(this._handleR, this._trackH);
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
    if (d < bestDist) { best = v; bestDist = d; }
  }
  return best;
}

function clampSnap(speed: number): number {
  return snapToNearest(Phaser.Math.Clamp(speed, MIN_SPEED, MAX_SPEED));
}

function formatSpeed(speed: number): string {
  return Number.isInteger(speed) ? `${speed}.0x` : `${speed}x`;
}
