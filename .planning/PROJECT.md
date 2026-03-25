# Autoscroller

## What This Is

Autoscroller é um jogo web multiplayer (co-op online até 4 jogadores) que combina a mecânica de loop e posicionamento de tiles do Loop Hero com um sistema de auto-combate baseado em deck de cartas. O jogador constrói um circuito de tiles de terreno, e seu herói percorre o loop infinitamente em side-view, enfrentando inimigos que spawnam conforme os terrenos posicionados. O combate é 100% automático e em tempo real — a estratégia está inteiramente na construção, ordenação e refinamento do deck de cartas antes das lutas.

## Core Value

A experiência central é o deckbuilding estratégico: o jogador nunca toca no combate diretamente, mas cada decisão sobre quais cartas manter, remover, e em qual ordem colocar define se o herói sobrevive ou morre. A satisfação vem de assistir um deck bem construído funcionar perfeitamente.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

**Core Loop:**
- [ ] Herói percorre tiles em loop infinito (side-view, autoscroll)
- [ ] Jogador posiciona tiles de terreno no caminho durante a run
- [ ] Tiles adjacentes interagem entre si (sinergias/combos)
- [ ] Terrenos spawnam inimigos específicos e fornecem recursos/buffs
- [ ] Dificuldade escala a cada loop completo (stats dos inimigos aumentam)
- [ ] Boss aparece a cada X loops — derrotar boss = opção de saída segura
- [ ] Ao morrer, jogador retorna com 25% dos rewards

**Sistema de Tiles:**
- [ ] Pontos de tile ganhos a cada loop completo (acumuláveis)
- [ ] Tiles raras dropam de inimigos (sem custo, inseridas no fim do loop)
- [ ] Drops de tiles podem ser vendidos por pontos de tile (taxa reduzida)
- [ ] Tiles desbloqueáveis como meta-progressão permanente

**Combate (Auto-duel):**
- [ ] Combate automático em tempo real — herói joga cartas do topo do deck
- [ ] Cada carta tem cooldown próprio (cartas leves = rápidas, pesadas = lentas)
- [ ] Ao esgotar o deck, reshuffla e recomeça
- [ ] Cartas: ataques, defesas e magias
- [ ] Ataques/defesas custam stamina, magias custam mana
- [ ] Cartas e regeneração natural geram stamina/mana
- [ ] Stamina e mana resetam entre combates; HP persiste
- [ ] Targeting definido por carta (single, AoE, menor HP, aleatório, etc)
- [ ] Inimigos com IA simples (stats fixos, padrões de ataque)

**Deck Management:**
- [ ] Adicionar cartas ao deck é grátis (aceita ou descarta ao ganhar)
- [ ] Remover cartas custa gold na loja (custo escalonável — deck menor = mais caro)
- [ ] Reordenar deck custa gold na loja
- [ ] Deck inteiro visível durante combate (transparência total)
- [ ] Sinergias entre cartas sequenciais (ex: Escudo → Contra-ataque = dano dobrado)
- [ ] Nem todas as cartas têm sinergias (fator de balanceamento)

**Cartas — Obtenção:**
- [ ] Drops de inimigos (chance, não garantido)
- [ ] Recompensas de tiles especiais (tesouro, eventos)
- [ ] Compra na loja
- [ ] Desbloqueio via meta-progressão

**Tiles Especiais:**
- [ ] Loja (comprar/remover/reordenar cartas, comprar relíquias)
- [ ] Evento/encontro (texto narrativo com escolhas)
- [ ] Descanso (recupera HP)
- [ ] Tesouro (loot — cartas, gold, relíquias)
- [ ] Boss tile (combate especial, reward melhor)

**Herói e Classes:**
- [ ] Classe Warrior como primeira classe jogável
- [ ] XP de classe por run (persistente entre runs)
- [ ] Skills passivas desbloqueadas por XP de classe (ex: +dano após 2 ataques seguidos)
- [ ] Combos exclusivos de classe (passivas que bonificam sequências específicas)

**Relíquias/Artefatos:**
- [ ] Itens passivos com efeitos únicos (sem slot fixo, estilo Slay the Spire)
- [ ] Podem modificar cooldown de cartas, stats, mecânicas de combate
- [ ] Obtidos em runs (drops, loja, eventos)

**Meta-progressão (entre runs):**
- [ ] Hub visual (acampamento/vila) entre runs
- [ ] Desbloqueio permanente de novas cartas (aparecem como loot futuro)
- [ ] Desbloqueio de novas classes (futuro)
- [ ] Desbloqueio de novos tipos de tiles
- [ ] XP de classe persistente com árvore de passivas

**Multiplayer (futuro, não MVP):**
- [ ] Co-op online até 4 jogadores na mesma tela
- [ ] Combate simultâneo (todos os heróis jogam cartas ao mesmo tempo)
- [ ] Dificuldade escala com número de players
- [ ] Jogador morto revive ao derrotar próximo boss (dificuldade não diminui)
- [ ] Matchmaking

**Bosses:**
- [ ] MVP: bosses com stats altos (inimigo turbinado)
- [ ] Futuro: bosses com mecânicas únicas (fases, imunidades, ataques especiais)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- PvP — foco é co-op e solo, PvP adiciona complexidade de balanceamento desproporcional
- Mobile/Desktop nativo — web-first, portabilidade futura se necessário
- Co-op local — apenas online
- Interação manual durante combate — toda estratégia está no deckbuilding pré-combate
- Tiles fora do caminho (adjacentes/cenário como Loop Hero) — apenas tiles no path do herói

## Context

**Referências principais:**
- **Loop Hero** — mecânica de loop, posicionamento de tiles durante a run, terrenos que spawnam inimigos
- **Slay the Spire** — deckbuilding, custo escalonável de remoção de cartas, relíquias como itens passivos, modelo de progressão híbrido
- **Auto-battlers** — combate sem intervenção do jogador, estratégia na preparação

**Plataforma:** Web browser (HTML5/Canvas)
**Engine:** Phaser
**Estilo visual:** Simplificado/minimalista no MVP — foco na mecânica
**Duração de run:** 1h+ (runs longas, investimento alto, morte tem peso)
**Idioma do GDD:** Português brasileiro

**Diferencial:** A combinação de loop-building (posicionar terrenos) com deckbuilding de cartas em combate auto cria duas camadas de estratégia paralelas — uma sobre o mundo (tiles) e outra sobre o combate (deck). O jogador é um arquiteto, não um lutador.

## Constraints

- **Tech stack**: Phaser (web) — decisão do usuário, boa comunidade e documentação para 2D
- **MVP scope**: Solo funcional primeiro — co-op online é feature futura
- **Classe inicial**: Apenas Warrior — outras classes são meta-progressão futura
- **Visual**: Simplificado no MVP — arte não é bloqueio para gameplay

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Combate 100% automático, sem interação | Toda estratégia no deckbuilding — diferencial do jogo | — Pending |
| Tempo real com cooldown por carta | Mais dinâmico que turnos, cooldown como stat de balanceamento | — Pending |
| HP persiste entre combates, stamina/mana resetam | Cria tensão de attrition no HP, mas cada luta é puzzle completo de recursos | — Pending |
| Tiles apenas no caminho (sem adjacentes fora do loop) | Simplifica vs Loop Hero, interações entre tiles do path são suficientes | — Pending |
| Custo escalonável de remoção de cartas | Deck thinning é estratégia válida, mas progressivamente mais caro | — Pending |
| Targeting definido por carta | Adiciona dimensão ao deckbuilding (single vs AoE vs focado) | — Pending |
| Saída segura após boss, 25% ao morrer | Risco/recompensa — incentivar runs mais longas sem punição total | — Pending |
| Pontos de tile + drops raros | Duas fontes de tiles com economia própria (acumular vs usar agora) | — Pending |
| GDD em português brasileiro | Documentação do game design acompanha os docs de planejamento | — Pending |

---
*Last updated: 2025-03-25 after initialization*
