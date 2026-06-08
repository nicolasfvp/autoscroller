Análise das Animações do Herói em Combate
Baseado na exploração do sistema de cards, descobri que o jogo tem 3 categorias principais:

Categorias de Cards
attack — Dano direto (Jab, Quickstep, multi-hit)
defense — Armor (Guard)
magic — Efeitos elementais (Spark com burn, Mend com heal, auras, DoTs)
Tipos de Efeitos (que merecem animações distintas)
Efeito	Exemplo	Animação Proposta
Damage	Jab, Quickstep, multi-hit	attack
Armor	Guard, Defense Cards	defend
DoT (burn, bleed, poison)	Spark, Water cards	cast
Heal	Mend	heal
Aura	Riposte, buffs passivos	channel (ou cast)
Hit Taken (receber dano)	Quando inimigo ataca	hit
Conjunto Completo de Animações para o Herói

Animações principais (4 frames cada):
1. {sp}_idle      - Parado/esperando (loop)
2. {sp}_idle2     - Frame alternativo idle (para imagens únicas)
3. {sp}_attack    - Ataque físico direto (e multi-hit)
4. {sp}_defend    - Levantando defesa/escudo
5. {sp}_cast      - Lançando magia/aura (hand gesture)
6. {sp}_heal      - Recebendo/canalizando cura
7. {sp}_hit       - Recebendo dano (flinch/recoil)
8. {sp}_death     - Derrotado

Total: 8 animações × 4 frames = 32 frames para registrar
Lógica de Disparo na CombatScene
Precisamos modificar onCardPlayed para detectar o tipo de efeito principal:


// Pseudo-código
function getCardAnimationType(card: CardDefinition): string {
  const primary = card.effects[0];
  
  if (primary.type === 'damage') return 'attack';
  if (primary.type === 'armor') return 'defend';
  if (['heal', 'stamina', 'mana'].includes(primary.type)) return 'heal';
  if (['dot', 'stack', 'debuff'].includes(primary.type)) return 'cast';
  if (['aura', 'buff'].includes(primary.type)) return 'cast'; // canalizando
  
  return 'attack'; // fallback
}
Recomendação
Gerar 6 animações principais (attack, defend, cast, heal, hit, death) + 1-2 idles:

Prioridade alta: attack, defend, cast (usadas constantemente)
Prioridade média: heal, hit, death
Prioridade baixa: idle2 (opcional, só se idle for imagem única)
Quer que eu:

Implemente a lógica de detecção de tipo de card na CombatScene?
Comece a gerar os spritesheets (qual classe? Warrior ou Mage?)
Defina um prompt padronizado para gerar as 6 animações consistentemente?