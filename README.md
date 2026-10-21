# Bomb Arena (nome provisório)

Jogo 2D original de arena com bombas, para navegador (PC), com modo solo contra o computador e
multiplayer local para dois jogadores. Feito com TypeScript, Phaser 3 e Vite.

**Estado atual: Etapa 8.1 — ajustes de jogabilidade (IA mais lenta, arena aleatória, menos itens, morte súbita)** sobre a Etapa 8 (personagens e tela de escolha) (sobre a arena 13 x 11, o cronômetro e os painéis laterais da 7.2). Depois de JOGAR no menu, cada pessoa escolhe um personagem (4 genéricos + 7 da família); os inimigos do computador sorteiam os que sobrarem. As imagens das caricaturas vão em `public/characters/` (veja o `README.md` de lá); sem elas aparece um desenho provisório com a inicial. Abra o jogo e escolha no **menu**: 1 jogador (contra 1 a
3 inimigos do computador, em três dificuldades) ou 2 jogadores no mesmo teclado. A partida é **melhor de 3
rodadas**, com placar e **cronômetro de 3:00** na barra de cima e o quadro de bombas/alcance/velocidade de cada jogador nos painéis dos lados. Ao destruir blocos aparecem **itens** (+bomba, +alcance, +velocidade)
que deixam quem os pega mais forte. Dá para pausar com `Esc`, e o volume se ajusta no menu.

## Requisitos

- Node.js 22.12 ou mais novo (testado com 22.22) e npm.

## Como instalar e rodar

```bash
npm install      # baixa as dependências (só na primeira vez)
npm run dev      # inicia o jogo em modo de desenvolvimento
```

Abra o endereço que o terminal mostrar (normalmente http://localhost:5173).

Para repetir uma arena específica, coloque a semente no endereço: `http://localhost:5173/?seed=7`.
A mesma semente sempre gera a mesma arena.

## Controles

| Ação | Jogador 1 (teclado) | Jogador 2 (teclado) | Controle (xbox, playstation, genérico) |
| --- | --- | --- | --- |
| Mover | `W` `A` `S` `D` | `8` `4` `2` `6` (também o teclado numérico e as setas) | direcional ou analógico esquerdo |
| Colocar bomba | `Espaço` | `Enter` | `A`/`✕` ou `X`/`□` |
| Especial (detonar bomba-relógio / arremessar) | `E` | `9` (ou `9` do numérico) | `B`/`○` ou `Y`/`△` |
| Pausar / próxima rodada | `Esc` / `R` | | `Start` |
| Voltar ao menu (pausado ou fim de rodada) | `Q` | | `Select` |

O controle 1 manda no jogador 1, o controle 2 no jogador 2 (no modo solo, o controle 1 joga). Os controles são
lidos no modo "padrão" do navegador (xbox, playstation e a maioria dos genéricos); aperte um botão para o
navegador reconhecê-lo. No menu, o direcional navega, `A` confirma e `B` volta.

**Jogadores do computador:** com 2 pessoas, a linha "Jogadores do computador" permite acrescentar 0 a 3 de IA;
o total por arena é no máximo 5 (o quinto nasce no centro). Atalho: `?players=2&enemies=3`.

**Contagem regressiva (Etapa 8.3):** toda rodada começa com 3, 2, 1 e "VAI!"; durante a contagem ninguém (nem o computador) se mexe. Para testar sem esperar: `?countdown=0`.

**Jogador eliminado nas laterais (Etapa 8.3):** quem é eliminado (se a rodada ainda está em disputa e ele é uma pessoa) continua jogando como um fantasma sobre a borda da arena: anda pelo contorno com os mesmos controles e a tecla de bomba joga uma bomba para dentro da arena (só uma por vez, cai uns 3 blocos para dentro, por cima de tudo). **Se a bomba dele eliminar alguém, ele volta à arena**, na casa onde nasceu (ou na livre mais próxima), com 2 segundos de proteção contra fogo (ele pisca). Não vale quando a rodada já foi decidida, no modo solo, nem para os jogadores do computador.

**Etapa 9 — publicação e PWA (aplicativo instalável, funciona offline):**
- O jogo agora é um **PWA**: depois da primeira visita ele abre mesmo sem internet e pode ser **instalado** (Chrome/Edge: ícone de instalar na barra de endereço ou menu ⋮ → "Instalar Bomb Arena"; abre em janela própria, sem barra do navegador). Arquivos: `public/manifest.webmanifest`, `public/sw.js` (service worker), `public/icons/` (ícones 192, 512, "maskable", Apple e favicon) e as linhas novas no `index.html`. O service worker só é registrado na versão publicada, nunca no `npm run dev`.
- *Como o cache funciona:* "rede primeiro". Com internet, sempre baixa a versão mais nova do jogo; sem internet, usa a cópia guardada. Por isso uma atualização publicada nunca fica presa numa versão velha. Se um dia quiser forçar a limpeza, mude `CACHE` em `public/sw.js`.
- *Como publicar* (o jogo é só arquivos estáticos; nenhum servidor é necessário):
  1. `npm run build` gera a pasta `dist/`.
  2. Envie o **conteúdo** de `dist/` para qualquer hospedagem estática: **itch.io** (zip da `dist` como "HTML5", marcando "Click to launch in fullscreen"), **Netlify** (arraste a pasta `dist` em app.netlify.com/drop), **Vercel**, **Firebase Hosting**, **GitHub Pages** ou **Cloudflare Pages**. Os caminhos são relativos (`base: './'`), então funciona também em subpasta.
  3. O PWA exige **https** (todas as hospedagens acima já dão). Em `localhost` também funciona.
  4. Para testar antes de publicar: `npm run build` e depois `npm run preview`.
- *Fotos da família:* coloque os PNGs em `public/characters/` (veja o `README.md` de lá) **antes** do build, senão o jogo publicado mostra os desenhos provisórios.
- Teste feito: com o servidor de preview, o service worker foi registrado, o manifesto e os três ícones responderam 200, e depois de recarregar **sem rede** a abertura apareceu normalmente.
- Não está nesta etapa: nome definitivo do jogo (o ícone e o manifesto usam "Bomb Arena"), ícone com arte final, tela de "nova versão disponível", e publicar de fato (isso depende de uma conta sua na hospedagem).

**Etapa 8.7 — o que mudou:**
- *Fundos coloridos:* abertura, menus, escolha de personagem, times, ranking e a própria partida ganharam um degradê roxo → azul-turquesa (com bolhas suaves nos menus) no lugar do preto. Código em `src/render/menuBackground.ts`; para trocar as cores, mude `CHEERFUL`.
- *Menu principal:* **Jogar, Opções, Ranking**.
- *Dificuldade com nomes previsíveis* (do mais fácil ao mais difícil): **Fácil, Normal, Difícil, Hardcore, Impossível**, cada um com uma frase de humor embaixo ("Boa sorte. Você vai precisar."). As velocidades continuam as da 8.5 (50%, 60%, 80%, 100%, 120%) e o endereço continua `?ai=easy|normal|hard|expert|ultra` (nesta ordem). As frases ficam em `DIFFICULTY_TAGLINES`, em `src/menu/menuModel.ts`.
- *Repescagem* é o novo nome de "voltar das laterais" (linha **Repescagem: Ligada/Desligada** nas Regras; `?sideline=0` desliga). No painel do jogador eliminado aparece "repescagem".
- *Tela de times estilo Bomberman* (**Formar os times**, passo 4, só com 3 ou mais jogadores, depois dos personagens): todos começam no meio ("Sem time"); **↑ ↓** escolhem o jogador e **← →** o mandam para o **Time Azul** (esquerda) ou o **Time Vermelho** (direita). Vale para pessoas e computador, em qualquer combinação. Quem fica no meio joga por conta própria. Não deixa continuar se todos estiverem no mesmo time. A linha **Equipes** do menu foi removida; `?teams=free|versus|mixed` continua valendo para testes. Código: `src/menu/teamsModel.ts` (testado) e `src/scenes/TeamsScene.ts`.
- *Partida com a barra superior:* sem os painéis laterais. Cada jogador tem uma ficha na barra (retrato, nome, **pontos e vitórias** do time dele) e o relógio fica no meio. Bombas, alcance e velocidade **não aparecem mais** (o efeito se vê no jogo); só as habilidades que o jogador tem (colete, chute, perfurante, relógio, arremesso, super-herói, fantasma, inversão) aparecem como ícones pequenos na ficha. As teclas (Esc, R, Q, M) ficam no canto esquerdo da tela. Quem joga sem time não ganha o anel de cor.
- *Tela de times:* cada jogador tem sua linha fixa em qualquer coluna (o 1º fica na 1ª linha, o 2º na 2ª...), então a ordem se mantém ao mover entre os times.
- *Tamanho da arena:* a tela agora é 1600 x 900 (a proporção dos monitores) e a barra superior ficou mais fina (96 → 68), então a arena ocupa ~92% da altura da janela (antes ~90%). Veja a nota "Arena maior" mais abaixo.

**Etapa 8.6 — organização das telas:**
- Fluxo: **Abertura** (qualquer tecla) → **Menu** (Jogar / Opções / Ranking) → **Quem vai jogar** (passo 1: jogadores, computador, dificuldade) → **Regras da partida** (passo 2: vitórias, tempo, repescagem) → **Personagens** (passo 3) → **Formar os times** (passo 4, só com 3 ou mais jogadores; veja a 8.7) → **Escolha a fase** (último passo) → partida. **Esc** (ou B no controle) volta um passo; durante a partida, **Q** volta ao menu. Os ajustes ficam salvos.
- *Fases:* a lista fica em `src/config/stages.ts`. Hoje só a **Clássica** é jogável; **Gelo**, **Egito** e **Trenzinho** aparecem como "(em breve)" e bloqueiam o JOGAR. Escolher a fase ainda não muda o jogo; as próximas fases entram aqui. Pelo endereço, `?stage=` ainda não existe.
- *Opções:* por enquanto, só o volume.
- Arquivos novos: `TitleScene.ts`, `SetupScene.ts`, `stages.ts`; o modelo puro do menu está em `src/menu/menuModel.ts` (testado).

**Etapa 8.5 — o que mudou:**
- *Cinco níveis de dificuldade* (nomes de astros): **Cometa** (50% da velocidade base), **Meteoro** (60%, o padrão), **Supernova** (80%), **Quasar** (100%) e **Buraco Negro** (120%). A velocidade vale só para a base: os itens de velocidade somam por cima, mas ninguém passa de 5,9 células/s (teto do jogo; a IA precisa disso para parar no centro das casas). Pelo endereço: `?ai=easy|normal|hard|expert|ultra`. Quanto mais alto o nível, mais rápido ela pensa e menos erra; Cometa e Meteoro são lentos e distraídos.
- *Laterais mais lentas:* o fantasma das laterais anda 6 casas por segundo (antes 12), para a IA não parecer "voando" pela borda. `SIDELINE_MOVE_TICKS` em `src/config/bombs.ts`.
- *Equipes* (linha **Equipes** do menu, só com 3 ou mais jogadores): **Cada um por si** (padrão; a IA também luta contra a IA), **Pessoas × Computador** (todas as pessoas no Time Azul, todo o computador no Time Vermelho) e **Times misturados** (jogadores 1, 3 e 5 no Azul; 2 e 4 no Vermelho: pessoas e IA juntas). Em equipes o placar usa "Time Azul x Time Vermelho", os nomes ficam na cor do time e um anel fino da cor do time aparece sob cada personagem. A rodada só acaba quando sobra um time. Matar um aliado não faz voltar das laterais. Pelo endereço: `?teams=free|versus|mixed`.
- *Novos itens:* **Colete** (aguenta UMA explosão e se desfaz; anel branco em volta do personagem) e **Super-herói** (estrela dourada: imune às chamas por 10 s, brilho dourado que pisca nos últimos 2 s). Para ver: `?power=vest,hero`.
- *Pontuação e ranking:* eliminar inimigo **+100**, aliado **−100**, eliminar-se **−50**, vencer a rodada **+300** (para todo o time), vencer a partida **+500**. Os pontos aparecem em cada jogador e, ao fim de cada rodada, uma classificação (desempate: mais eliminações, depois menos mortes). Ao fim da partida, a pontuação de cada pessoa entra no **Top 10** guardado no navegador (menu: **Ranking (Top 10)** + Enter). Valores em `src/config/score.ts`.
- *Tela mais limpa:* a barra de cima só tem o relógio e o placar; cada jogador tem um bloco enxuto nos painéis (retrato, nome, pontos, bombas/alcance/velocidade) e só mostra habilidades e efeitos quando os tem.
- *Correção:* a IA não chuta mais a própria bomba contra alguém parado na frente (a bomba não saía do lugar e ela morria).

**Etapa 8.4 — o que mudou:**
- *Velocidade:* todos começam 1 ponto mais lentos (4,15 células/s; cada ponto de velocidade soma 0,35). Limites: **8 bombas**, **5 de velocidade** (alcance continua 8). Pessoas e computador (em qualquer dificuldade) começam **sem item algum**.
- *Quem morre espalha os itens* que tinha (bombas e alcance extras, velocidade, chute, perfurante, relógio, arremesso) em casas livres sorteadas, e fica "do zero" (se voltar das laterais, volta sem nada). Fantasma, inversão e pedra apenas somem.
- *A explosão destrói os itens do chão* que estiverem na cruz dela (o item que o bloco revela na própria explosão sobrevive).
- *Laterais para todos:* o computador eliminado também joga das laterais e tenta voltar. A bomba das laterais cai 2 casas para dentro (antes eram 3).
- *Menu:* **Partida** (Partida única, Melhor de 2, Melhor de 3 = quantas rodadas é preciso vencer), **Tempo da rodada** (1:00 a 5:00) e **Voltar das laterais** (Ligado/Desligado). Pelo endereço: `?wins=1|2|3`, `?time=segundos`, `?sideline=0`.

**Itens ruins (Etapa 8.3):** moldura vermelha no chão. *Controles invertidos* (setas trocadas por 8 s; barra roxa no painel) e *pedra* (−1 de velocidade, no mínimo −2; um item de velocidade desfaz). O computador evita pegá-los. Para ver: `?power=invert,slow`.

**Bomba-relógio:** só a primeira bomba é relógio; enquanto ela estiver na arena, as outras são normais.

**Itens de habilidade (Etapa 8.2):** chute (empurra bombas ao andar contra elas), explosão perfurante (atravessa
blocos), bomba-relógio (a bomba só explode quando você aperta o especial; por segurança explode sozinha em 10 s),
arremesso (em cima da própria bomba, o especial a joga 3 casas para a frente) e fantasma (8 s atravessando blocos
destrutíveis). Para testar: `?power=kick,pierce,remote,throw,ghost`.

Teclas da partida (valem para todos):

| Tecla | O que faz |
| --- | --- |
| `Esc` | Pausa e continua |
| `R` | Durante a rodada: recomeça **a mesma rodada** (mesma arena, placar intacto). Com a rodada acabada: vai para a **próxima rodada** (arena nova) — ou, se a partida acabou, começa uma partida nova |
| `Q` | Volta ao menu (só com o jogo pausado ou a rodada acabada, para não perder a partida sem querer) |
| `M` | Liga/desliga o som |

Um aperto de bomba coloca uma bomba; segurar a tecla não repete.

**No menu:** `↑` `↓` (ou `W` `S`) escolhem a linha, `←` `→` (ou `A` `D`) mudam o valor, `Enter` ou `Espaço` começa.
Suas escolhas (modo, inimigos, dificuldade, volume) ficam guardadas no navegador.

**Teclado e "fantasmas":** alguns teclados não conseguem reconhecer muitas teclas apertadas ao mesmo tempo (é
uma limitação física de várias placas). Se, com os dois jogadores apertando várias teclas, um comando "sumir",
é isso. Se acontecer com frequência, me avise: dá para mudar as teclas (o arquivo é `src/input/controls.ts`).

**Atalhos pelo endereço (para testar):** se o endereço trouxer qualquer parâmetro abaixo, o menu é pulado e a
partida começa direto. Por exemplo, `http://localhost:5173/?players=1` joga contra o computador (você é o
jogador 1, com WASD + Espaço; as setas não fazem nada nesse modo). Ajustes:

- `enemies=0..3` — quantos inimigos (padrão 1). Com `enemies=0` você fica sozinho (só dá para perder).
- `ai=easy|normal|hard` — dificuldade (padrão `normal`). Exemplo: `?players=1&enemies=3&ai=hard`.
- `items=0` — desliga os itens (a arena fica como nas etapas anteriores).

Os inimigos são todos do mesmo time: não se machucam de propósito, mas o fogo de um inimigo pode atingir outro.
Você ganha ao eliminar todos; perde se morrer (mesmo que um inimigo ainda esteja vivo).

## Se as teclas não responderem

1. **Clique uma vez na página** (na arena) e tente de novo. O navegador só entrega as teclas à página que está com o foco.
2. Abra o Console do navegador (tecla `F12`, aba *Console*) e recarregue a página. Deve aparecer (depois de começar uma partida) a mensagem
   `[Bomb Arena] Etapa 7 ativa: ...`.
   - **Se a mensagem não aparecer**, o navegador está rodando uma versão antiga: os arquivos da Etapa 7 não
     estão no lugar certo. Confira se existe `src/input/keyboardInput.ts` **dentro** da pasta do projeto
     (a mesma pasta onde está o `package.json`) e rode `npm test`: todos os testes devem passar.
   - **Se aparecer um aviso amarelo de teclado indisponível**, ou algum erro em vermelho, me envie o texto.
3. Use o endereço do `npm run dev` (por exemplo http://localhost:5173) em uma aba normal do navegador, não em
   um painel de pré-visualização embutido de editor.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o jogo com recarga automática ao salvar arquivos |
| `npm test` | Roda os testes automatizados (Vitest) |
| `npm run typecheck` | Confere os tipos do projeto e do core (sem Phaser nem navegador) |
| `npm run build` | Confere os tipos e gera a versão final na pasta `dist/` |
| `npm run preview` | Abre a versão gerada por `build` para conferir antes de publicar |

Antes de dar um passo adiante, rode `npm run typecheck`, `npm test` e `npm run build`: os três devem passar.

## O que observar no navegador

**Ajustes da Etapa 8.1:**

- **Velocidade da IA por dificuldade:** veja a Etapa 8.5 (cinco níveis, de 50% a 120% da velocidade base; itens de velocidade somam por cima, com teto).
- **Arena aleatória:** a cada rodada os blocos são sorteados de novo e **não são mais simétricos** (os quatro cantos de nascimento continuam livres). Para voltar à arena simétrica, `ARENA_SYMMETRIC = true` em `src/config/arena.ts`.
- **Menos itens:** 12% dos blocos escondem item (antes 30%) — `ITEM_DROP_CHANCE` em `src/config/items.ts`.
- **Morte súbita:** quando o relógio chega a 0:00, aparece "MORTE SÚBITA" e a arena fecha em espiral, de fora para dentro, uma célula a cada 0,5 s (`src/core/shrink.ts`). Quem estiver na célula é esmagado. A rodada termina pelas regras normais (quem sobrar vence). Teste rápido: `http://localhost:5173/?players=1&enemies=1&time=10` (rodada de 10 s).

**Menu, partida e placar (novo na Etapa 7):**

- Ao abrir, aparece o **menu** com a lista: Jogadores, (Inimigos, Dificuldade — só no modo de 1 jogador), Volume
  e JOGAR. O volume vai de mudo a 100% e você ouve um clique ao mudar.
- **Barra de cima:** os jogadores (vivo/eliminado), o **relógio regressivo** (3:00; fica vermelho nos últimos 30 s)
  e o placar ("Você 1 x 0 Computador") com o número da rodada. **Tempo esgotado sem vencedor = empate.**
- **Painéis dos lados** (a tela é larga): cada pessoa tem o seu, com **Bombas, Alcance e Velocidade** — número
  grande e quadradinhos até o limite (5, 8 e 3). Jogando sozinho, o painel direito lista os inimigos do computador.
- **Velocidade fixa:** todos andam a 4,5 células/s; só os itens de velocidade aumentam (+0,45 cada, no máximo 3).
  Se o jogo parecer lento ou irregular, abra com `?debug=1` (ex.: `http://localhost:5173/?debug=1`): aparece, no
  canto superior esquerdo, `passos/s` — o certo é **60** — e os quadros por segundo.
- **Melhor de 3:** vence quem ganhar 2 rodadas. Empate não dá ponto mas gasta uma rodada; no máximo 5 rodadas
  (depois disso vence quem tiver mais pontos, ou a partida empata). Cada rodada tem uma arena nova.
- Ao fim da rodada aparece o resultado com o placar e a dica de teclas. Ao fim da partida, "Você venceu a
  partida!" / "O computador venceu a partida" / "Jogador N venceu a partida!" / "Partida empatada".
- Contra o computador, se você morrer, o ponto vai para o computador (mesmo que ele ainda tenha inimigos vivos).

**Itens (novo na Etapa 7):**

- Cerca de 30% dos blocos escondem um item. Ao destruir o bloco o item aparece no chão (uma plaquinha clara que
  flutua) e vale para quem pisar nele: **bomba preta com "+"** = +1 bomba ao mesmo tempo (limite 8); **chama
  laranja** = +1 de alcance nas próximas bombas (limite 8); **raio azul** = mais rápido (até 5 itens, de 4,15 a
  5,9 células/s).
- Itens do chão são destruídos por uma explosão que passe por eles (o item que o próprio bloco revela, não). No limite, o item é gasto sem efeito.
- A arena simétrica também espelha os itens: blocos espelhados escondem o mesmo item, então nenhum lado leva
  vantagem. Os inimigos do computador também pegam itens (desviam alguns passos para isso, sem blocos nem fogo
  no caminho).

**Dois jogadores:**

- A tela abre com o boneco **rosa** (jogador 1) no canto superior esquerdo e o **azul** (jogador 2) no canto
  inferior direito. `WASD`/`Espaço` controlam só o rosa; setas/`Enter` controlam só o azul. Os dois andam ao
  mesmo tempo.
- **A arena é simétrica**: girando-a meia volta, ela fica igual. Assim os dois cantos têm os mesmos blocos ao
  redor e nenhum lado nasce com vantagem. (Muda de uma semente para outra, mas sempre espelhada.)
- Os bonecos **não se bloqueiam**: um atravessa o outro. As bombas, sim, bloqueiam os dois (exceto quem ainda
  está em cima dela ao ser colocada, que pode sair).
- **Resultado:** quando sobra só um vivo, depois de 1,5 s aparece **"Jogador N venceu!"**. Se ninguém sobra (os
  dois morrem juntos, ou o último sobrevivente morre nesse 1,5 s), aparece **"Empate!"**.
- `R` durante a rodada recomeça com a mesma arena, os dois nos cantos.

**Bombas e explosões:**

- **Espaço / Enter** colocam uma bomba preta com pavio aceso na célula em que o jogador está. Ela pulsa, mais
  rápido no último segundo, e explode depois de **3 segundos**.
- Quem coloca **consegue sair de cima da bomba**. Depois de sair, ela vira obstáculo: não dá para voltar para dentro.
- Por padrão, **1 bomba por vez para cada jogador**.
- A explosão começa como uma **cruz de alcance 1** (só a célula da bomba e as vizinhas); itens de alcance aumentam. **Paredes** (bordas e pilares) param o fogo. **Blocos laranja** entram
  em fogo, **somem** e param o fogo (só o primeiro de cada fila).
- O fogo fica aceso por cerca de **meio segundo**. Quem estiver nele, ou **entrar nele** nesse tempo, é atingido.
- **Reação em cadeia:** uma bomba atingida pelo fogo explode na hora, junto com a que a atingiu.
- Quem é atingido **desaparece**. O jogo continua por 1,5 s e depois **congela** na tela de resultado.
- Sons provisórios: pop ao colocar, estrondo ao explodir, tom descendente ao ser atingido, melodia curta no
  resultado. `M` silencia. (Sons e imagens serão personalizados depois.)
- O boneco encostado numa parede só se mexe cerca de 3 px dentro da célula.

Ajudas de teste pelo endereço (combináveis, por exemplo `http://localhost:5173/?seed=7&bombs=3&range=3`):
`seed` muda a arena da primeira rodada (a rodada N usa semente + N − 1); `players=1` joga contra o computador (veja acima); `bombs` é o máximo de bombas de cada jogador (1 a 9) e `range` é o alcance (1 a 12) — ambos
sobrescrevem os valores iniciais de todos, e os itens continuam somando por cima. Com `bombs=3` dá para ver a reação em cadeia.

## Como o movimento funciona

- A simulação roda em **passos fixos de 60 por segundo**, independente da taxa de quadros da tela
  (`src/core/clock.ts`). Cada quadro pergunta ao relógio "quantos passos rodar agora?" e entrega esse
  número ao core.
- Velocidade: 4,15 células por segundo (cada item de velocidade soma 0,35, até 5 itens). O corpo é um quadrado de 0,9 de lado (cabe em corredor de uma célula).
- O jogador anda de forma suave, mas colide por **células inteiras**: parede e bloco bloqueiam, e fora da arena
  conta como parede.
- A ajuda de canto (`src/core/movement.ts`) só atua quando o jogador bate na quina e a faixa em que ele está
  majoritariamente tem passagem livre à frente.
- Todos esses números ficam em `src/config/simulation.ts`.

## Como bombas e explosões funcionam

Tudo isto está em `src/core/bombs.ts` e `src/core/explosions.ts`, sem Phaser, em passos de simulação.

- **Tempo:** pavio de 180 passos (3 s) e chamas de 30 passos (0,5 s), em `src/config/bombs.ts`. A bomba conta o
  passo em que foi colocada, então explode no passo número 180.
- **Sair da própria bomba:** ao ser colocada, a bomba guarda quem está com o corpo sobre a célula
  (`walkThrough`). Esses jogadores atravessam a bomba; quando o corpo deixa a célula por completo, saem da lista
  e a bomba passa a bloqueá-los. Vale também para um segundo jogador que esteja em cima na hora.
- **Forma:** do centro da bomba, 4 direções até o alcance. Parede: o fogo para sem entrar nela. Bloco: entra,
  o destrói e para. Outra bomba: entra, a faz explodir e para.
- **Reação em cadeia no mesmo passo:** o conjunto de bombas que explode é calculado de uma vez, com todas as
  distâncias possíveis, no mesmo passo em que a primeira explode.
- **Explosões simultâneas:** todas são calculadas com a arena de **antes** do passo; os blocos só somem no fim.
  Assim o resultado não depende da ordem das bombas, e o bloco destruído por uma bomba não "abre caminho" para
  o fogo de outra no mesmo passo.
- **Dano:** vale pela célula do **centro** do corpo. É checado em todo passo, então quem entra numa chama
  acesa também é atingido. Quem chega depois de a chama apagar passa em segurança. Duas pessoas atingidas no
  mesmo passo morrem as duas (empate, veja "Como a rodada funciona").
- **Pedidos no mesmo passo:** se os jogadores 1 e 2 pedirem bomba na mesma célula no mesmo passo, vale o 1
  (só pode acontecer no meio da arena; o resto das regras é idêntico para os dois lados).
- **Bomba em célula em chamas:** não pode ser colocada.
- **Eventos:** o core anota o que aconteceu (`bombPlaced`, `bombExploded`, `blockDestroyed`, `playerHit`) e a cena
  os usa para tocar sons e redesenhar os blocos. As regras não dependem de eventos.

## Como a rodada funciona

Está em `src/core/round.ts` (sem Phaser). O estado guarda `round: { phase, endsAtTick, outcome }`.

- **Fases:** `playing` (em andamento) → `ending` (decidida, mas o jogo segue por 90 passos = 1,5 s) → `over`
  (acabou; o resultado vale e o estado fica **congelado**: `step` não faz mais nada).
- **Quando está decidida:** com 2 ou mais jogadores, quando sobra no máximo 1 vivo. Com 1 jogador só, quando
  ele morre.
- **Resultado** (calculado só no fim dos 1,5 s): sobrou 1 vivo = `win` desse jogador; ninguém vivo = `draw`
  (empate); jogador sozinho que morreu = `defeat`. Como o resultado só vale no fim da espera, **se o último
  sobrevivente morrer nesse tempo** (por uma bomba que já estava acesa), vira **empate**.
- **Reiniciar** é criar um estado novo (`createGameState`) com a mesma semente: não existe "limpeza" para
  esquecer, porque nada da rodada antiga é reaproveitado. A cena (`GameScene.create`) refaz desenhos e teclado do
  zero; os testes conferem que bombas, chamas, eventos, tempo e resultado voltam ao começo.
- O texto da tela de resultado vem de `src/render/outcomeText.ts` (função pura, testada).

## Como o computador joga

A IA (`src/core/ai.ts`, mais `src/core/danger.ts`) é pura e funciona como o teclado: a cada tick devolve uma
"intenção" (direção + bomba) para cada inimigo. Não trapaceia: anda na mesma velocidade e obedece as mesmas regras.

1. **Fugir.** Se a célula atual vai ser atingida (bomba com pavio, fogo, cadeia), procura o caminho de fuga mais
   curto que chega a uma célula segura *antes* do fogo, com uma margem de segurança.
2. **Bombardear.** Só coloca bomba se, simulando essa bomba, existe fuga garantida para si (e para aliados na
   cruz). Se acerta o adversário ao alcance, ou se um bloco está no caminho, a bomba vale a pena.
3. **Caçar.** Caminho mais curto até o adversário mais próximo, evitando células de perigo; atravessar bloco
   custa caro, então só abre caminho quando não há alternativa.

A dificuldade (`src/config/ai.ts`) muda a frequência com que ele "pensa", a margem de segurança, o intervalo entre
bombas e a chance de bombardear. Em testes de 270 partidas simuladas contra alvos imóveis/imortais, nenhum
inimigo morreu na própria bomba.

## Estrutura

```
src/
  core/      regras e estado do jogo — SEM Phaser e SEM navegador (testável sozinho)
  config/    constantes (arena, simulação, bombas, itens, partida, dificuldades da IA)
  render/    como o estado vira desenho (cores, paredes, blocos, itens, bombas, chamas, jogador, placar) e os textos de resultado
  audio/     sons provisórios sintetizados (sem arquivos de áudio) e controle de volume
  menu/      lógica do menu e das configurações (sem Phaser, testável): linhas, teclas, endereço, armazenamento
  scenes/    cenas do Phaser (menu e jogo)
  input/     teclado: transforma teclas em "intenções" para o core
  main.ts    cria o jogo e configura a escala da tela
tests/
  core/      testes da lógica do core (arena, movimento, bombas, explosões, itens, rodada, partida, dois jogadores, perigo, IA, invariantes, pureza)
  input/     testes da lógica de entrada que não depende do navegador (pilha de direções, tabela de teclas)
  menu/      testes do menu, do endereço e das configurações guardadas
  render/    testes dos textos de resultado e do placar
  helpers/   utilitários de teste (montar uma arena a partir de um desenho em texto)
```

## Regra principal

`src/core/` e `src/config/` **não podem** usar Phaser, `window`, `document`, `localStorage`, `Math.random`,
`Date.now`, `performance.now`, `setTimeout` nem `setInterval`. O motivo: a lógica precisa ser testável
sozinha e as partidas precisam ser reproduzíveis (sorteios usam semente; tempo é contado em passos fixos).
Duas proteções automáticas vigiam isso: `tests/core/purity.test.ts` e `tsconfig.core.json`, que compila o
core sem as definições do navegador.

## Decisões técnicas

- **TypeScript** em vez de JavaScript: o compilador acusa erros de tipo antes de o jogo rodar, o que ajuda
  quem está aprendendo e quem programa com IA, e evita migrar depois. O Vite não checa tipos, por isso existe
  o `npm run typecheck`.
- **Phaser 3.90.0**, versão fixa. Existe o Phaser 4 estável no npm; a troca ficou como decisão em aberto, e o
  custo é pequeno porque só `render/`, `scenes/`, `input/keyboardInput.ts` e `main.ts` conhecem o Phaser.
- **Grade 15 x 13 contando as paredes = 13 x 11 jogáveis**, como no Bomberman clássico, com blocos sorteados por semente; tamanhos ímpares são obrigatórios (pilares fixos). O tamanho está em `src/config/arena.ts`. A tela tem 1600 x 900 pixels lógicos (arena + barra superior fina; `src/render/layout.ts`) e é escalada para caber na janela.
- **Tempo do passo fixo:** o `update` mede o tempo real do quadro (`performance.now`) em vez de usar o `delta` do Phaser, que suaviza quadros lentos e deixava o jogo em câmera lenta quando a máquina engasgava. O limite é de 12 passos por quadro (0,2 s).
- **Movimento suave com alinhamento à grade**, em passo fixo, com o estado alterado no próprio lugar (uma única
  fonte de verdade, sem cópias).
- **Foco em PC.** O celular ficou fora do escopo por enquanto; a camada `input/` separada facilita um
  portar futuro.

## Como itens e partida funcionam

- **Itens** (`src/core/items.ts`, `src/config/items.ts`): a semente decide, na criação da partida, quais blocos
  escondem item e de que tipo (sorteio próprio, que não mexe na posição dos blocos). `GameState.hiddenItems`
  guarda os escondidos e `GameState.items` os que estão no chão. Pegar é por o **centro** do corpo estar na
  célula do item; dois jogadores no mesmo passo: o de menor id leva.
- **Velocidade por jogador:** `PlayerState.speedBonus` conta os itens; o passo de cada um vem de
  `stepDistanceOf` (`src/core/movement.ts`). O limite de 5 itens (e o valor de 0,35 por item) existe por um motivo técnico: o passo precisa
  ficar abaixo do dobro da folga do corpo, senão o inimigo do computador não consegue parar no centro das
  células (um teste de regressão cobre isso).
- **Partida** (`src/core/match.ts`): o placar é por time, fora do `GameState` (sobrevive entre rodadas).
  `recordRound` soma o ponto do vencedor e decide se a partida acabou; `nextRound` avança.
- **Menu e configurações** (`src/menu/`): o modelo do menu, a leitura do endereço e as configurações guardadas
  não dependem do Phaser e têm testes; `MenuScene` só desenha. Valores guardados inválidos viram o padrão.

## Limitações conhecidas da Etapa 7

- A IA é razoável, não esperta: contra alvo parado leva em média cerca de 72 segundos na arena 15 x 13 para eliminá-lo, porque
  espera as próprias bombas explodirem antes de se aproximar. Com 3 inimigos eles se atrapalham um pouco.
- Não há escudo; os poderes especiais de personagem ainda não existem (a ideia é criá-los depois).
- Limitações da 8.3: o computador (normal e difícil) já prevê bombas deslizando, chuta e arremessa de propósito, atravessa blocos com o fantasma e trata a bomba-relógio de outro jogador como perigo, mas ainda não se vira bem em tudo: só chuta/arremessa em casos simples (bomba colada nele, destino que pega o inimigo), não prevê que OUTRO jogador chute uma bomba e a bomba chutada que encontra um jogador no caminho é imprevisível. O computador nunca joga das laterais. Controles reais (xbox, playstation) não foram testados em hardware, só simulados.
- Não há pausa automática ao trocar de janela; o jogo continua rodando (use `Esc`).
- O menu é provisório (texto simples). Não há menu de pausa com opções nem tela de ajuda além da dica de teclas.
- Os dois jogadores compartilham um teclado, e alguns teclados não leem muitas teclas simultâneas.
- Sons provisórios e sintetizados; não passei por um navegador de verdade, então volume e timbre precisam da
  sua avaliação. Alguns navegadores só liberam áudio depois da primeira tecla.
- A leitura do teclado, o desenho e o som dependem do navegador e por isso não têm teste automatizado no
  projeto: as regras (bombas, explosões, itens, dano, cadeia, rodada, partida, arena simétrica, justiça entre os
  lados), o menu e a tabela de teclas estão testados; a conferência visual é manual.

**Arena maior? (nota da 8.7):** em monitores largos a arena é limitada pela ALTURA da janela, não pela largura; por isso tirar os painéis laterais não a aumenta. O que a faz crescer de verdade é gastar menos altura fora dela (barra superior mais fina, feito na 8.7: +2%) ou ter menos casas (cada casa maior). Se um dia quiser um mapa maior em casas (ex.: 17 x 15), cada casa fica menor na tela; está em `src/config/arena.ts` (valores ímpares), mas muda o equilíbrio, a IA e os testes.
