import Phaser from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { DebugManager } from '../debug/DebugManager';
import { createNewRun, setRun, hasActiveRun, clearRun, getRun } from '../state/RunState';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';

const PW  = 202;  // Panel width
const PH  = 600;  // Panel height
const FONT    = { fontFamily: 'monospace', fontSize: '10px' };
const FONT_SM = { fontFamily: 'monospace', fontSize: '9px' };

const C_TITLE = '#ffff44';
const C_DIM   = '#888888';
const C_TEXT  = '#cccccc';
const C_HL    = '#ffffff';
const C_GREEN = '#66ff66';
const C_RED   = '#ff6666';
const C_BLUE  = '#88ccff';

const SKIP_SCENES = new Set<string>([
  SCENE_KEYS.DEBUG_OVERLAY,
  SCENE_KEYS.GLOBAL_SOUND,
  SCENE_KEYS.SPEED_PANEL,
  'debug-listener',
]);

const RUN_REQUIRED = new Set<string>([
  SCENE_KEYS.GAME,
  SCENE_KEYS.COMBAT,
  SCENE_KEYS.SHOP,
  SCENE_KEYS.SHOP_REMOVE_CARD,
  SCENE_KEYS.PLANNING,
  SCENE_KEYS.BOSS_EXIT,
  SCENE_KEYS.DEATH,
  SCENE_KEYS.DECK_CUSTOMIZATION,
  SCENE_KEYS.RELIC_VIEWER,
  SCENE_KEYS.RUN_TRANSITION,
  SCENE_KEYS.LOOP_SUMMARY,
  SCENE_KEYS.STARTING_DECK,
  SCENE_KEYS.PAUSE,
  SCENE_KEYS.FORGE,
  SCENE_KEYS.BUILDING_PANEL,
  SCENE_KEYS.TAVERN_PANEL,
]);

const UNSAFE_SCENES = new Set<string>([
  // Sistema / infraestrutura
  SCENE_KEYS.BOOT,
  SCENE_KEYS.PRELOADER,
  SCENE_KEYS.GLOBAL_SOUND,
  SCENE_KEYS.SPEED_PANEL,
  SCENE_KEYS.DEBUG_OVERLAY,
  SCENE_KEYS.LIBRARY,
  'debug-listener',
  // Sub-cenas que exigem parâmetros obrigatórios no create/init
  SCENE_KEYS.BUILDING_PANEL,
  SCENE_KEYS.TAVERN_PANEL,
  SCENE_KEYS.BOSS_EXIT,
  SCENE_KEYS.PLANNING,
  SCENE_KEYS.LOOP_SUMMARY,
  SCENE_KEYS.RUN_TRANSITION,
  SCENE_KEYS.STARTING_DECK,
  SCENE_KEYS.COMBAT,
]);

export class DebugOverlayScene extends Phaser.Scene {
  private targetScene: Phaser.Scene | null = null;
  private currentSceneKey = '';
  private dragBtn!: Phaser.GameObjects.Text;
  private dragBg!: Phaser.GameObjects.Rectangle;
  private infoLines: Phaser.GameObjects.Text[] = [];
  private saveStatus!: Phaser.GameObjects.Text;

  private _panelSide: 'right' | 'left' = 'right';
  private _panelObjects: Phaser.GameObjects.GameObject[] = [];
  private _fontLine:  Phaser.GameObjects.Text | null = null;
  private _wrapLine:  Phaser.GameObjects.Text | null = null;
  private _colorLine: Phaser.GameObjects.Text | null = null;

  private get _px(): number { return this._panelSide === 'right' ? 598 : 0; }
  private get _tx(): number { return this._px + 6; }

  constructor() { super({ key: SCENE_KEYS.DEBUG_OVERLAY }); }

  create(): void {
    this.detectTarget();
    this.buildPanel();
    this.registerListeners();
  }

  update(): void {
    this.scene.bringToTop();
  }

  private _track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this._panelObjects.push(o);
    return o;
  }

  private detectTarget(): void {
    const found = this.scene.manager.scenes.find(
      s => (s.scene.isActive() || s.scene.isPaused()) && !SKIP_SCENES.has(s.scene.key)
    );
    this.targetScene = found ?? null;
    this.currentSceneKey = found?.scene.key ?? '?';
  }

  private buildPanel(): void {
    const px  = this._px;
    const tx  = this._tx;
    const mid = px + PW / 2;
    let y = 4;

    // Background + border
    this._track(this.add.rectangle(mid, PH / 2, PW, PH, 0x000000, 0.93).setScrollFactor(0));
    this._track(this.add.rectangle(mid, PH / 2, PW, PH, 0x000000, 0)
      .setScrollFactor(0).setInteractive());
    this._track(this.add.graphics()
      .lineStyle(1, 0x555555).lineBetween(px, 0, px, PH)
      .setScrollFactor(0));

    // Title
    this._track(this.add.text(tx, y, '◉ DEBUG MODE', { ...FONT, fontSize: '12px', color: C_TITLE }).setScrollFactor(0));
    y += 16;
    this._track(this.add.text(tx, y, `cena: ${this.currentSceneKey}`, { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 13;
    this._sep(y); y += 6;

    // Scene list
    this._track(this.add.text(tx, y, 'TROCAR CENA:', { ...FONT_SM, color: C_TEXT }).setScrollFactor(0));
    y += 12;
    const sceneKeys = Object.values(SCENE_KEYS).filter(k => !UNSAFE_SCENES.has(k));
    sceneKeys.forEach(key => {
      const isCurrent = key === this.currentSceneKey;
      const needsRun  = RUN_REQUIRED.has(key);
      const prefix    = isCurrent ? '▶ ' : needsRun ? '! ' : '  ';
      const baseColor = isCurrent ? C_TITLE : needsRun ? '#ff8844' : C_DIM;
      const hoverColor = needsRun ? '#ffaa66' : C_HL;
      const btn = this._track(this.add.text(tx, y, prefix + key, {
        ...FONT_SM, color: baseColor,
      }).setScrollFactor(0).setInteractive({ useHandCursor: true }));
      btn.on('pointerover', () => btn.setColor(hoverColor));
      btn.on('pointerout',  () => btn.setColor(baseColor));
      btn.on('pointerdown', () => this.navigateTo(key));
      y += 11;
    });
    y += 2;
    this._sep(y); y += 6;

    // Drag toggle
    this.dragBg = this._track(this.add.rectangle(mid, y + 10, PW - 12, 20, 0x333333)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this.dragBtn = this._track(this.add.text(tx, y + 2, 'DRAG: OFF', { ...FONT, color: C_RED }).setScrollFactor(0));
    this.dragBg.on('pointerover', () => this.dragBg.setFillStyle(0x444444));
    this.dragBg.on('pointerout',  () => this.dragBg.setFillStyle(DebugManager.isDragEnabled ? 0x1a4a1a : 0x333333));
    this.dragBg.on('pointerdown', () => this.toggleDrag());
    y += 26;
    this._sep(y); y += 6;

    // Selected object info
    this._track(this.add.text(tx, y, 'SELECIONADO:', { ...FONT_SM, color: C_TEXT }).setScrollFactor(0));
    y += 12;
    const infoDefaults = ['tex: —', 'x: —   y: —', 'w: —   h: —', 'scl: —% (—)', 'depth: —', 'ctrl+drag ↕=size []=z ^Z'];
    this.infoLines = infoDefaults.map((txt, i) => {
      return this._track(this.add.text(tx, y + i * 11, txt, {
        ...FONT_SM,
        color: i === 5 ? C_DIM : C_TEXT,
      }).setScrollFactor(0));
    });
    y += infoDefaults.length * 11 + 4;
    this._sep(y); y += 6;

    // Resize buttons — [-5%] and [+5%]
    const bw  = Math.floor((PW - 16) / 2);
    const b1cx = px + 7 + bw / 2;
    const b2cx = px + PW - 7 - bw / 2;

    const szMinBg = this._track(this.add.rectangle(b1cx, y + 10, bw, 20, 0x2a2a00)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(b1cx, y + 10, '− 5%', { ...FONT, color: '#ffdd88' }).setScrollFactor(0).setOrigin(0.5));
    szMinBg.on('pointerover', () => szMinBg.setFillStyle(0x4a4a00));
    szMinBg.on('pointerout',  () => szMinBg.setFillStyle(0x2a2a00));
    szMinBg.on('pointerdown', () => DebugManager.resizeSelected(-5));

    const szPlusBg = this._track(this.add.rectangle(b2cx, y + 10, bw, 20, 0x002a00)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(b2cx, y + 10, '+ 5%', { ...FONT, color: '#88ff88' }).setScrollFactor(0).setOrigin(0.5));
    szPlusBg.on('pointerover', () => szPlusBg.setFillStyle(0x004a00));
    szPlusBg.on('pointerout',  () => szPlusBg.setFillStyle(0x002a00));
    szPlusBg.on('pointerdown', () => DebugManager.resizeSelected(5));

    y += 26;
    this._sep(y); y += 6;

    // Text controls (font size + word wrap)
    this._track(this.add.text(tx, y, 'TEXTO:', { ...FONT_SM, color: C_TEXT }).setScrollFactor(0));
    y += 12;

    const bwHalf = Math.floor((PW - 16) / 2);
    const fMinCx = px + 7 + bwHalf / 2;
    const fMaxCx = px + PW - 7 - bwHalf / 2;

    this._fontLine = this._track(this.add.text(tx, y, 'font: —', { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 12;
    const fMinBg = this._track(this.add.rectangle(fMinCx, y + 10, bwHalf, 18, 0x2a2a00)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(fMinCx, y + 10, '− 2px', { ...FONT_SM, color: '#ffdd88' }).setScrollFactor(0).setOrigin(0.5));
    fMinBg.on('pointerover', () => fMinBg.setFillStyle(0x4a4a00));
    fMinBg.on('pointerout',  () => fMinBg.setFillStyle(0x2a2a00));
    fMinBg.on('pointerdown', () => DebugManager.adjustFontSize(-2));
    const fPlusBg = this._track(this.add.rectangle(fMaxCx, y + 10, bwHalf, 18, 0x002a00)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(fMaxCx, y + 10, '+ 2px', { ...FONT_SM, color: '#88ff88' }).setScrollFactor(0).setOrigin(0.5));
    fPlusBg.on('pointerover', () => fPlusBg.setFillStyle(0x004a00));
    fPlusBg.on('pointerout',  () => fPlusBg.setFillStyle(0x002a00));
    fPlusBg.on('pointerdown', () => DebugManager.adjustFontSize(2));
    y += 22;

    this._wrapLine = this._track(this.add.text(tx, y, 'wrap: —', { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 12;
    const wMinBg = this._track(this.add.rectangle(fMinCx, y + 10, bwHalf, 18, 0x2a2a00)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(fMinCx, y + 10, '− 20px', { ...FONT_SM, color: '#ffdd88' }).setScrollFactor(0).setOrigin(0.5));
    wMinBg.on('pointerover', () => wMinBg.setFillStyle(0x4a4a00));
    wMinBg.on('pointerout',  () => wMinBg.setFillStyle(0x2a2a00));
    wMinBg.on('pointerdown', () => DebugManager.adjustWordWrap(-20));
    const wPlusBg = this._track(this.add.rectangle(fMaxCx, y + 10, bwHalf, 18, 0x002a00)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(fMaxCx, y + 10, '+ 20px', { ...FONT_SM, color: '#88ff88' }).setScrollFactor(0).setOrigin(0.5));
    wPlusBg.on('pointerover', () => wPlusBg.setFillStyle(0x004a00));
    wPlusBg.on('pointerout',  () => wPlusBg.setFillStyle(0x002a00));
    wPlusBg.on('pointerdown', () => DebugManager.adjustWordWrap(20));
    y += 22;

    // Color palette
    this._colorLine = this._track(this.add.text(tx, y, 'cor: —', { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 12;
    const COLORS: { hex: string; fill: number }[] = [
      { hex: '#ffffff', fill: 0xffffff },
      { hex: '#ffff44', fill: 0xffff44 },
      { hex: '#ffcc44', fill: 0xffcc44 },
      { hex: '#ff8844', fill: 0xff8844 },
      { hex: '#ff6666', fill: 0xff6666 },
      { hex: '#ff44aa', fill: 0xff44aa },
      { hex: '#cc88ff', fill: 0xcc88ff },
      { hex: '#88ccff', fill: 0x88ccff },
      { hex: '#66ff66', fill: 0x66ff66 },
      { hex: '#888888', fill: 0x888888 },
    ];
    const swSize = Math.floor((PW - 12) / COLORS.length);
    COLORS.forEach(({ hex, fill }, i) => {
      const cx = px + 6 + swSize * i + swSize / 2;
      const sw = this._track(this.add.rectangle(cx, y + 7, swSize - 2, 12, fill)
        .setScrollFactor(0).setInteractive({ useHandCursor: true }));
      sw.on('pointerdown', () => DebugManager.setFontColor(hex));
    });
    y += 20;
    this._sep(y); y += 6;

    // Save log button
    const saveBg = this._track(this.add.rectangle(mid, y + 10, PW - 12, 20, 0x1a3a5a)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(tx, y + 2, 'SALVAR LOG', { ...FONT, color: C_BLUE }).setScrollFactor(0));
    this.saveStatus = this._track(this.add.text(tx + 82, y + 2, '', { ...FONT_SM, color: C_GREEN }).setScrollFactor(0));
    saveBg.on('pointerover', () => saveBg.setFillStyle(0x224466));
    saveBg.on('pointerout',  () => saveBg.setFillStyle(0x1a3a5a));
    saveBg.on('pointerdown', () => this.saveLog());
    y += 26;

    // Clear run button
    const clearBg = this._track(this.add.rectangle(mid, y + 10, PW - 12, 20, 0x4a3a00)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(tx, y + 2, 'LIMPAR RUN', { ...FONT, color: '#ffcc44' }).setScrollFactor(0));
    clearBg.on('pointerover', () => clearBg.setFillStyle(0x6a5a00));
    clearBg.on('pointerout',  () => clearBg.setFillStyle(0x4a3a00));
    clearBg.on('pointerdown', () => this.resetRun());
    y += 26;

    // Cheat resources button
    const cheatBg = this._track(this.add.rectangle(mid, y + 10, PW - 12, 20, 0x1a3a1a)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(tx, y + 2, 'DAR RECURSOS', { ...FONT, color: C_GREEN }).setScrollFactor(0));
    cheatBg.on('pointerover', () => cheatBg.setFillStyle(0x2a5a2a));
    cheatBg.on('pointerout',  () => cheatBg.setFillStyle(0x1a3a1a));
    cheatBg.on('pointerdown', () => this.giveCheatResources());
    y += 26;

    // Close button
    const closeBg = this._track(this.add.rectangle(mid, y + 10, PW - 12, 20, 0x4a1a1a)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(tx, y + 2, 'FECHAR  [F2]', { ...FONT, color: C_RED }).setScrollFactor(0));
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x6a2a2a));
    closeBg.on('pointerout',  () => closeBg.setFillStyle(0x4a1a1a));
    closeBg.on('pointerdown', () => this.close());
    y += 26;

    // Panel side toggle
    const toggleLabel = this._panelSide === 'right' ? '◀ ESQUERDA' : 'DIREITA ▶';
    const toggleBg = this._track(this.add.rectangle(mid, y + 10, PW - 12, 20, 0x1a1a3a)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(mid, y + 10, toggleLabel, { ...FONT, color: '#aaaaff' })
      .setScrollFactor(0).setOrigin(0.5));
    toggleBg.on('pointerover', () => toggleBg.setFillStyle(0x2a2a5a));
    toggleBg.on('pointerout',  () => toggleBg.setFillStyle(0x1a1a3a));
    toggleBg.on('pointerdown', () => {
      this._panelSide = this._panelSide === 'right' ? 'left' : 'right';
      this._rebuildPanel();
    });
  }

  private _sep(y: number): void {
    this._track(this.add.graphics()
      .lineStyle(1, 0x444444, 0.8)
      .lineBetween(this._px + 4, y, this._px + PW - 4, y)
      .setScrollFactor(0));
  }

  private _destroyPanel(): void {
    this._panelObjects.forEach(o => o.destroy());
    this._panelObjects = [];
    this.infoLines = [];
    this._fontLine  = null;
    this._wrapLine  = null;
    this._colorLine = null;
  }

  private _rebuildPanel(): void {
    this._destroyPanel();
    this.buildPanel();
  }

  private registerListeners(): void {
    this.input.on('wheel', (_p: any, _objs: any, _dx: number, dy: number) => {
      DebugManager.resizeSelected(dy > 0 ? -2 : 2);
    });

    this.input.keyboard?.on('keydown-Z', (e: KeyboardEvent) => {
      if (e.ctrlKey) { e.preventDefault(); DebugManager.undo(); }
    });

    this.input.keyboard?.on('keydown-OPEN_BRACKET',   () => DebugManager.changeDepth(-1));
    this.input.keyboard?.on('keydown-CLOSED_BRACKET', () => DebugManager.changeDepth(+1));

    this.game.events.on('debug:update', (record: any) => this.refreshInfo(record), this);
  }

  private toggleDrag(): void {
    if (!this.targetScene) return;
    if (DebugManager.isDragEnabled) {
      DebugManager.removeDrag(this.targetScene);
      this.dragBtn.setText('DRAG: OFF').setColor(C_RED);
      this.dragBg.setFillStyle(0x333333);
    } else {
      DebugManager.injectDrag(this.targetScene, this);
      this.dragBtn.setText('DRAG: ON ').setColor(C_GREEN);
      this.dragBg.setFillStyle(0x1a4a1a);
    }
  }

  private refreshInfo(record: any): void {
    if (!record || this.infoLines.length === 0) return;
    this.infoLines[0].setText(`tex: ${record.textureKey}`);
    this.infoLines[1].setText(`x:${record.x}  y:${record.y}`);
    this.infoLines[2].setText(`w:${record.displayWidth}  h:${record.displayHeight}`);
    this.infoLines[3].setText(`scl: ${Math.round(record.scaleX * 100)}% (${record.scaleX})`);
    this.infoLines[4].setText(`depth: ${record.depth}`);

    if (this._fontLine) {
      if (record.isText && record.fontSize !== undefined) {
        this._fontLine.setText(`font: ${Math.round(record.fontSize)}px`).setColor(C_TEXT);
      } else {
        this._fontLine.setText('font: —').setColor(C_DIM);
      }
    }
    if (this._wrapLine) {
      if (record.isText && record.wrapWidth !== undefined) {
        this._wrapLine.setText(`wrap: ${record.wrapWidth}px`).setColor(C_TEXT);
      } else {
        this._wrapLine.setText('wrap: —').setColor(C_DIM);
      }
    }
    if (this._colorLine) {
      if (record.isText && record.fontColor !== undefined) {
        this._colorLine.setText(`cor: ${record.fontColor}`).setColor(record.fontColor);
      } else {
        this._colorLine.setText('cor: —').setColor(C_DIM);
      }
    }
  }

  private navigateTo(key: string): void {
    if (RUN_REQUIRED.has(key) && !hasActiveRun()) {
      setRun(createNewRun());
      this.saveStatus.setText('run criada!');
    }
    if (this.targetScene && DebugManager.isDragEnabled) {
      DebugManager.removeDrag(this.targetScene);
    }
    this.game.events.off('debug:update', undefined, this);
    this.stopAllScenes();
    this.scene.start(key, { parentScene: SCENE_KEYS.CITY_HUB });
  }

  private stopAllScenes(): void {
    const KEEP = new Set<string>(['debug-listener', SCENE_KEYS.GLOBAL_SOUND, SCENE_KEYS.SPEED_PANEL]);
    for (const s of this.scene.manager.scenes) {
      const k = s.sys.settings.key;
      if (KEEP.has(k)) continue;
      if (this.scene.isActive(k) || this.scene.isSleeping(k) || this.scene.isPaused(k)) {
        this.scene.stop(k);
      }
    }
  }

  private async saveLog(): Promise<void> {
    const log = DebugManager.generateLog(this.currentSceneKey);
    try {
      const res = await fetch('/debug-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: log,
      });
      if (res.ok) {
        this.saveStatus.setText('✓ /debug-layout.json');
        this.time.delayedCall(3500, () => this.saveStatus?.setText(''));
      } else {
        this.saveStatus.setText(`erro ${res.status}`);
      }
    } catch {
      this.saveStatus.setText('fetch falhou');
    }
  }

  private async giveCheatResources(): Promise<void> {
    const ELEMENTS = ['attack', 'defense', 'agility', 'counter', 'fire', 'earth', 'air', 'water'];
    const MATERIALS = ['wood', 'stone', 'iron', 'crystal', 'bone', 'herbs', 'essence'];

    // Gold + shards/elements na run ativa
    if (hasActiveRun()) {
      const run = getRun();
      run.economy.gold += 100;
      if (!run.economy.elements) run.economy.elements = {};
      for (const el of ELEMENTS) {
        run.economy.elements[el] = (run.economy.elements[el] ?? 0) + 10;
      }
    }

    // Materiais no MetaState (para buildings da cidade)
    try {
      const meta = await loadMetaState();
      for (const mat of MATERIALS) {
        meta.materials[mat] = (meta.materials[mat] ?? 0) + 50;
      }
      await saveMetaState(meta);
      this.saveStatus.setText('✓ recursos!');
      this.time.delayedCall(2500, () => this.saveStatus?.setText(''));
    } catch {
      this.saveStatus.setText('erro meta');
    }
  }

  private resetRun(): void {
    clearRun();
    if (this.targetScene && DebugManager.isDragEnabled) {
      DebugManager.removeDrag(this.targetScene);
    }
    this.game.events.off('debug:update', undefined, this);
    this.stopAllScenes();
    this.scene.start(SCENE_KEYS.CITY_HUB);
  }

  private close(): void {
    if (this.targetScene && DebugManager.isDragEnabled) {
      DebugManager.removeDrag(this.targetScene);
    }
    this.game.events.off('debug:update', undefined, this);
    this.scene.stop(SCENE_KEYS.DEBUG_OVERLAY);
  }
}
