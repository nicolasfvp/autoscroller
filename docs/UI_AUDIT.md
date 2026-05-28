# UI Audit & Theming Pass

Snapshot of the visual-consistency work done across the player-facing scenes
plus the recipe for adding more polish later (including Grok-generated
backgrounds).

## Why this exists

A scene-by-scene audit (driven via `scripts/audit-scenes.mjs` /
`audit-scenes-isolated.mjs`) showed three tiers of polish across the game:

| Tier | Scenes |
|---|---|
| ✅ **Themed** (wood/gold/medieval) | MainMenu, CharacterSelect, CityHub, TavernPanel, PlanningOverlay, DeckCustomization, GameScene/Combat |
| ⚠️ **Mismatched** | DeckBuilder (flat black bg), Shop (atmospheric bg hidden under a dark panel) |
| ❌ **Untheme** | Forge (pure black, plain colored rectangles for elements), RelicViewer (empty void) |

Several themed assets were already preloaded but **unused** —
`forge_table`, `deck_frame`, the `icon_<element>` token sprites. The fixes
below wire them into the scenes that needed them.

## Changes shipped

### 1. Forge — 4th element slot removed

Per design, the forge crafts 1–3 element recipes (1 → tier-1 card, 2 → tier-2,
3 → tier-3). The UI was rendering a 4th "empty" recipe slot that could never
be filled.

**File:** `src/scenes/ForgeScene.ts`

```diff
- const usable = available > 0 && this.forgeSlots.length < 4;
+ const usable = available > 0 && this.forgeSlots.length < 3;

- for (let i = 0; i < 4; i++) {
-   const x = colX(i, 4, slotW, slotGap);
+ for (let i = 0; i < 3; i++) {
+   const x = colX(i, 3, slotW, slotGap);
```

### 2. Forge — full retheme using `forge_table`

The asset `public/assets/buildings/backgrounds/forge-table.png` (preloaded as
`forge_table`) already provides the wood-frame panel, gold "FORGE" banner,
and anvil/tools illustration. ForgeScene's `create()` now layers that as the
backdrop instead of drawing plain rectangle chrome. Element cells were
rewritten to embed the `icon_<element>` token sprite (sword/shield/flame/…)
on a dark-wood inset with an element-colored stroke. Recipe slots got the
same icon-and-name treatment plus a gold hover stroke.

**File:** `src/scenes/ForgeScene.ts`

Search for the `create()` and `renderForge()` methods — they were rewritten
in place; the rectangle-only fallback is kept under `if (!textures.exists(
'forge_table'))` so a missing asset doesn't soft-brick the scene.

### 3. Shop — show the painted shop interior

`bg_shop_scene` (`public/assets/buildings/backgrounds/shop.png`) is a fully
rendered pixel-art shop interior, but ShopScene was drawing a 0.82-alpha
black panel on top that hid almost all of it.

**File:** `src/scenes/ShopScene.ts`

```diff
-  this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
-  if (this.textures.exists('bg_shop_scene')) {
-    this.add.image(400, 300, 'bg_shop_scene').setDisplaySize(800, 600).setDepth(-1);
-  }
-  this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x130800, 0.82);
+  if (this.textures.exists('bg_shop_scene')) {
+    this.add.image(400, 300, 'bg_shop_scene').setDisplaySize(800, 600).setDepth(-1);
+  }
+  this.add.rectangle(400, 300, 800, 600, 0x000000, 0.4); // vignette
+  this.add.rectangle(PANEL_CX, 300, PANEL_W, 600, 0x1a0c04, 0.78);
+  this.add.rectangle(PANEL_LEFT, 300, 4, 600, 0xd4a04a, 0.85);
+  this.add.rectangle(PANEL_RIGHT, 300, 4, 600, 0xd4a04a, 0.85);
```

The center menu column is now translucent enough that the warm shop bg shows
around it, with double gold side strokes anchoring the menu in the frame.

### 4. DeckBuilder — match the DeckCustomization frame

DeckBuilder used to be a flat-black overlay. It now uses the same
`deck_frame` asset that DeckCustomization uses (gold filigree corners), with
a warm navy backdrop instead of pure black, plus a stronger gold title.

**File:** `src/scenes/DeckBuilderScene.ts`

```diff
- const backdrop = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.92);
+ const backdrop = this.add.rectangle(400, 300, 800, 600, 0x1a1224, 0.96);
+ if (this.textures.exists('deck_frame')) {
+   this.add.image(400, 300, 'deck_frame').setDisplaySize(792, 596).setDepth(-1);
+ }
```

### 5. RelicViewer — themed empty state

Was an empty void with just "Your Relics" text and "Close" button. Now uses
the same `deck_frame` corners + a banner-style title with a gold underline.

**File:** `src/scenes/RelicViewerScene.ts`

Same pattern as DeckBuilder — backdrop swap + frame overlay + stronger title.

### 6. Grok-generated painted backdrops

Three painted bg assets generated via xAI Imagine and dropped behind the
chrome on previously-bare scenes:

| Scene | Asset | Texture key |
|---|---|---|
| DeckBuilder | `public/assets/ui/backgrounds/bg_deck_builder.png` | `bg_deck_builder` |
| RelicViewer | `public/assets/ui/backgrounds/bg_relic_vault.png`  | `bg_relic_vault`  |
| CardLibrary | `public/assets/ui/backgrounds/bg_card_library.png` | `bg_card_library` |

Preloaded in `src/scenes/Preloader.ts`. Each scene checks
`this.textures.exists(...)` first and falls back to the flat-color backdrop
if the asset is missing — so the bundle is forward/backward compatible.

Standard layering for a painted backdrop:

```ts
// depth -2: painted art (depth keeps it behind the chrome)
if (this.textures.exists('bg_deck_builder')) {
  this.add.image(400, 300, 'bg_deck_builder')
    .setDisplaySize(800, 600)
    .setDepth(-2);
}
// depth 0: dim layer for foreground readability (lower alpha when bg present)
this.add.rectangle(400, 300, 800, 600, 0x1a1224,
  this.textures.exists('bg_deck_builder') ? 0.55 : 0.96,
);
// depth -1: gold filigree frame on top of bg, below UI
if (this.textures.exists('deck_frame')) {
  this.add.image(400, 300, 'deck_frame').setDisplaySize(792, 596).setDepth(-1);
}
```

The same `bg_<scene>` exists/fallback pattern is in place for ShopScene's
`bg_shop_scene` and ForgeScene's `forge_table` so adding new backdrops to
other scenes follows the established convention.

## How to extend — generating new backgrounds with Grok Imagine

Two scripts live in `scripts/`:

| Script | Output | Use for |
|---|---|---|
| `generate-tile-grok.mjs` | 256×256 PNG in `verify-shots/` | tile sprites (downscales with nearest-neighbor for pixel-art) |
| `generate-bg-grok.mjs` | full-resolution PNG in `public/assets/ui/backgrounds/` | scene backdrops |

### Prerequisites

```bash
# Set your xAI key in the env. NEVER commit it. Rotate it if exposed.
export XAI_API_KEY="xai-..."
```

The team needs credit balance — a 403 from the API with
`"used all available credits or reached its monthly spending limit"` means
you need to top up at https://console.x.ai/.

### Generating a scene background

```bash
node scripts/generate-bg-grok.mjs bg_deck_builder \
  "Dim medieval scribe's workshop, oil-painting fantasy game illustration, \
   dark wooden shelves of leather tomes, candles, warm amber light, \
   atmospheric, similar to Darkest Dungeon main menu art"
```

That writes `public/assets/ui/backgrounds/bg_deck_builder.png`.

### Wiring it into a scene

1. Preload it in `src/scenes/Preloader.ts` (group with the other panel
   backgrounds around line 126–150):

   ```ts
   this.load.image('bg_deck_builder', 'assets/ui/backgrounds/bg_deck_builder.png');
   ```

2. Use it in the scene's `create()` before any chrome:

   ```ts
   if (this.textures.exists('bg_deck_builder')) {
     this.add.image(400, 300, 'bg_deck_builder')
       .setDisplaySize(800, 600)
       .setDepth(-1);
   }
   // Vignette so foreground UI reads against busy art.
   this.add.rectangle(400, 300, 800, 600, 0x000000, 0.45);
   ```

3. Keep a fallback path for the case where the texture didn't load (lets the
   scene still render if the asset is missing from the bundle):

   ```ts
   } else {
     this.add.rectangle(400, 300, 800, 600, 0x1a1224, 0.96);
   }
   ```

### Sizing guidance

- The game's logical canvas is **800×600** (`LAYOUT.canvasWidth` / `Height`).
- Grok returns 1024×1024; sized down with `setDisplaySize(800, 600)` it'll
  letterbox slightly. For pixel-perfect coverage, ask the model for a 4:3
  composition or crop after generation.
- The supersample factor (`UI_SCALE` in `src/main.ts`) is set per Graphics
  Quality preset, but you don't need to compensate — Phaser scales the
  display, the asset stays at native resolution.

### High-impact prompts to consider

These were identified by the audit but not generated (credits ran out):

- **DeckBuilder backdrop** — `"A scribe's hall in a fantasy castle, oil painting, candlelight on parchment, leather-bound tomes stacked on dark oak shelves, deep blue and gold palette, atmospheric depth"`
- **RelicViewer backdrop** — `"A reliquary vault, fantasy oil painting, treasure pedestals, soft golden light from above, dust motes, ornate stone pillars, deep maroon and gold"`
- **CardLibrary backdrop** — `"A wizard's archive, dim parquet floor with rune circles, walls of card boxes lit by floating runes, dark teal and amber"`

## Verification recipe

After any UI change, re-run the per-scene audit:

```bash
# In one terminal:
npx vite --port 5178 --strictPort

# In another (Chrome with CDP on 9224):
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9224 \
  --user-data-dir=/tmp/chrome-tutorial-verify \
  --headless=new --disable-gpu --no-first-run about:blank &

# Drive every scene and screenshot:
node scripts/audit-scenes.mjs            # full run flow
node scripts/audit-scenes-isolated.mjs   # one scene per fresh start
```

Outputs land in `verify-shots/audit/` and `verify-shots/audit2/`. Visually
compare against an earlier baseline to catch regressions.

## Notes on Vite HMR and singletons

The audit scripts originally tried to drive the tutorial director with a
dynamic `import('/src/systems/tutorial/TutorialDirector.ts')`. Under Vite
HMR each module load has a `?t=<timestamp>` query string and the
dynamically-imported instance is **not** the same singleton the statically-
imported scenes hold. The fix is to call the real UI buttons via
`gameObject.emit('pointerdown')` so the director state changes go through
the scenes' bound references. This trap is not specific to the audit — any
test/automation that reaches into module-level singletons via CDP needs the
same workaround.
