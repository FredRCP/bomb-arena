import { describe, expect, it } from 'vitest';
import { createGameState } from '../../src/core';

describe('várias pessoas na mesma partida', () => {
  it('4 pessoas + 1 inimigo: os quatro primeiros são pessoas, o último é do computador', () => {
    const state = createGameState({ seed: 1, players: 4, enemies: 1 });
    expect(state.players.map((p) => p.cpu)).toEqual([false, false, false, false, true]);
    expect(state.players.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('o total nunca passa de 5', () => {
    const state = createGameState({ seed: 1, players: 5, enemies: 4 });
    expect(state.players).toHaveLength(5);
    expect(state.players.every((p) => !p.cpu)).toBe(true);
  });
});
