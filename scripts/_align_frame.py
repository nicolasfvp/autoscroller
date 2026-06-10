from PIL import Image
import numpy as np
import sys

ref_path = sys.argv[1]
src_path = sys.argv[2]
out_path = sys.argv[3]

ref = Image.open(ref_path).convert("RGBA")
src = Image.open(src_path).convert("RGBA")

def get_character_bbox(img, bg_threshold=240):
    arr = np.array(img)
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    is_bg = (r > bg_threshold) & (g > bg_threshold) & (b > bg_threshold)
    is_char = ~is_bg
    rows = np.any(is_char, axis=1)
    cols = np.any(is_char, axis=0)
    rmin, rmax = np.where(rows)[0][[0,-1]]
    cmin, cmax = np.where(cols)[0][[0,-1]]
    return int(cmin), int(rmin), int(cmax), int(rmax)

b1 = get_character_bbox(ref)
b2 = get_character_bbox(src)

cx1 = (b1[0] + b1[2]) // 2
cx2 = (b2[0] + b2[2]) // 2

# So horizontal — body does not move vertically in static animations
dx = cx1 - cx2
dy = 0

print(f"Ref  bbox: {b1}, centerX: {cx1}")
print(f"Src  bbox: {b2}, centerX: {cx2}")
print(f"Ajuste: dx={dx}, dy={dy}")

w, h = src.size
out = Image.new("RGBA", (w, h), (255, 255, 255, 255))
out.paste(src, (dx, dy))
out.save(out_path)
print(f"Salvo: {out_path}")
