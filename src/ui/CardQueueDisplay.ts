// Vertical card queue display for combat scene.
// Shows 5 cards at a time, animates card play/skip/reshuffle.

import type { CombatState } from '../systems/combat/CombatState';
import { createCardVisual } from './CardVisual';

const QUEUE_X = 728; // 800 - 72
const CARD_WIDTH = 72;
const CARD_HEIGHT = 96;
const GAP = 8;
const VISIBLE_COUNT = 5;
const SLOT_HEIGHT = CARD_HEIGHT + GAP; // 104
const START_Y = 44; // top padding

export class CardQueueDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private arrowIndicator: Phaser.GameObjects.Triangle | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private currentDeckOrder: string[] = [];
  private currentPointer = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(50);
  }

  /**
   * Refresh the queue display from current combat state.
   */
  update(state: CombatState, deckPointer: number): void {
    this.currentDeckOrder = state.deckOrder;
    this.currentPointer = deckPointer;
    this.rebuild();
  }

  private rebuild(): void {
    // Destroy old cards
    for (const c of this.cardContainers) {
      c.destroy();
    }
    this.cardContainers = [];
    if (this.arrowIndicator) {
      this.arrowIndicator.destroy();
      this.arrowIndicator = null;
    }
    if (this.pulseTween) {
      this.pulseTween.destroy();
      this.pulseTween = null;
    }

    const deck = this.currentDeckOrder;
    if (deck.length === 0) return;

    for (let i = 0; i < VISIBLE_COUNT && i < deck.length; i++) {
      const deckIdx = (this.currentPointer + i) % deck.length;
      const cardId = deck[deckIdx];
      const y = START_Y + i * SLOT_HEIGHT + CARD_HEIGHT / 2;
      const cardVis = createCardVisual(this.scene, QUEUE_X, y, cardId);
      this.container.add(cardVis);
      this.cardContainers.push(cardVis);

      if (i === 0) {
        // Current card: full opacity, accent pulse glow
        cardVis.setAlpha(1);
        // Gold stroke on current card background
        const bg = cardVis.getAt(0) as Phaser.GameObjects.Rectangle;
        if (bg) bg.setStrokeStyle(2, 0xffd700);
        // Pulse tween
        this.pulseTween = this.scene.tweens.add({
          targets: cardVis,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        // Next cards: dimmed
        cardVis.setAlpha(0.7);
      }
    }

    // Triangle arrow indicator left of current card
    const arrowY = START_Y + CARD_HEIGHT / 2;
    this.arrowIndicator = this.scene.add.triangle(
      QUEUE_X - CARD_WIDTH / 2 - 12,
      arrowY,
      0, -6, 0, 6, 10, 0,
      0xffd700,
    );
    this.container.add(this.arrowIndicator);
  }

  /**
   * Animate when a card is played: top card slides left and fades, others slide up.
   */
  onCardPlayed(_deckPosition: number): void {
    if (this.cardContainers.length === 0) return;
    const topCard = this.cardContainers[0];

    // Slide left and fade out
    this.scene.tweens.add({
      targets: topCard,
      x: topCard.x - 100,
      alpha: 0,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => {
        topCard.destroy();
      },
    });

    // Remaining cards slide up
    for (let i = 1; i < this.cardContainers.length; i++) {
      this.scene.tweens.add({
        targets: this.cardContainers[i],
        y: this.cardContainers[i].y - SLOT_HEIGHT,
        duration: 200,
        ease: 'Sine.easeOut',
      });
    }
  }

  /**
   * Flash "Skipped" text on the current card.
   */
  onCardSkipped(_deckPosition: number): void {
    if (this.cardContainers.length === 0) return;
    const topCard = this.cardContainers[0];
    const skipText = this.scene.add.text(topCard.x, topCard.y, 'Skipped', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: skipText,
      alpha: 0,
      y: skipText.y - 20,
      duration: 600,
      onComplete: () => skipText.destroy(),
    });
  }

  /**
   * Flash "Deck Reset" label at the bottom of the queue.
   */
  onDeckReshuffled(): void {
    const y = START_Y + VISIBLE_COUNT * SLOT_HEIGHT + 8;
    const resetText = this.scene.add.text(QUEUE_X, y, 'Deck Reset', {
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: resetText,
      alpha: 0,
      duration: 800,
      onComplete: () => resetText.destroy(),
    });
  }

  destroy(): void {
    if (this.pulseTween) {
      this.pulseTween.destroy();
      this.pulseTween = null;
    }
    for (const c of this.cardContainers) {
      c.destroy();
    }
    this.cardContainers = [];
    if (this.arrowIndicator) {
      this.arrowIndicator.destroy();
      this.arrowIndicator = null;
    }
    this.container.destroy();
  }
}
