// Integração com a Feira de Jogos — credita "tijolinhos" via Google OAuth (One Tap).
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

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(cfg: {
            client_id: string;
            callback: (res: GoogleCredentialResponse) => void;
          }): void;
          prompt(): void;
        };
      };
    };
  }
}

/**
 * Autentica o jogador via Google One Tap e credita `value` tijolinhos na plataforma
 * da Feira de Jogos. Fire-and-forget: nunca lança — falhas são apenas logadas.
 */
export function creditTijolinhos(value: number): void {
  const id = window.google?.accounts?.id;
  if (!id) {
    console.warn('[Feira] Google Identity Services não carregado; crédito ignorado.');
    return;
  }

  id.initialize({
    client_id: CLIENT_ID,
    callback: (res) => {
      if (res.error || !res.credential) {
        console.error('[Feira] Falha na autenticação:', res.error);
        return;
      }
      fetch(CREDIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${res.credential}`,
        },
        body: JSON.stringify({ product: PRODUCT_ID, value }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          console.log(`[Feira] +${value} tijolinhos creditados.`);
        })
        .catch((e) => console.error('[Feira] Erro ao creditar:', e));
    },
  });

  id.prompt();
}
