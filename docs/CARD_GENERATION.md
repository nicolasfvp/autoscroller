# Geração de Cartas Completas via ComfyUI

> Documentação do experimento realizado em 2026-06-02.
> Prova de conceito: é possível gerar cartas completas (arte + frame + ícones + texto) como assets estáticos usando ComfyUI com imagem de referência composta.

---

## Resultado

A carta gerada ficou fiel ao que o Phaser renderiza em runtime:
- Proporção 2:3 correta
- Arte original da maga preservada
- Ícones corretos no header (mana, air, fire)
- Nome na banner parchment
- Descrição com valor em laranja ("10 fire")

Arquivo de resultado: `comfy/ui/cards/firestorm_v3/firestorm_v3.png`

---

## Por que assets estáticos vs. renderização em código

| | Assets estáticos | Renderização Phaser |
|---|---|---|
| Visual | Idêntico | Idêntico |
| Upgraded | Asset separado | Automático |
| Stats dinâmicos (int, scaling) | Valor fixo | Valor real do build |
| Estado de combate (cooldown, cinza) | Impossível | Automático |
| Volume | ~300 assets (150 × 2) | Zero |
| Localização | Multiplicar por idioma | Grátis |
| Manutenção ao balancear | Regar tudo | Zero |

**Conclusão:** Estáticos são ideais para biblioteca, tela de coleção, compartilhamento social. Inviáveis como substituto do sistema em jogo.

---

## Assets necessários por carta

| Asset | Caminho | Descrição |
|---|---|---|
| Frame | `public/assets/ui/frames/card_mold_v2.png` | 1024×1536px, proporção 2:3 |
| Arte da carta | `public/assets/cards/<id>.png` | Ex: `t2-air-fire.png` |
| Ícone de custo | `public/assets/icons/tokens/mana.png` (ou `stam`, `armor`) | |
| Ícones de elemento | `public/assets/icons/tokens/<elemento>.png` | Ex: `air.png`, `fire.png` |

---

## Processo: composição da imagem de referência

O ComfyUI aceita apenas **uma** `reference_image`. A solução é compor uma colagem com todos os assets antes de enviar.

### Layout da colagem

```
┌─────────────────┬─────────────────┐
│                 │   Arte da carta │
│  card_mold_v2   │   (quadrada)    │
│  (frame 2:3)    ├────┬────┬───────┤
│                 │mana│air │ fire  │
└─────────────────┴────┴────┴───────┘
```

### Script PowerShell (System.Drawing)

```powershell
Add-Type -AssemblyName System.Drawing

$basePath = "c:\Users\heric\Prog\autoscroller\public\assets"
$outPath  = "c:\Users\heric\Prog\autoscroller\comfy\ui\cards\<nome>_ref.png"

$frame = [System.Drawing.Image]::FromFile("$basePath\ui\frames\card_mold_v2.png")
$art   = [System.Drawing.Image]::FromFile("$basePath\cards\<id>.png")
$mana  = [System.Drawing.Image]::FromFile("$basePath\icons\tokens\mana.png")   # ou stam/armor
$elem1 = [System.Drawing.Image]::FromFile("$basePath\icons\tokens\<elem1>.png")
$elem2 = [System.Drawing.Image]::FromFile("$basePath\icons\tokens\<elem2>.png")

[int]$CARD_W = 512   # frame escalado para metade (original 1024)
[int]$CARD_H = 768   # frame escalado para metade (original 1536) — proporção 2:3
[int]$ART_S  = 512   # arte quadrada
[int]$ICON_H = $CARD_H - $ART_S   # 256px para os ícones
[int]$ICON_W = 170
[int]$PAD    = 16

[int]$totalW = $PAD + $CARD_W + $PAD + $ART_S + $PAD
[int]$totalH = $PAD + $CARD_H + $PAD

$canvas = New-Object System.Drawing.Bitmap($totalW, $totalH)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(20, 12, 8))

# Frame à esquerda em proporção 2:3 correta
$g.DrawImage($frame, $PAD, $PAD, $CARD_W, $CARD_H)

# Arte quadrada ao lado
[int]$artX = $PAD + $CARD_W + $PAD
$g.DrawImage($art, $artX, $PAD, $ART_S, $ART_S)

# Ícones abaixo da arte: custo | elem1 | elem2
[int]$iconY = $PAD + $ART_S
$g.DrawImage($mana,  $artX,              $iconY, $ICON_W, $ICON_H)
$g.DrawImage($elem1, ($artX + $ICON_W),  $iconY, $ICON_W, $ICON_H)
$g.DrawImage($elem2, ($artX + $ICON_W*2),$iconY, $ICON_W, $ICON_H)

$g.Dispose()
$canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose()
$frame.Dispose(); $art.Dispose(); $mana.Dispose(); $elem1.Dispose(); $elem2.Dispose()
```

> **Atenção:** Usar tipos `[int]` explícitos em todas as variáveis de dimensão. PowerShell 5.1 retorna array ao dividir `Int32` do .NET, quebrando o `Bitmap`.

---

## Geração no ComfyUI

### Workflow
`ui_button` (GPT Image 2, quality: low)

### Reference image
A colagem composta no passo anterior.

### Prompt template

```
A complete pixel art trading card for a dark fantasy RPG called "<NOME>".
The reference image has two sections: LEFT is the card frame template
(portrait 2:3 ratio, dark wood with gold ornamental borders) — reproduce
this frame exactly including its proportions. RIGHT shows the assets to
place inside: top-right is the art (<DESCRIÇÃO DA ARTE>), bottom-right
are the icons (<ÍCONE CUSTO> = <tipo>, <ELEM1> = <elemento>, <ELEM2> = <elemento>).

Fill the card frame as follows:
TOP HEADER BAR — left slot: <ícone custo> icon with "<VALOR>" beside it;
center slot: <elem1 icon> and <elem2 icon> side by side; right slot: "<COOLDOWN>s" text.
LARGE ART WINDOW — place the <arte> filling the entire art area.
NAME BANNER (parchment strip) — "<NOME>" centered in dark serif text.
DESCRIPTION PANEL — "<DESCRIÇÃO>" with "<VALOR DESTACADO>" in orange.

Card must be portrait 2:3 ratio, not compressed.
Pixel art style, fills entire frame edge to edge.
```

### Exemplo preenchido (Firestorm)

```
A complete pixel art trading card for a dark fantasy RPG called "Firestorm".
The reference image has two sections: LEFT is the card frame template
(portrait 2:3 ratio, dark wood with gold ornamental borders) — reproduce
this frame exactly including its proportions. RIGHT shows the assets to
place inside: top-right is the art (dark mage summoning a firestorm of
purple and orange flames), bottom-right are the 3 icons (purple galaxy
orb = mana, blue swirl = air element, orange flame = fire element).

Fill the card frame as follows:
TOP HEADER BAR — left slot: purple galaxy orb icon with "1" beside it;
center slot: blue swirl and orange flame icons side by side;
right slot: "1.8s" text.
LARGE ART WINDOW — place the mage firestorm art filling the entire art area.
NAME BANNER (parchment strip) — "Firestorm" centered in dark serif text.
DESCRIPTION PANEL — "For 4 seconds: if you play 3 or more cards, apply 10 fire."
with "10" in orange.

Card must be portrait 2:3 ratio, not compressed.
Pixel art style, fills entire frame edge to edge.
```

### Chamada MCP

```typescript
mcp__comfyui__generate_asset({
  prompt: "<prompt acima>",
  output_path: "ui/cards/<nome_carta>",
  workflow: "ui_button",
  reference_image: "c:\\...\\comfy\\ui\\cards\\<nome>_ref.png",
})
```

---

## Dados da carta (cards.json)

Consultar `src/data/json/cards.json` para obter:
- `id` → chave da arte (`public/assets/cards/<id>.png`)
- `name` → nome na banner
- `cost` → ícone e valor do custo primário (`stamina`→`stam`, `mana`→`mana`)
- `elements[]` → ícones de elemento (`public/assets/icons/tokens/<elem>.png`)
- `cooldown` → texto no slot direito do header
- `description` → texto do painel inferior

---

## Lições aprendidas

1. **Uma referência só** — o workflow `ui_button` aceita uma imagem. Composição prévia é obrigatória.
2. **Proporção do frame** — o frame original é 1024×1536 (2:3). Na colagem, escalar para 512×768 mantendo a proporção. Nunca usar altura diferente de `largura × 1.5`.
3. **Tipos explícitos no PowerShell** — usar `[int]$var` para todas as dimensões. Divisão de `Int32` .NET em PS5.1 retorna array e quebra o `Bitmap`.
4. **Arte reimaginada** — o modelo preserva a composição e atmosfera mas reinterpreta os detalhes. Quanto mais descritivo o prompt sobre a arte, mais fiel o resultado.
5. **Primeira tentativa** — gerou a carta comprimida (frame em 512×512 em vez de 512×768). Corrigido na segunda tentativa com a colagem correta.
