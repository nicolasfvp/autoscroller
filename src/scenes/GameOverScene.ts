import { Scene } from 'phaser';
import { getRun, createNewRun, setRun, clearRun } from '../state/RunState';
import { saveManager } from '../core/SaveManager';

/**
 * GameOverScene -- displays final run statistics.
 * Offers New Run and Main Menu buttons.
 */
export class GameOverScene extends Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    const run = getRun();

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Title
    this.add.text(400, 80, 'GAME OVER', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ff8888',
    }).setOrigin(0.5);

    // Run statistics
    this.add.text(400, 160, 'Run Statistics', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(400, 210, `Loops Completed: ${run.loop.count}`, {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(400, 240, `Gold Earned: ${run.economy.gold}`, {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(400, 270, `Cards in Deck: ${run.deck.active.length}`, {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(400, 300, `Relics: ${run.relics.length}`, {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // New Run button
    const newRunBtn = this.add.text(300, 420, 'New Run', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    newRunBtn.on('pointerover', () => newRunBtn.setColor('#ffffff'));
    newRunBtn.on('pointerout', () => newRunBtn.setColor('#ffd700'));
    newRunBtn.on('pointerdown', async () => {
      await saveManager.clear();
      setRun(createNewRun());
      this.scene.start('Game');
    });

    // Main Menu button
    const menuBtn = this.add.text(500, 420, 'Main Menu', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffd700',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => menuBtn.setColor('#ffffff'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#ffd700'));
    menuBtn.on('pointerdown', async () => {
      await saveManager.clear();
      clearRun();
      this.scene.start('MainMenu');
    });

    this.events.on('shutdown', this.cleanup, this);
  }

  private cleanup(): void {
    // No eventBus listeners to clean
  }
}
