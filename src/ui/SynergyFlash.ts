// Synergy "COMBO!" flash animation at screen center.
// Auto-destroys all created objects after animation completes.

/**
 * Show a COMBO! flash with bonus text at canvas center.
 */
export function showSynergyFlash(
  scene: Phaser.Scene,
  bonusType: string,
  bonusValue: number,
  displayName: string,
): void {
  // "COMBO!" text at center
  const comboText = scene.add.text(400, 300, 'COMBO!', {
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#ff00ff',
  }).setOrigin(0.5).setDepth(500).setScale(0);

  // Scale in with overshoot
  scene.tweens.add({
    targets: comboText,
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 200,
    ease: 'Back.easeOut',
    onComplete: () => {
      // Hold for 400ms then fade
      scene.time.delayedCall(400, () => {
        scene.tweens.add({
          targets: comboText,
          alpha: 0,
          duration: 300,
          onComplete: () => comboText.destroy(),
        });
      });
    },
  });

  // Bonus text below COMBO
  const bonusLabel = `${displayName} +${bonusValue} ${bonusType}`;
  const bonusText = scene.add.text(400, 340, bonusLabel, {
    fontSize: '16px',
    color: '#ff00ff',
  }).setOrigin(0.5).setDepth(500).setAlpha(0);

  // Fade in after 100ms, then float up and fade
  scene.time.delayedCall(100, () => {
    scene.tweens.add({
      targets: bonusText,
      alpha: 1,
      duration: 100,
      onComplete: () => {
        scene.tweens.add({
          targets: bonusText,
          y: bonusText.y - 30,
          alpha: 0,
          duration: 600,
          onComplete: () => bonusText.destroy(),
        });
      },
    });
  });
}
