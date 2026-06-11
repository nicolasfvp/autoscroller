// DeathScene -- shown when the hero dies.
// Defeat art fills the screen; minimal text overlay at the top.

import { Scene } from 'phaser';
import { getRun, clearRun } from '../state/RunState';
import { bankRunRewards } from '../systems/MetaProgressionSystem';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { saveManager } from '../core/SaveManager';
import { LAYOUT, addBitmapText } from '../ui/StyleConstants';
import { SCENE_KEYS, stopAllRunScenes } from '../state/SceneKeys';
import { t } from '../i18n/i18n';
import { localizedImageButton } from '../ui/LocalizedButton';

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
    const enemyName = data?.enemyName ?? t('death.unknownEnemy');

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
    this.add.bitmapText(400, 30, 'game_font_white', t('death.title'), 46)
      .setOrigin(0.5).setTint(0xff2222).setDepth(2);

    addBitmapText(this, 400, 80, t('death.defeatedBy', { enemyName }), 15, 'white')
      .setOrigin(0.5).setDepth(2).setTint(0xaaaaaa);

    // ── Bottom overlay + button ──────────────────────────────────
    this.add.graphics().setDepth(1)
      .fillStyle(0x000000, 0.75)
      .fillRect(0, 548, 800, 52);

    const isDaily = run.mode === 'daily';
    const nextScene = isDaily ? SCENE_KEYS.MAIN_MENU : SCENE_KEYS.CITY_HUB;

    // Wood-themed CTA. The dim bottom strip already darkens the area for
    // readability, so we just center the button on top of it.
    localizedImageButton(this, 400, 566, 'btn_resume_pause', t('btn.continue'), 240, async () => {
      if (this.transitioning) return;
      stopAllRunScenes(this, SCENE_KEYS.DEATH);
      await saveManager.clearByMode(run.mode);
      clearRun();
      this.fadeToScene(nextScene);
    }, { height: 95 }).setDepth(2);

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
