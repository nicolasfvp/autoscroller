import { Scene } from 'phaser';

/**
 * TreasureScene -- treasure overlay with loot display and Take All.
 * Stub for Task 1 compilation; full implementation in Task 2.
 */
export class TreasureScene extends Scene {
  constructor() {
    super('TreasureScene');
  }

  create(): void {
    // Stub -- will be implemented in Task 2
    this.add.rectangle(400, 300, 500, 350, 0x222222, 0.9);
    this.add.text(400, 300, 'Treasure! (stub)', {
      fontSize: '24px', fontStyle: 'bold', color: '#ff8c00',
    }).setOrigin(0.5);
  }
}
