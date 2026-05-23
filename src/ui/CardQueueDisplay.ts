// Horizontal bottom-bar card queue for the combat scene.
// 4 cards occupy the RIGHT half of the canvas (x ≥ 353) so they never overlap
// the SpeedPanelScene (x=8–276, y=478–588, depth 999).

import type { CombatState } from '../systems/combat/CombatState';
import { createCardVisual } from './CardVisual';

const VISIBLE_COUNT = 5;

// [centerX, centerY, scale, alpha]
// Queue lives in the bottom-right corner. The staircase steps DOWN-RIGHT so
// the last 3 cards descend into the corner; new cards rise up from below.
// Alpha decays in even 0.20 steps for a smooth front-to-back gradient.
const SLOTS: [number, number, number, number][] = [
  [500, 490, 0.62, 1.00],   // 0 — PLAYING (front, top-left of the cluster)
  [598, 505, 0.56, 0.80],   // 1 — NEXT
  [665, 525, 0.42, 0.60],   // 2 — stair starts descending
  [705, 545, 0.36, 0.40],   // 3 — stair, aglutinated
  [735, 560, 0.32, 0.20],   // 4 — corner
];
const SLOT_INCOMING_X = 735; // same column as slot 4 — cards slide UP into it
const SLOT_INCOMING_Y = 650; // off-screen bottom

export class CardQueueDisplay {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private currentDeckOrder: string[] = [];
  private currentPointer = 0;
  private animatingPlay = false;
  private pendingState: { deck: string[]; pointer: number } | null = null;
  private readonly playTweens: Set<Phaser.Tweens.Tween> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(50);
  }

  public update(state: CombatState, deckPointer: number): void {
    if (this.animatingPlay) {
      this.pendingState = { deck: state.deckOrder, pointer: deckPointer };
      return;
    }
    this.currentDeckOrder = state.deckOrder;
    this.currentPointer = deckPointer;
    this.rebuild();
  }

  private getSlotX(i: number): number { return (SLOTS[i] ?? SLOTS[VISIBLE_COUNT - 1])[0]; }
  private getSlotY(i: number): number { return (SLOTS[i] ?? SLOTS[VISIBLE_COUNT - 1])[1]; }
  private getSlotScale(i: number): number { return (SLOTS[i] ?? SLOTS[VISIBLE_COUNT - 1])[2]; }
  private getSlotAlpha(i: number): number { return (SLOTS[i] ?? SLOTS[VISIBLE_COUNT - 1])[3]; }

  private rebuild(): void {
    for (const c of this.cardContainers) c.destroy();
    this.cardContainers = [];
    if (this.pulseTween) { this.pulseTween.destroy(); this.pulseTween = null; }

    const deck = this.currentDeckOrder;
    if (deck.length === 0) return;

    for (let i = 0; i < VISIBLE_COUNT && i < deck.length; i++) {
      const cardId = deck[(this.currentPointer + i) % deck.length];
      const scale = this.getSlotScale(i);
      // Build the card at unit scale (intrinsic size) and apply the slot
      // scale via transform — this is what lets the slide tween animate
      // scaleX/scaleY between slots. Building at a baked size leaves
      // container.scaleX at 1.0, and the tween then shrinks it again.
      const cardVis = createCardVisual(this.scene, this.getSlotX(i), this.getSlotY(i), cardId);
      cardVis.setScale(scale);
      cardVis.setAlpha(this.getSlotAlpha(i));
      this.container.add(cardVis);
      this.cardContainers.push(cardVis);

      if (i === 0) {
        this.pulseTween = this.scene.tweens.add({
          targets: cardVis,
          scaleX: scale * 1.05, scaleY: scale * 1.05,
          duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
    }
  }

  onCardPlayed(_deckPosition: number): void {
    if (this.cardContainers.length === 0 || this.animatingPlay) return;
    this.animatingPlay = true;
    const topCard = this.cardContainers[0];

    // Stop the idle pulse before the burst — otherwise the yoyo keeps dragging
    // scale back toward the resting value and the card visibly shrinks before
    // the burst overpowers it.
    if (this.pulseTween) { this.pulseTween.destroy(); this.pulseTween = null; }

    const burst = this.scene.tweens.add({
      targets: topCard,
      scaleX: 1.4, scaleY: 1.4, alpha: 0,
      duration: 380, ease: 'Quad.easeOut',
      onComplete: () => { topCard.destroy(); this.playTweens.delete(burst); },
      onStop: () => { this.playTweens.delete(burst); },
    });
    this.playTweens.add(burst);

    const incomingIdx = (this.currentPointer + VISIBLE_COUNT) % this.currentDeckOrder.length;
    const incomingCard = createCardVisual(
      this.scene, SLOT_INCOMING_X, SLOT_INCOMING_Y,
      this.currentDeckOrder[incomingIdx],
    );
    incomingCard.setScale(this.getSlotScale(VISIBLE_COUNT - 1));
    incomingCard.setAlpha(0);
    this.container.add(incomingCard);

    const slideTargets = [...this.cardContainers.slice(1), incomingCard];

    for (let newIdx = 0; newIdx < slideTargets.length; newIdx++) {
      const card = slideTargets[newIdx];
      const targetX = this.getSlotX(newIdx);
      const targetY = this.getSlotY(newIdx);
      const targetScale = this.getSlotScale(newIdx);
      const targetAlpha = this.getSlotAlpha(newIdx);
      const isLast = newIdx === slideTargets.length - 1;

      const slide = this.scene.tweens.add({
        targets: card,
        x: targetX, y: targetY,
        scaleX: targetScale, scaleY: targetScale,
        alpha: targetAlpha,
        duration: 350, ease: 'Cubic.easeOut',
        onComplete: () => {
          if (card === incomingCard) incomingCard.destroy();
          this.playTweens.delete(slide);
          if (isLast) {
            this.animatingPlay = false;
            if (this.pendingState) {
              const next = this.pendingState;
              this.pendingState = null;
              this.currentDeckOrder = next.deck;
              this.currentPointer = next.pointer;
              this.rebuild();
            }
          }
        },
        onStop: () => { this.playTweens.delete(slide); },
      });
      this.playTweens.add(slide);
    }
  }

  onCardSkipped(_deckPosition: number): void {
    if (this.cardContainers.length === 0) return;
    const skipText = this.scene.add.text(SLOTS[0][0], SLOTS[0][1] - 90, 'Skipped', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: skipText,
      alpha: 0, y: skipText.y - 20,
      duration: 600,
      onComplete: () => skipText.destroy(),
    });
  }

  onDeckReshuffled(): void {
    const resetText = this.scene.add.text(580, 490, 'Deck Reset', {
      fontSize: '14px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: resetText,
      alpha: 0,
      duration: 800,
      onComplete: () => resetText.destroy(),
    });
  }

  destroy(): void {
    if (this.pulseTween) { this.pulseTween.destroy(); this.pulseTween = null; }
    for (const tw of this.playTweens) tw.stop();
    this.playTweens.clear();
    for (const c of this.cardContainers) c.destroy();
    this.cardContainers = [];
    this.container.destroy();
  }
}
