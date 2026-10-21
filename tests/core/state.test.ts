import { ARENA_COLS, ARENA_ROWS } from '../../src/config/arena';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOMB_RANGE, DEFAULT_MAX_BOMBS } from '../../src/config/bombs';
import { createGameState, drainEvents, getCell } from '../../src/core';

// Centro dos cantos opostos, calculado da config (a arena pode mudar de tamanho).
const LAST_X = ARENA_COLS - 1.5;
const LAST_Y = ARENA_ROWS - 1.5;

describe('createGameState', () => {
  it('cria o jogador 1 no centro da célula de nascimento do canto superior esquerdo', () => {
    const state = createGameState();
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toMatchObject({ id: 1, x: 1.5, y: 1.5, alive: true });
  });

  it('começa sem bombas, sem chamas e sem eventos, com o jogador vivo e com alcance padrão', () => {
    const state = createGameState();
    expect(state.bombs).toEqual([]);
    expect(state.flames).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.players[0]).toMatchObject({ bombRange: DEFAULT_BOMB_RANGE, maxBombs: DEFAULT_MAX_BOMBS });
  });

  it('drainEvents devolve os eventos e esvazia a lista', () => {
    const state = createGameState();
    state.events.push({ type: 'playerHit', playerId: 1, killers: [] });
    expect(drainEvents(state)).toEqual([{ type: 'playerHit', playerId: 1, killers: [] }]);
    expect(state.events).toEqual([]);
    expect(drainEvents(state)).toEqual([]);
  });

  it('coloca o jogador em uma célula livre, em qualquer semente', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { arena, players } = createGameState({ seed });
      const [player] = players;
      expect(getCell(arena, Math.floor(player!.x), Math.floor(player!.y))).toBe('empty');
    }
  });

  it('começa no passo de simulação zero', () => {
    expect(createGameState().tick).toBe(0);
  });

  it('repassa as opções para a arena', () => {
    const state = createGameState({ cols: 7, rows: 5, seed: 4 });
    expect(state.arena.cols).toBe(7);
    expect(state.arena.rows).toBe(5);
    expect(createGameState({ seed: 4 }).arena).toEqual(createGameState({ seed: 4 }).arena);
  });

  it('com players: 2, o jogador 2 nasce no canto oposto, vivo, e a vizinhança dos dois é igual', () => {
    const state = createGameState({ players: 2, seed: 9 });
    expect(state.players.map((p) => p.id)).toEqual([1, 2]);
    expect(state.players[0]).toMatchObject({ x: 1.5, y: 1.5, alive: true });
    expect(state.players[1]).toMatchObject({ x: LAST_X, y: LAST_Y, alive: true });
    expect(getCell(state.arena, ARENA_COLS - 2, ARENA_ROWS - 2)).toBe('empty');
    expect(getCell(state.arena, ARENA_COLS - 3, ARENA_ROWS - 2)).toBe('empty');
    expect(getCell(state.arena, ARENA_COLS - 2, ARENA_ROWS - 3)).toBe('empty');
  });

  it('sem informar, são 1 jogador; os dois jogadores têm as mesmas regras iniciais', () => {
    expect(createGameState().players).toHaveLength(1);
    const [a, b] = createGameState({ players: 2 }).players;
    expect({ ...a, id: 0, team: 0, x: 0, y: 0, spawn: { col: 0, row: 0 } }).toEqual({ ...b, id: 0, team: 0, x: 0, y: 0, spawn: { col: 0, row: 0 } });
  });

  it('com enemies, os inimigos nascem nos outros cantos, depois dos humanos (no modo versus formam um time só)', () => {
    const solo = createGameState({ players: 1, enemies: 1, seed: 4, teams: 'versus' });
    expect(solo.players.map((p) => [p.id, p.team, p.x, p.y])).toEqual([
      [1, 1, 1.5, 1.5],
      [2, 2, LAST_X, LAST_Y],
    ]);

    const horde = createGameState({ players: 1, enemies: 3, teams: 'versus' });
    expect(horde.players.map((p) => [p.id, p.team])).toEqual([[1, 1], [2, 2], [3, 2], [4, 2]]);
    expect(horde.players.map((p) => p.cpu)).toEqual([false, true, true, true]);
    expect(horde.players.map((p) => [p.x, p.y])).toEqual([[1.5, 1.5], [LAST_X, LAST_Y], [LAST_X, 1.5], [1.5, LAST_Y]]);
    for (const p of horde.players) expect(getCell(horde.arena, Math.floor(p.x), Math.floor(p.y))).toBe('empty');
  });

  it('dois humanos e um inimigo: o inimigo é o jogador 3, num canto livre', () => {
    const state = createGameState({ players: 2, enemies: 1 });
    expect(state.players.map((p) => [p.id, p.team])).toEqual([[1, 1], [2, 2], [3, 3]]); // cada um por si (padrão)
    expect([state.players[2]!.x, state.players[2]!.y]).toEqual([LAST_X, 1.5]);
  });
});
