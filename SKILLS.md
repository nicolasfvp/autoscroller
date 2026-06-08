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
| `image-reference-to-image.json` | **`mcp__comfyui__generate_asset`** | Usa `OpenAIGPTImageNodeV2` que exige sessão autenticada — chamada Python direta recebe "Unauthorized" |
| `ui_button.json` | **`mcp__comfyui__generate_asset`** | Mesmo motivo: nó OpenAI requer sessão |
| `monster.json` | **`mcp__comfyui__generate_asset`** | Mesmo motivo |

**Regra prática:** se o workflow usa um nó `OpenAI*` ou `GPTImage*` → usar MCP.
Se o workflow usa apenas nós locais (birefnet, ControlNet, etc.) → usar API direta.

**O erro "Unauthorized: Please login first"** ao chamar via Python significa que
você usou API direta num workflow que exige sessão. A solução é trocar para o MCP,
**não** tentar recuperar cookie, não tentar reautenticar. Só trocar o método.

---

## Convenções gerais herdadas (ver CONTEXTO.MD)

- Respostas em português.
- Não parar entre etapas de geração de assets a menos que haja erro.
- Ao isolar elementos, reinterpretar no mesmo estilo (pixel art, bold colors,
  thick black outline), referenciando a imagem original.
- Heredocs Python no Windows: usar **ASCII puro** nos `print` (emoji quebra com
  codec cp1252).
