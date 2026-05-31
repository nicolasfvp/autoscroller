// DeathScene -- shown when the hero dies.
// Defeat art fills the screen; minimal text overlay at the top.

import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { bankRunRewards } from '../systems/MetaProgressionSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { saveManager } from '../core/SaveManager';
import { FONTS, LAYOUT } from '../ui/StyleConstants';
import { createWoodButton } from '../ui/WoodButton';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';

export class DeathScene extends Scene {
  private transitioning = false;

  constructor() {
    super(SCENE_KEYS.DEATH);
  }

  private fadeToScene(sceneKey: string, data?: any): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      stopAllRunScenes(this, SCENE_KEYS.DEATH);
      this.scene.start(sceneKey, data);
    });
  }

  async create(data?: { enemyName?: string }): Promise<void> {
    this.scene.bringToTop();
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const run = getRun();
    const enemyName = data?.enemyName ?? 'Unknown';

    this.cameras.main.setBackgroundColor('#000000');

    // ── Defeat art (full screen) ─────────────────────────────────
    const defeatBgKey = run.hero.className === 'mage' ? 'mage_defeat_bg' : 'warrior_defeat_bg';
    if (this.textures.exists(defeatBgKey)) {
      this.add.image(400, 300, defeatBgKey).setDisplaySize(800, 600).setDepth(0);
    }

    // ── Top overlay strip ────────────────────────────────────────
    this.add.graphics().setDepth(1)
      .fillStyle(0x000000, 0.8)
      .fillRect(0, 0, 800, 110);

    // ── Title ────────────────────────────────────────────────────
    this.add.text(400, 30, 'RUN OVER', {
      fontFamily: FONTS.body, fontSize: '46px', fontStyle: 'bold',
      color: '#ff2222', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(2);

    this.add.text(400, 80, `Defeated by ${enemyName}`, {
      fontFamily: FONTS.body, fontSize: '15px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(2);

    // ── Bottom overlay + button ──────────────────────────────────
    this.add.graphics().setDepth(1)
      .fillStyle(0x000000, 0.75)
      .fillRect(0, 548, 800, 52);

    const isDaily = run.mode === 'daily';
    const buttonLabel = isDaily ? 'Return to Menu' : 'Return to City';
    const nextScene = isDaily ? SCENE_KEYS.MAIN_MENU : SCENE_KEYS.CITY_HUB;

    // Wood-themed CTA. The dim bottom strip already darkens the area for
    // readability, so we just center the button on top of it.
    const cta = createWoodButton(this, 400, 566, buttonLabel, async () => {
      if (this.transitioning) return;
      stopAllRunScenes(this, SCENE_KEYS.DEATH);
      await saveManager.clearByMode(run.mode);
      clearRun();
      this.fadeToScene(nextScene);
    }, { width: 240, height: 42, fontSize: 17, variant: 'primary' });
    cta.container.setDepth(2);

    // ── Bank rewards (silent) ────────────────────────────────────
    const metaState = await loadMetaState();
    const materialsEarned = { ...(run.economy.materials) };
    const xpEarned = run.hero.runXP ?? 0;

    const updatedState = bankRunRewards(
      materialsEarned, xpEarned, 'death',
      { seed: run.runId, loopsCompleted: Math.max(0, run.loop.count - 1), bossesDefeated: run.loop.bossesDefeated ?? 0 },
      metaState, run.hero.className ?? 'warrior', run.economy.gatheringBoost ?? 0
    );
    await saveMetaState(updatedState);

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners
  }
}
