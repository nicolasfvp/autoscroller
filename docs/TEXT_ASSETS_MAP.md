# Text Assets Map — Boxed/Balloon UI Text

Mapa de todos os textos que aparecem em caixas, painéis ou balões visuais no jogo.
Candidatos a substituição por imagens geradas via ComfyUI.

---

## 1. Tutorial Steps
**Onde:** CharacterSelect → DeckCustomization → GameScene → CombatScene → PlanningOverlay → ForgeScene  
**Arquivos:** `src/systems/tutorial/TutorialDirector.ts:50-196`, `src/ui/TutorialOverlay.ts:60-340`  
**Conteúdo:** Título + corpo instrucional + botão "Next →", em painel escuro com borda dourada.  
**Exemplos de texto:**
- "Welcome, hero." / "This run is your training ground..."
- "Pick a class" / "Two classes — Warrior swings steel, Mage hurls elements..."
- "Meet your deck" / "These cards define how you fight..."
- "The loop walks itself" / "Your hero walks an endless loop..."
- "Combat is automatic" / "Cards play themselves — your job is to build the deck..."
- "Plan the next loop" / "Click START LOOP to send your hero out..."
- "Place a combat tile", "Drop a subtile", "Combine elements"

---

## 2. Inline Event / Loot Notifications
**Onde:** GameScene (durante o scroll, após combates/eventos/tesouros)  
**Arquivos:** `src/systems/InlineEvents.ts:31-143`, `src/ui/LootNotification.ts:9-67`  
**Conteúdo:** Caixas temporárias com fundo em madeira, texto colorido.  
**Exemplos:**
- "+20 HP" (cura)
- "+15–40 Gold" (ouro)
- "-8% HP (trap!)" (armadilha)
- "Pickpocket! -N Gold"
- "Slowed! (3s)"
- "Element Shrine! +N shard"
- "Cursed Treasure! +gold, fight follows"
- "Hidden Path! +3g per tile"
- "+3 stone", "+10 XP", "+N bone"

---

## 3. Keyword Tooltip
**Onde:** Hover em cartas (fora do combate), 800ms de delay  
**Arquivos:** `src/ui/KeywordTooltip.ts:204-306`  
**Conteúdo:** Painel lateral com título "Keywords", lista de keyword (nome colorido por categoria) + definição.  
**Categorias de cor:** laranja (stack), dourado (modifier), ciano (stat)

---

## 4. Keyword Intro Modal
**Onde:** Primeiro uso de um keyword novo em combate  
**Arquivos:** `src/ui/KeywordIntroOverlay.ts:35-160`  
**Conteúdo:** Pausa o combate. Badge "New [Category]", nome do keyword em destaque, definição canônica, botão "Got it! (Enter)".  
**Fundo:** banner em madeira

---

## 5. Building Description Panels
**Onde:** City Hub → cada prédio  
**Arquivos:** `src/scenes/BuildingPanelScene.ts:18-203`  
**Conteúdo:** Painel pergaminho com nome, descrição, "Level N / Max", lista de unlocks por tier.  
**Exemplos:**
- Forge: "Unlock new cards for the loot pool"
- Library: "Unlock passive skill tiers"
- Workshop: "Unlock new tile types"
- Shrine: "Unlock relics from ancient powers"
- Storehouse: "Boost gathering rates"

---

## 6. Boss Exit Choice Panels
**Onde:** BossExitScene (após derrotar o boss)  
**Arquivos:** `src/scenes/BossExitScene.ts:47-130`  
**Conteúdo:** Dois painéis lado a lado:
- Verde "Exit Run" — lista materiais + XP garantidos
- Laranja "Continue" — risco "Death means 10% materials, zero XP"

---

## 7. Victory / Defeat Messages
**Onde:** DeathScene, BossExitScene, LoopSummaryScene  
**Arquivos:** `src/scenes/DeathScene.ts:52-60`, `src/scenes/BossExitScene.ts:50-52`, `src/scenes/LoopSummaryScene.ts:42-59`  
**Exemplos:**
- "RUN OVER" (vermelho) + "Defeated by [Enemy]"
- "Boss Defeated!"
- "LOOP N COMPLETE" (dourado) + "✦ +N Tile Points" (ciano)

---

## 8. Loop Completion Celebration (in-world)
**Onde:** GameScene, overlay in-world ao fim de cada loop  
**Arquivos:** `src/ui/LoopCelebration.ts:33-59`  
**Conteúdo:** "LOOP N COMPLETE" (32px, dourado) + "+N Tile Points" (ciano). Aparece sobre o mapa.

---

## 9. Unlock Celebration Modal
**Onde:** Após desbloquear item (collection, building tier)  
**Arquivos:** `src/ui/UnlockCelebration.ts:24-94`  
**Conteúdo:** Backdrop escurecido + "🏆 New Unlock!" (dourado) + nome do item (cor por raridade) + "Check the Collection in CityHub!"

---

## 10. Tavern Panel
**Onde:** City Hub → Tavern  
**Arquivos:** `src/scenes/TavernPanelScene.ts:42-175`  
**Conteúdo:** Painel pergaminho com "Prepare for your next expedition", input de seed, "Run History:" + lista de runs anteriores ("Run #N: Loop M, exit_type").

---

## 11. Relic Tooltip
**Onde:** Hover em relics (planning overlay, relic viewer)  
**Arquivos:** `src/ui/RelicTooltip.ts:46-65`  
**Conteúdo:** Caixa 180px — nome do relic (cor por raridade), descrição do efeito, "From: [fonte]" em cinza.

---

## Prioridade sugerida para substituição por imagem

| Prioridade | Tipo | Motivo |
|---|---|---|
| 🔴 Alta | Tutorial Steps (#1) | Aparecem cedo, narrativos, alto impacto visual |
| 🔴 Alta | Keyword Intro Modal (#4) | Pausam combate, momento de destaque |
| 🟡 Média | Boss Exit Choices (#6) | Decisão crítica, merece peso visual |
| 🟡 Média | Unlock Celebration (#9) | Momento de recompensa |
| 🟢 Baixa | Inline Events (#2) | Muitos textos dinâmicos, difícil de imagificar |
| 🟢 Baixa | Relic Tooltip (#11) | Conteúdo muito variável |
