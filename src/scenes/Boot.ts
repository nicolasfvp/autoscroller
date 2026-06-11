import { Scene } from 'phaser';
import { loadAllData } from '../data/DataLoader';
import { LAYOUT } from '../ui/StyleConstants';
import { getLocale } from '../i18n/i18n';
import { applyDataLocale } from '../i18n/dataLocalize';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);
    loadAllData();
    // Localize all data-content (names/descriptions) to the active locale before
    // any scene reads them. getLocale() resolves synchronously from the
    // localStorage mirror (default 'pt-br'); the durable MetaState copy is
    // reconciled in main.ts once idb-keyval resolves.
    applyDataLocale(getLocale());
    this.scene.start('Preloader');
  }
}
