# Mapa de Tooltips e Informação Visual — Autoscroller

**Status:** Pesquisa (não-implementação)
**Data:** 2026-05-16
**Escopo:** Toda informação do jogo que está hoje **escondida em texto** ou **ausente** e que poderia ser explicada por tooltip, ícone, animação ou tutorial.

Documento estruturado por sistema. Cada seção lista:
- **O que existe** (verificado no código/dados)
- **Como é mostrado hoje**
- **Gap de informação** (o que o jogador NÃO entende)
- **Sugestão de tooltip/visual**

No final: matriz de prioridades, débito de design e itens descobertos como dangling/incompletos.

---

## Índice

1. [Sistema de Cartas](#1-sistema-de-cartas)
2. [Combate](#2-combate)
3. [Inimigos](#3-inimigos)
4. [Elementos, Shards e Sinergias](#4-elementos-shards-e-sinergias)
5. [Relíquias](#5-relíquias)
6. [Materiais e Loot](#6-materiais-e-loot)
7. [Hub, Forja, Buildings](#7-hub-forja-buildings)
8. [Loop / Planning / Tiles](#8-loop--planning--tiles)
9. [Tutorial, Menus e Onboarding](#9-tutorial-menus-e-onboarding)
10. [Death, Game Over e Persistência](#10-death-game-over-e-persistência)
11. [Matriz de Prioridades](#11-matriz-de-prioridades)
12. [Débito de Dados e Definições Faltantes](#12-débito-de-dados-e-definições-faltantes)

---

## 1. Sistema de Cartas

Fonte: `src/data/json/cards.json` (156 cartas T1+T2), `cards-tier3-mocks.json` (T3 locked), `src/data/types.ts`, `src/ui/CardVisual.ts`, `src/ui/CardDetailPopup.ts`, `docs/CARDS_SYSTEM.md`.

### 1.1 Composição elemental da carta

**Existe:** ID canônico `t{tier}-{elementos}` (ex.: `t2-fire-fire-water`). 8 elementos com cores definidas em `elements.json`.
**Mostrado hoje:** `CardVisual` renderiza apenas a cor de **categoria** (attack/defense/magic). Cartas `t2-fire-fire-water` aparecem como genérico "magic" magenta.
**Gap:** Jogador não vê que a carta é composta por 2× Fire + 1× Water. Cores de `elements.json` (#DC2626, #F97316, #0EA5E9, etc.) **não são usadas** na carta.
**Sugestão:** Badge de bolinhas coloridas (2–4) no canto superior da carta com a cor de cada elemento. Mesmo badge no header de `CardDetailPopup`.

### 1.2 Stat scaling (`CardEffect.scale`)

**Existe:** Toda carta pode ter `scale: { stat, per, value }` por efeito. Ex.: Strike `damage = 7 + STR * 1`. Berserker Frenzy `+3 dmg por STR`. Healwave `+1 HP por SPI`.
**Mostrado hoje:** Apenas o valor base. "Deal 7 damage" — sem menção a STR.
**Gap:** Jogador não sabe qual stat beneficia qual carta nem que upgrades de STR/INT/DEX afetam cartas.
**Sugestão:** Anotar "+1 por STR" em cinza claro ao lado do número. Tooltip ao hover sobre o efeito mostra o valor calculado com o STR atual.

### 1.3 Tier vs raridade

**Existe:** Campos `tier` (1/2/3) e `rarity` (common/uncommon/rare/epic). Tier 3 está **locked** atrás de Forge L4. T1 ≈ common, T2 ≈ uncommon/rare, T3 ≈ epic — correlato, não exato.
**Mostrado hoje:** Cor de rarity divergente entre `CardVisual` (cinza/verde/azul/roxo) e `CardDetailPopup` (cinza/verde/laranja/roxo) — **paletas inconsistentes**.
**Gap:** Confusão de cor (rare = azul num lugar, laranja em outro). T3 cards mostram nome "???" — ambíguo se é placeholder ou nome real.
**Sugestão:**
- Unificar paleta de raridade entre `CardVisual.ts` e `CardDetailPopup.ts`.
- Exibir badge "Tier 1/2/3" explicito.
- Para T3 locked: badge 🔒 + "Reach Forge Lv4 to unlock".

### 1.4 Custo de carta

**Existe:** Custos em `stamina` e/ou `mana`. Algumas cartas custam recurso, outras geram (ex.: "+1 Stamina"). Algumas misturam (Tideturn Riposte: 2 stam + 1 mana).
**Mostrado hoje:** Custos exibidos como texto/ícone simples.
**Gap:** Cartas que **geram** recursos e cartas que **consomem** não são diferenciadas visualmente. Economia líquida (ex.: custa 3 stamina, gera 1, líquido -2) não é evidente.
**Sugestão:** Verde = ganho, vermelho = custo, cinza = neutro. Indicador "NET: -2 STA" pode aparecer no popup.

### 1.5 Targeting (single / aoe / self / lowest-hp / random)

**Existe:** Campo `targeting` no efeito.
**Mostrado hoje:** Em texto: "Deal 6 damage AoE" no detail popup. Sem ícone na carta minificada.
**Gap:** Diferenciação single vs AoE só por leitura cuidadosa.
**Sugestão:** Ícone pequeno: 🎯 single, 💥 AoE, 🔄 self, ⬇️ lowest-hp, 🎲 random — no canto inferior da carta.

### 1.6 Stack types (burn, freeze, poison, bleed, shock, arcane, rage)

**Existe:** 7 tipos enumerados em `types.ts`. Cartas aplicam stacks via `effect.type: "dot"` ou `"stack"` com `stacks: N`.
**Mostrado hoje:** Texto "Apply Burn 2" sem indicação de:
- Se é DoT (dano por tick) ou contador estático
- Como o stack escala (INT escala burn, DEX escala poison)
- Cap por carta/combate
- Quando o tick acontece
- Se múltiplos stacks coexistem

**Gap:** O sistema mais profundo do jogo é o mais opaco.
**Sugestão:**
- Glossário de keywords acessível na carta (hover sobre "Burn" → mini-tooltip com "DoT — escala com INT — tick a cada card play").
- Ícone padronizado por stack: 🔥 burn, ❄️ freeze, ☠️ poison, 💧 bleed, ⚡ shock, ✨ arcane, 😡 rage.

### 1.7 Buff/Debuff de cartas

**Existe:** `type: "buff"` aumenta stat temporariamente (Stoneskin +1 VIT, Wind Dancer +2 DEX). `type: "debuff"` reduz defense do inimigo (Sandstorm).
**Mostrado hoje:** "+1 VIT" sem indicador de duração.
**Gap:** Jogador não sabe se buff é "este combate", "este turno" ou "permanente".
**Sugestão:** Sufixo "(este combate)" / "(1 turno)" no popup. Ícone de duração.

### 1.8 Cooldown e DEX scaling

**Existe:** Cada carta tem `cooldown_ms`. DEX reduz cooldown 2%/ponto até 60% máx. Há `cooldownShave` one-shot via sinergia e auras com soft/hard cap (30%/60%).
**Mostrado hoje:** Cooldown badge ⏱ 1.1s na carta.
**Gap:** Jogador não sabe que DEX reduz cooldown nem que existe um floor.
**Sugestão:** Hover sobre badge de cooldown: "Base 1.1s — atual 0.9s (DEX -16%, floor 60%)".

### 1.9 Upgrade de carta

**Existe:** Campo `upgraded: { description?, cooldown?, ... }`. Renderiza com sufixo "+".
**Mostrado hoje:** Apenas description/cooldown overlay quando diferentes. Mudanças de **valor de efeito** (damage 7→10) NÃO são mostradas lado-a-lado.
**Gap:** Jogador faz upgrade e não vê o que melhorou.
**Sugestão:** Comparação side-by-side no detail popup: "Damage 7 → 10 (+3)" com diff verde.

### 1.10 Condicionais (`CardEffect.condition`)

**Existe no schema, não usado em T1/T2:** `enemy_has_stack`, `self_has_stack`, `hero_hp_pct_below/atleast`, `self_armor_atleast`, `per_stack`.
**Gap futuro:** Quando T3 ou redesigns usarem isso, precisará de UI específica ("requires: HP < 50%", highlight verde se condição satisfeita).

---

## 2. Combate

Fonte: `src/systems/combat/*`, `src/scenes/CombatScene.ts`, `src/ui/CombatHUD.ts`.

### 2.1 Status effects ativos no herói e no inimigo

**Existe:** Estado armazenado em `CombatState`. Ticks resolvidos por `CombatEngine`.
**Mostrado hoje:** **Nenhum ícone, nenhuma contagem**. Player não vê se há burn/freeze/poison aplicado.
**Gap:** Crítico. Não dá pra jogar status-focused builds com confiança.
**Sugestão:** Lista vertical de chips na borda do painel: `🔥×3` `☠️×2` `❄️×1`. Hover: descrição do efeito + escalonamento.

### 2.2 Armor do herói e do inimigo

**Existe:** `heroDefense` consumido 1:1, multiplicado por `defenseMultiplier` (Warrior 1.1, Mage 0.8). `enemyDefense` reduz dano do herói. `on_armor_break` trigger ao chegar a 0.
**Mostrado hoje:** Armor do herói aparece como "🛡 ARMOR 8" no `CombatHUD` **apenas se > 0**. Armor do inimigo **não aparece**.
**Gap:** Player não vê armadura inimiga (= dano vai "sumir") nem quanto da sua armadura é consumido por hit.
**Sugestão:** Sempre mostrar armor (mesmo 0). Floating number "-3" na cor da armor quando absorve. Tooltip explicando defenseMultiplier por classe.

### 2.3 Intenção do inimigo (telegrafia)

**Existe:** Cooldown timer interno, padrão fixo, special effects (`double` 30%, `stun`, `debuff`, `lifesteal`) e affinity por elemento.
**Mostrado hoje:** Apenas barra de cooldown.
**Gap:** O maior buraco de comunicação do combate. Player não sabe:
- Próximo ataque vai duplicar (30%)?
- Vai stunar?
- Vai dar lifesteal?
- Qual o efeito de affinity (ver §3.2)?

**Sugestão:** Painel "Próximo ataque" no enemy panel:
```
Doom Knight    Próximo: ⚔ 10 dmg + ⚡ Riposte (counter)
[============>      ] 1.7s
```
Para bosses, mostrar threshold de behaviors iminentes (enrage, shield, drain).

### 2.4 Floating numbers

**Existe:** Hero dano (branco), enemy dano (vermelho).
**Mostrado hoje:** Apenas dano físico flutua.
**Gap:** DoT ticks (poison/burn/etc.), armor break, affinity effects, stun blocked, status applied — **nada flutua**.
**Sugestão:** Codificar por cor:
- Poison: roxo
- Burn: laranja
- Freeze: azul claro
- Armor: azul
- Affinity: cor do elemento
- Cura: verde
- Stun: cinza com texto "STUN!"

### 2.5 Cooldown arc central

**Existe:** Arc 0–360°, label "READY".
**Gap:** Cor não está documentada (jogador não sabe o que significa). "READY" não diz quantas cartas estão prontas / próxima a sair.
**Sugestão:** Hover: "Próxima carta: Strike em 0.4s". Cores de fase explícitas (vermelho cooldown, amarelo carregando, verde ready).

### 2.6 Stat row hero (STR/VIT/DEX/INT/SPI)

**Existe:** Linha colorida no `CombatHUD`.
**Gap:** 3 letras + número, sem indicação do que cada stat faz **em combate**:
- STR: dano físico
- VIT: HP máximo (+5/ponto no início), regen de armor
- DEX: cooldown -2%/ponto (max 60%), escala poison
- INT: dano mágico, regen mana, escala burn
- SPI: cura, regen stamina em reshuffle

**Sugestão:** Hover sobre cada sigla: linha 1 com efeito atual ("DEX 8 → -16% cooldown"), linha 2 com formula geral.

### 2.7 Recursos (HP/Stamina/Mana)

**Existe:** Bars no `CombatHUD`.
**Gap:**
- HP persiste entre combates (mas player pode achar que reset).
- Recovery pós-combate: 50% do déficit — não documentado.
- Stamina regen passiva 1/4.5s + floor(SPI/2) em reshuffle.
- Mana regen passiva 1/4.5s + floor(INT/2) em reshuffle.
- VIT bonus +5 HP/ponto aplicado no início — sem indicação.

**Sugestão:** Tooltip por barra explicando taxa de regen. Animação ao reshuffle mostrando o ganho.

### 2.8 Synergy flash em combate

**Existe:** `SynergyFlash` mostra "COMBO!" amarelo central com valor.
**Gap:** Todos os tipos de synergy (cooldown shave, dano, mana refund) usam o mesmo flash visual.
**Sugestão:** Diferenciar por cor e ícone: ⚔ amarelo (dano), ⏱ verde (cooldown), ✨ azul (recursos).

### 2.9 Difficulty scaling

**Existe:** `DifficultyScaler.ts`: `1 + (loop-1)*0.3` para normais; bosses crescem à metade. Gold scaling `log2`.
**Mostrado hoje:** Apenas "Loop N" e badge "x1.0".
**Gap:** Player não sabe a fórmula, nem que bosses crescem mais devagar, nem como gold reage.
**Sugestão:** Hover na badge: "Loop 3 → +60% HP/dano inimigo (bosses +30%). Gold scala log₂".

### 2.10 Combat result summary

**Existe:** `CombatStats` rastreia cards played/skipped, damage dealt/received, synergies, reshuffles.
**Gap:** Tela de resultado mostra apenas nome do inimigo + victory/defeat. Sem breakdown.
**Sugestão:** Painel pós-combate com totais por categoria (carta mais usada, dano por elemento, status aplicados, combos disparados).

---

## 3. Inimigos

Fonte: `src/data/json/enemies.json` (20 inimigos: 17 normais + 3 bosses), `src/data/EnemyDefinitions.ts`, `src/systems/BossSystem.ts`.

### 3.1 Lista completa

17 normais (Lost Lizard, Corpse Eater, Headless Fire Horse, Pocket Cat, Baby Dragon, Giant Beetle, Mutated Salamander, Ancient Tree, Giant Spider 1/2, Mush, Forge Slime, Lava Golem, Mecha Warrior, Depths Horror, Toxic Gooze, Venomous Kobra).
3 bosses: Doom Knight (550 HP, counter), Iron Golem (700 HP, defense), Lizard King (450 HP, attack).

**Gap geral:** Nenhuma "enciclopédia" in-game. Player encontra inimigos sem saber o que esperar.
**Sugestão:** Bestiário acessível pela Library / Collection. Cada entrada: sprite, HP base, dano base, affinity, materiais que dropa, drop rate. Desbloqueado por encontro.

### 3.2 Affinity do inimigo (8 tipos)

**Existe:** Cada inimigo tem 1 affinity. A cada ataque, aplica efeito secundário (bosses 2×):

| Affinity | Efeito por ataque (normal / boss) |
|----------|------------------------------------|
| attack   | nenhum (budgetado no dano base) |
| defense  | +3 / +6 armor no inimigo |
| agility  | -100 / -200 ms cooldown (floor 800 ms) |
| counter  | +2 / +4 damage (riposte) |
| fire     | +1/+2 HP perdido + -1/-2 stamina |
| water    | inimigo cura +4 / +8 HP |
| air      | 15% stun + -1/-2 mana |
| earth    | -2/-4 stamina + +1/+2 armor |

**Mostrado hoje:** **Nenhum indicador no enemy panel.**
**Gap:** Crítico. Player não entende por que toma dano "extra" ou perde stamina.
**Sugestão:** Ícone de affinity ao lado do nome (com cor do elemento). Tooltip lista o efeito. Quando o efeito dispara em combate, floating number na cor do elemento.

### 3.3 Special effects (`double`, `stun`, `debuff`, `lifesteal`)

**Existe:** Campo opcional em `EnemyDefinition`. Atualmente não populado para a maioria.
**Gap:** Quando estiver populado, jogador deveria ver pré-aviso.
**Sugestão:** Badges abaixo do nome: "Pode dobrar (30%)", "Lifesteal 50%".

### 3.4 Boss behaviors (`enrage`, `shield`, `multi_hit`, `drain`)

**Existe:** Suportado em código (`EnemyAI.ts`), mas **arrays `behaviors` vazios** nos 3 bosses atuais.
**Gap futuro:** Quando ativados, telegrafia será essencial.
**Sugestão:** Barra de threshold ("enrage em HP ≤ 30%"). Animação ao disparar shield. Heal flutuante ao drain.

### 3.5 Drops por inimigo

**Existe:** Normais dropam material específico com 30% (bone/iron/crystal/herbs/wood/essence). Bosses garantidos 3–6 essence. Conhecido em `enemies.json` campo `materialReward`.
**Mostrado hoje:** Loot summary pós-combate.
**Gap:** Pré-combate, jogador não sabe o que pode cair.
**Sugestão:** Ao hoverar tile com inimigo conhecido (após primeiro encontro): "Pocket Cat — pode dropar Herbs (30%)".

---

## 4. Elementos, Shards e Sinergias

Fonte: `src/data/json/elements.json`, `src/data/synergies.json` (12 sinergias **ativas** — atenção: `src/data/json/synergies.json` está vazio mas é arquivo legado; o ativo é o em `src/data/`), `src/systems/SynergyResolver.ts`, `src/systems/ShardSystem.ts`.

### 4.1 8 elementos

| ID       | Categoria   | Stat | Cor       |
|----------|-------------|------|-----------|
| attack   | Physical    | STR  | #DC2626 |
| defense  | Physical    | VIT  | #6B7280 |
| agility  | Physical    | DEX  | #FACC15 |
| counter  | Physical    | STR  | #B91C1C |
| fire     | Elemental   | INT  | #F97316 |
| water    | Elemental   | SPI  | #0EA5E9 |
| air      | Elemental   | DEX  | #C4B5FD |
| earth    | Elemental   | VIT  | #92400E |

**Mostrado hoje:** Cores definidas mas **não usadas** em `CardVisual`. Identidade visual perdida.
**Sugestão:** Painel "Elementos" acessível em DeckBuilder e Collection. Hover no badge mostra: cor, stat associado, identidade, exemplos de cartas.

### 4.2 Shards → Element units

**Existe:** Drop por enemy type (normal 1–3, elite 6–13, boss 20–30). Bias por classe: warrior 75% physical, mage 75% elemental. 10 shards → 1 element (auto-convert).
**Mostrado hoje:** Badges em `LoopHUD` mostram "S+E" pequenininho. Sem tela dedicada.
**Gap:** Jogador vê "+13 Fire shards" sem saber que isso = 1 element + 3 shards. Bias de classe invisível.
**Sugestão:**
- Painel de shards no Forge: cada elemento com barra de progresso até próximo element unit.
- Tooltip explicando: "10 shards = 1 element. Sua classe (Warrior) tende a dropar físicos (75%)".

### 4.3 Sinergias de adjacência (12 ativas)

| Par                       | Buff                | Valor |
|---------------------------|---------------------|-------|
| Forest + Forest           | goldDropBonus       | +15% |
| Rest + Shop               | hpRecoveryBonus     | +10% |
| Graveyard + Swamp         | damageBonus         | +20% |
| Forest + Swamp            | tileDropBonus       | +15% |
| Graveyard + Graveyard     | xpBonus             | +20% |
| Rest + Event              | eventBonus          | +15% |
| Library + Shop            | cardUpgradeDiscount | -20% |
| Library + Graveyard       | xpBonus             | +25% |
| Arena + Rest              | hpRecoveryBonus     | +20% |
| Arena + Forest            | damageBonus         | +15% |
| Shrine of Pact + Treasure | goldDropBonus       | +30% |
| Shrine of Pact + Graveyard| tileDropBonus       | +20% |

**Mostrado hoje:** Borda colorida entre tiles adjacentes (referência UAT 4.1). **Nenhuma explicação textual.**
**Gap:** Maior mecânica de planning é silenciosa. Player não sabe nem que existe, muito menos os valores.
**Sugestão:**
- Hover sobre borda colorida → popup: "Graveyard + Swamp = +20% damage".
- Painel "Sinergias ativas" no `LoopHUD` durante combate listando o que está ativo.
- Toast ao posicionar tile que cria sinergia: "Combo desbloqueado: +20% damage".

### 4.4 Synergies de combate (cards adjacentes na queue)

**Existe:** `SynergyResolver` resolve combos de cartas no deck.
**Mostrado hoje:** "COMBO!" flash em amarelo.
**Gap:** Pares de carta que combinam **não são previsíveis** antes do play. `synergies.json` em `src/data/json/` está vazio (legado).
**Sugestão:** No DeckBuilder, ao selecionar uma carta, highlight (borda dourada) nas outras com as quais ela combina. Lista textual no detail popup: "Combina com: Strike, Bulwark".

---

## 5. Relíquias

Fonte: `src/data/json/relics.json` (39 relíquias), `src/ui/RelicTooltip.ts`, `src/ui/RelicHudStrip.ts`, `src/scenes/RelicViewerScene.ts`.

### 5.1 Tooltip já existe (parcial)

**Mostrado hoje:** `RelicTooltip.ts` exibe descrição ao hover na HUD strip.
**Gaps:**

a. **Trigger/momento de disparo não explícito:** "First attack each combat" — 1×total ou 1×por inimigo?
b. **Duração:** "+3 Armor on kill" — persiste entre combates?
c. **Origem:** "From: Forge Lv 5" — relic viewer mostra mas tooltip não.
d. **Interações:** Bloodgorged Heart depende de Bleed mas não cita qual carta aplica Bleed.

**Sugestão por relic:**
- Linha "Trigger:" formal (combat_start, on_kill, on_hit, etc.).
- Linha "Resets:" (per combat / per run / never).
- Linha "Source:" (Shrine L2, Forge L5, starter loot).
- Link clicável para mecânicas referenciadas ("Bleed: DoT que escala com…").

### 5.2 Relics class-restricted

**Existe:** Campo `classRestriction` (warrior/mage).
**Mostrado hoje:** Filtrado em geração, mas no Relic Viewer não há badge claro.
**Sugestão:** Badge "⚔ Warrior only" / "🧙 Mage only" no card de relic.

### 5.3 Stacking entre relics

**Gap:** Múltiplas relics que dão "+Armor on hit" — somam? Substitui?
**Sugestão:** Tooltip de cada relic com nota explícita: "Stacks aditivamente com outras relics 'on hit'".

---

## 6. Materiais e Loot

Fonte: `src/data/json/materials.json`, `src/systems/LootGenerator.ts`, `src/systems/CombatLoot.ts`.

### 6.1 Tipos de material

7 tipos: wood, stone, iron, bone, herbs (uncommon), crystal (uncommon), essence (rare).
**Mostrado hoje:** Linha comprimida no LoopHUD com emojis pequenos.
**Gap:** Para que cada material serve? Player só descobre tentando upgrade.
**Sugestão:** Hover em cada material: "Iron: usado em Forge L1–6, Workshop L2–3, Shrine L4. Cai em: Volcano, Orc (45%)."

### 6.2 Gathering boost / death retention

**Existe:** Storehouse aplica `+10%/+15%/.../+25%` em material gain. Death retention 25% base, sobe até 50%.
**Mostrado hoje:** Player vê "+5 wood" sem saber se já está boosted (na verdade, boost é aplicado **no banking**, no fim da run).
**Gap:** Diferença entre coletado em-run e bancado pós-run é invisível.
**Sugestão:** Tela de fim de run com breakdown:
```
Coletado nesta run:  50 wood
× Storehouse L5:     × 1.20
= Bancado:           60 wood
```
Na morte:
```
Coletado:    50 wood
× Retention: × 0.40
= Bancado:   20 wood (perdido: 30)
```

### 6.3 Drops por terreno e inimigo

Ver §3.5. **Sugestão:** Hover em tile do mapa mostra previsão de drops (pool + chance).

### 6.4 Treasure chest

**Existe:** Tabela em `treasure-tables.json`: weights gold 40 / card 30 / relic 10 / tile 20. Gold escala `sqrt(loop)`.
**Gap:** Player abre baú sem saber se loop alto = melhor recompensa.
**Sugestão:** Tooltip do tile Treasure: "Pode dropar: gold (40%), card (30%), tile (20%), relic (10%). Loop afeta valor de gold."

### 6.5 Inline events

**Existe:** 7+ eventos em `InlineEvents` (heal, gold, ambush, rare enemy, slow, damage, drain gold).
**Mostrado hoje:** Notificação ao disparar, sem pré-aviso.
**Gap:** Tile Event tem ícone "?" — player nunca sabe o que vem.
**Sugestão:** Tooltip do tile Event: "Roleta de evento. Adjacência Rest+Event aumenta chance de evento positivo +15%." Pós-evento, log persistente.

---

## 7. Hub, Forja, Buildings

Fonte: `src/data/json/buildings.json`, `src/systems/ForgeSystem.ts`, `src/scenes/CityHubScene.ts`, `BuildingPanelScene.ts`, `ShopScene.ts`, `ForgeScene.ts`, `TavernPanelScene.ts`, `MetaProgressionSystem.ts`.

### 7.1 6 Buildings

| Building | Função | Max Lv |
|----------|--------|--------|
| Forge | Desbloqueia cards + permite craft em-run | 6 |
| Library | Desbloqueia passives (apenas warrior atualmente — ver §12) | 3 |
| Tavern | Starting gold + run history + seed input | 3 |
| Workshop | Desbloqueia tile types (Graveyard L1, Swamp L2) | 3 |
| Shrine | Desbloqueia relics | 4 |
| Storehouse | Gathering boost + death retention | 8 |

**Mostrado hoje:** `BuildingPanelScene` exibe nível, custo, unlocks.
**Gap:**
- Sem tooltip ao hover no edifício do hub. Player clica para descobrir.
- "Qual classe usa este card?" não é mostrado nos unlocks da Forge.
- "Qual building unlocka qual passive/relic" só visível abrindo o building.

**Sugestão:**
- Hover no building no Hub: nome + função em 1 linha.
- Lista global "Unlocks por Building" em uma tela de progressão.
- Badge de classe nos cards unlockáveis ("⚔ Warrior", "🧙 Mage", "🤝 ambos").

### 7.2 Forge em-run (crafting)

**Existe:** Custos T1=75g, T2=200g, T3=500g. Desconto cresce com nível (L2=10% até L6=30%). T3 requer Forge L4.
**Mostrado hoje:** Custo final na UI.
**Gap:**
- Player não vê o desconto aplicado.
- Não vê o custo base.
- "Receitas descobertas" rastreadas em `MetaState.forgeRecipes` mas **nunca exibidas**.

**Sugestão:**
- Card de craft: "Custo: 67g (~~75g~~ - 10% Forge Lv2)".
- Painel "Receitas descobertas" listando combinações elementais já feitas.

### 7.3 Rest site

**Existe:** `rest-config.json` define 3 opções: Rest (+30% HP), Train (+2 dano em card aleatório), Meditate (+5 max stamina/mana).
**Mostrado hoje:** **Possivelmente nunca exibido** — agente meta não encontrou UI ativa.
**Gap:** Se as opções existirem mas não aparecerem em jogo, dead feature. Se aparecerem, faltam tooltips.
**Sugestão:** Verificar implementação. Cada opção deve ter tooltip: efeito exato, persistência (resta combate? toda a run?), exemplos.

### 7.4 Tavern starting gold

**Existe:** Tavern L1=+20g, L2=+50g, L3=+100g.
**Gap (validar):** Agente meta indica que `RunState.economy` não recebe esse valor inicial. Possível bug ou implementação faltando.
**Sugestão de tooltip (assumindo implementado):** No início da run, toast "+50g do Tavern Lv2".

---

## 8. Loop / Planning / Tiles

Fonte: `src/scenes/PlanningOverlay.ts`, `src/ui/TileVisual.ts`, `src/data/json/tiles.json`, `src/data/tiles.json`.

### 8.1 Tipos de tile

| Tile | Ícone hoje | Cor | TP | Função |
|------|------------|-----|-----|--------|
| basic | (nenhum) | cinza | 0 | path automático |
| forest | T | verde | 3 | combate terrain |
| graveyard | + | cinza-verde | 3 | combate terrain |
| swamp | ~ | verde-marrom | 3 | combate terrain |
| shop | $ | amarelo | 4 | compra |
| rest | R | azul | 4 | descanso |
| event | ? | roxo | 2 | RNG event |
| treasure | ! | laranja | 6 | baú |
| boss | B | vermelho | 0 | obrigatório |
| library | L | roxo | 4 | evento especial |
| arena | A | vermelho | 5 | evento especial |
| shrine_of_pact | P | roxo escuro | 4 | evento especial |

**Mostrado hoje:** Ícone letra + cor de fundo. Sem nome.
**Gap crítico:** Player **não sabe ler o próprio mapa que acabou de construir**.
**Sugestão:**
- Substituir letras por ícones pictográficos (árvore, túmulo, cifrão, fogueira, ?, baú, espada, livro, coliseu, pacto).
- Hover em qualquer tile do planning grid: nome + custo TP + função + sinergias adjacentes ativas.
- Legenda compacta canto inferior do planning.

### 8.2 TP (Tile Points)

**Existe:** Recurso para colocar tiles. Ganha completando loops.
**Mostrado hoje:** "0 TP" em texto no LoopHUD.
**Gap:**
- Player novo não sabe o que é TP.
- Custo de tile selecionado vs TP disponível sem visualização.

**Sugestão:**
- Tooltip "TP": "Tile Points — gasta ao colocar tiles. Ganha completando loops. Bosses não custam TP."
- Barra preenchida igual a HP, atualizando ao hover de tile candidato ("Custo: 4 → restante: 6 TP").

### 8.3 Loop progress bar

**Existe:** Barra "LOOP PROGRESS" cyan no centro do LoopHUD.
**Gap:** Ambiguidade — é progresso de mapa ou progresso de combate?
**Sugestão:** Renomear "Map Progress" + tooltip: "Distância percorrida no loop atual".

### 8.4 Difficulty badge ("x1.0")

**Existe:** Multiplicador de loop.
**Gap:** Sigla sem contexto.
**Sugestão:** Tooltip: "Loop 3 → +60% HP/dano inimigo. Bosses crescem metade. Recompensas de gold escalam log₂."

---

## 9. Tutorial, Menus e Onboarding

Fonte: `src/scenes/TutorialScene.ts`, `MainMenu.ts`, `CharacterSelectScene.ts`, `DeckBuilderScene.ts`, `PauseScene.ts`, `SettingsScene.ts`, `RunTransitionScene.ts`.

### 9.1 Tutorial atual (6 telas)

**Mostrado hoje:** Texto puro amarelo em painel central, navegação SPACE/clique, contador 1/6.
**Gaps:**
- Sem imagens/sprites de exemplo.
- Não explica sistema de elementos, sinergias, TP, atributos.
- "Tile Placement" mencionado mas sem explicar custo.
- "COMBO highlights" mencionados sem mostrar.

**Sugestão (expansão):**
- 12–15 telas com sprites + GIFs curtos.
- Ordem revisada: 1) Loop e tiles → 2) TP → 3) Combate auto → 4) Atributos (STR/VIT/DEX/INT/SPI) → 5) Elementos → 6) Sinergia de tiles → 7) Sinergia de cards → 8) Status effects → 9) Forja em-run → 10) Hub → 11) Death/Retention → 12) Goals.

### 9.2 Character Select

**Existe:** Cards de Warrior/Mage com sprites animados, descrição de 1 linha, 3 stat bars (HP/STA/MP).
**Gaps:**
- "Balanced melee fighter" é genérico demais.
- Não menciona passivas que serão desbloqueadas com XP.
- Atributos crus sem contexto.
- "Strikes, Defends, Heavy Hit" — sem indicar o que cada uma faz.

**Sugestão:**
- Hover no card: bio detalhada + identidade ("Warrior: tank STR/VIT, escala Rage. Mage: glass cannon INT/SPI, escala Burn/Heal").
- Mostrar primeiras passivas a desbloquear ("Library Lv1 → Battle Hardened").
- Sample-deck preview clicável: cada card já em modo full detail.

### 9.3 Deck Builder / Deck Customization

**Gaps já cobertos em §1.** Adicionalmente:
- Filtro por elemento/tier ausente.
- Não há indicador de cap de deck ou min/max recomendado.

### 9.4 Main Menu

**Mostrado hoje:** Botões Continue / New Run.
**Gap:**
- "Continue Run" pode confundir (retorna ao planning).
- Atalhos D/R/ESC não documentados em nenhum lugar.
- Seed (em `RunTransitionScene`) exibido sem explicação.

**Sugestão:** Hover em "Continue Run". Footer discreto: "ESC pausa | D abre Deck | R abre Relics".

### 9.5 Settings

**Mostrado hoje:** Sliders e toggles.
**Gap:**
- Game Speed 1x/2x não diz se afeta cálculo de dano (apenas visual).
- Auto-Save sem contexto (quando salva?).
- "Reset All Progress" sem confirmação dupla.

**Sugestão:** Tooltip em cada toggle. Modal de confirmação obrigatório no Reset com checkbox "Sim, tenho certeza".

---

## 10. Death, Game Over e Persistência

Fonte: `DeathScene.ts`, `GameOverScene.ts`, `MetaPersistence.ts`.

### 10.1 Tela de morte

**Mostrado hoje:** "RUN OVER" + "Defeated by {enemy}" + painel de stats + grid de materiais retidos + nota "All unbanked XP has been lost".

**Gaps:**
- "Unbanked XP" — player não sabe que XP precisa ser bancado (e onde — Tavern, suposto).
- "25% of materials retained" — sem indicação de como aumentar (Storehouse).
- "New unlocks available!" — sem dizer onde ver (Library/Forge/Shrine).

**Sugestão:**
- Linha "💡 Aumente Storehouse para reter mais materiais".
- Linha "💡 XP bancado a cada {evento}. Sua run morreu antes — XP perdido".
- Botão "Ver Unlocks" levando direto ao building que desbloqueou.

### 10.2 Run history

**Existe:** Tavern L2 desbloqueia campo `runHistoryVisible`, persistido em `MetaState.runHistory`.
**Gap:** UI não implementada (agente meta sinaliza missing).
**Sugestão:** Painel acessível no Tavern listando runs anteriores: classe, loops, gold, mortes, melhor combo. Útil para autoanálise.

---

## 11. Matriz de Prioridades

Ranqueado por **impacto no entendimento** × **custo de implementação**.

### P0 — High impact, low effort (1–3 dias cada)

| # | Item | Onde | Justificativa |
|---|------|------|---------------|
| 1 | **Tooltip de tile no planning** (nome + custo + função) | `PlanningOverlay.ts`, `TileVisual.ts` | Tile é a unidade fundamental, hoje ininteligível |
| 2 | **Stat scaling visível em cards** ("+1 por STR") | `CardVisual.ts`, `CardDetailPopup.ts` | Dado já existe em `effect.scale`, só renderizar |
| 3 | **Element composition badge** na carta (bolinhas coloridas) | `CardVisual.ts` | Cores já em `elements.json`, parse do ID |
| 4 | **Enemy affinity icon** no enemy panel | `CombatHUD.ts` | 1 ícone + tooltip |
| 5 | **Status effect chips** (burn/poison/freeze ativos) no HUD | `CombatHUD.ts` | Dado já no `CombatState` |
| 6 | **Tooltip de stats (STR/VIT/DEX/INT/SPI)** | `LoopHUD.ts`, `CombatHUD.ts` | Hover sobre sigla → efeito + formula |
| 7 | **Tooltip de TP** + barra dinâmica de custo | `LoopHUD.ts` | Conceito nuclear, hoje invisível |
| 8 | **Atalhos no Main Menu/Pause** | `MainMenu.ts`, `PauseScene.ts` | Footer 12px discreto |
| 9 | **Unificar paleta de raridade** entre CardVisual e DetailPopup | both | 5 min de fix, evita confusão |
| 10 | **Confirmation modal** no "Reset All Progress" | `SettingsScene.ts` | Salva o jogador de si mesmo |

### P1 — High impact, medium effort (3–7 dias cada)

| # | Item | Onde |
|---|------|------|
| 11 | **Glossário de keywords** (hover em "Burn"/"Freeze"/"Rage" abre mini-tooltip) | `CardDetailPopup.ts`, novo `KeywordTooltip.ts` |
| 12 | **Telegrafia de intenção do inimigo** ("Próximo: 10 dmg + Stun?") | `CombatHUD.ts`, `EnemyAI.ts` |
| 13 | **Floating numbers** para DoT/armor/affinity em cores distintas | `CombatEffects.ts` |
| 14 | **Synergy popup ao posicionar tile adjacente** | `PlanningOverlay.ts` |
| 15 | **Painel "Sinergias ativas"** em combate | novo widget no `LoopHUD` |
| 16 | **Breakdown end-of-run** (coletado → bancado, com boosts/retentions explícitos) | `GameOverScene.ts`, `DeathScene.ts` |
| 17 | **Shard inventory panel** com barras de progresso para conversão | `ForgeScene.ts` |
| 18 | **Pictogram icons** para tiles (substitui letras T/+/~/etc.) | `TileVisual.ts` + arte |

### P2 — Medium impact, higher effort (1–2 semanas cada)

| # | Item |
|---|------|
| 19 | **Expansão do Tutorial** (6 → 12–15 telas com sprites e GIFs) |
| 20 | **Bestiário acessível** (Collection/Library) com info de inimigos encontrados |
| 21 | **Card upgrade side-by-side diff** no detail popup |
| 22 | **Forge "Receitas descobertas"** painel |
| 23 | **Run history UI** acessível pelo Tavern Lv2+ |
| 24 | **Building hover tooltips** no City Hub |
| 25 | **Rest site UI** (verificar se está implementado, expor 3 opções com tooltips) |

### P3 — Polishing / nice-to-have

| # | Item |
|---|------|
| 26 | Combat post-result detailed breakdown (dano por elemento, carta mais usada, etc.) |
| 27 | Animação distinta por tipo de synergy flash |
| 28 | Pré-visualização de drops por tile/inimigo (após primeiro encontro) |
| 29 | Filtros em DeckBuilder/CollectionScene |
| 30 | Loop celebration variants (animar cards descobertos) |

---

## 12. Débito de Dados e Definições Faltantes

Itens descobertos como **incompletos / inconsistentes** durante a pesquisa. **Não são pedidos de tooltip** — são pré-requisitos para que tooltips façam sentido.

| Item | Status | Local |
|------|--------|-------|
| **Warrior Spirit** (relic referenciado em `buildings.json` Shrine Lv1) | Não existe em `relics.json` | `relics.json` precisa entry |
| **Spell Focus** (relic referenciado em `buildings.json` Shrine Lv3) | Não existe em `relics.json` | idem |
| **Library para Mage** | Mage tem 5 passivas em `mage-passives.json` mas Library só desbloqueia warrior passives | Decidir: Library dual-class ou novo building |
| **Synergies (cards na queue)** | `src/data/json/synergies.json` está `[]`. **Atenção:** o sistema usa `src/data/synergies.json` (12 sinergias de tiles). O do `json/` é legado/duplicata órfã | Limpar arquivo morto |
| **XP cost vs Material cost para passivas** | `warrior-passives.json` tem `xpThreshold`, `passives.json` tem `xpCost`, `buildings.json` define material cost para Library tiers | Decidir economia única |
| **Tavern starting gold implementado?** | `buildings.json` define +20/+50/+100 mas agente meta indica que `RunState.economy` pode não receber | Verificar `createNewRun()` |
| **Rest site UI** | `rest-config.json` define 3 opções mas pode não estar wired ao tile | Verificar `RestSiteSystem.ts` e tile interaction |
| **Bosses sem behaviors** | `behaviors: []` em todos os 3 bosses | Popular se design pretende usar enrage/shield/drain |
| **Death retention baseline** | Storehouse cresce 30%→50%, mas sem Storehouse qual é o default? | Documentar |
| **Tier 3 cards locked** | `cards-tier3-mocks.json` é mock; pool real não existe ainda | Decisão de roadmap |
| **CollectionScene** | EXISTE e está implementada (Cards/Relics/Tiles/Bosses tabs) — mas referenciada por "unlock celebration" sem caminho de navegação claro do Hub | Adicionar entrypoint visível |
| **Hero base stats por classe** | `hero-stats.json` é compartilhado, mas warrior e mage têm HP diferentes (100 vs 70 em `CharacterSelectScene`). Inconsistência ou override em runtime? | Auditar source of truth |

---

## Notas finais

- **Documento é READ-ONLY:** próximo passo é priorizar com o time. Sugestão: rodar P0 inteiro num sprint de polish, depois decidir P1 e o débito de dados na §12 em ordem de risco.
- **Validação realizada:** contagens cruzadas contra `cards.json` (156 cards confirmadas), `enemies.json` (20 inimigos), `relics.json` (39 — agente meta disse 42, valor real é 39), `synergies.json` ativo (12, confirmado em `src/data/synergies.json`), `CollectionScene.ts` (existe e implementada — agente meta errou). Demais achados não contraditos pelo código foram tratados como confiáveis.
- **Não cobertos por esta pesquisa** (intencionalmente, por escopo): áudio, performance, save/load, telemetria, acessibilidade.
