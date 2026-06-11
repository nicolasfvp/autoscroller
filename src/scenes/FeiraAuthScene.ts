// FeiraAuthScene — tela de login da Feira de Jogos.
//
// Fluxo: o jogador derrota um boss -> GameScene pausa e lança ESTA cena ->
// o jogador entra com o Google e recebe 300 tijolinhos -> seguimos para a
// BossExitScene (continue/exit). O botão oficial "Entrar com Google" é um
// elemento HTML sobreposto ao canvas (Phaser DOM está habilitado no jogo).

import { Scene } from 'phaser';
import { FONTS, LAYOUT, COLORS } from '../ui/StyleConstants';
import { SCENE_KEYS } from '../state/SceneKeys';
import {
  isFeiraAuthAvailable,
  initFeiraAuth,
  renderFeiraButton,
  creditTijolinhos,
} from '../integrations/FeiraDeJogos';
import type { LoopRunner, LoopRunState } from '../systems/LoopRunner';

const CX = LAYOUT.centerX;
const TIJOLINHOS = 300;
const BTN_WIDTH = 240;

interface FeiraAuthData {
  loopRunner: LoopRunner;
  loopRunState: LoopRunState;
}

export class FeiraAuthScene extends Scene {
  private bossExitData!: FeiraAuthData;
  private proceeded = false;
  private statusText!: Phaser.GameObjects.Text;
  private buttonHost?: HTMLDivElement;

  constructor() {
    super(SCENE_KEYS.FEIRA_AUTH);
  }

  create(data: FeiraAuthData): void {
    this.bossExitData = data;
    this.proceeded = false;
    this.scene.bringToTop();
    this.cameras.main.fadeIn(LAYOUT.fadeDuration, 0, 0, 0);

    const font = FONTS.family;

    // Fundo escuro cobrindo a tela.
    this.add.rectangle(CX, LAYOUT.centerY, LAYOUT.canvasWidth, LAYOUT.canvasHeight, 0x000000, 0.94)
      .setDepth(0);

    this.add.text(CX, 150, 'BOSS DERROTADO!', {
      fontSize: '40px', color: COLORS.accent, fontFamily: font,
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1);

    this.add.text(CX, 210, 'Entre com sua conta Google para receber', {
      fontSize: '18px', color: COLORS.textPrimary, fontFamily: font,
    }).setOrigin(0.5).setDepth(1);

    this.add.text(CX, 245, `${TIJOLINHOS} tijolinhos`, {
      fontSize: '28px', color: '#66ff88', fontFamily: font,
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1);

    // Linha de status (preenchida durante/após o envio do crédito).
    this.statusText = this.add.text(CX, 410, '', {
      fontSize: '18px', color: COLORS.textSecondary, fontFamily: font, align: 'center',
    }).setOrigin(0.5).setDepth(1);

    // Botão "Pular" — segurança para não travar o jogador caso o login do
    // Google falhe ou ele não queira entrar.
    this.makeSkipButton(CX, 480, 'Pular sem receber');

    if (isFeiraAuthAvailable()) {
      this.mountGoogleButton();
    } else {
      this.statusText.setColor('#ff8888')
        .setText('Login do Google indisponível.\nUse "Pular" para continuar.');
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private mountGoogleButton(): void {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.zIndex = '1000';
    host.style.width = `${BTN_WIDTH}px`;
    host.style.display = 'flex';
    host.style.justifyContent = 'center';
    document.body.appendChild(host);
    this.buttonHost = host;
    this.positionButtonHost();
    this.scale.on('resize', this.positionButtonHost);

    initFeiraAuth((credential) => this.onCredential(credential));
    renderFeiraButton(host, BTN_WIDTH);
  }

  /** Centraliza o botão HTML sobre o canvas (logo abaixo do meio). */
  private positionButtonHost = (): void => {
    if (!this.buttonHost) return;
    const rect = this.game.canvas.getBoundingClientRect();
    this.buttonHost.style.left = `${rect.left + rect.width / 2 - BTN_WIDTH / 2}px`;
    this.buttonHost.style.top = `${rect.top + rect.height * 0.52}px`;
  };

  private async onCredential(credential: string): Promise<void> {
    // Esconde o botão e mostra progresso.
    if (this.buttonHost) this.buttonHost.style.display = 'none';
    this.statusText.setColor(COLORS.textSecondary).setText(`Enviando ${TIJOLINHOS} tijolinhos…`);
    try {
      await creditTijolinhos(credential, TIJOLINHOS);
      this.statusText.setColor('#66ff88').setText(`✓ ${TIJOLINHOS} tijolinhos enviados!`);
    } catch (e) {
      console.error('[Feira] Erro ao creditar:', e);
      this.statusText.setColor('#ff8888').setText('Não foi possível enviar o crédito.');
    }
    // Pequena pausa para o jogador ler o resultado antes de seguir.
    this.time.delayedCall(1100, () => this.proceed());
  }

  private makeSkipButton(x: number, y: number, label: string): void {
    const bg = this.add.rectangle(x, y, 220, 38, 0x222244, 0.9)
      .setStrokeStyle(1, 0xffd700, 0.6).setDepth(1)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: '16px', color: COLORS.textSecondary, fontFamily: FONTS.family,
    }).setOrigin(0.5).setDepth(2);
    bg.on('pointerover', () => { bg.setFillStyle(0x333366, 0.9); text.setColor(COLORS.textPrimary); });
    bg.on('pointerout', () => { bg.setFillStyle(0x222244, 0.9); text.setColor(COLORS.textSecondary); });
    bg.on('pointerdown', () => this.proceed());
  }

  /** Avança para a tela de continue/exit (BossExitScene). GameScene segue pausado. */
  private proceed(): void {
    if (this.proceeded) return;
    this.proceeded = true;
    this.cleanup();
    this.cameras.main.fadeOut(LAYOUT.fadeDuration, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch(SCENE_KEYS.BOSS_EXIT, this.bossExitData);
      this.scene.stop();
    });
  }

  private cleanup(): void {
    this.scale.off('resize', this.positionButtonHost);
    if (this.buttonHost) {
      this.buttonHost.remove();
      this.buttonHost = undefined;
    }
  }
}
