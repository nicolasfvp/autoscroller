import { Scene } from 'phaser';
import { SCENE_KEYS } from '../state/SceneKeys';
import { FONTS } from '../ui/StyleConstants';
import { type LootEntry, type LootSource } from '../systems/PendingLoot';
import { type LoopRunner, type LoopRunState } from '../systems/LoopRunner';
import { resolveIconKey } from '../systems/ElementSystem';

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
  source: LootSource;
}

const LOOT_ICONS: Record<string, string> = {
  'gold':       'icon_coin',
  'stone':      'mat_stone',
  'bone':       'mat_bone',
  'iron':       'mat_iron',
  'wood':       'mat_wood',
  'herbs':      'mat_herbs',
  'crystal':    'mat_crystal',
  'essence':    'mat_essence',
  'brick':      'icon_brick',
  'scroll':     'mat_scroll',
  'basic tile': 'mat_scroll',
  'xp':         'icon_attack',
};

const SHARD_ELEMENT_IDS: Record<string, string> = {
  'Attack shard':  'attack',
  'Defense shard': 'defense',
  'Agility shard': 'agility',
  'Counter shard': 'counter',
  'Fire shard':    'fire',
  'Water shard':   'water',
  'Air shard':     'air',
  'Earth shard':   'earth',
};

const SHARD_TYPES = new Set([
  'Attack shard','Defense shard','Agility shard','Counter shard',
  'Fire shard','Water shard','Air shard','Earth shard',
]);

const LOOT_PARSE_RE = /^\+(\d+)\s+(.+)$/;

function parseLoot(label: string): { amount: number; type: string } | null {
  const m = LOOT_PARSE_RE.exec(label);
  if (!m) return null;
  return { amount: Number.parseInt(m[1], 10), type: m[2] };
}

function aggregateLoot(items: LootEntry[]): AggregatedEntry[] {
  const map = new Map<string, { color: string; amount: number; type: string; source: LootSource }>();
  const order: string[] = [];
  for (const item of items) {
    const source = item.source ?? 'combat';
    const parsed = parseLoot(item.label);
    const type = parsed ? parsed.type : item.label;
    const key = `${source}::${type}`;
    if (!map.has(key)) { map.set(key, { color: item.color, amount: 0, type, source }); order.push(key); }
    if (parsed) map.get(key)!.amount += parsed.amount;
  }
  return order.map(key => {
    const e = map.get(key)!;
    const isStat = e.type.endsWith('!');
    const label = e.amount > 0 ? `+${e.amount} ${e.type}` : e.type;
    return { label, color: e.color, amount: e.amount, type: isStat ? e.type.replace('!','').trim() : e.type, source: e.source };
  });
}

export class LoopSummaryScene extends Scene {
  constructor() { super(SCENE_KEYS.LOOP_SUMMARY); }

  create(data: SummaryData): void {
    const { loopRunner, loopRunState, lootItems, monstersDefeated, tpEarned, loopCount } = data;
    const FF = FONTS.family;

    // Panel center — all elements are positioned relative to this
    const CX = 400;
    const CY = 300;

    // ── Dim backdrop ───────────────────────────────────────
    const dim = this.add.rectangle(CX, CY, 800, 600, 0x05080f, 0.92).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 250 });

    // ── Panel ─────────────────────────────────────────────
    // debug-layout: x=390.8, y=316.5, scaleX=0.9313, displayWidth=552, displayHeight=557
    // Center it at CX, CY
    if (this.textures.exists('loop_summary_panel')) {
      const p = this.add.image(CX, CY, 'loop_summary_panel').setScale(0.9313).setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    } else {
      const p = this.add.rectangle(CX, CY, 552, 557, 0x0d0d14, 0.96)
        .setStrokeStyle(2, 0xd4a04a, 0.9).setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    }

    // Panel dimensions — displayWidth=552, displayHeight=557
    const PW = 552;
    const PH = 557;
    const LEFT = CX - PW / 2;   // 124
    const TOP  = CY - PH / 2;   // 21.5

    // Convert debug-layout y (absolute, panel was at y=316.5) to screen y
    // debug top = 316.5 - 557/2 = 38; our top = CY - PH/2 = 21.5 → delta = -16.5
    const OY = CY - 316.5;
    const ay = (y: number) => y + OY;

    const all = aggregateLoot(lootItems);
    const isEventSource = (e: AggregatedEntry) => e.source === 'event' || e.source === 'treasure';
    const eventLoot = all.filter(e => isEventSource(e) && e.amount > 0);
    const combat    = all.filter(e => !isEventSource(e));

    const shards  = combat.filter(e => SHARD_TYPES.has(e.type));
    const rewards = combat.filter(e => !SHARD_TYPES.has(e.type) && !e.type.endsWith('!'));
    const stats   = combat.filter(e => e.type.endsWith('!'));

    // ── Title — centered on panel ─────────────────────────
    const title = this.add.bitmapText(CX, ay(79.9), 'vt323_gold', `LOOP  ${loopCount}  COMPLETE`, 28)
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1200, delay: 100, ease: 'Sine.easeIn' });

    // ── TP row ────────────────────────────────────────────
    const tpRow = this.add.text(CX, ay(99.6), `+${tpEarned} Tile Points`, {
      fontFamily: FF, fontSize: '17px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: tpRow, alpha: 1, duration: 300, delay: 200 });

    // ── Kills ─────────────────────────────────────────────
    const killEntries = Object.entries(monstersDefeated);
    if (killEntries.length > 0) {
      const killText = killEntries.map(([n, c]) => `${n} x${c}`).join('  ·  ');
      const killRow = this.add.text(CX, ay(146.8), killText, {
        fontFamily: FF, fontSize: '13px', color: '#ffffff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: killRow, alpha: 1, duration: 200, delay: 240 });
    }

    // ── Separators ────────────────────────────────────────
    this.add.rectangle(CX, ay(160), PW - 60, 1, 0xd4a04a, 0.4);
    this.add.rectangle(CX, ay(220), PW - 60, 1, 0x886644, 0.35);

    // ── Section headers ────────────────────────────────────
    // Left half center = LEFT + PW/4 = 124 + 138 = 262
    // Right half center = CX + PW/4 = 400 + 138 = 538
    // REWARDS header centered over both reward columns (Col A icon to Col B text end)
    // Col A icon = LEFT+67, Col B text end ≈ LEFT+231+80=LEFT+311 → mid = LEFT+189
    // SHARDS header: centered over shard column (CX+37 icon, text goes ~+120 → mid CX+97)
    const HDR_REWARDS_X = LEFT + 189;  // center of rewards area, origin 0.5
    const HDR_SHARDS_X  = CX + 97;    // center of shards area, origin 0.5
    const hdrRewards = this.add.text(HDR_REWARDS_X, ay(192.2), 'REWARDS', {
      fontFamily: FF, fontSize: '23px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setAlpha(0);
    const hdrShards = this.add.text(HDR_SHARDS_X, ay(193.9), 'SHARDS', {
      fontFamily: FF, fontSize: '24px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setAlpha(0);
    this.tweens.add({ targets: [hdrRewards, hdrShards], alpha: 1, duration: 200, delay: 220 });

    // ── Reward items grid (2 columns, left half of panel) ─
    // Left half: LEFT(124) to CX(400) → width=276
    // Col A starts at LEFT+14 (icon), text at LEFT+42
    // Col B starts at LEFT+14+130 (icon), text at +42
    const ICON_S  = 28;
    const ROW_H   = 40;
    const START_Y = ay(256);

    // Panel has ~40px decorative border on each side; usable left half: LEFT+40 to CX-10
    // Col A: starts at LEFT+44, Col B: starts at LEFT+44+130
    const COL_A_ICON = LEFT + 72;
    const COL_A_TEXT = LEFT + 106;
    const COL_B_ICON = LEFT + 202;
    const COL_B_TEXT = LEFT + 236;

    const rewardRows = Math.ceil(rewards.length / 2);
    rewards.forEach((entry, i) => {
      const iconX = i % 2 === 0 ? COL_A_ICON : COL_B_ICON;
      const textX = i % 2 === 0 ? COL_A_TEXT : COL_B_TEXT;
      const row   = Math.floor(i / 2);
      const y     = START_Y + row * ROW_H;
      this.renderIconRow(iconX, textX, y, entry, ICON_S, FF, 280 + row * 45);
    });

    // ── Shards column (right half: CX to CX+PW/2) ────────
    // Icon at CX+14, text at CX+48
    const SHARD_ICON_X = CX + 62;
    const SHARD_TEXT_X = CX + 96;
    shards.forEach((entry, i) => {
      const y     = START_Y + i * ROW_H;
      this.renderIconRow(SHARD_ICON_X, SHARD_TEXT_X, y, entry, ICON_S, FF, 280 + i * 45);
    });

    const maxRows = Math.max(rewardRows, shards.length);
    let flowY = START_Y + maxRows * ROW_H + 10;

    // ── Events / Treasure ─────────────────────────────────
    if (eventLoot.length > 0) {
      this.add.rectangle(CX, flowY, 262, 1, 0xd4a04a, 0.45);
      const evHdrDelay = 320 + maxRows * 45;
      const evHdr = this.add.text(CX, flowY + 13, '✦  EVENTS / TREASURE', {
        fontFamily: FF, fontSize: '17px', fontStyle: 'bold',
        color: '#ffd27f', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: evHdr, alpha: 1, duration: 200, delay: evHdrDelay });

      const EV_ROW = 30;
      let evRowY = flowY + 36;
      eventLoot.forEach((e, i) => {
        this.renderIconRow(CX - 78, CX - 58, evRowY, e, 24, FF, evHdrDelay + 40 + i * 35);
        evRowY += EV_ROW;
      });
      flowY = evRowY + 10;
    }

    // ── Stats (elements gained) ───────────────────────────
    if (stats.length > 0) {
      this.add.rectangle(CX, flowY, 262, 1, 0x886644, 0.35);
      const statsDelay = 340 + maxRows * 45;
      const statsHdr = this.add.text(CX, flowY + 12, 'STATS', {
        fontFamily: FF, fontSize: '23px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: statsHdr, alpha: 1, duration: 200, delay: statsDelay });

      const slotW = 262 / Math.min(stats.length, 3);
      stats.forEach((s, i) => {
        const slotCx = (CX - 131) + i * slotW + slotW / 2;
        this.renderIconRow(slotCx - 11, slotCx + 15, flowY + 34, s, 22, FF, statsDelay + 20 + i * 30);
      });
    }

    // ── Continue button — debug: x=413.2, y=543.6, scale=0.0736 ──
    // Center on CX
    const btnDelay = Math.max(
      400 + maxRows * 45,
      eventLoot.length > 0 ? 360 + maxRows * 45 + 40 + eventLoot.length * 35 : 0,
    );
    // Button 45px from bottom of panel (10px higher than before)
    const BTN_Y = TOP + PH - 45;
    if (this.textures.exists('btn_continue_loop')) {
      const btnImg = this.add.image(CX, BTN_Y, 'btn_continue_loop')
        .setScale(0.0736)
        .setInteractive({ useHandCursor: true }).setAlpha(0);
      btnImg.on('pointerdown', () => this.proceed(loopRunner, loopRunState));
      this.tweens.add({
        targets: btnImg, alpha: 1, duration: 300, delay: btnDelay,
        onComplete: () => {
          btnImg.on('pointerover', () => btnImg.setAlpha(0.82));
          btnImg.on('pointerout',  () => btnImg.setAlpha(1));
        },
      });
    } else {
      const btnBg = this.add.rectangle(CX, BTN_Y, 114, 34, 0x0f1f0f)
        .setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true }).setAlpha(0);
      const btnText = this.add.text(CX, BTN_Y, 'CONTINUE  ▶', {
        fontFamily: FF, fontSize: '15px', fontStyle: 'bold',
        color: '#88ff88', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: [btnBg, btnText], alpha: 1, duration: 300, delay: btnDelay });
      btnBg.on('pointerdown', () => this.proceed(loopRunner, loopRunState));
    }

    this.input.keyboard?.once('keydown-SPACE', () => this.proceed(loopRunner, loopRunState));
    this.input.keyboard?.once('keydown-ENTER', () => this.proceed(loopRunner, loopRunState));
  }

  private renderIconRow(
    iconX: number, textX: number, y: number,
    item: AggregatedEntry, iconSize: number,
    ff: string, delay: number,
  ): void {
    const elementId   = SHARD_ELEMENT_IDS[item.type] ?? item.type.toLowerCase();
    const iconKey     = resolveIconKey(this.textures, elementId)
      ?? (LOOT_ICONS[item.type.toLowerCase()] ?? null);
    const resolvedIcon = (iconKey && this.textures.exists(iconKey)) ? iconKey : null;

    if (resolvedIcon) {
      const icon = this.add.image(iconX, y, resolvedIcon)
        .setDisplaySize(iconSize, iconSize).setAlpha(0);
      this.tweens.add({ targets: icon, alpha: 1, duration: 200, delay });
    }

    const tx  = resolvedIcon ? textX : iconX;
    const row = this.add.text(tx, y, item.label, {
      fontFamily: ff, fontSize: '16px', fontStyle: 'bold',
      color: item.color, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setAlpha(0);

    if (item.amount > 0) {
      const type = item.type;
      this.tweens.addCounter({
        from: 0, to: item.amount,
        duration: Math.min(500, 80 + item.amount * 6),
        delay, ease: 'Cubic.easeOut',
        onUpdate: t => row.setText(`+${Math.round(t.getValue() ?? 0)} ${type}`),
        onStart:  () => row.setAlpha(1),
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
