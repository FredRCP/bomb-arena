import { describe, expect, it } from 'vitest';
import { createMatch, createPlayer, nextRound, recordRound, teamOfOutcome } from '../../src/core';
import type { PlayerState, RoundOutcome } from '../../src/core';

const cell = { col: 1, row: 1 };
const twoHumans: PlayerState[] = [createPlayer(1, cell), createPlayer(2, cell)];
const soloVsEnemies: PlayerState[] = [createPlayer(1, cell), createPlayer(2, cell, 2, true), createPlayer(3, cell, 2, true)];
const win = (winner: 1 | 2 | 3): RoundOutcome => ({ kind: 'win', winner });
const draw: RoundOutcome = { kind: 'draw' };

describe('partida (melhor de 3)', () => {
  it('começa na rodada 1, sem pontos e sem terminar', () => {
    expect(createMatch()).toMatchObject({ round: 1, wins: {}, finished: false, winnerTeam: null, roundsToWin: 2, maxRounds: 5 });
  });

  it('o ponto vai para o TIME do vencedor: contra o computador, qualquer inimigo vencer pontua pelo time dos inimigos', () => {
    expect(teamOfOutcome(win(1), soloVsEnemies)).toBe(1);
    expect(teamOfOutcome(win(3), soloVsEnemies)).toBe(2);
    expect(teamOfOutcome(win(2), twoHumans)).toBe(2);
  });

  it('empate e derrota sem adversário não dão ponto', () => {
    expect(teamOfOutcome(draw, twoHumans)).toBeNull();
    expect(teamOfOutcome({ kind: 'defeat' }, [createPlayer(1, cell)])).toBeNull();
  });

  it('dois pontos seguidos encerram a partida, com o time vencedor', () => {
    const match = createMatch();
    recordRound(match, win(1), twoHumans);
    expect(match.finished).toBe(false);
    nextRound(match);
    expect(match.round).toBe(2);
    recordRound(match, win(1), twoHumans);
    expect(match).toMatchObject({ finished: true, winnerTeam: 1 });
  });

  it('1 x 1 vai para a rodada 3, que decide', () => {
    const match = createMatch();
    recordRound(match, win(1), twoHumans);
    nextRound(match);
    recordRound(match, win(2), twoHumans);
    expect(match.finished).toBe(false);
    nextRound(match);
    expect(match.round).toBe(3);
    recordRound(match, win(2), twoHumans);
    expect(match).toMatchObject({ finished: true, winnerTeam: 2, wins: { 1: 1, 2: 2 } });
  });

  it('empates não dão ponto, mas contam rodada: ao fim de 5 rodadas vence quem tem mais pontos', () => {
    const match = createMatch();
    const results = [win(1), draw, draw, draw, draw];
    results.forEach((outcome, i) => {
      if (i > 0) nextRound(match);
      recordRound(match, outcome, twoHumans);
    });
    expect(match).toMatchObject({ round: 5, finished: true, winnerTeam: 1, wins: { 1: 1 } });
  });

  it('5 rodadas sem ninguém na frente: a partida termina empatada (winnerTeam nulo)', () => {
    const match = createMatch();
    for (let i = 0; i < 5; i++) {
      if (i > 0) nextRound(match);
      recordRound(match, draw, twoHumans);
    }
    expect(match).toMatchObject({ finished: true, winnerTeam: null });
  });

  it('1 x 1 mais empates até o limite: termina empatada', () => {
    const match = createMatch();
    const results = [win(1), win(2), draw, draw, draw];
    results.forEach((outcome, i) => {
      if (i > 0) nextRound(match);
      recordRound(match, outcome, twoHumans);
    });
    expect(match).toMatchObject({ finished: true, winnerTeam: null });
  });

  it('depois de acabar, nada muda: registrar mais uma rodada ou avançar é ignorado', () => {
    const match = createMatch();
    recordRound(match, win(1), twoHumans);
    nextRound(match);
    recordRound(match, win(1), twoHumans);
    const snapshot = JSON.parse(JSON.stringify(match));
    recordRound(match, win(2), twoHumans);
    nextRound(match);
    expect(match).toEqual(snapshot);
  });

  it('contra o computador: o time dos inimigos soma pontos e pode vencer a partida', () => {
    const match = createMatch();
    recordRound(match, win(2), soloVsEnemies);
    nextRound(match);
    recordRound(match, win(3), soloVsEnemies);
    expect(match).toMatchObject({ finished: true, winnerTeam: 2 });
  });

  it('parâmetros próprios: melhor de 1 acaba na primeira vitória', () => {
    const match = createMatch(1, 1);
    recordRound(match, win(2), twoHumans);
    expect(match).toMatchObject({ finished: true, winnerTeam: 2 });
  });
});
