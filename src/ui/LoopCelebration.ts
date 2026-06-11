import Phaser from 'phaser';

const sceneActive = (scene: Phaser.Scene): boolean =>
  !!scene.scene && scene.scene.isActive(scene.scene.key);

/**
 * LoopCelebration -- in-world overlay for loop completion.
 * Uses txt_loop_complete asset + Tile Points text. Total duration ~1.5s.
 */
export class LoopCelebration {
  private inFlight = false;

  play(
    scene: Phaser.Scene,
    _loopNumber: number,
    _tilePointsEarned: number,
    onComplete: () => void
  ): void {
    if (this.inFlight) { onComplete(); return; }
    this.inFlight = true;

    const finish = () => {
      this.inFlight = false;
      if (sceneActive(scene)) onComplete();
    };

    // "LOOP COMPLETE" asset
    const loopImg = scene.textures.exists('txt_loop_complete')
      ? scene.add.image(400, 280, 'txt_loop_complete')
          .setOrigin(0.5).setScrollFactor(0).setDepth(200).setScale(0.172).setAlpha(0)
      : null;

    if (loopImg) {
      scene.tweens.add({
        targets: loopImg,
        alpha: 1,
        duration: 900,
        ease: 'Sine.easeIn',
        onComplete: () => {
          scene.time.delayedCall(600, () => {
            if (!sceneActive(scene)) return;
            scene.tweens.add({
              targets: loopImg,
              alpha: 0,
              duration: 400,
              onComplete: () => loopImg.destroy(),
            });
          });
        },
      });
    }


    scene.time.delayedCall(1500, finish);
  }
}
