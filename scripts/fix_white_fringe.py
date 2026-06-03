"""
Remove bordas brancas (white fringe) de PNGs com fundo transparente.

Técnica cirúrgica: para cada pixel semi-transparente, substitui o RGB
pela média dos vizinhos 100% opacos. O alpha nunca é alterado.
Pixels totalmente opacos ficam intocados — sem blur, sem perda de qualidade.

Uso:
  python scripts/fix_white_fringe.py caminho/para/asset.png
  python scripts/fix_white_fringe.py caminho/para/pasta/
"""

import sys
import os
import shutil
import numpy as np
from PIL import Image


def fix_fringe(path: str, iterations: int = 2) -> None:
    img = Image.open(path).convert("RGBA")
    data = np.array(img, dtype=np.float32)

    r, g, b, a = data[..., 0].copy(), data[..., 1].copy(), data[..., 2].copy(), data[..., 3].copy()

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
