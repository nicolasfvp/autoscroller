// TutorialScene -- topic-tabbed tutorial. Replaces the 6-slide slideshow
// per the beginner-mode redesign so the player can jump to whichever
// system they need help with instead of paging linearly.
//
// Topics: Combat / Deck / Relics / Loop (map tiles). First-run path:
// gated by MetaState.tutorialSeen — when an existing save has the flag
// set, this scene short-circuits to CityHub like the legacy version did.
//
// Replay path: PauseScene wires a button that launches this scene with
// `data.replay = true`, which keeps the seen flag set and routes the
// close button back to PauseScene instead of CityHub.

import { Scene } from 'phaser';
import { COLORS, FONTS, LAYOUT } from '../ui/StyleConstants';
import { createImageButton } from '../ui/WoodButton';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';
import { SCENE_KEYS } from '../state/SceneKeys';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';
import { t } from '../i18n/i18n';

interface TutorialTopic {
  id: string;
  label: string;
  title: string;
  body: string;
}

// Built per-scene so the active locale is resolved at render time (the i18n
// table is read synchronously by t(); a module-level const would freeze the
// translation at import time and miss runtime language switches).
function buildTopics(): TutorialTopic[] {
  return [
    {
      id: 'combat',
      label: t('tutorial.tabCombat'),
      title: t('tutorial.combatTitle'),
      body: t('tutorial.combatBody'),
    },
    {
      id: 'deck',
      label: t('tutorial.tabDeck'),
      title: t('tutorial.deckTitle'),
      body: t('tutorial.deckBody'),
    },
    {
      id: 'relics',
      label: t('tutorial.tabRelics'),
      title: t('tutorial.relicsTitle'),
      body: t('tutorial.relicsBody'),
    },
    {
      id: 'loop',
      label: t('tutorial.tabTiles'),
      title: t('tutorial.tilesTitle'),
      body: t('tutorial.tilesBody'),
    },
  ];
}

export class TutorialScene extends Scene {
  private metaState!: MetaState;
  private replayMode = false;
  private parentSceneKey: string = SCENE_KEYS.CITY_HUB;

  private titleText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private tabButtons: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private topics: TutorialTopic[] = [];

  constructor() {
    super(SCENE_KEYS.TUTORIAL);
  }

  async create(data?: { replay?: boolean; parentScene?: string }): Promise<void> {
    this.replayMode = !!data?.replay;
    this.parentSceneKey = data?.parentScene ?? SCENE_KEYS.CITY_HUB;
    this.selectedIndex = 0;
    this.tabButtons = [];
    this.topics = buildTopics();

    // Replay flows always land on the tutorial; only the first-run flow
    // honors the seen flag (so returning players don't get a slideshow on
    // every boot).
    if (!this.replayMode) {
      this.metaState = await loadMetaState();
      // Scripted tutorial takes over the first-run path — skip the tabbed
      // legacy slideshow and route into the GameScene directly. The director
      // has already armed the appropriate scene-level overlays.
      if (tutorialDirector.isActive()) {
        this.scene.start(SCENE_KEYS.GAME);
        return;
      }
      if (this.metaState.tutorialSeen) {
        this.scene.start(SCENE_KEYS.CITY_HUB);
        return;
      }
    } else {
      this.metaState = await loadMetaState();
    }

    this.cameras.main.setBackgroundColor(COLORS.background);

    // Title
    this.add.text(LAYOUT.centerX, 50, t('tutorial.title'), {
      ...FONTS.title,
      color: COLORS.accent,
      fontFamily: FONTS.body,
    }).setOrigin(0.5);

    this.add.text(LAYOUT.centerX, 92, t('tutorial.subtitle'), {
      fontSize: '12px',
      color: COLORS.textSecondary,
      fontFamily: FONTS.body,
      align: 'center',
      wordWrap: { width: 680 },
    }).setOrigin(0.5);

    // Topic tab strip
    this.renderTabs();

    // Active-topic content panel (drawn once; mutated by selectTab).
    const panelX = 80;
    const panelY = 200;
    const panelW = LAYOUT.canvasWidth - panelX * 2;
    const panelH = 280;
    this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x9a6030);

    this.titleText = this.add.text(panelX + 24, panelY + 18, '', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: COLORS.accent,
      fontFamily: FONTS.body,
    }).setOrigin(0, 0);

    this.bodyText = this.add.text(panelX + 24, panelY + 58, '', {
      fontSize: '14px',
      color: COLORS.textPrimary,
      fontFamily: FONTS.body,
      wordWrap: { width: panelW - 48 },
      lineSpacing: 5,
    }).setOrigin(0, 0);

    // Done / close button
    const closeLabel = this.replayMode ? t('tutorial.close') : t('tutorial.startGame');
    createImageButton(this, LAYOUT.centerX, 540, closeLabel, () => this.completeTutorial(), 240, 56);


    // Tab-key cycling between topics for keyboard-driven readers.
    this.input.keyboard?.on('keydown-TAB', (ev: KeyboardEvent) => {
      ev.preventDefault();
      const next = (this.selectedIndex + 1) % this.topics.length;
      this.selectTab(next);
    });

    this.selectTab(0);

    this.events.on('shutdown', this.cleanup, this);
  }

  private renderTabs(): void {
    const baseY = 150;
    const totalWidth = this.topics.length * 140;
    const startX = (LAYOUT.canvasWidth - totalWidth) / 2;
    this.topics.forEach((topic, i) => {
      const x = startX + i * 140 + 70;
      const btn = this.add.text(x, baseY, topic.label, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        padding: { left: 14, right: 14, top: 8, bottom: 8 },
        backgroundColor: '#2a1a3e',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => {
        if (this.selectedIndex !== i) btn.setColor(COLORS.textPrimary);
      });
      btn.on('pointerout', () => {
        if (this.selectedIndex !== i) btn.setColor(COLORS.textSecondary);
      });
      btn.on('pointerdown', () => this.selectTab(i));
      this.tabButtons.push(btn);
    });
  }

  private selectTab(index: number): void {
    this.selectedIndex = index;
    this.tabButtons.forEach((btn, i) => {
      if (i === index) {
        btn.setColor(COLORS.accent);
        btn.setBackgroundColor('#5a2a8e');
      } else {
        btn.setColor(COLORS.textSecondary);
        btn.setBackgroundColor('#2a1a3e');
      }
    });
    const topic = this.topics[index];
    this.titleText.setText(topic.title);
    this.bodyText.setText(topic.body);
  }

  private async completeTutorial(): Promise<void> {
    if (!this.metaState.tutorialSeen) {
      this.metaState.tutorialSeen = true;
      await saveMetaState(this.metaState);
    }
    if (this.replayMode) {
      // Replay flow: hand control back to the launcher (usually PauseScene).
      const parent = this.parentSceneKey;
      const isSleeping = this.scene.isSleeping(parent);
      this.scene.stop();
      if (isSleeping) this.scene.wake(parent);
      else if (this.scene.get(parent)) this.scene.resume(parent);
    } else {
      this.scene.start(SCENE_KEYS.CITY_HUB);
    }
  }

  private cleanup(): void {
    // No eventBus listeners; tab text objects clean up with the scene.
  }
}
