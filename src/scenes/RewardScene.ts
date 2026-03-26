// RewardScene -- card reward choice screen.
// Shows 3 cards to choose from (or skip). Uses LootSystem and DeckSystem.

import { Scene } from 'phaser';
import { getRun } from '../state/RunState';
import { generateCardReward, type RNG } from '../systems/deck/LootSystem';
import { addCard } from '../systems/deck/DeckSystem';
import { createCardVisual } from '../ui/CardVisual';

/** Simple Math.random-based RNG for runtime use */
const mathRng: RNG = { next: () => Math.random() };

export class RewardScene extends Scene {
  private selectedCardId: string | null = null;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private takeBtn: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('RewardScene');
  }

  create(): void {
    this.selectedCardId = null;
    this.cardContainers = [];

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Overlay panel
    this.add.rectangle(400, 300, 600, 400, 0x222222, 0.9);

    // Generate 3 card options
    const run = getRun();
    const rewardIds = generateCardReward(mathRng, 3, run.deck.active);

    if (rewardIds.length === 0) {
      // No reward -- empty state
      this.add.text(400, 260, 'No Reward', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      this.add.text(400, 300, 'No cards were offered this time. Continue onward.', {
        fontSize: '16px',
        color: '#aaaaaa',
        wordWrap: { width: 400 },
        align: 'center',
      }).setOrigin(0.5);

      // Auto-close after 2s or on click
      this.input.once('pointerdown', () => this.close());
      this.time.delayedCall(2000, () => this.close());
      return;
    }

    // Title
    this.add.text(400, 130, 'Choose a Card', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Instruction
    this.add.text(400, 160, 'Pick one card to add to your deck, or skip.', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Display 3 enlarged cards horizontally centered
    const cardWidth = 108;
    const cardGap = 64;
    const totalWidth = rewardIds.length * cardWidth + (rewardIds.length - 1) * cardGap;
    const startX = 400 - totalWidth / 2 + cardWidth / 2;

    for (let i = 0; i < rewardIds.length; i++) {
      const cardId = rewardIds[i];
      const x = startX + i * (cardWidth + cardGap);
      const cardVis = createCardVisual(this, x, 260, cardId, { enlarged: true });
      cardVis.setInteractive({ useHandCursor: true });
      cardVis.on('pointerdown', () => this.selectCard(cardId, i));
      this.cardContainers.push(cardVis);
    }

    // "Take Card" button -- hidden until selection
    this.takeBtn = this.add.text(400, 380, 'Take Card', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false);

    this.takeBtn.on('pointerover', () => this.takeBtn?.setColor('#ffffff'));
    this.takeBtn.on('pointerout', () => this.takeBtn?.setColor('#ffd700'));
    this.takeBtn.on('pointerdown', () => {
      if (this.selectedCardId) {
        addCard(this.selectedCardId, getRun());
        this.close();
      }
    });

    // "Skip" button
    const skipBtn = this.add.text(580, 450, 'Skip', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    skipBtn.on('pointerover', () => skipBtn.setColor('#ffffff'));
    skipBtn.on('pointerout', () => skipBtn.setColor('#aaaaaa'));
    skipBtn.on('pointerdown', () => this.close());

    this.events.on('shutdown', this.cleanup, this);
  }

  private selectCard(cardId: string, index: number): void {
    this.selectedCardId = cardId;

    // Highlight selected, dim others
    for (let i = 0; i < this.cardContainers.length; i++) {
      const c = this.cardContainers[i];
      if (i === index) {
        c.setAlpha(1);
        c.setScale(1.05);
        // Accent stroke on background
        const bg = c.getAt(0) as Phaser.GameObjects.Rectangle;
        if (bg) bg.setStrokeStyle(3, 0xffd700);
      } else {
        c.setAlpha(0.5);
        c.setScale(1);
        // Reset stroke
        const bg = c.getAt(0) as Phaser.GameObjects.Rectangle;
        if (bg) bg.setStrokeStyle(2, 0xcccccc);
      }
    }

    // Show Take button
    if (this.takeBtn) this.takeBtn.setVisible(true);
  }

  private close(): void {
    this.scene.start('Game');
  }

  private cleanup(): void {
    this.cardContainers = [];
    this.takeBtn = null;
    this.selectedCardId = null;
  }
}
