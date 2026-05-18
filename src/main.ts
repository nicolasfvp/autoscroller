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

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'app',
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
    // Keep the loop alive when the tab is backgrounded. Browsers still throttle
    // setTimeout to ~1Hz, but the game's delta-based ticking advances wall-clock
    // state correctly; CombatScene/GameScene force 1x speed while hidden.
    fps: {
        forceSetTimeOut: true,
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

new Phaser.Game(config)
