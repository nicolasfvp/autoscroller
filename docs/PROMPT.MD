# Monster Prompt Catalog

> Each monster requires 2 renders of the same prompt (`_1.png` and `_2.png`) for idle animation.
> Save to: `public/assets/characters/monsters/<biome>/<monster_id>_1.png` and `_2.png`

---

## Template

### Prom,pt para painels e assets

Aqui está o prompt exato que usei para o painel:

```
A game UI panel or dialogue box in the Studio Ghibli art style. The panel has a rectangular shape with slightly rounded corners. The frame is made of aged, weathered stone or carved wood with subtle moss or vine details at the corners. The inner area is a soft, parchment-like texture or a dark, semi-transparent background with a hand-painted watercolor feel. The overall aesthetic is whimsical, rustic, and magical. Clean lines, soft lighting, white background outside the panel. High quality, game asset style.
```

Como criar outros assets com o mesmo estilo?
Você pode usar essa mesma "fórmula" para qualquer coisa. Veja alguns exemplos de como adaptar:
Para Botões:

```
A game UI button in the Studio Ghibli art style. Made of polished wood with a glowing crystal in the center. Whimsical, rustic, and magical. Clean lines, soft watercolor shading, white background. Game asset style.
```

Para Ícones (ex: Poção):

```
A game icon of a health potion in the Studio Ghibli art style. A round glass bottle with sparkling red liquid and a cork stopper. Whimsical and magical. Hand-painted watercolor feel, clean lines, white background.
```
### Prompt para cenários loop


Para Cenários (Backgrounds):

```
A game background of a lush green meadow with a distant wizard tower in the Studio Ghibli art style. Soft clouds, vibrant colors, hand-painted aesthetic. Whimsical and peaceful atmosphere. High detail.
```

1. Para o Campo com Casas (Asset Isolado):
"A 2D pixel art game asset of a grassy field with rolling hills. Features: Lush green grass, scattered bushes, and small, distant medieval cottages/houses nestled among the hills. Style: High-quality 'Pixel Art Premium', vibrant colors, soft morning lighting, matching the landscape in 'gameplay_background_clean.png'. Background: Pure green background #00FF00 (to be removed for transparency). Constraints: NO sky, NO sun, NO clouds. Only the land, hills, and the small houses. Clean top edge for easy layering."
2. Para a Versão Panorâmica e Seamless (Sem fumaça):
"A wide, panoramic 2D pixel art game asset of a grassy field with rolling hills and small medieval houses. Aspect Ratio: 3:1 (very wide). Features: Lush green grass, scattered bushes, and small medieval cottages nestled among the hills. Specifics: NO smoke coming from the chimneys. The houses are clean. Seamless Loop: The left edge of the image perfectly matches the right edge to allow for a seamless infinite loop in a side-scrolling game. Style: High-quality 'Pixel Art Premium', vibrant colors, soft morning lighting, matching 'gameplay_field_with_houses.png'. Background: Pure green background #00FF00 (to be removed for transparency). Constraints: NO sky, NO sun, NO clouds. Only the land, hills, and houses. Clean top edge."


### Prompt para monstros

```
A stylized [MONSTER TYPE] character for a 2D RPG game, in high-quality pixel art. It has heroic/monster proportions, similar to a classic sprite, balancing between chibi and realistic styles. The [MONSTER TYPE] is [QUICK DESCRIPTION], wearing [OUTFIT/ARMOR]. The art style features: bold colors, clean pixel clusters, high-contrast cel-shading with bright highlights, a thick black outer outline, and a solid black background. Professional game asset, stylized and readable.
```

```
Pixel art, preserved proportions, fixed position, breathing, hand draw, coerent colors
```

### Prompt para personagens pocket

Primeira Imagem (Versão Pocket Ghibli com Cajado e Magia)

Este foi o prompt usado para transformar a pixel art original no estilo chibi/Ghibli:

```
"A cute "pocket" version of the mage character from the reference image, Studio Ghibli anime style, chibi proportions with a large head and small body. She has long purple hair tied in a high ponytail, pointy elf ears, and large expressive eyes. She wears her signature purple and white magical robes with silver pauldrons. She is holding her ornate staff with a glowing purple orb in one hand and a small purple energy sphere in the other. Soft watercolor-like shading, clean lines, whimsical and magical atmosphere, white background.
```

Segunda Imagem (Versão com Mãos Vazias)
Este foi o prompt de variação usado para remover os itens mantendo a consistência da personagem:

```
"The same pocket Ghibli mage character from the reference image, but now with both hands empty. Remove the staff from her right hand and remove the purple magic energy orb from her left hand. Her hands should be in a natural, relaxed pose. Keep her character design identical: long purple hair in a high ponytail, pointy elf ears, large purple eyes, and her purple and white magical robes with silver armor details. White background, Studio Ghibli chibi style."
```

---

PROMPT PARA CORRIDA

```
Prompt: A smooth, high-quality 2D character animation of a young warrior in a side-view running cycle. The character has messy brown hair and wears silver plate armor. His tattered brown cloak billows and flows dynamically in the wind behind him as he sprints. The movement is fluid and rhythmic, with natural arm swings and leg strides consistent with a fast run. Studio Ghibli inspired art style, clean lines, soft watercolor textures. The background remains static and transparent. High-fidelity game sprite animation, looping perfectly.
```

---

## Estrutura de Prompt Mestre para Geração de Tiles de Jogo

Para garantir consistência e simplicidade em todos os tiles do seu jogo, utilize a seguinte estrutura de prompt. Ela permite que você especifique os detalhes essenciais de cada tile, mantendo o estilo visual unificado.

```
A high-quality 2D pixel art game tile of a [TIPO_DE_TERRENO_PRINCIPAL]. The design is simple, clean, and not overcrowded. It features [ELEMENTOS_CHAVE_DO_TILE, ex: a few stylized evergreen trees, soft green grass, a simple dirt path]. The art style is polished indie game pixel art with clear shapes and high readability. Top-down / isometric perspective. The tile must be perfectly seamless on all sides (top, bottom, left, right) for tiling. [PALETA_DE_CORES_OU_TONS_PREDOMINANTES, ex: Vibrant but balanced colors, muted earthy tones]. No small distracting details like individual leaves or tiny mushrooms. Professional game asset.
```

```
"A 2D pixel art ground tile asset for a side-scrolling game, exactly matching the style and structure of 'gameplay_hud_mockup_v2.png'. Top Layer: A detailed stone path with irregular grey cobblestones, small patches of green moss, and tiny grass blades at the edge. Bottom Layer: A vertical stone wall made of dark, textured rectangular stone blocks, creating a thick platform. Seamless Loop: The left edge of the image perfectly matches the right edge to allow for a seamless infinite loop. Style: High-quality 'Pixel Art Premium', sharp details, natural stone textures, matching the bottom part of the reference mockup exactly. Background: Pure green background #00FF00 (to be removed for transparency). Constraints: NO sky, NO hills, NO characters. Only the ground platform (path + wall). Horizontal strip format."
```

### Exemplo de Uso (Tile de Floresta):

Usando a estrutura acima, o prompt para o tile de floresta que acabamos de gerar seria:

```
A high-quality 2D pixel art game tile of a **forest**. The design is simple, clean, and not overcrowded. It features **a few stylized evergreen trees, soft green grass, and a simple dirt path**. The art style is polished indie game pixel art with clear shapes and high readability. Top-down / isometric perspective. The tile must be perfectly seamless on all sides (top, bottom, left, right) for tiling. **Vibrant but balanced colors**. No small distracting details like individual leaves or tiny mushrooms. Professional game asset.
```

### Como Adaptar para Outros Tiles:

Basta substituir os placeholders `[TIPO_DE_TERRENO_PRINCIPAL]`, `[ELEMENTOS_CHAVE_DO_TILE]` e `[PALETA_DE_CORES_OU_TONS_PREDOMINANTES]` pelos detalhes específicos de cada novo tile que você deseja criar. Mantenha as frases sobre "simple, clean, not overcrowded", "polished indie game pixel art", "seamless on all sides" e "no small distracting details" para garantir a consistência estética e funcional.

**Exemplos para outros tiles:**

- **Tile de Deserto:**
  `...a **desert**. It features **rolling sand dunes, sparse cacti, and a winding sandy path**. ... **warm earthy tones, light browns and yellows**. ...`

- **Tile de Pântano:**
  `...a **swamp**. It features **murky green water, twisted dead trees, and patches of dark mud**. ... **dark greens, browns, and hints of purple**. ...`

Esta estrutura vai te ajudar a manter a coesão visual e a funcionalidade de tiling para todos os elementos do seu mapa.

---

O prompt que utilizei para gerar o background do campo verde (seamless e sem céu) foi o seguinte:
Prompt:

```
A high-quality 2D pixel art background of a lush green field. The scene features rolling green hills, soft grass, and occasional small bushes or rocks. IMPORTANT: The background must have NO SKY (the top area should be empty or a solid dark color to be replaced by a separate sky asset). The image must be perfectly seamless horizontally, so the left edge matches the right edge exactly for infinite scrolling. Professional indie game background art, consistent with the mockup style. Polished pixel art, high readability. No characters or UI.
```

---

## Prompt para Battle Backgrounds

Para gerar backgrounds de arena de batalha, use a seguinte estrutura:

```
A [BIOME] battle arena background in dark pixel art style. The foreground is a solid platform of [GROUND MATERIAL] where the warriors stand and fight. The background features [BACKGROUND SCENERY with appropriate elements for the biome — lava rivers, mountains, ruins, etc.] with bright glowing edges. [ATMOSPHERIC DETAILS: ash clouds, embers, mist, rain, etc.]. The [GROUND MATERIAL] is contained [IN FOREGROUND / ON THE GROUND LEVEL], NOT on the fighting surface. Dark oppressive atmosphere with high contrast between the dark [GROUND] and the bright background elements. Similar style to existing dark battle backgrounds in an indie pixel art roguelike game. Game asset suitable for side-view combat, no characters. Completely fills the entire canvas edge to edge without blank space.
```

### Exemplo (Vulcão — bg_battle_lava):

```
A volcanic lava battle arena background in dark pixel art style. The foreground is a solid platform of dark volcanic rock and cracked obsidian where the warriors stand and fight. The background features flowing red and orange lava rivers with bright glowing edges, jagged volcanic peaks in dark silhouette, ash clouds and embers floating in the air. The lava is contained in ravines and channels in the background, NOT on the ground where the fighters are. Dark oppressive atmosphere with high contrast between the dark rocky fighting surface and the bright glowing lava. Similar style to existing dark battle backgrounds in an indie pixel art roguelike game. Game asset suitable for side-view combat, no characters. Completely fills the entire canvas edge to edge without blank space.
```

**Pontos críticos:**
- **Ground material**: especificar claramente o chão/plataforma onde os personagens ficam (ex: rochas, terra, mármore)
- **Background scenery**: elementos perigosos/atmosféricos vão para o FUNDO ou LATERAIS, nunca no chão
- **"NOT on the fighting surface"**: reforçar que o perigo fica longe dos pés dos personagens
- **High contrast**: diferenciar visualmente o chão (escuro/neutro) do background (brilhante/perigoso)

---

Texto do prompt para a tela de shoppinhg

```
Prompt do Shop: A high-quality 2D pixel art game UI mockup for a shop screen (The Merchant). The background is a cozy, dim-lit medieval tavern or shop with wooden barrels, banners, and warm lantern light. In the center, there is a large, elegant UI box with a dark metallic frame and gold accents. The top of the box has two tabs: 'RELICS' and 'SHARDS'. The 'SHARDS' tab is active, showing a list of items. Each list entry has the shard name on the left and its price on the right. If multiple shards are selected, a quantity indicator like 'x3' appears. On the right side of the screen, there is a separate black UI box that displays a large, detailed pixel art icon of the selected shard and a text description below it, in a style similar to Dark Souls item descriptions. The overall aesthetic is professional, clean, and consistent with modern indie pixel art hits like Sea of Stars. No mobile-style icons, just pure game UI. High contrast and readability
```
