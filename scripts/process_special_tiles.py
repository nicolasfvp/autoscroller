"""
BFS background removal + crop for special tile ground PNGs and landmarks.
Uses checkerboard/light-pixel flood-fill from edges, then bbox crop.
"""
import os
from PIL import Image
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def is_bg_pixel(r, g, b, a, threshold=200):
    """Light or transparent pixel = background candidate."""
    if a < 30:
        return True
    # Checkerboard pattern colors: ~192 (light) and ~160 (dark) grey
    if r > threshold and g > threshold and b > threshold:
        return True
    # Also catch the darker checkerboard squares (~160 grey)
    if 130 < r < 215 and 130 < g < 215 and 130 < b < 215 and abs(r - g) < 20 and abs(g - b) < 20:
        return True
    return False


def remove_bg_bfs(img: Image.Image, threshold=200) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()

    visited = [[False] * h for _ in range(w)]
    queue = deque()

    # Seed from all 4 edges
    for x in range(w):
        for y in [0, h - 1]:
            r, g, b, a = pixels[x, y]
            if not visited[x][y] and is_bg_pixel(r, g, b, a, threshold):
                visited[x][y] = True
                queue.append((x, y))
    for y in range(h):
        for x in [0, w - 1]:
            r, g, b, a = pixels[x, y]
            if not visited[x][y] and is_bg_pixel(r, g, b, a, threshold):
                visited[x][y] = True
                queue.append((x, y))

    while queue:
        cx, cy = queue.popleft()
        pixels[cx, cy] = (0, 0, 0, 0)
        for nx, ny in [(cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1)]:
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                r, g, b, a = pixels[nx, ny]
                if is_bg_pixel(r, g, b, a, threshold):
                    visited[nx][ny] = True
                    queue.append((nx, ny))

    return img


def crop_to_content(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img


def process(src_rel: str, dst_rel: str, threshold: int = 200):
    src = os.path.join(ROOT, src_rel)
    dst = os.path.join(ROOT, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    print(f"Processing {src_rel}...", flush=True)
    img = Image.open(src)
    img = remove_bg_bfs(img, threshold)
    img = crop_to_content(img)
    img.save(dst)
    print(f"  -> {dst_rel} ({img.size[0]}x{img.size[1]})", flush=True)


# Ground tiles (checkerboard bg — threshold 200 is fine, but also catch grey)
process(
    "comfy/tiles/special/tile_event_ground/tile_event_ground.png",
    "public/assets/map/tiles/tile_event.png",
    threshold=215,
)
process(
    "comfy/tiles/special/tile_treasure_ground/tile_treasure_ground.png",
    "public/assets/map/tiles/tile_treasure.png",
)
process(
    "comfy/tiles/special/tile_boss_ground/tile_boss_ground.png",
    "public/assets/map/tiles/tile_boss.png",
)

# Landmarks (checkerboard bg)
process(
    "comfy/tiles/special/landmark_event/landmark_event.png",
    "public/assets/map/landmarks/landmark_event.png",
)
process(
    "comfy/tiles/special/landmark_treasure/landmark_treasure.png",
    "public/assets/map/landmarks/landmark_treasure.png",
)
process(
    "comfy/tiles/special/landmark_boss/landmark_boss.png",
    "public/assets/map/landmarks/landmark_boss.png",
)

print("\nAll done!")
