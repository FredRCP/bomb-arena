import { createAi, step } from '../../src/core';
import type { AiController, GameState, Intents } from '../../src/core';

/**
 * Roda uma partida em que `ais` controlam os jogadores deles e `humanIntents` (opcional) dá a intenção
 * fixa dos outros. Para quando a rodada acaba ou ao chegar em `maxTicks`. Devolve quantos passos rodou.
 */
export function playWithAis(
  state: GameState,
  ais: readonly AiController[],
  maxTicks: number,
  humanIntents: Intents = {},
): number {
  let ticks = 0;
  while (ticks < maxTicks && state.round.phase !== 'over') {
    const intents: Intents = { ...humanIntents };
    for (const ai of ais) intents[ai.playerId] = ai.decide(state);
    step(state, intents);
    state.events.length = 0;
    ticks += 1;
  }
  return ticks;
}

export { createAi };
