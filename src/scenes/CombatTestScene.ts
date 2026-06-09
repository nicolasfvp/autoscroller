/**
 * CombatTestScene — sandbox visual para testar animações e efeitos de combate.
 * Acessível via DebugOverlayScene. Não depende de RunState nem CombatEngine.
 */

import Phaser from 'phaser';
import { CombatEffects } from '../effects/CombatEffects';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { getRun, hasActiveRun } from '../state/RunState';

const HERO_X = 200;
const HERO_Y = 330;
const ENEMY_X = 530;
const ENEMY_Y = 310;

// Painel hambúrguer — posição do botão
const MENU_BTN_X = 750;
const MENU_BTN_Y = 22;

// Painel expandido — ocupa a parte superior como overlay
const PANEL_X      = 10;
const PANEL_Y      = 50;
const PANEL_W      = 770;
const PANEL_H      = 210;
const BTN_W        = 110;
const BTN_H        = 26;
const BTN_GAP      = 6;
const ROW_H        = BTN_H + BTN_GAP;

export class CombatTestScene extends Phaser.Scene {
  private effects!: CombatEffects;
  private heroSprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

  private _menuOpen = false;
  private _menuObjects: Phaser.GameObjects.GameObject[] = [];
  private _menuObjectsOrigY: number[] = [];
  private _menuPanelBg!: Phaser.GameObjects.Rectangle;
  private _menuBtnBg!: Phaser.GameObjects.Rectangle;
  private _menuBtnText!: Phaser.GameObjects.Text;

  private _channelYOffset = 0;
  private _channelYLabel!: Phaser.GameObjects.Text;

  private _fireSprite:  Phaser.GameObjects.Sprite | null = null;
  private _bleedSprite: Phaser.GameObjects.Sprite | null = null;
  private _stunSprite:  Phaser.GameObjects.Sprite | null = null;
  private _auraSprite:  Phaser.GameObjects.Sprite | null = null;
  private _leafSprite:  Phaser.GameObjects.Sprite | null = null;

  private _labelText!: Phaser.GameObjects.Text;
  private _labelTimer: Phaser.Time.TimerEvent | null = null;

  private currentEnemyIdx = 0;
  private readonly ENEMY_POOL = [
    'monster_slime', 'monster_werewolf', 'monster_skeleton', 'monster_lava_golem',
    'monster_vampire', 'monster_toxic_gooze', 'monster_boss_iron_golem',
    'monster_infernal_dragon', 'monster_bog_witch',
  ];

  constructor() { super({ key: 'CombatTestScene' }); }

  create(): void {
    // Background
    if (this.textures.exists('bg_battle_forest')) {
      this.add.image(400, 300, 'bg_battle_forest').setDisplaySize(800, 600).setDepth(0);
    } else {
      this.add.rectangle(400, 300, 800, 600, 0x1a1a2e).setDepth(0);
    }

    this.effects = new CombatEffects(this);
    this._buildHero();
    this._buildEnemy();
    this._buildHamburgerBtn();
    this._buildMenu();         // constrói oculto
    this._buildBackBtn();

    // Label de feedback
    this._labelText = this.add.text(400, 580, '', {
      fontFamily: 'VT323, monospace', fontSize: '14px', color: '#aaffaa',
    }).setOrigin(0.5, 1).setDepth(200);
  }

  // ── Hero ──────────────────────────────────────────────────────────────────────

  private _prefix(): string {
    return hasActiveRun() ? getSpritePrefix(getRun().hero.className ?? 'warrior') : 'hero';
  }

  private _buildHero(): void {
    const idleKey = `${this._prefix()}_battle_stance`;
    const fallbackKey = `${this._prefix()}_idle`;
    const resolvedKey = this.textures.exists(idleKey) ? idleKey : fallbackKey;
    if (this.textures.exists(resolvedKey)) {
      const idleKey = resolvedKey;
      const frameTotal = this.textures.get(idleKey).frameTotal - 1;
      const scale = frameTotal > 1 ? 0.6034 : 0.65;
      this.heroSprite = this.add.sprite(HERO_X, HERO_Y, idleKey).setDepth(10).setScale(scale);
      if (frameTotal > 1) {
        const k = 'cbt_hero_idle';
        if (!this.anims.exists(k))
          this.anims.create({ key: k, frames: this.anims.generateFrameNumbers(idleKey, { start: 0, end: frameTotal - 1 }), frameRate: 8, repeat: -1 });
        (this.heroSprite as Phaser.GameObjects.Sprite).play(k);
      }
    } else {
      this.heroSprite = this.add.sprite(HERO_X, HERO_Y, '__DEFAULT').setDisplaySize(100, 100).setDepth(10);
    }
    if (this.textures.exists('hero_shadow'))
      this.add.image(HERO_X - 10, HERO_Y + 160, 'hero_shadow').setDisplaySize(190, 42).setAlpha(0.6).setDepth(9);
    else
      this.add.ellipse(HERO_X, HERO_Y + 162, 140, 24, 0x000000, 0.4).setDepth(9);
  }

  private _playHeroAnim(textureKey: string, animKey: string, fps: number, repeat: number, yOffset = 0): void {
    if (!this.textures.exists(textureKey)) { this._showLabel(`Nao encontrado: ${textureKey}`); return; }
    if (!(this.heroSprite instanceof Phaser.GameObjects.Sprite)) return;
    if (!this.anims.exists(animKey)) {
      const n = this.textures.get(textureKey).frameTotal - 1;
      this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: n - 1 }), frameRate: fps, repeat });
    }
    // Scale e Y por animação — ajustados via debug-layout para manter pés alinhados
    const ANIM_OVERRIDES: Record<string, { scale: number; y: number }> = {
      hero_attack:  { scale: 0.6118, y: 301.6 },
      hero_channel: { scale: 0.6529, y: 318.8 },
    };
    const ov = ANIM_OVERRIDES[textureKey];
    const scale = ov ? ov.scale : 0.6034;
    const y     = ov ? ov.y     : HERO_Y + yOffset;
    this.heroSprite.setScale(scale).setY(y).play(animKey);
    if (repeat === 0) {
      this.heroSprite.once('animationcomplete', () => { this._returnToIdle(); });
    } else if (repeat === -1 && animKey !== 'cbt_hero_idle') {
      this.time.delayedCall(1500, () => { this._returnToIdle(); });
    }
  }

  private _returnToIdle(): void {
    if (!(this.heroSprite instanceof Phaser.GameObjects.Sprite)) return;
    this.heroSprite.stop();
    this.heroSprite.setScale(0.6034).setX(HERO_X).setY(HERO_Y);
    if (this.anims.exists('cbt_hero_idle')) this.heroSprite.play('cbt_hero_idle');
    this._auraSprite?.destroy(); this._auraSprite = null;
    this._leafSprite?.destroy(); this._leafSprite = null;
  }

  // ── Enemy ─────────────────────────────────────────────────────────────────────

  private _buildEnemy(): void {
    const key = this.ENEMY_POOL[this.currentEnemyIdx];
    this.enemySprite = this.textures.exists(key)
      ? this.add.image(ENEMY_X, ENEMY_Y, key).setDisplaySize(190, 190).setDepth(10)
      : this.add.rectangle(ENEMY_X, ENEMY_Y, 120, 120, 0xcc3333).setDepth(10);
    if (this.textures.exists('hero_shadow'))
      this.add.image(ENEMY_X, ENEMY_Y + 95, 'hero_shadow').setDisplaySize(175, 38).setAlpha(0.5).setDepth(9);
  }

  private _cycleEnemy(): void {
    this.currentEnemyIdx = (this.currentEnemyIdx + 1) % this.ENEMY_POOL.length;
    const key = this.ENEMY_POOL[this.currentEnemyIdx];
    if (this.enemySprite instanceof Phaser.GameObjects.Image && this.textures.exists(key))
      this.enemySprite.setTexture(key);
    this._showLabel(`Enemy: ${key.replace('monster_', '')}`);
  }

  // ── Feedback ──────────────────────────────────────────────────────────────────

  private _showLabel(msg: string): void {
    this._labelText?.setText(msg).setAlpha(1);
    this._labelTimer?.remove();
    this._labelTimer = this.time.delayedCall(2500, () =>
      this.tweens.add({ targets: this._labelText, alpha: 0, duration: 400 }));
  }

  // ── Hamburger button ──────────────────────────────────────────────────────────

  private _buildHamburgerBtn(): void {
    // depth=5: abaixo do herói (10) para que o DebugManager priorize o herói ao clicar nele.
    // Visualmente o botão fica no canto superior direito, longe do herói.
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
    this._menuObjects.forEach((go, i) => {
      const o = go as any;
      o.setVisible(this._menuOpen);
      // Mover para fora da tela quando fechado para que getBounds() não intercepte cliques na arena
      o.setY(this._menuOpen ? this._menuObjectsOrigY[i] : -2000);
      if (this._menuOpen) o.setInteractive?.();
      else o.disableInteractive?.();
    });
    this._menuPanelBg
      .setVisible(this._menuOpen)
      .setAlpha(this._menuOpen ? 0.93 : 0)
      .setY(this._menuOpen ? PANEL_Y + PANEL_H / 2 : -2000);
  }

  // ── Menu (construído mas oculto) ──────────────────────────────────────────────

  private _trackMenu(go: Phaser.GameObjects.GameObject): Phaser.GameObjects.GameObject {
    this._menuObjects.push(go);
    this._menuObjectsOrigY.push((go as any).y ?? 0);
    return go;
  }

  private _buildMenu(): void {
    this._menuObjects = [];
    this._menuObjectsOrigY = [];

    // Fundo do painel — quando fechado, alpha=0 e sem interatividade.
    // NÃO usar depth negativo pois o DebugManager inclui objetos com depth<0.
    this._menuPanelBg = this.add.rectangle(PANEL_X + PANEL_W / 2, PANEL_Y + PANEL_H / 2, PANEL_W, PANEL_H, 0x0d0d0d, 0.93)
      .setStrokeStyle(1, 0x886600).setDepth(60).setAlpha(0).setVisible(false);

    let col = PANEL_X + 10;
    const startY = PANEL_Y + 10;

    const addSection = (title: string, buttons: Array<{ label: string; color: number; action: () => void }>) => {
      const sectionW = BTN_W + 10;
      // Título da seção
      const t = this.add.text(col + sectionW / 2, startY, title, {
        fontFamily: 'VT323, monospace', fontSize: '11px', color: '#886600',
      }).setOrigin(0.5, 0).setDepth(62);
      this._trackMenu(t);

      let by = startY + 14;
      buttons.forEach(({ label, color, action }) => {
        const bx = col + sectionW / 2;
        const bbg = this.add.rectangle(bx, by + BTN_H / 2, BTN_W, BTN_H, color)
          .setStrokeStyle(1, 0x886600).setDepth(61).setInteractive({ useHandCursor: true });
        const bt = this.add.text(bx, by + BTN_H / 2, label, {
          fontFamily: 'VT323, monospace', fontSize: '11px', color: '#ffd700',
        }).setOrigin(0.5).setDepth(62);
        bbg.on('pointerover', () => bbg.setFillStyle(0x3a2800));
        bbg.on('pointerout',  () => bbg.setFillStyle(color));
        bbg.on('pointerdown', () => { action(); this._toggleMenu(); });
        this._trackMenu(bbg);
        this._trackMenu(bt);
        by += ROW_H;
      });

      col += sectionW + 6;
    };

    const p = this._prefix();

    // Seção ANIMATIONS
    addSection('ANIMATIONS', [
      { label: 'IDLE',    color: 0x1a2a1a, action: () => { this._playHeroAnim(`${p}_idle`,    'cbt_hero_idle',    8,  -1); this._showLabel('idle'); } },
      { label: 'ATTACK',  color: 0x2a1a1a, action: () => { this._playHeroAnim(`${p}_attack`,  'cbt_hero_attack',  12,  0); this._showLabel('attack'); } },
      { label: 'CAST',    color: 0x1a1a2a, action: () => { this._playHeroAnim(`${p}_cast`,    'cbt_hero_cast',    10,  0); this._showLabel('cast'); } },
      { label: 'DEFEND',  color: 0x1a2020, action: () => { this._playHeroAnim(`${p}_defend`,  'cbt_hero_defend',   8, -1); this.effects.shieldEffect(HERO_X, HERO_Y); this._showLabel('defend'); } },
      { label: 'HIT',     color: 0x2a1a00, action: () => { this._playHeroAnim(`${p}_hit`,     'cbt_hero_hit',     10,  0); this._hitHero(); this._showLabel('hit'); } },
      { label: 'CHANNEL', color: 0x1a102a, action: () => { this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel',  6, -1, this._channelYOffset); this._showLabel(`channel  Y:${this._channelYOffset}`); } },
    ]);

    // Seção CHANNEL Y — só botões de offset, sem fechar o menu
    const chW = BTN_W + 10;
    const chTitle = this.add.text(col + chW / 2, startY, 'CHANNEL Y', {
      fontFamily: 'VT323, monospace', fontSize: '11px', color: '#886600',
    }).setOrigin(0.5, 0).setDepth(62);
    this._trackMenu(chTitle);

    // Label do offset
    this._channelYLabel = this.add.text(col + chW / 2, startY + 16, 'offset: 0', {
      fontFamily: 'VT323, monospace', fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5, 0).setDepth(62);
    this._trackMenu(this._channelYLabel);

    const chOffsets = [{ d: -20, l: '-20' }, { d: -5, l: '-5' }, { d: +5, l: '+5' }, { d: +20, l: '+20' }];
    let chY = startY + 34;
    chOffsets.forEach(({ d, l }) => {
      const bx = col + chW / 2;
      const bbg = this.add.rectangle(bx, chY + BTN_H / 2, BTN_W, BTN_H, 0x221a33)
        .setStrokeStyle(1, 0x886600).setDepth(61).setInteractive({ useHandCursor: true });
      const bt = this.add.text(bx, chY + BTN_H / 2, l, {
        fontFamily: 'VT323, monospace', fontSize: '13px', color: '#ffcc44',
      }).setOrigin(0.5).setDepth(62);
      bbg.on('pointerover', () => bbg.setFillStyle(0x3a2a50));
      bbg.on('pointerout',  () => bbg.setFillStyle(0x221a33));
      bbg.on('pointerdown', () => {
        this._channelYOffset += d;
        this._channelYLabel.setText(`offset: ${this._channelYOffset}`);
        this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel', 6, -1, this._channelYOffset);
        this._showLabel(`channel Y offset: ${this._channelYOffset}`);
        // NÃO fecha o menu — permite ajuste incremental
      });
      this._trackMenu(bbg);
      this._trackMenu(bt);
      chY += ROW_H;
    });
    col += chW + 6;

    // Seção FX EFFECTS
    addSection('FX EFFECTS', [
      { label: 'FX SLASH',  color: 0x2a1500, action: () => { this.effects.enemyAttackEffect(HERO_X, HERO_Y, 'fx_slash'); this._hitHero(); this._showLabel('fx_slash'); } },
      { label: 'FX STOMP',  color: 0x2a1500, action: () => { this.effects.enemyAttackEffect(HERO_X, HERO_Y, 'fx_stomp'); this._hitHero(); this._showLabel('fx_stomp'); } },
      { label: 'FX BITE',   color: 0x2a1500, action: () => { this.effects.enemyAttackEffect(HERO_X, HERO_Y, 'fx_bite');  this._hitHero(); this._showLabel('fx_bite'); } },
      { label: 'FLOAT DMG', color: 0x2a1500, action: () => { this.effects.floatingNumber(HERO_X, HERO_Y - 40, Math.floor(Math.random() * 80 + 10), '#ff4444', '-'); this._showLabel('floatingDmg'); } },
      { label: 'SCREEN SHK',color: 0x2a1000, action: () => { this.effects.screenShake(5, 200); this._showLabel('screenShake'); } },
    ]);

    // Seção UTILS
    addSection('UTILS', [
      { label: 'CYCLE ENEMY', color: 0x1a1a1a, action: () => this._cycleEnemy() },
      { label: 'FX FIRE',    color: 0x2a1000, action: () => {
        if (this._fireSprite)  { this._fireSprite.destroy();  this._fireSprite  = null; this._showLabel('fx_fire OFF'); }
        else { this._fireSprite  = this.effects.statusEffect(HERO_X, HERO_Y + 150, 'fx_fire',  180) ?? null; this._showLabel('fx_fire ON'); }
      }},
      { label: 'FX BLEED',   color: 0x2a1000, action: () => {
        if (this._bleedSprite) { this._bleedSprite.destroy(); this._bleedSprite = null; this._showLabel('fx_bleed OFF'); }
        else { this._bleedSprite = this.effects.statusEffect(HERO_X, HERO_Y + 150, 'fx_bleed', 180) ?? null; this._showLabel('fx_bleed ON'); }
      }},
      { label: 'FX STUN',    color: 0x2a1000, action: () => {
        if (this._stunSprite)  { this._stunSprite.destroy();  this._stunSprite  = null; this._showLabel('fx_stun OFF'); }
        else { this._stunSprite  = this.effects.statusEffect(HERO_X, HERO_Y - 120, 'fx_stun',  160) ?? null; this._showLabel('fx_stun ON'); }
      }},
      { label: 'FX HEAL',    color: 0x0a2a0a, action: () => {
        this._auraSprite?.destroy(); this._auraSprite = null;
        this._leafSprite?.destroy(); this._leafSprite = null;
        this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel', 6, -1, this._channelYOffset);
        this._auraSprite = this.effects.auraEffect(HERO_X, HERO_Y) ?? null;
        this._leafSprite = this.effects.leafEffect(HERO_X, HERO_Y) ?? null;
        this._showLabel('fx_heal');
      }},
      { label: 'FX BUFF',    color: 0x0a0a2a, action: () => {
        this._auraSprite?.destroy(); this._auraSprite = null;
        this._playHeroAnim(`${p}_channel`, 'cbt_hero_channel', 6, -1, this._channelYOffset);
        this._auraSprite = this.effects.auraEffect(HERO_X, HERO_Y, 0x4488ff, 'fx_aura_buff') ?? null;
        this._showLabel('fx_buff');
      }},
    ]);

    // Começa oculto — sem interatividade para não interferir com o DebugManager
    this._menuObjects.forEach(go => {
      const o = go as any;
      o.setVisible(false);
      o.disableInteractive?.();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _hitHero(): void {
    if (!this.heroSprite) return;
    this.heroSprite.setTint(0xff0000);
    this.time.delayedCall(300, () => { if (this.heroSprite) this.heroSprite.clearTint(); });
  }

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
