# Overlays a converter em cenas de fato

Estas cenas **não têm background próprio hoje** — são overlays desenhados por
cima da cena de baixo (backdrop semitransparente, painel de madeira, ou chrome
gerado por um layout helper). Receberam pasta em `scenes/` mesmo assim, mas
ficam **vazias ou só com botões/painéis** até ganharem arte de fundo dedicada.

Quando formos tratá-las para virarem "cenas de fato", cada uma deve receber um
background próprio em sua pasta e o Preloader passa a carregá-lo daqui.

| Pasta | Cena | Como renderiza hoje | Conteúdo já na pasta |
|---|---|---|---|
| `pause/` | PauseScene | backdrop preto translúcido (rectangle) | 4 botões (resume, view_deck, tutorial, abandon) |
| `tutorial/` | TutorialScene | painel sobre a cena, sem bg | textos tutorial_* + tutorial_text_panel + btn_start_game |
| `collection/` | CollectionScene | BookLayout fornece o próprio chrome | — (vazia) |
| `run_transition/` | RunTransitionScene | fade escuro + vinheta + partículas | — (vazia) |
| `tavern_panel/` | TavernPanelScene | painel wood-texture-big | wood-texture-big |
| `building_panel/` | BuildingPanelScene | painel wood-texture-big | wood-texture-big, icon-table, building_*_l* |
| `boss_exit/` | BossExitScene | rectangle overlay 600×400 | — (vazia; usa só bitmap font) |
| `speed_panel/` | SpeedPanelScene | painel flutuante (speed_panel em ui/panels) | — (vazia) |
| `global_sound/` | GlobalSound | cena sem visual (só áudio) | — (vazia; provavelmente nunca terá bg) |

## Notas

- `card_library/` e `collection/` usam **BookLayout** (componente de UI que
  desenha o "livro"). Se virarem cenas com bg próprio, decidir se o BookLayout
  fica por cima de um background ou é substituído.
- `global_sound/` é puramente lógica de áudio — provavelmente **não** vira cena
  visual; manter aqui só por consistência de inventário.
- `speed_panel/` e o painel genérico `speed_panel.png` continuam em
  `ui/panels/` (é um HUD flutuante reutilizável, não um fundo de cena).
- Assets fantasma conhecidos (carregados no Preloader mas **sem arquivo no
  disco**, 404 silencioso com fallback via `textures.exists()`):
  `forge_background` (forge usa `forge_frame_01` de fato). Não criar pasta/arte
  até que o asset exista.
