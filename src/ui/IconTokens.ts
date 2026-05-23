// IconTokens — central registry for the bracketed icon tokens used across card
// text (e.g. `[burn]`, `[str]`, `[exhaust]`).
//
// Two responsibilities:
//   1. Single source of truth for token → { label, color } mapping. The legacy
//      STACK_DISPLAY palette in CardVisual.ts was the seed; this extends it to
//      stats, resources, elements, and meta keywords listed in docs/CARD_AUDIT
//      §1.5. Callers should resolve a token to a TokenStyle and render with
//      `glyphForToken` so colors stay consistent.
//   2. `renderTokenText` — text-formatting helper that scans an arbitrary
//      string for `[token]` substrings and emits per-segment Phaser.Text
//      objects (color-coded for tokens, default color for plain prose), all
//      laid out on a single horizontal line that wraps at the supplied width.
//      Sprites are sniffed lazily: if the scene has a texture named
//      `icon_${token}` we use an Image; otherwise we fall back to colored caps
//      text (the spec's "BURN", "STR", etc. inline labels).
//
// The renderer purposefully keeps token glyphs as caps text for now — CardText
// already emits human-readable prose ("Burn 3", "Heal 6") that won't contain
// brackets, so renderTokenText is a no-op for that input. When CardText is
// rewritten to emit bracketed tokens (the other agent's job), colors light up
// automatically without further changes here.

import Phaser from 'phaser';

export interface TokenStyle {
  /** Display label when no sprite is present (uppercase, e.g. "BURN"). */
  label: string;
  /** Hex color string, e.g. "#FF8C00" — used both for text and sprite tint. */
  color: string;
}

/**
 * Canonical palette for every bracketed token recognized by the card UI.
 * Keys are the lowercase token name (the substring between brackets).
 *
 * Colors trace to docs/CARD_AUDIT.md §1.5 (stack DoTs, stat axes, resources)
 * and src/systems/ElementSystem.ts (element badges). Extend by adding entries
 * here — every callsite reads from this single map.
 */
export const TOKEN_STYLES: Record<string, TokenStyle> = {
  // DoT / stack icons (mirrors STACK_DISPLAY in CardVisual)
  burn:    { label: 'BURN',    color: '#FF8C00' },
  bleed:   { label: 'BLEED',   color: '#DD2222' },
  poison:  { label: 'POISON',  color: '#66CC22' },
  slow:    { label: 'SLOW',    color: '#66CCFF' },
  stun:    { label: 'STUN',    color: '#CCCCCC' },
  rage:    { label: 'RAGE',    color: '#FF6622' },

  // Resources / vitals
  hp:      { label: 'HP',      color: '#44DD44' },
  armor:   { label: 'ARMOR',   color: '#4488DD' },
  stam:    { label: 'STAM',    color: '#FFCC44' },
  mana:    { label: 'MANA',    color: '#BB55EE' },

  // Stat axes (scaling)
  str:     { label: 'STR',     color: '#CC4444' },
  vit:     { label: 'VIT',     color: '#888888' },
  dex:     { label: 'DEX',     color: '#FFCC44' },
  int:     { label: 'INT',     color: '#9966FF' },
  spi:     { label: 'SPI',     color: '#44CCAA' },

  // Elements (kept aligned with ElementSystem.ts ELEMENTS[].color)
  fire:    { label: 'FIRE',    color: '#F97316' },
  water:   { label: 'WATER',   color: '#0EA5E9' },
  air:     { label: 'AIR',     color: '#C4B5FD' },
  earth:   { label: 'EARTH',   color: '#92400E' },
  attack:  { label: 'ATK',     color: '#DC2626' },
  defense: { label: 'DEF',     color: '#6B7280' },
  agility: { label: 'AGI',     color: '#FACC15' },
  counter: { label: 'CTR',     color: '#B91C1C' },

  // Meta keywords
  exhaust: { label: 'EXHAUST', color: '#FFAA00' },
};

/** Lower-cases the token and looks up its style. Returns undefined when the
 *  token isn't recognized — callers should render the original text as-is. */
export function getTokenStyle(token: string): TokenStyle | undefined {
  return TOKEN_STYLES[token.toLowerCase()];
}

/** True when the bracketed token has a known palette entry. Used by token
 *  scanners to decide between "render as colored glyph" vs. "leave as-is". */
export function isKnownToken(token: string): boolean {
  return token.toLowerCase() in TOKEN_STYLES;
}

/**
 * Parses an input string into an alternating sequence of plain-text and
 * token segments. Tokens are matched with the regex `\[[a-zA-Z][a-zA-Z0-9-]*\]`
 * and only emitted as type "token" when the bracketed name is recognized in
 * TOKEN_STYLES; unknown brackets stay in the text run so we never accidentally
 * eat literal `[brackets]` in flavor text.
 */
export interface PlainSegment { type: 'text'; value: string; }
export interface TokenSegment { type: 'token'; token: string; style: TokenStyle; }
export type TextSegment = PlainSegment | TokenSegment;

export function tokenizeText(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  // Match `[name]` where name is alphabetic + digits + hyphens. Bracket-pair
  // only — no nested brackets, no whitespace inside the bracket body.
  const re = /\[([a-zA-Z][a-zA-Z0-9-]*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const tokenName = match[1];
    const style = getTokenStyle(tokenName);
    if (!style) continue; // leave unrecognized brackets in place
    if (match.index > lastIndex) {
      out.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    out.push({ type: 'token', token: tokenName.toLowerCase(), style });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    out.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return out;
}

/**
 * Style options for renderTokenText. Mirrors a subset of Phaser TextStyle —
 * we don't take the full type because we need to manage color per-segment.
 */
export interface RenderTokenOptions {
  fontSize?: string;
  fontFamily?: string;
  fontStyle?: string;
  /** Default color for plain text segments. Token segments override this. */
  color?: string;
  /** Stroke for plain text (carried over to tokens). */
  stroke?: string;
  strokeThickness?: number;
  /** Horizontal alignment within the wrap width. Default 'left'. */
  align?: 'left' | 'center' | 'right';
  /** Pixel width used for wrapping. Required when align !== 'left' or for
   *  multi-line bodies. When omitted, segments lay out in a single line. */
  wrapWidth?: number;
  /** Extra pixels between lines on wrap. */
  lineSpacing?: number;
}

/**
 * Renders `text` at (x, y) with bracket tokens recolored per TOKEN_STYLES.
 * Returns a Phaser.Container holding the per-segment Text/Image objects so
 * the caller can position, scale, or destroy the whole block atomically.
 *
 * Sprites (`icon_${token}` textures) are preferred when present; otherwise
 * the token renders as colored caps text (e.g. "BURN" for `[burn]`).
 *
 * Layout: word-wrap is character-based on the boundary between segments —
 * we don't break individual words today, but we DO wrap when the next
 * segment would overflow `wrapWidth`. This is sufficient for the popup body
 * (descriptions are short prose) and the standard face never wraps.
 */
export function renderTokenText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: RenderTokenOptions = {},
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const fontSize = options.fontSize ?? '13px';
  const fontFamily = options.fontFamily ?? 'monospace';
  const fontStyle = options.fontStyle;
  const baseColor = options.color ?? '#bbbbcc';
  const stroke = options.stroke;
  const strokeThickness = options.strokeThickness;
  const wrapWidth = options.wrapWidth;
  const lineSpacing = options.lineSpacing ?? 4;
  const align = options.align ?? 'left';

  const segments = tokenizeText(text);
  if (segments.length === 0) {
    return container;
  }

  // Flatten segments into per-glyph render units. For plain text we further
  // split on whitespace so the line-wrapper can break between words; for
  // token segments we emit one atomic unit (the colored caps label or sprite).
  interface Unit {
    text: string;
    color: string;
    isToken: boolean;
    spriteKey?: string;
  }
  const units: Unit[] = [];
  for (const seg of segments) {
    if (seg.type === 'text') {
      // Split keeping whitespace as its own units so spacing survives wrap.
      const parts = seg.value.split(/(\s+)/);
      for (const p of parts) {
        if (p === '') continue;
        units.push({ text: p, color: baseColor, isToken: false });
      }
    } else {
      const spriteKey = `icon_${seg.token}`;
      const useSprite = scene.textures && scene.textures.exists(spriteKey);
      units.push({
        text: seg.style.label,
        color: seg.style.color,
        isToken: true,
        spriteKey: useSprite ? spriteKey : undefined,
      });
    }
  }

  // Lay out left-to-right with wrap. Each line is collected as Phaser objects,
  // then horizontally aligned in a second pass once we know the line width.
  interface Line {
    objects: Phaser.GameObjects.GameObject[];
    width: number;
    height: number;
  }
  const lines: Line[] = [{ objects: [], width: 0, height: 0 }];
  let cursorX = 0;

  // NOTE: include keys only when they have values. Passing
  // `strokeThickness: undefined` (or `stroke: undefined`) to Phaser's Text
  // constructor poisons the measured width — it comes back NaN, cascades into
  // NaN positions, and the text renders at undefined coordinates (invisible).
  const makeTextStyle = (color: string): Phaser.Types.GameObjects.Text.TextStyle => {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { fontSize, fontFamily, color };
    if (fontStyle !== undefined) style.fontStyle = fontStyle;
    if (stroke !== undefined) style.stroke = stroke;
    if (strokeThickness !== undefined) style.strokeThickness = strokeThickness;
    return style;
  };

  // Token sprites render at ~1.4× the body font size so they read clearly
  // inline with prose. parseInt strips the "px" suffix; default to 13.
  const fontPx = parseInt(typeof fontSize === 'string' ? fontSize : `${fontSize}`, 10) || 13;
  const tokenSpriteSize = Math.round(fontPx * 1.4);

  for (const u of units) {
    let obj: Phaser.GameObjects.GameObject & { x: number; y: number; };
    // Measure with displayWidth/displayHeight for images (raw width is the
    // 128 px texture size, which would blow up the wrap calculation).
    let w: number;
    let h: number;
    if (u.isToken && u.spriteKey) {
      const img = scene.add.image(0, 0, u.spriteKey)
        .setOrigin(0, 0)
        .setDisplaySize(tokenSpriteSize, tokenSpriteSize);
      w = img.displayWidth;
      h = img.displayHeight;
      obj = img as Phaser.GameObjects.GameObject & { x: number; y: number; };
    } else {
      const t = scene.add.text(0, 0, u.text, makeTextStyle(u.color)).setOrigin(0, 0);
      w = t.width;
      h = t.height;
      obj = t as Phaser.GameObjects.GameObject & { x: number; y: number; };
    }
    // Wrap: if this unit would overflow the wrap width AND we already have
    // content on the current line AND the unit isn't pure whitespace, wrap.
    // Pure-whitespace units at line start are dropped (they'd be visible as
    // weird leading indent otherwise).
    if (
      wrapWidth !== undefined
      && cursorX > 0
      && cursorX + w > wrapWidth
    ) {
      if (/^\s+$/.test(u.text)) {
        // Whitespace at wrap boundary — discard.
        obj.destroy();
        lines.push({ objects: [], width: 0, height: 0 });
        cursorX = 0;
        continue;
      }
      lines.push({ objects: [], width: 0, height: 0 });
      cursorX = 0;
    }

    obj.x = cursorX;
    const line = lines[lines.length - 1];
    line.objects.push(obj);
    line.width = cursorX + w;
    if (h > line.height) line.height = h;
    cursorX += w;
  }

  // Vertical stacking + horizontal alignment.
  let cursorY = 0;
  for (const line of lines) {
    let offsetX = 0;
    if (wrapWidth !== undefined) {
      if (align === 'center') offsetX = (wrapWidth - line.width) / 2;
      else if (align === 'right') offsetX = wrapWidth - line.width;
    }
    for (const o of line.objects) {
      const node = o as unknown as { x: number; y: number; };
      node.x += offsetX;
      node.y = cursorY;
      container.add(o);
    }
    cursorY += line.height + lineSpacing;
  }

  // Cache total dimensions on the container for the caller (height especially —
  // popup layouts grow downward from yPos and need to know how much space the
  // description ate).
  const totalHeight = Math.max(0, cursorY - lineSpacing);
  container.setData('tokenTextHeight', totalHeight);
  container.setData('tokenTextLines', lines.length);

  return container;
}

/** Hex color of a known token, falling back to white when unknown. Useful for
 *  callsites that need a single accent color (e.g. element-badge tint) rather
 *  than rendering text. */
export function colorForToken(token: string, fallback = '#ffffff'): string {
  return getTokenStyle(token)?.color ?? fallback;
}
