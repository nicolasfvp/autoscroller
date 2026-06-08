/**
 * CombatTestScene — sandbox visual para testar efeitos de combate.
 * Acessível via DebugOverlayScene. Não depende de RunState nem CombatEngine.
 *
 * Layout: replica a CombatScene (background, herói à esquerda, inimigo à
 * direita). Painel inferior com botões para disparar cada efeito / animação.
 */

import Phaser from 'phaser';
import { CombatEffects } from '../effects/CombatEffects';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { getRun, hasActiveRun } from '../state/RunState';

// Posições canônicas — iguais ao CombatScene
const HERO_X = 200;
const HERO_Y = 330;
const HERO_FEET_Y = 450; // y dos pés do herói para efeitos de status no chão
const HERO_HEAD_Y = 210; // y acima da cabeça do herói para efeitos de stun
const ENEMY_X = 600;
const ENEMY_Y = 340;

// Botões do painel
interface FxButton {
  label: string;
  action: () => void;
}

export class CombatTestScene extends Phaser.Scene {
  private effects!: CombatEffects;
  private heroSprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private currentEnemyIdx = 0;

  private _fireSprite: Phaser.GameObjects.Sprite | null = null;
  private _bleedSprite: Phaser.GameObjects.Sprite | null = null;
  private _stunSprite: Phaser.GameObjects.Sprite | null = null;

  // Lista de inimigos disponíveis para testar
  private readonly ENEMY_POOL = [
    'monster_slime', 'monster_werewolf', 'monster_skeleton', 'monster_lava_golem',
    'monster_vampire', 'monster_toxic_gooze', 'monster_boss_iron_golem',
    'monster_infernal_dragon', 'monster_bog_witch',
  ];

  constructor() {
    super({ key: 'CombatTestScene' });
  }

  create(): void {
    // Background de batalha
    const bgKey = 'bg_battle_forest';
    if (this.textures.exists(bgKey)) {
      this.add.image(400, 300, bgKey).setDisplaySize(800, 600).setDepth(0);
    } else {
      this.add.rectangle(400, 300, 800, 600, 0x1a1a2e).setDepth(0);
    }

    this.effects = new CombatEffects(this);

    this._buildHero();
    this._buildEnemy();
    this._buildPanel();
    this._buildBackBtn();

    // Título
    this.add.text(400, 14, 'COMBAT EFFECT TEST', {
      fontFamily: 'VT323, monospace', fontSize: '22px', color: '#ffd700',
    }).setOrigin(0.5, 0).setDepth(100);
  }

  // ── Hero ────────────────────────────────────────────────────────────────────

  private _buildHero(): void {
    // Tenta usar o herói da run ativa; cai em warrior se não houver
    const prefix = hasActiveRun()
      ? getSpritePrefix(getRun().hero.className ?? 'warrior')
      : 'hero';
    const idleKey = `${prefix}_idle`;

    if (this.textures.exists(idleKey)) {
      const frameTotal = this.textures.get(idleKey).frameTotal - 1;
      this.heroSprite = this.add.sprite(HERO_X, HERO_Y, idleKey)
        .setDepth(10)
        .setScale(frameTotal > 1 ? 0.495 : 0.7);

      if (frameTotal > 1) {
        const animKey = `cbt_test_hero_idle`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(idleKey, { start: 0, end: frameTotal - 1 }),
            frameRate: 8,
            repeat: -1,
          });
        }
        (this.heroSprite as Phaser.GameObjects.Sprite).play(animKey);
      }
    } else {
      this.heroSprite = this.add.sprite(HERO_X, HERO_Y, '__DEFAULT')
        .setDisplaySize(96, 96).setDepth(10);
    }

    // Sombra
    if (this.textures.exists('hero_shadow')) {
      this.add.image(HERO_X - 22, HERO_Y + 110, 'hero_shadow')
        .setDisplaySize(220, 50).setAlpha(0.7).setDepth(9);
    } else {
      this.add.ellipse(HERO_X, HERO_Y + 120, 160, 28, 0x000000, 0.45).setDepth(9);
    }
  }

  // ── Enemy ───────────────────────────────────────────────────────────────────

  private _buildEnemy(): void {
    const key = this.ENEMY_POOL[this.currentEnemyIdx];
    if (this.textures.exists(key)) {
      this.enemySprite = this.add.image(ENEMY_X, ENEMY_Y, key)
        .setDisplaySize(250, 250).setDepth(10);
    } else {
      this.enemySprite = this.add.rectangle(ENEMY_X, ENEMY_Y, 160, 160, 0xcc3333).setDepth(10);
    }

    if (this.textures.exists('hero_shadow')) {
      this.add.image(ENEMY_X, ENEMY_Y + 110, 'hero_shadow')
        .setDisplaySize(220, 50).setAlpha(0.7).setDepth(9);
    }
  }

  private _cycleEnemy(): void {
    this.currentEnemyIdx = (this.currentEnemyIdx + 1) % this.ENEMY_POOL.length;
    const key = this.ENEMY_POOL[this.currentEnemyIdx];
    if (this.enemySprite instanceof Phaser.GameObjects.Image) {
      if (this.textures.exists(key)) {
        this.enemySprite.setTexture(key);
      }
    }
    this._showLabel(`Enemy: ${key.replace('monster_', '')}`);
  }

  // ── Feedback label ───────────────────────────────────────────────────────────

  private _labelText!: Phaser.GameObjects.Text;
  private _labelTimer: Phaser.Time.TimerEvent | null = null;

  private _showLabel(msg: string): void {
    if (!this._labelText) {
      this._labelText = this.add.text(400, 560, '', {
        fontFamily: 'VT323, monospace', fontSize: '16px', color: '#aaffaa',
      }).setOrigin(0.5, 1).setDepth(200);
    }
    this._labelText.setText(msg).setAlpha(1);
    this._labelTimer?.remove();
    this._labelTimer = this.time.delayedCall(2000, () => {
      this.tweens.add({ targets: this._labelText, alpha: 0, duration: 400 });
    });
  }

  // ── Panel ───────────────────────────────────────────────────────────────────

  private _buildPanel(): void {
    const panelY = 480;
    // Fundo do painel
    this.add.rectangle(400, panelY + 55, 780, 120, 0x000000, 0.72)
      .setStrokeStyle(1, 0x886600).setDepth(50);

    const buttons: FxButton[] = [
      {
        label: 'FX SLASH',
        action: () => {
          this.effects.enemyAttackEffect(HERO_X, HERO_Y, 'fx_slash');
          this._hitHero();
          this._showLabel('fx_slash — claw / blade attack');
        },
      },
      {
        label: 'FX STOMP',
        action: () => {
          this.effects.enemyAttackEffect(HERO_X, HERO_Y, 'fx_stomp');
          this._hitHero();
          this._showLabel('fx_stomp — ground slam / heavy impact');
        },
      },
      {
        label: 'FX BITE',
        action: () => {
          this.effects.enemyAttackEffect(HERO_X, HERO_Y, 'fx_bite');
          this._hitHero();
          this._showLabel('fx_bite — venom / acid splash');
        },
      },
      {
        label: 'FLOAT DMG',
        action: () => {
          this.effects.floatingNumber(HERO_X, HERO_Y - 40, Math.floor(Math.random() * 80 + 10), '#ff4444', '-');
          this._showLabel('floatingNumber — damage popup');
        },
      },
      {
        label: 'SCREEN SHAKE',
        action: () => {
          this.effects.screenShake(5, 200);
          this._showLabel('screenShake — camera shake');
        },
      },
      {
        label: 'FX FIRE',
        action: () => {
          if (this._fireSprite) {
            this._fireSprite.destroy();
            this._fireSprite = null;
            this._showLabel('fx_fire — desativado');
          } else {
            this._fireSprite = this.effects.statusEffect(HERO_X, HERO_FEET_Y, 'fx_fire', 180) ?? null;
            this._showLabel('fx_fire — burn status (clique novamente para parar)');
          }
        },
      },
      {
        label: 'FX BLEED',
        action: () => {
          if (this._bleedSprite) {
            this._bleedSprite.destroy();
            this._bleedSprite = null;
            this._showLabel('fx_bleed — desativado');
          } else {
            this._bleedSprite = this.effects.statusEffect(HERO_X, HERO_FEET_Y, 'fx_bleed', 180) ?? null;
            this._showLabel('fx_bleed — bleed status (clique novamente para parar)');
          }
        },
      },
      {
        label: 'FX STUN',
        action: () => {
          if (this._stunSprite) {
            this._stunSprite.destroy();
            this._stunSprite = null;
            this._showLabel('fx_stun — desativado');
          } else {
            this._stunSprite = this.effects.statusEffect(HERO_X, HERO_HEAD_Y, 'fx_stun', 160) ?? null;
            this._showLabel('fx_stun — stun status (clique novamente para parar)');
          }
        },
      },
      {
        label: 'CYCLE ENEMY',
        action: () => this._cycleEnemy(),
      },
      {
        label: 'ALL FX',
        action: () => {
          this.effects.enemyAttackEffect(HERO_X, HERO_Y, 'fx_slash');
          this._hitHero();
          this.time.delayedCall(300, () => this.effects.floatingNumber(HERO_X, HERO_Y - 40, 42, '#ff4444', '-'));
          this.time.delayedCall(500, () => this.effects.screenShake(4, 150));
          this._showLabel('All effects chained');
        },
      },
    ];

    const cols = 4;
    const btnW = 168;
    const btnH = 38;
    const gapX = 10;
    const gapY = 8;
    const startX = 400 - ((Math.min(buttons.length, cols) * (btnW + gapX) - gapX) / 2);
    const startY = panelY + 14;

    buttons.forEach((btn, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (btnW + gapX) + btnW / 2;
      const by = startY + row * (btnH + gapY);

      const bg = this.add.rectangle(bx, by, btnW, btnH, 0x2a1a00)
        .setStrokeStyle(1, 0xbb8800).setDepth(51).setInteractive({ useHandCursor: true });

      const label = this.add.text(bx, by, btn.label, {
        fontFamily: 'VT323, monospace', fontSize: '16px', color: '#ffd700',
      }).setOrigin(0.5).setDepth(52);

      bg.on('pointerover', () => bg.setFillStyle(0x3d2800));
      bg.on('pointerout',  () => bg.setFillStyle(0x2a1a00));
      bg.on('pointerdown', () => {
        bg.setFillStyle(0x1a0d00);
        this.time.delayedCall(100, () => bg.setFillStyle(0x2a1a00));
        btn.action();
      });

      void label; // referenced via closure
    });
  }

  // ── Hero hit flash ───────────────────────────────────────────────────────────

  private _hitHero(): void {
    if (!this.heroSprite) return;
    this.heroSprite.setTint(0xff0000);
    this.time.delayedCall(300, () => {
      if (this.heroSprite) this.heroSprite.clearTint();
    });
  }

  // ── Back button ──────────────────────────────────────────────────────────────

  private _buildBackBtn(): void {
    const bg = this.add.rectangle(46, 20, 80, 26, 0x1a1a1a)
      .setStrokeStyle(1, 0x666666).setDepth(200).setInteractive({ useHandCursor: true });
    const lbl = this.add.text(46, 20, '← BACK', {
      fontFamily: 'VT323, monospace', fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5).setDepth(201);

    bg.on('pointerover', () => bg.setFillStyle(0x333333));
    bg.on('pointerout',  () => bg.setFillStyle(0x1a1a1a));
    bg.on('pointerdown', () => this.scene.stop());

    void lbl;
  }
}
