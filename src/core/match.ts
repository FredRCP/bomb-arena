import { MAX_ROUNDS, ROUNDS_TO_WIN } from '../config/match';
import type { PlayerState, RoundOutcome } from './types';

// Partida = várias rodadas ("melhor de 3"). O placar é por TIME, como a rodada: cada time soma os pontos dos seus membros (cada um por si: um time por jogador) e os
// inimigos do computador podem ser um time só (veja TeamMode em state.ts). Não faz parte do GameState: o estado da
// rodada é descartado a cada rodada, o placar sobrevive entre elas.
//
// Regras (testadas em tests/core/match.test.ts):
// - Vencer a rodada dá 1 ponto ao time do vencedor. Empate e derrota sem adversário não dão ponto.
// - `roundsToWin` = 1 é a partida única: uma rodada só (mesmo que empate, a partida acaba empatada).
// - A partida acaba quando um time chega a `roundsToWin` pontos, ou quando `maxRounds` rodadas foram jogadas.
// - No limite de rodadas vence quem tem mais pontos; se estiver empatado em pontos, a partida empata.

export interface MatchState {
  roundsToWin: number;
  maxRounds: number;
  /** Rodada atual (começa em 1). */
  round: number;
  /** Pontos por time. */
  wins: Record<number, number>;
  finished: boolean;
  /** Time vencedor da partida; null se ainda não acabou ou se terminou empatada. */
  winnerTeam: number | null;
}

/** Limite de rodadas de uma partida de `roundsToWin` vitórias: 1 (partida única), 5 (2 vitórias), 7 (3 vitórias)... */
export function maxRoundsFor(roundsToWin: number): number {
  return roundsToWin <= 1 ? 1 : roundsToWin === ROUNDS_TO_WIN ? MAX_ROUNDS : 2 * roundsToWin + 1;
}

export function createMatch(roundsToWin = ROUNDS_TO_WIN, maxRounds = maxRoundsFor(roundsToWin)): MatchState {
  return { roundsToWin, maxRounds, round: 1, wins: {}, finished: false, winnerTeam: null };
}

/** Time que ganhou o ponto da rodada, ou null se ninguém ganhou (empate, derrota sem adversário). */
export function teamOfOutcome(outcome: RoundOutcome, players: readonly PlayerState[]): number | null {
  if (outcome.kind !== 'win') return null;
  return players.find((player) => player.id === outcome.winner)?.team ?? null;
}

/** Registra o resultado da rodada atual. Chame uma vez por rodada; depois de a partida acabar não faz nada. */
export function recordRound(match: MatchState, outcome: RoundOutcome, players: readonly PlayerState[]): void {
  if (match.finished) return;

  const team = teamOfOutcome(outcome, players);
  if (team !== null) match.wins[team] = (match.wins[team] ?? 0) + 1;

  const leaders = Object.entries(match.wins).sort((a, b) => b[1] - a[1]);
  const top = leaders[0];
  if (top && top[1] >= match.roundsToWin) {
    match.finished = true;
    match.winnerTeam = Number(top[0]);
  } else if (match.round >= match.maxRounds) {
    match.finished = true;
    const second = leaders[1];
    match.winnerTeam = top && (!second || top[1] > second[1]) ? Number(top[0]) : null;
  }
}

/** Passa para a próxima rodada (só se a partida não acabou). */
export function nextRound(match: MatchState): void {
  if (!match.finished) match.round += 1;
}
