import sys
from PIL import Image

frames_paths = sys.argv[1:-1]
out_path = sys.argv[-1]

frames = [Image.open(p).convert("RGBA") for p in frames_paths]
fw, fh = frames[0].size
sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (i * fw, 0))
sheet.save(out_path)
print(f"Spritesheet: {fw * len(frames)}x{fh} -> {out_path}")
