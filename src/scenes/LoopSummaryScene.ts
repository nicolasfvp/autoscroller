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
  /** Origin — event/treasure gains render in their own highlighted block. */
  source: LootSource;
}

// Keys are lowercase — lookup normalises via .toLowerCase()
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
};

// Maps shard loot type → element id, resolved via resolveIconKey at render time
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

interface RowLayout { iconX: number; textX: number; textNoIconX: number; }

// Shard types go in the right column
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
  // Group by (source, type) so event/treasure gains never merge into the
  // combat tally for the same resource (e.g. treasure gold stays distinct).
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
    const cx = 400;

    // ── Panel (fixed size from debug-layout) ───────────────
    const PW = 380;
    const PH = 543;
    const panelY = 300;

    this.add.rectangle(cx, panelY, 800, 600, 0x05080f, 0.92).setAlpha(0);
    this.tweens.add({ targets: this.children.list[0], alpha: 1, duration: 250 });

    const all = aggregateLoot(lootItems);
    const isEventSource = (e: AggregatedEntry) => e.source === 'event' || e.source === 'treasure';
    // Event/treasure gains get their own highlighted block (only quantified
    // ones). Descriptive event lines with no parseable amount are dropped here
    // so they don't leak into the combat REWARDS column — they already showed
    // as floating notifications during the loop.
    const eventLoot = all.filter(e => isEventSource(e) && e.amount > 0);
    const combat = all.filter(e => !isEventSource(e));

    const rewards = combat.filter(e => !SHARD_TYPES.has(e.type) && !e.type.endsWith('!') && e.type !== 'XP');
    const xpEntry  = combat.find(e => e.type === 'XP');
    const shards   = combat.filter(e => SHARD_TYPES.has(e.type));
    const stats    = combat.filter(e => e.type.endsWith('!') || (e.type.includes('Tile') && !SHARD_TYPES.has(e.type)));

    if (xpEntry) rewards.unshift(xpEntry);

    if (this.textures.exists('loop_summary_panel')) {
      const p = this.add.image(cx, panelY, 'loop_summary_panel').setDisplaySize(PW, PH).setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    } else {
      const p = this.add.rectangle(cx, panelY, PW, PH, 0x0d0d14, 0.96).setStrokeStyle(2, 0xd4a04a, 0.9).setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    }

    // ── Title (y=88.5 absoluto) ────────────────────────────
    const title = this.add.bitmapText(cx, 88.5, 'vt323_gold', `LOOP  ${loopCount}  COMPLETE`, 28)
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 140 });

    // ── TP row (y=122) ────────────────────────────────────
    const tpRow = this.add.text(cx, 122, `+${tpEarned} Tile Points`, {
      fontFamily: FF, fontSize: '17px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: tpRow, alpha: 1, duration: 300, delay: 200 });

    // Monsters killed (y=144.8)
    const killEntries = Object.entries(monstersDefeated);
    if (killEntries.length > 0) {
      const killText = killEntries.map(([n, c]) => `${n} x${c}`).join('  ·  ');
      const killRow = this.add.text(cx, 144.8, killText, {
        fontFamily: FF, fontSize: '13px', color: '#ffffff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: killRow, alpha: 1, duration: 200, delay: 240 });
    }

    // ── Separadores (y=160, y=220) — largura 262 ──────────
    this.add.rectangle(cx, 160, 262, 1, 0xd4a04a, 0.4);
    this.add.rectangle(cx, 220, 262, 1, 0x886644, 0.35);

    // ── Section headers (sem background rect) ─────────────
    const ICON_S  = 28;
    const COL_ROW = 40;

    // Posições absolutas direto do debug-layout.json
    // REWARDS: x=300.1 (origin 0), y=192.2, fontSize=23
    // SHARDS:  x=440.5 (origin 0), y=193.9, fontSize=24
    const hdrRewards = this.add.text(300.1, 192.2, 'REWARDS', {
      fontFamily: FF, fontSize: '23px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setAlpha(0);
    const hdrShards = this.add.text(440.5, 193.9, 'SHARDS', {
      fontFamily: FF, fontSize: '24px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setAlpha(0);
    this.tweens.add({ targets: [hdrRewards, hdrShards], alpha: 1, duration: 200, delay: 220 });

    // ── Two-column rows ────────────────────────────────────
    // Posições absolutas do JSON:
    //   Left  — ícone x=297.6, texto x=317.6 (com ícone) / x=308.5 (sem ícone)
    //   Right — ícone x=418.5, texto x=438.5
    //   Rows: y=236, 276, 316, 356, 396 (COL_ROW=40, início=236)
    const LEFT:  RowLayout = { iconX: 297.6, textX: 317.6, textNoIconX: 308.5 };
    const RIGHT: RowLayout = { iconX: 418.5, textX: 438.5, textNoIconX: 438.5 };

    let rowY = 236;
    const maxRows = Math.max(rewards.length, shards.length);
    for (let i = 0; i < maxRows; i++) {
      const delay = 280 + i * 45;
      if (rewards[i]) this.renderIconRow(LEFT,  rowY + i * COL_ROW, rewards[i], ICON_S, FF, delay);
      if (shards[i])  this.renderIconRow(RIGHT, rowY + i * COL_ROW, shards[i],  ICON_S, FF, delay);
    }

    // Running Y below the two columns; the event block + stats stack under it.
    let flowY = rowY + maxRows * COL_ROW + 10;

    // ── Events / Treasure (highlighted, full-width single column) ──────────
    if (eventLoot.length > 0) {
      this.add.rectangle(cx, flowY, PW - 32, 1, 0xd4a04a, 0.45);
      const evHdr = this.add.text(cx, flowY + 13, '✦  EVENTS / TREASURE', {
        fontFamily: FF, fontSize: '17px', fontStyle: 'bold',
        color: '#ffd27f', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      const evHdrDelay = 320 + maxRows * 45;
      this.tweens.add({ targets: evHdr, alpha: 1, duration: 200, delay: evHdrDelay });

      const EV_ROW = 30;
      let evRowY = flowY + 36;
      eventLoot.forEach((e, i) => {
        // Centered icon|label, full width. Reuse renderIconRow with a layout
        // anchored a little left of centre so the icon+text read as one unit.
        const layout: RowLayout = { iconX: cx - 78, textX: cx - 58, textNoIconX: cx - 78 };
        this.renderIconRow(layout, evRowY, e, 24, FF, evHdrDelay + 40 + i * 35);
        evRowY += EV_ROW;
      });
      flowY = evRowY + 10;
    }

    // ── Stats / permanent upgrades ─────────────────────────
    if (stats.length > 0) {
      const statsY = flowY;
      this.add.rectangle(cx, statsY, PW - 32, 1, 0x886644, 0.35);
      const statsHdr = this.add.text(cx, statsY + 12, 'STATS', {
        fontFamily: FF, fontSize: '23px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: statsHdr, alpha: 1, duration: 200, delay: 340 + maxRows * 45 });

      const statDelay = 360 + maxRows * 45;
      const slotW = (PW - 32) / Math.min(stats.length, 3);
      stats.forEach((s, i) => {
        const slotCenter = (cx - (PW - 32) / 2) + i * slotW + slotW / 2;
        const layout: RowLayout = { iconX: slotCenter - 11, textX: slotCenter + 15, textNoIconX: slotCenter };
        this.renderIconRow(layout, statsY + 34, s, 22, FF, statDelay + i * 30);
      });
    }

    // ── Continue button ──────────────────────────────────
    // Wait for the latest-animating block (columns, events, or stats).
    const btnDelay = Math.max(
      400 + maxRows * 45,
      eventLoot.length > 0 ? 360 + maxRows * 45 + 40 + eventLoot.length * 35 : 0,
    );
    if (this.textures.exists('btn_continue_loop')) {
      const btnImg = this.add.image(400, 562, 'btn_continue_loop')
        .setScale(114 / 1548)
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
      const btnBg = this.add.rectangle(400, 562, 114, 34, 0x0f1f0f)
        .setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true }).setAlpha(0);
      const btnText = this.add.text(cx, 562, 'CONTINUE  ▶', {
        fontFamily: FF, fontSize: '15px', fontStyle: 'bold',
        color: '#88ff88', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: [btnBg, btnText], alpha: 1, duration: 300, delay: btnDelay });
      btnBg.on('pointerover', () => { btnBg.setFillStyle(0x1a3a1a); btnText.setColor('#bbffbb'); });
      btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x0f1f0f); btnText.setColor('#88ff88'); });
      btnBg.on('pointerdown', () => this.proceed(loopRunner, loopRunState));
    }

    this.input.keyboard?.once('keydown-SPACE', () => this.proceed(loopRunner, loopRunState));
    this.input.keyboard?.once('keydown-ENTER', () => this.proceed(loopRunner, loopRunState));
  }

  private renderIconRow(
    layout: RowLayout, y: number,
    item: AggregatedEntry, iconSize: number,
    ff: string, delay: number,
  ): void {
    const elementId = SHARD_ELEMENT_IDS[item.type] ?? item.type.toLowerCase();
    const iconKey = resolveIconKey(this.textures, elementId)
      ?? (LOOT_ICONS[item.type.toLowerCase()] ?? null);
    const resolvedIcon = (iconKey && this.textures.exists(iconKey)) ? iconKey : null;

    if (resolvedIcon) {
      const icon = this.add.image(layout.iconX, y, resolvedIcon)
        .setDisplaySize(iconSize, iconSize).setAlpha(0);
      this.tweens.add({ targets: icon, alpha: 1, duration: 200, delay });
    }

    const textX = resolvedIcon ? layout.textX : layout.textNoIconX;
    const row = this.add.text(textX, y, item.label, {
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
