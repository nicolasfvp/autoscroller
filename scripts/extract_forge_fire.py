"""
Extrai a animação da fornalha do spritesheet forge_background.png.

O spritesheet tem 8 frames horizontais (9344x880, cada frame 1168x880).
A crop box é definida em coordenadas relativas AO FRAME (não ao spritesheet total).
Ajuste CROP_* para enquadrar exatamente a fornalha.
"""

from PIL import Image
import os

# --- Configuração ---
INPUT  = r"c:\Users\heric\Prog\autoscroller\public\assets\buildings\backgrounds\forge_background.png"
OUTPUT = r"c:\Users\heric\Prog\autoscroller\public\assets\buildings\backgrounds\forge_fire_sheet.png"

NUM_FRAMES  = 8
FRAME_W     = 1168   # largura de cada frame (9344 / 8)
FRAME_H     = 880

# Crop relativo ao frame — ajuste aqui para enquadrar a fornalha
CROP_X      = 390    # borda esquerda da fornalha dentro do frame
CROP_Y      = 200    # borda superior
CROP_W      = 390    # largura da região da fornalha
CROP_H      = 590    # altura (até a base)

# Exportar também frames individuais para conferência (True/False)
EXPORT_INDIVIDUAL = True
INDIVIDUAL_DIR    = r"c:\Users\heric\Prog\autoscroller\comfy\forge_fire_frames"


def extract():
    src = Image.open(INPUT)
    assert src.width == FRAME_W * NUM_FRAMES, f"Largura inesperada: {src.width}"
    assert src.height == FRAME_H, f"Altura inesperada: {src.height}"

    canvas = Image.new("RGBA", (CROP_W * NUM_FRAMES, CROP_H), (0, 0, 0, 0))

    if EXPORT_INDIVIDUAL:
        os.makedirs(INDIVIDUAL_DIR, exist_ok=True)

    for i in range(NUM_FRAMES):
        # Coordenadas absolutas no spritesheet
        abs_x = FRAME_W * i + CROP_X
        abs_y = CROP_Y
        box   = (abs_x, abs_y, abs_x + CROP_W, abs_y + CROP_H)

        frame = src.crop(box).convert("RGBA")
        canvas.paste(frame, (CROP_W * i, 0))

        if EXPORT_INDIVIDUAL:
            frame_path = os.path.join(INDIVIDUAL_DIR, f"frame_{i:02d}.png")
            frame.save(frame_path)
            print(f"  frame {i}: {frame_path}")

    canvas.save(OUTPUT)
    print(f"\nSpritesheet salvo: {OUTPUT}")
    print(f"Dimensões: {canvas.width} x {canvas.height}  ({NUM_FRAMES} frames de {CROP_W}x{CROP_H})")


if __name__ == "__main__":
    extract()
