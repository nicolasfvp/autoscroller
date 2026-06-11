# SKILLS.md — Técnicas e Aprendizados do Projeto

> Catálogo de técnicas reutilizáveis que desenvolvemos juntos. Quando uma destas
> situações aparecer, siga o fluxo descrito aqui em vez de improvisar do zero.

---

## Remoção de Background — fluxo `workflow → script`

Remover fundo de um asset é **sempre um processo de dois estágios**: primeiro o
workflow neural (corte bruto), depois o script Python (limpeza dos artefatos).
Nunca espere que o workflow sozinho entregue um resultado limpo.

```
[imagem original]
      ↓
  Estágio 1: rmv-background.json (birefnet) — via API Python direta
      ↓
  resultado em comfy/monsters_nobg/
      ↓
  Estágio 2: fix_white_fringe.py — limpeza de halo e franja
      ↓
  [PNG limpo, pronto para public/]
```

### Estágio 1 — Workflow `rmv-background.json` (corte bruto)

- Workflow: `comfy-mcp/rmv-background.json` (modelo **birefnet**, roda local).
- Chamar via **API Python direta** (`POST /api/prompt`) — não tem nó de prompt,
  então o MCP falha com "Could not find a prompt node". Ver tabela na seção
  "REGRA CRÍTICA — Como chamar o ComfyUI".
- O nó `LoadImage` (id `"1"`) precisa do **caminho absoluto** da imagem:
  ```python
  workflow["1"]["inputs"]["image"] = "C:/Users/heric/Prog/autoscroller/public/assets/.../sprite.png"
  ```
- Controlar saída via `filename_prefix` do nó `SaveImage` (id `"129"`),
  ex. `"monsters_nobg/{name}"`. Recuperar via
  `GET /api/view?filename=X&subfolder=Y&type=output`.
- **Quando NÃO usar:** birefnet destrói painéis escuros sobre fundo escuro. Para
  UI dark, usar autocrop via `System.Drawing` no PowerShell. Usar birefnet só
  quando o objeto tem fundo claramente distinto (monstros, ícones).

### Estágio 2 — Script `fix_white_fringe.py` (limpeza de artefatos)

Roda sobre o output do birefnet. Passos internos:

1. **Flood-fill de borda** — pixels semitransparentes conectados à borda da
   imagem (sombras/franjas) têm alpha zerado.
2. **Halo escuro residual (`dark_halo_mask`)** — remove o sangramento do fundo
   preto: pixels **escuros (lum < 60) + semitransparentes (alpha < 200) + na
   borda**. **NUNCA toca pixels opacos** (alpha ≈ 255) — preserva o contorno
   preto legítimo do sprite.
3. **Interpolação de RGB** — pixels semitransparentes restantes puxam cor dos
   vizinhos opacos; zera RGB de pixels 100% invisíveis.

```
python scripts/fix_white_fringe.py caminho/asset.png      # arquivo único
python scripts/fix_white_fringe.py caminho/pasta/          # pasta inteira
```

---

## Julgar transparência — não confiar na cor do VSCode

**Problema:** o VSCode renderiza transparência como **preto**. Isso engana o
julgamento — fundo transparente e preto opaco do sprite ficam idênticos na tela,
levando a concluir errado que "o fundo foi removido" ou que "há preto sobrando".

**Técnica:** `scripts/preview_alpha.py` compõe o PNG sobre **magenta + branco +
xadrez** lado a lado e imprime estatísticas de alpha.

```
python scripts/preview_alpha.py caminho/asset.png   # gera asset.preview.png
```

- Transparência real → vira **magenta** (some o fundo).
- Preto do sprite → continua **preto** (é conteúdo).
- A estatística "Opaco E escuro" sinaliza fundo preto **não** removido.

**Regra:** antes de afirmar que um background foi removido, **gerar e olhar o
preview**. Apagar o `.preview.png` da pasta de assets depois (não versionar).

### Aprendizado-chave: opaco vs. semitransparente

A distinção que separa "limpeza correta" de "destruição do sprite":

- **Contorno/detalhe legítimo do sprite** = pixel **opaco** (alpha ≈ 255).
- **Halo/artefato de remoção de fundo** = pixel **semitransparente** (alpha baixo).

Por isso filtros de cor global ("remover todo pixel escuro") **destroem o
sprite** — apagam os pretos da arte junto com o halo. O filtro correto sempre
condiciona ao **alpha** e à **proximidade da borda**, nunca só à cor.

### Aprendizado-chave: rim-light não é halo

Uma linha clara/branca na borda **superior** de um sprite costuma ser
**rim-light intencional** do pixel art (luz vindo de cima), não artefato. Para
confirmar: olhar o **original antes da remoção** (sobre fundo preto). Se a linha
já existia, é arte — **não remover**. Halo de remoção de fundo é tipicamente
**escuro** (no caso de fundo preto) e **circunda toda** a silhueta uniformemente,
não só o topo.

---

## Debugging de processamento de imagem — protocolo

Quando refinar um algoritmo de imagem, **não iterar às cegas**:

1. **Estatísticas primeiro** — histograma de alpha, % transparente/opaco/semi,
   bounding box. Os números revelam a natureza do problema (ex.: "51% semi" =
   máscara macia; "halo lum 19" = sangramento escuro).
2. **Zoom com fundo contrastante** — recortar a região suspeita, ampliar com
   `Image.NEAREST` (sem interpolação), compor sobre magenta/verde. Só no zoom o
   artefato fica julgável.
3. **Comparar antes|depois lado a lado** num único PNG antes de aplicar.
4. **Testar parâmetros em paralelo** — gerar painéis com vários cortes/limiares
   de uma vez e escolher visualmente, em vez de aplicar e reverter.
5. **Arquivos temporários** com prefixo `_` em `scripts/`, apagados ao final.

---

## Geração de Assets (ComfyUI) — princípios

- **Sempre consultar `docs/PROMPT.MD`** antes de gerar — usar os templates já
  estabelecidos (UI, monstros, tiles, battle backgrounds).
- **UI:** GPT Image 2 (`gpt-image-2`), workflow `ui_button`, referência
  `public/assets/ui/buttons/btn_melhorar.png`. NUNCA `quality: "high"` — manter `"low"`.
  NUNCA usar `daily-run.png` como referência (estilo 3D foge da identidade).
- **Padding excessivo:** incluir no prompt "fills the entire image frame edge to
  edge with no margins, occupies 100% of canvas".
- **White bloom / fringe em vidro ou cristal:** o GPT Image 2 tende a adicionar
  bloom branco (lens flare, reflexo branco brilhante) em assets com vidro escuro,
  orbes ou cristais. **Sempre incluir no prompt** quando o asset tiver esses
  elementos:
  `"no white glow, no white bloom, no lens flare, no white reflections, no white light artifacts, clean dark glass"`
  Isso previne o fringe branco sem precisar pós-processar.
- **Battle backgrounds:** o chão onde os personagens lutam precisa ser **sólido e
  seguro**; elementos perigosos (lava, etc.) vão para o **fundo/laterais**, nunca
  na superfície de combate. Reforçar "NOT on the fighting surface". Considerar a
  resolução do jogo (800×600 game-space).
- **Staging:** assets nascem em `comfy/` (gitignored). Mover para `public/` só
  quando aprovados.

### REGRA CRÍTICA — Como chamar o ComfyUI

Existem dois métodos e cada workflow exige um específico. **Nunca trocar.**

| Workflow | Método correto | Por quê |
|---|---|---|
| `rmv-background.json` | **API Python direta** (`POST /api/prompt`) | Não tem nó de prompt — o MCP falha com "Could not find a prompt node" |
| `good-rmv-background.json` | **`mcp__comfyui__generate_asset`** | Usa `BriaRemoveImageBackground` que exige sessão autenticada — API direta recebe "Unauthorized" |
| `image-reference-to-image.json` | **`mcp__comfyui__generate_asset`** | Usa `OpenAIGPTImageNodeV2` que exige sessão autenticada — chamada Python direta recebe "Unauthorized" |
| `ui_button.json` | **`mcp__comfyui__generate_asset`** | Mesmo motivo: nó OpenAI requer sessão |
| `monster.json` | **`mcp__comfyui__generate_asset`** | Mesmo motivo |

**Regra prática:** se o workflow usa um nó `OpenAI*` ou `GPTImage*` → usar MCP.
Se o workflow usa apenas nós locais (birefnet, ControlNet, etc.) → usar API direta.

**O erro "Unauthorized: Please login first"** ao chamar via Python significa que
você usou API direta num workflow que exige sessão. A solução é trocar para o MCP,
**não** tentar recuperar cookie, não tentar reautenticar. Só trocar o método.

---

## Alinhamento de Frames por Pixel de Referência (pé/bota)

Quando frames gerados por IA apresentam deslocamento horizontal ou vertical entre si,
usar o **primeiro pixel escuro da bota** (ou outro ponto anatômico fixo) como âncora
para calcular e aplicar o offset de cada frame em relação ao frame 1.

### Quando usar

- Animações estáticas onde o corpo não se move (channel, defend, idle)
- Qualquer spritesheet onde o personagem "dança" entre frames

### Script

```
python scripts/_align_by_feet.py
```

O script detecta automaticamente o topo da bota em cada frame (primeiro pixel
com RGB < 80 em todos os canais, varrendo de cima para baixo nas últimas 60
linhas do personagem), calcula `dx` e `dy` em relação ao frame 1, e salva
os frames corrigidos + um spritesheet montado.

### Parâmetros do algoritmo

- **`bg_threshold=240`** — pixels com R,G,B > 240 são considerados fundo branco
- **`dark_threshold=80`** — pixels com R,G,B < 80 são considerados bota/contorno escuro
- **Referência:** primeiro pixel escuro encontrado varrendo de cima para baixo e da esquerda para a direita nas últimas 60 linhas do personagem

### Fluxo completo

```
Gerar 4 frames individualmente
      ↓
Salvar frames em public/ (com alinhamento aproximado pelo centro do bbox)
      ↓
python scripts/_align_by_feet.py  ← calcula offset pelo pé e salva frames corrigidos
      ↓
Montar spritesheet com os frames corrigidos (já feito pelo script)
      ↓
Aplicar good-rmv-background no spritesheet montado
      ↓
Substituir spritesheet em public/
```

### Nota

Se o personagem usa sapatos claros ou o fundo não é branco puro, ajustar
`bg_threshold` e `dark_threshold` conforme necessário.

---

## Geração de Spritesheets — fluxo frame a frame

Para gerar um spritesheet de 4 frames com consistência visual:

```
Frame 1 — gerar sem reference_image (define o estilo base)
      ↓
Frame 2 — gerar com reference_image = frame 1 (mantém consistência)
      ↓
Frame 3 — gerar com reference_image = frame 2
      ↓
Frame 4 — gerar com reference_image = frame 3
      ↓
Montar spritesheet horizontal com System.Drawing (PowerShell)
      ↓
Aplicar rmv-background good no spritesheet final
```

### Regras

- **Nunca pedir "spritesheet" no prompt** — o modelo gera uma grade bagunçada. Gerar um frame por vez.
- **Cada frame usa o anterior como `reference_image`** — garante que estilo, proporção e paleta se mantenham coerentes entre frames.
- **Aplicar rmv-background DEPOIS de montar o spritesheet**, não em cada frame separado — economiza crédito.
- **`reference_image` deve ser ≤ 512×512** — imagens grandes geram input tokens absurdos (1500+) e desperdiçam crédito. Se o frame gerado for maior, não usar como referência direta.
- **Nunca gerar múltiplas variações sem aprovação** — gerar um frame, mostrar, aguardar "continue" ou feedback antes do próximo.
- **CRÍTICO: Ajustar dimensões do workflow ANTES de gerar** — sempre que gerar um sprite baseado numa imagem de referência, verificar as dimensões da imagem de entrada e **alterar `model.custom_width` e `model.custom_height` no workflow `image-reference-to-image.json`** para que a saída tenha as mesmas dimensões. Isso evita upscaling/downscaling indesejado e garante consistência entre frames.
- **CRÍTICO: NUNCA incluir "fills the canvas", "fills the entire image", "generous padding" ou qualquer instrução que altere o tamanho/posição do personagem no canvas.** O personagem deve ocupar exatamente o mesmo espaço que na imagem de referência — mesma distância dos pés à borda inferior, mesmo padding lateral, mesma proporção. A pose muda, o enquadramento não.

### Montar o spritesheet com PowerShell

```powershell
Add-Type -AssemblyName System.Drawing
$frames = @("frame1.png","frame2.png","frame3.png","frame4.png")
$img0 = [System.Drawing.Bitmap]::new($frames[0])
$fw = $img0.Width; $fh = $img0.Height; $img0.Dispose()
$sheet = [System.Drawing.Bitmap]::new($fw * 4, $fh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::Transparent)
for ($i = 0; $i -lt 4; $i++) {
  $src = [System.Drawing.Bitmap]::new($frames[$i])
  $g.DrawImage($src, $i * $fw, 0, $fw, $fh)
  $src.Dispose()
}
$g.Dispose()
$sheet.Save("fx_output.png", [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
```

### Preloader — ajustar frameWidth após rmv-background

O rmv-background pode alterar as dimensões do spritesheet. Sempre verificar com:
```powershell
$img = [System.Drawing.Image]::FromFile("fx_output.png")
Write-Output "$($img.Width) x $($img.Height) → frameW=$([int]($img.Width/4))"
$img.Dispose()
```
E atualizar o `frameWidth`/`frameHeight` no Preloader com os valores reais.

---

## Alinhamento de Sprites pelo Pé (Python + PIL) — scripts avançados

Scripts em `scripts/` para inspecionar e alinhar frames com precisão sub-pixel.
Todos usam PIL + numpy. Rodar com `python scripts/<nome>.py`.

### `_inspect_feet.py` — Inspecionar posição dos pés por frame

Detecta o pixel mais baixo do personagem (fundo branco como BG) e busca pixels escuros
(bota/sapato) nas últimas 30 linhas. Útil para diagnosticar onde estão os pés antes de alinhar.

**Saída:** `bottom_row`, topo e sola do pixel escuro com coordenadas e RGB.

**Quando usar:** antes de qualquer alinhamento, para entender a anatomia do frame.

### `_inspect_anchor.py` — Inspecionar âncora da espada/arma

Localiza pixels escuros na zona do topo do personagem (primeiras 150 linhas) e calcula
a coluna média filtrada por moda (ignora ruído). Serve para encontrar onde a espada está
em cada frame.

**Saída:** `top`, `bottom`, `espada_x`, `espada_y` por frame.

**Quando usar:** quando o alinhamento precisa ser pela arma, não pelo pé.

### `_align_frame.py` — Alinhar um frame pelo centro horizontal do personagem

Recebe ref, src e out como argumentos de linha de comando. Alinha o centro X do src
ao centro X da ref. Só desloca horizontalmente (dy=0).

```
python scripts/_align_frame.py ref.png src.png out.png
```

### `_align_2frames.py` — Alinhar série de frames pela espada + topo do personagem

Versão sofisticada para frames com fundo transparente (RGBA). Alinha pelo centro X
da espada (filtrado por moda) e pelo topo do bounding box vertical. Monta spritesheet ao final.

**Parâmetros:** `DARK = 80`, `ALPHA = 128` (configuráveis no topo do script).

---

## Fórmula de Alinhamento de Pés (Phaser)

Para alinhar dois sprites pelo pé na tela do Phaser:

```
feet_screen_y = sprite_y + (frameH / 2) * scale - foot_margin * scale
```

- `sprite_y`: posição Y do sprite no Phaser (origin 0.5)
- `frameH`: altura do frame individual do spritesheet
- `scale`: escala aplicada no Phaser
- `foot_margin`: distância em px do centro da imagem até a sola do pé (medir com `_inspect_feet.py`)

**Para igualar dois sprites A e B ao mesmo `feet_screen_y` alvo:**
```
sprite_y = target_feet_y - (frameH / 2) * scale + foot_margin * scale
```

**Exemplo real (warrior vs mage):**
- warrior: frameH=580, scale=0.6034, foot_margin=107px → feet_y=451.6
- mage:    frameH=584, scale=0.3357, foot_margin=55px  → feet_y=451.6

---

## Convenções gerais herdadas (ver CONTEXTO.MD)

- Respostas em português.
- Não parar entre etapas de geração de assets a menos que haja erro.
- Ao isolar elementos, reinterpretar no mesmo estilo (pixel art, bold colors,
  thick black outline), referenciando a imagem original.
- Heredocs Python no Windows: usar **ASCII puro** nos `print` (emoji quebra com
  codec cp1252).
