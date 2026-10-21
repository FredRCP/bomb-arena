import { DEFAULT_BOMB_RANGE } from '../../src/config/bombs';
import { step } from '../../src/core';
import type { GameState, Intents, PlayerId } from '../../src/core';

/** Roda `ticks` passos seguidos com as mesmas intenções. */
export function run(state: GameState, ticks: number, intents: Intents = {}): void {
  for (let i = 0; i < ticks; i++) step(state, intents);
}

/** Coloca uma bomba diretamente no estado (sem passar pelo jogador), para montar cenários exatos. */
export function addBomb(
  state: GameState,
  col: number,
  row: number,
  options: { owner?: PlayerId; ticksLeft?: number; range?: number; walkThrough?: PlayerId[] } = {},
): void {
  state.bombs.push({
    owner: options.owner ?? 1,
    col,
    row,
    ticksLeft: options.ticksLeft ?? 1,
    range: options.range ?? DEFAULT_BOMB_RANGE,
    walkThrough: options.walkThrough ?? [],
  });
}

/** Células em chamas como "col,row", em ordem alfabética: facilita comparar listas inteiras. */
export function burning(state: GameState): string[] {
  return state.flames.map((flame) => `${flame.col},${flame.row}`).sort();
}

export function cells(...pairs: Array<[number, number]>): string[] {
  return pairs.map(([col, row]) => `${col},${row}`).sort();
}
