# Critérios Técnicos Avançados

Este projeto precisa atender a, no mínimo, **2** dos seguintes recursos técnicos
avançados para ser considerado concluído:

Push/Notification · HTTP/3 · Gamepad · **Criação procedural** · **IA para NPCs** ·
WebAssembly · WebXR · WebRTC NxN

Os dois critérios efetivamente implementados são **Criação Procedural** e
**IA para NPCs**. Este documento explica o que cada um faz, onde está no código e
por que qualifica.

## Resumo

| Critério            | Status | Principais arquivos                                   |
| ------------------- | :----: | ----------------------------------------------------- |
| **Criação procedural** | ✅ Sim | `SeededRNG.ts`, `LootGenerator.ts`, `LoopRunner.ts`   |
| **IA para NPCs**       | ✅ Sim | `EnemyAI.ts`, `BossSystem.ts`, `EnemyAffinity.ts`     |
| Push/Notification   |   ❌    | apenas avisos visuais internos (sem Web Push)         |
| HTTP/3              |   ❌    | —                                                     |
| Gamepad             |   ❌    | —                                                     |
| WebAssembly         |   ❌    | —                                                     |
| WebXR               |   ❌    | —                                                     |
| WebRTC NxN          |   ❌    | há rede em tempo real, mas via **MQTT** (veja abaixo) |

---

## 1. Criação Procedural

### O que é

Todo o conteúdo de uma "run" (jogada) — drops de loot, materiais, pools de
inimigos por terreno e o próprio layout do mundo (a "loop") — é **gerado de forma
procedural e determinística a partir de uma semente (seed)**. Com a mesma seed,
a mesma jogada é reproduzida exatamente igual, o que sustenta o modo **Daily Run**
(desafio diário compartilhado por todos os jogadores).

### Onde está

| Arquivo                          | Responsabilidade                                                       |
| -------------------------------- | ---------------------------------------------------------------------- |
| `src/systems/SeededRNG.ts`       | Gerador de números pseudoaleatórios (PRNG) determinístico por seed     |
| `src/systems/SharedRNG.ts`       | Instância de RNG compartilhada que herda a seed da run                 |
| `src/systems/DailySeed.ts`       | Deriva a seed do desafio diário                                        |
| `src/systems/LootGenerator.ts`   | Sorteia loot, materiais e monta pools de inimigos                      |
| `src/systems/LoopRunner.ts` + `src/systems/TileRegistry.ts` | Montam o layout de tiles da loop |

### Como funciona

**Semente determinística (`SeededRNG.ts`).** Uma string de seed é convertida em
número pela hash `cyrb53` e usada para inicializar o PRNG `mulberry32`. A classe
expõe utilitários de geração:

- `random()` — float em `[0, 1)`
- `intRange(min, max)` — inteiro no intervalo, inclusivo
- `pick(arr)` — elemento aleatório de um array
- `shuffle(arr)` — embaralhamento Fisher-Yates

Por ser determinístico, a mesma seed sempre produz a mesma sequência — base da
reprodutibilidade das jogadas.

**Geração de loot e inimigos (`LootGenerator.ts`).**

- `rollTreasureLoot()` gera de 1 a 3 itens a partir de uma **tabela ponderada**
  (ouro 40% · carta 30% · tile 20% · relíquia 10%), com a quantidade de ouro
  escalando pela profundidade da run (`Math.sqrt(loopCount)`).
- `rollMaterialDrops()` sorteia drops de materiais com tabelas distintas para
  `terrain`, `enemy` e `boss`, cada uma com chances independentes.
- `getEnemyPoolForTerrain(terrainKey, loopCount)` monta dinamicamente a pool de
  inimigos: parte de uma base por terreno e **adiciona novos inimigos conforme a
  loop avança** (limiares em `addAtLoop`), aumentando a variedade ao longo do jogo.

**Layout do mundo (`LoopRunner.ts` + `TileRegistry.ts`).** A cada loop, os tiles
do percurso são montados proceduralmente (`createBasicLoop`, tiles de buffer
iniciais e chance de spawn de combate por tile), de modo que o trajeto e os
encontros variam a cada volta.

### Por que qualifica

Não é aleatoriedade decorativa: o sistema **gera conteúdo de jogo** (itens,
inimigos e o mapa da loop) a partir de uma seed controlada, de forma
determinística e reproduzível — exatamente o que caracteriza geração procedural.

---

## 2. IA para NPCs

### O que é

Os inimigos não seguem um script fixo: eles **decidem suas ações em tempo real**
com base no estado do combate (próprios HP/cooldowns, HP do herói, efeitos ativos
e padrões de chefe). A lógica vive em uma camada de IA dedicada, sem dependências
de renderização.

### Onde está

| Arquivo                                | Responsabilidade                                                  |
| -------------------------------------- | ----------------------------------------------------------------- |
| `src/systems/combat/EnemyAI.ts`        | Núcleo da IA de inimigos: timing de ataque, padrões e comportamentos |
| `src/systems/BossSystem.ts`            | Definições e comportamentos especiais de chefes                   |
| `src/systems/combat/EnemyAffinity.ts`  | Efeitos secundários por afinidade elemental                       |

### Como funciona

A classe `EnemyAI` roda um laço de decisão em `tick(deltaMs, state, stats)`:

- **Timing de ataque por cooldown.** O inimigo ataca quando o `cooldownTimer`
  zera. O avanço do timer reage a efeitos de controle: **stun** congela o timer
  (`effectiveDelta = 0`) e **slow** o desacelera (8% por stack, com teto de 50% —
  ou 80% sob a relíquia Stormcaller's Rod).

- **Padrões de cálculo de dano** (`calculateDamage`), escolhidos por inimigo:
  - `fixed` — dano constante
  - `random` — varia entre 80% e 120% do dano base
  - `scaling` — cresce conforme o nº de cartas jogadas
  - `conditional` — aplica 1,5× quando o herói está abaixo de 50% de HP

- **Efeitos especiais de ataque**: `double` (30% de chance de dobrar o dano),
  `stun` (atordoa o herói), `debuff` (reduz defesa) e `lifesteal` (cura 50% do
  dano causado).

- **Comportamentos de chefe** (`applyPeriodicBehaviors` / `getEffectiveCooldown`):
  - `enrage` — reduz o cooldown de ataque ao cair abaixo de um limiar de HP
  - `shield` — ganha armadura periodicamente
  - `multi_hit` — desfere vários golpes no mesmo ataque
  - `drain` — recupera HP proporcional ao dano causado

- **Afinidade elemental** (`EnemyAffinity.ts`): ataques disparam efeitos
  secundários conforme o elemento do inimigo, com multiplicador para chefes.

### Por que qualifica

A IA toma **decisões dependentes do estado** (enfurecer ao ficar com pouco HP,
dano condicional quando o herói está fraco, congelar o próprio timer sob stun,
escolher entre padrões e comportamentos) em vez de seguir uma rotina fixa —
caracterizando IA de NPC de fato, e não um stub.

---

## Nota sobre rede (por que NÃO é WebRTC NxN)

O projeto **possui rede em tempo real**, mas implementada com **MQTT**
(`src/systems/MqttClient.ts`, `DailyRunBroadcaster.ts`, `DailyRunTicker.ts`) — um
modelo publish/subscribe baseado em *broker*, usado para o placar do Daily Run.

MQTT atende a um **critério separado** (mensageria em tempo real), mas **não conta
como WebRTC NxN**, que exige conexões peer-to-peer diretas (malha N×N) via
`RTCPeerConnection`. Por isso WebRTC NxN está marcado como não implementado na
tabela acima.
