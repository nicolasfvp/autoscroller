import './style.css'
import Phaser from 'phaser'
import { Boot } from './scenes/Boot'
import { Preloader } from './scenes/Preloader'
import { MainMenu } from './scenes/MainMenu'
import { TutorialScene } from './scenes/TutorialScene'
import { Game } from './scenes/Game'
import { CombatScene } from './scenes/CombatScene'
import { RewardScene } from './scenes/RewardScene'
import { ShopScene } from './scenes/ShopScene'
import { RestScene } from './scenes/RestScene'
import { EventScene } from './scenes/EventScene'
import { PauseScene } from './scenes/PauseScene'
import { SettingsScene } from './scenes/SettingsScene'
import { GameOverScene } from './scenes/GameOverScene'
import { DeckCustomizationScene } from './scenes/DeckCustomizationScene'
import { RelicViewerScene } from './scenes/RelicViewerScene'
import { SelectionScene } from './scenes/SelectionScene'
import { DeathScene } from './scenes/DeathScene'
import { PostCombatScene } from './scenes/PostCombatScene'
import { DeckViewScene } from './scenes/DeckViewScene'
import { ShopDeckEditor } from './scenes/ShopDeckEditor'
import { GameScene } from './scenes/GameScene'
import { PlanningOverlay } from './scenes/PlanningOverlay'
import { RestSiteScene } from './scenes/RestSiteScene'
import { TreasureScene } from './scenes/TreasureScene'
import { BossExitScene } from './scenes/BossExitScene'

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'app',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        TutorialScene,
        Game,
        GameScene,
        CombatScene,
        RewardScene,
        ShopScene,
        RestScene,
        RestSiteScene,
        EventScene,
        PauseScene,
        SettingsScene,
        GameOverScene,
        DeckCustomizationScene,
        RelicViewerScene,
        SelectionScene,
        DeathScene,
        PostCombatScene,
        DeckViewScene,
        ShopDeckEditor,
        PlanningOverlay,
        TreasureScene,
        BossExitScene
    ]
}

new Phaser.Game(config)
