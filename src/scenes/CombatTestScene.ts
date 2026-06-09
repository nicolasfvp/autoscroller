/**
 * CombatTestScene — sandbox visual para testar animações e efeitos de combate.
 * Layout e constantes espelham exatamente o CombatScene (posições, escalas,
 * FX coords, sombras). Acessível via DebugOverlayScene. Sem RunState nem engine.
 */

import Phaser from 'phaser';
import { CombatEffects } from '../effects/CombatEffects';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { getRun, hasActiveRun } from '../state/RunState';

// ── Constantes idênticas ao CombatScene ───────────────────────────────────────
const HERO_X     = 200;
const HERO_Y     = 330;
const IDLE_SCALE = 0.6034;
const SHADOW_X   = 178;
const SHADOW_Y   = 440;
const SHADOW_W   = 220;
const SHADOW_H   = 50;

const ENEMY_X    = 600;
const ENEMY_Y    = 340;
const ENEMY_SIZE = 250;
const ENEMY_SHADOW_X = 600;
const ENEMY_SHADOW_Y = 440;

// FX de ataque do inimigo sobre o herói — CombatScene usa (200, 320)
const ATTACK_FX_X = 200;
const ATTACK_FX_Y = 320;

// Floating numbers — dano no inimigo (600,320), dano no herói (200,320)
const FLOAT_ENEMY_X = 600;
const FLOAT_HERO_X  = 200;
const FLOAT_Y       = 320;

// Status FX — coordenadas calibradas via debug-layout (igual ao CombatScene)
const FX_HERO_FIRE_X   = 182.2; const FX_HERO_FIRE_Y   = 499.1; const FX_HERO_FIRE_SIZE   = 219;
const FX_HERO_BLEED_X  = 188.8; const FX_HERO_BLEED_Y  = 464.9; const FX_HERO_BLEED_SIZE  = 115;
const FX_HERO_STUN_X   = 217.1; const FX_HERO_STUN_Y   = 300.2; const FX_HERO_STUN_SIZE   = 67;
const FX_ENEMY_FX_X    = 612.5; const FX_ENEMY_FX_Y    = 636.3; const FX_ENEMY_FX_SIZE    = 252;
const FX_ENEMY_STUN_X  = 612.5; const FX_ENEMY_STUN_Y  = 300.2; const FX_ENEMY_STUN_SIZE  = 67;
const FX_ENEMY_BLEED_SIZE = 115;

// Override de posição/scale por animação — igual ao CombatScene
const ANIM_OVERRIDES: Record<string, { x: number; y: number; scale: number }> = {
  hero_attack:  { x: 190.4, y: 301.6, scale: 0.6118 },
  hero_channel: { x: 199.3, y: 318.8, scale: 0.6529 },
};

// Terrenos de batalha disponíveis
const TERRAINS = ['basic', 'forest', 'desert', 'graveyard', 'swamp', 'lava', 'ruins'] as const;
type Terrain = typeof TERRAINS[number];

// ── Painel hambúrguer ─────────────────────────────────────────────────────────
const MENU_BTN_X = 750;
const MENU_BTN_Y = 22;
const PANEL_X    = 10;
const PANEL_Y    = 50;
const PANEL_W    = 770;
const PANEL_H    = 200;
const BTN_H      = 28;
const BTN_GAP    = 6;
const ROW_H      = BTN_H + BTN_GAP;

const TAB_NAMES = ['ANIMATIONS', 'FX EFFECTS', 'STATUS', 'UTILS', 'BG'] as const;
type TabName = typeof TAB_NAMES[number];

export class CombatTestScene extends Phaser.Scene {
  private effects!: CombatEffects;
  private heroSprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private enemyIdleTimer: Phaser.Time.TimerEvent | null = null;
  private bgImage!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

  private _menuOpen = false;
  private _menuPanelBg!: Phaser.GameObjects.Rectangle;
  private _menuBtnBg!: Phaser.GameObjects.Rectangle;
  private _menuBtnText!: Phaser.GameObjects.Text;

  private _activeTab: TabName = 'ANIMATIONS';
  private _tabBgs:    Map<TabName, Phaser.GameObjects.Rectangle>        = new Map();
  private _tabTexts:  Map<TabName, Phaser.GameObjects.Text>             = new Map();
  private _tabGroups: Map<TabName, Phaser.GameObjects.GameObject[]>     = new Map();

  private _channelYOffset = 0;
  private _channelYLabel!: Phaser.GameObjects.Text;

  private _fireSprite:   Phaser.GameObjects.Sprite | null = null;
  private _bleedSprite:  Phaser.GameObjects.Sprite | null = null;
  private _stunSprite:   Phaser.GameObjects.Sprite | null = null;
  private _efireSprite:  Phaser.GameObjects.Sprite | null = null;
  private _ebleedSprite: Phaser.GameObjects.Sprite | null = null;
  private _estunSprite:  Phaser.GameObjects.Sprite | null = null;
  private _auraSprite:   Phaser.GameObjects.Sprite | null = null;
  private _leafSprite:   Phaser.GameObjects.Sprite | null = null;

  private _labelText!: Phaser.GameObjects.Text;
  private _labelTimer: Phaser.Time.TimerEvent | null = null;

  private currentEnemyIdx = 0;
  private currentTerrain: Terrain = 'forest';
  private readonly ENEMY_POOL = [
    'monster_slime', 'monster_werewolf', 'monster_skeleton', 'monster_lava_golem',
    'monster_vampire', 'monster_toxic_gooze', 'monster_boss_iron_golem',
    'monster_infernal_dragon', 'monster_bog_witch',
  ];

  constructor() { super({ key: 'CombatTestScene' }); }

  create(): void {
    this._buildBg(this.currentTerrain);
    this.effects = new CombatEffects(this);
    this._buildHero();
    this._buildEnemy();
    this._buildHamburgerBtn();
    this._buildMenu();
    this._buildBackBtn();

    this._labelText = this.add.text(400, 585, '', {
      fontFamily: 'VT323, monospace', fontSize: '13px', color: '#aaffaa',
    }).setOrigin(0.5, 1).setDepth(200);

    this.events.on('shutdown', () => {
      this.enemyIdleTimer?.destroy();
      this.enemyIdleTimer = null;
    });
  }

  // ── Background ────────────────────────────────────────────────────────────────

  private _buildBg(terrain: Terrain): void {
    if (this.bgImage) this.bgImage.destroy();
    const key = `bg_battle_${terrain}`;
    this.bgImage = this.textures.exists(key)
      ? this.add.image(400, 300, key).setDisplaySize(800, 600).setDepth(0)
      : this.add.rectangle(400, 300, 800, 600, 0x1a1a2e).setDepth(0);
  }

  // ── Hero ──────────────────────────────────────────────────────────────────────

  private _prefix(): string {
    return hasActiveRun() ? getSpritePrefix(getRun().hero.className ?? 'warrior') : 'hero';
  }

  private _buildHero(): void {
    const p = this._prefix();
    const stanceKey = `${p}_battle_stance`;
    const idleKey   = `${p}_idle`;
    const resolvedKey = this.textures.exists(stanceKey) ? stanceKey : idleKey;

    if (this.textures.exists(resolvedKey)) {
      const frameTotal = this.textures.get(resolvedKey).frameTotal - 1;
      const scale = frameTotal > 1 ? IDLE_SCALE : 0.65;
      this.heroSprite = this.add.sprite(HERO_X, HERO_Y, resolvedKey).setDepth(10).setScale(scale);
      if (frameTotal > 1) {
        const k = 'cbt_hero_idle';
        if (!this.anims.exists(k))
          this.anims.create({ key: k, frames: this.anims.generateFrameNumbers(resolvedKey, { start: 0, end: frameTotal - 1 }), frameRate: 6, repeat: -1 });
        (this.heroSprite as Phaser.GameObjects.Sprite).play(k);
      }
    } else {
      this.heroSprite = this.add.sprite(HERO_X, HERO_Y, '__DEFAULT').setDisplaySize(100, 100).setDepth(10);
    }

    if (this.textures.exists('hero_shadow'))
      this.add.image(SHADOW_X, SHADOW_Y, 'hero_shadow').setDisplaySize(SHADOW_W, SHADOW_H).setAlpha(0.7).setDepth(9);
    else
      this.add.ellipse(HERO_X, SHADOW_Y, 160, 28, 0x000000, 0.45).setDepth(9);
  }

  private _playHeroAnim(textureKey: string, animKey: string, fps: number, repeat: number, yOffset = 0): void {
    if (!this.textures.exists(textureKey)) { this._showLabel(`Não encontrado: ${textureKey}`); return; }
    if (!(this.heroSprite instanceof Phaser.GameObjects.Sprite)) return;
    if (!this.anims.exists(animKey)) {
      const n = this.textures.get(textureKey).frameTotal - 1;
      if (n > 0) this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: n - 1 }), frameRate: fps, repeat });
    }
    const ov = ANIM_OVERRIDES[textureKey];
    const scale = ov ? ov.scale : IDLE_SCALE;
    const x     = ov ? ov.x     : HERO_X;
    const y     = ov ? ov.y     : HERO_Y + yOffset;
    this.heroSprite.setScale(scale).setX(x).setY(y).play(animKey);
    if (repeat === 0) {
      this.heroSprite.once('animationcomplete', () => this._returnToIdle());
    } else if (repeat === -1 && animKey !== 'cbt_hero_idle') {
      this.time.delayedCall(1500, () => this._returnToIdle());
    }
  }

  private _returnToIdle(): void {
    if (!(this.heroSprite instanceof Phaser.GameObjects.Sprite)) return;
    this.heroSprite.stop().setScale(IDLE_SCALE).setX(HERO_X).setY(HERO_Y);
    if (this.anims.exists('cbt_hero_idle')) this.heroSprite.play('cbt_hero_idle');
    this._auraSprite?.destroy(); this._auraSprite = null;
    this._leafSprite?.destroy(); this._leafSprite = null;
  }

  // ── Enemy ─────────────────────────────────────────────────────────────────────

  private _buildEnemy(): void {
    const key = this.ENEMY_POOL[this.currentEnemyIdx];
    if (this.textures.exists(key)) {
      this.enemySprite = this.add.image(ENEMY_X, ENEMY_Y, key)
        .setDisplaySize(ENEMY_SIZE, ENEMY_SIZE).setDepth(10);
    } else {
      this.enemySprite = this.add.rectangle(ENEMY_X, ENEMY_Y, 120, 120, 0xcc3333).setDepth(10);
    }
    if (this.textures.exists('hero_shadow'))
      this.add.image(ENEMY_SHADOW_X, ENEMY_SHADOW_Y, 'hero_shadow').setDisplaySize(220, 50).setAlpha(0.7).setDepth(9);
    else
      this.add.ellipse(ENEMY_SHADOW_X, ENEMY_SHADOW_Y, 160, 28, 0x000000, 0.45).setDepth(9);
    this._startEnemyIdle(key);
  }

  private _startEnemyIdle(key: string): void {
    this.enemyIdleTimer?.destroy();
    this.enemyIdleTimer = null;
    const key2 = `${key}_2`;
    if (!this.textures.exists(key2)) return;
    let frame = 0;
    this.enemyIdleTimer = this.time.addEvent({
      delay: 500, loop: true,
      callback: () => {
        if (!(this.enemySprite instanceof Phaser.GameObjects.Image)) return;
        frame = 1 - frame;
        this.enemySprite.setTexture(frame === 0 ? key : key2);
      },
    });
  }

  private _selectEnemy(key: string): void {
    this.enemyIdleTimer?.destroy();
    this.enemyIdleTimer = null;
    if (this.textures.exists(key)) {
      if (this.enemySprite instanceof Phaser.GameObjects.Image) {
        this.enemySprite.setTexture(key).setDisplaySize(ENEMY_SIZE, ENEMY_SIZE);
      } else {
        this.enemySprite.destroy();
        this.enemySprite = this.add.image(ENEMY_X, ENEMY_Y, key)
          .setDisplaySize(ENEMY_SIZE, ENEMY_SIZE).setDepth(10);
      }
    }
    this._startEnemyIdle(key);
    this._showLabel(key.replace('monster_', ''));
  }

  // ── Feedback ──────────────────────────────────────────────────────────────────

  private _showLabel(msg: string): void {
    this._labelText?.setText(msg).setAlpha(1);
    this._labelTimer?.remove();
    this._labelTimer = this.time.delayedCall(2500, () =>
      this.tweens.add({ targets: this._labelText, alpha: 0, duration: 400 }));
  }

  private _hitHero(): void {
    if (!this.heroSprite) return;
    this.heroSprite.setTint(0xff0000);
    this.time.delayedCall(300, () => { if (this.heroSprite) this.heroSprite.clearTint(); });
  }

  private _hitEnemy(): void {
    if (this.enemySprite instanceof Phaser.GameObjects.Image) {
      this.enemySprite.setTintFill(0xffffff);
      this.time.delayedCall(100, () => {
        if (this.enemySprite instanceof Phaser.GameObjects.Image) this.enemySprite.clearTint();
      });
    }
  }

  // ── Hamburger button ──────────────────────────────────────────────────────────

  private _buildHamburgerBtn(): void {
    this._menuBtnBg = this.add.rectangle(MENU_BTN_X, MENU_BTN_Y, 44, 28, 0x1a1200)
      .setStrokeStyle(1, 0xaa7700).setDepth(5).setInteractive({ useHandCursor: true });
    this._menuBtnText = this.add.text(MENU_BTN_X, MENU_BTN_Y, '☰', {
      fontFamily: 'VT323, monospace', fontSize: '20px', color: '#ffd700',
    }).setOrigin(0.5).setDepth(6);
    this._menuBtnBg.on('pointerover', () => this._menuBtnBg.setFillStyle(0x3a2800));
    this._menuBtnBg.on('pointerout',  () => this._menuBtnBg.setFillStyle(0x1a1200));
    this._menuBtnBg.on('pointerdown', () => this._toggleMenu());
  }

  private _toggleMenu(): void {
    this._menuOpen = !this._menuOpen;
    this._menuBtnText.setText(this._menuOpen ? '✕' : '☰');
    this._menuPanelBg
      .setVisible(this._menuOpen)
      .setAlpha(this._menuOpen ? 0.93 : 0)
      .setY(this._menuOpen ? PANEL_Y + PANEL_H / 2 : -2000);
    TAB_NAMES.forEach(tab => this._setTabVisible(tab, this._menuOpen && tab === this._activeTab));
    this._tabBgs.forEach((bg, _tab) => {
      bg.setVisible(this._menuOpen).setY(this._menuOpen ? PANEL_Y + 16 : -2000);
      if (this._menuOpen) bg.setInteractive(); else bg.disableInteractive();
    });
    this._tabTexts.forEach(t => {
      t.setVisible(this._menuOpen).setY(this._menuOpen ? PANEL_Y + 16 : -2000);
    });
  }

  private _setTabVisible(tab: TabName, visible: boolean): void {
    (this._tabGroups.get(tab) ?? []).forEach(go => {
      const o = go as any;
      o.setVisible(visible);
      o.setY(visible ? o._origY : -2000);
      if (go instanceof Phaser.GameObjects.Rectangle) {
        if (visible) o.setInteractive({ useHandCursor: true }); else o.disableInteractive();
      }
    });
    const bg = this._tabBgs.get(tab);
    if (bg) bg.setFillStyle(tab === this._activeTab ? 0x3a2800 : 0x1a1200);
  }

  private _switchTab(tab: TabName): void {
    TAB_NAMES.forEach(t => this._setTabVisible(t, false));
    this._activeTab = tab;
    this._setTabVisible(tab, true);
  }

  // ── Menu ─────────────────────────────────────────────────────────────────────

  private _buildMenu(): void {
    this._tabGroups.clear();
    this._tabBgs.clear();
    this._tabTexts.clear();

    this._menuPanelBg = this.add.rectangle(
      PANEL_X + PANEL_W / 2, PANEL_Y + PANEL_H / 2, PANEL_W, PANEL_H, 0x0d0d0d, 0.93,
    ).setStrokeStyle(1, 0x886600).setDepth(60).setAlpha(0).setVisible(false);

    const TAB_W = 120;
    const TAB_H = 24;
    TAB_NAMES.forEach((tab, i) => {
      const tx = PANEL_X + 16 + i * (TAB_W + 4) + TAB_W / 2;
      const bg = this.add.rectangle(tx, PANEL_Y + 16, TAB_W, TAB_H, i === 0 ? 0x3a2800 : 0x1a1200)
        .setStrokeStyle(1, 0x886600).setDepth(63).setVisible(false).setInteractive({ useHandCursor: true });
      const t = this.add.text(tx, PANEL_Y + 16, tab, {
        fontFamily: 'VT323, monospace', fontSize: '12px', color: '#ffd700',
      }).setOrigin(0.5).setDepth(64).setVisible(false);
      bg.on('pointerover', () => { if (tab !== this._activeTab) bg.setFillStyle(0x2a1800); });
      bg.on('pointerout',  () => { if (tab !== this._activeTab) bg.setFillStyle(0x1a1200); });
      bg.on('pointerdown', () => this._switchTab(tab));
      this._tabBgs.set(tab, bg);
      this._tabTexts.set(tab, t);
    });

    const CONTENT_Y = PANEL_Y + 38;
    const COLS      = 5;
    const COL_W     = Math.floor(PANEL_W / COLS);

    const addBtn = (
      tab: TabName, col: number, row: number,
      label: string, color: number, action: () => void,
    ) => {
      const bx = PANEL_X + col * COL_W + COL_W / 2;
      const by = CONTENT_Y + row * ROW_H + BTN_H / 2;
      const bbg = this.add.rectangle(bx, by, COL_W - 8, BTN_H, color)
        .setStrokeStyle(1, 0x886600).setDepth(61).setInteractive({ useHandCursor: true });
      const bt = this.add.text(bx, by, label, {
        fontFamily: 'VT323, monospace', fontSize: '11px', color: '#ffd700',
      }).setOrigin(0.5).setDepth(62);
      bt.setInteractive(); bt.disableInteractive();
      bbg.on('pointerover', () => bbg.setFillStyle(0x3a2800));
      bbg.on('pointerout',  () => bbg.setFillStyle(color));
      bbg.on('pointerdown', action);
      (bbg as any)._origY = by; (bt as any)._origY = by;
      const group = this._tabGroups.get(tab) ?? [];
      group.push(bbg, bt);
      this._tabGroups.set(tab, group);
      bbg.setVisible(false).disableInteractive();
      bt.setVisible(false);
    };

    const p = this._prefix();

    // ── ANIMATIONS — 5 na linha 0, CHANNEL na linha 1 col 0 ───────────────────
    const animRow0: Array<[string, number, () => void]> = [
      ['IDLE',   0x1a2a1a, () => { this._playHeroAnim(`${p}_idle`,   'cbt_hero_idle',    8, -1); this._showLabel('idle'); }],
      ['ATTACK', 0x2a1a1a, () => { this._playHeroAnim(`${p}_attack`, 'cbt_hero_attack', 12,  0); this._showLabel('attack'); }],
      ['CAST',   0x1a1a2a, () => { this._playHeroAnim(`${p}_cast`,   'cbt_hero_cast',   10,  0); this._showLabel('cast'); }],
      ['DEFEND', 0x1a2020, () => { this._playHeroAnim(`${p}_defend`, 'cbt_hero_defend',  8, -1); this.effects.shieldEffect(HERO_X, HERO_Y); this._showLabel('defend'); }],
      ['HIT',    0x2a1a00, () => { this._playHeroAnim(`${p}_hit`,    'cbt_hero_hit',    10,  0); this._hitHero(); this._showLabel('hit'); }],
    ];
    animRow0.forEach(([label, color, action], i) => addBtn('ANIMATIONS', i, 0, label, color, action));
    addBtn('ANIMATIONS', 0, 1, 'CHANNEL', 0x1a102a, () => { this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel', 6, -1, this._channelYOffset); this._showLabel(`channel Y:${this._channelYOffset}`); });

    // Label e offsets de channel — linha 2 (abaixo do CHANNEL btn na linha 1)
    this._channelYLabel = this.add.text(PANEL_X + PANEL_W / 2, CONTENT_Y + 2 * ROW_H + BTN_H / 2, 'channel Y: 0', {
      fontFamily: 'VT323, monospace', fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(62).setVisible(false);
    (this._channelYLabel as any)._origY = CONTENT_Y + 2 * ROW_H + BTN_H / 2;
    const ag = this._tabGroups.get('ANIMATIONS') ?? [];
    ag.push(this._channelYLabel);
    this._tabGroups.set('ANIMATIONS', ag);

    [{ d: -20, l: '-20' }, { d: -5, l: '-5' }, { d: +5, l: '+5' }, { d: +20, l: '+20' }]
      .forEach(({ d, l }, i) => addBtn('ANIMATIONS', i, 3, l, 0x221a33, () => {
        this._channelYOffset += d;
        this._channelYLabel.setText(`channel Y: ${this._channelYOffset}`);
        this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel', 6, -1, this._channelYOffset);
        this._showLabel(`channel Y: ${this._channelYOffset}`);
      }));

    // ── FX EFFECTS ─────────────────────────────────────────────────────────────
    const fxBtns: Array<[string, number, () => void]> = [
      ['FX SLASH',    0x202030, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash');       this._hitHero(); this._showLabel('fx_slash'); }],
      ['FX CLAW',     0x2a1500, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_claw');        this._hitHero(); this._showLabel('fx_claw'); }],
      ['FX STOMP',    0x1a1000, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_stomp');       this._hitHero(); this._showLabel('fx_stomp'); }],
      ['FX BITE',     0x1a2010, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_bite');        this._hitHero(); this._showLabel('fx_bite'); }],
      ['SLASH FIRE',  0x2a1000, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_fire');  this._hitHero(); this._showLabel('fx_slash_fire'); }],
      ['SLASH WATER', 0x001a2a, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_water'); this._hitHero(); this._showLabel('fx_slash_water'); }],
      ['SLASH AIR',   0x00201a, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_air');   this._hitHero(); this._showLabel('fx_slash_air'); }],
      ['SLASH EARTH', 0x1a1200, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_earth'); this._hitHero(); this._showLabel('fx_slash_earth'); }],
      ['FLOAT DMG E', 0x2a1500, () => { this.effects.floatingNumber(FLOAT_ENEMY_X, FLOAT_Y, Math.floor(Math.random() * 80 + 10), '#ffffff', '-'); this._hitEnemy(); this._showLabel('floatDmg enemy'); }],
      ['FLOAT DMG H', 0x2a0000, () => { this.effects.floatingNumber(FLOAT_HERO_X, FLOAT_Y, Math.floor(Math.random() * 80 + 10), '#ff4444', '-'); this._hitHero(); this._showLabel('floatDmg hero'); }],
      ['SCREEN SHK',  0x2a1000, () => { this.effects.screenShake(5, 200); this._showLabel('screenShake'); }],
    ];
    fxBtns.forEach(([label, color, action], i) =>
      addBtn('FX EFFECTS', i % COLS, Math.floor(i / COLS), label, color, action));

    // ── STATUS ─────────────────────────────────────────────────────────────────
    const statusBtns: Array<[string, number, () => void]> = [
      // Herói
      ['HERO FIRE',   0x2a1000, () => {
        if (this._fireSprite)  { this._fireSprite.destroy();  this._fireSprite  = null; this._showLabel('hero_fire OFF'); }
        else { this._fireSprite  = this.effects.statusEffect(FX_HERO_FIRE_X,  FX_HERO_FIRE_Y,  'fx_fire',  FX_HERO_FIRE_SIZE)  ?? null; this._showLabel('hero_fire ON'); }
      }],
      ['HERO BLEED',  0x2a0010, () => {
        if (this._bleedSprite) { this._bleedSprite.destroy(); this._bleedSprite = null; this._showLabel('hero_bleed OFF'); }
        else { this._bleedSprite = this.effects.statusEffect(FX_HERO_BLEED_X, FX_HERO_BLEED_Y, 'fx_bleed', FX_HERO_BLEED_SIZE) ?? null; this._showLabel('hero_bleed ON'); }
      }],
      ['HERO STUN',   0x1a1a00, () => {
        if (this._stunSprite)  { this._stunSprite.destroy();  this._stunSprite  = null; this._showLabel('hero_stun OFF'); }
        else { this._stunSprite  = this.effects.statusEffect(FX_HERO_STUN_X,  FX_HERO_STUN_Y,  'fx_stun',  FX_HERO_STUN_SIZE)  ?? null; this._showLabel('hero_stun ON'); }
      }],
      // Inimigo
      ['ENMY FIRE',   0x2a1000, () => {
        if (this._efireSprite)  { this._efireSprite.destroy();  this._efireSprite  = null; this._showLabel('enemy_fire OFF'); }
        else { this._efireSprite  = this.effects.statusEffect(FX_ENEMY_FX_X, FX_ENEMY_FX_Y, 'fx_fire',  FX_ENEMY_FX_SIZE)  ?? null; this._showLabel('enemy_fire ON'); }
      }],
      ['ENMY BLEED',  0x2a0010, () => {
        if (this._ebleedSprite) { this._ebleedSprite.destroy(); this._ebleedSprite = null; this._showLabel('enemy_bleed OFF'); }
        else { this._ebleedSprite = this.effects.statusEffect(FX_ENEMY_FX_X, FX_ENEMY_FX_Y, 'fx_bleed', FX_ENEMY_BLEED_SIZE) ?? null; this._showLabel('enemy_bleed ON'); }
      }],
      ['ENMY STUN',   0x1a1a00, () => {
        if (this._estunSprite)  { this._estunSprite.destroy();  this._estunSprite  = null; this._showLabel('enemy_stun OFF'); }
        else { this._estunSprite  = this.effects.statusEffect(FX_ENEMY_STUN_X, FX_ENEMY_STUN_Y, 'fx_stun', FX_ENEMY_STUN_SIZE) ?? null; this._showLabel('enemy_stun ON'); }
      }],
      // Herói — heal/buff
      ['HERO HEAL',   0x0a2a0a, () => {
        this._auraSprite?.destroy(); this._auraSprite = null;
        this._leafSprite?.destroy(); this._leafSprite = null;
        this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel', 6, -1, this._channelYOffset);
        this._auraSprite = this.effects.auraEffect(HERO_X, HERO_Y) ?? null;
        this._leafSprite = this.effects.leafEffect(HERO_X, HERO_Y) ?? null;
        this._showLabel('fx_heal');
      }],
      ['HERO BUFF',   0x0a0a2a, () => {
        this._auraSprite?.destroy(); this._auraSprite = null;
        this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel', 6, -1, this._channelYOffset);
        this._auraSprite = this.effects.auraEffect(HERO_X, HERO_Y, 0x4488ff, 'fx_aura_buff') ?? null;
        this._showLabel('fx_buff');
      }],
    ];
    statusBtns.forEach(([label, color, action], i) =>
      addBtn('STATUS', i % COLS, Math.floor(i / COLS), label, color, action));

    // ── UTILS — grid de inimigos ───────────────────────────────────────────────
    const THUMB  = 56;
    const THUMBG = 10;
    const THUMB_Y0 = CONTENT_Y + THUMB / 2 + 4;
    const utilGroup: Phaser.GameObjects.GameObject[] = [];

    this.ENEMY_POOL.forEach((key, i) => {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const tx = PANEL_X + 16 + col * (THUMB + THUMBG) + THUMB / 2;
      const ty = THUMB_Y0 + row * (THUMB + THUMBG);

      const bg = this.add.rectangle(tx, ty, THUMB, THUMB, 0x1a1a1a)
        .setStrokeStyle(2, i === this.currentEnemyIdx ? 0xffd700 : 0x886600)
        .setDepth(61).setInteractive({ useHandCursor: true });
      (bg as any)._origY = ty;
      (bg as any)._isThumbBg = true;

      const img = this.textures.exists(key)
        ? this.add.image(tx, ty, key).setDisplaySize(THUMB - 4, THUMB - 4).setDepth(62)
        : this.add.rectangle(tx, ty, THUMB - 8, THUMB - 8, 0xcc3333).setDepth(62);
      (img as any)._origY = ty;

      const lbl = this.add.text(tx, ty + THUMB / 2 - 1, key.replace('monster_', ''), {
        fontFamily: 'VT323, monospace', fontSize: '8px', color: '#aaaaaa',
      }).setOrigin(0.5, 0).setDepth(63);
      (lbl as any)._origY = ty + THUMB / 2 - 1;

      bg.on('pointerover', () => bg.setFillStyle(0x3a2800));
      bg.on('pointerout',  () => bg.setFillStyle(0x1a1a1a));
      bg.on('pointerdown', () => {
        this.currentEnemyIdx = i;
        this._selectEnemy(key);
        utilGroup.forEach(go => {
          if ((go as any)._isThumbBg && go instanceof Phaser.GameObjects.Rectangle)
            go.setStrokeStyle(2, 0x886600);
        });
        bg.setStrokeStyle(2, 0xffd700);
      });

      utilGroup.push(bg, img, lbl);
    });

    utilGroup.forEach(go => {
      (go as any).setVisible(false);
      if (go instanceof Phaser.GameObjects.Rectangle) go.disableInteractive();
    });
    this._tabGroups.set('UTILS', utilGroup);

    // ── BG — seletor de terreno ────────────────────────────────────────────────
    TERRAINS.forEach((terrain, i) => {
      addBtn('BG', i % COLS, Math.floor(i / COLS), terrain.toUpperCase(), 0x101825, () => {
        this.currentTerrain = terrain;
        this._buildBg(terrain);
        this._showLabel(`bg_battle_${terrain}`);
      });
    });
  }

  // ── Back button ───────────────────────────────────────────────────────────────

  private _buildBackBtn(): void {
    const bg = this.add.rectangle(46, 22, 80, 26, 0x1a1a1a)
      .setStrokeStyle(1, 0x666666).setDepth(200).setInteractive({ useHandCursor: true });
    this.add.text(46, 22, '← BACK', { fontFamily: 'VT323, monospace', fontSize: '14px', color: '#cccccc' })
      .setOrigin(0.5).setDepth(201);
    bg.on('pointerover', () => bg.setFillStyle(0x333333));
    bg.on('pointerout',  () => bg.setFillStyle(0x1a1a1a));
    bg.on('pointerdown', () => this.scene.stop());
  }
}
