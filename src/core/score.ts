import { POINTS_KILL, POINTS_MATCH_WIN, POINTS_ROUND_WIN, POINTS_SUICIDE, POINTS_TEAMKILL } from '../config/score';
import { teamOfOutcome } from './match';
import type { MatchState } from './match';
import type { GameEvent, PlayerId, PlayerState, RoundOutcome } from './types';

// Pontuação e classificação da partida. Funções puras sobre um quadro de pontos que sobrevive entre as rodadas
// (como o placar de vitórias, não faz parte do GameState). Testado em tests/core/score.test.ts.
//
// Regras:
// - Eliminar um jogador de OUTRO time: +POINTS_KILL (para cada dono de bomba que o pegou).
// - Eliminar um aliado: POINTS_TEAMKILL. Eliminar-se sozinho: POINTS_SUICIDE.
// - Vencer a rodada: POINTS_ROUND_WIN para cada membro do time vencedor (vivo ou não).
// - Vencer a partida: POINTS_MATCH_WIN para cada membro do time vencedor.
// - Classificação: mais pontos primeiro; empate de pontos desempata por mais eliminações, e depois por menos mortes;
//   quem empata em tudo divide a mesma posição.

export interface ScoreLine {
  points: number;
  kills: number;
  deaths: number;
  roundsWon: number;
}

export type Scoreboard = Partial<Record<PlayerId, ScoreLine>>;

export function createScoreboard(players: readonly Pick<PlayerState, 'id'>[]): Scoreboard {
  const board: Scoreboard = {};
  for (const player of players) board[player.id] = { points: 0, kills: 0, deaths: 0, roundsWon: 0 };
  return board;
}

function lineOf(board: Scoreboard, id: PlayerId): ScoreLine {
  return (board[id] ??= { points: 0, kills: 0, deaths: 0, roundsWon: 0 });
}

/** Contabiliza as eliminações dos eventos de um passo (ou de vários). */
export function recordEvents(board: Scoreboard, events: readonly GameEvent[], players: readonly PlayerState[]): void {
  const teamOf = (id: PlayerId): number | undefined => players.find((p) => p.id === id)?.team;
  for (const event of events) {
    if (event.type !== 'playerHit') continue;
    lineOf(board, event.playerId).deaths += 1;
    if (event.killers.length === 0) {
      // Eliminou-se com a própria bomba (perde pontos); esmagado pela morte súbita só conta a morte.
      if (!event.crushed) lineOf(board, event.playerId).points += POINTS_SUICIDE;
      continue;
    }
    for (const killer of event.killers) {
      const line = lineOf(board, killer);
      if (teamOf(killer) === teamOf(event.playerId)) line.points += POINTS_TEAMKILL;
      else {
        line.points += POINTS_KILL;
        line.kills += 1;
      }
    }
  }
}

/** Contabiliza o fim da rodada: pontos de vitória para todo o time vencedor. */
export function recordRoundScore(board: Scoreboard, outcome: RoundOutcome, players: readonly PlayerState[]): void {
  const team = teamOfOutcome(outcome, players);
  if (team === null) return;
  for (const player of players) {
    if (player.team !== team) continue;
    const line = lineOf(board, player.id);
    line.points += POINTS_ROUND_WIN;
    line.roundsWon += 1;
  }
}

/** Bônus de fim de partida para o time vencedor (chame uma vez, quando `match.finished`). */
export function recordMatchScore(board: Scoreboard, match: MatchState, players: readonly PlayerState[]): void {
  if (!match.finished || match.winnerTeam === null) return;
  for (const player of players) if (player.team === match.winnerTeam) lineOf(board, player.id).points += POINTS_MATCH_WIN;
}

export interface RankedPlayer extends ScoreLine {
  id: PlayerId;
  /** 1 = primeiro; empatados dividem a posição. */
  position: number;
}

/** Classificação final dos jogadores, do primeiro ao último. */
export function rankPlayers(board: Scoreboard, players: readonly Pick<PlayerState, 'id'>[]): RankedPlayer[] {
  const rows = players.map((player) => ({ id: player.id, ...lineOf(board, player.id) }));
  rows.sort((a, b) => b.points - a.points || b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
  let position = 0;
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    const tied = previous && previous.points === row.points && previous.kills === row.kills && previous.deaths === row.deaths;
    if (!tied) position = index + 1;
    return { ...row, position };
  });
}
