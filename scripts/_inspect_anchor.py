from PIL import Image
import numpy as np

FRAMES = [
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/acast_debuff_1.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/acast_debuff_2.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/acast_debuff_3.png",
]

DARK = 80
ALPHA = 128

for path in FRAMES:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)

    opaque = arr[:,:,3] > ALPHA
    dark = (arr[:,:,0] < DARK) & (arr[:,:,1] < DARK) & (arr[:,:,2] < DARK) & opaque

    rows = np.where(np.any(opaque, axis=1))[0]
    top = int(rows[0])
    bottom = int(rows[-1])

    # Zona 0: topo (espada) — primeiras 150 linhas do personagem
    z0_dark = dark[top:top+150, :]
    ys0, xs0 = np.where(z0_dark)
    # Pega a coluna mais frequente (moda) na zona da espada
    if len(xs0) > 0:
        unique, counts = np.unique(xs0, return_counts=True)
        mode_x = unique[np.argmax(counts)]
        # Filtra apenas pixels próximos da moda (±5px) — exclui ruído
        xs0_clean = xs0[np.abs(xs0 - mode_x) <= 5]
        ys0_clean = ys0[np.abs(xs0 - mode_x) <= 5]
        mean_x = float(xs0_clean.mean()) if len(xs0_clean) > 0 else float(xs0.mean())
        mean_y = float(ys0_clean.mean()) + top if len(ys0_clean) > 0 else float(ys0.mean()) + top
    else:
        mean_x, mean_y = 0, 0

    print(f"{path.split('/')[-1]}:  top={top}  bottom={bottom}  espada_x={mean_x:.2f}  espada_y={mean_y:.2f}  npx={len(xs0)}")
