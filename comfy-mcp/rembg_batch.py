import sys
import os
from rembg import remove
from PIL import Image

files = [
    ("public/assets/ui/buttons/1.png",              "comfy/ui/buttons/1/1.png"),
    ("public/assets/ui/buttons/5.png",              "comfy/ui/buttons/5/5.png"),
    ("public/assets/ui/buttons/10.png",             "comfy/ui/buttons/10/10.png"),
    ("public/assets/ui/buttons/25.png",             "comfy/ui/buttons/25/25.png"),
    ("public/assets/ui/buttons/btn_keep_my_run.png","comfy/ui/buttons/btn_keep_my_run/btn_keep_my_run.png"),
    ("public/assets/ui/buttons/keep-my-run.png",    "comfy/ui/buttons/keep-my-run/keep-my-run.png"),
]

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for src_rel, dst_rel in files:
    src = os.path.join(root, src_rel)
    dst = os.path.join(root, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    print(f"Processing {src_rel}...", flush=True)
    with open(src, "rb") as f:
        data = f.read()
    result = remove(data)
    with open(dst, "wb") as f:
        f.write(result)
    print(f"  -> {dst_rel}", flush=True)

print("Done.")
