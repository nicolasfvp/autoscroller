## Resumo

Este PR consolida o trabalho da branch `refactor/tilevisual-world-planning-split`, incluindo o **merge auditado com os commits do Nicolas (upstream/main)** e a implementação de **efeitos visuais de status na CombatScene**.

---

## Merge com o Nicolas (upstream/main) — commit `66aa361`

O upstream foi auditado manualmente antes de aceitar. Foram identificados e corrigidos os seguintes problemas introduzidos pelos commits do Nicolas:

### Bugs corrigidos no merge

**Caminhos de assets quebrados no Preloader:**
- `btn_forge` e variantes movidos para `assets/ui/` (diretório errado) — restaurado para `assets/ui/buttons/`
- `bg_green_field`, `bg_sky`, `bg_desert` movidos para caminhos inexistentes — restaurado para `assets/backgrounds/loop/`

**Assets removidos indevidamente:**
- `forge_frame_01` e `forge_fire_sheet` (usados pela ForgeScene) foram deletados do Preloader — restaurados
- `shop_btn_sell` e `shop_gold_panel` (usados por ShopScene/ForgeScene) também deletados — restaurados

**Erros de TypeScript:**
- `KeywordIntroOverlay.ts`: usava `PANEL_W`/`PANEL_H` sem definir as constantes — definidas
- `GlossaryPanel.ts`: referenciava `DEFINITION_FONT` em vez de `DEF_FONT` — corrigido
- `deck-battle-sim.test.ts`: variável `enemyMaxHP` declarada e não usada — removida

**O que o Nicolas adicionou (mantido integralmente):**
- Sistema de rebalance de cartas
- UI de Keywords/Glossário com renderTokenText e ícones
- Sistema de KeywordIntro (first-encounter modal)
- Tooling de auditoria de deck

---

## Status Effects Visuais — CombatScene

Implementação de `_updateStatusFX()` chamado a cada `update()`:

- **Herói:** burn (`_fxHeroFire`), bleed (`_fxHeroBleed`), stun (`_fxHeroStun`) — lê `heroBurnStacks`, `heroBleedStacks`, `heroStunStacks/heroStunned`
- **Inimigo:** burn (`_fxEnemyFire`), bleed (`_fxEnemyBleed`), stun (`_fxEnemyStun`), poison (`_fxEnemyPoison`) — lê `burnStacks`, `bleedStacks`, `stunStacks`, `poisonStacks`
- Sprites criados on-demand quando stacks > 0, destruídos quando voltam a 0
- Posições calibradas via DebugManager (debug-layout.json): inimigo burn em `(612.5, 636.3)` com `displayW=252`
- `cleanup()` destrói todos os 7 sprites ao encerrar o combate

---

## Outros (commits anteriores nesta branch)

- `refactor(tiles)`: separa `TileVisual` em `WorldTileVisual` e `PlanningTileVisual`
- `feat(combat)`: cartas de ataque de inimigo + fila espelhada
- `feat(combat)`: efeitos visuais de heal (folhas animadas), defend e channel

## Test plan

- [ ] Iniciar CombatScene e aplicar burn no inimigo — sprite de fogo aparece na posição do inimigo
- [ ] Remover burn — sprite some sem crash
- [ ] Herói sofrendo burn — sprite aparece na posição do herói (separado do inimigo)
- [ ] Stun no herói — sprite de stun aparece
- [ ] Encerrar combate — cleanup destrói todos os sprites sem erro
- [ ] ForgeScene e ShopScene carregam sem asset missing
- [ ] Glossário abre sem erro de TypeScript em runtime
- [ ] `tsc --noEmit` sem erros

Generated with [Claude Code](https://claude.com/claude-code)
