from PIL import Image

im = Image.open(r"public\assets\scenes\card_library\book_open.png").convert("L")
W, H = im.size
px = im.load()
print("size", W, H)
sx, sy = 800.0 / W, 600.0 / H


def bright_segs(y, thr=140):
    row = [1 if px[x, y] > thr else 0 for x in range(W)]
    segs = []
    s = None
    for x, v in enumerate(row):
        if v and s is None:
            s = x
        if not v and s is not None:
            segs.append((s, x - 1))
            s = None
    if s is not None:
        segs.append((s, W - 1))
    return [(a, b) for a, b in segs if b - a > W * 0.10]


ymid = H // 2
segs = bright_segs(ymid)
print("horizontal bright segments @y=mid (img px):", segs)
print(" -> 800-space:", [(round(a * sx), round(b * sx)) for a, b in segs])
if len(segs) >= 2:
    spine = (segs[0][1] + segs[1][0]) / 2
    print("spine center img:", round(spine), "-> 800:", round(spine * sx))
if segs:
    cx = (segs[0][0] + segs[0][1]) // 2
    col = [1 if px[cx, y] > 140 else 0 for y in range(H)]
    ys = [y for y, v in enumerate(col) if v]
    print("left page vertical (img):", ys[0], ys[-1],
          "-> 600:", round(ys[0] * sy), round(ys[-1] * sy))
