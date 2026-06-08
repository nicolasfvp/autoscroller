"""
Remove bordas brancas (white fringe) e artefatos semitransparentes de PNGs com fundo transparente.

Estratégia:
1. Detecta pixels semitransparentes na borda da imagem
2. Flood-fill para marcar todos os pixels semitransparentes conectados à borda
3. Remove esses pixels (zera alpha) — elimina sombras/fringes de remoção de background
3b. Remove halo ESCURO residual (sangramento de fundo preto): pixels
    semitransparentes + escuros + na borda. NUNCA toca pixels opacos, preservando
    o contorno preto legítimo do sprite.
4. Aplica interpolação de RGB para pixels semi-transparentes restantes

Uso:
  python scripts/fix_white_fringe.py caminho/para/asset.png
  python scripts/fix_white_fringe.py caminho/para/pasta/
"""

import sys
import os
import shutil
import numpy as np
from PIL import Image
from collections import deque


def flood_fill_fringe(alpha: np.ndarray) -> np.ndarray:
    """
    Identifica e marca pixels semitransparentes conectados à borda da imagem.
    Retorna máscara booleana onde True = pixel deve ter alpha zerado.

    Estratégia:
    1. Marca todos os pixels semitransparentes na borda (primeira/última linha/coluna)
    2. Flood-fill para propagar para vizinhos semitransparentes conectados
    3. Retorna máscara de "pixels a remover"
    """
    h, w = alpha.shape
    to_remove = np.zeros((h, w), dtype=bool)

    # Step 1: Marcar pixels semitransparentes na borda
    semi_transparent = (alpha > 0) & (alpha < 255)

    border_candidates = np.zeros((h, w), dtype=bool)
    # Primeira e última linha
    border_candidates[0, :] = semi_transparent[0, :]
    border_candidates[-1, :] = semi_transparent[-1, :]
    # Primeira e última coluna
    border_candidates[:, 0] = semi_transparent[:, 0]
    border_candidates[:, -1] = semi_transparent[:, -1]

    # Step 2: Flood-fill a partir dos pixels da borda
    queue = deque()
    for i in range(h):
        for j in range(w):
            if border_candidates[i, j]:
                queue.append((i, j))
                to_remove[i, j] = True

    visited = np.copy(to_remove)

    while queue:
        y, x = queue.popleft()

        # Verifica vizinhos (4-connectivity)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx

            # Dentro dos limites
            if 0 <= ny < h and 0 <= nx < w:
                # Se é semitransparente e não foi visitado, marca para remoção
                if semi_transparent[ny, nx] and not visited[ny, nx]:
                    to_remove[ny, nx] = True
                    visited[ny, nx] = True
                    queue.append((ny, nx))

    return to_remove


def dilate(mask: np.ndarray, iterations: int) -> np.ndarray:
    """Dilatacao binaria 4-connectivity em numpy puro."""
    out = mask.copy()
    for _ in range(iterations):
        p = np.pad(out, 1, mode='constant', constant_values=False)
        out = (p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1]
               | p[1:-1, :-2] | p[1:-1, 2:])
    return out


def dark_halo_mask(rgb: np.ndarray, alpha: np.ndarray,
                   edge_width: int = 3, alpha_max: int = 200,
                   lum_max: float = 60.0) -> np.ndarray:
    """
    Identifica o halo ESCURO residual de remocao de fundo preto:
    pixels semitransparentes (alpha < alpha_max), escuros (luminancia < lum_max)
    e localizados no anel de borda do sprite.

    Crucial: nunca toca pixels OPACOS (alpha >= alpha_max) — isso preserva o
    contorno preto legitimo do sprite. Tambem restringe a borda para preservar
    detalhes translucidos escuros do interior.
    """
    lum = rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114
    present = alpha > 8
    transparent = ~present
    near_edge = present & dilate(transparent, edge_width)
    return near_edge & (alpha > 0) & (alpha < alpha_max) & (lum < lum_max)


def fix_fringe(path: str, iterations: int = 2, remove_border_artifacts: bool = True,
               remove_dark_halo: bool = True) -> None:
    img = Image.open(path).convert("RGBA")
    data = np.array(img, dtype=np.float32)

    r, g, b, a = data[..., 0].copy(), data[..., 1].copy(), data[..., 2].copy(), data[..., 3].copy()

    # Step 3: Remove artefatos semitransparentes da borda
    if remove_border_artifacts:
        to_remove = flood_fill_fringe(a.astype(np.uint8))
        a = np.where(to_remove, 0, a)

    # Step 3b: Remove halo ESCURO residual (sangramento de fundo preto)
    # Apenas pixels semitransparentes + escuros + na borda. Nunca opacos.
    if remove_dark_halo:
        rgb_u8 = np.stack([r, g, b], axis=-1).astype(np.uint8)
        halo = dark_halo_mask(rgb_u8, a.astype(np.uint8))
        a = np.where(halo, 0, a)

    # Step 4: Aplicar interpolação de RGB para pixels semi-transparentes restantes
    for _ in range(iterations):
        opaque = (a == 255).astype(np.float32)

        padded_r = np.pad(r, 1, mode='edge')
        padded_g = np.pad(g, 1, mode='edge')
        padded_b = np.pad(b, 1, mode='edge')
        padded_op = np.pad(opaque, 1, mode='constant', constant_values=0)

        neighbor_r = np.zeros_like(r)
        neighbor_g = np.zeros_like(g)
        neighbor_b = np.zeros_like(b)
        neighbor_w = np.zeros_like(r)

        for dy in range(3):
            for dx in range(3):
                if dy == 1 and dx == 1:
                    continue
                w = padded_op[dy:dy + r.shape[0], dx:dx + r.shape[1]]
                neighbor_r += padded_r[dy:dy + r.shape[0], dx:dx + r.shape[1]] * w
                neighbor_g += padded_g[dy:dy + r.shape[0], dx:dx + r.shape[1]] * w
                neighbor_b += padded_b[dy:dy + r.shape[0], dx:dx + r.shape[1]] * w
                neighbor_w += w

        has_opaque_neighbor = neighbor_w > 0
        safe_w = np.where(has_opaque_neighbor, neighbor_w, 1)

        # Só toca pixels semi-transparentes que têm pelo menos 1 vizinho opaco
        semi = (a > 0) & (a < 255) & has_opaque_neighbor
        r = np.where(semi, neighbor_r / safe_w, r)
        g = np.where(semi, neighbor_g / safe_w, g)
        b = np.where(semi, neighbor_b / safe_w, b)

        # Zera RGB de pixels 100% invisíveis (remove cor residual indetectável)
        invisible = (a == 0)
        r = np.where(invisible, 0, r)
        g = np.where(invisible, 0, g)
        b = np.where(invisible, 0, b)

    result = np.stack([r, g, b, a], axis=-1).clip(0, 255).astype(np.uint8)
    out = Image.fromarray(result, "RGBA")

    backup = path + ".bak"
    shutil.copy2(path, backup)
    out.save(path)
    os.remove(backup)
    print(f"  OK: {path}")


def process(target: str) -> None:
    if os.path.isdir(target):
        paths = [
            os.path.join(root, f)
            for root, _, files in os.walk(target)
            for f in files if f.lower().endswith(".png")
        ]
        print(f"Processando {len(paths)} PNG(s) em {target}")
    else:
        paths = [target]

    for p in paths:
        try:
            fix_fringe(p)
        except Exception as e:
            print(f"  ERRO {p}: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python fix_white_fringe.py <arquivo.png ou pasta/>")
        sys.exit(1)
    process(sys.argv[1])
