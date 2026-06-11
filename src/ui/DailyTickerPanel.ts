// DailyTickerPanel — right-side overlay that lists live Daily Run progress
// from other players. Pure Phaser display module; all data comes from
// DailyRunTicker. Toggle visibility with the 'T' key.

import Phaser from 'phaser';
import { t } from '../i18n/i18n';
import { COLORS, FONTS, LAYOUT } from './StyleConstants';
import { dailyRunTicker } from '../systems/DailyRunTicker';
import { utcDateString } from '../systems/DailySeed';
import { mqttClient, type MqttStatus } from '../systems/MqttClient';
import type { DailyRunUpdate } from '../systems/DailyRunBroadcaster';

const MAX_ROWS = 8;
const PANEL_WIDTH = 210;
const PANEL_MARGIN = 8;
const PAD_X = 12;       // horizontal padding inside panel
const PAD_TOP = 10;     // padding top
const PAD_BOTTOM = 10;  // padding bottom
const ROW_HEIGHT = 17;
const HEADER_HEIGHT = 38;
const TOGGLE_KEY = 'T';

function calcPanelHeight(rowCount: number): number {
  const rows = Math.max(1, rowCount);
  return PAD_TOP + HEADER_HEIGHT + rows * ROW_HEIGHT + PAD_BOTTOM;
}

const STATUS_COLOR: Record<MqttStatus, string> = {
  idle: '#888888',
  connecting: '#ffcc44',
  reconnecting: '#ffaa00',
  connected: '#44ff88',
  failed: '#ff4444',
};

const STATUS_LABEL: Record<MqttStatus, string> = {
  idle: t('dailyTicker.statusIdle'),
  connecting: t('dailyTicker.statusConnecting'),
  reconnecting: t('dailyTicker.statusReconnecting'),
  connected: t('dailyTicker.statusLive'),
  failed: t('dailyTicker.statusOffline'),
};

export interface DailyTickerPanelOptions {
  selfRunId: string;
  /** Pixel x for the panel's top-right corner. Defaults to canvas width. */
  rightX?: number;
  /** Pixel y for the panel's top-right corner. Defaults to small margin. */
  topY?: number;
  /** Pixel y the panel's *vertical center* should sit at. Overrides topY when
   *  set — the panel recenters around this line as its height changes, so it
   *  stays visually anchored (e.g. canvasHeight*0.75) instead of growing
   *  downward off-screen from a fixed top. */
  centerY?: number;
}

export class DailyTickerPanel {
  private container: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  private headerTxt!: Phaser.GameObjects.Text;
  private statusTxt!: Phaser.GameObjects.Text;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private emptyTxt!: Phaser.GameObjects.Text;
  private toggleKey: Phaser.Input.Keyboard.Key | null = null;
  private unsubscribeTicker: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private visibleState = true;
  private destroyed = false;
  private scene: Phaser.Scene;
  private panelX: number;
  private panelY: number;
  private useAsset: boolean;

  constructor(scene: Phaser.Scene, private opts: DailyTickerPanelOptions) {
    this.scene = scene;
    const rightX = opts.rightX ?? LAYOUT.canvasWidth - PANEL_MARGIN;
    const topY = opts.topY ?? PANEL_MARGIN;
    this.panelX = rightX - PANEL_WIDTH;
    this.panelY = topY;
    this.useAsset = scene.textures.exists('panel_daily_run');

    // scrollFactor(0) pins the panel to the camera so it stays fixed in the
    // top-right corner instead of scrolling away with the world map (GameScene
    // follows the hero, so world-anchored HUD would drift off-screen).
    this.container = scene.add.container(this.panelX, this.panelY)
      .setScrollFactor(0)
      .setDepth(900);

    // Pre-allocate row text objects
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = scene.add.text(PAD_X, 0, '', {
        fontFamily: FONTS.body,
        fontSize: '11px',
        color: COLORS.textPrimary,
      });
      this.rowTexts.push(row);
      this.container.add(row);
    }

    this.emptyTxt = scene.add.text(PANEL_WIDTH / 2, 0, t('dailyTicker.waitingForRacers'), {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: COLORS.textSecondary,
      align: 'center',
      wordWrap: { width: PANEL_WIDTH - PAD_X * 2 },
    }).setOrigin(0.5, 0);
    this.container.add(this.emptyTxt);

    if (scene.input?.keyboard) {
      this.toggleKey = scene.input.keyboard.addKey(TOGGLE_KEY);
      this.toggleKey.on('down', () => this.toggleVisibility());
    }

    this.unsubscribeTicker = dailyRunTicker.onChange(() => this.refresh());
    this.unsubscribeStatus = mqttClient.onStatusChange((s) => this.applyStatus(s));
    this.refresh();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  private buildPanel(panelH: number): void {
    if (this.bg) this.bg.destroy();
    if (this.headerTxt) this.headerTxt.destroy();
    if (this.statusTxt) this.statusTxt.destroy();

    if (this.useAsset) {
      this.bg = this.scene.add.image(0, 0, 'panel_daily_run')
        .setOrigin(0, 0)
        .setScale(PANEL_WIDTH / 1408, panelH / 1056);
    } else {
      this.bg = this.scene.add.rectangle(0, 0, PANEL_WIDTH, panelH, 0x000000, 0.72)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffd700, 0.6);
    }
    this.container.addAt(this.bg, 0);

    this.headerTxt = this.scene.add.text(PAD_X, PAD_TOP, t('dailyTicker.header', { date: utcDateString() }), {
      fontFamily: FONTS.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: COLORS.accent,
    });
    this.container.add(this.headerTxt);

    this.statusTxt = this.scene.add.text(PAD_X, PAD_TOP + 14, '', {
      fontFamily: FONTS.body,
      fontSize: '10px',
      color: STATUS_COLOR[mqttClient.getStatus()],
    });
    this.applyStatus(mqttClient.getStatus());
    this.container.add(this.statusTxt);
  }

  private applyStatus(status: MqttStatus): void {
    if (this.destroyed || !this.statusTxt) return;
    this.statusTxt.setText(STATUS_LABEL[status]);
    this.statusTxt.setColor(STATUS_COLOR[status]);
  }

  private refresh(): void {
    if (this.destroyed) return;
    const snapshot = dailyRunTicker.getSnapshot().slice(0, MAX_ROWS);
    const rowCount = Math.max(1, snapshot.length);
    const panelH = calcPanelHeight(rowCount);

    // When anchored by center, recenter the container vertically each refresh
    // so the panel stays centered on `centerY` as its height grows/shrinks.
    if (this.opts.centerY !== undefined) {
      this.container.setY(Math.round(this.opts.centerY - panelH / 2));
    }

    this.buildPanel(panelH);

    const isEmpty = snapshot.length === 0;
    this.emptyTxt.setVisible(isEmpty);
    if (isEmpty) {
      this.emptyTxt.setY(PAD_TOP + HEADER_HEIGHT + ROW_HEIGHT * 0.3);
    }

    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.rowTexts[i];
      const update = snapshot[i];
      if (!update) { row.setText(''); continue; }
      row.setY(PAD_TOP + HEADER_HEIGHT + i * ROW_HEIGHT);
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
  const name = (u.nickname || t('dailyTicker.anonName')).slice(0, 10).padEnd(10, ' ');
  const wave = `W${u.wave}`.padStart(3, ' ');
  const hp = u.alive ? `${Math.round(u.hpPct * 100)}%`.padStart(4, ' ') : '  --';
  return `${prefix}${name} ${wave} ${hp}`;
}

function rowColor(u: DailyRunUpdate, isSelf: boolean): string {
  if (isSelf) return COLORS.accent;
  if (!u.alive) return '#888888';
  return COLORS.textPrimary;
}
