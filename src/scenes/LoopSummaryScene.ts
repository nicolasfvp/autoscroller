import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { FONTS } from '../ui/StyleConstants';
import { type LootEntry } from '../systems/PendingLoot';
import { type LoopRunner } from '../systems/LoopRunner';
import { type LoopRunState } from '../systems/LoopRunner';

interface SummaryData {
  loopRunner: LoopRunner;
  loopRunState: LoopRunState;
  lootItems: LootEntry[];
  tpEarned: number;
  loopCount: number;
}

export class LoopSummaryScene extends Scene {
  constructor() {
    super(SCENE_KEYS.LOOP_SUMMARY);
  }

  create(data: SummaryData): void {
    const { loopRunner, loopRunState, lootItems, tpEarned, loopCount } = data;
    const FF = FONTS.family;
    const cx = 400;

    // Dark overlay
    const overlay = this.add.rectangle(cx, 300, 800, 600, 0x05080f, 0.88);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 250 });

    // Panel
    const PW = 380;
    const itemH = 22;
    const itemCount = Math.max(lootItems.length, 1);
    const PH = Math.min(120 + itemCount * itemH + 60, 420);
    const PY = 300 - PH / 2;

    const panel = this.add.image(cx, 300, 'ui_panel').setDisplaySize(PW, PH).setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 300, delay: 100 });

    // Title
    const title = this.add.text(cx, PY + 32, `LOOP  ${loopCount}  COMPLETE`, {
      fontFamily: FF, fontSize: '20px', fontStyle: 'bold',
      color: '#ffd700', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 150 });

    // Divider
    const divY = PY + 54;
    const divider = this.add.rectangle(cx, divY, PW - 40, 1, 0xffd700, 0.4).setAlpha(0);
    this.tweens.add({ targets: divider, alpha: 1, duration: 300, delay: 200 });

    // TP earned row
    const tpY = divY + 22;
    const tpRow = this.add.text(cx, tpY, `✦  +${tpEarned} Tile Points`, {
      fontFamily: FF, fontSize: '14px', fontStyle: 'bold',
      color: '#00e5ff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setAlpha(0);
    this.tweens.add({ targets: tpRow, alpha: 1, duration: 300, delay: 250 });

    // Loot items
    const listStartY = tpY + 30;
    const items = lootItems.length > 0 ? lootItems : [{ label: 'No loot this loop', color: '#888888' }];

    items.forEach((item, i) => {
      const y = listStartY + i * itemH;
      const row = this.add.text(cx, y, item.label, {
        fontFamily: FF, fontSize: '13px',
        color: item.color, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 0.5).setAlpha(0);
      this.tweens.add({ targets: row, alpha: 1, duration: 200, delay: 280 + i * 40 });
    });

    // Continue button
    const btnY = PY + PH - 34;
    const btnBg = this.add.rectangle(cx, btnY, 160, 36, 0x1a2a1a)
      .setStrokeStyle(2, 0x44aa44)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    const btnText = this.add.text(cx, btnY, 'CONTINUE  ▶', {
      fontFamily: FF, fontSize: '14px', fontStyle: 'bold',
      color: '#88ff88', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setAlpha(0);

    const btnDelay = 300 + items.length * 40;
    this.tweens.add({ targets: [btnBg, btnText], alpha: 1, duration: 300, delay: btnDelay });

    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x224422); btnText.setColor('#aaffaa'); });
    btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x1a2a1a); btnText.setColor('#88ff88'); });
    btnBg.on('pointerdown', () => this.proceed(loopRunner, loopRunState));

    // Also allow spacebar / enter
    this.input.keyboard?.once('keydown-SPACE', () => this.proceed(loopRunner, loopRunState));
    this.input.keyboard?.once('keydown-ENTER', () => this.proceed(loopRunner, loopRunState));
  }

  private proceed(loopRunner: LoopRunner, loopRunState: LoopRunState): void {
    this.tweens.add({
      targets: this.children.list,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.scene.stop();
        this.scene.launch(SCENE_KEYS.PLANNING, { loopRunner, loopRunState });
      },
    });
  }
}
