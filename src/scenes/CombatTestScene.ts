/**
 * CombatTestScene — sandbox visual para testar animações e efeitos de combate.
 * Layout e constantes espelham exatamente o CombatScene (posições, escalas,
 * FX coords, sombras). Acessível via DebugOverlayScene. Sem RunState nem engine.
 */

import Phaser from 'phaser';
import { CombatEffects } from '../effects/CombatEffects';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';

// ── Constantes idênticas ao CombatScene ───────────────────────────────────────
const HERO_X     = 200;
const HERO_Y     = 338.5;
const IDLE_SCALE      = 0.6034;
const MAGE_IDLE_SCALE = 0.3357;
const MAGE_HERO_X     = 180.9;
const MAGE_HERO_Y     = 331.2;
const SHADOW_X   = 183.3;
const SHADOW_Y   = 445.3;
const SHADOW_W   = 243;
const SHADOW_H   = 86;

const ENEMY_X    = 600;
const ENEMY_Y    = 340;
const ENEMY_SIZE = 250;
const ENEMY_SHADOW_X = 600;
const ENEMY_SHADOW_Y = 440;

// FX de ataque do inimigo sobre o herói — CombatScene usa (200, 320)
const ATTACK_FX_X = 230;
const ATTACK_FX_Y = 320;

// Floating numbers — dano no inimigo (600,320), dano no herói (200,320)
const FLOAT_ENEMY_X = 600;
const FLOAT_HERO_X  = 200;
const FLOAT_Y       = 320;

// Status FX — coordenadas calibradas via debug-layout (igual ao CombatScene)
const FX_HERO_FIRE_X   = 182.2; const FX_HERO_FIRE_Y   = 499.1; const FX_HERO_FIRE_SIZE   = 219;
const FX_HERO_BLEED_X  = 203.3; const FX_HERO_BLEED_Y  = 469.5; const FX_HERO_BLEED_SIZE  = 102;
const FX_HERO_STUN_X   = 217.1; const FX_HERO_STUN_Y   = 300.2; const FX_HERO_STUN_SIZE   = 67;
const FX_ENEMY_FX_X    = 602.6; const FX_ENEMY_FX_Y    = 542.2; const FX_ENEMY_FX_SIZE    = 366;
const FX_ENEMY_STUN_X  = 591.4; const FX_ENEMY_STUN_Y  = 301.5; const FX_ENEMY_STUN_SIZE  = 90;
const FX_ENEMY_BLEED_X = 596;   const FX_ENEMY_BLEED_Y = 467.1; const FX_ENEMY_BLEED_SIZE = 161;

// Override de posição/scale por animação — igual ao CombatScene
const ANIM_OVERRIDES: Record<string, { x: number; y: number; scale: number }> = {
  hero_attack:      { x: 190.4, y: 303.5, scale: 0.6118 },
  hero_defend:      { x: 200,   y: 323.4, scale: 0.6034 },
  hero_channel:     { x: 184.8, y: 314.1, scale: 0.6529 },
  mage_defend:      { x: 187.5, y: 328.5, scale: 0.3092 },
  mage_attack:      { x: 196.0, y: 343.4, scale: 0.3357 },
  mage_cast_debuff: { x: 187.5, y: 327.0, scale: 0.3221 },
};

// Terrenos de batalha disponíveis
const TERRAINS = ['basic', 'forest', 'desert', 'graveyard', 'swamp', 'lava', 'ruins'] as const;
type Terrain = typeof TERRAINS[number];

// ── Painel de debug (dock superior) ───────────────────────────────────────────
const MENU_BTN_X = 754;
const MENU_BTN_Y = 22;

// Painel ancorado ao topo da tela — compacto, não cobre a cena de combate.
const PANEL_PAD  = 10;                       // margem interna do painel
const PANEL_W    = 784;
const PANEL_X    = 8;
const PANEL_OUTER_GAP = 6;                   // espaço entre o painel e o topo da tela

// Tabs (segmented control no topo do painel)
const TAB_H      = 22;
const TAB_GAP    = 3;

// Botões de conteúdo — densos
const BTN_H      = 22;
const BTN_GAP    = 5;
const ROW_H      = BTN_H + BTN_GAP;

// Paleta
const COL_BG      = 0x12110f;   // fundo do painel
const COL_BORDER  = 0xb8902f;   // borda dourada
const COL_GOLD    = 0xffd86b;   // texto de destaque
const COL_TEXT    = 0xe8e2d0;   // texto de botão
const COL_MUTED   = 0x8a8576;   // texto secundário
const COL_TAB_ON  = 0x4a3410;   // tab ativa
const COL_TAB_OFF = 0x201a10;   // tab inativa

// Paleta semântica de botões (cores-base, exibidas a ~0.55 de opacidade)
const C_HERO    = 0x6b4a12;   // marrom-âmbar — guerreiro / ações neutras
const C_MAGE    = 0x4a2a6b;   // roxo — maga
const C_REF     = 0x12595a;   // teal — referência/overlay
const C_ACTION  = 0x2e5a30;   // verde — animações de ação
const C_FIRE    = 0x8a3a18;   // laranja-fogo
const C_BLEED   = 0x8a1830;   // vermelho-sangue
const C_STUN    = 0x8a7a18;   // amarelo — atordoar
const C_ICE     = 0x1a4a7a;   // azul — água/gelo
const C_WIND    = 0x1a6a4a;   // verde-água — vento
const C_EARTH   = 0x5a4a1a;   // terra
const C_BUFF    = 0x2a3a7a;   // azul — buff
const C_HEAL    = 0x1a6a3a;   // verde — heal
const C_TUNE    = 0x3a2a5a;   // roxo-acinzentado — tuning/offset
const C_BG      = 0x24344f;   // azul-acinzentado — terrenos

const TAB_NAMES = ['ANIMATIONS', 'FX EFFECTS', 'STATUS', 'UTILS', 'BG'] as const;
type TabName = typeof TAB_NAMES[number];

// Hex → string CSS p/ estilos de texto Phaser
const css = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');

export class CombatTestScene extends Phaser.Scene {
  private effects!: CombatEffects;
  private heroSprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private enemyIdleTimer: Phaser.Time.TimerEvent | null = null;
  private bgImage!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

  private _menuOpen = false;
  private _menuPanel!: Phaser.GameObjects.Container;
  private _menuBtnBg!: Phaser.GameObjects.Rectangle;
  private _menuBtnText!: Phaser.GameObjects.Text;

  private _activeTab: TabName = 'ANIMATIONS';
  private _currentChar: 'warrior' | 'mage' = 'warrior';
  private _tabBgs:    Map<TabName, Phaser.GameObjects.Rectangle>        = new Map();
  private _tabTexts:  Map<TabName, Phaser.GameObjects.Text>             = new Map();
  private _tabGroups: Map<TabName, Phaser.GameObjects.GameObject[]>     = new Map();

  private _warriorRefSprite: Phaser.GameObjects.Image | null = null;

  private _fireSprite:   Phaser.GameObjects.Sprite | null = null;
  private _bleedSprite:  Phaser.GameObjects.Sprite | null = null;
  private _stunSprite:   Phaser.GameObjects.Sprite | null = null;
  private _efireSprite:  Phaser.GameObjects.Sprite | null = null;
  private _ebleedSprite: Phaser.GameObjects.Sprite | null = null;
  private _estunSprite:  Phaser.GameObjects.Sprite | null = null;
  private _auraSprite:     Phaser.GameObjects.Sprite | null = null;
  private _leafSprite:     Phaser.GameObjects.Sprite | null = null;
  private _auraBuffSprite: Phaser.GameObjects.Sprite | null = null;
  private _auraHealSprite: Phaser.GameObjects.Sprite | null = null;

  private currentEnemyIdx = 0;
  private currentTerrain: Terrain = 'forest';
  private readonly ENEMY_POOL = [
    // Cemetery
    'monster_corpse_eater', 'monster_pocket_cat', 'monster_skeleton',
    'monster_vampire', 'monster_werewolf', 'monster_zombie',
    // Default
    'monster_doom_knight',
    // Desert
    'monster_baby_dragon', 'monster_mutated_salamander', 'monster_scorpion',
    // Forest
    'monster_ancient_tree', 'monster_mush',
    // Lava
    'monster_forge_slime', 'monster_lava_golem', 'monster_fire_elemental',
    // Swamp
    'monster_depths_horror', 'monster_toxic_gooze', 'monster_venomous_kobra',
    // Green Field
    'monster_slime', 'monster_red_slime', 'monster_earth_dragon',
    // Root
    'monster_lost_lizard',
    // Bosses
    'monster_bog_witch', 'monster_desert_golem',
    'monster_infernal_dragon', 'monster_boss_iron_golem',
  ];

  constructor() { super({ key: 'CombatTestScene' }); }

  create(): void {
    this._buildBg(this.currentTerrain);
    this.effects = new CombatEffects(this);
    this._buildHero();
    if (this.textures.exists('hero_shadow')) {
      this.add.image(SHADOW_X, SHADOW_Y, 'hero_shadow').setDisplaySize(SHADOW_W, SHADOW_H).setAlpha(0.7).setDepth(9);
      this.add.image(ENEMY_SHADOW_X, ENEMY_SHADOW_Y, 'hero_shadow').setDisplaySize(220, 50).setAlpha(0.7).setDepth(9);
    } else {
      this.add.ellipse(HERO_X, SHADOW_Y, 160, 28, 0x000000, 0.45).setDepth(9);
      this.add.ellipse(ENEMY_SHADOW_X, ENEMY_SHADOW_Y, 160, 28, 0x000000, 0.45).setDepth(9);
    }
    this._buildEnemy();
    this._buildHamburgerBtn();
    this._buildMenu();

    this.events.on('shutdown', () => {
      this.enemyIdleTimer?.destroy();
      this.enemyIdleTimer = null;
      this._warriorRefSprite?.destroy();
      this._warriorRefSprite = null;
      this._auraBuffSprite?.destroy();
      this._auraBuffSprite = null;
      this._auraHealSprite?.destroy();
      this._auraHealSprite = null;
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
    return getSpritePrefix(this._currentChar);
  }

  private _buildHero(): void {
    const p = this._prefix();
    const stanceKey = `${p}_battle_stance`;
    const idleKey   = `${p}_idle`;
    const resolvedKey = this.textures.exists(stanceKey) ? stanceKey : idleKey;
    const isMage = this._currentChar === 'mage';
    const heroScale = isMage ? MAGE_IDLE_SCALE : IDLE_SCALE;
    const heroX     = isMage ? MAGE_HERO_X     : HERO_X;
    const heroY     = isMage ? MAGE_HERO_Y     : HERO_Y;

    if (this.textures.exists(resolvedKey)) {
      const frameTotal = this.textures.get(resolvedKey).frameTotal - 1;
      const scale = frameTotal > 1 ? heroScale : 0.65;
      this.heroSprite = this.add.sprite(heroX, heroY, resolvedKey).setDepth(10).setScale(scale);
      if (frameTotal > 1) {
        const k = 'cbt_hero_idle';
        if (!this.anims.exists(k))
          this.anims.create({ key: k, frames: this.anims.generateFrameNumbers(resolvedKey, { start: 0, end: frameTotal - 1 }), frameRate: 6, repeat: -1 });
        (this.heroSprite as Phaser.GameObjects.Sprite).play(k);
      }
    } else {
      this.heroSprite = this.add.sprite(HERO_X, HERO_Y, '__DEFAULT').setDisplaySize(100, 100).setDepth(10);
    }

  }

  private _playHeroAnim(textureKey: string, animKey: string, fps: number, repeat: number): void {
    if (!this.textures.exists(textureKey)) { return; }
    if (!(this.heroSprite instanceof Phaser.GameObjects.Sprite)) return;
    if (!this.anims.exists(animKey)) {
      const n = this.textures.get(textureKey).frameTotal - 1;
      if (n > 0) this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: n - 1 }), frameRate: fps, repeat });
    }
    const ov = ANIM_OVERRIDES[textureKey];
    const isMageAnim = this._currentChar === 'mage';
    const scale = ov ? ov.scale : (isMageAnim ? MAGE_IDLE_SCALE : IDLE_SCALE);
    const x     = ov ? ov.x     : (isMageAnim ? MAGE_HERO_X : HERO_X);
    const y     = ov ? ov.y     : (isMageAnim ? MAGE_HERO_Y : HERO_Y);
    this.heroSprite.setScale(scale).setX(x).setY(y).play(animKey);
    if (repeat === 0) {
      this.heroSprite.once('animationcomplete', () => this._returnToIdle());
    } else if (repeat === -1 && animKey !== 'cbt_hero_idle') {
      this.time.delayedCall(1500, () => this._returnToIdle());
    }
  }

  private _returnToIdle(): void {
    if (!(this.heroSprite instanceof Phaser.GameObjects.Sprite)) return;
    const isMage = this._currentChar === 'mage';
    this.heroSprite.stop().setScale(isMage ? MAGE_IDLE_SCALE : IDLE_SCALE).setX(isMage ? MAGE_HERO_X : HERO_X).setY(isMage ? MAGE_HERO_Y : HERO_Y);
    if (this.anims.exists('cbt_hero_idle')) this.heroSprite.play('cbt_hero_idle');
    this._auraSprite?.destroy(); this._auraSprite = null;
    this._leafSprite?.destroy(); this._leafSprite = null;
  }

  private _switchChar(char: 'warrior' | 'mage'): void {
    this._currentChar = char;
    this.heroSprite?.destroy();
    this.anims.remove('cbt_hero_idle');
    this.anims.remove('cbt_hero_attack');
    this.anims.remove('cbt_hero_cast');
    this.anims.remove('cbt_hero_defend');
    this.anims.remove('cbt_hero_hit');
    this.anims.remove('cbt_hero_channel');
    this._buildHero();
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
    this._startEnemyIdle(key);
  }

  private _startEnemyIdle(key: string): void {
    this.enemyIdleTimer?.destroy();
    this.enemyIdleTimer = null;
    // Descobrir quantos frames existem: key (frame 0), key_2, key_3, …
    const frames: string[] = [key];
    for (let n = 2; this.textures.exists(`${key}_${n}`); n++)
      frames.push(`${key}_${n}`);
    if (frames.length < 2) return;
    let idx = 0;
    this.enemyIdleTimer = this.time.addEvent({
      delay: Math.round(1000 / 6), loop: true,
      callback: () => {
        if (!(this.enemySprite instanceof Phaser.GameObjects.Image)) return;
        idx = (idx + 1) % frames.length;
        this.enemySprite.setTexture(frames[idx]);
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
      }

  // ── Feedback ──────────────────────────────────────────────────────────────────


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
    this._menuBtnBg = this.add.rectangle(MENU_BTN_X, MENU_BTN_Y, 40, 26, COL_TAB_OFF)
      .setStrokeStyle(1, COL_BORDER).setDepth(70).setInteractive({ useHandCursor: true });
    this._menuBtnText = this.add.text(MENU_BTN_X, MENU_BTN_Y, '☰', {
      fontFamily: 'VT323, monospace', fontSize: '18px', color: css(COL_GOLD),
    }).setOrigin(0.5).setDepth(71);
    this._menuBtnBg.on('pointerover', () => this._menuBtnBg.setFillStyle(COL_TAB_ON));
    this._menuBtnBg.on('pointerout',  () => this._menuBtnBg.setFillStyle(COL_TAB_OFF));
    this._menuBtnBg.on('pointerdown', () => this._toggleMenu());
  }

  private _toggleMenu(): void {
    this._menuOpen = !this._menuOpen;
    this._menuBtnText.setText(this._menuOpen ? '✕' : '☰');
    this._menuBtnBg.setFillStyle(this._menuOpen ? COL_TAB_ON : COL_TAB_OFF);

    this._menuPanel.setVisible(this._menuOpen);
    if (this._menuOpen) {
      this._menuPanel.setAlpha(0);
      this.tweens.add({ targets: this._menuPanel, alpha: 1, duration: 130, ease: 'Cubic.out' });
    }

    TAB_NAMES.forEach(tab => this._setTabVisible(tab, this._menuOpen && tab === this._activeTab));
    this._tabBgs.forEach(bg => {
      bg.setVisible(this._menuOpen);
      if (this._menuOpen) bg.setInteractive({ useHandCursor: true }); else bg.disableInteractive();
    });
    this._tabTexts.forEach(t => t.setVisible(this._menuOpen));
  }

  private _setTabVisible(tab: TabName, visible: boolean): void {
    (this._tabGroups.get(tab) ?? []).forEach(go => {
      const o = go as any;
      o.setVisible(visible);
      o.setY(visible ? o._origY : -2000);
      if (visible && o._interactiveConfig) o.setInteractive(o._interactiveConfig);
      else if (!visible && go.input) o.disableInteractive();
    });
    this._styleTab(tab);
  }

  private _styleTab(tab: TabName): void {
    const bg = this._tabBgs.get(tab);
    const txt = this._tabTexts.get(tab);
    const active = tab === this._activeTab;
    if (bg) bg.setFillStyle(active ? COL_TAB_ON : COL_TAB_OFF).setStrokeStyle(1, active ? COL_GOLD : COL_BORDER);
    if (txt) txt.setColor(active ? css(COL_GOLD) : css(COL_MUTED));
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

    // ── Cálculo dinâmico da altura do painel ──────────────────────────────────
    // Conta linhas de conteúdo por aba e usa o máximo para dimensionar o painel.
    const COLS = 5;
    const THUMB      = 46;
    const THUMBG     = 6;
    const THUMB_ROW_H = THUMB + THUMBG + 8;  // altura de cada linha do grid UTILS
    const THUMBS_PER_ROW = 14;

    const contentRows: Record<TabName, number> = {
      'ANIMATIONS': 3,   // row 0: WARRIOR/MAGE/REF, row 1: IDLE/ATTACK/CAST/DEFEND/HIT, row 2: CHANNEL
      'FX EFFECTS': Math.ceil(11 / COLS),
      'STATUS':     Math.ceil(10 / COLS),
      'UTILS':      Math.ceil(this.ENEMY_POOL.length / THUMBS_PER_ROW),
      'BG':         Math.ceil(TERRAINS.length / COLS),
    };

    // Altura de conteúdo por aba (linhas × altura por linha + padding inferior)
    const CONTENT_PAD_BOTTOM = 10;
    const contentHeights: Record<TabName, number> = {
      'ANIMATIONS': contentRows['ANIMATIONS'] * ROW_H + CONTENT_PAD_BOTTOM,
      'FX EFFECTS': contentRows['FX EFFECTS'] * ROW_H + CONTENT_PAD_BOTTOM,
      'STATUS':     contentRows['STATUS']     * ROW_H + CONTENT_PAD_BOTTOM,
      'UTILS':      contentRows['UTILS']      * THUMB_ROW_H + CONTENT_PAD_BOTTOM,
      'BG':         contentRows['BG']         * ROW_H + CONTENT_PAD_BOTTOM,
    };

    const maxContentH = Math.max(...(Object.values(contentHeights) as number[]));
    // Altura total = topo (pad + tab + separador gap) + conteúdo maior
    const HEADER_H  = PANEL_PAD + TAB_H + 10;   // espaço acima da área de conteúdo
    const PANEL_H   = HEADER_H + maxContentH;
    const PANEL_Y   = PANEL_OUTER_GAP;
    const TAB_Y     = PANEL_Y + PANEL_PAD + TAB_H / 2;
    const CONTENT_Y = TAB_Y + TAB_H / 2 + 10;

    // ── Painel dock (container com fundo arredondado via Graphics) ────────────
    this._menuPanel = this.add.container(0, 0).setDepth(60).setVisible(false);

    const g = this.add.graphics();
    // sombra de elevação sutil
    g.fillStyle(0x000000, 0.35).fillRoundedRect(PANEL_X + 3, PANEL_Y + 4, PANEL_W, PANEL_H, 10);
    // corpo do painel
    g.fillStyle(COL_BG, 0.9).fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);
    // borda dourada
    g.lineStyle(1.5, COL_BORDER, 0.9).strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 10);
    // faixa separadora abaixo das tabs
    const sepY = TAB_Y + TAB_H / 2 + 5;
    g.lineStyle(1, COL_BORDER, 0.25).beginPath();
    g.moveTo(PANEL_X + PANEL_PAD, sepY); g.lineTo(PANEL_X + PANEL_W - PANEL_PAD, sepY);
    g.strokePath();
    this._menuPanel.add(g);

    // ── Tabs (segmented control) ──────────────────────────────────────────────
    const TABS_W  = PANEL_W - PANEL_PAD * 2;
    const TAB_W   = (TABS_W - TAB_GAP * (TAB_NAMES.length - 1)) / TAB_NAMES.length;
    TAB_NAMES.forEach((tab, i) => {
      const tx = PANEL_X + PANEL_PAD + i * (TAB_W + TAB_GAP) + TAB_W / 2;
      const bg = this.add.rectangle(tx, TAB_Y, TAB_W, TAB_H, i === 0 ? COL_TAB_ON : COL_TAB_OFF)
        .setStrokeStyle(1, i === 0 ? COL_GOLD : COL_BORDER).setVisible(false).setInteractive({ useHandCursor: true });
      const t = this.add.text(tx, TAB_Y, tab, {
        fontFamily: 'VT323, monospace', fontSize: '12px', color: css(COL_MUTED),
      }).setOrigin(0.5).setVisible(false);
      bg.on('pointerover', () => { if (tab !== this._activeTab) bg.setFillStyle(0x322510); });
      bg.on('pointerout',  () => { if (tab !== this._activeTab) bg.setFillStyle(COL_TAB_OFF); });
      bg.on('pointerdown', () => this._switchTab(tab));
      this._menuPanel.add([bg, t]);
      this._tabBgs.set(tab, bg);
      this._tabTexts.set(tab, t);
    });
    this._styleTab('ANIMATIONS');

    const GRID_W    = PANEL_W - PANEL_PAD * 2;
    const COL_W     = GRID_W / COLS;

    const addBtn = (
      tab: TabName, col: number, row: number,
      label: string, color: number, action: () => void,
    ) => {
      const bx = PANEL_X + PANEL_PAD + col * COL_W + COL_W / 2;
      const by = CONTENT_Y + row * ROW_H + BTN_H / 2;
      const bw = COL_W - 6;
      const bbg = this.add.rectangle(bx, by, bw, BTN_H, color, 0.55)
        .setStrokeStyle(1, COL_BORDER, 0.55).setDepth(61).setInteractive({ useHandCursor: true });
      const bt = this.add.text(bx, by, label, {
        fontFamily: 'VT323, monospace', fontSize: '11px', color: css(COL_TEXT),
      }).setOrigin(0.5).setDepth(62);
      const cfg = { useHandCursor: true };
      bbg.on('pointerover', () => { bbg.setFillStyle(color, 0.95).setStrokeStyle(1, COL_GOLD, 0.9); bt.setColor(css(COL_GOLD)); });
      bbg.on('pointerout',  () => { bbg.setFillStyle(color, 0.55).setStrokeStyle(1, COL_BORDER, 0.55); bt.setColor(css(COL_TEXT)); });
      bbg.on('pointerdown', action);
      (bbg as any)._interactiveConfig = cfg;
      (bbg as any)._origY = by; (bt as any)._origY = by;
      const group = this._tabGroups.get(tab) ?? [];
      group.push(bbg, bt);
      this._tabGroups.set(tab, group);
      bbg.setVisible(false).disableInteractive();
      bt.setVisible(false);
    };

    // ── ANIMATIONS — selector de personagem na linha 0 ────────────────────────
    addBtn('ANIMATIONS', 0, 0, 'WARRIOR',     C_HERO, () => this._switchChar('warrior'));
    addBtn('ANIMATIONS', 1, 0, 'MAGE',        C_MAGE, () => this._switchChar('mage'));
    addBtn('ANIMATIONS', 2, 0, 'WARRIOR REF', C_REF,  () => {
      if (this._warriorRefSprite) {
        this._warriorRefSprite.destroy();
        this._warriorRefSprite = null;
      } else {
        const tex = this.textures.get('hero_battle_stance');
        const frame = tex.get(0);
        const img = this.add.image(342.9, 513.8, 'hero_battle_stance', 0)
          .setScale(IDLE_SCALE)
          .setAlpha(0.45)
          .setDepth(20)
          .setOrigin(0.5, 1);
        void frame;
        this._warriorRefSprite = img;
      }
    });

    // ── ANIMATIONS — animações na linha 1, CHANNEL na linha 2 ─────────────────
    const animRow1: Array<[string, number, () => void]> = [
      ['IDLE',   C_ACTION, () => { const pp = this._prefix(); this._playHeroAnim(`${pp}_idle`,   `cbt_hero_idle`,    8, -1); }],
      ['ATTACK', C_ACTION, () => { const pp = this._prefix(); const fps = pp === 'mage' ? 10 : 12; this._playHeroAnim(`${pp}_attack`, `cbt_hero_attack`, fps,  0); }],
      ['CAST',   C_ACTION, () => { const pp = this._prefix(); this._playHeroAnim(`${pp}_cast`,   `cbt_hero_cast`,   10,  0); }],
      ['DEFEND', C_ACTION, () => { const pp = this._prefix(); this._playHeroAnim(`${pp}_defend`, `cbt_hero_defend`,  8, -1); this.effects.shieldEffect(HERO_X, HERO_Y); }],
      ['HIT',    C_ACTION, () => { const pp = this._prefix(); this._playHeroAnim(`${pp}_hit`,    `cbt_hero_hit`,    10,  0); this._hitHero(); }],
    ];
    animRow1.forEach(([label, color, action], i) => addBtn('ANIMATIONS', i, 1, label, color, action));

    addBtn('ANIMATIONS', 0, 2, 'CHANNEL', C_ACTION, () => { const pp = this._prefix(); const chanKey = pp === 'mage' ? 'mage_cast_debuff' : `${pp}_channel`; this._playHeroAnim(chanKey, 'cbt_hero_channel', 6, -1); });

    // ── FX EFFECTS ─────────────────────────────────────────────────────────────
    const fxBtns: Array<[string, number, () => void]> = [
      ['FX SLASH',    C_HERO,  () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash',       true); this._hitHero(); }],
      ['FX CLAW',     C_HERO,  () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_claw',        true); this._hitHero(); }],
      ['FX STOMP',    C_HERO,  () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_stomp',       true); this._hitHero(); }],
      ['FX BITE',     C_HERO,  () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_bite',        true); this._hitHero(); }],
      ['SLASH FIRE',  C_FIRE,  () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_fire',  true); this._hitHero(); }],
      ['SLASH WATER', C_ICE,   () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_water', true); this._hitHero(); }],
      ['SLASH WIND',  C_WIND,  () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_wind',  true); this._hitHero(); }],
      ['SLASH EARTH', C_EARTH, () => { this.effects.enemyAttackEffect(ATTACK_FX_X, ATTACK_FX_Y, 'fx_slash_earth', true); this._hitHero(); }],
      ['FLOAT DMG E', C_STUN,  () => { this.effects.floatingNumber(FLOAT_ENEMY_X, FLOAT_Y, Math.floor(Math.random() * 80 + 10), '#ffffff', '-'); this._hitEnemy(); }],
      ['FLOAT DMG H', C_BLEED, () => { this.effects.floatingNumber(FLOAT_HERO_X, FLOAT_Y, Math.floor(Math.random() * 80 + 10), '#ff4444', '-'); this._hitHero(); }],
      ['SCREEN SHK',  C_TUNE,  () => { this.effects.screenShake(5, 200); }],
    ];
    fxBtns.forEach(([label, color, action], i) =>
      addBtn('FX EFFECTS', i % COLS, Math.floor(i / COLS), label, color, action));

    // ── STATUS ─────────────────────────────────────────────────────────────────
    const statusBtns: Array<[string, number, () => void]> = [
      // Herói
      ['HERO FIRE',   C_FIRE, () => {
        if (this._fireSprite)  { this._fireSprite.destroy();  this._fireSprite  = null; }
        else { this._fireSprite  = this.effects.statusEffect(FX_HERO_FIRE_X,  FX_HERO_FIRE_Y,  'fx_fire',  FX_HERO_FIRE_SIZE)  ?? null; }
      }],
      ['HERO BLEED',  C_BLEED, () => {
        if (this._bleedSprite) { this._bleedSprite.destroy(); this._bleedSprite = null; }
        else { this._bleedSprite = this.effects.statusEffect(FX_HERO_BLEED_X, FX_HERO_BLEED_Y, 'fx_bleed', FX_HERO_BLEED_SIZE) ?? null; }
      }],
      ['HERO STUN',   C_STUN, () => {
        if (this._stunSprite)  { this._stunSprite.destroy();  this._stunSprite  = null; }
        else { this._stunSprite  = this.effects.statusEffect(FX_HERO_STUN_X,  FX_HERO_STUN_Y,  'fx_stun',  FX_HERO_STUN_SIZE)  ?? null; }
      }],
      // Inimigo
      ['ENMY FIRE',   C_FIRE, () => {
        if (this._efireSprite)  { this._efireSprite.destroy();  this._efireSprite  = null; }
        else { this._efireSprite  = this.effects.statusEffect(FX_ENEMY_FX_X, FX_ENEMY_FX_Y, 'fx_fire',  FX_ENEMY_FX_SIZE)  ?? null; }
      }],
      ['ENMY BLEED',  C_BLEED, () => {
        if (this._ebleedSprite) { this._ebleedSprite.destroy(); this._ebleedSprite = null; }
        else { this._ebleedSprite = this.effects.statusEffect(FX_ENEMY_BLEED_X, FX_ENEMY_BLEED_Y, 'fx_bleed', FX_ENEMY_BLEED_SIZE) ?? null; }
      }],
      ['ENMY STUN',   C_STUN, () => {
        if (this._estunSprite)  { this._estunSprite.destroy();  this._estunSprite  = null; }
        else { this._estunSprite  = this.effects.statusEffect(FX_ENEMY_STUN_X, FX_ENEMY_STUN_Y, 'fx_stun', FX_ENEMY_STUN_SIZE) ?? null; }
      }],
      // Herói — heal/buff
      ['HERO HEAL',   C_HEAL, () => {
        this._auraSprite?.destroy(); this._auraSprite = null;
        this._leafSprite?.destroy(); this._leafSprite = null;
        const pp = this._prefix(); const chanKey = pp === 'mage' ? 'mage_cast_debuff' : `${pp}_channel`;
        this._playHeroAnim(chanKey, 'cbt_hero_channel', 6, -1);
        this._auraSprite = this.effects.auraEffect(HERO_X, HERO_Y) ?? null;
        this._leafSprite = this.effects.leafEffect(HERO_X, HERO_Y) ?? null;
      }],
      ['HERO BUFF',   C_BUFF, () => {
        this._auraSprite?.destroy(); this._auraSprite = null;
        const pp = this._prefix(); const chanKey = pp === 'mage' ? 'mage_cast_debuff' : `${pp}_channel`;
        this._playHeroAnim(chanKey, 'cbt_hero_channel', 6, -1);
        this._auraSprite = this.effects.auraEffect(HERO_X, HERO_Y, 0x4488ff, 'fx_aura_buff') ?? null;
      }],
      ['AURA BUFF',   C_BUFF, () => {
        if (this._auraBuffSprite) { this._auraBuffSprite.destroy(); this._auraBuffSprite = null; }
        else { this._auraBuffSprite = this.effects.auraEffect(HERO_X, HERO_Y, 0x4488ff, 'fx_aura_buff') ?? null; }
      }],
      ['AURA HEAL',   C_HEAL, () => {
        if (this._auraHealSprite) { this._auraHealSprite.destroy(); this._auraHealSprite = null; }
        else { this._auraHealSprite = this.effects.auraEffect(HERO_X, HERO_Y, 0xffffff, 'fx_aura_heal') ?? null; }
      }],
    ];
    statusBtns.forEach(([label, color, action], i) =>
      addBtn('STATUS', i % COLS, Math.floor(i / COLS), label, color, action));

    // ── UTILS — grid de inimigos ───────────────────────────────────────────────
    const gridW    = THUMBS_PER_ROW * THUMB + (THUMBS_PER_ROW - 1) * THUMBG;
    const gridX0   = PANEL_X + (PANEL_W - gridW) / 2;   // centraliza a grade
    const THUMB_Y0 = CONTENT_Y + THUMB / 2 + 2;
    const utilGroup: Phaser.GameObjects.GameObject[] = [];

    this.ENEMY_POOL.forEach((key, i) => {
      const col = i % THUMBS_PER_ROW;
      const row = Math.floor(i / THUMBS_PER_ROW);
      const tx = gridX0 + col * (THUMB + THUMBG) + THUMB / 2;
      const ty = THUMB_Y0 + row * (THUMB + THUMBG + 8);

      const sel = i === this.currentEnemyIdx;
      const bg = this.add.rectangle(tx, ty, THUMB, THUMB, 0x16140f)
        .setStrokeStyle(sel ? 2 : 1, sel ? COL_GOLD : COL_BORDER, sel ? 1 : 0.5)
        .setDepth(61).setInteractive({ useHandCursor: true });
      (bg as any)._origY = ty;
      (bg as any)._isThumbBg = true;
      (bg as any)._interactiveConfig = { useHandCursor: true };

      const img = this.textures.exists(key)
        ? this.add.image(tx, ty, key).setDisplaySize(THUMB - 6, THUMB - 6).setDepth(62)
        : this.add.rectangle(tx, ty, THUMB - 10, THUMB - 10, 0xcc3333).setDepth(62);
      (img as any)._origY = ty;

      const lbl = this.add.text(tx, ty + THUMB / 2 + 1, key.replace('monster_', '').slice(0, 9), {
        fontFamily: 'VT323, monospace', fontSize: '8px', color: css(COL_MUTED),
      }).setOrigin(0.5, 0).setDepth(63);
      (lbl as any)._origY = ty + THUMB / 2 + 1;

      bg.on('pointerover', () => { if (i !== this.currentEnemyIdx) bg.setFillStyle(0x2a2113); });
      bg.on('pointerout',  () => { if (i !== this.currentEnemyIdx) bg.setFillStyle(0x16140f); });
      bg.on('pointerdown', () => {
        this.currentEnemyIdx = i;
        this._selectEnemy(key);
        utilGroup.forEach(go => {
          if ((go as any)._isThumbBg && go instanceof Phaser.GameObjects.Rectangle)
            go.setFillStyle(0x16140f).setStrokeStyle(1, COL_BORDER, 0.5);
        });
        bg.setStrokeStyle(2, COL_GOLD, 1);
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
      addBtn('BG', i % COLS, Math.floor(i / COLS), terrain.toUpperCase(), C_BG, () => {
        this.currentTerrain = terrain;
        this._buildBg(terrain);
      });
    });
  }

}
