# Autoscroller — Game Design Document (GDD)

**Versao:** 1.0
**Ultima atualizacao:** 2026-03-25
**Engine:** Phaser (HTML5/Canvas)
**Plataforma:** Web browser

---

## Sumario

1. [Visao Geral do Jogo](#1-visao-geral-do-jogo)
2. [Core Loop](#2-core-loop)
3. [Sistema de Loop e Tiles](#3-sistema-de-loop-e-tiles)
4. [Sistema de Combate](#4-sistema-de-combate)
5. [Sistema de Deck Management](#5-sistema-de-deck-management)
6. [Inimigos e Bosses](#6-inimigos-e-bosses)
7. [Heroi e Classes](#7-heroi-e-classes)
8. [Reliquias e Artefatos](#8-reliquias-e-artefatos)
9. [Economia do Jogo](#9-economia-do-jogo)
10. [Meta-progressao](#10-meta-progressao)
11. [Multiplayer (Design Futuro)](#11-multiplayer-design-futuro)
12. [Tiles Especiais — Detalhamento](#12-tiles-especiais--detalhamento)
13. [Interface e UX](#13-interface-e-ux)
14. [Audio (Diretrizes)](#14-audio-diretrizes)
15. [Balanceamento (Diretrizes)](#15-balanceamento-diretrizes)

---

## 1. Visao Geral do Jogo

### 1.1 Conceito (Elevator Pitch)

Autoscroller e um roguelike de deckbuilding estrategico onde o jogador constroi um circuito de tiles de terreno e monta um deck de cartas, mas nunca controla o combate diretamente. O heroi percorre o loop automaticamente em side-view, enfrentando inimigos que spawnam conforme os terrenos posicionados. O combate e 100% automatico e em tempo real — toda a estrategia esta na construcao, ordenacao e refinamento do deck de cartas e na escolha de quais tiles posicionar no caminho.

**A fantasia do jogador:** ser um arquiteto estrategista, nao um lutador. A satisfacao vem de assistir um deck bem construido funcionar perfeitamente.

### 1.2 Genero e Referencias

| Referencia | O que inspira |
|---|---|
| **Loop Hero** | Mecanica de loop, posicionamento de tiles durante a run, terrenos que spawnam inimigos, progressao por repeticao |
| **Slay the Spire** | Deckbuilding, custo escalonavel de remocao de cartas, reliquias como itens passivos, modelo de progressao hibrido (run + meta) |
| **Auto-battlers** | Combate sem intervencao do jogador, estrategia concentrada na preparacao |

**Genero composto:** Roguelike + Deckbuilder + Auto-battler + Loop-builder

### 1.3 Plataforma e Publico-alvo

- **Plataforma:** Web browser (HTML5/Canvas via Phaser)
- **Resolucao base:** 800x600 pixels
- **Publico-alvo:** Jogadores de roguelikes, deckbuilders e jogos estrategicos que apreciam sistemas interconectados e otimizacao. Jogadores que gostam de "assistir o plano funcionar". Faixa etaria 16+.
- **Sessao tipica:** 1h+ por run (runs longas com investimento alto — morte tem peso real)

### 1.4 Pilares de Design

1. **Deckbuilding como estrategia central:** Toda decisao relevante acontece na composicao e ordenacao do deck. O combate e o reflexo dessas decisoes.
2. **Duas camadas de estrategia paralelas:** Uma sobre o mundo (quais tiles posicionar e onde) e outra sobre o combate (deck). O jogador gerencia ambas simultaneamente.
3. **Tensao de attrition:** HP persiste entre combates. Cada luta desgasta o heroi, criando decisoes de risco/recompensa sobre quando continuar e quando sair.
4. **Meta-progressao significativa:** Cada run, mesmo as que terminam em morte, contribuem para desbloquear novas possibilidades e expandir o espaco estrategico.

---

## 2. Core Loop

### 2.1 Fluxo de uma Run Completa

```
[HUB / ACAMPAMENTO]
        |
        v
[INICIO DA RUN] --> Heroi entra no loop com deck inicial
        |
        v
  +---> [PERCORRER TILES] <--- Heroi anda automaticamente (side-view)
  |           |
  |           v
  |     [ENCONTRO COM TILE]
  |       /    |    |    |    \
  |   Combat  Shop  Rest Event Treasure
  |       \    |    |    |    /
  |           v
  |     [RESOLVER TILE]
  |       - Combate: auto-duel com deck
  |       - Loja: comprar/remover/reordenar cartas
  |       - Descanso: recuperar HP
  |       - Evento: escolha narrativa
  |       - Tesouro: loot gratuito
  |           |
  |           v
  |     [LOOP COMPLETO?]
  |       Nao --> continua percorrendo
  |       Sim --> ganhar pontos de tile, escalacao de dificuldade
  |           |
  |           v
  |     [BOSS A CADA X LOOPS?]
  |       Nao --> volta para PERCORRER TILES
  |       Sim --> COMBATE DE BOSS
  |                   |
  |               [BOSS DERROTADO?]
  |                 Sim --> [OPCAO: SAIR OU CONTINUAR]
  |                   |         |
  |                   |     Sair --> Retorna ao HUB com 100% dos rewards
  |                   |     Continuar --> volta para PERCORRER TILES
  |                   |
  |                 Nao --> [MORTE]
  |                           |
  |                           v
  |                   Retorna ao HUB com 25% dos rewards
  |           |
  +-----------|
              v
    [MORTE EM QUALQUER COMBATE]
              |
              v
    Retorna ao HUB com 25% dos rewards
```

### 2.2 Progressao Dentro de uma Run

1. **Loops iniciais (1-3):** Inimigos fracos (multiplicador 0.5x no loop 1), deck inicial. Jogador aprende o ritmo e comeca a posicionar tiles.
2. **Loops intermediarios (4-7):** Dificuldade escalando (formula logaritmica), jogador ja tem cartas adicionais, reliquias e ouro para personalizar deck.
3. **Loops avancados (8+):** Inimigos significativamente mais fortes. Deck deve estar refinado. Decisoes de risco/recompensa sobre continuar ou sair no proximo boss.
4. **Boss (a cada X loops):** Teste de stress do deck. Se vencer, opcao de sair com rewards completos ou arriscar mais loops.

### 2.3 Condicoes de Vitoria e Derrota

- **Vitoria parcial (saida segura):** Derrotar boss e escolher sair. Retorna ao hub com 100% dos rewards acumulados (gold, XP, desbloqueios).
- **Derrota (morte):** HP do heroi chega a zero em qualquer combate. Retorna ao hub com apenas 25% dos rewards acumulados.
- **Nao ha vitoria final no MVP.** O objetivo e sobreviver o maximo de loops possivel e acumular rewards para meta-progressao.

---

## 3. Sistema de Loop e Tiles

### 3.1 Como o Loop Funciona

O loop e um circuito de tiles que o heroi percorre automaticamente em side-view (perspectiva lateral, scrolling horizontal). O jogador **nao controla o movimento** — o heroi anda sozinho da esquerda para a direita, retornando ao inicio ao completar o circuito.

- **Comprimento do loop:** 20 tiles por padrao
- **Velocidade base do heroi:** 2 unidades/frame (configuravel via `moveSpeed`)
- **Tiles iniciais:** Todos os tiles comecam como "Path" (basico/vazio). O jogador preenche com tiles posicionados.
- **Ultimo tile:** Determinado dinamicamente — basico nos loops normais, boss no loop de boss

### 3.2 Tipos de Tiles

| Tile | Cor | Pode posicionar? | Descricao |
|---|---|---|---|
| **Path (basico)** | Cinza (#666666) | Nao | Tile vazio, sem interacao. Heroi apenas caminha. |
| **Combat** | Vermelho escuro (#880000) | Sim | Spawna inimigos normais para combate. |
| **Elite Combat** | Vermelho (#AA0000) | Sim | Spawna inimigos elite (mais fortes, melhor loot). |
| **Boss** | Vermelho vivo (#FF0000) | Nao | Tile de boss, posicionado automaticamente a cada X loops. |
| **Shop** | Dourado (#FFD700) | Sim | Abre a loja (comprar cartas, remover, reordenar, reliquias). |
| **Rest Site** | Azul royal (#4169E1) | Sim | Recupera HP do heroi. |
| **Event** | Purpura (#9370DB) | Sim | Encontro narrativo com escolhas e consequencias. |
| **Treasure** | Laranja (#FF8C00) | Sim | Loot gratuito (cartas, gold, reliquias). |

### 3.3 Sistema de Pontos de Tile

**Obtencao:**
- A cada loop completo, o jogador ganha pontos de tile (quantidade base a definir no balanceamento)
- Pontos se acumulam e podem ser gastos a qualquer momento

**Gasto:**
- Posicionar tiles de terreno no caminho custa pontos de tile
- Tiles mais poderosos (elite, shop, treasure) custam mais pontos

**Drops de tiles de inimigos:**
- Inimigos tem chance de dropar tiles ao serem derrotados
- Tiles dropados sao **gratuitos** (nao custam pontos para inserir)
- Tiles dropados podem ser **vendidos** por pontos de tile (taxa reduzida)
- Tiles dropados sao inseridos no fim do loop

**Tabela de drops de tiles por inimigo (valores atuais):**

| Inimigo | Tile | Chance | Quantidade |
|---|---|---|---|
| Slime | Combat | 30% | 1 |
| Goblin | Combat | 40% | 1-2 |
| Goblin | Event | 20% | 1 |
| Orc | Combat | 50% | 1-2 |
| Orc | Rest | 30% | 1 |
| Dark Mage | Event | 50% | 1-2 |
| Dark Mage | Shop | 30% | 1 |
| Elite Knight | Combat | 70% | 2-3 |
| Elite Knight | Elite | 40% | 1 |
| Elite Knight | Shop | 50% | 1 |
| Demon Lord | Combat | 100% | 3-5 |
| Demon Lord | Elite | 80% | 1-2 |
| Demon Lord | Treasure | 60% | 1-2 |
| Demon Lord | Shop | 70% | 1-2 |
| Demon Lord | Rest | 80% | 1-2 |

### 3.4 Interacoes entre Tiles Adjacentes (Sinergias)

Tiles adjacentes podem interagir entre si, criando sinergias estrategicas. Exemplos planejados:

- **Combat + Combat:** Chance de spawnar grupo maior de inimigos (mais gold, mais risco)
- **Rest + Rest:** Cura ampliada no segundo tile de descanso
- **Shop + Event:** Loja com desconto ou evento com opcoes adicionais
- **Treasure + Combat:** Inimigos do combate dropam loot extra

> *Nota: sistema de sinergias entre tiles ainda em design. Valores e combinacoes serao definidos durante playtesting.*

### 3.5 Escalacao de Dificuldade por Loop

A dificuldade escala a cada loop completo usando uma formula logaritmica:

```
multiplicador = 1 + log2(numero_do_loop)
```

**Excecao:** No loop 1, o multiplicador e **0.5** (inimigos mais fracos para onboarding).

Esse multiplicador afeta:
- HP dos inimigos
- Dano dos inimigos
- Defesa dos inimigos
- Gold dropado escala com raiz quadrada do multiplicador (cresce mais devagar)

**Tabela de exemplo (inimigo Slime, HP base 100):**

| Loop | Multiplicador | HP | Dano | Gold medio |
|---|---|---|---|---|
| 1 | 0.5x | 50 | 4 | 11 |
| 2 | 2.0x | 200 | 16 | 21 |
| 3 | 2.58x | 258 | 21 | 24 |
| 5 | 3.32x | 332 | 27 | 27 |
| 10 | 4.32x | 432 | 35 | 31 |

---

## 4. Sistema de Combate

### 4.1 Visao Geral

O combate e **100% automatico** e em **tempo real**. O jogador nao tem nenhuma interacao durante a luta. O heroi joga cartas do topo do deck sequencialmente, respeitando cooldowns e custos de recursos. A estrategia esta inteiramente no deckbuilding pre-combate.

### 4.2 Fluxo do Combate

1. Heroi encontra tile de combate
2. Tela de combate abre (cena separada)
3. Stamina e Mana resetam para o maximo. HP se mantem do estado atual.
4. Heroi joga a carta do topo do deck
5. Se tem recurso suficiente (stamina/mana), a carta e executada
6. Se nao tem recurso, a carta e pulada e a proxima e tentada
7. Apos jogar, cooldown da carta se aplica antes da proxima acao
8. Ao esgotar todas as cartas do deck, reshuffle e recomeça do topo
9. Combate termina quando todos os inimigos morrem (vitoria) ou o heroi morre (derrota)

### 4.3 Sistema de Deck no Combate

- **Ordem fixa:** Cartas sao jogadas na ordem em que estao no deck (de cima para baixo)
- **Reshuffle:** Ao esgotar o deck, todas as cartas voltam para o topo na mesma ordem original
- **Visibilidade total:** O deck inteiro e visivel durante o combate — o jogador pode acompanhar qual carta sera jogada em seguida
- **Deck inicial (Warrior):** 4x Strike, 4x Defend, 1x Heavy Hit, 1x Fireball (10 cartas)

### 4.4 Cooldown por Carta

Cada carta tem um cooldown proprio que determina quanto tempo o heroi espera antes de jogar a proxima carta. Isso cria uma dinamica de **cartas leves vs pesadas**:

- **Cartas leves:** Baixo cooldown, efeito menor (ex: Strike — dano 10, cooldown rapido)
- **Cartas pesadas:** Alto cooldown, efeito maior (ex: Berserker — dano 40, cooldown longo)

> *Nota: valores exatos de cooldown por carta a serem definidos durante playtesting. Diretriz: cartas com efeitos 2x mais fortes devem ter cooldowns 1.5x-2x mais longos.*

### 4.5 Tipos de Carta

#### Cartas de Ataque

Causam dano aos inimigos. Consomem **stamina**.

| Carta | Dano | Custo | Efeito especial |
|---|---|---|---|
| **Strike** | 10 | Nenhum | Ataque basico sem custo |
| **Heavy Hit** | 20 | 5 Stamina | Dano moderado |
| **Fury** | 30 | 10 Defense | Sacrifica defesa por dano |
| **Berserker** | 40 | 15 Stamina + 5 Defense | Ataque devastador com alto custo |

#### Cartas de Defesa

Geram armadura (defesa temporaria). Consomem **stamina**.

| Carta | Armadura | Custo | Efeito especial |
|---|---|---|---|
| **Defend** | 5 | Nenhum | Defesa basica sem custo |
| **Shield Wall** | 15 | 5 Stamina | Defesa solida |
| **Fortify** | 25 | 10 Stamina | Defesa pesada |
| **Iron Skin** | 20 | 5 Mana | Defesa magica |

#### Cartas de Magia

Efeitos variados. Consomem **mana**.

| Carta | Efeito | Custo | Descricao |
|---|---|---|---|
| **Fireball** | 15 dano | 5 Mana | Ataque magico |
| **Heal** | 15 cura HP | 8 Mana | Cura direta (persiste entre combates!) |
| **Arcane Shield** | 10 armadura | 6 Mana | Defesa via mana |
| **Rejuvenate** | +10 Stamina | 5 Mana | Converte mana em stamina |
| **Mana Drain** | 8 dano + 5 mana | Nenhum | Dano + recuperacao de mana |
| **Weaken** | 5 dano + debuff -5 def | 7 Mana | Dano + enfraquece inimigo |

#### Cartas de Maldicao (Curse)

Cartas negativas que entram no deck por eventos ou efeitos. **Nao podem ser jogadas utilmente** — apenas ocupam espaco ou causam efeitos negativos.

| Maldicao | Efeito ao ser jogada |
|---|---|
| **Pain** | Nada. Apenas ocupa espaco no deck. |
| **Wound** | Perde 2 HP. |
| **Weakness** | Todas as cartas no turno causam -2 de dano. |
| **Fragility** | Recebe +50% de dano no turno. |

### 4.6 Sistema de Recursos

#### Stamina
- **Maximo base:** 50
- **Uso:** Cartas de ataque e defesa
- **Regeneracao:** Cartas especificas (Rejuvenate), regeneracao natural por turno (a definir)
- **Reset:** Volta ao maximo entre combates

#### Mana
- **Maximo base:** 30
- **Uso:** Cartas de magia
- **Regeneracao:** Cartas especificas (Mana Drain), regeneracao natural por turno (a definir)
- **Reset:** Volta ao maximo entre combates

#### HP (Pontos de Vida)
- **Maximo base:** 100
- **Persiste entre combates** — nao reseta
- **Recuperacao:** Tiles de descanso, carta Heal, eventos, loja
- **Chegar a 0 = morte da run**

#### Defense (Armadura)
- **Maximo base:** 0 (gerada por cartas durante combate)
- **Absorve dano antes do HP**
- **Comportamento entre combates:** a definir (reseta ou persiste parcialmente)

### 4.7 Targeting por Carta

Cada carta define como seleciona seu alvo:

- **Single:** Ataca o primeiro inimigo
- **AoE (Area of Effect):** Ataca todos os inimigos
- **Menor HP:** Ataca o inimigo com menos vida (finalizar fracos)
- **Aleatorio:** Alvo aleatorio entre os inimigos presentes

> *Nota: no MVP atual, targeting e implicitamente single-target. Sistema de targeting multiplo sera expandido conforme mais cartas forem adicionadas.*

### 4.8 Sinergias entre Cartas Sequenciais

Certas combinacoes de cartas jogadas em sequencia ativam bonus:

**Exemplo de sinergia:**
- **Defend + Fury:** O Defend prepara a postura defensiva, e Fury aproveita sacrificando essa defesa por dano dobrado
- **Shield Wall + Strike:** Defesa solida seguida de contra-ataque — bonus de dano
- **Heal + Fireball:** Energia restaurada canalizada em dano magico amplificado

**Regra de design:** Nem todas as cartas tem sinergias. Isso e intencional como fator de balanceamento — o jogador precisa descobrir quais combinacoes funcionam e ordenar o deck de acordo. Sinergias nao devem ser obvias demais nem universais.

### 4.9 Sistema de Upgrade de Cartas

Cartas podem ser melhoradas (upgraded) na loja. Uma carta upgraded recebe bonus:

- **Bonus de dano:** +X dano adicional
- **Bonus de cura:** +X cura adicional
- **Bonus de armadura:** +X armadura adicional
- **Reducao de custo:** Custo de stamina/mana reduzido

Custo de upgrade na dificuldade normal: **100 gold**.

---

## 5. Sistema de Deck Management

### 5.1 Filosofia de Design

O deck e a **arma principal** do jogador. Gerencia-lo e o nucleo da experiencia. Tres operacoes fundamentais:

1. **Adicionar cartas** — expandir opcoes
2. **Remover cartas** — refinar e focar
3. **Reordenar cartas** — otimizar sequencia e sinergias

**Deck thinning (afinar o deck)** e uma estrategia explicitamente valida e encorajada. Um deck menor significa que as cartas mais fortes aparecem com mais frequencia. O custo escalonavel de remocao cria uma curva de investimento.

### 5.2 Adicionar Cartas

- **Custo:** Gratuito
- **Mecanica:** Ao ganhar uma carta (drop de inimigo, tesouro, evento), o jogador recebe a opcao de **aceitar ou descartar**. Aceitar adiciona ao deck; descartar descarta permanentemente.
- **Drops de inimigo:** Apresentam X opcoes ao jogador (3 para normais, 4 para elites, 5 para bosses). Jogador escolhe UMA carta ou nenhuma.
- **Loja:** Comprar carta por gold (custo base: 60 gold na dificuldade normal)

### 5.3 Remover Cartas

- **Onde:** Apenas na loja
- **Custo base:** 75 gold (dificuldade normal)
- **Custo escalonavel:** Quanto menor o deck, mais caro remover. Formula sugerida:

```
custo_remocao = custo_base * (1 + 0.25 * max(0, 15 - tamanho_deck))
```

**Tabela de custo de remocao (base 75 gold):**

| Tamanho do deck | Custo |
|---|---|
| 15+ cartas | 75 gold |
| 12 cartas | 131 gold |
| 10 cartas | 169 gold |
| 8 cartas | 206 gold |
| 6 cartas | 244 gold |
| 5 cartas | 263 gold |

> *Nota: valores iniciais para playtesting. O objetivo e que decks com 5-6 cartas sejam viaveis mas caros de atingir.*

### 5.4 Reordenar Deck

- **Onde:** Loja ou tela dedicada de deck management (DeckCustomizationScene)
- **Custo:** Gold na loja (a definir — sugestao: 25-50 gold por reordenacao)
- **Mecanica:** O jogador pode arrastar cartas para qualquer posicao no deck
- **Importancia estrategica:** A ordem define quais cartas sao jogadas primeiro, quais sinergias se ativam, e como os recursos sao gerenciados

### 5.5 Fontes de Obtencao de Cartas

| Fonte | Tipo | Frequencia |
|---|---|---|
| Drop de inimigo normal | Escolha entre 3 opcoes | A cada combate (nao garantido) |
| Drop de inimigo elite | Escolha entre 4 opcoes | A cada combate elite |
| Drop de boss | Escolha entre 5 opcoes | A cada boss derrotado |
| Tile de tesouro | Carta aleatoria | Ao pisar no tile |
| Tile de evento | Depende da escolha | Variavel |
| Loja | Compra direta | Ao visitar loja |
| Meta-progressao | Desbloqueio permanente | Entre runs |

### 5.6 Pools de Cartas por Inimigo

Cada tipo de inimigo dropa cartas de um pool especifico:

| Inimigo | Pool de cartas |
|---|---|
| Slime | Strike, Defend, Heavy Hit, Shield Wall, Fireball, Heal |
| Goblin | Strike, Defend, Heavy Hit, Berserk, Quick Strike |
| Orc | Heavy Hit, Shield Wall, Defend, Fortress |
| Dark Mage | Fireball, Heal, Frost, Arcane Blast |
| Elite Knight | Heavy Hit, Shield Wall, Fortress, Berserk |
| Demon Lord | Berserk, Fury, Fireball, Arcane Blast, Fortress |

---

## 6. Inimigos e Bosses

### 6.1 Filosofia de IA

Inimigos tem IA simples e previsivel. A dificuldade nao vem da inteligencia dos inimigos, mas da escalacao de stats e da composicao de encontros. O jogador deve poder "ler" o comportamento dos inimigos e planejar seu deck de acordo.

### 6.2 Tipos de Inimigo

#### Inimigos Normais

| Inimigo | HP Base | Defesa Base | Dano Base | Padrao | Efeito Especial | Gold |
|---|---|---|---|---|---|---|
| **Slime** | 100 | 0 | 8 | Fixo | Nenhum | 10-20 |
| **Goblin** | 75 | 0 | 6 | Aleatorio | 30% chance de dano dobrado | 15-25 |
| **Orc** | 175 | 10 | 12 | Fixo | +5 defesa por ataque | 20-30 |
| **Dark Mage** | 85 | 0 | 7 | Condicional | Debuff; +50% dano se heroi <50% HP | 25-35 |

#### Inimigos Elite

| Inimigo | HP Base | Defesa Base | Dano Base | Padrao | Efeito Especial | Gold |
|---|---|---|---|---|---|---|
| **Elite Knight** | 200 | 15 | 15 | Escalante | +0.5 dano/turno, +8 defesa/ataque | 50-80 |

#### Bosses

| Boss | HP Base | Defesa Base | Dano Base | Padrao | Efeito Especial | Gold |
|---|---|---|---|---|---|---|
| **Demon Lord** | 400 | 20 | 20 | Escalante | Lifesteal, +0.5 dano/turno, +10 defesa/ataque | 100-150 |

### 6.3 Padroes de Ataque

| Padrao | Comportamento |
|---|---|
| **Fixed (Fixo)** | Dano constante a cada ataque |
| **Random (Aleatorio)** | Dano varia entre 80%-120% do base |
| **Scaling (Escalante)** | Dano aumenta +0.5 por turno de combate |
| **Conditional (Condicional)** | Muda comportamento baseado no estado do heroi (ex: +50% dano se heroi <50% HP) |

### 6.4 Efeitos Especiais de Inimigos

| Efeito | Descricao |
|---|---|
| **Double** | 30% de chance de atacar duas vezes |
| **Stun** | Impede o heroi de jogar a proxima carta (futuro) |
| **Debuff** | Reduz stats do heroi temporariamente |
| **Lifesteal** | Recupera HP proporcional ao dano causado |

### 6.5 Escalacao por Loop

Todos os stats dos inimigos escalam com o multiplicador do loop:

```
stats_escalados = stats_base * multiplicador_do_loop
gold_escalado = gold_medio * sqrt(multiplicador_do_loop)
```

### 6.6 Spawning de Inimigos

- Inimigos spawnam conforme o **tipo de tile** que o heroi pisa
- Tiles de **Combat** spawnam 1-3 inimigos normais aleatorios
- Tiles de **Elite** spawnam 1 inimigo elite (chance de inimigos normais acompanharem)
- Tiles de **Boss** spawnam o boss do loop atual
- Terrenos diferentes podem favorecer tipos especificos de inimigos (futuro)

### 6.7 Bosses — Design Futuro

No MVP, bosses sao "inimigos turbinados" com stats muito altos. Para versoes futuras:

- **Fases:** Boss muda de comportamento ao atingir thresholds de HP (ex: 75%, 50%, 25%)
- **Imunidades:** Periodos de invulnerabilidade que exigem estrategia de timing no deck
- **Ataques especiais:** AoE, invocacao de minions, cura, debuffs pesados
- **Bosses unicos por bioma/tema:** Cada "mundo" teria seu boss tematico

---

## 7. Heroi e Classes

### 7.1 Stats Base do Heroi

| Stat | Valor Base (Warrior) | Descricao |
|---|---|---|
| **Max HP** | 100 | Pontos de vida maximos |
| **Max Stamina** | 50 | Recurso para ataques e defesas |
| **Max Mana** | 30 | Recurso para magias |
| **Strength** | 1.0 | Multiplicador de dano fisico |
| **Defense Multiplier** | 1.0 | Multiplicador de eficiencia de defesa |
| **Move Speed** | 2 | Velocidade de deslocamento no loop |

### 7.2 Warrior — Classe Inicial

O Warrior e a classe de entrada, equilibrada entre ataque e defesa. Seu deck inicial reflete isso:

**Deck inicial:**
- 4x Strike (ataque basico)
- 4x Defend (defesa basica)
- 1x Heavy Hit (ataque forte)
- 1x Fireball (magia de dano)

**Total: 10 cartas**

**Identidade da classe:** Versatilidade. O Warrior pode ser construido como tanque (foco em defesa), berserker (foco em ataque) ou hibrido. Sua forca esta na flexibilidade.

### 7.3 XP de Classe

- XP de classe e **persistente entre runs**
- Ganho de XP: ao derrotar inimigos, completar loops, derrotar bosses
- XP acumulada desbloqueia **skills passivas** na arvore de passivas da classe

### 7.4 Skills Passivas (Warrior)

Desbloqueadas por XP de classe. Exemplos:

| Passiva | Efeito | XP necessaria |
|---|---|---|
| **Vigor** | +10 Max HP permanente | 100 XP |
| **Endurance** | +5 Max Stamina permanente | 150 XP |
| **Battle Rage** | +15% dano apos 2 ataques seguidos | 300 XP |
| **Iron Body** | +10% eficiencia de defesa | 250 XP |
| **Second Wind** | Recupera 5 Stamina ao reshufflar o deck | 500 XP |
| **Veteran** | +5% gold ganho em combates | 200 XP |

> *Nota: valores de XP e efeitos sao estimativas iniciais para playtesting.*

### 7.5 Combos Exclusivos de Classe

O Warrior tem combos (sinergias) exclusivos baseados em sequencias de cartas:

- **Combo Berserker:** Heavy Hit + Heavy Hit = segundo Heavy Hit causa 150% de dano
- **Combo Counter:** Defend + Strike = Strike causa dano adicional igual a armadura gerada
- **Combo Fortified Strike:** Shield Wall + Fury = Fury nao consome defesa

### 7.6 Classes Futuras (Ideias)

| Classe | Identidade | Recursos | Deck Inicial |
|---|---|---|---|
| **Mage** | Magia intensa, cartas poderosas com alto custo de mana | Mana alta, Stamina baixa | Foco em magias |
| **Rogue** | Cartas rapidas com cooldown baixo, combos longos | Stamina alta, HP baixo | Muitos ataques leves |
| **Paladin** | Cura e defesa, combate de attrition | HP alto, equilibrado | Foco em defesa/cura |
| **Necromancer** | Sacrifica HP por efeitos poderosos, invocacao | Mana alta, HP medio | Cartas de sacrificio |

---

## 8. Reliquias e Artefatos

### 8.1 Filosofia de Design

Reliquias sao itens passivos permanentes (dentro de uma run) que modificam as regras do jogo. Inspiradas no modelo do Slay the Spire — sem slot fixo, o jogador acumula quantas conseguir. Cada reliquia cria uma "regra nova" que o jogador deve incorporar na sua estrategia.

### 8.2 Sistema de Trigger

Cada reliquia tem um **trigger** que define quando seu efeito se ativa:

| Trigger | Quando ativa |
|---|---|
| **passive** | Efeito permanente, aplicado ao obter |
| **combat_start** | Ao iniciar um combate |
| **turn_start** | A cada turno de combate |
| **card_played** | Ao jogar qualquer carta |
| **damage_taken** | Ao receber dano |
| **heal** | Ao receber cura |

### 8.3 Catalogo de Reliquias

#### Comuns

| Reliquia | Efeito | Raridade |
|---|---|---|
| **Bronze Scale** | +15 Max HP | Comum |
| **Energy Potion** | +10 Max Stamina | Comum |

#### Raras

| Reliquia | Efeito | Raridade |
|---|---|---|
| **Warrior Spirit** | Cartas de ataque custam 1 menos Stamina | Rara |
| **Iron Will** | Ao receber dano, ganha +2 Defesa | Rara |
| **Arcane Crystal** | +15 Max Mana | Rara |

#### Epicas

| Reliquia | Efeito | Raridade |
|---|---|---|
| **Berserker Ring** | +50% Strength, -20% Max HP | Epica |

#### Lendarias

| Reliquia | Efeito | Raridade |
|---|---|---|
| **Demon Heart** | Primeiro turno de cada combate: dano de cartas dobrado | Lendaria |
| **Phoenix Feather** | Ao morrer, revive com 50% HP (1x por combate) | Lendaria |

### 8.4 Obtencao de Reliquias

| Fonte | Chance/Condicao |
|---|---|
| Drop de inimigo | 15% (normal), 12% (hard) |
| Loja | Compra direta (preco varia por raridade) |
| Tile de tesouro | Chance ao abrir tesouro |
| Eventos | Recompensa de escolha narrativa |
| Boss | Drop garantido (rara+) |

### 8.5 Exemplos de Reliquias Futuras

| Ideia | Efeito | Raridade |
|---|---|---|
| **Speed Boots** | Cooldown de todas as cartas reduzido em 10% | Rara |
| **Vampire Fang** | Ataques curam 10% do dano causado | Epica |
| **Mirror Shield** | 20% de chance de refletir dano recebido | Epica |
| **Cursed Tome** | +100% dano magico, mas magias adicionam 1 curse ao deck | Lendaria |
| **Time Crystal** | Ao reshufflar, a primeira carta e jogada duas vezes | Lendaria |
| **Gold Magnet** | +25% gold em todos os combates | Comum |
| **Scout's Monocle** | Revela tipo de inimigo 2 tiles antes | Comum |

---

## 9. Economia do Jogo

### 9.1 Gold

Gold e a moeda principal da run. Nao persiste entre runs (exceto a parcela convertida em meta-progressao).

**Fontes de gold:**

| Fonte | Quantidade aproximada |
|---|---|
| Inimigo normal (Slime) | 10-20 gold |
| Inimigo normal (Goblin) | 15-25 gold |
| Inimigo normal (Orc) | 20-30 gold |
| Inimigo normal (Dark Mage) | 25-35 gold |
| Inimigo elite (Elite Knight) | 50-80 gold |
| Boss (Demon Lord) | 100-150 gold |
| Eventos | Variavel (30-50 gold) |
| Venda de tile dropado | Pontos de tile (nao gold) |

**Gastos de gold (dificuldade normal):**

| Gasto | Custo |
|---|---|
| Comprar carta na loja | 60 gold (base) |
| Remover carta na loja | 75 gold (base, escalonavel) |
| Reordenar deck | 25-50 gold |
| Upgrade de carta | 100 gold |
| Comprar reliquia | Variavel por raridade |
| Comprar pocao de cura (evento) | 40 gold |

**Na dificuldade hard:** Custos de loja aumentam (carta: 80, remocao: 100, upgrade: 150) e gold dropado reduz em 20%.

### 9.2 Pontos de Tile

Moeda secundaria usada exclusivamente para posicionar tiles no caminho.

**Fontes:**
- Loops completos (quantidade por loop a definir)
- Venda de tiles dropados (taxa reduzida vs custo de posicionamento)

**Gastos:**
- Posicionar tiles no caminho (custo por tipo de tile a definir)

### 9.3 Principios de Economia

1. **Gold por loop:** O jogador deve conseguir comprar ~1 carta OU ~1 remocao por loop no early game. No late game, gold se acumula mais rapido mas custos tambem escalam.
2. **Tensao de gasto:** Gastar gold em cartas vs remocao vs reliquias vs upgrade cria uma decisao estrategica constante.
3. **Morte como penalidade economica:** Perder 75% dos rewards ao morrer torna a saida segura apos boss uma decisao real.

---

## 10. Meta-progressao

### 10.1 Hub Visual

Entre runs, o jogador retorna ao **hub** — um acampamento ou vila que serve como tela de preparacao. O hub e visual e evolui conforme a meta-progressao avanca (novas construcoes, NPCs, decoracoes).

**Funcionalidades do hub:**
- Selecao de classe
- Visualizacao de desbloqueios
- Arvore de passivas de classe
- Colecao de cartas e reliquias desbloqueadas
- Iniciar nova run

### 10.2 Recompensas por Run

| Resultado | Recompensa |
|---|---|
| Saida segura (apos boss) | 100% dos rewards acumulados na run |
| Morte | 25% dos rewards acumulados na run |

**Rewards incluem:**
- XP de classe
- Moeda de meta-progressao (para desbloqueios permanentes)
- Progresso em condicoes de desbloqueio

### 10.3 Desbloqueios Permanentes

| Tipo | Efeito |
|---|---|
| **Novas cartas** | Aparecem como loot possivel em runs futuras |
| **Novas classes** | Novas formas de jogar com decks e passivas diferentes |
| **Novos tipos de tile** | Mais opcoes estrategicas de posicionamento |
| **Passivas de classe** | Bonus permanentes especificos da classe |

### 10.4 XP de Classe e Arvore de Passivas

- XP e ganha por run e persistente entre runs
- Cada classe tem sua propria arvore de passivas
- Passivas sao bonus permanentes que se aplicam em todas as runs futuras com aquela classe
- Arvore tem ramificacoes — o jogador pode focar em ofensivo, defensivo ou utilitario

---

## 11. Multiplayer (Design Futuro)

> *Nota: Multiplayer NAO e escopo do MVP. Esta secao documenta o design futuro para garantir que decisoes arquiteturais atuais nao bloqueiem a implementacao.*

### 11.1 Visao Geral

- **Modo:** Co-op online ate 4 jogadores
- **Tela:** Mesma tela, mesma run, mesmo loop
- **Combate:** Simultaneo — todos os herois jogam cartas ao mesmo tempo contra os mesmos inimigos

### 11.2 Escalacao de Dificuldade

- Inimigos ficam proporcionalmente mais fortes com mais jogadores
- **Formula sugerida:** `multiplicador_coop = 1 + (numero_de_jogadores - 1) * 0.6`
- 2 jogadores: inimigos 1.6x mais fortes
- 3 jogadores: inimigos 2.2x mais fortes
- 4 jogadores: inimigos 2.8x mais fortes

### 11.3 Morte e Revive

- Jogador morto **nao sai da run**
- Jogador morto e revivido ao derrotar o proximo boss
- **A dificuldade NAO diminui** quando um jogador morre — incentiva cooperacao para manter todos vivos
- Jogadores mortos nao contribuem para o combate ate serem revividos

### 11.4 Tiles Compartilhados

- Todos os jogadores compartilham o mesmo loop de tiles
- Pontos de tile sao compartilhados (pool unico do grupo)
- Qualquer jogador pode posicionar tiles (sem necessidade de votacao no MVP)

### 11.5 Fora do Escopo

- **PvP:** Descartado — foco e co-op. PvP adiciona complexidade de balanceamento desproporcional.
- **Co-op local:** Apenas online.
- **Matchmaking:** Feature futura apos estabilizacao do co-op base.

---

## 12. Tiles Especiais — Detalhamento

### 12.1 Loja (Shop)

**Cor:** Dourado (#FFD700)

**Funcionalidades:**
- **Comprar cartas:** Selecao rotativa de cartas disponiveis. Custo base 60 gold.
- **Remover cartas:** Escolher uma carta do deck para remover permanentemente. Custo escalonavel.
- **Reordenar deck:** Abrir tela de deck management para reorganizar a ordem das cartas.
- **Upgrade de carta:** Melhorar uma carta existente. Custo 100 gold.
- **Comprar reliquias:** Reliquias disponiveis para compra. Preco varia por raridade.

**Design da loja:**
- A cada visita, a loja oferece uma selecao **aleatoria** de itens
- Itens nao comprados desaparecem ao sair
- A loja refresha a cada visita

### 12.2 Evento (Event)

**Cor:** Purpura (#9370DB)

**Estrutura:** Encontro narrativo com texto descritivo e 2-3 escolhas com consequencias diferentes. Cada escolha pode ter **requisitos** (gold minimo, HP minimo) e **efeitos** combinados.

**Eventos implementados:**

| Evento | Descricao | Escolhas |
|---|---|---|
| **Mysterious Merchant** | Comerciante misterioso oferece troca | Trocar 30 gold por carta rara / Vender carta por 50 gold / Ignorar |
| **Cursed Chest** | Bau emanando energia sombria | Abrir (reliquia + maldicao) / Ignorar |
| **Healing Fountain** | Fonte magica de cura | Beber muito (40 HP, -10 Stamina max) / Beber pouco (20 HP) / Ignorar |
| **Ancient Shrine** | Santuario antigo e poderoso | Oferecer 20 HP por reliquia rara / Rezar (+30 gold) / Ignorar |
| **Traveling Salesman** | Mercador itinerante | Comprar pocao (40 gold = 30 HP) / Vender carta (40 gold) / Ignorar |

**Efeitos possiveis de eventos:**
- Ganhar/perder HP
- Ganhar/perder gold
- Adicionar/remover carta do deck
- Ganhar reliquia
- Receber maldicao

### 12.3 Descanso (Rest Site)

**Cor:** Azul royal (#4169E1)

**Mecanica:**
- Ao pisar no tile, o heroi descansa e recupera HP
- Quantidade de cura a definir (sugestao: 30% do HP maximo)
- Sem custo

**Variantes futuras:**
- Opcao de treinar (ganhar XP extra) em vez de descansar
- Opcao de meditar (remover maldicao) em vez de descansar
- Fogueira aprimorada (cura + upgrade de carta)

### 12.4 Tesouro (Treasure)

**Cor:** Laranja (#FF8C00)

**Mecanica:** Ao pisar no tile, o jogador recebe loot gratuito. Tipos de loot:

- **Gold:** Quantia aleatoria
- **Carta:** Carta aleatoria do pool disponivel
- **Reliquia:** Chance de reliquia (raridade variavel)
- **Combinacao:** Multiplos itens

### 12.5 Boss Tile

**Cor:** Vermelho vivo (#FF0000)

**Regras especiais:**
- NAO pode ser posicionado pelo jogador — aparece automaticamente
- Aparece a cada X loops (valor a definir — sugestao: a cada 5 loops)
- Ao derrotar o boss, jogador recebe opcao de **sair da run** com 100% dos rewards
- Boss drops sao garantidos e de alta qualidade (2-3 cartas, 100-150 gold, reliquia rara+)
- Apos derrotar boss e escolher continuar, dificuldade sobe significativamente

---

## 13. Interface e UX

### 13.1 Tela de Gameplay (Loop View)

**Resolucao:** 800x600

**Elementos na tela:**
- **Centro:** Visao side-view do loop. Heroi caminha da esquerda para a direita.
- **Tiles:** Representados como blocos coloridos no chao (cores conforme tabela de tiles)
- **Heroi:** Sprite do heroi com animacao de caminhada
- **HUD superior:** HP, Stamina, Mana, Gold, Loop atual, Pontos de tile
- **HUD inferior:** Inventario de tiles disponiveis para posicionamento
- **Indicador de progresso:** Posicao do heroi no loop (barra ou minimapa)

**Interacoes do jogador nesta tela:**
- Clicar em tile vazio (Path) para posicionar tile do inventario
- Botao de pausa
- Botao de visualizacao do deck
- Botao de visualizacao de reliquias

### 13.2 Tela de Combate (Combat View)

**Elementos na tela:**
- **Esquerda:** Heroi com barra de HP, Stamina, Mana visivel
- **Direita:** Inimigo(s) com barra de HP visivel
- **Inferior:** Deck visivel — todas as cartas em ordem, com destaque na carta atual
- **Centro:** Area de acao — animacoes de ataque, defesa, magia
- **Superior:** Informacoes de combate (turno, dano recente, efeitos ativos)
- **Cooldown visivel:** Cada carta mostra seu cooldown restante

### 13.3 Tela de Deck Management

**Acessivel via:** Loja, botao no HUD, DeckCustomizationScene

**Elementos:**
- Todas as cartas do deck exibidas em ordem
- Drag-and-drop para reordenar
- Detalhes da carta ao passar o mouse (stats, custo, efeitos, sinergias)
- Opcao de remover carta (se na loja)
- Filtros por categoria (ataque, defesa, magia)

### 13.4 Hub entre Runs

**Cena:** Acampamento/vila visual

**Elementos:**
- Selecao de classe (SelectionScene)
- Botao "Iniciar Run"
- Acesso a arvore de passivas
- Colecao de cartas e reliquias
- Configuracoes (SettingsScene)
- Tutorial (TutorialScene)

### 13.5 Cenas do Jogo (Arquitetura)

O jogo e composto pelas seguintes cenas Phaser:

| Cena | Funcao |
|---|---|
| **Boot** | Inicializacao tecnica |
| **Preloader** | Carregamento de assets |
| **MainMenu** | Menu principal |
| **TutorialScene** | Tutorial interativo |
| **SelectionScene** | Selecao de classe/heroi |
| **Game** | Loop principal (gameplay) |
| **CombatScene** | Tela de combate automatico |
| **RewardScene** | Tela de recompensas pos-combate |
| **ShopScene** | Loja |
| **RestScene** | Tile de descanso |
| **EventScene** | Eventos narrativos |
| **DeckCustomizationScene** | Gerenciamento de deck |
| **RelicViewerScene** | Visualizacao de reliquias |
| **PauseScene** | Tela de pausa |
| **SettingsScene** | Configuracoes |
| **GameOverScene** | Tela de fim de run |
| **DeathScene** | Tela de morte |

### 13.6 Estilo Visual

**MVP:** Simplificado e minimalista. Formas geometricas coloridas para tiles, sprites simples para heroi e inimigos. Foco total na mecanica — arte nao e bloqueio para gameplay.

**Futuro:** Pixel art ou estilo illustrado. Animacoes de combate mais elaboradas. Efeitos visuais para sinergias, crits, magias.

---

## 14. Audio (Diretrizes)

### 14.1 Tom Geral

- **Trilha sonora:** Atmosferica e levemente tensa. Tom medieval/fantasia com elementos de misterio. Deve acompanhar o ritmo do loop sem ser cansativa em sessoes longas (1h+).
- **Loop de gameplay:** Musica ambiente calma com camadas que se intensificam conforme o loop avanca.
- **Combate:** Trilha mais intensa e ritmica. Deve transmitir urgencia sem ser estressante.
- **Hub:** Musica calma e acolhedora. Sensacao de "lar seguro" apos a tensao da run.

### 14.2 Efeitos Sonoros Importantes

| Momento | SFX |
|---|---|
| Carta jogada (ataque) | Som de impacto/corte metalico |
| Carta jogada (defesa) | Som de escudo/metal ressonando |
| Carta jogada (magia) | Som arcano/mistico |
| Dano recebido | Som de impacto + feedback visual |
| Cura | Som cristalino/suave |
| Inimigo derrotado | Som de dissolucao/queda |
| Boss aparece | Som grave e ameacador |
| Loop completo | Som de progresso/completude |
| Carta adicionada ao deck | Som de "click" satisfatorio |
| Carta removida | Som de rasgamento |
| Reliquia obtida | Som de brilho/raridade |
| Morte do heroi | Som dramatico de derrota |
| Saida segura | Som de vitoria/alivio |

### 14.3 Implementacao

O jogo utiliza um **AudioManager** centralizado para controle de volume, mute, e reproducao de trilhas e efeitos. Configuracoes de audio sao acessiveis via SettingsScene.

---

## 15. Balanceamento (Diretrizes)

### 15.1 Principios Fundamentais

1. **Deck menor = mais consistente, mas mais caro de atingir.** Deck thinning e uma estrategia valida, mas o custo escalonavel impede que seja a unica estrategia dominante.
2. **Cooldown vs poder.** Cartas fortes tem cooldowns mais longos. O jogador deve equilibrar burst (poucas cartas fortes) vs sustain (muitas cartas fracas e rapidas).
3. **HP como recurso nao-renovavel.** HP persiste entre combates. Tiles de descanso e cartas de cura sao preciosos. O jogador deve decidir entre posicionar mais combats (mais loot) ou mais rests (mais seguranca).
4. **Risco/recompensa no loop.** Mais tiles de combate = mais gold e cartas, mas mais dano acumulado. Sair apos boss = seguro. Continuar = mais rewards mas risco de morte.
5. **Morte nao e game over.** Perder 75% dos rewards doi, mas 25% ainda contribui para meta-progressao. O jogador sempre progride, mesmo lentamente.

### 15.2 Curva de Dificuldade por Loop

| Fase | Loops | Experiencia esperada |
|---|---|---|
| **Onboarding** | 1 | Inimigos fracos (0.5x). Jogador aprende mecanicas. |
| **Early game** | 2-3 | Dificuldade normal. Jogador monta deck e posiciona tiles. |
| **Mid game** | 4-7 | Dificuldade crescente. Deck deve estar refinado. Primeiro boss. |
| **Late game** | 8-12 | Dificuldade alta. Requer deck otimizado e reliquias. |
| **Endurance** | 13+ | Dificuldade extrema. Apenas builds muito fortes sobrevivem. |

### 15.3 Economia de Gold — Metas por Loop

| Loop | Gold acumulado esperado | O que o jogador pode comprar |
|---|---|---|
| 1-2 | ~50-80 gold | 1 carta OU salvar para remocao |
| 3-4 | ~150-250 gold | 1 remocao + 1 carta OU 1 upgrade |
| 5-7 | ~400-600 gold | Multiplas remocoes/upgrades, reliquia |
| 8+ | ~800+ gold | Deck refinado, multiplas reliquias |

### 15.4 Custo de Remocao de Cartas

**Formula:**
```
custo = base * (1 + 0.25 * max(0, 15 - tamanho_deck))
```

**Base (normal):** 75 gold
**Base (hard):** 100 gold

Essa formula garante que:
- Remover cartas de um deck grande (15+) e barato
- Remover cartas de um deck pequeno (5-6) e muito caro
- O "sweet spot" de tamanho de deck e entre 7-10 cartas

### 15.5 Balanceamento de Cartas

**Principio central:** DPR (Damage Per Real-time) deve ser similar entre cartas de mesmo nivel de poder. Cartas com cooldowns mais longos devem compensar com efeitos proporcionalmente mais fortes, mas nao linearmente — cartas pesadas devem ter eficiencia ligeiramente superior para justificar o risco de cooldown longo.

| Carta | Dano | Custo total efetivo | Eficiencia relativa |
|---|---|---|---|
| Strike | 10 | 0 | Baseline |
| Heavy Hit | 20 | 5 stamina | 2x dano, custo moderado |
| Fury | 30 | 10 defense | 3x dano, sacrifica defesa |
| Berserker | 40 | 15 stamina + 5 defense | 4x dano, custo alto |
| Fireball | 15 | 5 mana | 1.5x dano, usa recurso diferente |

### 15.6 Duracao Alvo de Run

- **Run curta (morte precoce):** 10-15 minutos (loops 1-3)
- **Run media:** 30-45 minutos (loops 4-7, morre no boss ou sai)
- **Run longa (objetivo):** 1h+ (loops 8+, jogador experiente)
- **Run de endurance:** 2h+ (jogadores otimizando meta-progressao)

### 15.7 Dificuldades

| Parametro | Normal | Hard |
|---|---|---|
| HP multiplicador | 1.0x | 1.3x |
| Dano multiplicador | 1.0x | 1.2x |
| Escalacao por loop | 0.3 | 0.4 |
| Gold drop | 1.0x | 0.8x |
| Card drop rate | 1.0x | 0.85x |
| Relic drop rate | 15% | 12% |
| Elite chance | 20% | 30% |
| Event chance | 25% | 20% |
| Carta (loja) | 60 gold | 80 gold |
| Remocao (loja) | 75 gold | 100 gold |
| Upgrade (loja) | 100 gold | 150 gold |

---

## Apendice A: Decisoes de Design Chave

| Decisao | Justificativa |
|---|---|
| Combate 100% automatico | Toda estrategia no deckbuilding — diferencial do jogo |
| Tempo real com cooldown por carta | Mais dinamico que turnos; cooldown como stat de balanceamento |
| HP persiste, stamina/mana resetam | Tensao de attrition no HP, mas cada luta e puzzle completo de recursos |
| Tiles apenas no caminho | Simplifica vs Loop Hero; interacoes entre tiles do path sao suficientes |
| Custo escalonavel de remocao | Deck thinning valido, mas progressivamente mais caro |
| Targeting por carta | Adiciona dimensao ao deckbuilding (single vs AoE vs focado) |
| 100% ao sair pos-boss, 25% ao morrer | Risco/recompensa que incentiva runs mais longas sem punir totalmente |
| Sem PvP | Foco em co-op e solo; PvP adicionaria complexidade desproporcional |
| Sem interacao manual no combate | Reforca a fantasia de "arquiteto, nao lutador" |
| Web-first | Acessibilidade maxima; portabilidade futura se necessario |

## Apendice B: Fora do Escopo

- **PvP** — complexidade de balanceamento desproporcional
- **Mobile/Desktop nativo** — web-first
- **Co-op local** — apenas online
- **Interacao manual durante combate** — toda estrategia no deckbuilding
- **Tiles fora do caminho (adjacentes/cenario)** — apenas tiles no path do heroi

---

*Documento vivo. Atualizar conforme decisoes de playtesting e novas features.*
