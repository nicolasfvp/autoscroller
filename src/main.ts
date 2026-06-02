/// <reference types="vite/client" />
import './style.css'
import Phaser from 'phaser'
import { Boot } from './scenes/Boot'
import { Preloader } from './scenes/Preloader'
import { MainMenu } from './scenes/MainMenu'
import { TutorialScene } from './scenes/TutorialScene'
import { CombatScene } from './scenes/CombatScene'
import { ShopScene } from './scenes/ShopScene'
import { ForgeScene } from './scenes/ForgeScene'
import { PauseScene } from './scenes/PauseScene'
import { SettingsScene } from './scenes/SettingsScene'
import { DeckCustomizationScene } from './scenes/DeckCustomizationScene'
import { RelicViewerScene } from './scenes/RelicViewerScene'
import { CharacterSelectScene } from './scenes/CharacterSelectScene'
import { DeathScene } from './scenes/DeathScene'
import { GameScene } from './scenes/GameScene'
import { PlanningOverlay } from './scenes/PlanningOverlay'
import { BossExitScene } from './scenes/BossExitScene'
import { CityHubScene } from './scenes/CityHubScene'
import { BuildingPanelScene } from './scenes/BuildingPanelScene'
import { TavernPanelScene } from './scenes/TavernPanelScene'
import { CollectionScene } from './scenes/CollectionScene'
import { GlobalSound } from './scenes/GlobalSound'
import { RunTransitionScene } from './scenes/RunTransitionScene'
import { LoopSummaryScene } from './scenes/LoopSummaryScene'
import { StartingDeckScene } from './scenes/StartingDeckScene'
import { CardLibraryScene } from './scenes/CardLibraryScene'
import { SpeedPanelScene } from './scenes/SpeedPanelScene'
import { DebugOverlayScene } from './scenes/DebugOverlayScene'
import { SCENE_KEYS } from './state/SceneKeys'

// Responsive scaling: the game is authored in 800×600 game-space (where every
// hardcoded HUD/sprite/tile coordinate lives). We render into a supersampled
// backing-store (UI_SCALE×) and let Phaser FIT downscale the canvas to whatever
// viewport the user has. Downscaling is crisp; upscaling from 800→1440 (the
// naive FIT) blurs.
//
// UI_SCALE is selected by the Graphics Quality setting (SettingsScene). High
// gives the sharpest result; Balanced cuts pixel fill-rate by ~44%; Performance
// renders at native 800×600 and lets the browser scale. Because Phaser locks
// the canvas backing-store size in GameConfig before any async MetaState load
// can complete, we read the preset from a localStorage mirror (synchronous,
// available at module-init time). SettingsScene writes both the localStorage
// mirror and the persisted MetaState so the next reload picks up the change.
const GAME_W = 800;
const GAME_H = 600;

const QUALITY_TO_SCALE: Record<string, number> = {
    high: 2,
    balanced: 1.5,
    performance: 1,
};
const storedQuality = (() => {
    try { return localStorage.getItem('autoscroller:gfxQuality'); }
    catch { return null; }
})();
const UI_SCALE = QUALITY_TO_SCALE[storedQuality ?? ''] ?? QUALITY_TO_SCALE.balanced;

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    disableContextMenu: true,
    banner: false,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'app',
        width: GAME_W * UI_SCALE,
        height: GAME_H * UI_SCALE,
        autoRound: true,
    },
    render: {
        pixelArt: true,
        powerPreference: 'high-performance',
        batchSize: 4096,
        // Generate and sample mipmaps for downscaled textures (the 1024×1024
        // card art renders at ~90 px in the deck library and ~150 px in-hand
        // — a >10× downscale that aliases without mipmaps). Phaser auto-
        // generates mipmaps for POT textures (1024² card art qualifies).
        mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
    },
    dom: {
        createContainer: true
    },
    // Use requestAnimationFrame (the Phaser default). The previous
    // forceSetTimeOut:true setting hurt frame pacing on every platform and
    // starved weak Intel iGPUs; modern browsers also throttle setTimeout
    // aggressively when backgrounded, so it didn't even achieve its stated
    // goal of "keep ticking when hidden". CombatScene/GameScene already
    // force 1x speed under document.hidden, so rAF throttling is harmless.
    fps: {
        target: 60,
        min: 30,
        smoothStep: true,
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        TutorialScene,
        GameScene,
        CombatScene,
        ShopScene,
        ForgeScene,
        PauseScene,
        SettingsScene,
        DeckCustomizationScene,
        RelicViewerScene,
        CharacterSelectScene,
        DeathScene,
        PlanningOverlay,
        BossExitScene,
        CityHubScene,
        BuildingPanelScene,
        TavernPanelScene,
        CollectionScene,
        GlobalSound,
        RunTransitionScene,
        LoopSummaryScene,
        StartingDeckScene,
        CardLibraryScene,
        SpeedPanelScene,
        DebugOverlayScene,
    ]
}

// Debug listener — only active in dev builds (Vite tree-shakes this in production)
if (import.meta.env.DEV) {
    class DebugListenerScene extends Phaser.Scene {
        constructor() { super({ key: 'debug-listener', active: true }); }
        create() {
            this.input.keyboard?.on('keydown-F2', () => {
                if (this.scene.isActive(SCENE_KEYS.DEBUG_OVERLAY)) {
                    this.scene.manager.scenes.forEach(s => {
                        if (s.scene.key !== 'debug-listener' && s.scene.key !== SCENE_KEYS.DEBUG_OVERLAY && s.scene.isPaused()) {
                            s.scene.resume();
                        }
                    });
                    this.scene.stop(SCENE_KEYS.DEBUG_OVERLAY);
                } else {
                    this.scene.manager.scenes.forEach(s => {
                        if (s.scene.key !== 'debug-listener' && s.scene.isActive()) {
                            s.scene.pause();
                        }
                    });
                    this.scene.launch(SCENE_KEYS.DEBUG_OVERLAY);
                }
            });
        }
    }
    (config.scene as any[]).push(DebugListenerScene);
}

// Patch Phaser.GameObjects.Text to default resolution:2 globally.
// This makes all this.add.text() calls render their internal canvas at 2×,
// eliminating the blurry text caused by low-resolution canvas upscaling.
// Any call that explicitly passes resolution overrides this default.
const _origTextFactory = Phaser.GameObjects.GameObjectFactory.prototype.text as Function;
(Phaser.GameObjects.GameObjectFactory.prototype as any).text = function (
  x: number, y: number, content: string | string[],
  style?: Phaser.Types.GameObjects.Text.TextStyle,
) {
  const patched = { resolution: 2, ...style };
  return _origTextFactory.call(this, x, y, content, patched);
};

// Pre-load VT323 so canvas text renders immediately on first frame
document.fonts.load('16px VT323').catch(() => {});

const game = new Phaser.Game(config)

// Responsive scaling — apply UI_SCALE camera zoom to every scene's main camera.
// The zoom makes 800×600 game-space render into the 1600×1200 backing-store,
// which FIT then CSS-downscales to viewport. centerOn anchors world (0,0) at
// the canvas top-left; scenes that call startFollow (e.g., GameScene) override
// the centering naturally on the next camera update, but inherit our zoom.
//
// Timing: scenes are not yet in game.scene.scenes when this file runs (Phaser
// populates that array during bootQueue on the READY event), so we defer the
// attachment. We listen for both CREATE and START so the zoom persists across
// scene restarts (e.g., Death → Main Menu → Combat).
const applyResponsiveCameras = () => {
    game.scene.scenes.forEach(scene => {
        const applyToCam = () => {
            const cam = scene.cameras?.main
            if (!cam) return
            // Anchor zoom at top-left (origin 0,0) instead of viewport center.
            // With center-origin (Phaser default), the camera matrix has a
            // center-translation that requires scrollFactor=1 objects to be
            // scroll-compensated to land in the right canvas pixels — and
            // scrollFactor=0 HUDs DON'T get that compensation, so they end up
            // off-screen at upper-left when zoom != 1. With origin (0,0) the
            // matrix is pure S(zoom): world (X,Y) → canvas (X*zoom, Y*zoom)
            // for both scroll factors. GameScene's startFollow compensates
            // explicitly in its own followOffset to keep hero framing.
            cam.setOrigin(0, 0)
            cam.setZoom(UI_SCALE)
            cam.setScroll(0, 0)
        }
        scene.events.on(Phaser.Scenes.Events.CREATE, applyToCam)
        scene.events.on(Phaser.Scenes.Events.START, applyToCam)
        applyToCam()
    })
}

// game.scene.isBooted (SceneManager) goes true at the END of bootQueue when
// scenes are populated. game.isBooted (Game) goes true much earlier during
// DOM-ready, so it's the wrong check. If the SceneManager is already booted
// when our module finishes evaluating, apply now; otherwise wait for the
// game READY event (bootQueue is also hooked to READY but registered first,
// so it runs before our listener — scenes are populated by the time we fire).
if (game.scene.isBooted) {
    applyResponsiveCameras()
} else {
    game.events.once(Phaser.Core.Events.READY, applyResponsiveCameras)
}

// Verification hook — exposes the Phaser game so an automation client can
// drive scene transitions during card-face renderer verification. Harmless
// in prod (no behavior change), but easy to remove later if undesired.
;(globalThis as any).__game = game

