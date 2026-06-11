Opção 1 — “Fake 3D” (recomendado)
Você cria a ilusão da página virando usando:

Container
RenderTexture
Mesh ou Quad
Tween
Máscaras (GeometryMask)
A ideia é:

O livro é uma imagem fixa.
A página atual é renderizada como textura.
Durante o clique em “próxima página”, você:
achata a página no eixo X (scaleX)
distorce a perspectiva
move uma sombra
troca o conteúdo no meio da animação
Exemplo visual do fluxo:

Página aberta
[====|====]

Virando
[===/     ]

Meio da dobra
[==|      ]

Final
[====|====]
Você consegue um resultado parecido com RPGs, grimórios e interfaces de card games.

Exemplo simples em Phaser (efeito “flip”)
const page = this.add.image(500, 300, 'page');

this.tweens.add({
    targets: page,
    scaleX: 0,
    duration: 250,
    ease: 'Cubic.easeIn',
    onComplete: () => {

        // troca o conteúdo da página
        page.setTexture('nextPage');

        this.tweens.add({
            targets: page,
            scaleX: 1,
            duration: 250,
            ease: 'Cubic.easeOut'
        });
    }
});
Isso já dá um “flip” básico, mas fica parecendo uma carta virando.

Opção 2 — Page Curl (mais bonito)
Para ficar parecido com um livro real, você faz um efeito de curvatura da página.

No Phaser isso pode ser feito com:

Mesh
Plane
shader GLSL
ou uma malha deformável
Você divide a página em vários vértices e deforma:

Antes:
|---------|

Virando:
\~~~~~~~|

Quase fechando:
 \_____|
O efeito fica bem próximo de jogos como:

menus de RPG
grimórios mágicos
compêndios tipo Slay the Spire
interfaces fantasy
Para a UI do seu compêndio, isso encaixa muito bem.

Opção 3 — Biblioteca pronta (mais fácil)
Tem libs JS especializadas nisso:

Turn.js → efeito de virar página realista
StPageFlip → muito boa e moderna
PixiJS page curl shaders (adaptável ao Phaser)
Você pode integrar com Phaser porque ele roda no canvas/WebGL.

O que eu faria no seu caso
Pela imagem, eu faria um sistema híbrido:

Livro base fixo (o fundo nunca mexe)
Apenas a folha interna vira
Sombra dinâmica durante a dobra
Um leve zoom/câmera shake suave
Som de papel
Troca dos cards no meio da animação
Sequência:

Clique →
Página dobra →
Sombra aumenta →
Meio da dobra →
Troca conteúdo →
Página abre →
Som final
Com 300–500ms já fica extremamente profissional.

Se quiser um visual tipo AAA indie, eu faria usando Mesh + RenderTexture no Phaser 3 (WebGL), sem precisar migrar para engine 3D.

Se quiser, posso te mostrar um protótipo real em Phaser 3 de virar página igual ao da sua imagem, com código pronto para integrar no jogo.