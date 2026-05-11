// Phase 9 (Design v2): Phaser-free helpers for LoopHUD's VIT/DEX/INT/SPI
// status row. Split out so unit tests can import without booting Phaser
// (which references window at module load time).

import { SHADOWBLADE_PALETTE } from './StyleConstants';
import type { RunState } from '../state/RunState';
import { resolveHeroStats } from '../systems/hero/HeroStatsResolver';

export interface StatusRowData {
  vit: number;
  dex: number;
  int: number;
  spi: number;
}

/**
 * Extract VIT/DEX/INT/SPI from RunState via resolveHeroStats.
 * Pure: no Phaser, no scene reference.
 */
export function extractStatusRowData(runState: RunState): StatusRowData {
  const r = resolveHeroStats(runState);
  return { vit: r.vit, dex: r.dex, int: r.int, spi: r.spi };
}

/** Locked colors per UI-SPEC §Color status-stat tokens. */
export const STATUS_ROW_COLORS = {
  vit: SHADOWBLADE_PALETTE.vit,
  dex: SHADOWBLADE_PALETTE.dex,
  int: SHADOWBLADE_PALETTE.int,
  spi: SHADOWBLADE_PALETTE.spi,
} as const;
