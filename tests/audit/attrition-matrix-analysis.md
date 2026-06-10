# Attrition matrix — build-quality x depth gradient

Source: tests/audit/attrition-matrix-results.json (510 cells)

## WARRIOR — planning=light  (cell = boss winRate / run deathRate)

stage  | random     | naive      | optimized  | mixed      
-------|------------|------------|------------|------------
boss1 | 100%/  0%  |  92%/ 12%  |  98%/  2%  |  99%/  4%  
boss2 |  65%/ 37%  |  48%/ 52%  |  58%/ 45%  |  83%/ 18%  
boss3 |  90%/ 10%  |  63%/ 48%  |  93%/  8%  |  85%/ 18%  
boss4 |  13%/ 87%  |    (none)  |    (none)  |  61%/ 44%  
boss5 |  73%/ 33%  |  15%/ 92%  |  42%/ 63%  |  61%/ 44%  
boss6 |  53%/ 47%  |    (none)  |    (none)  |  11%/ 94%  
boss7 |  98%/  7%  |  77%/ 32%  |  86%/ 23%  | 100%/  0%  

## MAGE — planning=light  (cell = boss winRate / run deathRate)

stage  | random     | naive      | optimized  | mixed      
-------|------------|------------|------------|------------
boss1 |  86%/ 14%  | 100%/  0%  |  94%/  7%  |  71%/ 32%  
boss2 |  40%/ 60%  | 100%/  0%  |  85%/ 15%  |  71%/ 32%  
boss3 |  80%/ 20%  | 100%/  0%  |  82%/ 18%  |  76%/ 29%  
boss4 | 100%/  0%  |    (none)  |    (none)  |  74%/ 31%  
boss5 |  32%/ 68%  |  89%/ 19%  |  65%/ 35%  |  94%/ 11%  
boss6 |  38%/ 62%  |    (none)  |    (none)  |  51%/ 51%  
boss7 | 100%/  2%  | 100%/  1%  |  85%/ 28%  |  94%/ 15%  

## WARRIOR — planning=moderate  (cell = boss winRate / run deathRate)

stage  | random     | naive      | optimized  | mixed      
-------|------------|------------|------------|------------
boss1 |  96%/  8%  |  77%/ 37%  |  88%/ 13%  |  88%/ 24%  
boss2 |  63%/ 38%  |  37%/ 67%  |  49%/ 53%  |  74%/ 26%  
boss3 |  87%/ 18%  |  36%/ 70%  |  75%/ 33%  |  52%/ 57%  
boss4 |   6%/ 98%  |    (none)  |    (none)  |  43%/ 65%  
boss5 |  55%/ 47%  |   4%/ 97%  |  28%/ 78%  |  42%/ 61%  
boss6 |  38%/ 62%  |    (none)  |    (none)  |   0%/100%  
boss7 |  90%/ 17%  |  49%/ 63%  |  66%/ 47%  | 100%/  4%  

## MAGE — planning=moderate  (cell = boss winRate / run deathRate)

stage  | random     | naive      | optimized  | mixed      
-------|------------|------------|------------|------------
boss1 |  83%/ 17%  |  99%/  1%  |  88%/ 15%  |  54%/ 54%  
boss2 |  40%/ 60%  | 100%/  0%  |  85%/ 19%  |  64%/ 42%  
boss3 |  80%/ 20%  |  99%/  1%  |  76%/ 26%  |  57%/ 44%  
boss4 | 100%/  2%  |    (none)  |    (none)  |  68%/ 33%  
boss5 |  28%/ 77%  |  81%/ 22%  |  57%/ 46%  |  78%/ 29%  
boss6 |  40%/ 62%  |    (none)  |    (none)  |  49%/ 65%  
boss7 |  92%/ 15%  |  93%/ 13%  |  69%/ 43%  |  74%/ 30%  

## Top death-cause enemies (across all matrix runs)

- infernal_dragon: 412
- iron_golem: 320
- boss_iron_golem: 243
- doom_knight: 229
- bog_witch: 228
- desert_golem: 211
- lost_lizard: 90
- mutated_salamander: 62
- corpse_eater: 35
- lava_golem: 28
- fire_elemental: 25
- pocket_cat: 23
- baby_dragon: 22
- ancient_tree: 16
- mush: 14
- werewolf: 14
- vampire: 13
- skeleton: 12
- venomous_kobra: 11
- depths_horror: 9

## Concern flags (vs Moderate target: easy early; random walls mid; optimized comfortable; depth=mastery)

- TOO EASY DEEP: random mage boss4 (light) win 100% — random should fail deep
- TOO EASY DEEP: random warrior boss5 (light) win  73% — random should fail deep
- WEAK: optimized warrior boss5 (light) boss win  42% — optimized should be comfortable
- TOO EASY DEEP: random warrior boss7 (light) win  98% — random should fail deep
- TOO EASY DEEP: random mage boss7 (light) win 100% — random should fail deep
