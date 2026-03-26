import { Scene } from 'phaser';

/**
 * PlanningOverlay -- planning phase UI with miniature loop grid and tile inventory.
 * Stub for Task 1 compilation; full implementation in Task 2.
 */
export class PlanningOverlay extends Scene {
  constructor() {
    super('PlanningOverlay');
  }

  create(): void {
    // Stub -- will be implemented in Task 2
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    this.add.text(400, 300, 'Planning Phase (stub)', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
  }
}
