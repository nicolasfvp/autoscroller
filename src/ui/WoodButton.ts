// WoodButton — themed button. Uses pre-rendered dark/gold image assets when
// available (label → btn_* texture key), falling back to wood-texture + text
// overlay for any label without a matching asset.

import Phaser from 'phaser';
import { FONTS } from './StyleConstants';
import { getLocale } from '../i18n/i18n';

export type WoodButtonVariant = 'normal' | 'primary' | 'danger';

/** pt-BR labels. The pre-rendered button art has English text baked in, so in
 *  pt-BR we skip the image and render the wood-texture + translated-text path.
 *  Keyed by the exact English label callers pass. */
const LABEL_PT: Record<string, string> = {
  'Resume': 'Continuar',
  'View Deck': 'Ver Baralho',
  'Settings': 'Configurações',
  'Tutorial': 'Tutorial',
  'Abandon Run': 'Abandonar Jornada',
  '← Back': '← Voltar',
  '← Leave': '← Sair',
  '← Cancel': '← Cancelar',
  'Close': 'Fechar',
  'Keep My Run': 'Manter Jornada',
  'Keep': 'Manter',
  'Banish': 'Banir',
  'Return to Menu': 'Voltar ao Menu',
  'Return to City': 'Voltar à Cidade',
  'Change Hero': 'Trocar Herói',
  '▶ Start Run': '▶ Iniciar Jornada',
  '✕ Cancel': '✕ Cancelar',
  'Start Game': 'Iniciar Jogo',
  '→ Visit the Shop': '→ Visitar a Loja',
  'Delete Current Run': 'Apagar Jornada Atual',
  'Reset All Progress': 'Apagar Todo o Progresso',
  'Yes, Delete': 'Sim, Apagar',
  'New Game': 'Novo Jogo',
  'Continue Run': 'Continuar Jornada',
  'Daily Run': 'Desafio Diário',
};

/** Translate a button label for the active locale (identity in English). */
function locLabel(label: string): string {
  return getLocale() === 'pt-br' ? (LABEL_PT[label] ?? label) : label;
}

/** Maps button label text to the pre-rendered image texture key. */
const LABEL_TO_KEY: Record<string, string> = {
  'Resume':              'btn_resume',
  'View Deck':           'btn_view_deck',
  'Settings':            'btn_settings',
  'Tutorial':            'btn_tutorial',
  'Abandon Run':         'btn_abandon_run',
  '← Back':             'btn_back',
  '← Leave':            'btn_leave',
  '← Cancel':           'btn_cancel',
  'Close':               'btn_close',
  'Keep My Run':         'btn_keep_my_run',
  'Keep':                'btn_keep',
  'Banish':              'btn_banish',
  'Return to Menu':      'btn_return_to_menu',
  'Return to City':      'btn_return_to_menu',
  'Change Hero':         'btn_change_hero',
  '▶ Start Run':        'btn_start_run',
  '✕ Cancel':           'btn_cancel',
  'Start Game':          'btn_start_game',
  '→ Visit the Shop':   'btn_visit_shop',
  'Delete Current Run':  'btn_delete_run',
  'Reset All Progress':  'btn_reset_progress',
  'Yes, Delete':         'btn_yes_delete',
  'New Game':            'btn_new_game',
  'Continue Run':        'btn_continue_run',
  'Daily Run':           'btn_daily_run',
};

const VARIANT_TEXT: Record<WoodButtonVariant, string> = {
  normal: '#f0d080',
  primary: '#ffe66d',
  danger: '#ffd0c0',
};

export interface WoodButtonOpts {
  width?: number;
  height?: number;
  fontSize?: number;
  variant?: WoodButtonVariant;
}

export interface WoodButtonHandle {
  container: Phaser.GameObjects.Container;
  setText(text: string): void;
  setVariant(variant: WoodButtonVariant): void;
  setEnabled(enabled: boolean): void;
  destroy(): void;
}

/**
 * Create an image-based button using a pre-rendered texture.
 * Falls back to a styled text button if the texture doesn't exist.
 */
export function createImageButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 240,
  _height = 56,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const imageKey = LABEL_TO_KEY[label];
  // In pt-BR the baked image has English text — fall back to the wood+text path.
  const hasImage = getLocale() !== 'pt-br' && !!imageKey && scene.textures.exists(imageKey);

  if (hasImage) {
    const img = scene.add.image(0, 0, imageKey);
    const s = width / img.width;
    img.setScale(s);
    const hit = scene.add.rectangle(0, 0, img.displayWidth, img.displayHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add([img, hit]);
    hit.on('pointerover', () => { container.setScale(1.05); img.setAlpha(0.9); });
    hit.on('pointerout',  () => { container.setScale(1);    img.setAlpha(1);   });
    hit.on('pointerdown', () => container.setScale(0.96));
    hit.on('pointerup',   () => { container.setScale(1.05); onClick(); });
  } else {
    const btn = scene.add.text(0, 0, locLabel(label), {
      fontSize: '22px', fontStyle: 'bold',
      color: '#f0d080', fontFamily: FONTS.body,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => { btn.setColor('#ffe9a0'); container.setScale(1.05); });
    btn.on('pointerout',  () => { btn.setColor('#f0d080'); container.setScale(1.0);  });
    btn.on('pointerdown', () => onClick());
    container.add(btn);
  }

  return container;
}

export function createWoodButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: WoodButtonOpts = {},
): WoodButtonHandle {
  const width = opts.width ?? 240;
  const height = opts.height ?? 56;
  const fontSize = opts.fontSize ?? 22;
  let variant: WoodButtonVariant = opts.variant ?? 'normal';
  let enabled = true;

  const container = scene.add.container(x, y);

  const hit = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true });

  // Use pre-rendered image if available for this label. In pt-BR the baked art
  // carries English text, so fall back to the wood-texture + translated text.
  const imageKey = LABEL_TO_KEY[label];
  const usePrerendered = getLocale() !== 'pt-br' && !!imageKey && scene.textures.exists(imageKey);

  let bgImage: Phaser.GameObjects.Image | null = null;
  let bgRect: Phaser.GameObjects.Rectangle | null = null;
  let trim: Phaser.GameObjects.Rectangle | null = null;

  if (usePrerendered) {
    bgImage = scene.add.image(0, 0, imageKey);
    bgImage.setScale(width / bgImage.width);
  } else {
    // Fallback: wood texture + gold trim + text
    if (scene.textures.exists('wood_texture')) {
      bgImage = scene.add.image(0, 0, 'wood_texture').setDisplaySize(width, height);
      if (variant === 'danger') bgImage.setTint(0xff8866);
      else if (variant === 'primary') bgImage.setTint(0xffd680);
    } else {
      bgRect = scene.add.rectangle(0, 0, width, height, 0x2a1a0a);
    }
    trim = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setStrokeStyle(2, 0xd4a04a, 0.95);
  }

  // Text only shown when no pre-rendered image (image already has text baked in)
  const text = scene.add.text(0, 0, locLabel(label), {
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color: VARIANT_TEXT[variant],
    fontFamily: FONTS.body,
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setShadow(2, 2, '#000', 3, true, true)
    .setVisible(!usePrerendered);

  const children: Phaser.GameObjects.GameObject[] = [
    bgImage ?? bgRect!,
    ...(trim ? [trim] : []),
    hit,
    text,
  ];
  container.add(children);

  hit.on('pointerover', () => {
    if (!enabled) return;
    container.setScale(1.04);
    if (usePrerendered && bgImage) bgImage.setAlpha(0.9);
    else if (bgImage) bgImage.setTint(0xffffee);
  });
  hit.on('pointerout', () => {
    container.setScale(1.0);
    if (bgImage) { bgImage.setAlpha(1); if (!usePrerendered && variant !== 'danger') bgImage.clearTint(); }
  });
  hit.on('pointerdown', () => {
    if (!enabled) return;
    container.setScale(0.96);
  });
  hit.on('pointerup', () => {
    if (!enabled) return;
    container.setScale(1.04);
    onClick();
  });

  return {
    container,
    setText: (s: string) => { if (!usePrerendered) text.setText(locLabel(s)); },
    setVariant: (v: WoodButtonVariant) => {
      variant = v;
      if (!usePrerendered) {
        text.setColor(VARIANT_TEXT[v]);
        if (bgImage) {
          if (v === 'danger') bgImage.setTint(0xff8866);
          else if (v === 'primary') bgImage.setTint(0xffd680);
          else bgImage.clearTint();
        }
      }
    },
    setEnabled: (e: boolean) => {
      enabled = e;
      container.setAlpha(e ? 1 : 0.5);
    },
    destroy: () => container.destroy(true),
  };
}
