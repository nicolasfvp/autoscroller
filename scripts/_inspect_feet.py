from PIL import Image
import numpy as np

paths = [
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_1.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_2.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_3.png",
    r"C:/Users/heric/Prog/autoscroller/public/assets/characters/hero/cast_debuff/cast_debuff_4.png",
]

for path in paths:
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    h, w = arr.shape[:2]

    # Fundo branco = RGB > 240 em todos os canais
    is_bg = (arr[:,:,0] > 240) & (arr[:,:,1] > 240) & (arr[:,:,2] > 240)
    is_char = ~is_bg

    # Linha mais baixa com pixel de personagem
    rows_with_char = np.where(np.any(is_char, axis=1))[0]
    bottom_row = int(rows_with_char[-1])

    # Nessa linha, pega pixels do personagem e mostra cores
    char_cols = np.where(is_char[bottom_row])[0]
    sample_pixels = [(int(c), tuple(arr[bottom_row, c].tolist())) for c in char_cols[:5]]

    # Também mostra 5 linhas acima do bottom para achar o pé escuro
    print(f"\n{path.split('/')[-1]}:")
    print(f"  Imagem: {w}x{h}")
    print(f"  Bottom row do personagem: {bottom_row}")
    print(f"  Pixels na bottom row: {sample_pixels}")

    # Busca nas ultimas 30 linhas do personagem por pixels escuros (sapato/bota)
    # Escuro = todos os canais < 80
    dark_pixels = []
    for row in range(max(0, bottom_row - 30), bottom_row + 1):
        cols = np.where(is_char[row])[0]
        for col in cols:
            r, g, b = arr[row, col]
            if r < 80 and g < 80 and b < 80:
                dark_pixels.append((row, int(col), int(r), int(g), int(b)))

    if dark_pixels:
        print(f"  Pixels escuros (bota) encontrados: {len(dark_pixels)}")
        # Mostra o mais alto (menor row = mais ao topo = inicio da bota)
        top_dark = dark_pixels[0]
        print(f"  Primeiro pixel escuro (topo da bota): row={top_dark[0]}, col={top_dark[1]}, RGB=({top_dark[2]},{top_dark[3]},{top_dark[4]})")
        # Mostra o mais baixo (maior row = sola do pé)
        bot_dark = dark_pixels[-1]
        print(f"  Ultimo pixel escuro (sola do pe):     row={bot_dark[0]}, col={bot_dark[1]}, RGB=({bot_dark[2]},{bot_dark[3]},{bot_dark[4]})")
    else:
        print(f"  Nenhum pixel escuro encontrado nas ultimas 30 linhas")
        # Mostra pixels do bottom row para diagnostico
        for row in range(bottom_row - 5, bottom_row + 1):
            cols = np.where(is_char[row])[0]
            if len(cols) > 0:
                sample = [(int(c), tuple(arr[row, c].tolist())) for c in cols[:3]]
                print(f"  Row {row}: {sample}")
