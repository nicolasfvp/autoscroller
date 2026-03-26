import { Scene } from 'phaser';

/**
 * RestSiteScene -- rest site overlay with 3-choice cards.
 * Stub for Task 1 compilation; full implementation in Task 2.
 */
export class RestSiteScene extends Scene {
  constructor() {
    super('RestSiteScene');
  }

  create(): void {
    // Stub -- will be implemented in Task 2
    this.add.rectangle(400, 300, 500, 350, 0x222222, 0.9);
    this.add.text(400, 300, 'Rest Site (stub)', {
      fontSize: '24px', fontStyle: 'bold', color: '#4169e1',
    }).setOrigin(0.5);
  }
}
