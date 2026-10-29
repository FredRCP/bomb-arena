import { describe, expect, it } from 'vitest';
import { createGameState, step } from '../../src/core';

describe('rodada sem limite de tempo', () => {
  it('o relógio nunca zera e a morte súbita nunca começa', () => {
    const state = createGameState({ seed: 1, players: 1, enemies: 1, items: false, roundTicks: Number.POSITIVE_INFINITY });
    for (let i = 0; i < 60 * 60 * 4; i++) step(state, {});
    expect(state.round.ticksLeft).toBe(Number.POSITIVE_INFINITY);
    expect(state.round.suddenDeath).toBe(false);
    expect(state.round.closedCount).toBe(0);
  });
});
