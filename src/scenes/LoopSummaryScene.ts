import { Scene } from 'phaser';
import { t, getLocale } from '../i18n/i18n';
import { SCENE_KEYS } from '../state/SceneKeys';
import { FONTS } from '../ui/StyleConstants';
import { type LootEntry } from '../systems/PendingLoot';
import { type LoopRunner, type LoopRunState } from '../systems/LoopRunner';
import { resolveIconKey, ELEMENTS, ALL_ELEMENT_IDS } from '../systems/ElementSystem';

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
  'ouro':       'icon_coin',
};

// Shard loot type ("{name} shard" in EN / "fragmento de {name}" in pt-BR) →
// element id. Built lazily so it reflects the active locale AND the localized
// ELEMENTS names (ELEMENTS is localized in Boot, after this module is imported,
// so building at module-init would capture stale English names in pt-BR).
let _shardMaps: { ids: Record<string, string>; types: Set<string> } | null = null;
function shardMaps(): { ids: Record<string, string>; types: Set<string> } {
  if (_shardMaps) return _shardMaps;
  const ids: Record<string, string> = {};
  const types = new Set<string>();
  for (const id of ALL_ELEMENT_IDS) {
    const ty = t('combatLoot.shard', { n: 1, name: ELEMENTS[id].name }).replace(/^\+\d+\s+/, '');
    ids[ty] = id;
    types.add(ty);
  }
  return (_shardMaps = { ids, types });
}

interface RowLayout { iconX: number; textX: number; textNoIconX: number; }

const LOOT_PARSE_RE = /^\+(\d+)\s+(.+)$/;

function parseLoot(label: string): { amount: number; type: string } | null {
  const m = LOOT_PARSE_RE.exec(label);
  if (!m) return null;
  return { amount: Number.parseInt(m[1], 10), type: m[2] };
}

function aggregateLoot(items: LootEntry[]): AggregatedEntry[] {
  const map = new Map<string, { color: string; amount: number }>();
  const order: string[] = [];
  for (const item of items) {
    const parsed = parseLoot(item.label);
    if (parsed) {
      if (!map.has(parsed.type)) { map.set(parsed.type, { color: item.color, amount: 0 }); order.push(parsed.type); }
      map.get(parsed.type)!.amount += parsed.amount;
    } else if (!map.has(item.label)) {
      map.set(item.label, { color: item.color, amount: 0 });
      order.push(item.label);
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

    // ── Panel (fixed size from debug-layout) ───────────────
    const PW = 380;
    const PH = 543;
    const panelY = 300;

    this.add.rectangle(cx, panelY, 800, 600, 0x05080f, 0.92).setAlpha(0);
    this.tweens.add({ targets: this.children.list[0], alpha: 1, duration: 250 });

    const all = aggregateLoot(lootItems);
    const shardTypes = shardMaps().types;
    const rewards = all.filter(e => !shardTypes.has(e.type) && !e.type.endsWith('!') && e.type !== 'XP');
    const xpEntry  = all.find(e => e.type === 'XP');
    const shards   = all.filter(e => shardTypes.has(e.type));
    const stats    = all.filter(e => e.type.endsWith('!') || (e.type.includes('Tile') && !shardTypes.has(e.type)));

    if (xpEntry) rewards.unshift(xpEntry);

    if (this.textures.exists('loop_summary_panel')) {
      const p = this.add.image(cx, panelY, 'loop_summary_panel').setDisplaySize(PW, PH).setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    } else {
      const p = this.add.rectangle(cx, panelY, PW, PH, 0x0d0d14, 0.96).setStrokeStyle(2, 0xd4a04a, 0.9).setAlpha(0);
      this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 80 });
    }

    // ── Title (y=88.5 absoluto) ────────────────────────────
    const title = this.add.bitmapText(cx, 88.5, 'vt323_gold', t('loopSummary.title', { loopCount }), 28)
      .setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300, delay: 140 });

    // ── TP row (y=122) ────────────────────────────────────
    const tpRow = this.add.text(cx, 122, t('loopSummary.tilePoints', { tpEarned }), {
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
    const hdrRewards = this.add.text(300.1, 192.2, t('loopSummary.rewardsHeader'), {
      fontFamily: FF, fontSize: '23px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setAlpha(0);
    const hdrShards = this.add.text(440.5, 193.9, t('loopSummary.shardsHeader'), {
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

    // ── Stats / permanent upgrades ─────────────────────────
    if (stats.length > 0) {
      const statsY = rowY + maxRows * COL_ROW + 10;
      this.add.rectangle(cx, statsY, PW - 32, 1, 0x886644, 0.35);
      const statsHdr = this.add.text(cx, statsY + 12, t('loopSummary.statsHeader'), {
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
    const btnDelay = 400 + maxRows * 45;
    if (getLocale() !== 'pt-br' && this.textures.exists('btn_continue_loop')) {
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
      const btnText = this.add.text(cx, 562, t('loopSummary.continue'), {
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
    const elementId = shardMaps().ids[item.type] ?? item.type.toLowerCase();
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
