// DailyTickerPanel — right-side overlay that lists live Daily Run progress
// from other players. Pure Phaser display module; all data comes from
// DailyRunTicker. Toggle visibility with the 'T' key.

import Phaser from 'phaser';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import { dailyRunTicker } from '../systems/DailyRunTicker';
import { utcDateString } from '../systems/DailySeed';
import { mqttClient, type MqttStatus } from '../systems/MqttClient';
import type { DailyRunUpdate } from '../systems/DailyRunBroadcaster';

const MAX_ROWS = 8;
const PANEL_WIDTH = 200;
const PANEL_HEIGHT = 240;
const PANEL_MARGIN = 8;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 36;
const TOGGLE_KEY = 'T';

const STATUS_COLOR: Record<MqttStatus, string> = {
  idle: '#888888',
  connecting: '#ffcc44',
  reconnecting: '#ffaa00',
  connected: '#44ff88',
  failed: '#ff4444',
};

const STATUS_LABEL: Record<MqttStatus, string> = {
  idle: 'idle',
  connecting: 'connecting…',
  reconnecting: 'reconnecting…',
  connected: 'live',
  failed: 'offline',
};

export interface DailyTickerPanelOptions {
  selfRunId: string;
  /** Pixel x for the panel's top-right corner. Defaults to canvas width. */
  rightX?: number;
  /** Pixel y for the panel's top-right corner. Defaults to small margin. */
  topY?: number;
}

export class DailyTickerPanel {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private headerTxt: Phaser.GameObjects.Text;
  private statusTxt: Phaser.GameObjects.Text;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private emptyTxt: Phaser.GameObjects.Text;
  private toggleKey: Phaser.Input.Keyboard.Key | null = null;
  private unsubscribeTicker: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private visibleState = true;
  private destroyed = false;

  constructor(scene: Phaser.Scene, private opts: DailyTickerPanelOptions) {
    const rightX = opts.rightX ?? LAYOUT.canvasWidth - PANEL_MARGIN;
    const topY = opts.topY ?? PANEL_MARGIN;
    const x = rightX - PANEL_WIDTH;
    const y = topY;

    this.container = scene.add.container(x, y).setDepth(900);

    this.bg = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.65)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x666666, 0.8);
    this.container.add(this.bg);

    this.headerTxt = scene.add.text(8, 6, `DAILY ${utcDateString()}`, {
      fontFamily: FONTS.body,
      fontSize: '12px',
      fontStyle: 'bold',
      color: COLORS.accent,
    });
    this.container.add(this.headerTxt);

    this.statusTxt = scene.add.text(8, 22, '', {
      fontFamily: FONTS.body,
      fontSize: '10px',
      color: STATUS_COLOR[mqttClient.getStatus()],
    });
    this.applyStatus(mqttClient.getStatus());
    this.container.add(this.statusTxt);

    // Pre-allocate row text objects — repaint reuses them so we don't churn
    // garbage on every ticker update.
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = scene.add.text(8, HEADER_HEIGHT + i * ROW_HEIGHT, '', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: COLORS.textPrimary,
      });
      this.rowTexts.push(row);
      this.container.add(row);
    }

    this.emptyTxt = scene.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, 'waiting for racers…', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: COLORS.textSecondary,
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.emptyTxt);

    // T toggles visibility. Guard against Phaser scene shutdown wiping the
    // keyboard plugin before we tear ourselves down.
    if (scene.input?.keyboard) {
      this.toggleKey = scene.input.keyboard.addKey(TOGGLE_KEY);
      this.toggleKey.on('down', () => this.toggleVisibility());
    }

    this.unsubscribeTicker = dailyRunTicker.onChange(() => this.refresh());
    this.unsubscribeStatus = mqttClient.onStatusChange((s) => this.applyStatus(s));
    this.refresh();

    // Auto-destroy when the host scene shuts down — caller doesn't need to
    // remember to call destroy() in every shutdown handler.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  private applyStatus(status: MqttStatus): void {
    if (this.destroyed) return;
    this.statusTxt.setText(STATUS_LABEL[status]);
    this.statusTxt.setColor(STATUS_COLOR[status]);
  }

  private refresh(): void {
    if (this.destroyed) return;
    const snapshot = dailyRunTicker.getSnapshot().slice(0, MAX_ROWS);
    this.emptyTxt.setVisible(snapshot.length === 0);
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.rowTexts[i];
      const update = snapshot[i];
      if (!update) {
        row.setText('');
        continue;
      }
      row.setText(formatRow(update, update.runId === this.opts.selfRunId));
      row.setColor(rowColor(update, update.runId === this.opts.selfRunId));
    }
  }

  toggleVisibility(): void {
    this.visibleState = !this.visibleState;
    this.container.setVisible(this.visibleState);
  }

  setVisible(v: boolean): void {
    this.visibleState = v;
    this.container.setVisible(v);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.unsubscribeTicker) { this.unsubscribeTicker(); this.unsubscribeTicker = null; }
    if (this.unsubscribeStatus) { this.unsubscribeStatus(); this.unsubscribeStatus = null; }
    if (this.toggleKey) {
      this.toggleKey.removeAllListeners();
      this.toggleKey = null;
    }
    this.container.destroy(true);
  }
}

function formatRow(u: DailyRunUpdate, isSelf: boolean): string {
  const prefix = isSelf ? '★ ' : '  ';
  const name = (u.nickname || 'anon').slice(0, 10).padEnd(10, ' ');
  const wave = `W${u.wave}`.padStart(3, ' ');
  const hp = u.alive ? `${Math.round(u.hpPct * 100)}%`.padStart(4, ' ') : '  --';
  return `${prefix}${name} ${wave} ${hp}`;
}

function rowColor(u: DailyRunUpdate, isSelf: boolean): string {
  if (isSelf) return COLORS.accent;
  if (!u.alive) return '#888888';
  return COLORS.textPrimary;
}
