// CombatScene -- thin wrapper that creates CombatEngine, subscribes to events,
// renders via CardQueueDisplay, CombatHUD, and SynergyFlash components.

import { Scene } from 'phaser';
import { eventBus, type GameEvents } from '../core/EventBus';
import { getRun } from '../state/RunState';
import { getEnemyById, getCardById } from '../data/DataLoader';
import { keywordIntro } from '../systems/keywordIntro/KeywordIntroService';
import { formatCardDescription } from '../systems/cards/CardText';
import { createCombatState, type CombatState } from '../systems/combat/CombatState';
import { CombatEngine } from '../systems/combat/CombatEngine';
import type { SubtileEffect } from '../systems/SubtileResolver';
import { CombatHUD } from '../ui/CombatHUD';
import { CardQueueDisplay } from '../ui/CardQueueDisplay';
import { setLiveStats, clearLiveStats } from '../ui/CardDynamic';
import { readStat } from '../systems/hero/HeroStatsResolver';
import { showSynergyFlash } from '../ui/SynergyFlash';
import { CombatEffects } from '../effects/CombatEffects';
import { earnXP, getXPForEnemy, loseAllRunXP } from '../systems/hero/XPSystem';
import { scaleEnemyForLoop } from '../systems/DifficultyScaler';
import { COLORS, LAYOUT } from '../ui/StyleConstants';
import { getSpritePrefix } from '../systems/hero/ClassRegistry';
import { generateAndApplyCombatLoot } from '../systems/CombatLoot';
import { addPendingKill } from '../systems/PendingLoot';
import { AudioManager } from '../systems/AudioManager';
import { SCENE_KEYS } from '../state/SceneKeys';
import { dailyRunTicker } from '../systems/DailyRunTicker';
import { DailyTickerPanel } from '../ui/DailyTickerPanel';
import { addGlossaryButton } from '../ui/GlossaryButton';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { getEnemyAttackCards } from '../data/EnemyAttackCards';
import { EnemyCardQueueDisplay } from '../ui/EnemyCardQueueDisplay';

/** Maps enemy id → hit effect spritesheet key.
 *  Defaults to 'fx_claw' for anything not listed. fx_slash = blade, fx_claw = bestial. */
const ENEMY_ATTACK_FX: Record<string, string> = {
  // Claw (bestial / natural weapons)
  werewolf:          'fx_claw',
  ancient_tree:      'fx_claw',
  corpse_eater:      'fx_claw',
  vampire:           'fx_claw',
  bog_witch:         'fx_claw',
  void_shade:        'fx_claw',
  // Slash (bladed weapons)
  skeleton:          'fx_slash',
  doom_knight:       'fx_slash',
  blighted_knight:   'fx_slash',
  // Stomp (heavy / earth impact)
  lava_golem:        'fx_stomp',
  boss_iron_golem:   'fx_stomp',
  earth_dragon:      'fx_stomp',
  iron_golem:        'fx_stomp',
  desert_golem:      'fx_stomp',
  infernal_dragon:   'fx_stomp',
  drowned_king:      'fx_stomp',
  // Bite / Venom (slime / poison / acid)
  slime:             'fx_bite',
  red_slime:         'fx_bite',
  toxic_gooze:       'fx_bite',
  venomous_kobra:    'fx_bite',
  depths_horror:     'fx_bite',
  forge_slime:       'fx_bite',
  giant_spider:      'fx_bite',
  drowned_soldier:   'fx_bite',
  necromancer:       'fx_bite',
  // Remaining use slash as default
};

export class CombatScene extends Scene {
  private engine!: CombatEngine;
  private hud!: CombatHUD;
  private cardQueue!: CardQueueDisplay;
  private combatEffects!: CombatEffects;

  // Visual representations
  private heroSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private enemyShadow?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private enemyTextureKey = '';

  private gameSpeed: number = 1;
  private _glossaryOpen = false;
  private enemyIdleTimer: Phaser.Time.TimerEvent | null = null;
  private initData!: { enemyId: string; isBoss?: boolean; isElite?: boolean; terrain?: string; subtileEffects?: SubtileEffect[] };

  // Status effect sprites — herói e inimigo separados
  private _fxHeroFire:   Phaser.GameObjects.Sprite | null = null;
  private _fxHeroBleed:  Phaser.GameObjects.Sprite | null = null;
  private _fxHeroStun:   Phaser.GameObjects.Sprite | null = null;
  private _fxEnemyFire:  Phaser.GameObjects.Sprite | null = null;
  private _fxEnemyBleed: Phaser.GameObjects.Sprite | null = null;
  private _fxEnemyStun:  Phaser.GameObjects.Sprite | null = null;
  private _fxEnemyPoison: Phaser.GameObjects.Sprite | null = null;

  // Enemy attack-card queue — right-side mirror of the hero's card queue
  private enemyCardQueue?: EnemyCardQueueDisplay;

  private onCardPlayed = (data: GameEvents['combat:card-played']) => {
    if (this.cardQueue) this.cardQueue.onCardPlayed(0);
    if (this.hud && this.engine) this.hud.showCooldownBurst(this.engine.getHeroMaxCooldown());
    // Contextual keyword teaching: if this card introduces a keyword the
    // player hasn't learned, the intro service queues an overlay that
    // pauses combat until dismissed. Combine the static description with
    // the dynamic CardText render so engine-generated keyword tokens
    // (Burn N, Scales STR, Vengeance) trigger the same first-encounter
    // pause as author-written ones.
    const cardDef = getCardById(data.cardId);
    if (cardDef) {
      const rendered = formatCardDescription({
        effects: cardDef.effects,
        exhaust: cardDef.exhaust,
        spend_armor: cardDef.spend_armor,
      });
      const fullText = `${cardDef.description ?? ''} ${rendered}`.trim();
      keywordIntro.handleCardPlayed(this, fullText);
    }
    if (data.damage > 0) {
      const isFireball = data.cardId.toLowerCase().includes('fireball');
      const sp = getSpritePrefix(getRun().hero.className ?? 'warrior');
      const heroAttackKey = `${sp}_attack`;
      const heroIdleKey = this.textures.exists(`${sp}_battle_stance`) ? `${sp}_battle_stance` : `${sp}_idle`;
      if (this.anims.exists(heroAttackKey)) {
        this.heroSprite.play({ key: heroAttackKey, timeScale: this.gameSpeed });
        this.heroSprite.once('animationcomplete', () => { if (this.heroSprite && this.anims.exists(heroIdleKey)) this.heroSprite.play(heroIdleKey); });
      }
      // Impact delay: frame 3 of 8-frame attack at 12fps ≈ 250ms, scaled by combat speed
      const impactDelay = isFireball ? 0 : Math.round(250 / this.gameSpeed);
      this.time.delayedCall(impactDelay, () => {
        AudioManager.playSFX(this, isFireball ? 'sfx_fireball' : 'sfx_slash', 0.4);
        if (this.combatEffects) this.combatEffects.floatingNumber(600, 320, data.damage, '#ffffff', '-');
        if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) {
          this.enemySprite.setTintFill(0xffffff);
          this.time.delayedCall(100, () => { if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) this.enemySprite.clearTint(); });
        }
      });
    }
    this.time.delayedCall(350, () => { if (this.engine && !this.engine.isComplete()) this.cardQueue?.update(this.engine.getState(), this.engine.getDeckPointer()); });
  };

  private onSynergyTriggered = (e: GameEvents['combat:synergy-triggered']) => showSynergyFlash(this, e.bonus.type, e.bonus.value, e.displayName);

  private onCardSkipped = () => this.cardQueue?.onCardSkipped(0);

  private onDeckReshuffled = () => this.cardQueue?.onDeckReshuffled();

  private onEnemyAttack = (data: GameEvents['combat:enemy-attack']) => {
    this.enemyCardQueue?.onAttack();
    if (data.damage > 0) AudioManager.playSFX(this, 'sfx_hurt', 0.6);
    if (this.combatEffects) { this.combatEffects.floatingNumber(200, 320, data.damage, '#ff0000', '-'); this.combatEffects.screenShake(3, 150); }
    this.heroSprite.setTint(0xff0000);
    this.time.delayedCall(300, () => { if (this.heroSprite) this.heroSprite.clearTint(); });
    // Hit effect spritesheet over the hero
    if (this.combatEffects) {
      const fxKey = ENEMY_ATTACK_FX[this.initData?.enemyId ?? ''] ?? 'fx_claw';
      this.combatEffects.enemyAttackEffect(200, 320, fxKey, true);
    }
    // Visual jump toward the player
    if ((this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image)) {
      this.tweens.add({
        targets: this.enemySprite,
        x: '-=20',
        yoyo: true,
        duration: 100
      });
    }
  };

  private onCombatEnd = (eventData: GameEvents['combat:end']) => {
    const currentRun = getRun();
    currentRun.isInCombat = false;
    const finalState = this.engine.getState();
    currentRun.hero.currentHP = Math.max(0, finalState.heroHP);
    currentRun.hero.currentStamina = finalState.heroStamina;
    currentRun.hero.currentMana = finalState.heroMana;

    const sp = getSpritePrefix(currentRun.hero.className ?? 'warrior');
    const heroDeathKey = `${sp}_death`;

    if (tutorialDirector.isActive() && eventData.result === 'victory') {
      tutorialDirector.advanceIfMatches('combat-intro');
    }

    if (eventData.result === 'victory') {
      if ((this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image)) {
        this.tweens.add({ targets: this.enemySprite, alpha: 0, duration: 500 });
      }
      if (this.enemyShadow) {
        this.tweens.add({ targets: this.enemyShadow, alpha: 0, duration: 500 });
      }
    } else {
      if (this.anims.exists(heroDeathKey)) this.heroSprite.play(heroDeathKey);
    }

    // Texto de resultado — VT323 com animação de typing (janela deslizante de 3 chars).
    const resultWord = eventData.result === 'victory' ? 'VICTORY' : 'DEFEAT';
    const displayText = this.add.bitmapText(400, 290, 'vt323_gold', '', 82)
      .setOrigin(0.5).setDepth(600).setTint(eventData.result === 'victory' ? 0xffd700 : 0xff4444);

    const WINDOW = 3;
    let charIdx = 0;
    const typeTimer = this.time.addEvent({
      delay: 80,
      repeat: resultWord.length + WINDOW - 2,
      callback: () => {
        charIdx++;
        const start = Math.max(0, charIdx - WINDOW);
        const end   = Math.min(charIdx, resultWord.length);
        displayText.setText(resultWord.slice(start, end));
        if (charIdx >= resultWord.length) {
          displayText.setText(resultWord);
          typeTimer.remove();
        }
      },
    });

    this.time.delayedCall(2500, () => {
      if (displayText) displayText.destroy();
      const enemyDef = getEnemyById(this.initData.enemyId);
      if (!enemyDef) return;

      if (eventData.result === 'victory') {
        const scaled = scaleEnemyForLoop(
          enemyDef,
          currentRun.loop.count,
          enemyDef.type === 'boss',
          currentRun.loop.difficultyMultiplier,
        );
        const xpEarned = getXPForEnemy(this.initData?.isElite && enemyDef.type !== 'boss' ? 'elite' : enemyDef.type);
        earnXP(currentRun, xpEarned);
        if (enemyDef.type === 'boss') {
          currentRun.loop.lastBossDefeated = true;
          currentRun.loop.bossesDefeated = (currentRun.loop.bossesDefeated ?? 0) + 1;
        }
        // C2 relics: kill-bonus relics queued gold onto CombatState; add it to
        // the base reward so it flows through normal loot processing (which
        // also pipes the right notification).
        const goldBonus = finalState.pendingGoldBonus ?? 0;
        addPendingKill(enemyDef.name);
        generateAndApplyCombatLoot(currentRun, enemyDef.name, enemyDef.id, enemyDef.type, this.initData.terrain ?? 'basic', scaled.goldReward + goldBonus, xpEarned);
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.GAME);
      } else {
        loseAllRunXP(currentRun);
        this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(SCENE_KEYS.DEATH, { enemyName: enemyDef.name, stats: this.engine.getStats() }));
      }
    });
  };

  constructor() {
    super(SCENE_KEYS.COMBAT);
  }

  init(data: { enemyId: string; isBoss?: boolean; isElite?: boolean; terrain?: string; subtileEffects?: SubtileEffect[] }): void {
    this.initData = data;
  }


  /**
   * Apply pre-fight subtile effects to the freshly-built CombatState.
   * Runs once before the engine starts, mutating the state in place.
   *
   * Pre-fight stack init  : ambush / magma_burst / mana_well / tactical
   * Build amplifiers (Wave 8 fields): burn_altar / bleed_totem / resonance
   * War Horn is consumed upstream in LoopRunner.getCombatSpawnChance.
   */
  private applySubtileEffects(state: CombatState, effects: SubtileEffect[]): void {
    for (const e of effects) {
      const n = e.stacks;
      switch (e.effect) {
        case 'ambush':
          state.slowStacks += 2 * n;
          state.bleedStacks += 3 * n;
          break;
        case 'magma_burst':
          state.burnStacks += 5 * n;
          break;
        case 'mana_well':
          state.heroMana += 2 * n;
          break;
        case 'tactical':
          // "Free defense card pre-played" — model as +5 armor per stack
          // at fight start, mirroring a basic defense card's payout.
          state.heroDefense += 5 * n;
          break;
        case 'burn_altar':
          state.subtileBurnApplyBonus += n;
          break;
        case 'bleed_totem':
          state.subtileBleedTickBonus += n;
          break;
        case 'resonance':
          state.subtileSpellDamageMult += 0.15 * n;
          break;
        // war_horn handled upstream in LoopRunner.
        default:
          break;
      }
    }
  }

  create(): void {
    this.cleanup();
    const data = this.initData;
    if (!data || !data.enemyId) {
       this.scene.stop();
       this.scene.resume(SCENE_KEYS.GAME);
       return;
    }
    this.scene.bringToTop();
    this.cameras.main.setBackgroundColor(0x000000);
    // Hydrate the seen-keywords set from MetaState. Fire-and-forget — by the
    // time the first card resolves (≥ first card cooldown), IDB will have
    // returned and the intro service can gate appropriately. If the player
    // somehow plays a card before init finishes, the service silently skips
    // (returns no-op) and the keyword stays unseen for next time.
    void keywordIntro.init();

    try {
      const run = getRun();
      run.isInCombat = true;

      try {
        AudioManager.stopAmbience(this, 500);
      } catch (e) { console.warn("Audio stop failed", e); }

      this.gameSpeed = run.combatSpeed ?? 1;
      this.cameras.main.setBackgroundColor(COLORS.background);
      this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

      const terrain = data.terrain ?? 'basic';
      const battleBgKey = `bg_battle_${terrain}`;
      if (this.textures.exists(battleBgKey)) {
        this.add.image(400, 300, battleBgKey).setDisplaySize(800, 600).setDepth(0);
      }

      const enemyDef = getEnemyById(data.enemyId);
      if (!enemyDef) {
        run.isInCombat = false;
        this.scene.stop();
        this.scene.resume(SCENE_KEYS.GAME);
        return;
      }

      const scaled = scaleEnemyForLoop(
        enemyDef,
        run.loop.count,
        enemyDef.type === 'boss',
        run.loop.difficultyMultiplier,
      );
      // Elite premium: tougher, hits harder, renamed + retyped so it grants
      // elite XP and reads as "Elite <name>" in the HUD.
      const elite = !!data.isElite && enemyDef.type !== 'boss';
      const scaledEnemy = {
        ...enemyDef,
        type: elite ? 'elite' : enemyDef.type,
        name: elite ? `Elite ${enemyDef.name}` : enemyDef.name,
        baseHP: elite ? Math.round(scaled.hp * 1.6) : scaled.hp,
        baseDefense: scaled.defense,
        attack: { ...enemyDef.attack, damage: elite ? Math.round(scaled.damage * 1.3) : scaled.damage },
      };

      const combatState = createCombatState(run, scaledEnemy);
      // Wave 6: apply pre-fight subtile effects before the engine takes over.
      this.applySubtileEffects(combatState, data.subtileEffects ?? []);
      this.engine = new CombatEngine(combatState);
      // Seed card headline numbers with the fight's starting stats so the
      // initial queue renders correct values before the first tick.
      this.pushLiveStats();

      const sp = getSpritePrefix(run.hero.className ?? 'warrior');
      const heroIdleKey = this.textures.exists(`${sp}_battle_stance`) ? `${sp}_battle_stance` : `${sp}_idle`;
      const heroAttackKey = `${sp}_attack`;

      if (this.textures.exists(heroIdleKey)) {
        const idleFrameCount = this.textures.get(heroIdleKey).frameTotal - 1;
        const idleIsSpritesheet = idleFrameCount > 1;

        const isMage = sp === 'mage';
        const IDLE_SCALE = isMage ? 0.3357 : 0.6034;
        const ORIGIN_X = isMage ? 180.9 : 200;
        const ORIGIN_Y = isMage ? 331.2 : 338.5;
        const SHADOW_X = isMage ? 183.3 : 178;
        const SHADOW_Y = isMage ? 445.3 : 440;
        const SHADOW_W = isMage ? 243 : 220;
        const SHADOW_H = isMage ? 86 : 50;
        const idleFrameH = this.textures.get(heroIdleKey).get(0).realHeight;

        // Y compensado pela diferença de frameH: mantém pés no mesmo ponto em tela
        const yForAnim = (key: string) => {
          const fh = this.textures.exists(key) ? this.textures.get(key).get(0).realHeight : idleFrameH;
          return ORIGIN_Y + (idleFrameH - fh) / 2 * IDLE_SCALE;
        };

        this.heroSprite = this.add.sprite(ORIGIN_X, yForAnim(heroIdleKey), heroIdleKey).setDepth(10).setScale(idleIsSpritesheet ? IDLE_SCALE : 0.7);
        if (this.textures.exists('hero_shadow')) {
          this.add.image(SHADOW_X, SHADOW_Y, 'hero_shadow').setDisplaySize(SHADOW_W, SHADOW_H).setAlpha(0.7).setDepth(9);
        } else {
          this.add.ellipse(ORIGIN_X, SHADOW_Y + 10, 160, 28, 0x000000, 0.45).setDepth(9);
        }

        const idle2Key = `${sp}_idle2`;
        const hasIdle2 = this.textures.exists(idle2Key);
        let idleFrame = 0;
        let isAttacking = false;

        if (idleIsSpritesheet) {
          const idleAnimKey = `${heroIdleKey}_loop`;
          if (!this.anims.exists(idleAnimKey)) {
            this.anims.create({
              key: idleAnimKey,
              frames: this.anims.generateFrameNumbers(heroIdleKey, { start: 0, end: idleFrameCount - 1 }),
              frameRate: 6,
              repeat: -1,
            });
          }
          this.heroSprite.play(idleAnimKey);
        } else {
          this.time.addEvent({
            delay: 250, loop: true,
            callback: () => {
              if (!this.heroSprite || isAttacking || !hasIdle2) return;
              idleFrame = 1 - idleFrame;
              this.heroSprite.setTexture(idleFrame === 0 ? heroIdleKey : idle2Key);
            },
          });
        }

        // Posição e scale por animação, ajustados via debug-layout
        const ANIM_OVERRIDES: Record<string, { x: number; y: number; scale: number }> = {
          hero_attack:      { x: 190.4, y: 303.5, scale: 0.6118 },
          hero_defend:      { x: 200,   y: 323.4, scale: 0.6034 },
          hero_channel:     { x: 184.8, y: 314.1, scale: 0.6529 },
          mage_defend:      { x: 187.5, y: 328.5, scale: 0.3092 },
          mage_attack:      { x: 196.0, y: 343.4, scale: 0.3357 },
          mage_cast_debuff: { x: 187.5, y: 327.0, scale: 0.3221 },
        };

        const ensureAnim = (key: string, frameRate: number, repeat = 0) => {
          if (this.anims.exists(key) || !this.textures.exists(key)) return;
          const count = this.textures.get(key).frameTotal - 1;
          if (count > 0) this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end: count - 1 }), frameRate, repeat });
        };

        const returnToIdle = () => {
          if (!this.heroSprite) return;
          if (idleIsSpritesheet) {
            this.heroSprite.setX(ORIGIN_X);
            this.heroSprite.setY(ORIGIN_Y);
            this.heroSprite.setScale(IDLE_SCALE);
            this.heroSprite.play(`${heroIdleKey}_loop`);
          } else {
            this.heroSprite.setTexture(idleFrame === 0 ? heroIdleKey : idle2Key);
          }
        };

        const LOOP_ANIMS = new Set([`${sp}_defend`]);
        const playCardAnimation = (animKey: string, _lunge: boolean) => {
          if (!this.heroSprite || isAttacking) return;
          isAttacking = true;
          const shouldLoop = LOOP_ANIMS.has(animKey);
          ensureAnim(animKey, 12, shouldLoop ? -1 : 0);
          if (this.anims.exists(animKey)) {
            const ov = ANIM_OVERRIDES[animKey];
            this.heroSprite.setX(ov ? ov.x : ORIGIN_X);
            this.heroSprite.setY(ov ? ov.y : yForAnim(animKey));
            this.heroSprite.setScale(ov ? ov.scale : IDLE_SCALE);
            this.heroSprite.play({ key: animKey, timeScale: this.gameSpeed });
            if (shouldLoop) {
              // Loop anims don't fire animationcomplete — stop after 1.5s
              const loopDuration = Math.round(1500 / this.gameSpeed);
              this.time.delayedCall(loopDuration, () => {
                isAttacking = false;
                if (!this.heroSprite) return;
                this.heroSprite.stop();
                returnToIdle();
              });
            } else {
              this.heroSprite.once('animationcomplete', () => {
                isAttacking = false;
                if (!this.heroSprite) return;
                returnToIdle();
              });
            }
          } else {
            isAttacking = false;
          }
        };

        const getCardAnimKey = (cardId: string): { key: string; lunge: boolean } => {
          const def = getCardById(cardId);
          if (!def) return { key: heroAttackKey, lunge: true };
          const defendKey = `${sp}_defend`;
          const channelKey = `${sp}_channel`;
          const hasDamage = def.effects.some(e => e.type === 'damage');
          const hasArmor  = def.effects.some(e => e.type === 'armor');
          if (hasArmor && this.textures.exists(defendKey)) return { key: defendKey, lunge: false };
          if (!hasDamage && this.textures.exists(channelKey)) return { key: channelKey, lunge: false };
          return { key: heroAttackKey, lunge: true };
        };

        const origOnCardPlayed = this.onCardPlayed;
        this.onCardPlayed = (data: GameEvents['combat:card-played']) => {
          if (this.cardQueue) this.cardQueue.onCardPlayed(0);
          const cardDef = getCardById(data.cardId);
          if (cardDef) {
            const rendered = formatCardDescription({
              effects: cardDef.effects,
              exhaust: cardDef.exhaust,
              spend_armor: cardDef.spend_armor,
            });
            const fullText = `${cardDef.description ?? ''} ${rendered}`.trim();
            keywordIntro.handleCardPlayed(this, fullText);
          }
          const { key: animKey, lunge } = getCardAnimKey(data.cardId);
          playCardAnimation(animKey, lunge);
          if (animKey === `${sp}_defend` && this.combatEffects) {
            this.combatEffects.shieldEffect(ORIGIN_X, ORIGIN_Y);
          }
          if (data.damage > 0) {
            const isFireballInline = data.cardId.toLowerCase().includes('fireball');
            const inlineDelay = isFireballInline ? 0 : Math.round(250 / this.gameSpeed);
            this.time.delayedCall(inlineDelay, () => {
              AudioManager.playSFX(this, isFireballInline ? 'sfx_fireball' : 'sfx_slash', 0.4);
            });
            if (this.combatEffects) this.combatEffects.floatingNumber(600, 320, data.damage, '#ffffff', '-');
            if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) {
              this.enemySprite.setTintFill(0xffffff);
              this.time.delayedCall(100, () => { if (this.enemySprite instanceof Phaser.GameObjects.Sprite || this.enemySprite instanceof Phaser.GameObjects.Image) this.enemySprite.clearTint(); });
            }
          }
          this.time.delayedCall(350, () => { if (this.engine && !this.engine.isComplete()) this.cardQueue?.update(this.engine.getState(), this.engine.getDeckPointer()); });
        };
        eventBus.off('combat:card-played', origOnCardPlayed);
        eventBus.on('combat:card-played', this.onCardPlayed);
      } else {
        this.heroSprite = this.add.sprite(300, 340, 'knight_idle').setDisplaySize(250, 250).setDepth(10);
      }
      
      // Phase 9 (CR-01 fix): monster texture keys namespaced `monster_*` to
      // avoid colliding with hero spritesheets (enemy 'mage' vs hero Mage).
      // Source rename in Preloader.ts; render sites here + TileVisual.ts.
      this.enemyTextureKey = `monster_${enemyDef.id}`;

      if (this.textures.exists(this.enemyTextureKey)) {
        this.enemySprite = this.add.image(600, 340, this.enemyTextureKey).setDepth(10).setDisplaySize(250, 250);
        if (this.textures.exists('hero_shadow')) {
          this.enemyShadow = this.add.image(600, 440, 'hero_shadow').setDisplaySize(220, 50).setAlpha(0.7).setDepth(9);
        } else {
          this.enemyShadow = this.add.ellipse(600, 430, 160, 28, 0x000000, 0.45).setDepth(9) as unknown as Phaser.GameObjects.Graphics;
        }
        const enemyFrames: string[] = [this.enemyTextureKey];
        for (let n = 2; this.textures.exists(`${this.enemyTextureKey}_${n}`); n++)
          enemyFrames.push(`${this.enemyTextureKey}_${n}`);
        if (enemyFrames.length > 1) {
          let frameIdx = 0;
          this.enemyIdleTimer = this.time.addEvent({
            delay: Math.round(1000 / 6), loop: true,
            callback: () => {
              if (this.enemySprite instanceof Phaser.GameObjects.Image) {
                frameIdx = (frameIdx + 1) % enemyFrames.length;
                this.enemySprite.setTexture(enemyFrames[frameIdx]);
              }
            },
          });
        }
      } else {
        this.enemySprite = this.add.rectangle(600, 350, 64, 64, enemyDef.color ?? 0xff0000).setDepth(10);
      }

      this.hud = new CombatHUD(this, this.enemyTextureKey);
      this.hud.setFlipCallback((flipping) => this.engine.setHourglassFlipping(flipping));
      this.cardQueue = new CardQueueDisplay(this);
      // Enemy attack-card queue — right-side mirror of the hero queue. Fed the
      // generic attacks this enemy can use (claw, smash, fire_breath, …).
      this.enemyCardQueue = new EnemyCardQueueDisplay(this);
      this.enemyCardQueue.setAttacks(getEnemyAttackCards(enemyDef.id));
      this.combatEffects = new CombatEffects(this);
      // Initialize HUD and Queue with initial state
      this.hud.update(this.engine.getState(), this.engine.getHeroCooldownTimer(), this.engine.getHeroMaxCooldown(), this.gameSpeed, this.engine.getCardPlayCount(), this.engine.getEnemyCooldownTimer(), this.engine.getEnemyMaxCooldown());
      this.cardQueue.update(this.engine.getState(), this.engine.getDeckPointer());

      // Keyword glossary book icon — bottom-right corner. Pauses combat while open.
      addGlossaryButton(this, 775, 575, 600, {
        onOpen:  () => { this._glossaryOpen = true; },
        onClose: () => { this._glossaryOpen = false; },
      });
      // Speed slider lives in the persistent SpeedPanelScene; it writes to
      // run.combatSpeed directly so this scene's `gameSpeed` is re-read each
      // tick (see update()) rather than wired through a per-scene slider.

      eventBus.on('combat:card-played', this.onCardPlayed);
      eventBus.on('combat:synergy-triggered', this.onSynergyTriggered);
      eventBus.on('combat:card-skipped', this.onCardSkipped);
      eventBus.on('combat:deck-reshuffled', this.onDeckReshuffled);
      eventBus.on('combat:enemy-attack', this.onEnemyAttack);
      eventBus.on('combat:end', this.onCombatEnd);

      // Daily Run ticker overlay — visible during combat too so the player
      // can see other racers tick up while they're fighting. Panel
      // self-destructs on scene shutdown via Phaser events.
      if (run.mode === 'daily') {
        dailyRunTicker.start();
        new DailyTickerPanel(this, { selfRunId: run.runId });
      }

      TutorialOverlay.mountIfActive(this);

      this.events.on('shutdown', this.cleanup, this);
    } catch (err) {
      console.error('[CombatScene] Critical error in create():', err);
      const run = getRun(); run.isInCombat = false;
      this.scene.stop(); this.scene.resume(SCENE_KEYS.GAME);
    }
  }

  update(_time: number, delta: number): void {
    if (this.engine && !this.engine.isComplete()) {
      // Pause the simulation while a contextual keyword-intro overlay is
      // up so the player can read the explanation without enemies still
      // ticking down in the background.
      if (keywordIntro.isPaused() || tutorialDirector.shouldPauseScene(SCENE_KEYS.COMBAT) || this._glossaryOpen) {
        if (this.hud) this.hud.update(this.engine.getState(), this.engine.getHeroCooldownTimer(), this.engine.getHeroMaxCooldown(), this.gameSpeed, this.engine.getCardPlayCount(), this.engine.getEnemyCooldownTimer(), this.engine.getEnemyMaxCooldown());
        return;
      }
      // Re-read combatSpeed every tick: the persistent SpeedPanelScene writes
      // to run.combatSpeed without notifying us, so polling is the contract.
      try { this.gameSpeed = getRun().combatSpeed ?? this.gameSpeed; } catch { /* run cleared */ }
      // Background tabs force 1x: avoids time-warping when player returns after
      // long absence (browser-throttled ticks accumulate large deltas).
      const inBackground = typeof document !== 'undefined' && document.hidden;
      const speed = inBackground ? 1 : this.gameSpeed;
      this.engine.tick(delta * speed);
      const state = this.engine.getState();
      if (this.hud) this.hud.update(state, this.engine.getHeroCooldownTimer(), this.engine.getHeroMaxCooldown(), speed, this.engine.getCardPlayCount(), this.engine.getEnemyCooldownTimer(), this.engine.getEnemyMaxCooldown());
      this._updateStatusFX(state);
      // Feed live effective stats so card headline numbers track status changes
      // (buffs, auras, stat_gain) in real time.
      this.pushLiveStats();
    }
  }

  private _updateStatusFX(s: ReturnType<CombatEngine['getState']>): void {
    if (!this.combatEffects) return;
    const fx = this.combatEffects;

    // --- HERÓI (x≈200) ---
    if (s.heroBurnStacks > 0 && !this._fxHeroFire)
      this._fxHeroFire  = fx.statusEffect(182.2, 499.1, 'fx_fire',  219);
    else if (s.heroBurnStacks === 0 && this._fxHeroFire)
      { this._fxHeroFire.destroy();  this._fxHeroFire  = null; }

    if (s.heroBleedStacks > 0 && !this._fxHeroBleed)
      this._fxHeroBleed = fx.statusEffect(188.8, 464.9, 'fx_bleed', 115);
    else if (s.heroBleedStacks === 0 && this._fxHeroBleed)
      { this._fxHeroBleed.destroy(); this._fxHeroBleed = null; }

    const heroStunActive = (s.heroStunStacks ?? 0) > 0 || s.heroStunned;
    if (heroStunActive && !this._fxHeroStun)
      this._fxHeroStun = fx.statusEffect(217.1, 300.2, 'fx_stun', 67);
    else if (!heroStunActive && this._fxHeroStun)
      { this._fxHeroStun.destroy(); this._fxHeroStun = null; }

    // --- INIMIGO (calibrado via debug-layout) ---
    if (s.burnStacks > 0 && !this._fxEnemyFire)
      this._fxEnemyFire  = fx.statusEffect(602.6, 542.2, 'fx_fire',  366);
    else if (s.burnStacks === 0 && this._fxEnemyFire)
      { this._fxEnemyFire.destroy();  this._fxEnemyFire  = null; }

    if (s.bleedStacks > 0 && !this._fxEnemyBleed)
      this._fxEnemyBleed = fx.statusEffect(596, 467.1, 'fx_bleed', 161);
    else if (s.bleedStacks === 0 && this._fxEnemyBleed)
      { this._fxEnemyBleed.destroy(); this._fxEnemyBleed = null; }

    if (s.stunStacks > 0 && !this._fxEnemyStun)
      this._fxEnemyStun  = fx.statusEffect(591.4, 301.5, 'fx_stun',   90);
    else if (s.stunStacks === 0 && this._fxEnemyStun)
      { this._fxEnemyStun.destroy();  this._fxEnemyStun  = null; }

    if (s.poisonStacks > 0 && !this._fxEnemyPoison)
      this._fxEnemyPoison = fx.statusEffect(596, 467.1, 'fx_bleed', 161);
    else if (s.poisonStacks === 0 && this._fxEnemyPoison)
      { this._fxEnemyPoison.destroy(); this._fxEnemyPoison = null; }
  }

  /** Push the hero's current effective stats to CardDynamic so every visible
   *  card face refreshes its headline number. Reads the same stat values the
   *  resolver scales with (base + auras + per-combat stat gains). */
  private pushLiveStats(): void {
    if (!this.engine) return;
    const s = this.engine.getState();
    setLiveStats({
      str: readStat(s, 'str'),
      vit: readStat(s, 'vit'),
      dex: readStat(s, 'dex'),
      int: readStat(s, 'int'),
      spi: readStat(s, 'spi'),
    });
  }

  private cleanup(): void {
    eventBus.off('combat:card-played', this.onCardPlayed);
    eventBus.off('combat:synergy-triggered', this.onSynergyTriggered);
    eventBus.off('combat:card-skipped', this.onCardSkipped);
    eventBus.off('combat:deck-reshuffled', this.onDeckReshuffled);
    eventBus.off('combat:enemy-attack', this.onEnemyAttack);
    eventBus.off('combat:end', this.onCombatEnd);
    if (this.enemyIdleTimer) { this.enemyIdleTimer.destroy(); this.enemyIdleTimer = null; }
    if (this.enemyCardQueue) { this.enemyCardQueue.destroy(); this.enemyCardQueue = undefined; }
    this._fxHeroFire?.destroy();    this._fxHeroFire    = null;
    this._fxHeroBleed?.destroy();   this._fxHeroBleed   = null;
    this._fxHeroStun?.destroy();    this._fxHeroStun    = null;
    this._fxEnemyFire?.destroy();   this._fxEnemyFire   = null;
    this._fxEnemyBleed?.destroy();  this._fxEnemyBleed  = null;
    this._fxEnemyStun?.destroy();   this._fxEnemyStun   = null;
    this._fxEnemyPoison?.destroy(); this._fxEnemyPoison = null;
    if (this.hud) this.hud.destroy();
    if (this.cardQueue) this.cardQueue.destroy();
    // Out of combat, card headline numbers fall back to the run's resolved stats.
    clearLiveStats();
    try { const run = getRun(); run.isInCombat = false; } catch {}
  }
}
