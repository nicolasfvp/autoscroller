import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { FONTS } from '../ui/StyleConstants';
import { type LootEntry } from '../systems/PendingLoot';
import { type LoopRunner, type LoopRunState } from '../systems/LoopRunner';

interface SummaryData {
  loopRunner: LoopRunner;
  loopRunState: LoopRunState;
  lootItems: LootEntry[];
  monstersDefeated: Record<string, number>;
  tpEarned: number;
  loopCount: number;
}

interface AggregatedEntry {
  label: string;
  color: string;
  amount: number;
  type: string;
}

const LOOT_ICONS: Record<string, string> = {
  'Gold':           'icon_coin',
  'Stone':          'mat_stone',
  'Bone':           'mat_bone',
  'Iron':           'mat_iron',
  'Wood':           'mat_wood',
  'Herbs':          'mat_herbs',
  'Crystal':        'mat_crystal',
  'Essence':        'mat_essence',
  'Brick':          'icon_brick',
  'Scroll':         'mat_scroll',
  'Basic Tile':     'mat_scroll',
  'Basic tile':     'mat_scroll',
  'Attack shard':   'icon_attack',
  'Defense shard':  'icon_defense',
  'Agility shard':  'icon_agility',
  'Counter shard':  'icon_counter',
  'Fire shard':     'icon_fire',
  'Water shard':    'icon_water',
  'Air shard':      'icon_air',
  'Earth shard':    'icon_earth',
};

// Shard types go in the right column
const SHARD_TYPES = new Set([
  'Attack shard','Defense shard','Agility shard','Counter shard',
  'Fire shard','Water shard','Air shard','Earth shard',
]);

function parseLoot(label: string): { amount: number; type: string } | null {
  const m = label.match(/^\+(\d+)\s+(.+)$/);
  if (!m) return null;
  return { amount: parseInt(m[1], 10), type: m[2] };
}

function aggregateLoot(items: LootEntry[]): AggregatedEntry[] {
  const map = new Map<string, { color: string; amount: number }>();
  const order: string[] = [];
  for (const item of items) {
    const parsed = parseLoot(item.label);
    if (parsed) {
      if (!map.has(parsed.type)) { map.set(parsed.type, { color: item.color, amount: 0 }); order.push(parsed.type); }
      map.get(parsed.type)!.amount += parsed.amount;
    } else {
      if (!map.has(item.label)) { map.set(item.label, { color: item.color, amount: 0 }); order.push(item.label); }
    }
  }
  return order.map(type => {
    const e = map.get(type)!;
    const isStat = type.endsWith('!');
    const label = e.amount > 0 ? `+${e.amount} ${type}` : type;
    return { label, color: e.color, amount: e.amount, type: isStat ? type.replace('!','').trim() : type };
  });
}

export class LoopSummaryScene extends Scene {
  constructor() { super(SCENE_KEYS.LOOP_SUMMARY); }

  create(data: SummaryData): void {
    const { loopRunner, loopRunState, lootItems, monstersDefeated, tpEarned, loopCount } = data;
    const FF = FONTS.family;
    const cx = 400;

    this.add.rectangle(cx, 300, 800, 600, 0x05080f, 0.92).setAlpha(0);
    this.tweens.add({ targets: this.children.list[0], alpha: 1, duration: 250 });

    const all = aggregateLoot(lootItems);
    const rewards = all.filter(e => !SHARD_TYPES.has(e.type) && !e.type.endsWith('!') && e.type !== 'XP');
    const xpEntry  = all.find(e => e.type === 'XP');
    const shards   = all.filter(e => SHARD_TYPES.has(e.type));
    const stats    = all.filter(e => e.type.endsWith('!') || (e.type.includes('Tile') && !SHARD_TYPES.has(e.type)));

    // Insert XP at top of rewards
    if (xpEntry) rewards.unshift(xpEntry);

    const PW = 480;
    const colW = (PW - 32) / 2;
    const rows = Math.max(rewards.length, shards.length);
    const PH = Math.min(Math.max(400, 200 + rows * 44 + (stats.length > 0 ? 70 : 0)), 560);
    const panelY = 300;
    const panelTop = panelY - PH / 2;

    // Panel background
    if (this.textures.exists('loop_summary_panel')) {
      const p = this.add.image(cx, panelY, 'loop_summary_panel').setAlpha(0);
      p.setScale(PW / p.width, PH / p.height);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    } else {
      const p = this.add.rectangle(cx, panelY, PW, PH, 0x0d0d14, 0.96).setStrokeStyle(2, 0xd4a04a, 0.9).setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    }

    let y = panelTop + 38;

    // ── Title ──────────────────────────────────────────────
    const title = this.add.bitmapText(cx, y, 'game_font_gold', `LOOP  ${loopCount}  COMPLETE`, 22)
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 140 });
    y += 32;

    this.add.rectangle(cx, y, PW - 32, 1, 0xd4a04a, 0.4).setAlpha(0);
    y += 14;

    // TP row
    const tpRow = this.add.text(cx, y, `✦  +${tpEarned} Tile Points`, {
      fontFamily: FF, fontSize: '14px', fontStyle: 'bold',
      color: '#00e5ff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: tpRow, alpha: 1, duration: 300, delay: 200 });
    y += 26;

    // Monsters defeated (compact inline row)
    const killEntries = Object.entries(monstersDefeated);
    if (killEntries.length > 0) {
      const killText = '⚔  ' + killEntries.map(([n, c]) => `${n} ×${c}`).join('  ·  ');
      const killRow = this.add.text(cx, y, killText, {
        fontFamily: FF, fontSize: '11px', color: '#997755', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: killRow, alpha: 1, duration: 200, delay: 240 });
      y += 20;
    }

    this.add.rectangle(cx, y, PW - 32, 1, 0x886644, 0.35).setAlpha(0);
    y += 16;

    // ── Two-column: Rewards | Shards ───────────────────────
    const leftCX  = cx - colW / 2 - 8;
    const rightCX = cx + colW / 2 + 8;
    const ICON_S  = 28;
    const COL_ROW = 40;

    this.renderSectionHeader(leftCX,  y, colW, '⚙  REWARDS', FF, 220);
    this.renderSectionHeader(rightCX, y, colW, '💠  SHARDS',  FF, 220);
    y += 24;

    const maxRows = Math.max(rewards.length, shards.length);
    for (let i = 0; i < maxRows; i++) {
      const delay = 280 + i * 45;
      if (rewards[i]) this.renderIconRow(leftCX,  y + i * COL_ROW, colW, rewards[i], ICON_S, FF, delay);
      if (shards[i])  this.renderIconRow(rightCX, y + i * COL_ROW, colW, shards[i],  ICON_S, FF, delay);
    }
    y += maxRows * COL_ROW + 10;

    // ── Stats / permanent upgrades ─────────────────────────
    if (stats.length > 0) {
      this.add.rectangle(cx, y, PW - 32, 1, 0x886644, 0.35).setAlpha(0);
      y += 10;
      this.renderSectionHeader(cx, y, PW - 32, '★  STATS', FF, 340 + maxRows * 45);
      y += 22;

      const statDelay = 360 + maxRows * 45;
      const slotW = (PW - 32) / Math.min(stats.length, 3);
      stats.forEach((s, i) => {
        const sx = (cx - (PW - 32) / 2) + i * slotW + slotW / 2;
        this.renderIconRow(sx, y, slotW, s, 22, FF, statDelay + i * 30, true);
      });
      y += 36;
    }

    // ── Continue button ────────────────────────────────────
    const btnY = panelY + PH / 2 - 32;
    const btnDelay = 400 + maxRows * 45;

    const btnBg = this.add.rectangle(cx, btnY, 220, 40, 0x0f1f0f)
      .setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true }).setAlpha(0);
    const btnText = this.add.text(cx, btnY, 'CONTINUE  ▶', {
      fontFamily: FF, fontSize: '15px', fontStyle: 'bold',
      color: '#88ff88', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [btnBg, btnText], alpha: 1, duration: 300, delay: btnDelay });
    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x1a3a1a); btnText.setColor('#bbffbb'); });
    btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x0f1f0f); btnText.setColor('#88ff88'); });
    btnBg.on('pointerdown', () => this.proceed(loopRunner, loopRunState));

    this.input.keyboard?.once('keydown-SPACE', () => this.proceed(loopRunner, loopRunState));
    this.input.keyboard?.once('keydown-ENTER', () => this.proceed(loopRunner, loopRunState));
  }

  private renderSectionHeader(x: number, y: number, w: number, label: string, ff: string, delay: number): void {
    const bg = this.add.rectangle(x, y, w, 20, 0x1a1408, 0.8)
      .setStrokeStyle(1, 0xd4a04a, 0.5).setAlpha(0);
    const txt = this.add.text(x, y, label, {
      fontFamily: ff, fontSize: '11px', fontStyle: 'bold',
      color: '#d4a04a', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [bg, txt], alpha: 1, duration: 200, delay });
  }

  private renderIconRow(
    cx: number, y: number, colW: number,
    item: AggregatedEntry, iconSize: number,
    ff: string, delay: number, centered = false,
  ): void {
    const iconKey = LOOT_ICONS[item.type] ?? null;
    const hasIcon = iconKey !== null && this.textures.exists(iconKey);
    const textX = hasIcon ? cx - colW / 2 + iconSize + 6 : cx;

    if (hasIcon) {
      const icon = this.add.image(cx - colW / 2 + iconSize / 2, y, iconKey!)
        .setDisplaySize(iconSize, iconSize).setAlpha(0);
      this.tweens.add({ targets: icon, alpha: 1, duration: 200, delay });
    }

    const row = this.add.text(textX, y, item.label, {
      fontFamily: ff, fontSize: '12px', fontStyle: 'bold',
      color: item.color, stroke: '#000', strokeThickness: 2,
    }).setOrigin(centered && !hasIcon ? 0.5 : 0, 0.5).setAlpha(0);

    if (item.amount > 0) {
      const type = item.type;
      this.tweens.addCounter({
        from: 0, to: item.amount,
        duration: Math.min(500, 80 + item.amount * 6),
        delay, ease: 'Cubic.easeOut',
        onUpdate: t => row.setText(`+${Math.round(t.getValue() ?? 0)} ${type}`),
        onStart: () => row.setAlpha(1),
      });
    } else {
      this.tweens.add({ targets: row, alpha: 1, duration: 200, delay });
    }
  }

  private proceed(loopRunner: LoopRunner, loopRunState: LoopRunState): void {
    this.tweens.add({
      targets: this.children.list, alpha: 0, duration: 200,
      onComplete: () => {
        this.scene.stop();
        this.scene.launch(SCENE_KEYS.PLANNING, { loopRunner, loopRunState });
      },
    });
  }
}
