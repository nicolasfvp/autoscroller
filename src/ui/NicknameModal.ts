// NicknameModal — inline overlay for capturing/editing the Daily Run nickname.
// Used on MainMenu before starting a daily run. Pure UI; persistence is
// handled by the caller via DailySeed.setStoredNickname().

import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import { t } from '../i18n/i18n';

const MAX_LEN = 16;
const VALID_CHARS = /^[a-zA-Z0-9_\-]$/;

export interface NicknameModalOptions {
  initialValue: string;
  title?: string;
  onConfirm: (nickname: string) => void;
  onCancel?: () => void;
}

export class NicknameModal {
  private container: Phaser.GameObjects.Container;
  private inputText: Phaser.GameObjects.Text;
  private caretText: Phaser.GameObjects.Text;
  private value: string;
  private caretTween: Phaser.Tweens.Tween | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;
  private destroyed = false;
  private destroyedCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene, private opts: NicknameModalOptions) {
    this.value = (opts.initialValue || '').slice(0, MAX_LEN);

    this.container = scene.add.container(0, 0).setDepth(1000);

    const dim = scene.add.rectangle(LAYOUT.centerX, LAYOUT.centerY, LAYOUT.canvasWidth, LAYOUT.canvasHeight, 0x000000, 0.75)
      .setInteractive(); // swallow clicks
    this.container.add(dim);

    const panelScaleX = 0.24;        // largura original ~338px
    const panelScaleY = 0.192;       // altura −20% ~203px
    const panelW = Math.round(1408 * panelScaleX);
    const panelH = Math.round(1056 * panelScaleY);
    const panelCY = LAYOUT.centerY + 20;

    // Background panel — scaleX mantém largura, scaleY reduz altura −20%
    if (scene.textures.exists('panel_daily_run')) {
      const panelImg = scene.add.image(LAYOUT.centerX, panelCY, 'panel_daily_run').setOrigin(0.5).setScale(panelScaleX, panelScaleY);
      this.container.add(panelImg);
    } else {
      const panel = scene.add.rectangle(LAYOUT.centerX, panelCY, panelW, panelH, 0x1a1a2e, 0.95)
        .setStrokeStyle(2, 0xffd700, 0.9);
      this.container.add(panel);
    }

    // Daily Run description banner — gap aumentado para não ficar colado
    if (scene.textures.exists('txt_daily_run_desc')) {
      const descImg = scene.add.image(LAYOUT.centerX, panelCY - panelH / 2 - 46, 'txt_daily_run_desc').setOrigin(0.5).setScale(0.19);
      this.container.add(descImg);
    }

    const hint = scene.add.text(LAYOUT.centerX, panelCY - 60, t('nickname.hint', { max: MAX_LEN }), {
      fontFamily: FONTS.body,
      fontSize: '16px',
      color: COLORS.textSecondary,
    }).setOrigin(0.5);
    this.container.add(hint);

    // Input box bg
    const inputBg = scene.add.rectangle(LAYOUT.centerX, panelCY - 10, 300, 34, 0x000000, 0.6)
      .setStrokeStyle(1, 0xffd700, 0.7);
    this.container.add(inputBg);

    this.inputText = scene.add.text(LAYOUT.centerX - 140, panelCY - 10, this.value, {
      fontFamily: FONTS.body,
      fontSize: '18px',
      color: COLORS.textPrimary,
    }).setOrigin(0, 0.5);
    this.container.add(this.inputText);

    this.caretText = scene.add.text(0, panelCY - 10, '|', {
      fontFamily: FONTS.body,
      fontSize: '18px',
      color: COLORS.textPrimary,
    }).setOrigin(0, 0.5);
    this.container.add(this.caretText);
    this.repositionCaret();
    this.caretTween = scene.tweens.add({
      targets: this.caretText,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Confirm + cancel buttons
    const confirmBtn = makeBtn(scene, LAYOUT.centerX - 80, panelCY + 45, t('nickname.start'), () => this.confirm());
    this.container.add(confirmBtn);
    const cancelBtn = makeBtn(scene, LAYOUT.centerX + 80, panelCY + 45, t('nickname.cancel'), () => this.cancel());
    this.container.add(cancelBtn);

    // Browser-level keydown so we capture typing reliably; Phaser's keyboard
    // events are good for keyboard codes but not for IME or symbol keys.
    this.keyHandler = (event: KeyboardEvent) => this.onKey(event);
    window.addEventListener('keydown', this.keyHandler, true);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Optional hook fired when the modal tears itself down. Used by callers to clear re-entry guards. */
  onDestroy(fn: () => void): void {
    this.destroyedCallback = fn;
  }

  private onKey(event: KeyboardEvent): void {
    if (this.destroyed) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirm();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.value = this.value.slice(0, -1);
      this.repaint();
      return;
    }
    if (event.key.length === 1 && VALID_CHARS.test(event.key) && this.value.length < MAX_LEN) {
      event.preventDefault();
      this.value += event.key;
      this.repaint();
    }
  }

  private repaint(): void {
    this.inputText.setText(this.value);
    this.repositionCaret();
  }

  private repositionCaret(): void {
    const right = this.inputText.x + this.inputText.width;
    this.caretText.setX(right + 2);
  }

  private confirm(): void {
    const trimmed = this.value.trim().slice(0, MAX_LEN);
    if (trimmed.length === 0) return; // ignore empty confirm; user can cancel for that
    const cb = this.opts.onConfirm;
    this.destroy();
    cb(trimmed);
  }

  private cancel(): void {
    const cb = this.opts.onCancel;
    this.destroy();
    if (cb) cb();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    if (this.caretTween) {
      this.caretTween.remove();
      this.caretTween = null;
    }
    this.container.destroy(true);
    if (this.destroyedCallback) {
      const cb = this.destroyedCallback;
      this.destroyedCallback = null;
      try { cb(); } catch (err) { console.warn('[NicknameModal] destroy callback error:', err); }
    }
  }
}

function makeBtn(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, 140, 36, 0x222244, 0.9).setStrokeStyle(1, 0xffd700, 0.8);
  bg.setInteractive({ useHandCursor: true });
  c.add(bg);
  const text = scene.add.text(0, 0, label, {
    fontFamily: FONTS.body,
    fontSize: '16px',
    fontStyle: 'bold',
    color: COLORS.accent,
  }).setOrigin(0.5);
  c.add(text);
  bg.on('pointerover', () => bg.setFillStyle(0x333366, 0.9));
  bg.on('pointerout', () => bg.setFillStyle(0x222244, 0.9));
  bg.on('pointerdown', () => onClick());
  return c;
}
