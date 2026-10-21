import { describe, expect, it } from 'vitest';
import { STEP_DISTANCE, createGameState, step } from '../../src/core';
import type { Direction, Intents } from '../../src/core';

describe('step', () => {
  it('conta um passo de simulação por chamada', () => {
    const state = createGameState();
    expect(state.tick).toBe(0);
    step(state);
    step(state, {});
    expect(state.tick).toBe(2);
  });

  it('sem intenção de movimento, o jogador fica parado', () => {
    const state = createGameState();
    const { x, y } = state.players[0]!;

    step(state);
    step(state, {});
    step(state, { 1: { move: null } });

    expect(state.players[0]!.x).toBe(x);
    expect(state.players[0]!.y).toBe(y);
  });

  it('aplica a intenção do jogador 1', () => {
    const state = createGameState({ blockDensity: 0 });
    step(state, { 1: { move: 'right' } });
    expect(state.players[0]!.x).toBeCloseTo(1.5 + STEP_DISTANCE, 9);
    expect(state.players[0]!.y).toBe(1.5);
  });

  it('ignora intenção de jogador que não existe na partida', () => {
    const state = createGameState({ blockDensity: 0 });
    const { x, y } = state.players[0]!;
    step(state, { 2: { move: 'down' } });
    expect(state.players[0]!.x).toBe(x);
    expect(state.players[0]!.y).toBe(y);
  });

  it('é determinístico: mesma semente e mesmas intenções dão exatamente o mesmo resultado', () => {
    const script: Direction[] = ['right', 'right', 'down', 'down', 'left', 'up', 'right', 'down'];

    function play(): ReturnType<typeof createGameState> {
      const state = createGameState({ seed: 11, blockDensity: 0.3 });
      for (let round = 0; round < 40; round++) {
        for (const move of script) {
          const intents: Intents = { 1: { move } };
          step(state, intents);
        }
      }
      return state;
    }

    expect(play()).toEqual(play());
  });
});
