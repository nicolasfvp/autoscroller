from PIL import Image
import numpy as np

def find_boot_top(img_path, bg_threshold=240, dark_threshold=80):
    img = Image.open(img_path).convert("RGB")
    arr = np.array(img)
    is_bg = (arr[:,:,0] > bg_threshold) & (arr[:,:,1] > bg_threshold) & (arr[:,:,2] > bg_threshold)
    is_char = ~is_bg
    rows_with_char = np.where(np.any(is_char, axis=1))[0]
    bottom_row = int(rows_with_char[-1])
    # Busca pixel escuro (bota) nas ultimas 60 linhas do personagem
    for row in range(max(0, bottom_row - 60), bottom_row + 1):
        cols = np.where(is_char[row])[0]
        for col in cols:
            r, g, b = arr[row, col]
            if r < dark_threshold and g < dark_threshold and b < dark_threshold:
                return row, int(col)
    return bottom_row, 0

frames = [
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_1.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_2.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_3.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_4.png",
]

# Frame 1 e referencia
ref_row, ref_col = find_boot_top(frames[0])
print(f"Referencia (frame 1): row={ref_row}, col={ref_col}")

aligned = []
for i, path in enumerate(frames):
    img = Image.open(path).convert("RGB")
    row, col = find_boot_top(path)
    dy = ref_row - row
    dx = ref_col - col
    print(f"Frame {i+1}: boot_top=({row},{col})  offset dx={dx}, dy={dy}")

    if dx == 0 and dy == 0:
        aligned.append(img.convert("RGBA") if img.mode != "RGBA" else img)
        continue

    # Aplica offset: move toda a imagem
    w, h = img.size
    out = Image.new("RGB", (w, h), (255, 255, 255))
    out.paste(img, (dx, dy))
    out_path = path.replace(".png", "_footaligned.png")
    out.save(out_path)
    print(f"  -> salvo: {out_path}")
    aligned.append(out)

# Salva frame 1 sem modificacao (apenas copia referencia)
print(f"\nFrame 1 nao alterado (e a referencia)")

# Monta spritesheet alinhado
fw, fh = aligned[0].size
sheet = Image.new("RGB", (fw * 4, fh), (255, 255, 255))
for i, img in enumerate(aligned):
    sheet.paste(img, (i * fw, 0))

out_sheet = r"C:/Users/heric/Prog/autoscroller/comfy/hero/cast_debuff/cast_debuff_spritesheet_aligned.png"
sheet.save(out_sheet)
print(f"\nSpritesheet alinhado salvo: {out_sheet}")
