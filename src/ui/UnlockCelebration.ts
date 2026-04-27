/**
 * Plays an unlock celebration animation on the active scene.
 * "\uD83C\uDFC6 New Unlock!" title + item name, auto-destroys after animation.
 */
export function playUnlockCelebration(
  scene: Phaser.Scene,
  itemName: string,
  rarityColor: number = 0xffd700
): void {
  const fontFamily = 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif';
  const rarityHex = '#' + rarityColor.toString(16).padStart(6, '0');

  // Semi-transparent backdrop for readability (feedback #5)
  const backdrop = scene.add.rectangle(400, 300, 450, 160, 0x000000, 0.7).setDepth(299);

  // "\uD83C\uDFC6 New Unlock!" text
  const titleText = scene.add.text(400, 270, '\uD83C\uDFC6 New Unlock!', {
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#ffd700',
    fontFamily,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(300).setScale(0);

  // Item name text
  const itemText = scene.add.text(400, 340, itemName, {
    fontSize: '24px',
    fontStyle: 'bold',
    color: rarityHex,
    fontFamily,
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(300).setAlpha(0);

  // Hint text
  const hintText = scene.add.text(400, 375, 'Check the Collection in CityHub!', {
    fontSize: '13px',
    color: '#aaaaaa',
    fontFamily,
  }).setOrigin(0.5).setDepth(300).setAlpha(0);

  // Title: scale from 0 -> 1.2 (300ms Back.easeOut), hold 1500ms, fade (400ms)
  scene.tweens.add({
    targets: titleText,
    scaleX: 1.2,
    scaleY: 1.2,
    duration: 300,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(1500, () => {
        scene.tweens.add({
          targets: [titleText, backdrop, hintText],
          alpha: 0,
          duration: 400,
          onComplete: () => { titleText.destroy(); backdrop.destroy(); hintText.destroy(); },
        });
      });
    },
  });

  // Item name: slides up from (400, 340) with 200ms delay, 300ms duration
  scene.time.delayedCall(200, () => {
    itemText.setAlpha(1);
    hintText.setAlpha(0.7);
    scene.tweens.add({
      targets: itemText,
      y: 310,
      duration: 300,
      ease: 'Power2',
    });

    // Fade out after title fades
    scene.time.delayedCall(1400, () => {
      scene.tweens.add({
        targets: itemText,
        alpha: 0,
        duration: 400,
        onComplete: () => itemText.destroy(),
      });
    });
  });
}
