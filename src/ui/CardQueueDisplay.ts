// Vertical card queue display for combat scene.
// Shows 5 cards at a time, animates card play/skip/reshuffle.

import type { CombatState } from '../systems/combat/CombatState';
import { createCardVisual } from './CardVisual';

const QUEUE_X = 740;
const CARD_WIDTH = 75; // 150 * 0.5
const CARD_HEIGHT = 120; // 240 * 0.5
const GAP = 15; // Espaço confortável
const VISIBLE_COUNT = 3; // Menos cartas visíveis por vez para limpar a área central
const START_Y = 110; // Cobre exatamente do limite final da barra de HP do inimigo e desce

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
  public update(state: CombatState, deckPointer: number): void {
    // Evita reconstrução na mesmíssima alteração se quisermos gerenciar animações de forma assíncrona
    this.currentDeckOrder = state.deckOrder;
    this.currentPointer = deckPointer;
    this.rebuild();
  }

  /**
   * Helpers matemáticos para o Carrossel 
   * Retorna a coordenada Y perfeita dado o slot index (0 = topo gigante, etc.)
   */
  private getSlotY(slotIndex: number): number {
    let yCursor = START_Y;
    for (let i = 0; i <= slotIndex; i++) {
       const isTop = (i === 0);
       const cardScale = isTop ? 0.65 : 0.45;
       const currentCardHeight = 240 * cardScale;
       if (i === slotIndex) {
         return yCursor + currentCardHeight / 2;
       }
       yCursor += currentCardHeight + GAP;
    }
    return START_Y;
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
      
      const isTop = (i === 0);
      const cardScale = isTop ? 0.65 : 0.45; 
      
      const y = this.getSlotY(i);
      const cardVis = createCardVisual(this.scene, QUEUE_X, y, cardId, { scale: cardScale });
      this.container.add(cardVis);
      this.cardContainers.push(cardVis);

      if (isTop) {
        // Current card: full opacity, accent pulse glow
        cardVis.setAlpha(1);
        // Gold stroke on current card background
        const bg = cardVis.getAt(0) as Phaser.GameObjects.Rectangle;
        if (bg) bg.setStrokeStyle(3, 0xffd700);
        // Pulse tween
        this.pulseTween = this.scene.tweens.add({
          targets: cardVis,
          scaleX: cardScale * 1.05, 
          scaleY: cardScale * 1.05,
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
    const firstCardHeight = 240 * 0.65;
    const arrowY = START_Y + firstCardHeight / 2;
    this.arrowIndicator = this.scene.add.triangle(
      QUEUE_X - (150 * 0.65) / 2 - 14,
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

    // "Explodes" in place and fade out effect - more dramatic
    this.scene.tweens.add({
      targets: topCard,
      scaleX: 1.4, // Huge scale burst
      scaleY: 1.4,
      alpha: 0,
      duration: 400, // Slightly longer so the explosion is visible
      ease: 'Quad.easeOut', // Fast start, slowing down as it fades
      onComplete: () => {
        topCard.destroy();
      },
    });

    // Smooth incoming ghost card fading in from below the visible slots
    const incomingIdx = (this.currentPointer + VISIBLE_COUNT) % this.currentDeckOrder.length;
    const incomingCardId = this.currentDeckOrder[incomingIdx];
    
    // Spawn it at the 4th slot position (which is off-screen visually)
    const spawnY = this.getSlotY(VISIBLE_COUNT);
    const incomingCard = createCardVisual(this.scene, QUEUE_X, spawnY, incomingCardId, { scale: 0.45 });
    incomingCard.setAlpha(0); // starts invisible and fades in
    this.container.add(incomingCard);

    // Slide up existing cards AND ghost bottom card, smoothly scaling them into their new slots!
    const slideTargets = [...this.cardContainers.slice(1), incomingCard];
    
    for (let newIdx = 0; newIdx < slideTargets.length; newIdx++) {
      const card = slideTargets[newIdx];
      const isBecomingTop = (newIdx === 0);
      
      const targetY = this.getSlotY(newIdx);
      const targetScale = isBecomingTop ? 0.65 : 0.45;
      const targetAlpha = isBecomingTop ? 1 : 0.8;

      this.scene.tweens.add({
        targets: card,
        y: targetY,
        scaleX: targetScale,
        scaleY: targetScale,
        alpha: targetAlpha,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (card === incomingCard) incomingCard.destroy(); // Will be replaced exactly by rebuild()
        }
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
    const yReset = this.getSlotY(VISIBLE_COUNT) + 10;
    const resetText = this.scene.add.text(QUEUE_X, yReset, 'Deck Reset', {
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
