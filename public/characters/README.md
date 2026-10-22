# Arte dos personagens

## Personagem de corpo inteiro (ex.: `fred/`)
Pasta `public/characters/<id>/` com PNG de fundo transparente (se o personagem tem `sprites: true` em `src/characters/characters.ts`):

- Poses (PNG transparente): `idle-down`, `idle-up`, `idle-right`, `win`, `lose`; corrida `run-down-1..8`, `run-up-1..8`, `run-right-1..8` (8 quadros por direção, em ciclo); colocar bomba `bomb-side-1..4` (de lado) e `bomb-front-1..4` (de frente). A esquerda é a direita espelhada pelo jogo.
- Extras: `face` (rosto normal), `face-happy`, `face-sad`, `art` (arte grande da tela de escolha)

Todas as poses no mesmo tamanho de personagem (mesma escala de cabeça) e pés na base. O jogo escala pela altura da pose parada.
Sem os arquivos, o jogo usa o desenho provisório.

## Personagem simples
`public/characters/<id>.png` (rosto ~512x512, fundo transparente), com `custom: true`.

Não coloque fotos reais no repositório público: só as caricaturas.
