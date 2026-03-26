import { Scene } from 'phaser';

/**
 * BossExitScene -- boss exit choice overlay with two-panel layout.
 * Stub for Task 1 compilation; full implementation in Task 2.
 */
export class BossExitScene extends Scene {
  constructor() {
    super('BossExitScene');
  }

  create(): void {
    // Stub -- will be implemented in Task 2
    this.add.rectangle(400, 300, 600, 400, 0x222222, 0.9);
    this.add.text(400, 300, 'Boss Defeated! (stub)', {
      fontSize: '32px', fontStyle: 'bold', color: '#ffd700',
    }).setOrigin(0.5);
  }
}
