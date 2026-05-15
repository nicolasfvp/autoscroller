// Phase 9 (Design v2): logic-isolated tests for LoopHUD's VIT/DEX/INT/SPI
// status row. The Phaser scene wiring is excluded — only the data-extraction
// helper + color contract is asserted here. Visual checkpoint (Task 5) covers
// the rendered output.

import { describe, it, expect } from 'vitest';
import { extractStatusRowData, STATUS_ROW_COLORS } from '../../src/ui/LoopHUD.helpers';
import type { RunState } from '../../src/state/RunState';

function makeRun(overrides: Partial<RunState['hero']> = {}): RunState {
  return {
    hero: {
      currentHP: 100, maxHP: 100,
      currentStamina: 50, maxStamina: 50,
      currentMana: 30, maxMana: 30,
      strength: 5, defenseMultiplier: 1,
      vitality: 10, dexterity: 8, intellect: 4, spirit: 6,
      statDeltas: {},
      className: 'warrior',
      ...overrides,
    },
  } as unknown as RunState;
}

describe('extractStatusRowData (Phase 9 §Copywriting status row)', () => {
  it('reads base VIT/DEX/INT/SPI from RunState.hero (no deltas)', () => {
    const run = makeRun();
    const data = extractStatusRowData(run);
    expect(data.vit).toBe(10);
    expect(data.dex).toBe(8);
    expect(data.int).toBe(4);
    expect(data.spi).toBe(6);
  });

  it('applies statDeltas additively to the resolved values', () => {
    const run = makeRun({ statDeltas: { vit: 3, dex: -1, int: 2, spi: 0 } });
    const data = extractStatusRowData(run);
    expect(data.vit).toBe(13);
    expect(data.dex).toBe(7);
    expect(data.int).toBe(6);
    expect(data.spi).toBe(6);
  });

  it('treats missing statDeltas as zero', () => {
    const run = makeRun({ statDeltas: undefined as unknown as RunState['hero']['statDeltas'] });
    const data = extractStatusRowData(run);
    expect(data.vit).toBe(10);
    expect(data.dex).toBe(8);
    expect(data.int).toBe(4);
    expect(data.spi).toBe(6);
  });
});

describe('STATUS_ROW_COLORS (UI-SPEC §Color status-stat tokens)', () => {
  it('VIT is #ff6666 (HP-red family)', () => {
    expect(STATUS_ROW_COLORS.vit).toBe(0xff6666);
  });
  it('DEX is #f0a020 (stamina-amber family)', () => {
    expect(STATUS_ROW_COLORS.dex).toBe(0xf0a020);
  });
  it('INT is #9966ff (mana-purple family)', () => {
    expect(STATUS_ROW_COLORS.int).toBe(0x9966ff);
  });
  it('SPI is #22cc44 (heal-green family)', () => {
    expect(STATUS_ROW_COLORS.spi).toBe(0x22cc44);
  });
});
