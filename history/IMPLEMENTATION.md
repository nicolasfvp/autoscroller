# Implementação — Sistema de Capítulos e Narrativa

## Visão Geral

O sistema narrativo é composto de três camadas independentes que se encaixam sobre o loop de jogo existente:

1. **ChapterSystem** — controla qual capítulo está ativo, força bioma e boss
2. **CutsceneScene** — cena de corte com Ken Burns + typewriter VT323
3. **BossDialogueSystem** — diálogo em 3 fases durante combate de boss

---

## 1. ChapterSystem

### Mudanças em RunState

```typescript
interface RunState {
  // ... campos existentes ...
  chapter: number;         // 0 = prólogo, 1–7 = capítulos
  chapterBossDefeated: boolean;
}
```

### Definição de Capítulos

```typescript
interface ChapterDef {
  id: number;
  name: string;
  biome: BiomeKey;
  bossId: EnemyKey;
  prologueCutscene: CutsceneScript;   // exibida AO ENTRAR no capítulo
  epilogueCutscene: CutsceneScript;   // exibida APÓS derrotar o boss
}

const CHAPTERS: ChapterDef[] = [
  { id: 1, biome: 'green_field',  bossId: 'iron_golem',      ... },
  { id: 2, biome: 'forest',       bossId: 'bog_witch',        ... },
  { id: 3, biome: 'swamp',        bossId: 'drowned_king',     ... },
  { id: 4, biome: 'desert',       bossId: 'desert_golem',     ... },
  { id: 5, biome: 'graveyard',    bossId: 'doom_knight',      ... },
  { id: 6, biome: 'lava',         bossId: 'infernal_dragon',  ... },
  { id: 7, biome: 'ruins',        bossId: 'phaethon',         ... },
];
```

### Fluxo por Capítulo

```
[Início do Capítulo N]
  → CutsceneScene (prólogo do cap N, específico do herói)
  → GameScene com bioma forçado do cap N
  → N loops normais
  → Loop de boss (cap N: boss forçado, tile de boss garantido no final)
  → BossDialogueSystem ativo durante combate
  → Boss derrotado
  → CutsceneScene (epílogo do cap N, específico do herói)
  → RunState.chapter++
  → CutsceneScene (prólogo do cap N+1)
  → repeat
```

---

## 2. CutsceneScene

### Interface de Slide

```typescript
interface CutsceneSlide {
  background: string;           // chave do asset de background
  characters?: {
    key: string;                // chave do sprite
    x: number;
    y: number;
    scale: number;
    flipX?: boolean;
    alpha?: number;
  }[];
  panFrom: { x: number; y: number; scale: number };  // posição inicial da câmera
  panTo:   { x: number; y: number; scale: number };  // posição final (Ken Burns)
  duration: number;             // duração em ms (sem contar o typewriter)
  text: string;                 // texto a ser exibido com typewriter VT323
  textPosition?: 'bottom' | 'top';  // default: bottom
}

type CutsceneScript = CutsceneSlide[];
```

### Comportamento

- O jogador pode pular cada slide com clique/toque
- O texto é exibido com efeito typewriter (VT323, velocidade configurável)
- Se o texto não terminou e o jogador clicar: completa o texto instantaneamente
- Se o texto terminou e o jogador clicar: vai para o próximo slide
- Último slide: vai para a próxima cena

### Posição do texto

```
┌─────────────────────────────────────┐
│                                     │
│          [background + Ken Burns]   │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  "Texto typewriter VT323 aqui..."   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└─────────────────────────────────────┘
```

Painel de texto: retângulo semi-transparente preto (alpha ~0.8), full-width, ~25% da altura da tela.

---

## 3. BossDialogueSystem

### Funcionamento

Três gatilhos de HP: **100%** (entrada), **50%** (meia batalha), **15%** (quase morto).

Ao atingir cada threshold:
1. Pausa o combate (ou reduz velocidade a 25%)
2. Exibe o layout de diálogo sobre a BattleScene
3. O jogador clica para avançar as falas
4. Ao fechar, retorna ao combate normal

### Layout do Diálogo

```
┌─────────────────────────────────────────────────────┐
│   [BOSS SPRITE]              [HERO SPRITE]          │
│   (esq, ~40% tela)           (dir, ~30% tela)       │
│                                                     │
│   ╔═══════════════════════════════════════════╗     │
│   ║  "Fala do boss ou do herói em VT323"      ║     │
│   ║  [Nome do falante acima]                  ║     │
│   ╚═══════════════════════════════════════════╝     │
│                               [clique para avançar] │
└─────────────────────────────────────────────────────┘
```

### Estrutura de Dados

```typescript
interface BossDialogueLine {
  speaker: 'boss' | 'hero';
  text: string;
}

interface BossDialogue {
  bossId: EnemyKey;
  heroClass: 'warrior' | 'mage';
  onEntry:    BossDialogueLine[];  // threshold 100%
  onMidBattle: BossDialogueLine[]; // threshold 50%
  onNearDeath: BossDialogueLine[]; // threshold 15%
}
```

Ver [warrior/BOSS_DIALOGUES.md](warrior/BOSS_DIALOGUES.md) e [mage/BOSS_DIALOGUES.md](mage/BOSS_DIALOGUES.md) para o conteúdo completo.

---

## 4. Integração com Código Existente

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/state/RunState.ts` | Adicionar `chapter`, `chapterBossDefeated` |
| `src/state/SceneKeys.ts` | Adicionar `CUTSCENE` |
| `src/scenes/Preloader.ts` | Carregar assets de cutscene e novos bosses/biomas |
| `src/scenes/GameScene.ts` | Forçar bioma por capítulo; detectar boss no final do loop de boss |
| `src/scenes/BattleScene.ts` | Integrar BossDialogueSystem nos thresholds de HP |

### Novos arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/scenes/CutsceneScene.ts` | Implementação da cena de corte |
| `src/systems/BossDialogueSystem.ts` | Sistema de diálogo |
| `src/data/chapters.ts` | Definições de capítulos (bioma, boss, cutscenes) |
| `src/data/boss_dialogues.ts` | Conteúdo de todos os diálogos de boss |

---

## 5. Ordem de Implementação Sugerida

**Fase A — Fundação:**
1. Adicionar `chapter` ao RunState
2. Implementar ChapterSystem (força bioma e boss)
3. Criar CutsceneScene básica (sem Ken Burns ainda)
4. Testar fluxo cap1 → cutscene → cap2

**Fase B — Polimento de Cutscene:**
5. Adicionar Ken Burns (Phaser tween de câmera sobre o background)
6. Adicionar efeito typewriter VT323
7. Adicionar sprites de personagens nas cutscenes

**Fase C — Diálogos de Boss:**
8. Implementar BossDialogueSystem
9. Adicionar diálogos de todos os bosses existentes (Dryas, Circe, Daedalus, Midas)
10. Adicionar diálogos dos novos bosses quando os sprites estiverem prontos

**Fase D — Conteúdo:**
11. Adicionar novos bosses (drowned_king, doom_knight, phaethon)
12. Adicionar novos monstros por bioma
13. Adicionar novos backgrounds de bioma
