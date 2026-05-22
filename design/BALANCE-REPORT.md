# Relatório de Balanceamento — Sistemas e Cartas
**Data:** 2026-05-20
**Escopo:** `src/data/json/cards.json` (T1: 36 cartas, T2: ~110 cartas), sistemas em `src/systems/combat/*` e `src/ui/KeywordDefinitions.ts`.
**Método:** Leitura completa do catálogo + cross-check com `CardResolver.ts`, `StatusEffects.ts`, `CombatEngine.ts`. Comparações de DPS calculadas em **STR=1, todos os outros stats=0** (estado base do herói, conforme `WarriorClass.ts`/`MageClass.ts`).

> **Wave 1 aplicada (2026-05-20):** seções 2.1, 2.2, 2.3, 3.1, 3.2, 4.1 (7 cartas), 5.1, 5.3, 5.4 + Bedrock Snare e descrições de Frenzy foram corrigidas em commit posterior ao relatório original. Veja apêndice no fim do documento.

---

## 1. Resumo Executivo

O catálogo de cartas tem boa diversidade de arquétipos (Burn/Pyre, Bleed, Rage, Slow/Stun, Poison, Armor) e bons habilitadores de combo em T2. Porém há **problemas estruturais críticos** que minam clareza e equilíbrio:

| Severidade | Quantidade | Tema |
|---|---|---|
| **CRÍTICO (bug)** | 4 | Mecânicas que não fazem o que a carta diz |
| **CRÍTICO (clareza)** | 8 | Keywords usadas em cartas mas ausentes do glossário |
| **ALTO (balance)** | 12 | Cartas estritamente dominadas / poder fora da curva |
| **MÉDIO (escala)** | 5 | STR multiplica tudo → builds DEX/INT subótimos |
| **MÉDIO (curva de custo)** | 9 | Cartas "sem custo" superam suas equivalentes 1-stamina |

O jogador novato encontra cartas que parecem similares mas onde uma é objetivamente melhor (Flurry Step > Reckless Strike, Tempest Cadence > Quickstep Sigil) e enfrenta keywords sem tooltip (Echo, Overload, Devour, Stance, Channel, Aura).

---

## 2. Bugs / Comportamento Não-Documentado

### 2.1 🔴 "Drain X Mana/Stamina" inverte o alvo
**Cartas afetadas:** `t1-agility-water` Mist Step, `t1-air-fire` Firestorm.
**JSON:** `{ "type": "mana", "value": -1, "target": "enemy" }`
**Comportamento real (CardResolver.ts:419-422):**
```ts
case 'mana': {
  state.heroMana = Math.min(state.heroMaxMana, state.heroMana + resolvedValue);
}
```
O handler ignora `target` e sempre escreve em `heroMana`/`heroStamina`. Como `value: -1`, o resultado é **o herói perdendo 1 mana/stamina**, não o inimigo. A descrição "Drain 1 Mana" lê como debuff no inimigo, mas é uma cost adicional para o jogador.

**Fix sugerido:** Ou (a) remover esses efeitos das cartas, ou (b) implementar `enemyMana`/`enemyStamina` (custoso e provavelmente inútil — inimigos não usam mana), ou (c) renomear na descrição para "Costo extra" + mover o `value: -1` para o bloco `cost`.

### 2.2 🔴 Vengeance ≠ "took damage" (glossário diverge da implementação)
**Glossário (`KeywordDefinitions.ts:118-121`):** *"Vengeance: Bonus effect triggers if the hero took damage since the last card."*
**Implementação:** Todo "Vengeance:" em cartas usa `condition.hero_hp_pct_below: 50` (ou 60). Isto é um *threshold de HP*, não um "took damage".

**Impacto:** Jogador defensivo com 90% HP que tomou um hit *não* dispara Vengeance, enquanto um jogador com 49% HP *sempre* dispara (mesmo sem ter tomado dano recente).

**Fix sugerido:** Decida qual mecânica é a oficial:
- **Manter HP threshold** → reescrever glossário para "abaixo de 50% HP" e renomear keyword (ex: "Wounded").
- **Manter "took damage"** → adicionar trigger `on_self_damage` no engine e reescrever condições nas cartas.

### 2.3 🔴 Taunt é placeholder no-op
**Cartas afetadas:** `t1-attack-defense` Shield Bash.
**Glossário:** *"Forces enemy to focus on the hero (placeholder -- currently no AI impact)."*
Shield Bash custa **4 de armadura** (`cost.defense: 4`) para ganhar 8 dmg + Taunt. O bonus de Taunt não existe, então o player paga 4 armadura por uma carta de 8 dmg — uma má troca.

**Fix sugerido:** Ou implementar Taunt (forçar o foco do inimigo em algo) ou trocar o efeito por algo funcional (ex: "Deal 8. Aplica -2 def aura 6s.").

### 2.4 🟡 Burn dot ignora contagem de stacks
**Glossário:** *"Burn: While active, the enemy takes 2 damage per tick. Stacks don't decay -- they accumulate as ammunition for Pyre cards."*
**Implementação (`CombatEngine.ts:405-415`):** `if (state.burnStacks > 0) { dmg = 2 }`.

Isto é tecnicamente *correto pelo glossário*, mas extremamente contraintuitivo: a carta diz "**Burn 3**" (ou "Burn 6", como Vengeful Pyre), e o jogador racionalmente espera 3 (ou 6) dmg/tick. Na prática, Burn 1, Burn 3 e Burn 12 valem o mesmo enquanto não houver carta Pyre na deck.

**Fix sugerido:** Dos seguintes, escolha um:
- (A) **DOT escala com stacks** como Poison/Bleed (`dmg = burnStacks` ou `dmg = Math.min(burnStacks, cap)`), e Pyre continua como detonador.
- (B) **Renomear** "Burn N" para "Embers N" (acúmulo) e adicionar tag "+2 dot" para sinalizar o dot fixo. Ou manter "Burn" e usar "Embers" para o acúmulo, mas isso confunde.
- (C) Implementar tier: ex. cada 3 Burn adiciona +1 ao DOT (`dmg = 2 + floor(burnStacks/3)`).

A opção (A) é a mais alinhada com expectativas de jogadores de outros card-games (Slay-the-Spire, etc.) e ainda mantém Pyre relevante por consumir o pool.

---

## 3. Clareza e Descrição

### 3.1 🔴 Keywords usadas mas **AUSENTES** do glossário
Cartas usam o seguinte vocabulário **sem entrada** em `KEYWORD_DEFINITIONS`:

| Termo | Onde aparece | Significado real |
|---|---|---|
| **Aura Xs:** | ~30 cartas T1+T2 | Efeito temporizado de duração X segundos |
| **Echo** | Twinflame Flicker, Slipvenom Tempo, Tidefoot Bloom, Crimson Cascade | Repete o próximo card / re-aplica DoT |
| **Overload** | Cleaver's Tax, Brine Crucible | Penalty: +X segundos no próximo CD do slot |
| **Stance Xs:** | Iron Reckoning | Aura passiva com modifier complexo (ex: "+1 dmg/Rage") |
| **Channel** | Wrathshell Vow, Stormstone Tempo | Warm-up: 4s para ativar, ou ramp-up de dano com tempo |
| **Catalyze x2:** | Bog Catalyst | Multiplica stacks atuais por 2 |
| **Devour 1 common:** | Vengeful Pyre | Consome 1 carta do deck por combat |
| **Convert N X → Y** | Cinderscar, Quench Lance, etc. | Gasta stacks X para gerar Y |
| **Spread to N targets (50%)** | Marsh Squall, Venom Dance | Replica stacks para alvos próximos |
| **DR 20%** | Crimson Regen Mantle | Damage Reduction 20% |
| **Pyre: N** | Várias | Damage N × Burn stacks, consume all Burn |
| **Frenzy** | Frostbind, Glacial Pact | CD ×N% quando HP abaixo de threshold (auto-prefixado, mas pode confundir) |

**Recomendação:** Adicionar entradas para todas em `KeywordDefinitions.ts`. Como o detector usa `\bKeyword\b`, capitalização precisa ser exata.

### 3.2 🟡 Keywords definidas mas **NÃO usadas** em cartas
- **Steady** (sem dano desde last card) → 0 cartas.
- **Berserk** → glossário tem entrada, mas todas as cartas migraram para "Empowered (if Rage)". Pode remover do glossário ou portar algumas cartas.
- **Expose** (reduz def inimigo) → 0 cartas. (Existe `type:"debuff"` no engine mas nenhuma carta T1/T2 dispara.)

### 3.3 🟡 Guard com leitura ambígua
**Glossário:** *"Guard: Percentage chance to trigger a bonus effect on a defensive event."*
**Implementação:** Trigger `on_hp_pct_below` (HP threshold, não chance %).

**Exemplo:** Quickstone — "Guard 60%: Haste 30% (6s)" — o "60%" é threshold de HP, não chance de proc. Player lê como roleta.

**Fix:** Atualizar glossário para "Triggers when hero HP drops below X%" e remover menção de "Percentage chance".

### 3.4 🟡 Descrição não menciona Frenzy
Cards com bloco `frenzy` (Frostbind, Glacial Pact) **não incluem "Frenzy:"** na string `description` do JSON — depende de `CardText.ts:437-439` prepender no UI. Para ferramentas externas (wiki, deck builders, AI agents), a info fica invisível.

**Fix:** Padronizar — ou colocar "Frenzy: CD -30% below 50% HP." na string `description` (consistente com o resto do catálogo), ou converter outros card-level keywords (`exhaust`) também para sufixo no UI apenas.

### 3.5 🟡 "Scales STAT" inconsistente
Algumas cartas dizem "scales STR" / "scales DEX" mas não dizem a magnitude. Outras dizem "(scales INT)" no fim. Não há padrão sobre `per`/`value`.

Exemplos:
- Reckless Strike: "Deal 7 (scales STR)" — `per:2, value:1` → +1/2 STR.
- Bloodprice Strike: "Deal 12 (scales STR)" — `per:2, value:2` → +2/2 STR. **2× mais escala** com mesma descrição.

**Fix:** Padronizar uma das duas:
- (A) Adicionar magnitude visível na string: "Deal 12 (+2/2 STR)".
- (B) Padronizar o `per:value` por tier/categoria (ex: T1 ataque = 1/2 STR; T2 = 2/2 STR; T3 = 3/2 STR) e remover ambiguidade.

---

## 4. Desbalanceamentos de Cartas

### 4.1 🔴 Cartas Estritamente Dominadas (Dead Cards)

| Carta dominada | Dominante | Motivo |
|---|---|---|
| **Reckless Strike** (t1-att-att) — 1S, 1.0s, 7 dmg + selfBleed 1 + Rage 1 | **Flurry Step** (t1-agi-agi) — 1S, 0.9s, 8 dmg | Flurry tem +1 dmg, -0.1s CD, sem self-Bleed. Reckless só ganha "+1 Rage" — fraco fora de builds Rage. **A starter deck do warrior dá AMBAS.** |
| **Tremor Lock** (t1-earth-earth) — 1M, 2.5s, Stun 2 (INT) | **Frostbind** (t1-water-water) — 1M, 2.0s, Stun 1 + Armor 4 + Frenzy −30% CD | Frostbind tem -0.5s CD, +Armor 4, +Frenzy. Tremor Lock só ganha +1 stun. |
| **Footwork Stone** (t2-agi-agi-earth) | **Stonepacer** (t2-agi-earth-earth) | Mesma cost (1S), mesma CD (1.8s), mesmo Armor 10 + Haste 20%, mas Stonepacer é **AOE** e Haste 8s vs 6s. |
| **Phalanx Drift** (t2-agi-def-def) — 1S, 2.6s, Armor 18 (VIT) + Haste 15%/6s | **Veil of Steps** (t2-agi-agi-def) — 1S, 1.6s, Armor 14 (DEX) + Haste 20%/6s | Veil tem -1.0s CD com -4 armor: ROI muito maior por segundo. |
| **Quickstep Sigil** (t2-agi-agi-agi) — 2S, 3.0s, Haste 25%/8s + Deal 6 | **Tempest Cadence** (t2-air-air-air) — 2M, 3.5s, Haste 30%/10s + Deal 8 AOE | Tempest tem +5% Haste, +2s duração, +2 dmg, AOE. Único trade-off: stamina vs mana (mage vs warrior). |
| **Shield Bash** (t1-att-def) — 4 def, 1.5s, 8 dmg + Taunt | Qualquer 1S 8 dmg card | Taunt não funciona (placeholder), Shield Bash custa **4 de armor** que é alto. |
| **Concussive Smash** (t2-att-att-earth) — 2S, 3.0s, **EXHAUST**, 12 dmg + Stun 2 | **Cleaver's Tax** sem rage — 2S, 2.0s, 12 Pierce | Cleaver é mais rápido, **pierce**, **não-exhaust**. Concussive precisa exhaust para 2 stun extra. |

### 4.2 🟠 Power Outliers (Acima da Curva)

| Carta | Power Issue |
|---|---|
| **Sidestep & Slash** (t1-agi-cou) | Sem custo, +1 stam refund, 5 dmg + Vengeance 5 dmg + Bleed 2 + Stam refund a 1.1s CD. Net stam-positivo + Bleed engine + 10 dmg em Vengeance. Compare com Flurry Step (1S/0.9s/8 dmg) — Sidestep dá *mais* burst com Vengeance, *gera stamina*, e ainda aplica Bleed. |
| **Stormstrike** (t1-att-air) | Sem custo, AOE 6 dmg + Haste 20%/5s a 1.4s CD. Pure value. |
| **Pyre** (t1-fire-fire) — sem custo | Mage starter: 0 mana, 4 dmg + Pyre 3 + Burn 3. Comparado com qualquer outra fire/water/etc. de tier 1 que custa 1 mana, Pyre tem ROI infinita. Mage starter dá **dois** 0-cost cards (Pyre, e Bedrock Snare que custa stamina por erro — ver 4.4). |
| **Berserker's Ledger** (t2-att-att-att) | 8 dmg × 3 = 24 dmg base, scales STR aggressively, AOE, **rare** mas 2-stam 3s CD. Em STR=4, hits 3 × (8 + 4) × 4 STR = 144 dmg em uma carta. Bleed 2 self é o único downside. |
| **Tectonic Reckoning** (t2-air-cou-earth) | Exhaust mas: AOE Stun 3 + force-trigger TODAS as suas cartas. Combina com decks armadilha (Wrathshell Vow + Crimson Spiral + ...). Boss melter automatizado por 3S 2M. |
| **Citadel Inferno** (t2-def-fire-fire) — Exhaust | AOE Pierce = Armor × 2 (scales STR). Com Bedrock Bulwark + Aegis of Returning Wrath (armor 22), Citadel solta 22*2=44 base AOE Pierce *× STR*. Trivially one-shots qualquer T1-T2 boss se houver setup. |
| **Cleaver's Tax** (t2-att-cou-cou) | 12 Pierce base + 20 Pierce (Overload) = 32 Pierce em 2.0s CD com 2S. Com STR=4 = 128 dmg single. Overload lockout 4s é gerenciável com Haste. |
| **Wrath Squall** (t2-air-cou-cou) | Quando Rage atinge 30, deal 40 + Slow 8, reset rage. Junto com Wrathshell Vow (gera +1 Rage/3s + hit-taken) e cards de rage, é trivial chegar a 30 Rage. 40 × STR de damage AOE-like. |
| **Misted Cadence** (t2-air-water-water) | 2M, 2.6s, Heal 9 + Haste 25%/8s + 3 Mana. Net mana ≈ +1, heal forte, haste alto, CD curto. Mage tem fonte praticamente infinita de sustain. |
| **Aegis of Returning Wrath** (t2-def-def-def) | 2S, 3.6s, Armor 22 + Brace 18 Pierce. Combinado com `Bedrock Bulwark` re-arm 6 → infinite armor wall que sempre detona 18 Pierce na quebra. |

### 4.3 🟡 Cartas Underwhelming (Abaixo da Curva)

| Carta | Issue |
|---|---|
| **Magma Vein** (t1-earth-fire) | 2 mana, 2.3s CD, Armor 7 + 8 dmg + Burn 2. Mana 2 é raro em T1; com Burn-DOT fixo (não escala), o Burn 2 é praticamente irrelevante fora de Pyre builds. Steam Surge (1M) faz mais sustain por bem menos. |
| **Bramble Bulwark** (t1-def-earth) | 1S, 2.0s, Armor 8 (VIT) + 6 Pierce se armor ≥ 10. Condition raramente atendida com 8 base; complicado de habilitar em T1. |
| **Tremor Dash** (t1-agi-earth) | 1S net 0 (refund), 1.6s, 5 dmg + Armor 4 + Stam refund. Solid mas not memorable; perde para Sidestep & Slash em quase tudo. |
| **Mire Bloom** (t1-earth-water) | 0 cost, 1.8s, Armor 6 + Heal 4 + 5 dmg. Bom mas modesto. (Note: este *é* bem balanceado, listado para contraste.) |
| **Kindle Strike** (t1-att-fire) | 1S, 1.5s, 5 dmg + Burn 2 + VulnFire 1/5s. Burn 2 sem Pyre engine = 2 dmg/tick fixo; VulnFire só adiciona +1 na próxima aplicação de Burn. Em decks sem Pyre, é um 5 dmg/1.5s = 3.3 DPS, fraquíssimo. |
| **Tremor Lock** (t1-earth-earth) | Como acima — strict dominado por Frostbind. |
| **Hollow Echo** (t1-air-cou) | 0 cost, 1.3s, 5 dmg + Vengeance 3 + Haste 15%/4s. Net positivo mas comparado com Sidestep & Slash, sem stam refund e sem bleed. |
| **Quench Lance** (t2-fire-fire-water) | Cool conceito (convert burn→bleed depois detona), mas precisa de burn pré-aplicado, e o output (4 per Bleed após convert) é modesto. Versus Wrath Brand (12 dmg + Burn 2 condicional Rage) — Quench faz menos. |

### 4.4 🟡 Erro no Starter Deck do Mage
**Bedrock Snare** (t1-air-earth) custa **1 STAMINA**, não 1 mana. Mage tem `maxStamina: 30` e `maxMana: 60`. A carta está no `starterDecks.mage`. Mages que entram no jogo gastam a única stamina deles cedo (já que outras cartas mage são mana-based) e param de poder jogar Bedrock Snare.

**Fix:** Mudar `cost` de Bedrock Snare para `mana: 1`, ou trocá-la na starter do mage por outra água-earth mais apropriada (ex: t1-earth-water Mire Bloom).

---

## 5. Sistemas / Mecânicas Globais

### 5.1 🔴 STR multiplica TUDO (escalonamento desbalanceado)
**Fórmula (CardResolver.ts:361):**
```ts
baseDmg = (resolvedValue + hitBonus) * heroStrength * dmgMult * buffMult * channelMult * dealtMult
```
STR é um **multiplicador linear universal** em todo dano (incluindo cartas que escalam DEX/INT).

**Impacto numérico:** Quickstrike (scales DEX, per 2, value 2):
- DEX=4, STR=1: damage = (6 + 4) × 1 = **10**
- DEX=1, STR=4: damage = (6 + 0) × 4 = **24**
- DEX=4, STR=4: damage = (6 + 4) × 4 = **40**

Investir em **STR sempre ganha** mais dano por ponto do que investir em DEX (mesmo em cartas DEX-scaled), porque STR multiplica enquanto DEX adiciona.

**Builds afetadas:**
- DEX builds: pouco retorno, viram dependentes de STR.
- INT builds: ganham só +1 flat (CombatEngine.ts:269-275) por hit em cartas magic + scale, mas STR multiplica esse +1 também? Sim: o INT bonus é aplicado pós-defesa e fora do `baseDmg`, então STR *não* o multiplica. Pequena compensação, mas INT ainda perde para STR em curva.

**Fix sugerido:** Múltiplas opções (escolher uma):
1. **STR como aditivo:** Mudar fórmula para `baseDmg = resolvedValue + heroStrength + hitBonus`. STR vira mais um axis de scaling, não um multiplier global.
2. **STR percentual:** `baseDmg = resolvedValue × (1 + (STR-1)*0.10)`. Cada ponto STR = +10% dmg. Equilibra com DEX/INT.
3. **Cartas DEX/INT-scaled multiplicam por DEX/INT** ao invés de STR. Requer refator do effect resolver.

A opção 2 é a menos invasiva e mantém STR relevante.

### 5.2 🟠 Burn ammunition vs decay (já citado em 2.4)
Burn não decai e dá DOT fixo. Em combates longos, 1 Burn aplicado cedo gera 2 dmg/tick por toda a duração — eventualmente um valor enorme. Em combates curtos, mesmo 12 Burn dá só 2 dmg/tick. A relação "investir em Burn vs investir em Bleed" é **bimodal**:
- Combate < 6 ticks: Bleed N > Burn N (Bleed n×(n+1)/2 vs Burn 2×ticks ≈ 12).
- Combate > 10 ticks: Burn N (passivo) + Pyre detonation > Bleed N.

Isto não é inerentemente ruim (recompensa builds específicas), mas a falta de clareza no comportamento (ver 2.4) faz jogadores não entenderem quando Burn vale.

### 5.3 🟠 Synergies vazias
**`src/data/json/synergies.json` = `[]`**.

O sistema `SynergySystem` está implementado em `combat/SynergySystem.ts` e plugado em `CombatEngine.executeCard` (com cooldown_reduction, cost_waive, etc.), mas **zero entradas estão definidas**. Adjacency synergies (tiles) existem em `SynergyResolver.ts` mas card-pair synergies estão dormentes.

**Impacto:** Combo gameplay anunciado pelo design não existe. Players podem perceber que sequências de cartas não fazem nada especial — frustração / sentido de feature incompleta.

**Fix:** Definir 15-30 pares de cartas iniciais cobrindo arquétipos:
```json
[
  { "cardA": "t1-fire-fire", "cardB": "t1-attack-fire",
    "displayName": "Ignite", "bonus": { "type": "dot", "stack": "burn", "value": 1 } },
  { "cardA": "t1-water-water", "cardB": "t1-earth-earth",
    "displayName": "Frozen Earth", "bonus": { "type": "dot", "stack": "stun", "value": 1 } },
  ...
]
```

### 5.4 🟡 Stack `arcane` é dead content
`StackId` lista `arcane` e o engine implementa `arcaneStacks` com cap 10 (Pitfall 8). **Nenhuma carta T1/T2 aplica arcane.** Provavelmente reservado para Mage T3, mas atualmente é só código sem uso.

**Fix:** Ou (a) implementar 2-3 cartas arcane-based em T2 para mage, ou (b) remover stack `arcane` do schema até existir conteúdo.

### 5.5 🟡 Curva de custo "sem custo" vs "1 custo"
Muitas cartas T1 sem custo (Sidestep & Slash, Stormstrike, Gale Cut, Hollow Echo, Parrying Stance, Cyclone Ward, Mire Bloom, Misting Veil, Pyre, Flame Dart) entregam efeitos **equivalentes ou melhores** que cartas 1-stamina/1-mana similares.

**Exemplos:**
- Parrying Stance (0 cost, Armor 5 + Stam refund + Brace 4) >>> Bulwark Vow (1 stam, Armor 6 + Brace +2 Rage)
- Stormstrike (0 cost, 6 dmg AOE + Haste) > Quickstrike (1 stam, 6 dmg single)
- Pyre (0 mana, 4 dmg + Burn 3) >> qualquer fire card 1-mana T1

**Fix:** Auditar todas as cartas "no cost" — ou (a) reduzir números até 70% do equivalente 1-cost, ou (b) adicionar cost mínimo (1 stam/mana) e re-balancear.

### 5.6 🟡 Cooldown reduction soft-cap pode ser muito generoso
`getCdReductionFactor` (StatusEffects.ts:178-191): cap em 60% (hero cd = 40% base). Com Tempest Cadence (30%) + Tempest Pike (20%) + Quickstep Sigil (25%) sobrepostos = 75% raw → 60% efetivo (cap). Permite cards que normalmente são 3s rodarem em 1.2s.

Não necessariamente errado, mas combinado com **STR multiplier (5.1)** e **Berserker's Ledger (4.2)**, gera DPS extremo no late game. Validar: o boss HP scaling acompanha?

---

## 6. Habilitadores de Combo (avaliação positiva)

O sistema de combos *intra-carta* funciona bem. Detonadores e enablers identificados:

### Burn → Pyre
- **Enablers:** Pyre (auto-self), Kindle Strike, Flame Dart, Cinderscar, Magma Vein, Wickfencer, Cinder Thrust, Forge Strike, Galebrand
- **Detonadores:** Pyre (Pyre:3), Cinderlance (Pyre 3 Pierce × 2), Supernova (5 Pierce per Burn AOE), Venom Detonation (Pyre 2), Cinder Sprint (Pyre 4), Tremor Detonate (3 per Burn + bleed + poison)
- **Veredito:** ✅ Boa profundidade. Supernova é especialmente versátil.

### Bleed → finishers
- **Enablers:** Razor Stance, Sidestep & Slash, Bramble Step, Quicksilver Bleed, Razor Cadence, Vein Splitter, Cinderscar (convert burn→bleed), Crimson Cascade (spread on kill)
- **Detonadores:** Bloodlash Salvo (3 Pierce per Bleed + 2 vengeance), Crimson Spiral (rage×2 + 1 Bleed per Rage), Necrotic Festering (consume Bleed → Poison + Pierce), Tremor Detonate
- **Veredito:** ✅ Funcional, mas o decay -1/tick faz Bleed depender de aplicação frequente. Razor Stance + multi-hit é a chave (Triple Slash, Berserker's Ledger).

### Rage → Berserk / Crimson Spiral
- **Enablers:** Reckless Strike (+1), Bloodprice Strike (+2 scale STR), Wrathshell Vow (channel: +1/3s + on hit taken), Tombrage (+8 on HP<40%), Stonewrath (+6 on HP<50%), Iron Reckoning (Stance with rage multiplier)
- **Detonadores:** Crimson Spiral (rage×2), Cleaver's Tax (Overload 5+ Rage → 20 Pierce), Wrath Brand (Empowered if Rage), Wrath Squall (30 Rage → 40 dmg + Slow 8), Stormrage (Empowered if Rage → Slow 8)
- **Veredito:** ✅ Excelente diversidade. Wrath Squall com 30 Rage é uma carta finisher icônica. Wrathshell Vow + Crimson Spiral é loop favorito.

### Slow → finishers
- **Enablers:** Frostbind, Tremor Lock, Bedrock Snare, Galekick, Cinder Squall, Wrath Squall, Galetide, Dust Plague, Gale Echo, Zephyr Cascade
- **Detonadores:** Static Skirmish (3 Pierce per Slow), Sandfury (2 Pierce per Slow), Thunderstrike Catalyst (consume 4 Slow → 6 Pierce/stack), Cinder Squall (Slow≥5 → Stun)
- **Veredito:** ✅ Boa árvore. Slow tem benefício duplo (DOT + CD slow inimigo), excelente.

### Poison → finishers
- **Enablers:** Brine Bedrock, Stagnant Bulwark, Bogplate, Steaming Plague, Bog Catalyst (×2), Drowner's Dart, Slipvenom Tempo
- **Detonadores:** Drowning Lance (3 Pierce per Poison consumed), Marsh Squall (spread + 4 Pierce per Poison), Alchemic Drain (Heal 4 per Poison consumed, ✨ heal detonator!), Mirebreaker (Empowered if Poison: +6 Pierce), Tremor Detonate
- **Veredito:** ✅ Tem o **único detonador de heal** (Alchemic Drain). Boa profundidade.

### Stun → não tem detonador
- **Enablers:** Frostbind, Tremor Lock, Concussive Smash, Bedrock Snare (Slow≥4 → Stun), Tectonic Reckoning (AOE Stun 3)
- **Detonadores:** Stormstone Tempo (`enemy_stunned: true` → 6 Pierce STR) — só 1 carta.
- **Veredito:** ⚠️ Apenas 1 detonador. Stun é mais um "controle" do que combo enabler. Considerar adicionar 1-2 cartas T2 com bonus quando inimigo stunned.

### Armor → finishers (Fortified / Brace)
- **Enablers:** Bulwark Vow, Bramble Bulwark, Bedrock Bulwark, Aegis of Returning Wrath, Granite Lunge, Thornwall, Pyric Bulwark, Citadel Inferno
- **Detonadores:**
  - **Fortified** (armor ≥ N → bonus): Bramble Bulwark (6 Pierce), Mountain's Will (8 Pierce), Earthcleaver (8 Pierce), Quarry Dance (8 dmg), Cliffwind Maul (10 Pierce), Cinderquake (4 Pierce + Burn 2), Mountain's Answer (22 Pierce)
  - **Brace** (on_armor_break): Bulwark Vow, Thornwall, Stoneward Reprisal, Ashen Bulwark, Bramble Step, Slag Maul, Magmavow, Stagnant Bulwark variants, Tombplate, Aegis of Returning Wrath
  - **Body Slam / Granite Lunge** (armor source): scale armor → dmg
  - **Citadel Inferno**: spend ALL armor → AOE Pierce × 2
- **Veredito:** ✅ Excelente. **A árvore Armor é a mais profunda do jogo.** Permite tank builds completos e desfecho explosivo.

---

## 7. Recomendações Priorizadas

### Imediato (esta semana)
1. **🔴 Corrigir "Drain" bug** (Mist Step, Firestorm): mover `value:-1` para `cost` ou implementar enemy mana/stamina (recomendo o primeiro).
2. **🔴 Decidir e corrigir Vengeance**: reescrever glossário OR refatorar condições nas cartas.
3. **🔴 Adicionar 8 keywords ausentes** ao `KEYWORD_DEFINITIONS`: Aura, Echo, Overload, Stance, Channel, Catalyze, Devour, DR, Pyre, Spread, Convert.
4. **🔴 Bedrock Snare** no starter mage: mudar custo para 1 mana.
5. **🔴 Shield Bash Taunt**: implementar OR remover Taunt + substituir efeito.

### Curto prazo (próxima sprint)
6. **🟠 Decidir comportamento de Burn DOT**: implementar opção (A) escalonamento por stacks, ou redesenhar para Embers/Burn split. Atualizar glossário.
7. **🟠 Re-balancear cartas dominadas** (Reckless Strike, Tremor Lock, Phalanx Drift, Footwork Stone, Quickstep Sigil, Concussive Smash, Shield Bash). Numbers tweaks ou redesign de efeitos.
8. **🟠 Auditoria "no cost"**: revisar 10+ cartas sem custo. Adicionar custo mínimo ou reduzir valores.
9. **🟠 Definir 15-30 synergies** em `synergies.json` cobrindo arquétipos principais.
10. **🟠 Decisão STR multiplier**: mover para opção 2 (percentual) para destravar builds DEX/INT.

### Médio prazo
11. **🟡 Stack arcane**: implementar ou remover. Recomendo implementar 3 cartas mage T2.
12. **🟡 Stun detonator**: adicionar 1-2 cartas T2 com `enemy_stunned: true`.
13. **🟡 Padronizar scaling**: documentar curva oficial de `per:value` por tier/categoria, normalizar outliers.
14. **🟡 Berserk / Steady / Expose**: ou remover do glossário ou implementar.
15. **🟡 Frenzy nas descrições**: padronizar string de descrição vs render UI.

### Longo prazo
16. Considerar nerf nos "boss melters" (Tectonic Reckoning, Citadel Inferno, Wrath Squall@30 Rage) ou re-escala de HP de boss para acompanhar.
17. Re-avaliar cap de cd_reduction (60%) interagindo com Tempest Cadence (30%) + multi-haste empilhada.

---

## 8. Notas Finais

**Pontos fortes do design atual:**
- Árvore de combos Burn/Bleed/Rage/Slow/Poison/Armor com detonadores claros e enablers diversos.
- Sistema de stats (STR/DEX/VIT/INT/SPI) cobre 5 builds distintas.
- Tier-2 com mecânicas inovadoras (Channel, Echo, Overload, Devour, Citadel armor-spend).
- Categorização attack/defense/magic + 8 elementos + tier dá ~150 cartas, espaço enorme para variedade.

**Maiores gaps:**
- Sistemas implementados sem conteúdo (synergies, arcane).
- Glossário desatualizado em relação às cartas reais (Vengeance, Guard, Burn DOT, Taunt).
- STR como multiplier global suprime variedade de build numerical.

**Cartas-âncora bem desenhadas** (manter, são modelos):
- Pyre (t1-fire-fire) — exemplo limpo de enabler+detonador self-contained.
- Iron Reckoning — uso brilhante de Stance modifier com stack-scaled.
- Bedrock Bulwark — re-arm armor é excelente design de "second chance".
- Alchemic Drain — único poison-heal detonator, criativo.
- Tectonic Reckoning — finisher emblemático embora possivelmente OP.

Este relatório cobre o estado de **2026-05-20**. Re-execução do mesmo processo é recomendada após cada wave de balance changes.

---

## Apêndice — Wave 1 aplicada (2026-05-20)

### Engine
- **Vengeance v2**: `CardEffectCondition.took_damage_within_ms` adicionado em `types.ts`. `CombatState` ganhou `combatElapsedMs` e `lastHeroDamageMs`. `EnemyAI.applyHeroDamage` registra o instante de toda perda de HP (inclui Self-Burn/Self-Bleed/self-damage de cartas). `CardResolver` avalia a nova condição. `CombatEngine.tick` sincroniza o relógio.
- **STR multiplier**: trocado o `value × STR` por `value × (1 + max(0, STR-1) × 0.25)` em `CardResolver` (dano principal) e `StatusEffects.applyTriggeredPayload`. STR 1 mantém 1.0× (baseline), STR 4 → 1.75×, STR 10 → 3.25×. Builds DEX/INT agora têm retorno proporcional ao seu investimento.
- **Synergies removidos**: `SynergySystem.ts` e `src/data/json/synergies.json` apagados. `CombatEngine` deixou de checar pares de cartas. Comentários inline marcam onde a chamada existia.
- **Arcane stack removido**: tirado de `StackId`, `CombatState`, `CardResolver` switch cases, `StatusEffects.sumModifierStackScaled`, `EffectIcons` (ícone + chip), testes (`EffectIcons.test.ts`, `card-resolver.test.ts`, `combat-state.test.ts`, `dot-mechanics.test.ts`, `enemy-ai.test.ts`, `status-effects.test.ts`, `tier2-primitives.test.ts`). Relic `arcane_crystal` mantida (era só nome, não usava o stack).
- **Taunt removido**: tirado de `CardEffect.type` union em `types.ts` e do dispatcher em `CardText.ts`. Glossário atualizado.

### Cartas
- **Mist Step** (`t1-agility-water`): "Drain 1 Mana" trocado por **Slow 1**. Descrição reescrita.
- **Firestorm** (`t1-air-fire`): "Drain 1 Stamina" trocado por **Stun 1 (scales INT)**.
- **Shield Bash** (`t1-attack-defense`): Taunt removido. Agora **Deal 10 + Aura 6s: enemy Defense −3**. Mantém o custo de 4 armor.
- **Reckless Strike** (`t1-attack-attack`): bumpado para **9 dmg (scales 2/2 STR) + 2 Rage + Self Bleed 1, CD 1.2s**. Diferenciado de Flurry Step (alto burst + rage builder, em vez de speed striker).
- **Tremor Lock** (`t1-earth-earth`): redesenhado para **Stun 1 (INT) + Slow 4 (INT) + Empowered (if Stunned): +5 dmg**, CD 2.0s. Foco em controle e setup de stun-detonator (preenche o gap mencionado em 6.7).
- **Phalanx Drift** (`t2-agi-def-def`): bumpado para **Armor 22 (VIT 3/2) + Haste 10% (8s) + Brace 10**. Identidade fortaleza pesada (vs Veil of Steps que é defesa rápida).
- **Footwork Stone** (`t2-agi-agi-earth`): redesenhado para **Armor 8 (DEX) + 1 Stam refund + Haste 25% (5s)**. Identidade mobilidade leve (vs Stonepacer que é AOE armor).
- **Quickstep Sigil** (`t2-agi-agi-agi`): redesenhado para **Deal 4×3 (DEX, multi-hit) + 1 Stam refund + Haste 30% (5s), 1 stam, CD 1.8s**. Identidade burst-haste híbrido (vs Tempest Cadence que é AOE haste mage).
- **Concussive Smash** (`t2-att-att-earth`): exhaust removido, agora **Deal 14 (STR 2/2) + Stun 2 (INT) + Slow 3, CD 2.4s, 2 stam**.
- **Bedrock Snare** (`t1-air-earth`, mage starter): custo **stamina → mana**. Consistente com a identidade do mage.
- **Frostbind** & **Glacial Pact**: descrição agora inclui explicitamente "Frenzy: CD −30% below 50% HP".

### Vengeance migration (13 cartas)
Todas convertidas de `hero_hp_pct_below: 50/60/40` para `took_damage_within_ms: 2000`. Valores ajustados onde a facilidade de trigger justificava nerf:

| Carta | Antes | Depois |
|---|---|---|
| Razor Stance | Aura +4s (50%HP) | Aura +4s (took dmg 2s) |
| Sidestep & Slash | Deal 5 (60%HP) | Deal 3 (took dmg 2s) |
| Cinderscar | Convert 2 Burn (60%HP) | Convert 2 Burn (took dmg 2s) |
| Bloodtide Mend | Heal 4 (50%HP) | Heal 3 (took dmg 2s) |
| Hollow Echo | Deal 3 (50%HP) | Deal 3 (took dmg 2s) |
| Bloodlash Salvo | +2 Pierce/Bleed (50%HP) | +2 Pierce/Bleed (took dmg 2s) |
| Razor Cadence | ×4 hits (50%HP) | ×4 hits (took dmg 2s) |
| Brine Bedrock | Poison 4 (50%HP) | Poison 3 (took dmg 2s) |
| Magma Vow | 20 Pierce (40%HP) | 14 Pierce (took dmg 2s) |
| Granitewrath | 12 Pierce (50%HP) | 10 Pierce (took dmg 2s) |
| Venom Dance | Convert 5 (60%HP) | Convert 5 (took dmg 2s) |
| Quickearth Rite | 14 Pierce (60%HP) | 10 Pierce (took dmg 2s) |
| Bogplate | Poison 4 (60%HP) | Poison 3 (took dmg 2s) |

### Glossário (`KeywordDefinitions.ts`)
- **Adicionados (12)**: Aura, Catalyze, Channel, Convert, Devour, DR, Echo, Exhaust, Frenzy, Overload, Spread, Stance.
- **Removidos (4)**: Berserk (migrado para "Empowered (if Rage)"), Expose (0 cartas), Steady (0 cartas), Taunt (mecânica removida).
- **Atualizados**: Burn (explica que stacks acumulam para Pyre, dano fixo de 2/tick), Guard (HP threshold, não chance %), Vengeance (took damage in last 2s), Fortified (explicita threshold), Pyre (×Burn stacks).

### Type-check
`npx tsc --noEmit` → 22 erros restantes, **todos pré-existentes** (variáveis não usadas em outras scenes, `cleanse` órfão em `CardVisual`, type widening em mocks de teste). Nenhum erro introduzido pelas mudanças desta wave.

### Pendente (próxima wave)
- Auditar cartas "no cost" (Sidestep & Slash, Stormstrike, Cyclone Ward, Parrying Stance, etc.) e re-balancear se ainda outperformarem 1-cost equivalentes pós-mudança de STR.
- Considerar nerf nos boss melters (Tectonic Reckoning, Citadel Inferno) — STR multiplier mais brando já reduziu impacto, mas convém validar in-game.
- Adicionar mais 1-2 detonadores de Stun (atualmente só Stormstone Tempo + Tremor Lock empowered).
- Auditar valores em cartas que escalam STR per 2 value 2 vs per 2 value 1 — padronizar curva por tier.

---

## Apêndice — Wave 2 aplicada (2026-05-20)

### Frenzy removido completamente
- `CardDefinition.frenzy` retirado de `types.ts`.
- `CombatEngine.tick`/cooldown block que multiplicava CD por `cd_mult` quando HP <% removido.
- `CardText.ts` parou de prepender "Frenzy: CD …% below …% HP" — `CardDescPick` enxuto.
- Glossário (`KeywordDefinitions.ts`) sem entrada Frenzy.
- Comentários em `AuraTriggerKind` / `ScaleSourceKind` limpos das menções históricas.

### Migração Frenzy → Vengeance (2 cartas)
| Carta | Antes | Depois |
|---|---|---|
| **Frostbind** (`t1-water-water`) | Stun 1 + Armor 4 + Frenzy CD −30% (<50%HP) | Stun 1 + Armor 4 + **Vengeance: Stun 1** (scales INT) |
| **Glacial Pact** (`t2-air-counter-defense`) | Slow 4 + Armor 8 + Frenzy CD −30% (<50%HP) | Slow 4 + Armor 8 + **Vengeance: Slow 3 + Haste 20% (5s)** |

A identidade "fica mais perigoso quando machucado" persiste, agora dentro do mesmo gate (took damage 2s) usado por todas as outras cartas de pressão.

### Resource enablers (3 cartas re-baseadas)
Para que decks que gastam mana/stamina não fiquem famintos, três cartas T1 ganharam refund explícito (com leve nerf compensatório):

| Carta | Antes | Depois |
|---|---|---|
| **Bulwark Vow** (`t1-defense-defense`, warrior starter) | Armor 6 (VIT 4/2) + Brace +2 Rage, 1 stam | **Armor 5 (VIT 3/2) + +1 Stamina** + Brace +2 Rage, 1 stam — *net 0 stam, sustenta o ciclo defensivo* |
| **Tailwind** (`t1-air-air`, mage) | Deal 4 + Haste 25% (5s), 1 mana | **Deal 3 + Haste 20% (4s) + +1 Mana**, 1 mana — *net 0 mana, refound puro* |
| **Misting Veil** (`t1-air-water`, mage) | Heal 3 + Haste 20% (5s) + INT +1 (6s), 1 mana | **Heal 2 + Haste 15% (4s) + INT +1 (6s) + +1 Mana**, 1 mana — *net 0 mana, sustain leve para builds mage* |

Outras cartas que já refundavam recurso (Sidestep & Slash, Parrying Stance, Vow of the Tide, Mist Step, Tremor Dash, Crimson Tithe, Granite Lunge, Bloodprice Strike, Quickstep Sigil, Footwork Stone, Steam Surge, Tidesong Aura, Squall Aura, Misted Cadence) ficam inalteradas.

### Type-check
`npx tsc --noEmit` → 22 erros, mesmo número e tipos da wave 1 (todos pré-existentes, nenhum introduzido pela remoção de Frenzy).

---

## Apêndice — Wave 3: Descrições e Glossário (2026-05-20)

### Problema raiz
O formatter dinâmico `CardText.ts` (usado no DeckBuilder) e a `description` estática (usada no CardVisual/CardDetailPopup/CardFilterBar) estavam desincronizados:
- `took_damage_within_ms` (Vengeance) **não tinha prefix** no `prefixFromCondition` — gerava "Stun 1, Armor 4, Stun 1" sem rótulo de Vengeance.
- `hero_hp_pct_below` ainda renderizava "Vengeance (<N% HP)", confundindo com o novo gate de Vengeance v2.
- Vários keywords usados pelo formatter (`Shatter`, `Reflex`, `Juggernaut`, `Rupture`, `Bloodforge`, `Cascade`, `Frost Echo`, etc.) não tinham entrada no glossário, então os tooltips falhavam.
- `(scales STAT)` com `s` minúsculo nunca acionava o regex `\bScales\b` do detector.

### CardText.ts
- `took_damage_within_ms` agora renderiza `Vengeance:`.
- `hero_hp_pct_below` agora renderiza `Berserk (<N% HP):` (separa visualmente do Vengeance v2).
- `hero_hp_pct_atleast` agora renderiza `Steady (>N% HP):` (com o threshold visível).
- `scaleSuffix()` capitaliza para `(Scales STAT)` — alinhado com o glossário.

### KeywordDefinitions.ts (+18 keywords)
Adicionados ao glossário com definições alinhadas ao comportamento real do engine:
Berserk, Bloodforge, Cascade, Empower, Expose, Frost Echo, Juggernaut, Mitigate, On Hit, Reflex, Reforce, Rupture, Shatter, Siphon, Steady, Strip, Threshold, Vulnerable, Weakened.

### Descrições corrigidas — 5 cartas com mismatch real
| Carta | Problema | Correção |
|---|---|---|
| **Wrathshell Vow** | Descrição dizia "+1 Rage every 3s **(scales STR)**" mas o efeito não escalava STR | Removido "(scales STR)" |
| **Brine Crucible** | Omitia o efeito **Bleed 2** unconditional aplicado junto da conversão; também escondia que o `+3s CD` é incondicional | "Bleed 2 (Scales DEX). Convert all Burn → Bleed (1:2, Scales DEX). Overload: +3s next CD." |
| **Crimson Cascade** | Descrevia "spread 50% Bleed" — na verdade aplica **flat Bleed 4 (scales SPI)** no inimigo mais próximo | "Cascade (Bleed) 15s: on Bleed-kill, apply Bleed 4 to nearest (Scales SPI)." |
| **Razor Stance** | "+4s" sugeria extensão da aura — é uma **aura paralela de 4s** que dobra Bleed sob Vengeance | "On Hit 10s: apply Bleed 1 (Scales DEX). Vengeance — On Hit 4s: apply +1 Bleed." |
| **Necrotic Festering** | Atribuía INT scaling ao Pierce, mas o Pierce escala **STR** | "Self Bleed 3 (Scales DEX). Apply Poison equal to your Bleed (Scales INT). Consume all Bleed: 4 Pierce per stack (Scales STR)." |

### Pendente (próxima wave de polish)
- Normalizar todas as descrições estáticas para "Scales STAT" capitalizado (atualmente são lowercase em ~80% das cartas — só novas/editadas usam capital). Bulk find-replace.
- Considerar fazer CardVisual.ts usar `formatCardDescription(card)` ao invés de `card.description` direto, para garantir que static = dynamic sempre.

---

## Apêndice — Wave 4: UI unificada via dynamic formatter (2026-05-20)

### Problema
Três caminhos de renderização usavam `card.description` (texto estático escrito em `cards.json`):
- `CardVisual.ts` (visual da carta no deck builder, mão, etc.)
- `CardDetailPopup.ts` (popup de detalhes ao clicar na carta)
- `CardFilterBar.pure.ts` (busca textual)

Isso significava que qualquer divergência entre o texto estático e o efeito real (`effects[]`) ficaria invisível até o jogador clicar. As waves 1–3 já tinham reduzido as divergências para 0 mas qualquer edição futura podia re-introduzir.

### Solução
Os três caminhos agora chamam `formatCardDescription(card)` em vez de `card.description`. O formatter monta o texto a partir do `effects[]` em tempo de leitura, então é IMPOSSÍVEL ter mismatch — o que aparece na UI é exatamente o que o engine vai aplicar.

- **CardVisual.ts**: `getEffectiveDesc()` reescrito para construir um `CardDescPick` com `effects` (respeitando upgrade overlay), `exhaust`, `spend_armor`, `cooldown_scale` e passar ao formatter.
- **CardDetailPopup.ts**: idem — `effectiveDesc` agora vem do formatter usando `effectiveEffects`.
- **CardFilterBar.pure.ts**: `applyFilters()` busca em `name + static description + formatted description` — assim termos "flavor" (Restore HP, Wind damage) e termos canônicos (Vengeance, Shatter, Scales STR) ambos batem.

### Implicações
- A `description` estática em `cards.json` deixa de ser fonte da verdade para a UI; agora serve como documentação, busca-flavor e referência para tooling externo (AI, wiki, deck builders externos).
- Edições futuras de cartas só precisam editar `effects[]`; o texto se ajusta sozinho.
- Cartas com upgrade variant (`card.upgraded.effects`) renderizam o texto certo automaticamente quando o slot está upgraded.
- Tooltips de keywords funcionam em toda a UI sem ajuste manual — o detector vê o que o formatter emite.

### Validação
- `npx tsc --noEmit` → 22 erros, todos pré-existentes (mesma lista da wave 1).
- `npx vitest run tests/` → **586 passed, 0 failed, 2 skipped** (testes de keyword glossary e card-resolver foram alinhados com as novas regras: keywords adicionados ao spec, STR multiplier reformulado).

### Testes atualizados
- `tests/ui/KeywordDefinitions.test.ts`: spec de keywords agora inclui Aura, Echo, Overload, Channel, Devour, Stance, Catalyze, Convert, Spread, Exhaust, DR, Shatter, Reflex, Juggernaut, Rupture, Bloodforge, Cascade, Frost Echo, Threshold, Siphon, Vulnerable, Mitigate, Empower, Weakened, Strip, Reforce, On Hit. Remove referência a Taunt (mecânica removida na wave 1).
- `tests/systems/combat/card-resolver.test.ts`: expectativa de "10 dmg × STR 2 = 20" trocada por "10 dmg × 1.25 (soft mult) = 12" para refletir a fórmula v4.

---

## Apêndice — Wave 5: Resource economy + Stun detonators (2026-05-20)

### Regra nova
A pedido do usuário: **cartas de regeneração não podem custar o recurso que regeneram.** Exceção: "grande regeneração" — cartas que pagam N do recurso para devolver N+M com M ≥ 2 (Tidesong Aura, Squall Aura, Misted Cadence se qualificam).

### Strip de refunds net-zero (cost X + refund X = confusing accounting)
Cartas que pagavam stamina/mana e devolviam a mesma quantidade foram normalizadas — refund removido, valor principal boostado para compensar:

| Carta | Antes | Depois |
|---|---|---|
| **Bulwark Vow** (1S) | Armor 5 + +1 Stam + Brace 2 Rage | Armor 7 + Brace **+3 Rage** |
| **Tremor Dash** (1S) | Deal 5 + Armor 4 + +1 Stam | **Deal 7 + Armor 6** |
| **Granite Lunge** (1S) | Armor 4 + 3 + 1/4armor + +1 Stam | **Armor 6 + Deal 4 + 1/4armor** |
| **Quickstep Sigil** (1S) | Deal 4×3 + +1 Stam + Haste 30%/5s | **Deal 5×3 + Haste 30%/6s** |
| **Footwork Stone** (1S) | Armor 8 + +1 Stam + Haste 25%/5s | **Armor 12 + Haste 25%/6s** |

### Cartas de regen dedicadas (cost ≠ resource regenerated)
Custo mana/stamina removido das cartas que devolviam o mesmo recurso, agora são **0-cost regen** com valor principal ajustado:

| Carta | Antes | Depois |
|---|---|---|
| **Tailwind** (mage) | 1 mana, Deal 3 + Haste 20%/4s + +1 Mana | **0 cost**, Deal 4 + Haste 20%/5s + +1 Mana (net regen) |
| **Misting Veil** (mage) | 1 mana, Heal 2 + Haste 15%/4s + INT/6s + +1 Mana | **0 cost**, Heal 3 + Haste 15%/5s + INT/6s + +1 Mana |
| **Gale Cut** (agility/air) | 0 cost, Deal 5 + Haste 15%/4s | 0 cost, Deal 3 + Haste 15%/4s + **+1 Stamina** (nova fonte stam-regen) |
| **Mire Bloom** (earth/water) | 0 cost, Armor 6 + Heal 4 + Deal 5 | 0 cost, Armor 4 + Heal 3 + Deal 3 + **+1 Mana** (nova fonte mana-regen) |

Cartas de regeneração "grandes" (T2, custam mana, devolvem mais) já existiam e continuam OK: Tidesong Aura (cost 2, +3 Mana, net +1), Squall Aura (cost 2, +4 Mana, net +2), Misted Cadence (cost 2, +3 Mana, net +1).

### Boost de payout em cost cards
Cartas que custam recurso mas tinham payout modesto receberam boost para compensar:

| Carta | Antes | Depois |
|---|---|---|
| **Quickstrike** (1S, 0.8s) | Deal 6 (DEX) | **Deal 8 (DEX)** |
| **Kindle Strike** (1S, 1.5s) | Deal 5 + Burn 2 + Vuln Fire | **Deal 7 + Burn 3** + Vuln Fire |

### Detonadores de Stun (Shatter)
Cobertura subiu de 1 carta (Stormstone Tempo + o Tremor Lock da Wave 1) para **4 cartas**:

| Carta | Mudança |
|---|---|
| **Concussive Smash** (t2) | Adicionado `Shatter: Deal 6 (Scales STR)` — auto-detona com o Stun 2 que ela mesma aplica |
| **Bedrock Snare** (t1) | Adicionado `Shatter: Deal 4 (Scales STR)` — dispara após o Stun condicional (Slow ≥ 4) |

Agora cada arquétipo de stack tem ≥2 detonadores: Burn/Pyre, Bleed/Crimson, Poison/Drowning Lance, Slow/Static Skirmish, Rage/Wrath Squall, **Stun/Shatter**.

### Validação
- `npx tsc --noEmit` → 22 erros pré-existentes, 0 novos.
- `npx vitest run tests/` → **586 passed, 0 failed, 2 skipped**.
