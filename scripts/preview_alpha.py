"""
Diagnostico visual de PNG com transparencia.

Compoe a imagem sobre varios fundos contrastantes (magenta, branco, checkerboard)
lado a lado, para distinguir o que e REALMENTE transparente do que e preto opaco
do proprio sprite (o VSCode renderiza transparencia como preto, atrapalhando o julgamento).

Tambem imprime estatisticas: quantos pixels totalmente transparentes, opacos, semitransparentes,
e quantos pixels opacos sao "escuros" (possivel fundo preto nao removido).

Uso:
  python scripts/preview_alpha.py caminho/para/asset.png
  -> gera caminho/para/asset.preview.png
"""

import sys
import os
import numpy as np
from PIL import Image


def make_checkerboard(h, w, size=16):
    board = np.zeros((h, w, 3), dtype=np.uint8)
    for i in range(h):
        for j in range(w):
            c = 200 if ((i // size) + (j // size)) % 2 == 0 else 120
            board[i, j] = (c, c, c)
    return board


def composite(rgb, alpha, bg):
    a = (alpha[..., None].astype(np.float32)) / 255.0
    return (rgb.astype(np.float32) * a + bg.astype(np.float32) * (1 - a)).clip(0, 255).astype(np.uint8)


def main(path):
    img = Image.open(path).convert("RGBA")
    data = np.array(img)
    rgb = data[..., :3]
    alpha = data[..., 3]
    h, w = alpha.shape

    # Estatisticas
    total = h * w
    transparent = int(np.sum(alpha == 0))
    opaque = int(np.sum(alpha == 255))
    semi = int(np.sum((alpha > 0) & (alpha < 255)))
    is_dark = (rgb[..., 0].astype(int) + rgb[..., 1].astype(int) + rgb[..., 2].astype(int)) < 60
    dark_opaque = int(np.sum(is_dark & (alpha == 255)))

    print(f"Imagem: {path}  ({w}x{h})")
    print(f"  Transparente (a=0):    {transparent:>8} ({100*transparent/total:.1f}%)")
    print(f"  Opaco (a=255):         {opaque:>8} ({100*opaque/total:.1f}%)")
    print(f"  Semitransparente:      {semi:>8} ({100*semi/total:.1f}%)")
    print(f"  Opaco E escuro (<60):  {dark_opaque:>8} ({100*dark_opaque/total:.1f}%)  <- possivel fundo preto nao removido")

    # Composicoes
    magenta = np.full((h, w, 3), (255, 0, 255), dtype=np.uint8)
    white = np.full((h, w, 3), (255, 255, 255), dtype=np.uint8)
    checker = make_checkerboard(h, w)

    panels = [
        composite(rgb, alpha, magenta),
        composite(rgb, alpha, white),
        composite(rgb, alpha, checker),
    ]

    gap = 8
    out_w = w * 3 + gap * 2
    canvas = np.full((h, out_w, 3), (40, 40, 40), dtype=np.uint8)
    x = 0
    for p in panels:
        canvas[:, x:x + w] = p
        x += w + gap

    out_path = os.path.splitext(path)[0] + ".preview.png"
    Image.fromarray(canvas, "RGB").save(out_path)
    print(f"  Preview salvo: {out_path}")
    print("  (esquerda=magenta, meio=branco, direita=xadrez)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/preview_alpha.py <arquivo.png>")
        sys.exit(1)
    main(sys.argv[1])
