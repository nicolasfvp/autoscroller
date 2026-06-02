import { Scene } from 'phaser';
import { loadMetaState, saveMetaState } from '../systems/MetaPersistence';
import { MetaState } from '../state/MetaState';
import { COLORS, FONTS, LAYOUT, addBitmapText } from '../ui/StyleConstants';
import { AudioManager } from '../systems/AudioManager';
import { getBuildingTierData, upgradeBuilding } from '../systems/MetaProgressionSystem';
import { playUnlockCelebration } from '../ui/UnlockCelebration';
import { SCENE_KEYS } from '../state/SceneKeys';
import { SeededRNG } from '../systems/SeededRNG';
import { createNewRun, setRun, hasActiveRun, getRun } from '../state/RunState';

const GOLD   = '#e6c88a';
const STROKE = '#2e1b0f';

// Building button positions on the map (tune to match bg_city)
interface BuildingConfig {
  key: string;
  btnKey: string;
  x: number;
  y: number;
}

const BUILDINGS: BuildingConfig[] = [
  { key: 'forge',      btnKey: 'btn_forge',    x: 150,   y: 295   },
  { key: 'library',    btnKey: 'btn_library',  x: 411.8, y:  70.6 },
  { key: 'workshop',   btnKey: 'btn_workshop', x: 570,   y: 270   },
  { key: 'shrine',     btnKey: 'btn_oracle',   x: 172,   y: 483   },
  { key: 'storehouse', btnKey: 'btn_vault',    x: 388,   y: 520   },
];

const BUILDING_LABEL: Record<string, string> = {
  forge: 'FORGE', library: 'LIBRARY', workshop: 'WORKSHOP',
  shrine: 'ORACLE', storehouse: 'VAULT',
};

const BUILDING_ASSET_NAME: Record<string, string> = {
  shrine: 'oracle',
  storehouse: 'vault',
};

export class CityHubScene extends Scene {
  private metaState!: MetaState;
  private transitioning = false;
  private dialog: Phaser.GameObjects.Container | null = null;

  constructor() { super(SCENE_KEYS.CITY_HUB); }

  private fadeToScene(key: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
  }

  private startRun(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const rng = new SeededRNG();
    const existing = hasActiveRun() ? getRun() : null;
    const chosenClass = existing ? (existing.hero.className ?? 'warrior') : 'warrior';
    const customDeck = existing?.deck.active;
    const run = createNewRun(this.metaState, 1, chosenClass, rng.seed, customDeck);
    setRun(run);
    this.scene.stop();
    this.scene.start(SCENE_KEYS.RUN_TRANSITION, { seed: rng.seed, manualSeed: false });
  }

  async create(): Promise<void> {
    this.transitioning = false;
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);
    this.metaState = await loadMetaState();

    // ── Background ────────────────────────────────────────────
    this.cameras.main.setBackgroundColor(COLORS.background);
    if (this.textures.exists('bg_city')) {
      if (!this.anims.exists('bg_city_anim')) {
        this.anims.create({
          key: 'bg_city_anim',
          frames: this.anims.generateFrameNumbers('bg_city', { start: 0, end: 5 }),
          frameRate: 4, repeat: -1,
        });
      }
      const bg = this.add.sprite(400, 300, 'bg_city');
      bg.setScale(0.7, 0.85).setDepth(-10);
      bg.play('bg_city_anim');
    }

    try { AudioManager.transitionTo(this, 'town_song', { volume: 0.4, duration: 1500 }); } catch (_) { /* audio unavailable */ }

    // ── Top bar: materials ────────────────────────────────────
    this.renderMaterials();


    // ── Bottom-right: Start Run ───────────────────────────────
    if (this.textures.exists('btn_start_run_hub')) {
      const startBtn = this.add.image(801, 567, 'btn_start_run_hub')
        .setScale(119 / this.textures.get('btn_start_run_hub').getSourceImage().width)
        .setOrigin(1, 0.5)
        .setDepth(20)
        .setInteractive({ useHandCursor: true });
      startBtn.on('pointerover', () => startBtn.setTint(0xffffcc));
      startBtn.on('pointerout',  () => startBtn.clearTint());
      startBtn.on('pointerdown', () => this.startRun());
    } else {
      this.createTextButton(750, 562, 'Start Run', () => this.startRun());
    }

    // ── Building buttons ──────────────────────────────────────
    for (const cfg of BUILDINGS) {
      this.createBuildingButton(cfg);
    }
  }

  // ─── Material inventory — header horizontal no topo ──────────────
  private renderMaterials(): void {
    const MAT_ORDER = ['stone', 'bone', 'essence', 'wood', 'herbs', 'iron', 'crystal'];
    const H         = 36;      // altura do header
    const ICON_SIZE = 20;
    const CELL_W    = Math.floor(800 / MAT_ORDER.length); // ~114px por célula
    const CY        = H / 2;   // centro vertical

    // Fundo semi-transparente
    const bg = this.add.graphics().setDepth(50);
    bg.fillStyle(0x0d0906, 0.82);
    bg.fillRect(0, 0, 800, H);
    bg.lineStyle(1, 0xd4a04a, 0.55);
    bg.lineBetween(0, H, 800, H);

    MAT_ORDER.forEach((mat, i) => {
      const cx  = i * CELL_W + CELL_W / 2;
      const val = (this.metaState.materials as any)[mat] ?? 0;

      // Separador vertical (exceto antes do primeiro)
      if (i > 0) {
        bg.lineStyle(1, 0xd4a04a, 0.25);
        bg.lineBetween(i * CELL_W, 4, i * CELL_W, H - 4);
      }

      // Ícone
      if (this.textures.exists(`mat_${mat}`)) {
        const icon = this.add.image(cx - 18, CY, `mat_${mat}`);
        icon.setScale(ICON_SIZE / Math.max(icon.width, icon.height))
            .setDepth(51);
      }

      // Valor
      addBitmapText(this, cx - 4, CY, `${val}`, 13, 'gold')
        .setOrigin(0, 0.5).setDepth(51);
    });
  }

  // ─── Building button ──────────────────────────────────────────
  private createBuildingButton(cfg: BuildingConfig): void {
    const { key, btnKey, x, y } = cfg;
    const level = (this.metaState.buildings as any)[key]?.level ?? 0;

    if (!this.textures.exists(btnKey)) return;

    const btn = this.add.image(x, y, btnKey)
      .setDisplaySize(160, 46)
      .setInteractive({ useHandCursor: true })
      .setDepth(10);

    // Level badge below button
    addBitmapText(this, x, y + 18, `Lv.${level}`, 12, 'gold')
      .setOrigin(0.5, 0).setDepth(10);

    btn.on('pointerover', () => btn.setTint(0xffffcc));
    btn.on('pointerout',  () => btn.clearTint());
    btn.on('pointerdown', () => {
      if (key === 'library') {
        this.fadeToScene(SCENE_KEYS.COLLECTION);
        return;
      }
      this.showUpgradeDialog(cfg);
    });
  }

  // ─── Upgrade dialog ───────────────────────────────────────────
  private showUpgradeDialog(cfg: BuildingConfig): void {
    if (this.dialog) this.closeDialog();

    const { key } = cfg;
    const tierData = getBuildingTierData(key);
    if (!tierData) return;

    const currentLevel = (this.metaState.buildings as any)[key]?.level ?? 0;
    const maxLevel = tierData.maxLevel;
    const isMaxed = currentLevel >= maxLevel;
    const nextTier = !isMaxed ? tierData.tiers.find((t: any) => t.level === currentLevel + 1) : null;
    const cost: Record<string, number> = nextTier?.cost ?? {};

    // Check affordability per material
    const canAfford = !isMaxed && Object.entries(cost).every(
      ([mat, req]) => (this.metaState.materials[mat] ?? 0) >= (req as number)
    );

    // ── Build dialog container ────────────────────────────────
    const cx = 400, cy = 300;
    const PW      = 380;
    const imgH    = isMaxed ? 0 : Math.round((PW - 20) * 0.5);
    const SECTION_H = 46; // REQUER panel e MELHORAR button escalados pela mesma altura
    const PH = isMaxed ? 160 : imgH + 14 + SECTION_H + 24;
    const c = this.add.container(cx, cy).setDepth(100);
    this.dialog = c;

    // Backdrop (click to close)
    const backdrop = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.65)
      .setInteractive()
      .setOrigin(0.5);
    backdrop.on('pointerdown', () => this.closeDialog());
    c.add(backdrop);

    // Invisible hit-blocker — no bg rect (building image provides its own panel)
    const panelHit = this.add.rectangle(0, 0, PW, PH, 0x000000, 0)
      .setInteractive();
    c.add(panelHit);

    let yOff = -PH / 2 + 14;

    if (isMaxed) {
      yOff += 40;
      c.add(addBitmapText(this, 0, yOff, BUILDING_LABEL[key] ?? key.toUpperCase(), 20, 'blue')
        .setOrigin(0.5));
      yOff += 30;
      c.add(addBitmapText(this, 0, yOff, 'Totalmente melhorado', 15, 'white')
        .setOrigin(0.5).setTint(0x9bff9b));
    } else {
      // Pre-rendered narrative image
      const assetName = BUILDING_ASSET_NAME[key] ?? key;
      const texKey = `building_${assetName}_l${currentLevel + 1}`;
      if (this.textures.exists(texKey)) {
        const img = this.add.image(0, yOff, texKey);
        img.setScale((PW - 20) / img.width);
        img.setOrigin(0.5, 0);
        c.add(img);
        yOff += img.displayHeight + 12;
      } else {
        // Fallback: programmatic title + description
        c.add(addBitmapText(this, 0, yOff, BUILDING_LABEL[key] ?? key.toUpperCase(), 20, 'blue').setOrigin(0.5));
        yOff += 30;
        c.add(addBitmapText(this, 0, yOff, `Nivel ${currentLevel} / ${maxLevel}`, 13, 'gold').setOrigin(0.5));
        yOff += 24;
        c.add(this.add.graphics().lineStyle(1, 0xd4a04a, 0.6).lineBetween(-PW / 2 + 20, yOff, PW / 2 - 20, yOff));
        yOff += 14;
        c.add(this.add.text(0, yOff, nextTier?.description ?? '', {
          fontSize: '12px', color: GOLD, stroke: STROKE, strokeThickness: 2,
          fontFamily: FONTS.body, wordWrap: { width: PW - 36 }, align: 'center',
        }).setOrigin(0.5));
        yOff += 36;
      }

      // ── REQUER panel (left) + MELHORAR button (right) — mesma altura ──────
      const panelX = -PW / 2 + 17;

      if (this.textures.exists('label_requer')) {
        const lbl = this.add.image(panelX, yOff, 'label_requer');
        lbl.setScale(SECTION_H / lbl.height).setOrigin(0, 0);
        c.add(lbl);
      } else {
        c.add(addBitmapText(this, panelX + 8, yOff + SECTION_H / 2, 'Requer:', 11, 'blue').setOrigin(0, 0.5));
      }

      // Materiais em linha horizontal dentro do painel REQUER
      const matEntries = Object.entries(cost);
      const ICON_SIZE = 18;
      const ENTRY_W   = ICON_SIZE + 30; // ícone + número
      const matStartX = panelX + 46;   // após "REQUER:" baked
      const matY      = yOff + SECTION_H / 2;
      for (let mi = 0; mi < matEntries.length; mi++) {
        const [mat, required] = matEntries[mi];
        const have  = this.metaState.materials[mat] ?? 0;
        const color = have >= (required as number) ? 0x88dd88 : 0xff6655;
        const matX  = matStartX + mi * ENTRY_W;
        if (this.textures.exists(`mat_${mat}`)) {
          const icon = this.add.image(matX, matY, `mat_${mat}`);
          icon.setScale(ICON_SIZE / Math.max(icon.width, icon.height)).setOrigin(0.5);
          c.add(icon);
        }
        c.add(addBitmapText(this, matX + ICON_SIZE / 2 + 3, matY, `${have}/${required}`, 10, 'white')
          .setOrigin(0, 0.5).setTint(color));
      }

      // MELHORAR — à direita do painel, centrado verticalmente
      const REQUER_ASPECT = 2103 / 748;
      const panelW  = Math.round(SECTION_H * REQUER_ASPECT);
      const btnCX   = ((-PW / 2 + 10) + panelW + PW / 2) / 2 + 7;
      const btnCY   = yOff + SECTION_H / 2;
      const btnAlpha = canAfford ? 1 : 0.45;
      const btnKey   = this.textures.exists('btn_melhorar') ? 'btn_melhorar' : 'btn_sim_melhorar';
      if (this.textures.exists(btnKey)) {
        const simImg = this.add.image(btnCX, btnCY, btnKey);
        simImg.setScale(SECTION_H / simImg.height).setAlpha(btnAlpha);
        if (!canAfford) simImg.setTint(0x888888);
        c.add(simImg);
        if (canAfford) {
          simImg.setInteractive({ useHandCursor: true });
          simImg.on('pointerover', () => simImg.setTint(0xffffcc));
          simImg.on('pointerout',  () => simImg.clearTint());
          simImg.on('pointerdown', () => this.doUpgrade(key, cfg));
        }
      } else {
        const btnBg = this.add.rectangle(btnCX, btnCY, 120, 30, canAfford ? 0x4a7c2a : 0x2a2a2a, 0.92)
          .setStrokeStyle(2, canAfford ? 0x88dd44 : 0x555555).setAlpha(btnAlpha);
        const btnTxt = addBitmapText(this, btnCX, btnCY, 'MELHORAR', 11, 'white')
          .setOrigin(0.5).setAlpha(btnAlpha).setTint(canAfford ? 0xccffaa : 0x888888);
        c.add([btnBg, btnTxt]);
        if (canAfford) {
          btnBg.setInteractive({ useHandCursor: true });
          btnBg.on('pointerover', () => { btnBg.setStrokeStyle(2.5, 0xffffff); btnTxt.setTint(0xffffff); });
          btnBg.on('pointerout',  () => { btnBg.setStrokeStyle(2, 0x88dd44);   btnTxt.setTint(0xccffaa); });
          btnBg.on('pointerdown', () => this.doUpgrade(key, cfg));
        }
      }

      yOff += SECTION_H;
    }

    // x close button
    const closeBtn = addBitmapText(this, PW / 2 - 14, -PH / 2 + 14, 'X', 22, 'gold')
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setTint(0xffffff));
    closeBtn.on('pointerout',  () => closeBtn.clearTint());
    closeBtn.on('pointerdown', () => this.closeDialog());
    c.add(closeBtn);
  }

  private closeDialog(): void {
    this.dialog?.destroy(true);
    this.dialog = null;
  }

  private async doUpgrade(key: string, cfg: BuildingConfig): Promise<void> {
    const result = upgradeBuilding(key, this.metaState);
    if (!result.success || !result.updatedState) return;
    this.metaState = result.updatedState;
    await saveMetaState(this.metaState);
    if (result.newUnlocks) {
      const unlocked = [
        ...(result.newUnlocks.cards ?? []),
        ...(result.newUnlocks.relics ?? []),
        ...(result.newUnlocks.tiles ?? []),
        ...(result.newUnlocks.passives ?? []),
      ];
      for (const item of unlocked) {
        playUnlockCelebration(this, item);
      }
    }
    this.closeDialog();
    // Re-open dialog with updated state
    this.time.delayedCall(150, () => this.showUpgradeDialog(cfg));
  }

  private createTextButton(x: number, y: number, label: string, onClick: () => void): void {
    const txt = addBitmapText(this, x, y, label, 15, 'gold')
      .setOrigin(1, 1).setDepth(20).setInteractive({ useHandCursor: true });
    txt.on('pointerover', () => txt.setTint(0xffffff));
    txt.on('pointerout',  () => txt.clearTint());
    txt.on('pointerdown', onClick);
  }
}
