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
import { DeckBuilderScene } from './scenes/DeckBuilderScene'
import { CardLibraryScene } from './scenes/CardLibraryScene'
import { SpeedPanelScene } from './scenes/SpeedPanelScene'

// Responsive scaling: the game is authored in 800×600 game-space (where every
// hardcoded HUD/sprite/tile coordinate lives). We render into a 1600×1200
// backing-store (2× supersample) and let Phaser FIT downscale the canvas to
// whatever viewport the user has. Downscaling from 1600→1440 (1080p widescreen)
// is crisp; upscaling from 800→1440 (the naive FIT) blurs. The 2× supersample
// is applied via per-scene camera.setZoom(UI_SCALE) below — every game object
// stays in 800×600 coordinates, the camera just renders it 2× larger.
const GAME_W = 800;
const GAME_H = 600;
const UI_SCALE = 2;

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        parent: 'app',
        width: GAME_W * UI_SCALE,
        height: GAME_H * UI_SCALE,
        autoRound: true,
    },
    render: {
        antialias: true,
        roundPixels: true,
    },
    dom: {
        createContainer: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    // Use requestAnimationFrame (the Phaser default). The previous
    // forceSetTimeOut:true setting hurt frame pacing on every platform and
    // starved weak Intel iGPUs; modern browsers also throttle setTimeout
    // aggressively when backgrounded, so it didn't even achieve its stated
    // goal of "keep ticking when hidden". CombatScene/GameScene already
    // force 1x speed under document.hidden, so rAF throttling is harmless.
    fps: {
        target: 60
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
        DeckBuilderScene,
        CardLibraryScene,
        SpeedPanelScene
    ]
}

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

