import { Scene } from 'phaser';

export class CombatEffects {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    screenShake(intensity: number = 5, duration: number = 200): void {
        this.scene.cameras.main.shake(duration, intensity / 1000);
    }

    flashRed(target: Phaser.GameObjects.GameObject, duration: number = 100): void {
        if (target instanceof Phaser.GameObjects.Rectangle) {
            const originalColor = target.fillColor;
            target.setFillStyle(0xff0000);
            this.scene.time.delayedCall(duration, () => {
                target.setFillStyle(originalColor);
            });
        }
    }

    floatingNumber(
        x: number,
        y: number,
        value: number,
        color: string = '#ffffff',
        prefix: string = ''
    ): void {
        const text = this.scene.add.text(x, y, `${prefix}${value}`, {
            fontSize: '24px',
            fontStyle: 'bold',
            color
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: text,
            y: y - 60,
            alpha: 0,
            duration: 1000,
            ease: 'Cubic.easeOut',
            onComplete: () => text.destroy()
        });
    }

    cardPlayAnimation(
        startX: number,
        startY: number,
        targetX: number,
        targetY: number,
        cardName: string,
        callback?: () => void
    ): void {
        const card = this.scene.add.rectangle(startX, startY, 80, 100, 0x3d3d5c);
        card.setStrokeStyle(2, 0xffffff);
        const text = this.scene.add.text(startX, startY, cardName, {
            fontSize: '12px',
            color: '#ffffff',
            wordWrap: { width: 70 }
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: [card, text],
            x: targetX,
            y: targetY,
            scale: 1.5,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: [card, text],
                    alpha: 0,
                    scale: 0,
                    duration: 200,
                    onComplete: () => {
                        card.destroy();
                        text.destroy();
                        if (callback) callback();
                    }
                });
            }
        });
    }

    damageParticles(x: number, y: number, count: number = 10): void {
        for (let i = 0; i < count; i++) {
            const particle = this.scene.add.circle(
                x,
                y,
                Math.random() * 4 + 2,
                0xff0000
            );

            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 100 + 50;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            this.scene.tweens.add({
                targets: particle,
                x: x + vx,
                y: y + vy,
                alpha: 0,
                duration: 500,
                ease: 'Cubic.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }

    healParticles(x: number, y: number, count: number = 10): void {
        for (let i = 0; i < count; i++) {
            const particle = this.scene.add.circle(
                x,
                y + Math.random() * 20,
                Math.random() * 3 + 2,
                0x00ff00
            );

            this.scene.tweens.add({
                targets: particle,
                y: y - 60,
                alpha: 0,
                duration: 800,
                delay: i * 50,
                ease: 'Cubic.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }

    armorGainEffect(x: number, y: number): void {
        const shield = this.scene.add.circle(x, y, 30, 0x4169e1, 0.5);
        shield.setStrokeStyle(3, 0x87ceeb);

        this.scene.tweens.add({
            targets: shield,
            scale: 1.5,
            alpha: 0,
            duration: 500,
            ease: 'Cubic.easeOut',
            onComplete: () => shield.destroy()
        });
    }

    pulseEffect(target: Phaser.GameObjects.GameObject, scale: number = 1.2, duration: number = 300): void {
        this.scene.tweens.add({
            targets: target,
            scaleX: scale,
            scaleY: scale,
            duration: duration / 2,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    /** Play a looping status effect spritesheet anchored at (x, y) bottom-center.
     *  Returns the sprite so the caller can destroy it when the status ends.
     *  key: 'fx_fire' */
    statusEffect(x: number, y: number, key: string, displayW: number = 200): Phaser.GameObjects.Sprite | null {
        if (!this.scene.textures.exists(key)) return null;
        const animKey = `__fx_status_${key}`;
        if (!this.scene.anims.exists(animKey)) {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1,
            });
        }
        const src = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
        const sc = displayW / (src.width / 4);
        const sprite = this.scene.add.sprite(x, y, key)
            .setScale(sc)
            .setDepth(15)
            .setAlpha(0.85)
            .setOrigin(0.5, 1);
        sprite.play(animKey);
        return sprite;
    }

    /** Play a 4-frame hit effect spritesheet centered on (x, y).
     *  key: 'fx_slash' | 'fx_stomp' | 'fx_bite' */
    enemyAttackEffect(x: number, y: number, key: string): void {
        if (!this.scene.textures.exists(key)) return;
        const animKey = `__fx_anim_${key}`;
        if (!this.scene.anims.exists(animKey)) {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
                frameRate: 14,
                repeat: 0,
            });
        }
        // Display at 50% of native height so it fits over the hero area without dominating
        const DISPLAY_H = 220;
        const src = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
        const frameW = src.width / 4;
        const sc = DISPLAY_H / src.height;
        const sprite = this.scene.add.sprite(x, y, key).setScale(sc).setDepth(20).setAlpha(0.92);
        sprite.play(animKey);
        sprite.once('animationcomplete', () => {
            this.scene.tweens.add({ targets: sprite, alpha: 0, duration: 80, onComplete: () => sprite.destroy() });
        });
        // Unused — keeps TypeScript happy about frameW
        void frameW;
    }

    auraEffect(x: number, y: number, tint: number = 0xffffff, key: string = 'fx_aura_heal'): Phaser.GameObjects.Sprite | null {
        if (!this.scene.textures.exists(key)) return null;
        const animKey = `__fx_anim_${key}`;
        if (!this.scene.anims.exists(animKey)) {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
                frameRate: 8,
                repeat: -1,
            });
        }
        const sprite = this.scene.add.sprite(x + 2, y + 111, key)
            .setScale(0.1691, 0.1691 * 0.8)
            .setDepth(9)
            .setAlpha(0.85)
            .setOrigin(0.5, 0.5)
            .setTint(tint);
        sprite.play(animKey);
        return sprite;
    }

    leafEffect(x: number, y: number): Phaser.GameObjects.Sprite | null {
        const key = 'fx_leaf_fall';
        if (!this.scene.textures.exists(key)) return null;
        const animKey = '__fx_anim_leaf_fall';
        if (!this.scene.anims.exists(animKey)) {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
                frameRate: 6,
                repeat: -1,
            });
        }
        const sprite = this.scene.add.sprite(x, y - 30, key)
            .setScale(0.55)
            .setDepth(11)
            .setAlpha(0.75)
            .setOrigin(0.5, 0.5);
        sprite.play(animKey);
        return sprite;
    }

    shieldEffect(x: number, y: number): void {
        const key = 'fx_shield_fade';
        if (!this.scene.textures.exists(key)) return;
        const animKey = '__fx_anim_shield_fade';
        if (!this.scene.anims.exists(animKey)) {
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
                frameRate: 12, // 6 frames / 500ms = mesma duração que defend (4 frames a 8fps)
                repeat: 0,
            });
        }
        const sprite = this.scene.add.sprite(x + 75, y - 8.1, key).setScale(0.1968).setDepth(15).setAlpha(0.9);
        sprite.play(animKey);
        sprite.once('animationcomplete', () => {
            // Mantém visível pelo restante da animação de defend, depois fade-out
            this.scene.time.delayedCall(1000, () => {
                this.scene.tweens.add({ targets: sprite, alpha: 0, duration: 300, onComplete: () => sprite.destroy() });
            });
        });
    }
}

export function createCombatEffects(scene: Scene): CombatEffects {
    return new CombatEffects(scene);
}
