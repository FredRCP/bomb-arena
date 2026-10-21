# input/

Aqui ficará a leitura dos comandos (teclado agora; toque e outros controles no futuro).

A ideia é traduzir teclas em **intenções** (mover para a esquerda, soltar bomba) e entregá-las ao
`core`, que não sabe nada sobre teclado.

- `directionStack.ts`: lembra quais direções estão apertadas e em que ordem (vale a última apertada). Lógica
  pura, com testes.
- `controls.ts`: a tabela de teclas de cada jogador (P1 = WASD + Espaço + E, P2 = 8 4 2 6 + Enter + 9; `gamepad.ts`/`padReader.ts`/`padNav.ts` cuidam dos controles) e as teclas da
  partida (R reinicia/próxima rodada, M som, Esc pausa, Q menu). Sem Phaser, com teste que garante que nenhuma tecla se repete.
- `keyboardInput.ts`: liga as teclas reais (via Phaser) e entrega uma intenção por jogador: direção, mais
  `placeBomb`, que vale uma vez por aperto. Também lê `M`, `R`, `Esc` e `Q`, que são comandos da cena e não regras do jogo.
