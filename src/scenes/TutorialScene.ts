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
import { COLORS, FONTS, LAYOUT, createButton } from '../ui/StyleConstants';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import type { MetaState } from '../state/MetaState';
import { SCENE_KEYS } from '../state/SceneKeys';
import { tutorialDirector } from '../systems/tutorial/TutorialDirector';

interface TutorialTopic {
  id: string;
  label: string;
  title: string;
  body: string;
}

const TOPICS: TutorialTopic[] = [
  {
    id: 'combat',
    label: '⚔ Combat',
    title: 'Auto-Combat',
    body:
      'Your hero plays cards on cooldown — you do not click to attack.\n' +
      'Cards in the hand fire one at a time from top to bottom.\n' +
      'Light cards (low cooldown) cycle fast; heavy cards hit harder but recharge slow.\n\n' +
      'KEYWORDS appear inside card descriptions (Burn, Slow, Vengeance, …).\n' +
      'When you play a card that introduces a NEW keyword, the game pauses\n' +
      'and explains what it does. Use the "?" button at any time to revisit\n' +
      'the keywords you have learned.',
  },
  {
    id: 'deck',
    label: '📜 Deck',
    title: 'Your Deck',
    body:
      'Before each run, pick a deck TEMPLATE — a 5-card starter tuned for\n' +
      'a particular playstyle (Iron Wall, Berserker, Pyromancer, …).\n\n' +
      'Cards play themselves in combat, top to bottom, on cooldown.\n' +
      'The Deck panel (mid-run, from the loop overlay) lets you REORDER\n' +
      'cards and slot any new ones you have looted into the play order.',
  },
  {
    id: 'relics',
    label: '💎 Relics',
    title: 'Relics',
    body:
      'Relics are passive artifacts you BUY in the shop — they are never\n' +
      'equipped or unequipped, just owned.\n\n' +
      'Each relic listens for a trigger (you took a hit, an enemy died,\n' +
      'armor broke, a stack tipped past a threshold, …) and fires a\n' +
      'bonus effect when it sees that trigger.\n\n' +
      'In the shop, relics that combo with your deck (≥ 2 cards share a\n' +
      'keyword) glow gold — those are the higher-value picks for the\n' +
      'archetype you are running.',
  },
  {
    id: 'loop',
    label: '🗺 Tiles',
    title: 'Tiles & Placement',
    body:
      'During planning you place tiles on the loop path using Tile Points (TP).\n\n' +
      '  • Click a tile in the inventory to select it, then click an empty\n' +
      '    slot on the path to place it.\n' +
      '  • Each tile costs TP. Your TP balance shows above the inventory.\n' +
      '  • Combat tiles reserve adjacent slots. Reserved slots only accept\n' +
      '    SUBTILES (ambush, mana well, war horn, …) that buff the fight.\n' +
      '  • Remove Mode (toggle button) refunds 50% TP when you click a\n' +
      '    placed tile — use it to rebuild your plan.\n\n' +
      'Beat the boss to exit safely with full rewards. Die mid-loop and\n' +
      'you keep only a fraction of what you earned.',
  },
];

export class TutorialScene extends Scene {
  private metaState!: MetaState;
  private replayMode = false;
  private parentSceneKey: string = SCENE_KEYS.CITY_HUB;

  private titleText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private tabButtons: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;

  constructor() {
    super(SCENE_KEYS.TUTORIAL);
  }

  async create(data?: { replay?: boolean; parentScene?: string }): Promise<void> {
    this.replayMode = !!data?.replay;
    this.parentSceneKey = data?.parentScene ?? SCENE_KEYS.CITY_HUB;
    this.selectedIndex = 0;
    this.tabButtons = [];

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
    this.add.text(LAYOUT.centerX, 50, 'Tutorial', {
      ...FONTS.title,
      color: COLORS.accent,
      fontFamily: FONTS.family,
    }).setOrigin(0.5);

    this.add.text(LAYOUT.centerX, 92, 'Pick a topic — read in any order. Combat teaching is also contextual: the game pauses on each new keyword you encounter.', {
      fontSize: '12px',
      color: COLORS.textSecondary,
      fontFamily: FONTS.family,
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
      fontFamily: FONTS.family,
    }).setOrigin(0, 0);

    this.bodyText = this.add.text(panelX + 24, panelY + 58, '', {
      fontSize: '14px',
      color: COLORS.textPrimary,
      fontFamily: FONTS.family,
      wordWrap: { width: panelW - 48 },
      lineSpacing: 5,
    }).setOrigin(0, 0);

    // Done / close button
    const closeLabel = this.replayMode ? 'Close' : 'Start Game';
    createButton(this, LAYOUT.centerX, 540, closeLabel, () => this.completeTutorial(), 'primary');


    // Tab-key cycling between topics for keyboard-driven readers.
    this.input.keyboard?.on('keydown-TAB', (ev: KeyboardEvent) => {
      ev.preventDefault();
      const next = (this.selectedIndex + 1) % TOPICS.length;
      this.selectTab(next);
    });

    this.selectTab(0);

    this.events.on('shutdown', this.cleanup, this);
  }

  private renderTabs(): void {
    const baseY = 150;
    const totalWidth = TOPICS.length * 140;
    const startX = (LAYOUT.canvasWidth - totalWidth) / 2;
    TOPICS.forEach((topic, i) => {
      const x = startX + i * 140 + 70;
      const btn = this.add.text(x, baseY, topic.label, {
        fontSize: '16px',
        fontStyle: 'bold',
        color: COLORS.textSecondary,
        fontFamily: FONTS.family,
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
    const topic = TOPICS[index];
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
