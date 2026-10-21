import { ROUND_END_DELAY_TICKS, ROUND_TIME_TICKS, SUDDEN_DEATH_INTERVAL_TICKS } from '../config/round';
import { closeNextCell } from './shrink';
import type { GameState, RoundOutcome, RoundState } from './types';

// Fim de rodada: quando ela está decidida e qual é o resultado.
//
// Regras (testadas em tests/core/round.test.ts):
// - Partida com 2 ou mais jogadores: a rodada está decidida quando restam vivos de no máximo 1 time
//   (cada humano é um time; os inimigos do computador são um time só: eles não vencem uns aos outros).
// - Partida com 1 jogador (sem adversário): decidida quando ele morre (derrota). Sem inimigos ainda não há
//   como vencer; isso muda na Etapa 6.
// - Decidida não é o mesmo que terminada: o jogo segue por ROUND_END_DELAY_TICKS passos (fase 'ending').
//   O resultado é calculado só no fim da espera. Assim, se o último sobrevivente morrer nesse intervalo
//   (bomba que já estava acesa, por exemplo), o resultado é empate.
// - Tempo: a rodada tem um relógio regressivo (ROUND_TIME_TICKS). Zerou: morte súbita (shrink.ts); a rodada
//   termina pelas regras normais (quem sobrar vence; se os últimos morrerem juntos, empate).
// - Terminada ('over'), o estado fica congelado: ver o `step`.

export function createRound(timeTicks: number = ROUND_TIME_TICKS): RoundState {
  return { phase: 'playing', endsAtTick: null, outcome: null, ticksLeft: timeTicks, suddenDeath: false, closedCount: 0, nextCloseIn: SUDDEN_DEATH_INTERVAL_TICKS };
}

function aliveTeams(state: GameState): number {
  return new Set(state.players.filter((player) => player.alive).map((player) => player.team)).size;
}

function computeOutcome(state: GameState): RoundOutcome {
  const alive = state.players.filter((player) => player.alive);
  if (state.players.length === 1) return alive.length === 0 ? { kind: 'defeat' } : { kind: 'draw' };
  const winner = alive.map((player) => player.id).sort((a, b) => a - b)[0];
  if (winner !== undefined && aliveTeams(state) === 1) return { kind: 'win', winner };
  return { kind: 'draw' };
}

/** Chamado uma vez por passo, depois do dano. Avança a fase da rodada. */
export function updateRound(state: GameState): void {
  const round = state.round;
  if (round.phase === 'over') return;

  if (round.phase === 'playing') {
    const decided =
      state.players.length === 1 ? state.players.every((player) => !player.alive) : aliveTeams(state) <= 1;
    if (!decided) {
      // Ninguém decidiu ainda: o relógio anda. Quando zera, começa a morte súbita: a arena fecha de fora para dentro.
      if (round.ticksLeft > 0) round.ticksLeft -= 1;
      if (round.ticksLeft === 0) {
        round.suddenDeath = true;
        round.nextCloseIn -= 1;
        if (round.nextCloseIn <= 0) {
          closeNextCell(state);
          round.nextCloseIn = SUDDEN_DEATH_INTERVAL_TICKS;
        }
      }
      return;
    }
    round.phase = 'ending';
    round.endsAtTick = state.tick + ROUND_END_DELAY_TICKS;
  }

  if (round.endsAtTick !== null && state.tick >= round.endsAtTick) {
    round.phase = 'over';
    round.outcome = computeOutcome(state);
    state.events.push({ type: 'roundEnded', outcome: round.outcome });
  }
}
