// Phase 9 (Design v2): logic-isolated tests for CombatHUD's visibility helper.
// Phaser headless tests are infeasible in the existing vitest harness — the
// visibility helper `computeHUDVisibility` is the extracted seam so we can
// cover the toggle behaviour without a scene.

import { describe, it, expect } from 'vitest';
import { computeHUDVisibility } from '../../src/ui/CombatHUD';
import { SHADOWBLADE_PALETTE } from '../../src/ui/StyleConstants';

describe('SHADOWBLADE_PALETTE (Phase 9 §Color)', () => {
  it('exports the status-stat + tile semantic tokens at LOCKED hex values', () => {
    expect(SHADOWBLADE_PALETTE.vit).toBe(0xff6666);
    expect(SHADOWBLADE_PALETTE.dex).toBe(0xf0a020);
    expect(SHADOWBLADE_PALETTE.int).toBe(0x9966ff);
    expect(SHADOWBLADE_PALETTE.spi).toBe(0x22cc44);
    expect(SHADOWBLADE_PALETTE.library).toBe(0x7E5BEF);
    expect(SHADOWBLADE_PALETTE.arena).toBe(0xC12B2B);
    expect(SHADOWBLADE_PALETTE.shrineOfPact).toBe(0x5A2A6B);
  });
});

describe('computeHUDVisibility', () => {
  it('warrior: stamina label is STA', () => {
    const v = computeHUDVisibility({ heroClassName: 'warrior' });
    expect(v.staminaLabel).toBe('⚡ STA');
  });

  it('mage: stamina label is STA', () => {
    const v = computeHUDVisibility({ heroClassName: 'mage' });
    expect(v.staminaLabel).toBe('⚡ STA');
  });

  it('undefined className: stamina label is STA', () => {
    const v = computeHUDVisibility({});
    expect(v.staminaLabel).toBe('⚡ STA');
  });
});
