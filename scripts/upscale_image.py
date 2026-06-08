#!/usr/bin/env python3
"""
Upscale uma imagem manendo a qualidade para pixel art.
Uso: python scripts/upscale_image.py <caminho_entrada> <fator_escala>
"""

import sys
from PIL import Image

def upscale_pixel_art(input_path: str, scale_factor: int = 2) -> str:
    """Upscale usando NEAREST para preservar pixel art."""
    img = Image.open(input_path)
    new_size = (img.width * scale_factor, img.height * scale_factor)

    # NEAREST preserva as bordas agudas do pixel art
    upscaled = img.resize(new_size, Image.Resampling.NEAREST)

    # Salvar com o mesmo nome + _upscaled
    base = input_path.rsplit('.', 1)[0]
    output_path = f"{base}_upscaled.png"
    upscaled.save(output_path, "PNG")

    print(f"Upscaled: {img.width}x{img.height} → {upscaled.width}x{upscaled.height}")
    print(f"Saved to: {output_path}")
    return output_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upscale_image.py <image_path> [scale_factor]")
        sys.exit(1)

    input_path = sys.argv[1]
    scale = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    upscale_pixel_art(input_path, scale)
