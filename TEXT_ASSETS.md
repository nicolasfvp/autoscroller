# Text Assets — Inventário para Assets Customizados

Todos os textos renderizados pelo Phaser estão listados aqui.
O objetivo é substituir progressivamente os mais importantes por assets de imagem PNG
(como foi feito com `victory_asset.png`).

**Fonte padrão atual:** `"Cinzel Decorative", "Cinzel", serif`
**Pasta de assets:** `public/assets/ui/text/`
**Chave Phaser:** `text_<nome>` (ex: `text_victory`, `text_defeat`)

---

## ✅ Já Convertidos para Asset

| Texto | Chave Phaser | Arquivo | Cena |
|---|---|---|---|
| VICTORY | `text_victory` | `victory_asset.png` | CombatScene |

---

## 🔴 Alta Prioridade — Telas Principais

### Resultados de Combate
| Texto | Tamanho atual | Arquivo sugerido | Observação |
|---|---|---|---|
| `DEFEAT` | 56px | `defeat_asset.png` | Mesma posição que VICTORY (400, 300) |

### Títulos de Tela
| Texto | Tamanho atual | Arquivo sugerido | Cena |
|---|---|---|---|
| `PAUSED` | 48px | `title_paused.png` | PauseScene |
| `RUN OVER` | 46px | `title_run_over.png` | DeathScene |
| `Boss Defeated!` | 32px | `title_boss_defeated.png` | BossExitScene |

---

## 🟡 Média Prioridade — HUD e Notificações

### Notificações de Gameplay
| Texto | Tamanho atual | Arquivo sugerido | Componente |
|---|---|---|---|
| `COMBO!` | 36px | `notif_combo.png` | SynergyFlash |
| `LOOP X COMPLETE` | 32px | `notif_loop_complete.png` | LoopCelebration — gerado dinâmico, precisa de template |
| `🏆 New Unlock!` | 32px | `notif_unlock.png` | UnlockCelebration |

### Títulos de Seção (Shop/Forge/etc.)
| Texto | Tamanho atual | Arquivo sugerido | Cena |
|---|---|---|---|
| `THE MERCHANT` | 28px | `title_merchant.png` | ShopScene |
| `THE FORGE` | 26px | `title_forge.png` | ForgeScene |
| `Your Relics` | 30px | `title_relics.png` | RelicViewerScene |
| `Choose Your Hero` | 40px | `title_choose_hero.png` | CharacterSelectScene |
| `Settings` | 32px | `title_settings.png` | SettingsScene |
| `〰 THE VILLAGE 〰` | 36px | `title_village.png` | CityHubScene |
| `Tutorial` | 32px | `title_tutorial.png` | TutorialScene |

---

## 🟢 Baixa Prioridade — Labels e Textos Dinâmicos

### Labels de Seção (Shop)
| Texto | Tamanho | Arquivo sugerido |
|---|---|---|
| `✦ Relics for Sale ✦` | 15px | `label_relics_for_sale.png` |
| `REMOVE CARD` | var | `label_remove_card.png` |
| `ELEMENT RACK` | 12px | `label_element_rack.png` |

### Textos Dinâmicos (não substituir por asset — são variáveis)
Estes textos mudam a cada frame ou dependem de dados de runtime.
Devem permanecer como Phaser text com a fonte Cinzel:

- HP / STA / MP valores (CombatHUD)
- Gold amount (ShopScene, ForgeScene, LoopHUD)
- Cooldown countdown (CombatHUD)
- Nomes de cartas, relíquias, tiles
- Descrições de efeitos e keywords
- Tooltips
- Damage numbers flutuantes
- Todos os textos de tutorial e keyword intro

---

## Guia de Produção dos Assets

### Especificações Técnicas
- **Formato:** PNG com fundo transparente (alpha)
- **Resolução:** 2x ou 4x o tamanho de exibição (ex: VICTORY exibe em ~300px → PNG em 600px mínimo)
- **Estilo:** Consistente com `victory_asset.png` — dourado, ornamentado, sombra
- **Pasta:** `public/assets/ui/text/`

### Como Registrar no Preloader
Adicionar em `src/scenes/Preloader.ts` na seção "Text assets":
```typescript
this.load.image('text_defeat', 'assets/ui/text/defeat_asset.png');
this.load.image('text_paused', 'assets/ui/text/title_paused.png');
// etc.
```

### Como Usar em Código
Substituir o `add.text()` por `add.image()`:
```typescript
// Antes:
this.add.text(400, 300, 'DEFEAT', { fontSize: '56px', ... }).setOrigin(0.5);

// Depois:
this.add.image(400, 300, 'text_defeat').setScale(0.6).setDepth(600);
```

---

## Status de Implementação

| Asset | Status | Responsável |
|---|---|---|
| `victory_asset.png` | ✅ Implementado | Herick |
| `defeat_asset.png` | ⬜ Pendente | — |
| `title_paused.png` | ⬜ Pendente | — |
| `title_run_over.png` | ⬜ Pendente | — |
| `title_boss_defeated.png` | ⬜ Pendente | — |
| `notif_combo.png` | ⬜ Pendente | — |
| `notif_unlock.png` | ⬜ Pendente | — |
| `title_merchant.png` | ⬜ Pendente | — |
| `title_forge.png` | ⬜ Pendente | — |
| `title_relics.png` | ⬜ Pendente | — |
| `title_choose_hero.png` | ⬜ Pendente | — |
| `title_settings.png` | ⬜ Pendente | — |
| `title_village.png` | ⬜ Pendente | — |
