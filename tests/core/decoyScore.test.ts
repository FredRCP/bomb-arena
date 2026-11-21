import { describe, expect, it } from 'vitest';
import { POINTS_DECOY } from '../../src/config/score';
import { createScoreboard, recordEvents } from '../../src/core';
import type { PlayerState } from '../../src/core';

describe('Pontuação das sósias da Pipoca', () => {
  it('destruir uma sósia dá pontos a quem soltou a bomba, sem contar eliminação', () => {
    const players = [{ id: 1, team: 1 }, { id: 2, team: 2 }] as unknown as PlayerState[];
    const board = createScoreboard(players);
    recordEvents(board, [{ type: 'decoyKilled', id: 1, owner: 1, killers: [2] }], players);
    expect(board[2]!.points).toBe(POINTS_DECOY);
    expect(board[2]!.kills).toBe(0);
    expect(board[1]!.deaths).toBe(0);
  });

  it('o dono não ganha pontos destruindo a própria sósia', () => {
    const players = [{ id: 1, team: 1 }, { id: 2, team: 2 }] as unknown as PlayerState[];
    const board = createScoreboard(players);
    recordEvents(board, [{ type: 'decoyKilled', id: 1, owner: 1, killers: [1] }], players);
    expect(board[1]!.points).toBe(0);
  });
});
