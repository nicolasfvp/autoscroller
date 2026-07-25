# ANIMATIONS.md — Animações do Herói em Combate

> Referência canônica para animações de combate do herói: quais existem, quando disparam, como gerar.

---

## Animações Necessárias

| Chave              | Descrição                                           | Frames | Loop |
|--------------------|-----------------------------------------------------|--------|------|
| `{sp}_idle`        | Parado/respirando entre ações                       | 4      | sim  |
| `{sp}_attack`      | Golpe físico direto (slash, punch, lunge)           | 4      | não  |
| `{sp}_attack_fast` | Golpe rápido/duplo (agility cards, multi-hit)       | 4      | não  |
| `{sp}_cast`        | Conjuração mágica (TODOS os elementos — mesma anim) | 4      | não  |
| `{sp}_channel`     | Canalizar / buff em si mesmo + cura                 | 4      | não  |
| `{sp}_defend`      | Levanta escudo/postura defensiva                    | 4      | não  |
| `{sp}_hit`         | Recebe dano (flinch/recuo)                          | 4      | não  |
| `{sp}_death`       | Derrotado (cai)                                     | 4      | não  |

**Total: 8 animações × 4 frames = 32 frames por classe**

---

## Decisões de Design

### `cast` — mesma animação para todos os elementos
Fire, water, air e earth usam a mesma animação `cast`. A diferença visual entre elementos é feita pelos **efeitos de partícula** aplicados via `CombatEffects`, não pela animação do personagem.

### `channel` — cast_buff e heal fundidos
Cartas de buff próprio (Riposte, Gust, Razor Stance) e de cura (Mend, Mist Step) usam a **mesma animação** `channel`.

**Pose canônica do `channel`:**
- **Cavaleiro:** segura a espada com as duas mãos à frente do peito, ponta para baixo ou levemente inclinada. Postura concentrada, estática, com energia emanando da lâmina.
- **Maga:** segura o cajado com as duas mãos na frente do peito, orbe voltada para cima. Postura meditativa, olhos fechados ou semicerrados, com brilho suave no orbe.

---

## Fluxo de Geração (por SKILLS.md)

```
Frame 1 — imagem base colada pelo usuário (define pose, estilo, proporção)
      ↓
Frame 2 — gerado com reference_image = frame 1
      ↓
Frame 3 — gerado com reference_image = frame 2
      ↓
Frame 4 — gerado com reference_image = frame 3
      ↓
Montar spritesheet horizontal (PowerShell + System.Drawing)
      ↓
Aplicar rmv-background (good-rmv-background.json via MCP)
      ↓
Verificar dimensões e atualizar frameWidth no Preloader
```

**Regras obrigatórias de composição (aplicar em TODO frame do herói):**
- Personagem sempre **virado levemente para a direita** (three-quarter right view, side-scrolling combat).
- **Ground line consistente**: pés sempre à mesma distância da borda inferior em todos os frames — garante alinhamento no spritesheet.
- Personagem **sempre completo**: padding generoso em todos os lados, sem cortar corpo, capa, espada ou pés.

**Regras de geração:**
- Nunca pedir "spritesheet" no prompt — gerar um frame por vez.
- `reference_image` deve ser ≤ 512×512 — redimensionar antes se necessário.
- Nunca gerar múltiplos frames sem aprovação entre eles.
- Ajustar `model.custom_width` e `model.custom_height` no workflow para bater com as dimensões do frame anterior.
- Frame rate padrão: **12 fps**.

---

## Prompts por Animação

Usar o template base de cartas do `docs/PROMPT.MD` como referência de estilo.
Todas as gerações usam `image-reference-to-image.json` via `mcp__comfyui__generate_asset`.

### Estilo base (aplicar em todos os prompts)
```
Style: 'Pixel Art Premium', high-detail cel-shading, bold black outlines, inspired by Sea of Stars and Studio Ghibli.
Background: transparent (will be removed).
Preserved proportions. No card frame, no UI, no text.
```

---

### `attack` — Golpe físico

**Frame 1:** imagem fornecida pelo usuário (pose de ataque, espada levantada ou no início do swing)

**Frames 2–4:** progressão do swing até o impacto e retorno.

```
[Cavaleiro] The young knight with brown hair and silver armor mid sword swing, [FRAME DESCRIPTION].
Explosive red-orange energy trail follows the blade. Style: Pixel Art Premium, cel-shading, bold black outlines.
Lighting: warm red-orange glow from the swing. Transparent background. Preserved proportions.
```

```
[Maga] The young mage with purple hair and silver pauldrons [FRAME DESCRIPTION], staff thrust forward releasing a burst of magical energy.
Radiant multi-color energy erupts from the staff orb. Style: Pixel Art Premium, cel-shading, bold black outlines.
Transparent background. Preserved proportions.
```

---

### `attack_fast` — Golpe ágil (multi-hit)

**Frame 1:** imagem fornecida pelo usuário (corpo inclinado, posição de dash/dash-in)

**Frames 2–4:** dois golpes rápidos sequenciais, com motion blur ou trilha de movimento.

```
[Cavaleiro] The young knight in a swift dashing strike pose, [FRAME DESCRIPTION].
Twin green energy slashes trail behind the blade, motion blur on the arms.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

---

### `cast` — Conjuração mágica (todos os elementos)

**Frame 1:** imagem fornecida pelo usuário (braço estendido ou gesto de conjuração)

**Frames 2–4:** progressão do gesto de conjuração até o lançamento da magia, partículas crescendo.

```
[Cavaleiro] The young knight extending one arm forward, palm open, [FRAME DESCRIPTION].
Swirling magical energy gathers at the palm and launches forward. No specific element color — neutral white-gold energy.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

```
[Maga] The young mage pointing her staff forward, [FRAME DESCRIPTION].
Swirling magical energy erupts from the staff orb and launches forward. Neutral white-gold arcane energy.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

---

### `channel` — Canalizar / buff / cura

**Frame 1:** imagem fornecida pelo usuário (pose meditativa com arma no peito)

**Frames 2–4:** energia suave pulsando ao redor do personagem, mínimo de movimento corporal.

**Pose canônica:**
- Cavaleiro: espada com as duas mãos à frente do peito, ponta levemente para baixo, concentrado.
- Maga: cajado com as duas mãos à frente do peito, orbe voltada para cima, olhos fechados.

```
[Cavaleiro] The young knight holding his sword vertically with both hands pressed against his chest, [FRAME DESCRIPTION].
Gentle golden-white energy aura pulses outward from his chest. Calm, meditative stance.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

```
[Maga] The young mage holding her staff vertically with both hands pressed against her chest, orb facing upward, [FRAME DESCRIPTION].
Soft purple-white healing glow radiates from the orb. Eyes closed, meditative stance.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

---

### `defend` — Postura defensiva

**Frame 1:** imagem fornecida pelo usuário (escudo levantado ou postura de guarda)

**Frames 2–4:** postura firme se estabelecendo, aura de defesa se formando ao redor.

```
[Cavaleiro] The young knight raising his shield in a defensive stance, [FRAME DESCRIPTION].
Radiant cyan-blue shield aura expands outward from the shield surface.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

---

### `hit` — Recebe dano

**Frame 1:** imagem fornecida pelo usuário (corpo recuando do impacto)

**Frames 2–4:** recuo progressivo e retorno à postura.

```
[Cavaleiro] The young knight recoiling from a hit, [FRAME DESCRIPTION], body tilted backward.
Red pain flash tints the armor briefly. Defensive instinct pose.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

---

### `death` — Derrotado

**Frame 1:** imagem fornecida pelo usuário (início da queda)

**Frames 2–4:** queda progressiva até o chão.

```
[Cavaleiro] The young knight beginning to collapse, [FRAME DESCRIPTION], armor dulled, sword falling from grip.
Dark desaturation washes over the sprite. Defeated, no energy remaining.
Style: Pixel Art Premium, cel-shading, bold black outlines. Transparent background. Preserved proportions.
```

---

## Lógica de Mapeamento: Carta → Animação

```
função getCardAnimation(card):

  efeito = card.effects[0]
  elemento = card.elements[0]

  se efeito.type == "damage" E elemento == "agility":
    retorna "attack_fast"

  se efeito.type == "damage":
    retorna "attack"

  se efeito.type ∈ [dot, aura] E efeito.target == "enemy":
    retorna "cast"                  // cast mágico (todos os elementos)

  se efeito.type == "aura" E efeito.target == "self":
    retorna "channel"               // buff próprio (Riposte, Gust, etc.)

  se efeito.type == "armor":
    retorna "defend"

  se efeito.type ∈ [heal, stamina, mana]:
    retorna "channel"               // cura e recursos = mesma anim do buff

  retorna "attack"                  // fallback
```

---

## Tabela: Cartas Atuais → Animação

### Tier 1

| Carta          | Nome      | Animação       |
|----------------|-----------|----------------|
| t1-attack      | Jab       | `attack`       |
| t1-defense     | Guard     | `defend`       |
| t1-agility     | Quickstep | `attack_fast`  |
| t1-counter     | Riposte   | `channel`      |
| t1-fire        | Spark     | `cast`         |
| t1-water       | Mend      | `channel`      |
| t1-air         | Gust      | `channel`      |
| t1-earth       | Quake     | `cast`         |

### Tier 2 — Puro

| Carta               | Nome            | Animação       |
|---------------------|-----------------|----------------|
| t2-attack-attack    | Reckless Strike | `attack`       |
| t2-defense-defense  | Bulwark Vow     | `defend`       |
| t2-agility-agility  | Flurry Step     | `attack_fast`  |
| t2-counter-counter  | Razor Stance    | `channel`      |
| t2-fire-fire        | Pyre            | `cast`         |
| t2-water-water      | Frostbind       | `cast`         |
| t2-air-air          | Tailwind        | `cast`         |
| t2-earth-earth      | Tremor Lock     | `cast`         |

### Tier 2 — Híbrido

| Carta                | Nome               | Animação       |
|----------------------|--------------------|----------------|
| t2-agility-attack    | Quickstrike        | `attack_fast`  |
| t2-agility-counter   | Sidestep & Slash   | `attack_fast`  |
| t2-agility-defense   | Parrying Stance    | `defend`       |
| t2-agility-fire      | Flame Dart         | `cast`         |
| t2-agility-water     | Mist Step          | `channel`      |
| t2-agility-air       | Gale Cut           | `cast`         |
| t2-agility-earth     | Tremor Dash        | `attack`       |
| t2-attack-counter    | Bloodprice Strike  | `attack`       |
| t2-attack-defense    | Shield Bash        | `attack`       |
| t2-attack-fire       | Kindle Strike      | `cast`         |
| t2-attack-water      | Crimson Tithe      | `channel`      |
| t2-air-attack        | Stormstrike        | `cast`         |
| t2-attack-earth      | Granite Lunge      | `attack`       |
| t2-counter-defense   | Iron Reckoning     | `defend`       |

---

## Animações Reativas (sem carta)

| Evento                 | Animação  | Trigger                        |
|------------------------|-----------|--------------------------------|
| Inimigo ataca          | `hit`     | `combat:enemy-attack`          |
| HP chega a 0           | `death`   | `combat:hero-died`             |
| Entre ações            | `idle`    | `animationcomplete` (fallback) |

---

## Prioridade de Implementação

1. `attack` — carta mais comum
2. `defend` — segunda mais usada
3. `cast` — cobre todos os elementos mágicos
4. `channel` — cobre buff + cura
5. `hit` — disparada por todo ataque inimigo
6. `attack_fast` — agility cards
7. `idle` — loop passivo
8. `death` — só ao morrer
