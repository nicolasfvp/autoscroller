// Phase 9 (Design v2): logic-isolated tests for CombatHUD's class-conditional
// widget visibility. Phaser headless tests are infeasible in the existing
// vitest harness — the visibility helper `computeHUDVisibility` is the
// extracted seam so we can cover the toggle behaviour without a scene.

import { describe, it, expect } from 'vitest';
import { computeHUDVisibility } from '../../src/ui/CombatHUD';
import { SHADOWBLADE_PALETTE } from '../../src/ui/StyleConstants';

describe('SHADOWBLADE_PALETTE (Phase 9 §Color)', () => {
  it('exports all 12 semantic tokens at LOCKED hex values', () => {
    expect(SHADOWBLADE_PALETTE.shadowblade).toBe(0x7E5BEF);
    expect(SHADOWBLADE_PALETTE.comboPoint).toBe(0xE03A6B);
    expect(SHADOWBLADE_PALETTE.comboPointEmpty).toBe(0x3a1a26);
    expect(SHADOWBLADE_PALETTE.stealth).toBe(0xc8a8ff);
    expect(SHADOWBLADE_PALETTE.poison).toBe(0x6BBF59);
    expect(SHADOWBLADE_PALETTE.vit).toBe(0xff6666);
    expect(SHADOWBLADE_PALETTE.dex).toBe(0xf0a020);
    expect(SHADOWBLADE_PALETTE.int).toBe(0x9966ff);
    expect(SHADOWBLADE_PALETTE.spi).toBe(0x22cc44);
    expect(SHADOWBLADE_PALETTE.library).toBe(0x7E5BEF);
    expect(SHADOWBLADE_PALETTE.arena).toBe(0xC12B2B);
    expect(SHADOWBLADE_PALETTE.shrineOfPact).toBe(0x5A2A6B);
  });

  it('library tile color matches shadowblade class color (LOCKED — design/04 §7)', () => {
    expect(SHADOWBLADE_PALETTE.library).toBe(SHADOWBLADE_PALETTE.shadowblade);
  });
});

describe('computeHUDVisibility (UI-SPEC §Class-Conditional Rendering Contract)', () => {
  it('hides CP + Stealth for warrior; stamina label remains STA', () => {
    const v = computeHUDVisibility({ heroClassName: 'warrior', stealthCharges: 0 });
    expect(v.showCP).toBe(false);
    expect(v.showStealth).toBe(false);
    expect(v.staminaLabel).toBe('⚡ STA');
  });

  it('hides CP + Stealth for mage; stamina label remains STA', () => {
    const v = computeHUDVisibility({ heroClassName: 'mage', stealthCharges: 0 });
    expect(v.showCP).toBe(false);
    expect(v.showStealth).toBe(false);
    expect(v.staminaLabel).toBe('⚡ STA');
  });

  it('shows CP for shadowblade; stamina label flips to ENG', () => {
    const v = computeHUDVisibility({ heroClassName: 'shadowblade', stealthCharges: 0 });
    expect(v.showCP).toBe(true);
    expect(v.staminaLabel).toBe('⚡ ENG');
  });

  it('hides Stealth indicator for shadowblade when stealthCharges === 0', () => {
    const v = computeHUDVisibility({ heroClassName: 'shadowblade', stealthCharges: 0 });
    expect(v.showStealth).toBe(false);
  });

  it('shows Stealth indicator for shadowblade when stealthCharges > 0', () => {
    const v = computeHUDVisibility({ heroClassName: 'shadowblade', stealthCharges: 2 });
    expect(v.showStealth).toBe(true);
  });

  it('treats undefined stealthCharges as 0 for shadowblade (no indicator)', () => {
    const v = computeHUDVisibility({ heroClassName: 'shadowblade' });
    expect(v.showStealth).toBe(false);
  });

  it('treats undefined className as non-shadowblade', () => {
    const v = computeHUDVisibility({ stealthCharges: 5 });
    expect(v.showCP).toBe(false);
    expect(v.showStealth).toBe(false);
    expect(v.staminaLabel).toBe('⚡ STA');
  });
});
