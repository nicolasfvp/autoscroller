# Assets Necessários — História e Capítulos

> Status: ✓ existente | NOVO = a criar | ? = verificar

---

## Backgrounds — Scrolling (GameScene)

| ID do Asset | Capítulo | Status |
|------------|----------|--------|
| green_field_background | CH1 — Planícies | ✓ existente |
| forest_scroll | CH2 — Floresta | NOVO |
| swamp_scroll | CH3 — Pântano | NOVO |
| desert | CH4 — Deserto | ✓ existente |
| graveyard_scroll | CH5 — Cemitério | NOVO |
| lava_scroll | CH6 — Cume Vulcânico | NOVO |
| ruins_scroll | CH7 — Ruínas de Aethos | NOVO |

**Estilo dos novos scrolls:** mesmo formato do green_field_background — faixa panorâmica que faz scroll horizontal. Tom sombrio por capítulo:
- **forest_scroll:** floresta densa, árvores retorcidas, névoa roxa baixa, ruínas de laboratório emergindo entre as raízes
- **swamp_scroll:** pântano cinzento, árvores mortas refletidas em água parada, névoa verde-pálida, armaduras enferrujadas emergindo da lama
- **graveyard_scroll:** cemitério extenso, lápides irregulares, árvores mortas sem folhas, névoa violeta, brasão de Aethos em algumas lápides
- **lava_scroll:** região vulcânica, rochas negras, fluxo de lava no fundo, fumaça escura, fragmentos de equipamento militar carbonizado
- **ruins_scroll:** capital de Aethos em ruínas, colunas caídas, brasões apagados, céu cinzento-roxo sem sol visível, estátuas sem cabeça

---

## Backgrounds — Batalha (BattleScene)

| ID do Asset | Capítulo | Status |
|------------|----------|--------|
| bg_battle_basic | CH1 | ✓ existente |
| bg_battle_forest | CH2 | ✓ existente |
| bg_battle_swamp | CH3 | ✓ existente |
| bg_battle_graveyard | CH5 | ✓ existente |
| bg_battle_desert | CH4 | NOVO |
| bg_battle_lava | CH6 | NOVO |
| bg_battle_ruins | CH7 | NOVO |

**Estilo dos novos battle bgs:** plano único, menor, enquadrado para combate. Paleta sombria coerente com o bioma.

---

## Bosses — Sprites (Novos)

| ID | Nome | Frames | Bioma | Detalhes |
|----|------|--------|-------|----------|
| drowned_king | Tiresias | 3 | Pântano | Figura afundando/emergindo da lama; armadura de Valdris corroída; olhos com brilho verde-pálido |
| doom_knight | Actaeon | 3 | Cemitério | Cavaleiro em armadura negra; carrega carta selada; sem rosto visível (viseira); aura violeta fraca |
| phaethon | Phaethon | 4–5 | Ruínas | Homem idoso em armadura real rasgada; coroa partida; emanações de Podridão sutis; expressão de exaustão digna |

**Bosses existentes (verificar compatibilidade com nova lore):**
- iron_golem → Dryas ✓
- bog_witch → Circe ✓
- desert_golem → Daedalus ✓
- infernal_dragon → Midas ✓

---

## Monstros Novos — Sprites

| ID | Nome | Frames | Bioma |
|----|------|--------|-------|
| giant_spider | Aranha Colossal | 3–4 | Floresta |
| drowned_soldier | Soldado Afogado | 3 | Pântano |
| sand_wraith | Espectro de Areia | 3–4 | Deserto |
| necromancer | Necromante | 3 | Cemitério |
| blighted_knight | Cavaleiro da Podridão | 3–4 | Cemitério |
| void_shade | Sombra do Vazio | 3–4 | Ruínas |

Ver [NEW_MONSTERS.md](NEW_MONSTERS.md) para especificação visual detalhada de cada um.

---

## Cutscenes — Backgrounds

Cada cutscene usa backgrounds estáticos com efeito Ken Burns (pan/zoom lento).

| Cena | Background Sugerido | Notas |
|------|--------------------|----|
| Prólogo (planícies ao amanhecer) | Variação clara de green_field_background | Pan esquerda → direita |
| Prólogo slide 2 (mapa) | Asset específico: mapa estilizado de Eldara | NOVO — simplificado, pixel art |
| Prólogo slide 3 (herói na fronteira) | green_field_background com herói posicionado | |
| CH2 pós-boss (floresta) | forest_scroll (estático) | |
| CH3 pós-boss (pântano) | swamp_scroll (estático) | |
| CH4 pós-boss (deserto) | desert (estático) | |
| CH5 pós-boss (cemitério) | graveyard_scroll (estático) | |
| CH6 pós-boss (vulcão) | lava_scroll (estático) | |
| CH7 pré-boss (ruínas da capital) | ruins_scroll com mais detalhe | |
| Encerramento | green_field_background ligeiramente alterado | "O mundo que restou" |

---

## Assets de UI para Capítulo/Cutscene

| Asset | Uso | Status |
|-------|-----|--------|
| Fonte VT323 | Texto de cutscene e diálogos de boss | ✓ existente |
| Caixa de diálogo de cutscene | Container para o texto typewriter | Verificar: pode ser um retângulo simples |
| Caixa de diálogo de boss | Layout boss sprite + hero sprite + texto | NOVO |
| Sprite de Kael para cutscene | Herói guerreiro, posicionado | ✓ verificar |
| Sprite de Lyra para cutscene | Heroína maga, posicionada | ✓ verificar |

---

## Prioridade de Criação

**Alta (bloqueiam o capítulo):**
1. drowned_king, doom_knight, phaethon (bosses sem sprite)
2. ruins_scroll e bg_battle_ruins (CH7 inacessível sem eles)
3. lava_scroll e bg_battle_lava (CH6)

**Média (expandem conteúdo):**
4. Monstros novos (giant_spider, drowned_soldier, sand_wraith, necromancer, blighted_knight, void_shade)
5. graveyard_scroll, swamp_scroll, forest_scroll
6. bg_battle_desert

**Baixa (polish):**
7. Mapa de Eldara para prólogo
8. Assets UI de diálogo de boss
9. Variações de green_field para encerramento
