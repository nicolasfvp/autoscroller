import Phaser, { Scene } from 'phaser';
import { saveTileLoop, loadTileLoop } from '../data/TileLoopPersistence';
import type { TileData } from '../data/TileData';
import { generateTileLayout, getTileConfig } from '../data/TileTypes';
import type { TileType } from '../data/TileTypes';
import { TILE_SIZE } from '../systems/LoopRunner';

export type { TileData };

export class MapManager {
    private scene: Scene;
    private tiles: Phaser.GameObjects.Rectangle[];
    private baseTiles: TileData[];
    private tileSize: number = TILE_SIZE;
    private currentX: number = 0;
    private loopLength: number = 20;

    constructor(scene: Scene, _generation: number = 1) {
        this.scene = scene;
        this.tiles = [];
        this.baseTiles = [];
        this.loadOrInitializeBaseTiles();
        this.expandTrack();
    }

    private loadOrInitializeBaseTiles() {
        const persisted = loadTileLoop();
        if (persisted && persisted.length === this.loopLength) {
            this.baseTiles.push(...persisted.map((t) => ({ ...t })));
        } else {
            this.initializeBaseTiles();
        }
    }

    private initializeBaseTiles() {
        const layout = generateTileLayout(this.loopLength);
        this.baseTiles = layout.tiles.map((type, index) => {
            const config = getTileConfig(type);
            return {
                type,
                color: index % 2 === 0 && type === 'basic' ? 0x666666 : 
                       type === 'basic' ? 0x888888 : 
                       config.color,
                isDefeated: false
            };
        });
    }

    private expandTrack() {
        const tilesToGenerate = 10;
        for (let i = 0; i < tilesToGenerate; i++) {
            const globalIndex = Math.floor(this.currentX / this.tileSize);
            const loopIndex = globalIndex % this.loopLength;
            const data = this.baseTiles[loopIndex];

            const x = this.currentX + (this.tileSize / 2);
            const y = 450;

            const tile = this.scene.add.rectangle(x, y, this.tileSize, this.tileSize, data.color);

            // Interaction for testing
            tile.setInteractive();
            tile.on('pointerdown', () => this.onTileClick(globalIndex));

            this.tiles.push(tile);
            this.currentX += this.tileSize;
        }
    }

    private onTileClick(globalIndex: number) {
        const loopIndex = globalIndex % this.loopLength;
        const data = this.baseTiles[loopIndex];
        
        // Emit event to Game scene to handle tile placement UI
        this.scene.events.emit('tile-clicked', { loopIndex, globalIndex, currentType: data.type });
    }

    public placeTile(loopIndex: number, tileType: TileType): void {
        const data = this.baseTiles[loopIndex];
        const config = getTileConfig(tileType);
        
        data.type = tileType;
        data.color = config.color;
        data.isDefeated = false; // Reset tile defeat status when placing
        
        // Update all visual tiles for this position
        this.tiles.forEach((tile) => {
            const tileLoopIndex = (Math.floor(tile.x / this.tileSize)) % this.loopLength;
            if (tileLoopIndex === loopIndex) {
                tile.setFillStyle(data.color);
            }
        });
        
        this.persistTileLoop();
        console.log(`Placed ${tileType} tile at position ${loopIndex}`);
    }

    public updateLoopEndTile(currentLoop: number): void {
        const lastTileIndex = this.loopLength - 1;
        // Mark all tiles as not defeated at the start of a new loop
        this.baseTiles.forEach((tile) => {
            tile.isDefeated = false;
        });
        const data = this.baseTiles[lastTileIndex];
        
        if (currentLoop >= 100) {
            // Loop 100: Boss tile
            data.type = 'boss';
            data.color = getTileConfig('boss').color;
        } else {
            // Loops 1-99: Escalating combat
            data.type = 'combat';
            const intensity = Math.min(255, 136 + Math.floor(currentLoop * 1.2));
            data.color = (intensity << 16) | 0x0000; // RGB: (intensity, 0, 0)
        }
        
        // Update visual tiles
        this.tiles.forEach((tile) => {
            const tileLoopIndex = (Math.floor(tile.x / this.tileSize)) % this.loopLength;
            if (tileLoopIndex === lastTileIndex) {
                tile.setFillStyle(data.color);
            }
        });
    }

    public getCurrentLoop(playerX: number): number {
        return Math.floor(playerX / (this.loopLength * this.tileSize));
    }

    public persistTileLoop(): void {
        saveTileLoop(this.baseTiles);
    }

    public getTileDataAt(x: number): TileData | null {
        const globalIndex = Math.floor(x / this.tileSize);
        if (x < 0) return null; // Logic check
        const loopIndex = globalIndex % this.loopLength;
        return this.baseTiles[loopIndex];
    }

    public update(playerX: number) {
        // Generate new tiles ahead of the player
        if (playerX + 1000 > this.currentX) {
            this.expandTrack();
        }

        // Remove old tiles behind the player
        const cleanupThreshold = playerX - 1000;
        if (this.tiles.length > 0 && this.tiles[0].x < cleanupThreshold) {
            while (this.tiles.length > 0 && this.tiles[0].x < cleanupThreshold) {
                const tile = this.tiles.shift();
                tile?.destroy();
            }
        }
    }
}
