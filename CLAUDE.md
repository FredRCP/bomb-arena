# Bomb Arena — instruções para a IA

Jogo 2D de arena com bombas (nome provisório), para navegador, foco em PC. TypeScript + Phaser 3 + Vite.
O dono do produto, Fred, está aprendendo programação com assistência de IA: prefira código simples,
etapas pequenas, comentários em português que expliquem o porquê, e explicações claras.

## Comandos

- `npm run dev` — jogo em desenvolvimento
- `npm test` — testes (Vitest)
- `npm run typecheck` — tipos do projeto e do core
- `npm run build` — tipos + versão final em `dist/`

Antes de dizer que algo funciona, rode de fato `npm run typecheck`, `npm test` e `npm run build` e informe o
resultado real. Não declare sucesso sem executar o comando.

## Regras obrigatórias

1. `src/core/` e `src/config/` não importam Phaser nem usam APIs do navegador (`window`, `document`,
   `localStorage`...), nem `Math.random`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`.
   Sorteio: `createRng(semente)`. Tempo: contagem de ticks inteiros em passo fixo.
2. O estado da partida tem uma única fonte de verdade (`GameState`, no core). A renderização só lê.
3. O teclado vira "intenções" em `src/input/`; o core recebe intenções e não conhece teclas.
4. Lógica crítica nasce com teste (colisões, eventos simultâneos, reinício, limites do mapa).
5. Sem dependências nem abstrações desnecessárias. Sem online, contas, banco de dados, anúncios ou compras
   nesta fase. Sem assets, personagens ou marcas de outros jogos.

## Forma de trabalhar

- Uma etapa por vez, sem adiantar a seguinte. Um commit por etapa funcionando.
- Ao entregar mudanças em projeto já existente, enviar só os arquivos criados ou alterados.
- Informar exatamente quais arquivos foram criados ou alterados e o que ficou de fora.

## Plano

1. Fundação e protótipo visual (arena fixa, escala da tela) — feita
2. Movimentação com colisão — feita
3. Bombas e explosões (bomba e pavio, propagação em cruz, blocos, cadeia, chamas, dano, sons) — feita
4. Rodada completa (morte, vitória, derrota, empate, reinício) — feita
5. Segundo jogador local (P1 WASD+Espaço, P2 setas+Enter, arena simétrica) — feita
6. IA dos inimigos (solo contra 1–3 inimigos, ?players=1&enemies=N&ai=easy|normal|hard|expert|ultra) — feita
7. Itens (+bomba, +alcance, +velocidade), menu inicial, melhor de 3 com placar, pausa, volume — feita (7.2: arena 15x13 = 13x11 jogáveis, cronômetro de 3:00 no core, HUD em barra superior + painéis laterais)
8. Personagens e tela de escolha (src/characters, SelectScene; imagens em public/characters) — feita; resto do visual (arte final, animação) pendente
8.1 Ajustes: IA mais lenta por dificuldade, arena aleatória, itens 12%, morte súbita — feita. Próximo (a combinar): novos itens (chute, bomba-relógio, explosão que atravessa, arremesso)
8.2 Até 5 jogadores (2 humanos + IA), controles (gamepad), novos teclados (P1 WASD/Espaço/E; P2 2468/Enter/9), itens chute, perfurante, bomba-relógio, arremesso e fantasma — feita
8.3 Contagem 3-2-1, jogador eliminado joga das laterais e volta ao eliminar alguém, bomba-relógio só na 1ª bomba, itens ruins (controles invertidos, pedra), IA mais esperta com as habilidades — feita
8.4 Itens espalhados ao morrer, explosão destrói itens, velocidade inicial -1 ponto (limites 8 bombas / 5 velocidade), laterais também para a IA, opções de partida (única/2/3), tempo e laterais no menu — feita
8.5 Cinco níveis de IA (50/60/80/100/120%), laterais mais lentas, equipes (cada um por si / pessoas × computador / misturados), colete e super-herói, pontuação e ranking Top 10, HUD mais limpo — feita
8.6 Organização das telas: Abertura → Menu (Jogar/Ranking/Opções) → Quem vai jogar → Regras → Personagens → Fase → partida; espaço para várias fases (src/config/stages.ts; só a Clássica jogável) — feita
8.7 Fundos coloridos, menu Jogar/Opções/Ranking, dificuldades Fácil→Impossível, Repescagem, tela de times estilo Bomberman (menu/teamsModel.ts), HUD em barra superior fina, tela 1600x900 — feita
9. Publicação e PWA (manifest, service worker rede-primeiro, ícones em public/; guia de publicação no README) — feita
