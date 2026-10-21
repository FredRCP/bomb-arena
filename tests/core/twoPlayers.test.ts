import { describe, expect, it } from 'vitest';
import { BOMB_FUSE_TICKS } from '../../src/config/bombs';
import { ROUND_END_DELAY_TICKS } from '../../src/config/round';
import { createGameState, createRng, drainEvents, step } from '../../src/core';
import type { Direction, GameState, Intents } from '../../src/core';
import { burning, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const LONG = ['###########', '#.........#', '###########'];

describe('dois jogadores: independência', () => {
  it('cada jogador só obedece à própria intenção', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 7, row: 1 },
    ]);
    run(state, 10, { 1: { move: 'right' } });
    expect(state.players[0]!.x).toBeGreaterThan(3.5);
    expect(state.players[1]!.x).toBe(7.5);

    run(state, 10, { 2: { move: 'left' } });
    expect(state.players[1]!.x).toBeLessThan(7.5);
  });

  it('os dois andam ao mesmo tempo, cada um na sua direção', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 9, row: 1 },
    ]);
    run(state, 20, { 1: { move: 'right' }, 2: { move: 'left' } });
    expect(state.players[0]!.x).toBeGreaterThan(1.5);
    expect(state.players[1]!.x).toBeLessThan(9.5);
  });

  it('jogadores não se bloqueiam: um atravessa o outro (decisão de design, como bombas não prendem ninguém)', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 4, row: 1 },
    ]);
    run(state, 60, { 1: { move: 'right' } });
    expect(state.players[0]!.x).toBeGreaterThan(5);
  });

  it('cada um tem o próprio limite de bombas', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 2, row: 1 },
      { id: 2, col: 8, row: 1 },
    ]);
    const both = { 1: { move: null, placeBomb: true }, 2: { move: null, placeBomb: true } } as const;
    run(state, 3, both);
    expect(state.bombs.map((b) => b.owner).sort()).toEqual([1, 2]);
  });

  it('a bomba do jogador 2 mata o jogador 1 e o jogador 2 vence', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 9, row: 1 },
    ]);
    // Jogador 2 se aproxima, põe a bomba e foge; o jogador 1 fica parado no alcance.
    run(state, 8 * 7, { 2: { move: 'left' } }); // anda ~4,2 células
    step(state, { 2: { move: null, placeBomb: true } });
    const bomb = state.bombs[0]!;
    state.players[0]!.x = bomb.col + 0.5 - 1; // jogador 1 a uma célula da bomba
    run(state, 60, { 2: { move: 'right' } }); // jogador 2 foge para longe do alcance
    run(state, BOMB_FUSE_TICKS);
    expect(state.players.map((p) => p.alive)).toEqual([false, true]);
    run(state, ROUND_END_DELAY_TICKS);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 2 });
  });

  it('as mortes de cada jogador geram o evento com o id certo', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 9, row: 1 },
    ]);
    state.flames.push({ col: 9, row: 1, ticksLeft: 3 });
    run(state, 2);
    expect(drainEvents(state)).toEqual([{ type: 'playerHit', playerId: 2, killers: [] }]);
  });
});

describe('dois jogadores: justiça entre os lados', () => {
  /** Gira a direção em 180° (o que o jogador 1 faz, o 2 faz "do outro lado"). */
  const flip: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

  it('se o jogador 2 repete os movimentos do 1 girados 180°, tudo é o espelho exato, passo a passo', () => {
    let compared = 0;
    let blocksDestroyed = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const state: GameState = createGameState({ seed, players: 2, blockDensity: 0.5, items: false, symmetric: true });
      for (const player of state.players) {
        player.maxBombs = 2;
        player.bombRange = 3;
      }
      // Sem itens de propósito: um jogador parado EXATAMENTE na divisa entre duas células (acontece, o passo é 0,075)
      // pega o item da célula de baixo/direita, e o espelho dele não é a mesma célula. Diferença de um passo, irrelevante no jogo.
      const { cols, rows } = state.arena;
      const rng = createRng(seed * 101);
      let move: Direction | null = null;

      for (let t = 0; t < 2500; t++) {
        if (rng() < 0.06) move = rng() < 0.15 ? null : (DIRECTIONS[Math.floor(rng() * 4)] ?? null);
        const bomb = rng() < 0.02;
        const intents: Intents = {
          1: { move, placeBomb: bomb },
          2: { move: move === null ? null : flip[move], placeBomb: bomb },
        };
        step(state, intents);
        if (state.round.phase === 'over') break;

        const [a, b] = state.players as [(typeof state.players)[number], (typeof state.players)[number]];
        // O único empate possível é as duas bombas na MESMA célula (a do meio); nesse caso o teste não vale.
        if (state.bombs.some((x) => state.bombs.some((y) => x !== y && x.col === y.col && x.row === y.row))) break;

        compared += 1;
        expect(b.x, `semente ${seed}, passo ${t}`).toBeCloseTo(cols - a.x, 6);
        expect(b.y, `semente ${seed}, passo ${t}`).toBeCloseTo(rows - a.y, 6);
        expect(b.alive, `vida, semente ${seed}, passo ${t}`).toBe(a.alive);
      }

      blocksDestroyed += createGameState({ seed, players: 2, blockDensity: 0.5, symmetric: true }).arena.cells.filter((c) => c === 'block').length - state.arena.cells.filter((c) => c === 'block').length;

      // Chamas e bombas também espelhadas no fim.
      const mirrored = burning(state).map((key) => {
        const [c, r] = key.split(',').map(Number) as [number, number];
        return `${cols - 1 - c},${rows - 1 - r}`;
      });
      expect(mirrored.sort()).toEqual(burning(state));
    }

    // Garante que o teste comparou muita coisa e que houve explosões de verdade (não passou "no vazio").
    expect(compared).toBeGreaterThan(3000); // as rodadas acabam cedo (morte simétrica = empate)
    expect(blocksDestroyed).toBeGreaterThan(10);
  });
});
