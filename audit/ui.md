# UI Quality Audit

## Summary

**Top 5 most jarring problems (player-impact ranked):**
1. The combat HUD reads like a spreadsheet pinned to the screen — HP/Stamina/Mana stacked on top of each other, a parallel STR/VIT/DEX/INT/SPI row, an armor row, and a 10-chip status pool, all crammed into a 238×188px box. Same situation on the GameScene LoopHUD: two giant panels + a loop-progress panel + a 4-stat status row + an 8-element badge row, all jammed into the top 190px. The eye has nowhere to land.
2. Every scene reinvents the button. ShopScene uses `Phaser.Rectangle` + `Text` with hand-rolled hover handlers; ForgeScene copies that style but with subtly different colors; PlanningOverlay uses raw `Text` with stroke; `createButton()` in StyleConstants is barely used (only CityHub/Death/Settings). There is no canonical button.
3. Cards rendered at 0.4-0.6 scale (Shop/Library/DeckBuilder) cram the descriptions down to **9px monospace** — unreadable on a 1366×768 laptop. The "main effect" number is 16px but the description supporting it is 9px and gray on near-black; pure noise.
4. Emoji icons (⚔ ✨ 🛡 🪵 🪨 🦴 ⚒ 🔮 🗑 ⬡ ◆ ✦ ♥ 📊 📦 📖) are used as the game's icon system. They render OS-specific (different on Windows vs. Mac vs. browser-fallback), break the pixel-art tone, and live alongside actual pixel art assets — total visual contradiction.
5. Color is sprinkled by feel, not by palette. `StyleConstants` defines 4 text colors, `SHADOWBLADE_PALETTE` defines 7 more, and then individual scenes invent literal hex constants like `#aaddff` (used in 4 places for "secondary button"), `#ffdca0`, `#ff6655`, `#e6c88a`, `#9a6030`, `#aaffaa`, `#ffaa44`, `#88dd55`, `#66ddff`, etc. CityHub uses brown leather palette, ShopScene uses dark-orange leather, CombatHUD uses blue/red glassmorphism, DeckBuilder uses navy. Same product, four games.

**Themes:**
- Hardcoded 800×600 magic numbers everywhere; no responsive layout. The game pretends a 1366×768 (or DPI-scaled) browser doesn't exist.
- No design system enforcement: `StyleConstants` was written and abandoned. `FONTS.title/heading/body/small` are almost never used; scenes pick their own px values.
- Visual hierarchy is flat. Same-weight bold gold text for primary actions ("Start Loop"), secondary actions ("Shop", "Forge"), and tertiary labels ("Don't stop here for").

---

## Findings

### [HIGH] Combat HUD is a fact sheet, not a UI

**Where:** `src/ui/CombatHUD.ts:29-39` (hero panel is 238×188 with 4 bars + 5-stat row + armor row + 10-chip pool below)

**Problem:** Inside a single 238px-wide left panel, the player gets: an HP bar (28px tall), an Armor readout, a Stamina bar (22px), a Mana bar (22px), a "📊 Stats" toggle that reveals STR/VIT/DEX/INT/SPI inline, plus a 2-row status-chip pool with 10 slots underneath at `LP.y + LP.h + 6`. The background is a `healthbar` image tinted blue (`0xaaaaff`) — i.e. the bar asset doubles as a panel chrome. The bar fills are flat rectangles drawn on top of an asset that already implies a bar; they don't line up perfectly. The enemy panel is the same asset tinted red, smaller (70px tall), with the enemy name in bold 18px red on top of red-pink chrome — barely contrasts.

**Why it matters:** During real-time combat the player needs to scan HP+cooldown in <1 second. With 9 numeric readouts + 10 status chips in one corner, that's impossible — the player will miss "you're at 12 HP" because it's the same visual weight as "you have 4 INT".

**Suggested fix:**
- Promote HP to a single big bar (≥36px tall, 60% panel width) — it is the only "you die if this hits zero" stat.
- Demote Stamina/Mana to thin (10–12px) bars stacked under HP, no individual text labels on the bars (the colored bar IS the label; show value on hover).
- Drop the Armor row entirely — fold it into the HP bar as a layered overlay (Slay the Spire style).
- Stats row (STR/VIT/DEX/INT/SPI) is fundamentally a peek-info — keep it gated behind "📊 Stats" hover but render it as a popup card to the right of the HUD, not inline within the panel.
- Stop tinting the bar asset blue and using it as panel chrome. Either use the asset as the bar background OR draw a panel separately; don't double-use it.

**Trivial?:** no

---

### [HIGH] Enemy panel red-on-red contrast disaster

**Where:** `src/ui/CombatHUD.ts:254-288` (`buildEnemyPanel`)

**Problem:** Panel asset `achievements_bg` tinted `0xffbbbb` (light pink/red). Enemy name text colored `#ff6666` with a 3px black stroke. Enemy HP bar fill `0xdd2222` (red) on top of the pink chrome. The "♥ HP" microlabel above the bar is `#aa4444` — dark red on light red.

**Why it matters:** The enemy name and the HP value are the two pieces of info the player must read every combat. Stroke-on-stroke red-on-red is a textbook low-contrast violation; it'll feel "intense" but illegible at a glance.

**Suggested fix:** Keep one red. Either:
- Panel chrome dark (`0x2a0a0a` semi-transparent), name in `#ffffff` bold, HP bar red — name pops, bar reads as the "threat" color.
- Or, panel chrome neutral dark, NAME in red as the threat color, HP bar in white/gold to read as "remaining time before threat ends."

**Trivial?:** yes

---

### [HIGH] LoopHUD top strip is 190px of crammed info

**Where:** `src/ui/LoopHUD.ts:60-69, 226-270, 293-324`

**Problem:** Top 190px of the GameScene = LP panel (280×104, gold/loop/HP) + center progress panel (200×104) + RP panel (260×104) + a VIT/DEX/INT/SPI status row at y=146 + a full-width 8-element-shard badge row at y=168. That's 5 horizontal bands stacked. Each panel uses the `healthbar` asset as its background — the same asset for three different meanings. The VIT/DEX/INT/SPI row uses 10px bold codes and 13px white numbers, jammed at 64px spacing inside the left panel's footprint. The 8-element badge row shows "ABV S+E" where ABV is the 3-letter element code in 10px white-on-tinted, and S+E (e.g. "0+0") is 11px gold-on-tinted, with the badge dimmed to 0.1 alpha when both are zero. The latter means most of the row is invisible at run start, but the labels stay legible — so the player sees row of mostly-empty colored bars and won't realize what it is.

**Why it matters:** The map screen is supposed to be calm planning + autoscroll. Right now the top 30% of the screen competes with the gameplay viewport for attention. New players will not realize they have an 8-element economy because it sits at 0.1 alpha 90% of the time.

**Suggested fix:**
- Collapse the three top panels into ONE panel anchored top-left, containing Loop/Gold/HP only. The progress bar belongs at the BOTTOM of the screen (above tiles, where the eye tracks the hero) — not inside the HUD strip.
- TP/materials → move to the right side of the panel or a tooltip.
- Element-shard row → only show elements with `>0` count, left-aligned, growing as the player collects more. Hidden until first shard pickup.
- VIT/DEX/INT/SPI row → only show on a "stats" hover/keypress (S key), as in many ARPGs. They don't change during a loop anyway.

**Trivial?:** no

---

### [HIGH] Card descriptions are 9px monospace

**Where:** `src/ui/CardVisual.ts:212-218`

**Problem:** `fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace'`. At standard 150×240 card size that's borderline; at the `scale: 0.45` used in Shop's remove-card grid (`src/scenes/ShopScene.ts:343`) or 0.4 in DeckBuilder slots that's literally 3.6px effective height — unreadable.

**Why it matters:** The description IS the gameplay. The player needs to know "deals 5 damage and applies Burn 2" or "spend 3 stamina, ignores armor". At 0.45 scale the card looks like a colored brick.

**Suggested fix:**
- Bump base description size to 11px minimum, switch from monospace (which is wider per glyph) to `FONTS.family` for the description; reserve monospace for stat NUMBERS where alignment matters.
- When `options.scale < 0.7`, swap to a "compact" layout: hide the description entirely, show only Name + main effect badge + cost. Picker grids (Shop/Library/DeckBuilder) only need to identify the card; click-to-detail is already wired.
- Increase contrast: `#aaaaaa` on `#1e1e28` is ~5:1 (borderline AA). Use `#d0d0d8` (~9:1) instead.

**Trivial?:** no

---

### [HIGH] Every scene reinvents the button

**Where:** `src/ui/StyleConstants.ts:54-81` (`createButton`), unused by `ShopScene.ts:168-185`, `ForgeScene.ts:258-289`, `PlanningOverlay.ts:133-170`, `CardLibraryScene.ts:80-88` (round red close), `BuildingPanelScene.ts`, `TavernPanelScene.ts`, `NicknameModal.ts:173-189`.

**Problem:** The "primary CTA" looks different in each scene:
- PlanningOverlay Start Loop: `32px bold gold text`, no background, just a shadow + stroke.
- ShopScene Leave Shop: `21px bold gold text`, shadow + stroke.
- ForgeScene Forge: `16px bold gold text` next to a `14px ↺ Clear` and `14px 📖 Library`.
- ShopScene category buttons: filled rectangle `0x2a1408` with gold border on hover.
- CityHub Collection: uses `createButton()` (the only consumer) — `24px gold text on whatever background`.
- Library close: red **circle** with white X.
- NicknameModal Confirm/Cancel: navy rectangles with gold border + gold text.

There are at least five button idioms across the codebase.

**Why it matters:** Every screen feels like a different game. Players learn affordances scene-by-scene instead of once.

**Suggested fix:** Make a real `Button` widget (Container subclass) with variants `primary | secondary | danger | ghost`. All primary buttons: filled `0x9a6030` (or a similar warm metal), 14px bold gold text, 6px padding, 4px border-radius, hover lightens fill by 15%, disabled = 0.4 alpha + grayscale. Migrate ShopScene, ForgeScene, PlanningOverlay, CityHub, Death, Library, NicknameModal — kill `createButton()` and replace it.

**Trivial?:** no

---

### [HIGH] Emoji used as icon system

**Where:** Throughout. Some examples:
- `src/ui/CardVisual.ts:28-32` `CATEGORY_EMOJIS = { attack: '⚔️', defense: '🛡️', magic: '✨' }`
- `src/ui/LoopHUD.ts:420` materials = `{ wood: '🪵', stone: '🪨', iron: '⚙', crystal: '💎', bone: '🦴', herbs: '🌿', essence: '✨' }`
- `src/scenes/ShopScene.ts:37-41` category icons `🔮 🗑 💎`
- `src/scenes/PlanningOverlay.ts:784, 888, 896` `🗑 Remove`, `🛒 Shop`, `⚒ Forge`
- `src/scenes/TutorialScene.ts:29-69` tab labels `⚔ Combat`, `📜 Deck`, `💎 Relics`, `🗺 Tiles`
- `src/ui/CombatHUD.ts:167` `📊 Stats`
- `src/ui/LoopHUD.ts:120, 146-156, 425` `♥`, `⬡`, `📦`

**Problem:** Emoji rendering is OS-dependent (Twemoji on some browsers, Apple Color Emoji on macOS, Segoe UI Emoji on Windows). They scale inconsistently with text, often render in color even when the rest of the UI is monochrome, and clash visually with the pixel-art card images and tile sprites that the game otherwise commits to. The category emoji on a card header is `14px` (`CardVisual.ts:73-77`) — minuscule and the player can't even read it.

**Why it matters:** Breaks visual coherence. A pixel-art card with a 14px ⚔️ Apple emoji in the corner is a tonal contradiction. On Windows Chrome the emoji are basically clip-art.

**Suggested fix:** Commission/draw a small icon set (16×16 and 24×24 PNGs at minimum) for: attack/defense/magic categories, the 7 material types, the 3 shop categories, dice/clock/glow markers, the Stats glyph. Phaser has `setTexture` for `Image`-based icons — same code path as the existing relic icons. Reserve text glyphs (♥, ✦) only for truly unicode-safe symbols.

**Trivial?:** no

---

### [HIGH] No screen-size handling; everything pinned to 800×600

**Where:** `src/ui/StyleConstants.ts:25-31` (`canvasWidth: 800, canvasHeight: 600`), used in `GlossaryPanel.ts:21-22`, `KeywordTooltip.ts:261-273`, `NicknameModal.ts:33`, and hardcoded `400, 300, 800, 600` in basically every scene (CityHub, ShopScene, ForgeScene, PlanningOverlay, CardLibraryScene, DeathScene, GameScene…).

**Problem:** Phaser's canvas typically scales via `Scale.FIT`, but every scene draws against literal pixel coords. There's no anchor/relative layout. A user on a 1920×1080 monitor with browser zoom 110% gets the same logical 800×600 → scaled — fine until any DPR mismatch causes text aliasing (Phaser text bitmaps don't rescale on the fly). More crucially: the LoopHUD/CombatHUD bands are SO crammed at 800px that even a few hundred more pixels of breathing room would dramatically improve them.

**Why it matters:** Less critical for an indie autoscroller, but: (a) any future move to 1024×768 / 16:9 / mobile means re-laying-out every scene; (b) the cramped HUD problem traces directly to "we only had 800px to work with."

**Suggested fix:** Introduce a layout helper:
```ts
const layout = scene.scale; // canvas dims
const left = layout.width * 0.02;
const right = layout.width * 0.98;
```
Refactor at least the top HUDs to use `scale.width`-relative positioning so a future widening doesn't require touching every magic number. Long-term: move to a logical resolution >= 1024×640.

**Trivial?:** no

---

### [MED] Flat visual hierarchy — primary and secondary actions are equally loud

**Where:** `src/scenes/PlanningOverlay.ts:133-170, 887-903`

**Problem:** "Start Loop" (the screen's primary action) is 32px bold gold text with a shadow. "🛒 Shop" and "⚒ Forge" are 22px bold gold with shadow. "🗑 Remove: OFF" is 14px bold. The size scaling exists but all three top actions are gold-bold-stroked — they read as the same priority level. The "Start Loop" button is also just text — no background, no panel. The eye has no "click here" affordance.

**Why it matters:** A new player's eye should snap to "Start Loop". Instead it lands on whichever of the three gold-bold blobs is closest to the cursor.

**Suggested fix:**
- Start Loop = filled button, ~200×56px, gold fill + dark text, drop-shadow.
- Shop/Forge = ghost outline buttons, 120×44px, dark fill + gold border + gold text.
- Remove = ghost text-button with toggle pill (active=red bg, inactive=transparent).

**Trivial?:** no

---

### [MED] CardVisual header is 28px of clutter

**Where:** `src/ui/CardVisual.ts:73-105`

**Problem:** In the top 28px of every card: an emoji category icon at 14px (origin 0,0 at x=-w/2+8), a "COMMON"/"UNCOMMON"/etc. label at 10px bold monospace at x=w/2-8 colored with the rarity hex, and 1-4 colored element dots centered between them at y=-h/2+15 (4px radius, 3px gap, white-alpha stroke). At rendered 150px wide and 14px header height, the "RARE" text is 10px and the element dots are 8px discs. None of it is glanceable.

**Why it matters:** The single most important card info — its name and main number — competes for attention with three secondary signals (category, rarity, elements). Rarity especially: in most card games rarity is communicated by FRAME COLOR, not a text label.

**Suggested fix:** Drop the "COMMON"/"UNCOMMON" text — use frame color (`bg.setStrokeStyle`) at 3px width for the rarity signal. Move category emoji to overlap with the name strip (small badge at the left of the name). Element dots stay at the top — they're the most unique-to-this-game info, OK to keep.

**Trivial?:** yes

---

### [MED] CardVisual cost banner is below the description with a different color language

**Where:** `src/ui/CardVisual.ts:222-239`

**Problem:** Cost shown as a 22px-tall strip at the bottom of the card with text like `-3 Mana, -2 Stamina` in `#ffcc66`. The main effect at the TOP of the card body shows DMG/ARM/HP numbers in their own colors (`#ff6666`, `#66bbff`, `#66ff66`). So: top numbers = positive effects in saturated colors, bottom numbers = costs in muted yellow. That mapping isn't reinforced by layout — a quick glance can't tell which is in/out.

**Why it matters:** Card games live and die on "I pay X to do Y" parsing speed. Hearthstone puts cost in a colored gem in the corner; Slay the Spire puts it bottom-left as a single number. Listing costs as `-3 Mana, -2 Stamina` text wastes width and forces reading.

**Suggested fix:** Replace the bottom strip with a single corner badge for the dominant cost (mana gem in top-left corner, ~22×22px), and a tiny secondary indicator if the card has a hybrid cost. The text strip becomes redundant.

**Trivial?:** no

---

### [MED] KeywordTooltip mounts beside the card but blocks the description it explains

**Where:** `src/ui/KeywordTooltip.ts:254-273`

**Problem:** Panel is 220px wide; positioned `anchorRight + 12px` (or mirrored to the left if it would clip). For a card in the middle of the canvas (DeckBuilder grid: card at ~x=300), the tooltip mounts to the right, fine — but for a card on the right edge (CardLibrary grid: cards extending to x=720), it gets mirrored to the LEFT and overlaps the card next to it. Worse, when triggered from a hand card during DeckCustomization, the tooltip can land on top of other hand cards.

**Why it matters:** Tooltips that cover the thing they describe are a UX cardinal sin.

**Suggested fix:** Allow positioning ABOVE/BELOW the card too — fall back to vertical placement when neither side fits. Also: lower `BACKDROP_ALPHA = 0.72` (in `GlossaryPanel.ts:17`) on the related glossary panel — 0.72 is so dim the player can't see what's beside it.

**Trivial?:** no

---

### [MED] PlanningOverlay subtile row dims to 0.5 alpha — looks broken, not "informational"

**Where:** `src/scenes/PlanningOverlay.ts:622-624`

**Problem:** When the player has no reserved slot, the entire subtile row renders at `alpha: 0.5` with the cost text colored `#880000` (dark red). To a new player, this reads as "broken" or "loading" — not as "you don't have a target yet." There's no tooltip or label explaining WHY they're dimmed.

**Why it matters:** New player thinks the buttons are broken; experienced player has trained themselves to ignore the row.

**Suggested fix:** Either (a) hide the subtile row entirely until a reserved slot exists (with a one-liner "Place a Combat tile to unlock subtiles" hint), or (b) keep it visible at full alpha but add an inline lock icon and a one-line caption.

**Trivial?:** yes

---

### [MED] "Don't stop here for: 1 / 5 / 10 / 25" looks like a debug toggle

**Where:** `src/scenes/PlanningOverlay.ts:741-780`

**Problem:** Label text "Don't stop here for:" at x=280, y=505, anchored right; then four numeric buttons "1", "5", "10", "25" each 50px apart, no container, no border. Active = bold gold, inactive = light cyan. No unit ("loops? minutes? tiles?"). Looks like a development checkbox row.

**Why it matters:** This is a meaningful gameplay setting (skip N planning phases) and players will miss it.

**Suggested fix:**
- Rename to: "Skip next N planning phases:" with the unit explicit.
- Wrap the four buttons in a single segmented-control container with a visible group border and a clear "active" pill behind the selected number.
- Add a tooltip on hover: "Auto-skip the next N planning phases. Boss planning always stops."

**Trivial?:** yes

---

### [MED] ShopScene and ForgeScene are visually identical scenes with subtle drift

**Where:** `src/scenes/ShopScene.ts:28-32` vs `src/scenes/ForgeScene.ts:35-39`

**Problem:** Both use `PANEL_W = 470, PANEL_CX = 400`, both share the same `colX` helper (copy-pasted!), both use the same header chrome and "Leave …" button pattern, both reuse the same `colors` (GOLD/WHITE/DIM/RED). But: Shop renders one rail-line on the right (`PANEL_RIGHT`); Forge renders rails on BOTH sides (`PANEL_LEFT` + `PANEL_RIGHT`). The category-card hover in Shop sets `0x4a2810` fill + `0xffd700` border, but Forge's element-cell hover sets `0xffffff` 2px stroke with no fill change.

**Why it matters:** Two scenes the player visits constantly, each subtly different. Easier to write a base class than to keep them in sync.

**Suggested fix:** Extract `ModalPanelScene` (or a `buildShopChrome(scene)` helper) so both scenes share the panel rails, header, gold readout, "Leave" button, and `colX` math. Drift fixed at the source.

**Trivial?:** no

---

### [MED] CombatScene uses both a `Triangle` arrow indicator and a tween-pulsing card visual

**Where:** `src/ui/CardQueueDisplay.ts:13-17, 66-80`

**Problem:** Cards at scales `0.65` (top card) and `0.45` (others). At those scales the description text is unreadable per the issue above. Queue position 7,8,9... never visible (`VISIBLE_COUNT = 3`) — the player has no preview of what's coming after the next card. `QUEUE_X = 740` and `START_Y = 110` are hardcoded; queue depth is hardcoded at 3.

**Why it matters:** Knowing what card is coming after the current one is core to autocombat strategy — it's literally the only place planning happens during combat. Showing only 3 cards in a deck of 15 is information starvation.

**Suggested fix:** Show 5–6 cards vertically (since they're already small), top card prominent, the rest at the same small scale. Or compress to icon-only chips for positions 3+ and put the upcoming pair in full size.

**Trivial?:** no

---

### [MED] Glossary panel text on textured backgrounds is a contrast hazard

**Where:** `src/ui/GlossaryPanel.ts:80-83`

**Problem:** Panel background `0x1a1a2e` with `alpha: 0.98` over a 72% black backdrop on top of whatever scene is below. For the panel TITLE color = `COLORS.accent` (gold `#ffd700`), fine. But the keyword definitions are body text `COLORS.textPrimary` (`#ffffff`, 12px) on `#1a1a2e` — OK. The "(stack count)" header `(${list.length})` gets the category color (orange/gold/blue). The scroll viewport scrolls content but has NO scrollbar — only a `Scroll for more` hint in 11px. Player has no idea how much more content exists.

**Why it matters:** A glossary with no visible scrollbar feels like the visible content is all there is. Player will miss half the keywords.

**Suggested fix:** Add a visible scrollbar on the right edge of `CONTENT_X + CONTENT_W` showing thumb position and content overflow. Even 4px wide is enough.

**Trivial?:** yes

---

### [MED] CityHub material readout cramps emoji + text in 90px columns

**Where:** `src/scenes/CityHubScene.ts:70-120`

**Problem:** 6 materials in a 2×3 grid in the top-left, each row 26px tall, columns 90px wide. Each cell has an 18×18 icon at position `(x, y)` and "stone: 7" text starting at `x + 10` — meaning the text starts 10px from the icon CENTER, overlapping the icon's right half. The text is 12px `#e6c88a` with stroke. Below: crystal centered in the middle position of the 4th row, looking lonely.

**Why it matters:** Cluttered, off-balance, and the icon-overlap is a clear bug. The 3+3+1 = 7-cell layout for 6 materials with crystal centered awkwardly suggests this was edited but never re-balanced.

**Suggested fix:** Fixed 2×3 (or 3×2) grid, all 6 materials placed evenly. Reposition text to start `x + 14` (past the 18px icon, then 5px gap). Or stack vertically: icon on top, value below, in a 60×40 cell.

**Trivial?:** yes

---

### [MED] LoopHUD shop toggle is dead code that still allocates objects

**Where:** `src/ui/LoopHUD.ts:166-178, 387-400, 438-441`

**Problem:** "Shop tile removed: shop is now only reachable from PlanningOverlay" — but `shopToggleBg` and `shopToggleText` are still created as `setVisible(false)` and updated every frame in `updateShopToggle()`, which is itself called every `update()` tick. Wasted draw calls; worse, the surrounding code (`drawShopToggle`) is preserved as if it might come back. Confusing for the next person reading it.

**Why it matters:** Not visual impact, but signals UI code rot — and the file has comments saying "keep the offscreen Text/Graphics so updateShopToggle() still has a target" which is the textbook smell of "we couldn't be bothered to refactor."

**Suggested fix:** Delete `shopToggleBg`, `shopToggleText`, `drawShopToggle`, `updateShopToggle` — none of them render anymore. Net negative LOC.

**Trivial?:** yes

---

### [LOW] Hover states inconsistent: scale, tint, color, or stroke

**Where:** Sample:
- `src/ui/CardVisual.ts:248-270` hover = tween scale 1.05 + y-8 + stroke white
- `src/scenes/PlanningOverlay.ts:88-95` hover = scale 1.1 + tint 0xdddddd
- `src/scenes/ShopScene.ts:173-174` hover = fill change + stroke gold
- `src/scenes/CityHubScene.ts:228-241` hover = tint 0xffffcc + scale 1.05
- `src/ui/StyleConstants.ts:70-77` hover = color change + scale 1.05

**Problem:** Five different hover idioms.

**Why it matters:** Subtle but degrades polish. A player who hovers a card and gets "lift up + glow" then hovers a building and gets "yellow tint" feels the inconsistency even if they can't name it.

**Suggested fix:** Pick ONE: hover = `scale 1.05 + brightness +10%` (via tint `0xdddddd` or fillStyle lighten). Use it everywhere.

**Trivial?:** no

---

### [LOW] Toasts are red 14px text fading over 1.5s, no background

**Where:** `src/scenes/PlanningOverlay.ts:916-927`

**Problem:** Error toasts ("Boss tiles cannot be replaced", etc.) render as `#ff0000` text at y=560 with no background, no icon, no animation other than alpha fade. Easily lost against the inventory panel underneath.

**Why it matters:** The player triggered an action and got an error — the feedback needs to be unmissable. A red string fading at the bottom doesn't qualify.

**Suggested fix:** Toast = dark pill background (semi-transparent black, 8px padding, 4px corner radius), red icon + white text, slides in from top, holds 1s, slides out. Reusable `showToast(scene, message, kind)` in `ui/`.

**Trivial?:** yes

---

### [LOW] Modal backdrops use different alphas across scenes

**Where:**
- `src/ui/GlossaryPanel.ts:17` `BACKDROP_ALPHA = 0.72`
- `src/ui/NicknameModal.ts:33` backdrop alpha `0.75`
- `src/scenes/BuildingPanelScene.ts:48` `0x000000, 0.75`
- `src/scenes/ShopScene.ts:99` `0x000000, 0.7`
- `src/scenes/CardLibraryScene.ts:66` `0x000000, 0.85`
- `src/scenes/DeckBuilderScene.ts:163` `0x000000, 0.92`
- `src/scenes/TavernPanelScene.ts:22` `0x000000, 0.5`

**Problem:** Seven different backdrop dim levels for seven different overlays.

**Why it matters:** Modal hierarchy gets fuzzy. Tavern at 0.5 feels weak, DeckBuilder at 0.92 feels opaque — there's no semantic mapping.

**Suggested fix:** Two values: `MODAL_DIM = 0.78` (most overlays), `OPAQUE_DIM = 0.96` (DeckBuilder-style "you're committing to a screen"). Use one constant exported from StyleConstants.

**Trivial?:** yes

---

### [LOW] PlanningOverlay tooltip clobbers itself on rapid hover

**Where:** `src/scenes/PlanningOverlay.ts:831-852`

**Problem:** Only one `tooltipTimer` and one `tooltipObj` field — if the player hovers card A (timer started), then quickly hovers card B before 800ms fires, the timer is cancelled & restarted for B. That part is fine. But: if the timer fires for B while A's pointerout already triggered `hideTooltip()` first, no harm. If the player hovers A → 800ms → tooltip shows → hovers B before pointerout fires → A's tooltip stays until B's pointerover triggers `pointerout`. Edge case but jarring.

More importantly: tooltip text style is hardcoded inline (`fontSize 12px`, `wordWrap 220px`, `bg 0x101010 0.92, stroke 0xffd700`). Same look as the SHOP buttons' gold border, same as the KEYWORD tooltip — easy visual confusion with the keyword glossary tooltip which is a real informational panel.

**Why it matters:** Player can't tell at a glance whether the popup is "tile description" (transient, ignore-able) or "keyword reference" (read carefully).

**Suggested fix:** Distinguish: tile tooltips = small, white/light gray, no gold accent. Keyword tooltips = larger, gold accent (keeps the "important glossary" feel).

**Trivial?:** yes

---

### [LOW] DeckBuilder preset tabs are tiny (90×24) and inactive ones look disabled

**Where:** `src/scenes/DeckBuilderScene.ts:238-278`

**Problem:** 90×24 buttons, label color `DIM` (`#aaaaaa`) when not selected — but the same `DIM` is used for "no cards saved yet" preset slots vs "saved but not selected." The only difference between "preset 2 (saved)" inactive and "preset 3 (empty)" inactive is the bg fill alpha. Player can't tell at a glance which presets have saved decks.

**Why it matters:** Pre-run deck selection is a key feature. Saved presets need to read as "click me, I have cards" — different from "empty slot."

**Suggested fix:** Saved-but-inactive presets get a small badge with the card count (e.g. "Deck A · 10"); empty presets show "+ Empty" in italic.

**Trivial?:** yes

---

### [LOW] Element-shard counter format "0+0" is cryptic

**Where:** `src/ui/LoopHUD.ts:261-265`

**Problem:** Badge displays `${s}+${e}` where `s` = shards (0-9, auto-converts at 10) and `e` = converted element units. So the player sees "7+2" and is expected to know: 7 shards, 2 elements, 10 shards → 1 element. There's no legend, no tooltip, no labels.

**Why it matters:** Players cargo-cult the meaning ("higher numbers = better, I guess").

**Suggested fix:** Add a one-time intro overlay or persistent tooltip on hover: "7 shards (10 → 1 unit) + 2 units." Or change the format to "7▾ · 2◆" with distinct glyphs for each, so the player at least sees "two things tracked separately."

**Trivial?:** yes

---

### [LOW] CardDetailPopup rarity color collides with category color

**Where:** `src/ui/CardDetailPopup.ts:14-32`

**Problem:** `RARITY_COLORS = { common: 0xcccccc, uncommon: 0x33cc33, rare: 0xff6600, epic: 0xaa00ff }` while `CATEGORY_COLORS = { attack: 0xcc3333, defense: 0x3366cc, magic: 0x9933cc }`. The popup likely shows both rarity AND category labels — `rare (orange)` looks suspiciously similar to `attack (red-ish)`, and `epic (purple)` is identical to `magic (purple)`.

**Why it matters:** Color-coded info that maps to two orthogonal dimensions needs distinct palettes. Right now an epic magic card has the same purple twice.

**Suggested fix:** Move category coding off color entirely — use icons or borders. Reserve color for rarity (the only thing players need to skim for quickly when looting).

**Trivial?:** no

---

### [LOW] `_lastFill` hack for bar references

**Where:** `src/ui/CombatHUD.ts:237-241`

**Problem:** `buildBar` creates a Rectangle and stashes it on `this._lastFill` so the next line of the caller can read it via `this.getLastFill()`. Comment literally says "Store fill reference via a small hack — expose it to the calling scope." Pure code smell.

**Why it matters:** Not player-facing, but makes the HUD code brittle — adding a fourth bar means remembering the call-then-read sequence in order.

**Suggested fix:** Make `buildBar` return the fill rectangle. `this.hpBar = this.buildBar(...)`. Done.

**Trivial?:** yes

---

### [LOW] DeathScene RNG-rendered "blood splatter" decoration

**Where:** `src/scenes/DeathScene.ts:43-57`

**Problem:** On `create()`, the scene draws 12 random circles + 20 random 10×10 rects to make the death screen "atmospheric." Different every run, not seeded by anything. Looks more like a debug viz than intentional art.

**Why it matters:** Death is the most emotional moment of a roguelike. "Random rectangles at varying positions" is not the visual that lands.

**Suggested fix:** Use a single hand-authored vignette/gradient asset (or skip the splatter entirely). The text content does the work; the bg can be a flat dark color with optional letterbox bars.

**Trivial?:** yes

---

### [LOW] MapSpeedSlider title and snap ticks but no readout

**Where:** `src/ui/MapSpeedSlider.ts:43-80` (rest not read but title says "Map Speed" without a value)

**Problem:** Slider with track + handle + ticks at [0.5, 1, 1.5, 2, 3]. Title is "Map Speed" — but the current value (1.5x, 2x) is rendered separately as `this.label`. If `this.label` doesn't show the snap value adjacent to the handle, the player drags blind. (The full implementation likely handles it but the title-only display suggests the value text is small.)

**Why it matters:** Snap sliders without value readouts on the handle are user-hostile.

**Suggested fix:** Render the current value as a 12px label centered above (or below) the handle so it moves with the drag. Confirm `label.setText` updates during drag.

**Trivial?:** yes

---

### [LOW] Cooldown arc text is 15px white on dark — fine, but the arc itself is too small to read at a glance

**Where:** `src/ui/CombatHUD.ts:292-302, 432-464`

**Problem:** Cooldown arc is `R = 30` (30px radius circle) at (400, 48). The text inside it shows "2.4" or "▶" at 15px bold. At 30px radius, the arc fill IS visible (gold pie slice), but the differentiation between "0.4s left" and "▶ ready" relies on a single character change inside the 30px disc.

**Why it matters:** The cooldown is the player's only timing signal in combat. Wider, more readable.

**Suggested fix:** Bump R to 40, text to 18px. Add a subtle pulse when `remaining <= 0` (the "▶" state) so peripheral vision catches "ready to play." Already drawn `fillStyle ... progress >= 1 ? 1.0 : 0.85` — turn the >=1 state into a 1.05x scale pulse loop until the next card fires.

**Trivial?:** no

---

### [LOW] `STARTER_DECK_SIZE · 10 elements total · warrior ratio P[X-Y] / E[X-Y]` hint string

**Where:** `src/scenes/DeckBuilderScene.ts:192-194`

**Problem:** Hint reads: `"Pick 5 starter cards (Tier 0-1) · 10 elements total · warrior ratio P[2-4] / E[3-5]"`. Three pieces of info crammed into one 11px sentence with bullets, brackets, and unexplained acronyms (P, E).

**Why it matters:** New player has no idea what "P[2-4] / E[3-5]" means.

**Suggested fix:** Break into two lines or two panels. Show element budget as a visual: two stacked progress bars labelled "Physical 2-4 ✓ 3" and "Elemental 3-5 ✓ 4" with the live count.

**Trivial?:** no

---

### [LOW] Multiple FONTS.family redeclarations as `const FF = FONTS.family` across files

**Where:** `CombatHUD.ts:25`, `LoopHUD.ts:17`, `ShopScene.ts:21`, `ForgeScene.ts:29`, `DeckBuilderScene.ts:34`, `CardLibraryScene.ts:20`.

**Problem:** Six files redefine `const FF = FONTS.family` because Phaser style objects need `fontFamily: FF` for every text. Easy to lose track and revert to a different family inline. Nothing in the code stops a scene from passing `fontFamily: 'monospace'` (and CardVisual does, for stat numbers).

**Why it matters:** Indicates `StyleConstants` should expose helper functions (`titleStyle()`, `bodyStyle()`, `numericStyle()`) that bake the family in, not just constants. Right now every scene re-implements the same style object 20+ times.

**Suggested fix:** Add `makeTextStyle(variant: 'title' | 'heading' | 'body' | 'small' | 'numeric', overrides?)` to StyleConstants. Scenes call `this.add.text(..., makeTextStyle('body', { color: GOLD }))`.

**Trivial?:** no

---

### [LOW] No disabled state animation on unaffordable shop items

**Where:** `src/scenes/ShopScene.ts:53-64` (`cardSlot`), `src/scenes/ForgeScene.ts:140-147`

**Problem:** Unaffordable items get fill `0x1e1008` + border `0x4a3020` + alpha `0.5`. No interactive cursor, no tooltip explaining "needs X gold," no shake/flash on hover. Player just sees a dark rectangle.

**Why it matters:** "Why can't I click this?" → adds friction.

**Suggested fix:** On hover of disabled item, show a small floating reason: "Need 50 more gold" or "Deck full (15/15)". Cursor stays `not-allowed`.

**Trivial?:** yes

---

## Quick Wins (trivial fixes, high impact)

1. Drop the rarity TEXT label on cards — use frame color only. (`CardVisual.ts:79-86`)
2. Hide the subtile row entirely when locked instead of dimming to 0.5. (`PlanningOverlay.ts:622-624`)
3. Unify modal backdrop alphas to one constant. (`StyleConstants.ts` + 7 callers)
4. Add a visible scrollbar to GlossaryPanel. (`GlossaryPanel.ts:130-136`)
5. Rename "Don't stop here for" → "Skip next N planning phases" and wrap in a segmented control. (`PlanningOverlay.ts:741-780`)
6. Fix CityHub material grid icon overlap (text starts at icon center). (`CityHubScene.ts:99-100`)
7. Delete the dead `updateShopToggle` code path in LoopHUD. (`LoopHUD.ts:166-178, 387-400, 438-441`)
8. Bump the enemy panel contrast: dark chrome OR dark text, not pink-on-pink. (`CombatHUD.ts:258-267`)
