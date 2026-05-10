import Phaser from 'phaser';

const sceneActive = (scene: Phaser.Scene): boolean =>
  !!scene.scene && scene.scene.isActive(scene.scene.key);

/**
 * LoopCelebration -- in-world overlay text for loop completion.
 * Shows "LOOP {N} COMPLETE" and "+{N} Tile Points" with animations.
 * Total duration ~1.5s then calls onComplete callback.
 */
export class LoopCelebration {
  private inFlight = false;

  play(
    scene: Phaser.Scene,
    loopNumber: number,
    tilePointsEarned: number,
    onComplete: () => void
  ): void {
    if (this.inFlight) {
      onComplete();
      return;
    }
    this.inFlight = true;

    const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
    const finish = () => {
      this.inFlight = false;
      if (sceneActive(scene)) onComplete();
    };

    // "LOOP N COMPLETE" text
    const loopText = scene.add.text(400, 280, `LOOP ${loopNumber} COMPLETE`, {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffd700',
      fontFamily,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setScale(0).setAlpha(1);

    scene.tweens.add({
      targets: loopText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        scene.time.delayedCall(800, () => {
          if (!sceneActive(scene)) return;
          scene.tweens.add({
            targets: loopText,
            alpha: 0,
            duration: 400,
            onComplete: () => loopText.destroy(),
          });
        });
      },
    });

    const tpText = scene.add.text(400, 320, `+${tilePointsEarned} Tile Points`, {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#00e5ff',
      fontFamily,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

    scene.time.delayedCall(200, () => {
      if (!sceneActive(scene)) return;
      scene.tweens.add({
        targets: tpText,
        alpha: 1,
        duration: 200,
        onComplete: () => {
          if (!sceneActive(scene)) return;
          scene.tweens.add({
            targets: tpText,
            y: tpText.y - 20,
            alpha: 0,
            duration: 600,
            onComplete: () => tpText.destroy(),
          });
        },
      });
    });

    scene.time.delayedCall(1500, finish);
  }
}
