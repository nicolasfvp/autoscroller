# Enemy Attack Cards - Generation Status

## Geração Completa ✅

### Fase 1 - Ataques Prioritários (4/4 Completos)

| Attack | Card | Status | Location |
|--------|------|--------|----------|
| CLAW | enemy_claw.png | ✅ Generated | `public/assets/cards/enemy/` |
| SMASH | enemy_smash.png | ✅ Generated | `public/assets/cards/enemy/` |
| FIRE BREATH | enemy_fire_breath.png | ✅ Generated | `public/assets/cards/enemy/` |
| POISON | enemy_poison.png | ✅ Generated | `public/assets/cards/enemy/` |

---

## Observações sobre as Imagens

As 4 cartas foram geradas com sucesso, porém o modelo incluiu personagens/criaturas nas imagens:

- **CLAW**: 3 rasgos de fogo (sem personagem) ✅
- **SMASH**: Golem azul atacando (personagem presente) - Pode estar OK para o estilo
- **FIRE BREATH**: Dragão azul respirando fogo (personagem presente) - Visualmente impactante
- **POISON**: Kobra em nuvem de veneno (personagem presente) - Visualmente impactante

### Decisão:
As imagens estão visualmente muito legais e impactantes. Se preferir imagens puramente "genéricas" sem personagens, será necessário regenerar com prompts mais específicos ou manual editing para remover as criaturas.

---

## Integração no Código

✅ Arquivo `src/data/EnemyAttackCards.ts` atualizado:
- CardKey atualizado para: `enemy/enemy_claw`, `enemy/enemy_smash`, etc.
- Todos os 14 ataques definidos
- Mapeamento enemy → attacks completo

---

## Próximos Passos

### Opção 1: Continuar com as Imagens Atuais
- Regenerar apenas se rejeitar o visual
- Prosseguir para Fase 2 (BITE, SLASH, PIERCE, etc.)

### Opção 2: Refinar as Imagens Existentes
- Remover personagens manualmente via editor de imagens
- Manter apenas o efeito do ataque

### Opção 3: Regenerar com Prompts Mais Específicos
- Usar prompt: "ONLY the attack effect, NO creature, NO character visible"
- Regenerar todas as 4 cartas

---

## Fases Restantes

- **Fase 2** (6 ataques): BITE, SLASH, PIERCE, BONE_THROW, DRAIN, SPIT
- **Fase 3** (4 ataques): SLAM, THORN_SPIKE, CURSE, WATER_SURGE

Total: 14 ataques genéricos para servir 26 inimigos
