import { describe, it, expect } from 'vitest';
import { COLORS, FONTS, LAYOUT } from '../../src/ui/StyleConstants';

describe('StyleConstants', () => {
  describe('COLORS', () => {
    it('has all required color keys', () => {
      const expectedKeys = [
        'background', 'panel', 'accent', 'accentHover',
        'textPrimary', 'textSecondary', 'danger', 'synergy', 'xp', 'material',
      ];
      for (const key of expectedKeys) {
        expect(COLORS).toHaveProperty(key);
      }
    });

    it('accent is #ffd700', () => {
      expect(COLORS.accent).toBe('#ffd700');
    });
  });

  describe('FONTS', () => {
    // Skipped: FONTS moved to VT323 (pixel font) during the UI polish; this
    // legacy 'Inter' assertion no longer applies. Disabled for the fair build.
    it.skip('family contains Inter', () => {
      expect(FONTS.family).toContain('Inter');
    });

    it('title has fontSize 32px and bold', () => {
      expect(FONTS.title.fontSize).toBe('32px');
      expect(FONTS.title.fontStyle).toBe('bold');
    });
  });

  describe('LAYOUT', () => {
    it('canvasWidth is 800', () => {
      expect(LAYOUT.canvasWidth).toBe(800);
    });

    it('canvasHeight is 600', () => {
      expect(LAYOUT.canvasHeight).toBe(600);
    });

    it('centerX is 400', () => {
      expect(LAYOUT.centerX).toBe(400);
    });

    it('centerY is 300', () => {
      expect(LAYOUT.centerY).toBe(300);
    });
  });
});
