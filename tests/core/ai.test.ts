import { describe, expect, it } from 'vitest';
import { AI_SETTINGS } from '../../src/config/ai';
import type { AiDifficulty } from '../../src/config/ai';
import { BOMB_FUSE_TICKS, FLAME_TICKS } from '../../src/config/bombs';
import { blastOf, cellIndex, createAi, createGameState, step } from '../../src/core';
import type { BombState, GameState, Intents } from '../../src/core';
import { playWithAis } from '../helpers/aiGame';
import { addBomb, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const HALL = ['#########', '#.......#', '#.#.#.#.#', '#.......#', '#.#.#.#.#', '#.......#', '#########'];
const CORRIDOR = ['###########', '#.........#', '###########'];

/** IA (jogador 2, time 0) contra um humano parado (jogador 1). */
function duel(lines: string[], humanCol: number, humanRow: number, aiCol: number, aiRow: number): GameState {
  return stateFromText(lines, [
    { id: 1, col: humanCol, row: humanRow },
    { id: 2, col: aiCol, row: aiRow, team: 0 },
  ]);
}

describe('IA: contrato básico', () => {
  it('jogador morto ou inexistente não faz nada', () => {
    const state = duel(CORRIDOR, 1, 1, 9, 1);
    const ai = createAi(2, 'expert');
    state.players[1]!.alive = false;
    expect(ai.decide(state)).toEqual({ move: null, placeBomb: false });
    expect(createAi(3, 'expert').decide(state)).toEqual({ move: null, placeBomb: false });
  });

  it('decidir NÃO altera o estado do jogo (a IA só lê)', () => {
    const state = createGameState({ seed: 3, players: 1, enemies: 1 });
    const ai = createAi(2, 'expert', 3);
    for (let t = 0; t < 300; t++) {
      const before = JSON.stringify(state);
      const intent = ai.decide(state);
      expect(JSON.stringify(state)).toBe(before);
      step(state, { 2: intent });
    }
  });

  it('sem inimigos vivos, fica parada e não coloca bomba', () => {
    const state = stateFromText(HALL, [{ id: 2, col: 3, row: 3, team: 0 }]);
    const ai = createAi(2, 'expert');
    for (let t = 0; t < 200; t++) {
      const intent = ai.decide(state);
      expect(intent).toEqual({ move: null, placeBomb: false });
      step(state, { 2: intent });
    }
  });

  it('mesma semente, mesmo jogo: é determinística', () => {
    function jogar(): GameState {
      const state = createGameState({ seed: 5, players: 1, enemies: 1 });
      playWithAis(state, [createAi(2, 'normal', 5)], 2000);
      return state;
    }
    expect(jogar()).toEqual(jogar());
  });

  it('semente diferente da IA muda o comportamento (variedade), mas continua válido', () => {
    const run1 = createGameState({ seed: 5, players: 1, enemies: 1 });
    const run2 = createGameState({ seed: 5, players: 1, enemies: 1 });
    playWithAis(run1, [createAi(2, 'easy', 1)], 1500);
    playWithAis(run2, [createAi(2, 'easy', 2)], 1500);
    expect(JSON.stringify(run1)).not.toBe(JSON.stringify(run2));
  });

  it('só decide bomba nos instantes de "pensar": todos os pedidos de bomba caem no mesmo ponto do ciclo', () => {
    const state = createGameState({ seed: 2, players: 1, enemies: 1 });
    const every = AI_SETTINGS.easy.thinkEveryTicks;
    const ai = createAi(2, 'easy', 2);
    const phases = new Set<number>();
    let requests = 0;
    for (let t = 0; t < 4000; t++) {
      const intent = ai.decide(state);
      if (intent.placeBomb) {
        requests += 1;
        phases.add(state.tick % every);
      }
      step(state, { 2: intent });
      state.events.length = 0;
    }
    expect(requests).toBeGreaterThan(2);
    expect(phases.size).toBe(1);
  });
});

describe('IA: fugir', () => {
  it('parada dentro da cruz de uma bomba, sai a tempo e sobrevive à explosão e às chamas', () => {
    for (const difficulty of ['normal', 'expert'] as const) {
      const state = duel(HALL, 1, 5, 4, 1);
      addBomb(state, 3, 1, { owner: 1, ticksLeft: 110, range: 3 }); // cruz cobre a linha 1 até a coluna 6
      const ai = createAi(2, difficulty, 1);
      const survived = playWithAis(state, [ai], 110 + FLAME_TICKS + 10);
      expect(survived).toBeGreaterThan(0);
      expect(state.players[1]!.alive, difficulty).toBe(true);
    }
  });

  it('não entra numa célula em chamas: espera as chamas apagarem e só então atravessa', () => {
    // Corredor com chamas bloqueando o meio; o humano está do outro lado.
    const state = duel(CORRIDOR, 1, 1, 9, 1);
    for (const col of [4, 5, 6]) state.flames.push({ col, row: 1, ticksLeft: 50 });
    const ai = createAi(2, 'expert', 1);
    for (let t = 0; t < 50; t++) {
      step(state, { 2: ai.decide(state) });
      expect(state.players[1]!.alive, `passo ${t}`).toBe(true);
    }
    // Depois das chamas, a IA anda em direção ao humano.
    const xBefore = state.players[1]!.x;
    for (let t = 0; t < 120; t++) step(state, { 2: ai.decide(state) });
    expect(state.players[1]!.x).toBeLessThan(xBefore);
  });

  it('fugindo de uma bomba, não corre para a cruz de outra que explode antes', () => {
    const state = duel(CORRIDOR, 1, 1, 5, 1);
    addBomb(state, 5, 1, { owner: 2, ticksLeft: 150, range: 2, walkThrough: [2] });
    addBomb(state, 9, 1, { owner: 1, ticksLeft: 25, range: 3 });
    const ai = createAi(2, 'expert', 1);
    playWithAis(state, [ai], 25 + FLAME_TICKS + 5);
    expect(state.players[1]!.alive).toBe(true);
  });
});

describe('IA: bombardear com segurança', () => {
  it('NÃO coloca bomba onde não há saída (beco curto), mesmo com o inimigo na mira', () => {
    const state = duel(['#####', '#...#', '#####'], 1, 1, 2, 1);
    state.players[1]!.bombRange = 2; // com alcance 2 a cruz cobre o corredor inteiro: sem saída
    const ai = createAi(2, 'expert', 1);
    for (let t = 0; t < 400; t++) {
      step(state, { 2: ai.decide(state) });
      expect(state.bombs, `passo ${t}`).toEqual([]);
    }
    expect(state.players[1]!.alive).toBe(true);
  });

  it('coloca bomba quando o inimigo está na mira e há saída, mata e sobrevive', () => {
    const state = duel(HALL, 7, 5, 7, 3); // no mesmo corredor vertical, a 2 células
    const ai = createAi(2, 'expert', 1);
    const ticks = playWithAis(state, [ai], 600);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 2 });
    expect(state.players[0]!.alive).toBe(false);
    expect(state.players[1]!.alive).toBe(true);
    expect(ticks).toBeLessThan(600);
  });

  it('abre caminho explodindo o bloco que bloqueia o corredor até o inimigo, e sobrevive', () => {
    // Corredor único: o bloco em (7,1) é o único caminho. A IA precisa explodi-lo para chegar ao humano.
    // (Há espaço atrás dela para fugir; num beco curto demais ela corretamente recusaria bombardear.)
    const state = duel(['#############', '#......o....#', '#############'], 11, 1, 1, 1);
    const ai = createAi(2, 'expert', 1);
    playWithAis(state, [ai], 2400);
    expect(state.arena.cells[cellIndex(state.arena, 7, 1)]).toBe('empty'); // o bloco do corredor sumiu
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 2 });
    expect(state.players[1]!.alive).toBe(true);
  });

  describe('aliado na cruz', () => {
    // Corredor com uma saída embaixo do aliado (col 5) que pode ser fechada por um bloco.
    function arenaWithAlly(trapped: boolean): GameState {
      return stateFromText(['#######', '#.....#', trapped ? '#.###o#' : '#.###.#', '#.....#', '#######'], [
        { id: 1, col: 1, row: 1 }, // inimigo (humano) na mira, à esquerda
        { id: 2, col: 3, row: 1, team: 0, bombRange: 2 }, // a IA (alcance 2: a cruz alcança o aliado)
        { id: 3, col: 5, row: 1, team: 0 }, // aliado parado no fim do corredor
      ]);
    }

    function ticksWithAllyInBlast(state: GameState): number {
      const ai = createAi(2, 'expert', 1);
      const allyCell = cellIndex(state.arena, 5, 1);
      let count = 0;
      for (let t = 0; t < 200; t++) {
        step(state, { 2: ai.decide(state) });
        state.events.length = 0;
        const byCell = new Map(state.bombs.map((b) => [cellIndex(state.arena, b.col, b.row), b] as const));
        if (state.bombs.some((b) => blastOf(state.arena, b, byCell).cells.includes(allyCell))) count += 1;
        state.players[0]!.alive = true; // o inimigo (na mira) fica imortal: a IA continua querendo bombardear
        state.round.phase = 'playing';
      }
      return count;
    }

    it('aliado PRESO num beco dentro da cruz: a IA não bombardeia', () => {
      const state = arenaWithAlly(true);
      expect(ticksWithAllyInBlast(state)).toBe(0);
      expect(state.players[2]!.alive).toBe(true);
    });

    it('aliado com saída: a IA bombardeia mesmo com ele na cruz (a regra não é um veto absoluto)', () => {
      const state = arenaWithAlly(false);
      expect(ticksWithAllyInBlast(state)).toBeGreaterThan(0);
    });
  });
});

describe('IA: partidas inteiras (estatísticas com sementes fixas)', () => {
  const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

  it.each(['easy', 'normal', 'hard', 'expert', 'ultra'] as AiDifficulty[])(
    '%s: contra um alvo IMORTAL, bombardeando sem parar por 4000 passos, nunca se mata',
    (difficulty) => {
      let bombs = 0;
      let blocks = 0;
      for (const seed of SEEDS) {
        const state = createGameState({ seed, players: 1, enemies: 1 });
        const ai = createAi(2, difficulty, seed);
        const before = state.arena.cells.filter((c) => c === 'block').length;
        for (let t = 0; t < 4000; t++) {
          state.players[0]!.alive = true; // alvo imortal: a rodada nunca acaba e a IA segue bombardeando
          state.round.phase = 'playing';
          const bombsBefore = state.bombs.length;
          step(state, { 2: ai.decide(state) });
          if (state.bombs.length > bombsBefore) bombs += 1;
          state.events.length = 0;
          expect(state.players[1]!.alive, `${difficulty}, semente ${seed}, passo ${t}`).toBe(true);
        }
        blocks += before - state.arena.cells.filter((c) => c === 'block').length;
      }
      // Garante que ela de fato jogou (não passou "no vazio parada").
      expect(bombs, 'bombas colocadas').toBeGreaterThan(SEEDS.length * 5);
      expect(blocks, 'blocos destruídos').toBeGreaterThan(SEEDS.length * 5);
    },
    120_000,
  );

  it.each(['easy', 'normal', 'hard', 'expert', 'ultra'] as AiDifficulty[])(
    '%s: derrota um humano parado no canto oposto, em todas as arenas testadas, em menos de 3 minutos',
    (difficulty) => {
      for (const seed of SEEDS) {
        const state = createGameState({ seed, players: 1, enemies: 1 });
        const ticks = playWithAis(state, [createAi(2, difficulty, seed)], 10800);
        expect(state.round.outcome, `${difficulty}, semente ${seed}`).toEqual({ kind: 'win', winner: 2 });
        expect(ticks).toBeLessThan(10800);
        expect(state.players[1]!.alive).toBe(true);
      }
    },
    120_000,
  );

  it('três inimigos juntos (mesmo time): vencem o humano parado e nenhum morre por fogo amigo', () => {
    for (const seed of SEEDS) {
      const state = createGameState({ seed, players: 1, enemies: 3, teams: 'versus' });
      const ais = [2, 3, 4].map((id) => createAi(id as 2 | 3 | 4, 'normal', seed));
      playWithAis(state, ais, 7200);
      expect(state.round.outcome, `semente ${seed}`).toEqual({ kind: 'win', winner: 2 });
      expect(state.players.filter((p) => p.team === 2 && !p.alive), `semente ${seed}`).toHaveLength(0);
    }
  }, 120_000);

  it('dois jogadores do computador, um contra o outro, jogam de verdade e ninguém fica preso', () => {
    for (const seed of [1, 2, 3, 4]) {
      const state = createGameState({ seed, players: 2, enemies: 0 });
      const ais = [createAi(1, 'expert', seed), createAi(2, 'expert', seed)];
      let bombs = 0;
      const visited = new Set<string>();
      for (let t = 0; t < 3000 && state.round.phase !== 'over'; t++) {
        const intents: Intents = {};
        for (const ai of ais) intents[ai.playerId] = ai.decide(state);
        const before = state.bombs.length;
        step(state, intents);
        if (state.bombs.length > before) bombs += 1;
        state.events.length = 0;
        for (const p of state.players) visited.add(`${p.id}:${Math.floor(p.x)},${Math.floor(p.y)}`);
      }
      expect(bombs, `semente ${seed}`).toBeGreaterThan(3);
      expect(visited.size, `semente ${seed}`).toBeGreaterThan(20);
    }
  }, 60_000);

  it('dificuldade: a difícil reage mais rápido que a fácil (configuração coerente)', () => {
    expect(AI_SETTINGS.expert.thinkEveryTicks).toBeLessThan(AI_SETTINGS.normal.thinkEveryTicks);
    expect(AI_SETTINGS.normal.thinkEveryTicks).toBeLessThan(AI_SETTINGS.easy.thinkEveryTicks);
    expect(AI_SETTINGS.expert.safetyMarginTicks).toBeGreaterThan(AI_SETTINGS.easy.safetyMarginTicks);
    expect(AI_SETTINGS.expert.bombCooldownTicks).toBeLessThan(AI_SETTINGS.easy.bombCooldownTicks);
    expect(BOMB_FUSE_TICKS).toBeGreaterThan(AI_SETTINGS.easy.thinkEveryTicks * 5);
  });

  it('a IA usa as mesmas regras do jogo: a bomba dela respeita o limite e o alcance do jogador', () => {
    const state = createGameState({ seed: 4, players: 1, enemies: 1, items: false }); // sem itens: um item de bomba subiria o limite
    state.players[1]!.maxBombs = 1;
    const ai = createAi(2, 'expert', 4);
    let maxSimultaneous = 0;
    for (let t = 0; t < 2000; t++) {
      step(state, { 2: ai.decide(state) });
      state.events.length = 0;
      maxSimultaneous = Math.max(maxSimultaneous, state.bombs.filter((b: BombState) => b.owner === 2).length);
    }
    expect(maxSimultaneous).toBe(1);
    run(state, 0);
  });
});

describe('IA: velocidade por dificuldade e morte súbita', () => {
  it('a velocidade do inimigo vem de enemySpeedScale; as pessoas continuam com 1', () => {
    const state = createGameState({ seed: 1, players: 1, enemies: 2, enemySpeedScale: 0.6 });
    expect(state.players.map((p) => p.speedScale)).toEqual([1, 0.6, 0.6]);
  });

  it('as dificuldades mais fáceis andam mais devagar, e a difícil anda como uma pessoa', () => {
    const scales = (['easy', 'normal', 'hard', 'expert', 'ultra'] as const).map((d) => AI_SETTINGS[d].speedScale);
    expect(scales).toEqual([0.5, 0.55, 0.72, 1, 1.1]);
  });

  it('mesmo devagar a IA joga bem: elimina um alvo parado na maioria das sementes e não treme', () => {
    for (const difficulty of ['easy', 'normal'] as const) {
      let kills = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const state = createGameState({ seed, players: 1, enemies: 1, enemySpeedScale: AI_SETTINGS[difficulty].speedScale, roundTicks: 1e9 });
        const ai = createAi(2, difficulty, seed);
        for (let t = 0; t < 15000 && state.round.phase !== 'over'; t++) {
          step(state, { 2: ai.decide(state) });
          state.events.length = 0;
        }
        if (!state.players[0]!.alive) kills += 1;
      }
      expect(kills, difficulty).toBeGreaterThanOrEqual(5);
    }
  });

  it('na morte súbita a IA sai de uma célula que vai fechar antes de ser esmagada', () => {
    const state = createGameState({ seed: 3, players: 1, enemies: 1, items: false, roundTicks: 1, blockDensity: 0 });
    const enemy = state.players[1]!;
    state.players[0]!.x = 7.5; // a pessoa fica no centro (a última a fechar), para a rodada seguir
    state.players[0]!.y = 6.5;
    enemy.x = 5.5;
    enemy.y = 1.5; // na volta externa, logo à frente do fechamento
    const ai = createAi(2, 'expert', 3);
    let hit = false;
    for (let t = 0; t < 200; t++) {
      step(state, { 2: ai.decide(state) });
      if (!enemy.alive) hit = true;
      if (state.round.phase === 'over') break;
    }
    expect(state.round.suddenDeath).toBe(true);
    expect(hit).toBe(false);
    expect(enemy.y).toBeGreaterThan(1.9);
  });
});
