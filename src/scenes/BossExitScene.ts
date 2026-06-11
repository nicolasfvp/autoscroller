import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { getBossExitChoiceData } from '../systems/BossSystem';
import { LoopRunner, type LoopRunState } from '../systems/LoopRunner';
import { bankRunRewards } from '../systems/MetaProgressionSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { saveManager } from '../core/SaveManager';
import { FONTS, LAYOUT } from '../ui/StyleConstants';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';
import { creditTijolinhos } from '../integrations/FeiraDeJogos';

const W = 800;
const H = 600;
const CX = W / 2;

// Painel: asset 657×607, exibido em 290×268
const PANEL_DISPLAY_W = 290;
const PANEL_DISPLAY_H = 268;
const PANEL_SCALE_X = PANEL_DISPLAY_W / 657;
const PANEL_SCALE_Y = PANEL_DISPLAY_H / 607;
const GAP = 28;
const EXIT_CX  = CX - PANEL_DISPLAY_W / 2 - GAP / 2;
const CONT_CX  = CX + PANEL_DISPLAY_W / 2 + GAP / 2;
const PANEL_Y  = 340;

const MAT_ICON_SIZE = 20;
const MAT_ICON_KEY: Record<string, string> = {
  iron: 'mat_iron', crystal: 'mat_crystal', wood: 'mat_wood',
  stone: 'mat_stone', bone: 'mat_bone', essence: 'mat_essence', herbs: 'mat_herbs',
};

export class BossExitScene extends Scene {
  private loopRunner!: LoopRunner;
  private transitioning = false;

  constructor() {
    super('BossExitScene');
  }

  create(data: { loopRunner: LoopRunner; loopRunState: LoopRunState }): void {
    this.transitioning = false;
    this.scene.bringToTop();
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    this.loopRunner = data.loopRunner;

    // Feira de Jogos: passar de um boss credita 300 tijolinhos ao jogador.
    // Esta cena só é lançada pelo evento 'boss-defeated', então roda 1x por boss.
    creditTijolinhos(300);

    const run = getRun();
    const choiceData = getBossExitChoiceData(run);
    const reward = choiceData.safeExitReward;
    const font = FONTS.family;

    // Fundo preto total
    this.add.rectangle(CX, H / 2, W, H, 0x000000).setDepth(0);

    // ── Exit Run panel ────────────────────────────────────────────────────────
    const exitItems = Object.entries(reward.materials).filter(([, v]) => v > 0);
    this.makePanel(EXIT_CX, PANEL_Y, 0x66ff88, (c) => {
      // Todos os offsets são relativos ao centro do painel (0, 0)

      c.add(this.add.text(0, -95, 'Exit Run', {
        fontSize: '30px', color: '#66ff88', fontFamily: font,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5));

      c.add(this.add.rectangle(0, -68, 220, 1, 0xffd700, 0.6));

      c.add(this.add.text(0, -54, 'Bank all materials and XP safely.', {
        fontSize: '16px', color: '#ccffcc', fontFamily: font, align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5, 0));

      // Lista de materiais centralizada
      const rowH = 26;
      const listStartY = -6;
      exitItems.forEach(([mat, qty], i) => {
        const iy = listStartY + i * rowH;
        const iconKey = MAT_ICON_KEY[mat];
        const label = `${mat}: ${qty}`;
        const approxTextW = label.length * 9;
        const totalW = MAT_ICON_SIZE + 4 + approxTextW;
        const iconX = -totalW / 2 + MAT_ICON_SIZE / 2;
        const textX = iconX + MAT_ICON_SIZE / 2 + 4;
        if (iconKey && this.textures.exists(iconKey)) {
          c.add(this.add.image(iconX, iy + 10, iconKey).setDisplaySize(MAT_ICON_SIZE, MAT_ICON_SIZE));
        }
        c.add(this.add.text(textX, iy + 1, label, {
          fontSize: '17px', color: '#aaffaa', fontFamily: font,
        }).setOrigin(0, 0));
      });

      const xpY = listStartY + exitItems.length * rowH + 4;
      c.add(this.add.text(0, xpY, `+ ${reward.xp} XP`, {
        fontSize: '20px', color: '#ffd700', fontFamily: font,
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 0));
    }, () => this.doExit());

    // ── Continue panel ────────────────────────────────────────────────────────
    this.makePanel(CONT_CX, PANEL_Y, 0xff8844, (c) => {
      c.add(this.add.text(0, -95, 'Continue', {
        fontSize: '30px', color: '#ff8844', fontFamily: font,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5));

      c.add(this.add.rectangle(0, -68, 220, 1, 0xffd700, 0.6));

      c.add(this.add.text(0, -48, 'O loop cresce 3 tiles.\nArrisque tudo.', {
        fontSize: '18px', color: '#ffffff', fontFamily: font, align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5, 0));

      c.add(this.add.text(0, 24, 'Morte: 10% dos materiais\ne zero XP.', {
        fontSize: '17px', color: '#ff6666', fontFamily: font, align: 'center',
        wordWrap: { width: 220 },
      }).setOrigin(0.5, 0));
    }, () => this.doContinue());

    this.events.on('shutdown', this.cleanup, this);
  }

  private makePanel(
    cx: number, cy: number,
    hoverTint: number,
    build: (container: Phaser.GameObjects.Container) => void,
    onConfirm: () => void,
  ): void {
    const container = this.add.container(cx, cy).setDepth(1);

    const img = this.add.image(0, 0, 'boss_exit_option_panel')
      .setScale(PANEL_SCALE_X, PANEL_SCALE_Y);
    container.add(img);

    // Conteúdo do painel (coordenadas relativas ao centro do container)
    build(container);

    // setInteractive no container com hitArea em coordenadas de mundo (cx, cy = centro)
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(
        -PANEL_DISPLAY_W / 2, -PANEL_DISPLAY_H / 2,
        PANEL_DISPLAY_W, PANEL_DISPLAY_H,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    const S = 1;
    const S_HOVER = 1.04;
    const S_DOWN  = 0.97;

    container.on('pointerover', () => {
      img.setTint(hoverTint);
      this.tweens.add({ targets: container, scaleX: S_HOVER, scaleY: S_HOVER, duration: 110, ease: 'Sine.easeOut' });
    });
    container.on('pointerout', () => {
      img.clearTint();
      this.tweens.add({ targets: container, scaleX: S, scaleY: S, duration: 110, ease: 'Sine.easeOut' });
    });
    container.on('pointerdown', () => {
      if (this.transitioning) return;
      this.tweens.add({ targets: container, scaleX: S_DOWN, scaleY: S_DOWN, duration: 60, yoyo: true, onComplete: () => onConfirm() });
    });
  }

  private async doExit(): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;

    this.loopRunner.onBossChoice('exit');
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();
    const targetScene = run.mode === 'daily' ? SCENE_KEYS.MAIN_MENU : SCENE_KEYS.CITY_HUB;
    const materialsEarned: Record<string, number> = { ...(run.economy.materials ?? {}) };
    const xpEarned = run.hero.runXP ?? 0;
    try {
      const metaState = await loadMetaState();
      const updatedState = bankRunRewards(
        materialsEarned,
        xpEarned,
        'safe',
        {
          seed: run.runId,
          loopsCompleted: Math.max(0, run.loop.count - 1),
          bossesDefeated: run.loop.bossesDefeated ?? 0,
        },
        metaState,
        run.hero.className ?? 'warrior',
        run.economy.gatheringBoost ?? 0,
      );
      await saveMetaState(updatedState);
      await saveManager.clearByMode(run.mode);
    } catch (e) {
      console.error('[BossExit] Failed to bank rewards:', e);
    }
    clearRun();
    stopAllRunScenes(this, SCENE_KEYS.BOSS_EXIT);
    this.scene.stop(SCENE_KEYS.BOSS_EXIT);
    this.scene.start(targetScene);
  }

  private doContinue(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    getRun().loop.bossChoiceContinue = true;
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private cleanup(): void {
    // no-op
  }
}
