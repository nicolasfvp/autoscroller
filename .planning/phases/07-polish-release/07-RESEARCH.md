# Phase 7: Polish & Release - Research

**Researched:** 2026-03-28
**Domain:** Web Audio API, Phaser 3 scene transitions, UI standardization, game QoL features
**Confidence:** HIGH

## Summary

Phase 7 is a polish-only phase with no new game mechanics. The work divides into four clear domains: (1) rewriting the tutorial to reflect actual gameplay, (2) implementing programmatic sound effects via Web Audio API, (3) standardizing visual styles and scene transitions across all ~29 scenes, and (4) adding settings/QoL features (volume control, game speed, save management). Additionally, two requirements (CMBT-05, PLSH-01) need status updates since they are already implemented.

The codebase is well-structured for this work. AudioManager already has the correct singleton API shape -- it just needs its console.log internals replaced with Web Audio oscillator nodes. TutorialScene has the step-through navigation pattern ready for content rewrite. All scenes follow consistent patterns (same background color, same button style) but with hardcoded values that need extraction into shared constants. Scene transitions (fadeIn/fadeOut) are currently absent -- no scene uses camera fades yet.

**Primary recommendation:** Structure work into three plans: (1) AudioManager + style constants foundation, (2) tutorial rewrite + settings expansion + game speed, (3) scene transitions + visual consistency pass across all scenes. The foundation plan must come first since both other plans depend on the shared style constants and working AudioManager.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Tutorial**: Step-through text screens reusing TutorialScene pattern. Content covers core loop only (tile placement, deck ordering, auto-combat, shop actions). Fix outdated heir system reference and tile color descriptions. First-run only via `tutorialSeen` flag on MetaState. Skippable. English only.
- **Audio**: Web Audio API tones only -- no audio file assets. Priority SFX: combat hit, card play, gold gain, button click, hero death, loop completion, boss encounter. No background music in v1. Single SFX volume slider + mute toggle, persisted.
- **Transitions**: Camera fadeIn/fadeOut (300-500ms) on all scene starts/stops. Universal, consistent.
- **Visual consistency**: Shared style constants object (colors, font sizes, panel dimensions). Standardize button hover + optional scale tween (1.0 to 1.05). Tweened number counters on stat changes (300ms). Fixed 800x600 canvas.
- **Settings**: SFX volume slider 0-100%, game speed 1x/2x toggle (doubles LoopRunner/CombatEngine tick delta), auto-save toggle. ESC = pause/back, SPACE = continue/advance. "Delete Run" and "Reset All Progress" with double confirmation.
- **Requirements**: CMBT-05 and PLSH-01 already implemented -- mark as complete in REQUIREMENTS.md traceability table.

### Claude's Discretion
- Exact Web Audio API tone parameters (frequency, waveform, envelope shape)
- Style constants values (exact hex colors, font sizes, spacing)
- Fade duration and tween easing curves
- Tutorial text wording and number of screens
- Game speed implementation details (which systems get the multiplier)
- Settings UI layout within SettingsScene

### Deferred Ideas (OUT OF SCOPE)
- Background music and full soundtrack (PLSH-03, v2)
- Visual art overhaul / sprite assets (PLSH-04, v2)
- Save export/import functionality (PLSH-05, v2)
- Responsive canvas / resolution scaling
- Accessibility features (colorblind mode, screen reader)
- Achievement/statistics tracking beyond single run
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.80.x | Game framework, scene management, camera fades, tweens | Already in use, provides fadeIn/fadeOut/tweens natively |
| Web Audio API | Browser native | Programmatic SFX generation | Zero dependencies, no asset pipeline, built into all modern browsers |
| TypeScript | 5.2.x | Type safety | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb-keyval | 6.2.x | Persist audio preferences | Already used for MetaState persistence |
| vitest | 4.1.x | Test AudioManager and style utilities | Already the project test framework |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Audio API raw | Tone.js | Massive overkill for 7 simple tones; adds 150KB+ bundle weight |
| Manual style constants | CSS-in-JS | Not applicable -- Phaser uses its own rendering, not DOM |
| Phaser camera fades | Custom alpha tweens | Camera fades are built-in, single line of code, handle all children |

**Installation:**
```bash
# No new dependencies needed -- all tools already available
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  audio/
    AudioManager.ts        # Rewrite internals: Web Audio oscillators replacing console.log
    SoundDefinitions.ts    # NEW: tone parameters per SFX event (frequency, waveform, duration, envelope)
  ui/
    StyleConstants.ts      # NEW: shared colors, fonts, dimensions, button factory
    LoopHUD.ts             # Update to use StyleConstants
    CombatHUD.ts           # Update to use StyleConstants
    CardVisual.ts          # Already exists
  scenes/
    TutorialScene.ts       # Rewrite content, add tutorialSeen check, Skip button
    SettingsScene.ts       # Expand: volume slider, game speed toggle, save management
    [all 29 scenes]        # Add fadeIn/fadeOut, standardize styles
  state/
    MetaState.ts           # Add tutorialSeen: boolean, audioPrefs to interface
```

### Pattern 1: Web Audio Tone Generation
**What:** Create short synthesized tones using OscillatorNode + GainNode with envelope shaping
**When to use:** Every SFX trigger in the game
**Example:**
```typescript
// Source: Web Audio API specification (W3C)
interface ToneConfig {
  frequency: number;       // Hz (e.g., 440 for A4)
  waveform: OscillatorType; // 'sine' | 'square' | 'triangle' | 'sawtooth'
  duration: number;        // seconds (e.g., 0.1 for a click)
  attack: number;          // seconds to reach peak volume
  decay: number;           // seconds to fade to zero
  volume: number;          // 0-1 peak gain
}

function playTone(ctx: AudioContext, config: ToneConfig, masterVolume: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = config.waveform;
  osc.frequency.value = config.frequency;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(config.volume * masterVolume, now + config.attack);
  gain.gain.linearRampToValueAtTime(0, now + config.attack + config.decay);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + config.duration);
}
```

### Pattern 2: Style Constants Module
**What:** Single source of truth for all visual values used across scenes
**When to use:** Every scene that creates text, panels, or buttons
**Example:**
```typescript
// src/ui/StyleConstants.ts
export const COLORS = {
  background: 0x1a1a2e,
  panel: 0x222222,
  accent: '#ffd700',
  accentHover: '#ffffff',
  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  danger: '#ff0000',
  synergy: '#ff00ff',
  xp: '#00ccff',
  material: '#e040fb',
} as const;

export const FONTS = {
  family: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  title: { fontSize: '32px', fontStyle: 'bold' },
  heading: { fontSize: '24px', fontStyle: 'bold' },
  body: { fontSize: '16px' },
  small: { fontSize: '14px' },
} as const;

export const LAYOUT = {
  canvasWidth: 800,
  canvasHeight: 600,
  centerX: 400,
  centerY: 300,
  panelAlpha: 0.9,
  fadeDuration: 400,
} as const;

/** Factory: creates a standard interactive text button with hover effects */
export function createButton(
  scene: Phaser.Scene,
  x: number, y: number,
  text: string,
  onClick: () => void,
  style?: 'primary' | 'secondary'
): Phaser.GameObjects.Text { ... }
```

### Pattern 3: Scene Fade Transitions
**What:** Wrap all scene.start() and scene.stop() calls with camera fades
**When to use:** Every scene transition in the game
**Example:**
```typescript
// Source: Phaser 3 Camera API
// In scene create():
this.cameras.main.fadeIn(400, 0, 0, 0);

// Before transitioning out:
this.cameras.main.fadeOut(400, 0, 0, 0);
this.cameras.main.once('camerafadeoutcomplete', () => {
  this.scene.start('NextScene', data);
});
```

### Pattern 4: Game Speed Multiplier
**What:** Multiply deltaMs in update() before passing to tick() methods
**When to use:** GameScene and CombatScene update loops
**Example:**
```typescript
// In GameScene.update():
const speedMultiplier = getGameSpeed(); // 1 or 2
this.loopRunner.tick(delta * speedMultiplier);

// In CombatScene.update():
this.engine.tick(delta * speedMultiplier);
```

### Anti-Patterns to Avoid
- **Hardcoded colors in scenes:** Every scene currently has `0x1a1a2e`, `#ffd700`, etc. inline. After creating StyleConstants, replace them -- do NOT leave a mix of constants and hardcoded values.
- **AudioContext created on page load:** Browsers require user gesture before AudioContext can play. Create/resume AudioContext on first user interaction, not at initialization.
- **Blocking fade transitions:** Don't block scene transitions by waiting for fadeOut in synchronous code. Use the `camerafadeoutcomplete` event callback.
- **Rebuilding tutorial navigation:** TutorialScene already has working step-through (SPACE/click). Rewrite the content array and add MetaState check, but keep the navigation pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera fades | Custom alpha/tint animation on all objects | `cameras.main.fadeIn/fadeOut` | Built-in, handles all children, single line |
| Number tweening | Manual frame-by-frame counter | `this.tweens.addCounter()` | Phaser Tween system handles easing, cleanup |
| Slider UI | Custom drag+track implementation | Phaser Rectangle + pointer drag with clamp | Keep minimal but use Phaser's drag system |
| Tone synthesis | Sampled audio files or Phaser sound | Web Audio OscillatorNode + GainNode | Zero assets, precise control, tiny code footprint |

**Key insight:** Phaser 3 already provides camera fades, tween counters, and drag handling. The project's minimalist style (geometric shapes, text-only) means no external UI library is needed -- just shared helper functions wrapping Phaser primitives.

## Common Pitfalls

### Pitfall 1: AudioContext Autoplay Policy
**What goes wrong:** AudioContext is created but browsers block audio until user gesture
**Why it happens:** Chrome/Firefox/Safari all require a user interaction before `AudioContext.resume()` succeeds
**How to avoid:** Create AudioContext lazily on first `playSFX()` call, or call `audioCtx.resume()` inside a click/keydown handler. The existing AudioManager constructor takes a Scene -- hook into the scene's first interaction event.
**Warning signs:** No sound plays, console shows "AudioContext was not allowed to start"

### Pitfall 2: Scene Transition Race Conditions
**What goes wrong:** FadeOut callback fires after scene is already destroyed, or multiple transitions overlap
**Why it happens:** Player clicks rapidly, or an event triggers scene change during fade
**How to avoid:** Set a `transitioning` flag. Ignore all transition requests while flag is true. Reset flag in scene's `create()`.
**Warning signs:** "Cannot read property of destroyed object" errors, scenes stacking

### Pitfall 3: Style Constants Partial Migration
**What goes wrong:** Some scenes use constants, others still have hardcoded values
**Why it happens:** 29 scenes is a lot of files to update; easy to miss some
**How to avoid:** Use grep to find all remaining hardcoded color values after migration. Run `grep -r "0x1a1a2e\|#ffd700\|#222222" src/scenes/` to verify zero remaining.
**Warning signs:** Visual inconsistency between scenes

### Pitfall 4: Game Speed Affecting Animations
**What goes wrong:** 2x speed makes UI tweens (button hover, number counters) also run at 2x
**Why it happens:** Accidentally applying speed multiplier globally instead of only to game logic tick methods
**How to avoid:** Speed multiplier ONLY applies to `LoopRunner.tick(delta)` and `CombatEngine.tick(delta)`. Phaser scene tweens and camera fades use their own time scale unaffected by the multiplier.
**Warning signs:** Animations look jerky at 2x speed

### Pitfall 5: MetaState Migration for tutorialSeen
**What goes wrong:** Existing players crash because saved MetaState lacks `tutorialSeen` field
**Why it happens:** Adding new fields to MetaState interface without migration
**How to avoid:** Default `tutorialSeen` to `false` in `createDefaultMetaState()` and handle missing field in `migrateMetaState()`. Current version is 2 -- bump to 3 with migration.
**Warning signs:** Undefined errors when checking tutorialSeen on old saves

## Code Examples

### Existing AudioManager API (to preserve)
```typescript
// Source: src/audio/AudioManager.ts (current)
// Public API to keep stable:
playSFX(sound: 'hit' | 'card' | 'gold' | 'click' | 'hurt'): void
playMusic(track: 'menu' | 'game' | 'combat' | 'boss'): void  // no-op for v1
stopMusic(): void                                               // no-op for v1
setSFXVolume(volume: number): void
setMusicVolume(volume: number): void
setEnabled(enabled: boolean): void

// Extend the sound union type to include new events:
type SFXEvent = 'hit' | 'card' | 'gold' | 'click' | 'hurt' | 'death' | 'loop_complete' | 'boss_warning';
```

### Existing Scene Transition Points (where fades go)
```typescript
// Source: grep of src/scenes/ -- 65+ scene.start/stop/resume calls across 29 scenes
// Key transitions that need fadeOut -> callback -> start:
// MainMenu -> GameScene/CityHub
// CombatScene -> PostCombatScene/DeathScene
// GameScene -> GameOverScene
// DeathScene -> CityHub
// BossExitScene -> CityHub
// CityHub -> CollectionScene/GameScene
// Overlay scenes (launch/stop) do NOT need fades -- they overlay on top
```

### Existing Button Pattern (to standardize)
```typescript
// Source: repeated in nearly every scene (e.g., MainMenu.ts, DeathScene.ts)
const btn = this.add.text(400, 300, 'Label', {
  fontSize: '24px',
  fontStyle: 'bold',
  color: '#ffd700',
}).setOrigin(0.5).setInteractive({ useHandCursor: true });

btn.on('pointerover', () => btn.setColor('#ffffff'));
btn.on('pointerout', () => btn.setColor('#ffd700'));
btn.on('pointerdown', () => doSomething());
// This 7-line pattern appears 40+ times -- extract into createButton() helper
```

### Game Speed Integration Points
```typescript
// Source: src/scenes/GameScene.ts line 148
// Currently: this.loopRunner.tick(delta);
// Change to: this.loopRunner.tick(delta * this.gameSpeed);

// Source: src/scenes/CombatScene.ts line 203
// Currently: this.engine.tick(delta);
// Change to: this.engine.tick(delta * this.gameSpeed);

// gameSpeed comes from settings (1 or 2), stored in MetaState or localStorage
```

### MetaState Extension Needed
```typescript
// Source: src/state/MetaState.ts
// Add to MetaState interface:
tutorialSeen: boolean;
audioPrefs: {
  sfxVolume: number;   // 0-1
  sfxEnabled: boolean;
};
gameSpeed: number;      // 1 or 2
autoSave: boolean;      // default true
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phaser Sound Manager with audio files | Web Audio API programmatic tones | Always available | Zero asset overhead, instant loading |
| Per-scene hardcoded styles | Shared constants module | Standard practice | Consistency, maintainability |
| Instant scene switches | Camera fade transitions | Phaser 3.x built-in | Professional feel with minimal code |

**Deprecated/outdated:**
- Phaser 3 `cameras.main.fade()` (old API) replaced by `cameras.main.fadeIn()` / `cameras.main.fadeOut()` -- use the newer split methods

## Open Questions

1. **Overlay scenes and fades**
   - What we know: ~15 overlay scenes use `scene.launch()` / `scene.stop()` -- they appear on top of GameScene
   - What's unclear: Should overlays get fadeIn/fadeOut or just full-scene transitions?
   - Recommendation: Only apply fades to full scene transitions (scene.start). Overlays are modals -- they should appear/disappear instantly or with a simple alpha tween on their backdrop, not camera fades.

2. **Settings persistence location**
   - What we know: MetaState uses idb-keyval. localStorage is also available.
   - What's unclear: Should audio prefs live in MetaState (idb-keyval) or localStorage?
   - Recommendation: Add to MetaState for consistency. The MetaPersistence system already handles load/save, and audio prefs should survive if idb is cleared (which is the same risk as MetaState itself).

3. **Tutorial trigger point**
   - What we know: TutorialScene currently transitions to GameScene on completion
   - What's unclear: Should tutorial show before first GameScene or before first CityHub?
   - Recommendation: Show before first CityHub visit (after MainMenu "New Run"). The tutorial covers tile placement and shop, which happen during the run that starts from CityHub.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.x |
| Config file | package.json `"test": "vitest run --reporter=verbose"` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMBT-05 | Post-combat summary shows stats | manual-only | Visual scene verification | N/A -- already implemented |
| PLSH-01 | Death screen shows run statistics | manual-only | Visual scene verification | N/A -- already implemented |
| POLISH-AUDIO | AudioManager generates tones | unit | `npx vitest run tests/audio/AudioManager.test.ts -x` | Wave 0 |
| POLISH-STYLE | Style constants exported correctly | unit | `npx vitest run tests/ui/StyleConstants.test.ts -x` | Wave 0 |
| POLISH-SPEED | Game speed multiplier applied to tick | unit | `npx vitest run tests/systems/GameSpeed.test.ts -x` | Wave 0 |
| POLISH-META | MetaState migration adds tutorialSeen | unit | `npx vitest run tests/state/MetaMigration.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/audio/AudioManager.test.ts` -- test tone config resolution, volume scaling, mute behavior (mock AudioContext)
- [ ] `tests/ui/StyleConstants.test.ts` -- test that all color/font/layout constants are defined
- [ ] `tests/systems/GameSpeed.test.ts` -- test that tick receives multiplied delta
- [ ] `tests/state/MetaMigration.test.ts` -- test MetaState v2->v3 migration adds tutorialSeen, audioPrefs

*(AudioContext cannot be fully tested in Node/vitest -- mock the Web Audio API. Test the tone config resolution and gain calculations, not actual audio output.)*

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- AudioManager.ts, TutorialScene.ts, SettingsScene.ts, MetaState.ts, all 29 scene files
- **Phaser 3 Camera API** -- fadeIn/fadeOut are stable Phaser 3.x built-in methods
- **Web Audio API** -- W3C specification, supported in all modern browsers

### Secondary (MEDIUM confidence)
- **Phaser scene transition patterns** -- standard community practice for scene.start with camera fades

### Tertiary (LOW confidence)
- None -- all research is based on codebase inspection and well-established browser APIs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all tools already in project
- Architecture: HIGH -- clear integration points identified in existing code
- Pitfalls: HIGH -- AudioContext autoplay policy and scene race conditions are well-documented browser behaviors
- Code examples: HIGH -- derived directly from existing codebase patterns

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable -- no fast-moving dependencies)
