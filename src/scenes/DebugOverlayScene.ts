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
  private readonly _modalObjects: Phaser.GameObjects.GameObject[] = [];

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
    // Pick the topmost active/paused scene (last in manager order = highest visual priority).
    // This ensures CombatScene is preferred over GameScene when both are active.
    const candidates = this.scene.manager.scenes.filter(
      s => (s.scene.isActive() || s.scene.isPaused()) && !SKIP_SCENES.has(s.scene.key)
    );
    const found = candidates[candidates.length - 1] ?? null;
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

    // Title + cena atual na mesma linha
    this._track(this.add.text(tx, y, '◉ DEBUG', { ...FONT, fontSize: '11px', color: C_TITLE }).setScrollFactor(0));
    this._track(this.add.text(tx + 52, y, this.currentSceneKey, { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 13;
    this._sep(y); y += 4;

    // Scene list — sem label, item height 10px
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
      y += 10;
    });
    y += 2;
    this._sep(y); y += 4;

    // Drag toggle
    this.dragBg = this._track(this.add.rectangle(mid, y + 9, PW - 12, 18, 0x333333)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this.dragBtn = this._track(this.add.text(tx, y + 1, 'DRAG: OFF', { ...FONT, color: C_RED }).setScrollFactor(0));
    this.dragBg.on('pointerover', () => this.dragBg.setFillStyle(0x444444));
    this.dragBg.on('pointerout',  () => this.dragBg.setFillStyle(DebugManager.isDragEnabled ? 0x1a4a1a : 0x333333));
    this.dragBg.on('pointerdown', () => this.toggleDrag());
    y += 22;
    this._sep(y); y += 4;

    // Selected object info — 5 linhas (sem a linha de hint)
    this._track(this.add.text(tx, y, 'SELECIONADO:', { ...FONT_SM, color: C_TEXT }).setScrollFactor(0));
    y += 10;
    const infoDefaults = ['tex: —', 'x:—  y:—', 'w:—  h:—', 'scl:—  depth:—', 'ctrl+drag []=z ^Z'];
    this.infoLines = infoDefaults.map((txt, i) => {
      return this._track(this.add.text(tx, y + i * 10, txt, {
        ...FONT_SM, color: i === 4 ? C_DIM : C_TEXT,
      }).setScrollFactor(0));
    });
    y += infoDefaults.length * 10 + 2;
    this._sep(y); y += 4;

    // Resize ±5% | Del | +Asset — 3 botões em 2 linhas compactas
    const bw   = Math.floor((PW - 16) / 2);
    const b1cx = px + 7 + bw / 2;
    const b2cx = px + PW - 7 - bw / 2;
    const BH   = 16; // altura dos botões

    const makePairBtn = (cx: number, cy: number, w: number, label: string, fill: number, hover: number, color: string, cb: () => void) => {
      const bg = this._track(this.add.rectangle(cx, cy, w, BH, fill).setScrollFactor(0).setInteractive({ useHandCursor: true }));
      this._track(this.add.text(cx, cy, label, { ...FONT_SM, color }).setScrollFactor(0).setOrigin(0.5));
      bg.on('pointerover', () => bg.setFillStyle(hover));
      bg.on('pointerout',  () => bg.setFillStyle(fill));
      bg.on('pointerdown', cb);
    };

    makePairBtn(b1cx, y + BH / 2, bw, '− 5%',   0x2a2a00, 0x4a4a00, '#ffdd88', () => DebugManager.resizeSelected(-5));
    makePairBtn(b2cx, y + BH / 2, bw, '+ 5%',   0x002a00, 0x004a00, '#88ff88', () => DebugManager.resizeSelected(5));
    y += BH + 2;
    makePairBtn(b1cx, y + BH / 2, bw, '⌫ DEL',  0x4a1a1a, 0x6a2a2a, C_RED,    () => DebugManager.deleteSelected());
    makePairBtn(b2cx, y + BH / 2, bw, '+ ASSET', 0x1a3a4a, 0x2a5a6a, C_BLUE,  () => this.openAssetModal());
    y += BH + 4;

    // Distorção W/H — 4 botões em 1 linha
    const bwQ = Math.floor((PW - 16) / 4);
    const dCx = [0, 1, 2, 3].map(i => px + 7 + bwQ * i + bwQ / 2);
    const distDef = [
      { label: 'W−', axis: 'w' as const, delta: -5, fill: 0x3a1a00, hover: 0x5a3000, color: '#ff9966' },
      { label: 'W+', axis: 'w' as const, delta:  5, fill: 0x003a00, hover: 0x005a00, color: '#99ff99' },
      { label: 'H−', axis: 'h' as const, delta: -5, fill: 0x3a1a00, hover: 0x5a3000, color: '#ff9966' },
      { label: 'H+', axis: 'h' as const, delta:  5, fill: 0x003a00, hover: 0x005a00, color: '#99ff99' },
    ];
    distDef.forEach(({ label, axis, delta, fill, hover, color }, i) => {
      makePairBtn(dCx[i], y + BH / 2, bwQ - 2, label, fill, hover, color, () => DebugManager.distortSelected(axis, delta));
    });
    y += BH + 2;

    // Depth (camada) — 2 botões
    makePairBtn(b1cx, y + BH / 2, bw, 'Z −1', 0x1a1a3a, 0x2a2a5a, '#aaaaff', () => DebugManager.changeDepth(-1));
    makePairBtn(b2cx, y + BH / 2, bw, 'Z +1', 0x1a1a3a, 0x2a2a5a, '#ddddff', () => DebugManager.changeDepth(1));
    y += BH + 4;
    this._sep(y); y += 4;

    // TEXTO — font + wrap em linhas compactas
    const bwHalf = Math.floor((PW - 16) / 2);
    const fMinCx = px + 7 + bwHalf / 2;
    const fMaxCx = px + PW - 7 - bwHalf / 2;

    this._fontLine = this._track(this.add.text(tx, y, 'font: —', { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 10;
    makePairBtn(fMinCx, y + BH / 2, bwHalf, '− 2px', 0x2a2a00, 0x4a4a00, '#ffdd88', () => DebugManager.adjustFontSize(-2));
    makePairBtn(fMaxCx, y + BH / 2, bwHalf, '+ 2px', 0x002a00, 0x004a00, '#88ff88', () => DebugManager.adjustFontSize(2));
    y += BH + 2;

    this._wrapLine = this._track(this.add.text(tx, y, 'wrap: —', { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 10;
    makePairBtn(fMinCx, y + BH / 2, bwHalf, '−20px', 0x2a2a00, 0x4a4a00, '#ffdd88', () => DebugManager.adjustWordWrap(-20));
    makePairBtn(fMaxCx, y + BH / 2, bwHalf, '+20px', 0x002a00, 0x004a00, '#88ff88', () => DebugManager.adjustWordWrap(20));
    y += BH + 2;

    // Paleta de cores
    this._colorLine = this._track(this.add.text(tx, y, 'cor: —', { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 10;
    const COLORS: { hex: string; fill: number }[] = [
      { hex: '#ffffff', fill: 0xffffff }, { hex: '#ffff44', fill: 0xffff44 },
      { hex: '#ffcc44', fill: 0xffcc44 }, { hex: '#ff8844', fill: 0xff8844 },
      { hex: '#ff6666', fill: 0xff6666 }, { hex: '#ff44aa', fill: 0xff44aa },
      { hex: '#cc88ff', fill: 0xcc88ff }, { hex: '#88ccff', fill: 0x88ccff },
      { hex: '#66ff66', fill: 0x66ff66 }, { hex: '#888888', fill: 0x888888 },
    ];
    const swSize = Math.floor((PW - 12) / COLORS.length);
    COLORS.forEach(({ hex, fill }, i) => {
      const swcx = px + 6 + swSize * i + swSize / 2;
      const sw = this._track(this.add.rectangle(swcx, y + 5, swSize - 2, 10, fill)
        .setScrollFactor(0).setInteractive({ useHandCursor: true }));
      sw.on('pointerdown', () => DebugManager.setFontColor(hex));
    });
    y += 16;
    this._sep(y); y += 4;

    // Botões de ação — 2 colunas
    makePairBtn(b1cx, y + BH / 2, bw, 'SALVAR LOG', 0x1a3a5a, 0x224466, C_BLUE,    () => this.saveLog());
    makePairBtn(b2cx, y + BH / 2, bw, 'FECHAR[F2]', 0x4a1a1a, 0x6a2a2a, C_RED,    () => this.close());
    // saveStatus sobreposto ao botão salvar
    this.saveStatus = this._track(this.add.text(tx, y - 5, '', { ...FONT_SM, color: C_GREEN }).setScrollFactor(0));
    y += BH + 2;
    makePairBtn(b1cx, y + BH / 2, bw, 'LIMPAR RUN', 0x4a3a00, 0x6a5a00, '#ffcc44', () => this.resetRun());
    makePairBtn(b2cx, y + BH / 2, bw, 'RECURSOS',   0x1a3a1a, 0x2a5a2a, C_GREEN,  () => this.giveCheatResources());
    y += BH + 2;
    // Botão largo: revelar objetos ocultos (alpha=0, visible=false)
    const revealBg = this._track(this.add.rectangle(mid, y + BH / 2, PW - 12, BH, 0x2a1a4a)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(mid, y + BH / 2, 'MOSTRAR OCULTOS', { ...FONT_SM, color: '#cc88ff' })
      .setScrollFactor(0).setOrigin(0.5));
    revealBg.on('pointerover', () => revealBg.setFillStyle(0x3a2a6a));
    revealBg.on('pointerout',  () => revealBg.setFillStyle(0x2a1a4a));
    revealBg.on('pointerdown', () => {
      if (!this.targetScene) return;
      const n = DebugManager.revealHidden(this.targetScene);
      this.saveStatus.setText(`✓ ${n} revelados`);
      this.time.delayedCall(2500, () => this.saveStatus?.setText(''));
    });
    y += BH + 2;

    // Combat Test Scene
    const ctBg = this._track(this.add.rectangle(mid, y + BH / 2, PW - 12, BH, 0x001a2a)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(mid, y + BH / 2, '⚔ COMBAT EFFECT TEST', { ...FONT_SM, color: '#88ddff' })
      .setScrollFactor(0).setOrigin(0.5));
    ctBg.on('pointerover', () => ctBg.setFillStyle(0x002a3a));
    ctBg.on('pointerout',  () => ctBg.setFillStyle(0x001a2a));
    ctBg.on('pointerdown', () => {
      this.close();
      this.scene.launch(SCENE_KEYS.COMBAT_TEST);
    });
    y += BH + 2;

    // BG Scale — ajusta tileScale dos backgrounds em tempo real
    this._sep(y); y += 4;
    this._track(this.add.text(tx, y, 'BG SCALE', { ...FONT_SM, color: C_DIM }).setScrollFactor(0));
    y += 10;
    makePairBtn(b1cx, y + BH / 2, bw, '− 0.05', 0x2a1a00, 0x4a3a00, '#ffbb66', () => this._adjustBgScale(-0.05));
    makePairBtn(b2cx, y + BH / 2, bw, '+ 0.05', 0x001a2a, 0x003a4a, '#66bbff', () => this._adjustBgScale(0.05));
    y += BH + 2;

    // Toggle lado
    const toggleLabel = this._panelSide === 'right' ? '◀ ESQUERDA' : 'DIREITA ▶';
    const toggleBg = this._track(this.add.rectangle(mid, y + BH / 2, PW - 12, BH, 0x1a1a3a)
      .setScrollFactor(0).setInteractive({ useHandCursor: true }));
    this._track(this.add.text(mid, y + BH / 2, toggleLabel, { ...FONT_SM, color: '#aaaaff' })
      .setScrollFactor(0).setOrigin(0.5));
    toggleBg.on('pointerover', () => toggleBg.setFillStyle(0x2a2a5a));
    toggleBg.on('pointerout',  () => toggleBg.setFillStyle(0x1a1a3a));
    toggleBg.on('pointerdown', () => {
      this._panelSide = this._panelSide === 'right' ? 'left' : 'right';
      this._rebuildPanel();
    });
  }

  private _adjustBgScale(delta: number): void {
    const scenes = this.scene.manager.scenes;
    for (const s of scenes) {
      if ((s as any).adjustBgScale) {
        (s as any).adjustBgScale(delta);
        return;
      }
    }
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

    this.input.keyboard?.on('keydown-F2', () => this.close());

    this.input.keyboard?.on('keydown-Z', (e: KeyboardEvent) => {
      if (e.ctrlKey) { e.preventDefault(); DebugManager.undo(); }
    });

    this.input.keyboard?.on('keydown-OPEN_BRACKET',   () => DebugManager.changeDepth(-1));
    this.input.keyboard?.on('keydown-CLOSED_BRACKET', () => DebugManager.changeDepth(+1));
    this.input.keyboard?.on('keydown-DELETE', () => DebugManager.deleteSelected());
    this.input.keyboard?.on('keydown-ESC', () => { this._clearModal(); });

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
    this.infoLines[3].setText(`scl:${Math.round(record.scaleX * 100)}%  depth:${record.depth}`);

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

  // ── Asset modal helpers ──────────────────────────────────

  private _clearModal(): void {
    this._modalObjects.forEach(o => o.destroy());
    this._modalObjects.length = 0;
    DebugManager.setModalOpen(false);
  }

  private _trackM<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this._modalObjects.push(o);
    return o;
  }

  // Modal: lista à esquerda + preview grande à direita
  private openAssetModal(): void {
    this._clearModal();
    DebugManager.setModalOpen(true);

    const keys = DebugManager.getLoadedTextureKeys().sort();
    if (keys.length === 0) { this.saveStatus.setText('sem texturas'); return; }

    // Layout: 740×520 centrado em 400×300
    const MW = 740;
    const MH = 520;
    const MX = 400;
    const MY = 300;
    const LIST_W   = 220;  // largura da coluna de lista
    const PREV_W   = MW - LIST_W - 3; // largura da área de preview
    const ITEM_H   = 16;
    const HDR_H    = 42;   // altura do cabeçalho

    const listLeft  = MX - MW / 2;               // x esquerda do modal
    const listCX    = listLeft + LIST_W / 2;      // centro da coluna de lista
    const prevLeft  = listLeft + LIST_W + 3;       // x início área preview
    const prevCX    = prevLeft + PREV_W / 2;       // centro da área preview
    const listTopY  = MY - MH / 2 + HDR_H;
    const visibleH  = MH - HDR_H - 28;            // -28 para barra inferior
    const maxVisible = Math.floor(visibleH / ITEM_H);

    let scrollOffset  = 0;
    let selectedKey   = keys[0];

    // ── Fundo escurecido ──
    const dim = this._trackM(this.add.rectangle(400, 300, 800, 600, 0x000000, 0.72)
      .setScrollFactor(0).setDepth(9000).setInteractive());
    dim.on('pointerdown', () => this._clearModal());

    // ── Painel branco principal ──
    // Interativo para consumir cliques dentro do modal: sem isso, clicar em
    // qualquer área vazia do painel vaza para o `dim` atrás e fecha o modal.
    // Só o `dim` (fora) e o ✕ fecham.
    this._trackM(this.add.rectangle(MX, MY, MW, MH, 0xf5f5f5, 1)
      .setScrollFactor(0).setDepth(9001).setInteractive());
    this._trackM(this.add.rectangle(MX, MY, MW, MH, 0x000000, 0)
      .setScrollFactor(0).setDepth(9001).setStrokeStyle(2, 0x333333));

    // Divisória vertical entre lista e preview
    this._trackM(this.add.graphics()
      .lineStyle(1, 0xcccccc).lineBetween(prevLeft, MY - MH / 2, prevLeft, MY + MH / 2)
      .setScrollFactor(0).setDepth(9002));

    // ── Cabeçalho ──
    this._trackM(this.add.text(MX, MY - MH / 2 + 14, 'INSERIR ASSET', {
      fontFamily: 'monospace', fontSize: '13px', color: '#111111', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(9003).setOrigin(0.5));

    const closeBtn = this._trackM(this.add.text(MX + MW / 2 - 8, MY - MH / 2 + 6, '✕', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cc0000',
    }).setScrollFactor(0).setDepth(9003).setOrigin(1, 0).setInteractive({ useHandCursor: true }));
    closeBtn.on('pointerdown', () => this._clearModal());

    // Campo de filtro no cabeçalho. setInteractive() para que o clique seja
    // consumido aqui e NÃO vaze para o `dim` atrás (que fecharia o modal).
    // A filtragem em si é por teclado (ver handler abaixo) — clicar só evita o
    // fechamento acidental.
    const searchBg = this._trackM(this.add.rectangle(listCX, MY - MH / 2 + 30, LIST_W - 8, 16, 0xffffff)
      .setScrollFactor(0).setDepth(9002).setStrokeStyle(1, 0x999999)
      .setInteractive({ useHandCursor: true }));
    const searchTxt = this._trackM(this.add.text(listLeft + 6, MY - MH / 2 + 23, '🔍 filtrar...', {
      fontFamily: 'monospace', fontSize: '9px', color: '#888888',
    }).setScrollFactor(0).setDepth(9003));
    void searchBg;

    // ── Área de preview ──
    const PREV_AREA_H = MH - HDR_H - 80; // deixa 80px p/ botão na base
    const prevAreaY   = MY - MH / 2 + HDR_H + PREV_AREA_H / 2;

    // Fundo xadrez pra indicar transparência
    const checkerGfx = this._trackM(this.add.graphics().setScrollFactor(0).setDepth(9002));
    const drawChecker = () => {
      checkerGfx.clear();
      const sz = 12;
      for (let row = 0; row * sz < PREV_AREA_H; row++) {
        for (let col = 0; col * sz < PREV_W - 4; col++) {
          checkerGfx.fillStyle((row + col) % 2 === 0 ? 0xcccccc : 0xffffff);
          checkerGfx.fillRect(
            prevLeft + 2 + col * sz,
            MY - MH / 2 + HDR_H + row * sz,
            sz, sz,
          );
        }
      }
    };
    drawChecker();

    // Preview image — atualizado ao selecionar item
    let previewImg: Phaser.GameObjects.Image | null = null;
    const MAX_PREV = Math.min(PREV_W - 16, PREV_AREA_H - 16);

    const updatePreview = (key: string) => {
      previewImg?.destroy();
      previewImg = null;
      if (!this.textures.exists(key)) return;
      const tex = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const tw = tex.width || 1;
      const th = tex.height || 1;
      const ratio = Math.min(MAX_PREV / tw, MAX_PREV / th, 1);
      const dw = Math.round(tw * ratio);
      const dh = Math.round(th * ratio);
      previewImg = this.add.image(prevCX, prevAreaY, key)
        .setDisplaySize(dw, dh).setScrollFactor(0).setDepth(9004);
      this._modalObjects.push(previewImg);

      // Dimensões no rodapé do preview
      dimLabel.setText(`${tw} × ${th} px`);
    };

    const dimLabel = this._trackM(this.add.text(prevCX, MY + MH / 2 - 58, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#555555',
    }).setScrollFactor(0).setDepth(9003).setOrigin(0.5));

    // Botão Inserir, fixo no rodapé do preview
    const insertY  = MY + MH / 2 - 36;
    const insertBg = this._trackM(this.add.rectangle(prevCX, insertY, PREV_W - 20, 26, 0x226622)
      .setScrollFactor(0).setDepth(9003).setInteractive({ useHandCursor: true }));
    const insertTxt = this._trackM(this.add.text(prevCX, insertY, '✓ Inserir na cena', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(9004).setOrigin(0.5));
    void insertTxt;
    insertBg.on('pointerover', () => insertBg.setFillStyle(0x338833));
    insertBg.on('pointerout',  () => insertBg.setFillStyle(0x226622));
    insertBg.on('pointerdown', () => {
      if (!this.targetScene || !DebugManager.isDragEnabled) {
        this.saveStatus.setText('ative o DRAG primeiro');
        return;
      }
      DebugManager.spawnAsset(this.targetScene, selectedKey);
      this.saveStatus.setText(`✓ inserido: ${selectedKey}`);
      this.time.delayedCall(2500, () => this.saveStatus?.setText(''));
      this._clearModal();
    });

    // ── Lista de itens ──
    const itemObjs: Phaser.GameObjects.GameObject[] = [];

    const renderList = (filtered: string[]) => {
      itemObjs.forEach(o => o.destroy());
      itemObjs.length = 0;

      const page = filtered.slice(scrollOffset, scrollOffset + maxVisible);
      page.forEach((key, i) => {
        const iy = listTopY + i * ITEM_H;
        const isSelected = key === selectedKey;
        const bgColor    = isSelected ? '#2255aa' : (i % 2 === 0 ? '#f0f0f0' : '#e8e8e8');
        const fgColor    = isSelected ? '#ffffff' : '#1a1a1a';
        const item = this.add.text(listLeft + 4, iy, key, {
          fontFamily: 'monospace', fontSize: '10px', color: fgColor,
          backgroundColor: bgColor,
          padding: { x: 3, y: 2 },
          fixedWidth: LIST_W - 8,
        }).setScrollFactor(0).setDepth(9004).setInteractive({ useHandCursor: true });

        item.on('pointerover',  () => { if (key !== selectedKey) item.setBackgroundColor('#bbddff').setColor('#111111'); });
        item.on('pointerout',   () => { if (key !== selectedKey) item.setBackgroundColor(i % 2 === 0 ? '#f0f0f0' : '#e8e8e8').setColor('#1a1a1a'); });
        item.on('pointerdown',  () => {
          selectedKey = key;
          updatePreview(key);
          renderList(filtered);
        });
        itemObjs.push(item);
        this._modalObjects.push(item);
      });

      // Indicadores de scroll
      if (scrollOffset > 0) {
        const up = this.add.text(listCX, listTopY - 12, '▲', {
          fontFamily: 'monospace', fontSize: '9px', color: '#555555',
        }).setScrollFactor(0).setDepth(9004).setOrigin(0.5);
        itemObjs.push(up); this._modalObjects.push(up);
      }
      if (scrollOffset + maxVisible < filtered.length) {
        const dn = this.add.text(listCX, listTopY + maxVisible * ITEM_H + 2, '▼', {
          fontFamily: 'monospace', fontSize: '9px', color: '#555555',
        }).setScrollFactor(0).setDepth(9004).setOrigin(0.5, 0);
        itemObjs.push(dn); this._modalObjects.push(dn);
      }
    };

    let currentFilter = '';
    let filtered = keys;
    updatePreview(selectedKey);
    renderList(filtered);

    // Scroll com roda do mouse
    this.input.on('wheel', (_p: any, _objs: any, _dx: number, dy: number) => {
      if (this._modalObjects.length === 0) return;
      scrollOffset = Math.max(0, Math.min(Math.max(0, filtered.length - maxVisible), scrollOffset + (dy > 0 ? 3 : -3)));
      renderList(filtered);
    });

    // Teclado: filtrar / navegação
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this._modalObjects.length === 0) return;
      if (e.key === 'Escape') { this._clearModal(); return; }
      if (e.key === 'Enter') {
        if (!this.targetScene || !DebugManager.isDragEnabled) return;
        DebugManager.spawnAsset(this.targetScene, selectedKey);
        this.saveStatus.setText(`✓ inserido: ${selectedKey}`);
        this.time.delayedCall(2500, () => this.saveStatus?.setText(''));
        this._clearModal();
        return;
      }
      if (e.key === 'ArrowDown') {
        const idx = filtered.indexOf(selectedKey);
        if (idx < filtered.length - 1) {
          selectedKey = filtered[idx + 1];
          if (idx + 1 >= scrollOffset + maxVisible) scrollOffset++;
          updatePreview(selectedKey);
          renderList(filtered);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        const idx = filtered.indexOf(selectedKey);
        if (idx > 0) {
          selectedKey = filtered[idx - 1];
          if (idx - 1 < scrollOffset) scrollOffset--;
          updatePreview(selectedKey);
          renderList(filtered);
        }
        return;
      }
      if (e.key === 'Backspace') currentFilter = currentFilter.slice(0, -1);
      else if (e.key.length === 1) currentFilter += e.key.toLowerCase();
      else return;

      scrollOffset = 0;
      filtered = keys.filter(k => k.toLowerCase().includes(currentFilter));
      selectedKey = filtered[0] ?? selectedKey;
      searchTxt.setText(currentFilter ? `🔍 "${currentFilter}" (${filtered.length})` : '🔍 filtrar...');
      updatePreview(selectedKey);
      renderList(filtered);
    });
  }
}
