from PIL import Image
import numpy as np

FRAMES = [
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/acast_debuff_1.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/acast_debuff_2.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/acast_debuff_3.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/acast_debuff_2.png",
]
OUT_SHEET = r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_spritesheet.png"

DARK  = 80
ALPHA = 128

def get_char_bounds(arr):
    opaque = arr[:,:,3] > ALPHA
    rows = np.where(np.any(opaque, axis=1))[0]
    return int(rows[0]), int(rows[-1])

def sword_mean_x(arr, top, scan=150):
    """Média X dos pixels escuros na zona da espada, filtrada pela moda (ignora ruído)."""
    region = arr[top:top+scan, :, :]
    opaque = region[:,:,3] > ALPHA
    dark   = (region[:,:,0] < DARK) & (region[:,:,1] < DARK) & (region[:,:,2] < DARK) & opaque
    _, xs  = np.where(dark)
    if len(xs) == 0:
        return 0.0
    unique, counts = np.unique(xs, return_counts=True)
    mode_x = unique[np.argmax(counts)]
    xs_clean = xs[np.abs(xs - mode_x) <= 5]
    return float(xs_clean.mean()) if len(xs_clean) > 0 else float(xs.mean())

imgs = [Image.open(p).convert("RGBA") for p in FRAMES]
arrs = [np.array(img) for img in imgs]

top1, _ = get_char_bounds(arrs[0])
ref_x   = sword_mean_x(arrs[0], top1)
print(f"Frame 1 — espada_x={ref_x:.2f}  top={top1}")

aligned = [imgs[0]]

for i in range(1, len(imgs)):
    top2, _ = get_char_bounds(arrs[i])
    ax = sword_mean_x(arrs[i], top2)
    dx = int(round(ref_x - ax))
    dy = int(round(top1  - top2))
    print(f"Frame {i+1} — espada_x={ax:.2f}  top={top2}  -> dx={dx} dy={dy}")

    if dx == 0 and dy == 0:
        aligned.append(imgs[i])
        continue

    w, h = imgs[i].size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(imgs[i], (dx, dy))
    aligned.append(out)

fw, fh = aligned[0].size
sheet = Image.new("RGBA", (fw * len(aligned), fh), (0, 0, 0, 0))
for i, img in enumerate(aligned):
    sheet.paste(img, (i * fw, 0))

sheet.save(OUT_SHEET)
print(f"Spritesheet salvo: {OUT_SHEET}  ({sheet.width}x{sheet.height})")
