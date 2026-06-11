import { FONTS } from '../ui/StyleConstants';
import { getLocale } from '../i18n/i18n';
// Synergy "COMBO!" flash animation at screen center.
// Auto-destroys all created objects after animation completes.

/** pt-BR labels for the synergy bonus types (SynergyDefinition.bonus.type). */
const BONUS_TYPE_PT: Record<string, string> = {
  damage: 'de dano', armor: 'de armadura', heal: 'de cura', stamina: 'de vigor',
  mana: 'de mana', cost_waive: 'custo grátis', dot: 'de dano contínuo',
  stat_buff: 'de atributo', cooldown_reduction: 'de recarga',
};

/**
 * Show a COMBO! flash with bonus text at canvas center.
 */
export function showSynergyFlash(
  scene: Phaser.Scene,
  bonusType: string,
  bonusValue: number,
  displayName: string,
): void {
  // "COMBO!" text at center-top
  const comboText = scene.add.text(400, 120, 'COMBO!', {
    fontSize: '36px',
    fontFamily: FONTS.body,
    fontStyle: 'bold',
    color: '#ffff00',
    stroke: '#000000',
    strokeThickness: 4,
    shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true }
  }).setOrigin(0.5).setDepth(500).setScale(0);

  // Scale in with overshoot
  scene.tweens.add({
    targets: comboText,
    scaleX: 1.05,
    scaleY: 1.05,
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
  const typeLabel = getLocale() === 'pt-br' ? (BONUS_TYPE_PT[bonusType] ?? bonusType) : bonusType;
  const bonusLabel = `${displayName} +${bonusValue} ${typeLabel}`;
  const bonusText = scene.add.text(400, 160, bonusLabel, {
    fontSize: '20px',
    fontFamily: FONTS.body,
    fontStyle: 'bold',
    color: '#00ffff',
    stroke: '#000000',
    strokeThickness: 3,
    shadow: { offsetX: 1, offsetY: 1, color: '#000000', fill: true }
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
