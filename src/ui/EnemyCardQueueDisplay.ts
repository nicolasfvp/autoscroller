// Enemy attack-card queue — the right-side mirror of CardQueueDisplay.
//
// The hero's queue (CardQueueDisplay) reads the run deck; the enemy has no
// shuffled deck, just a fixed list of generic attacks (claw, smash, …) from
// EnemyAttackCards. We synthesise a small repeating "deck" from that list so
// the same 3-slot staircase + slide/burst animation can be reused, mirrored
// to the bottom-right so it reads as the enemy's intent.
//
// Cards render through createCardFaceFromDef (NOT createCardVisual) because
// enemy attacks live in their own registry, not the hero DataLoader.

import { createCardFaceFromDef } from './CardFace';
import { enemyAttackToCardDef, type EnemyAttackCard } from '../data/EnemyAttackCards';

const VISIBLE_COUNT = 3;

// [centerX, centerY, scale, alpha] — the enemy queue mirrors the hero's
// staircase to the bottom-RIGHT. The active (next) attack sits the SAME
// distance to the RIGHT of the enemy hourglass as the hero's active card sits
// to the LEFT of the hero hourglass:
//   hero hourglass x=369, hero active card x=274  → gap = 95 (card left of hg)
//   enemy hourglass x=471                          → active card x = 471+95 = 566
// The cascade then mirrors the hero's steps (−110, −75 → +110, +75).
// Same Y as the hero queue.
const SLOTS: [number, number, number, number][] = [
  [566, 522, 0.48, 1.00],   // 0 — NEXT ATTACK (large)
  [663, 537, 0.38, 0.70],   // 1
  [736, 548, 0.29, 0.35],   // 2
];
const SLOT_INCOMING_X = 720; // off-screen feeder column
const SLOT_INCOMING_Y = 650; // off-screen bottom

export class EnemyCardQueueDisplay {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private deck: string[] = [];           // attack ids, repeated to fill the queue
  private attacks: Record<string, EnemyAttackCard> = {};
  private pointer = 0;
  private animating = false;
  private readonly playTweens: Set<Phaser.Tweens.Tween> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(50);
  }

  /** Provide the enemy's attack list. Builds a repeating deck so the 3 slots
   *  are always filled even when the enemy has a single attack. */
  public setAttacks(attacks: EnemyAttackCard[]): void {
    this.attacks = {};
    for (const a of attacks) this.attacks[a.id] = a;

    const ids = attacks.map(a => a.id);
    if (ids.length === 0) { this.deck = []; this.rebuild(); return; }
    // Repeat the cycle until we have at least VISIBLE_COUNT + 1 entries so the
    // incoming-slide always has a card to pull in.
    this.deck = [];
    while (this.deck.length < VISIBLE_COUNT + 1) this.deck.push(...ids);
    this.pointer = 0;
    this.rebuild();
  }

  private createCard(attackId: string, x: number, y: number): Phaser.GameObjects.Container {
    const attack = this.attacks[attackId];
    const def = enemyAttackToCardDef(attack);
    return createCardFaceFromDef(this.scene, x, y, def, {
      baseSize: 'small',
      hover: false,
      artKey: attack.cardKey,
    });
  }

  private getSlot(i: number): [number, number, number, number] {
    return SLOTS[i] ?? SLOTS[VISIBLE_COUNT - 1];
  }

  private rebuild(): void {
    for (const c of this.cardContainers) c.destroy();
    this.cardContainers = [];
    if (this.pulseTween) { this.pulseTween.destroy(); this.pulseTween = null; }
    if (this.deck.length === 0) return;

    for (let i = 0; i < VISIBLE_COUNT && i < this.deck.length; i++) {
      const id = this.deck[(this.pointer + i) % this.deck.length];
      const [x, y, scale, alpha] = this.getSlot(i);
      const card = this.createCard(id, x, y);
      card.setScale(scale);
      card.setAlpha(alpha);
      this.container.add(card);
      this.cardContainers.push(card);

      if (i === 0) {
        this.pulseTween = this.scene.tweens.add({
          targets: card,
          scaleX: scale * 1.05, scaleY: scale * 1.05,
          duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }
    }
  }

  /** Advance the queue by one — the active attack bursts out and the rest
   *  slide over, mirroring the hero's onCardPlayed. Call on each enemy attack. */
  public onAttack(): void {
    if (this.cardContainers.length === 0 || this.animating || this.deck.length === 0) return;
    this.animating = true;
    const top = this.cardContainers[0];

    if (this.pulseTween) { this.pulseTween.destroy(); this.pulseTween = null; }

    const burst = this.scene.tweens.add({
      targets: top,
      scaleX: 1.4, scaleY: 1.4, alpha: 0,
      duration: 380, ease: 'Quad.easeOut',
      onComplete: () => { top.destroy(); this.playTweens.delete(burst); },
      onStop: () => { this.playTweens.delete(burst); },
    });
    this.playTweens.add(burst);

    const incomingId = this.deck[(this.pointer + VISIBLE_COUNT) % this.deck.length];
    const incoming = this.createCard(incomingId, SLOT_INCOMING_X, SLOT_INCOMING_Y);
    incoming.setScale(this.getSlot(VISIBLE_COUNT - 1)[2]);
    incoming.setAlpha(0);
    this.container.add(incoming);

    const slideTargets = [...this.cardContainers.slice(1), incoming];

    for (let newIdx = 0; newIdx < slideTargets.length; newIdx++) {
      const card = slideTargets[newIdx];
      const [tx, ty, tScale, tAlpha] = this.getSlot(newIdx);
      const isLast = newIdx === slideTargets.length - 1;

      const slide = this.scene.tweens.add({
        targets: card,
        x: tx, y: ty,
        scaleX: tScale, scaleY: tScale,
        alpha: tAlpha,
        duration: 350, ease: 'Cubic.easeOut',
        onComplete: () => {
          if (card === incoming) incoming.destroy();
          this.playTweens.delete(slide);
          if (isLast) {
            this.animating = false;
            this.pointer = (this.pointer + 1) % this.deck.length;
            this.rebuild();
          }
        },
        onStop: () => { this.playTweens.delete(slide); },
      });
      this.playTweens.add(slide);
    }
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
