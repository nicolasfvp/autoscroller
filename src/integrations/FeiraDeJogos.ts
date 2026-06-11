// Integração com a Feira de Jogos — autentica o jogador via Google (OAuth) e
// credita "tijolinhos" na plataforma do evento.
// Ref.: https://github.com/tes20261/game
//
// O script do Google Identity Services é carregado em index.html
// (https://accounts.google.com/gsi/client). Aqui apenas tipamos o mínimo do global
// `google` que usamos, evitando depender de @types/google.accounts ou alterar o tsconfig.

const CLIENT_ID =
  '331191695151-ku8mdhd76pc2k36itas8lm722krn0u64.apps.googleusercontent.com';
const CREDIT_URL = 'https://feira-de-jogos.dev.br/api/v2/credit';
const PRODUCT_ID = 1; // id do jogo no banco da Feira de Jogos

interface GoogleCredentialResponse {
  credential?: string;
  error?: string;
}

/** Subconjunto da config do botão "Sign in with Google" que usamos. */
interface GsiButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number;
  locale?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(cfg: {
            client_id: string;
            callback: (res: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(parent: HTMLElement, cfg: GsiButtonConfig): void;
          prompt(): void;
          cancel(): void;
        };
      };
    };
  }
}

/** True quando o script do Google Identity Services já carregou. */
export function isFeiraAuthAvailable(): boolean {
  return !!window.google?.accounts?.id;
}

/**
 * Inicializa o fluxo de login Google. `onCredential` recebe o JWT do jogador
 * autenticado (usado como Bearer token ao creditar). Retorna false se o GSI
 * ainda não carregou. `auto_select: false` força o jogador a escolher a conta,
 * garantindo que o crédito vá para o jogador correto.
 */
export function initFeiraAuth(onCredential: (credential: string) => void): boolean {
  const id = window.google?.accounts?.id;
  if (!id) {
    console.warn('[Feira] Google Identity Services não carregado.');
    return false;
  }
  id.initialize({
    client_id: CLIENT_ID,
    auto_select: false,
    cancel_on_tap_outside: false,
    callback: (res) => {
      if (res.error || !res.credential) {
        console.error('[Feira] Falha na autenticação:', res.error);
        return;
      }
      onCredential(res.credential);
    },
  });
  return true;
}

/** Renderiza o botão oficial "Entrar com Google" dentro de `parent`. */
export function renderFeiraButton(parent: HTMLElement, width = 240): void {
  window.google?.accounts?.id.renderButton(parent, {
    type: 'standard',
    theme: 'filled_blue',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    logo_alignment: 'left',
    width,
  });
}

/**
 * Credita `value` tijolinhos para o jogador autenticado (identificado por
 * `credential`). Lança em caso de erro HTTP — o chamador decide como tratar.
 */
export async function creditTijolinhos(credential: string, value: number): Promise<void> {
  const res = await fetch(CREDIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credential}`,
    },
    body: JSON.stringify({ product: PRODUCT_ID, value }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  console.log(`[Feira] +${value} tijolinhos creditados.`);
}
