import { describe, expect, it } from 'vitest';
import { createGameState, createMatch, createPlayer, nextRound, recordRound } from '../../src/core';
import type { PlayerState } from '../../src/core';
import { describeOutcome, describeRoundEnd, formatClock, isTeamGame, playerLabel, rankingLines, scoreLine, setCpuNames, teamName } from '../../src/render/outcomeText';

const cell = { col: 1, row: 1 };
/** Uma pessoa contra um computador (cada um por si). */
const solo = [createPlayer(1, cell), createPlayer(2, cell, 2, true)];
/** Duas pessoas, sem computador. */
const duo = [createPlayer(1, cell), createPlayer(2, cell)];
/** Duas pessoas + um computador, cada um por si. */
const trio = [createPlayer(1, cell), createPlayer(2, cell), createPlayer(3, cell, 3, true)];
/** Times misturados: pessoa 1 + CPU 3 contra pessoa 2 + CPU 4. */
const mixed: PlayerState[] = createGameState({ seed: 1, players: 2, enemies: 2, teams: 'mixed' }).players;

describe('describeOutcome', () => {
  it('empate é neutro em qualquer modo', () => {
    expect(describeOutcome({ kind: 'draw' }, solo)).toEqual({ title: 'Empate!', tone: 'neutral' });
    expect(describeOutcome({ kind: 'draw' }, duo)).toEqual({ title: 'Empate!', tone: 'neutral' });
  });

  it('derrota (sem adversário)', () => {
    expect(describeOutcome({ kind: 'defeat' }, [createPlayer(1, cell)])).toEqual({ title: 'Derrota', tone: 'bad' });
  });

  it('com uma pessoa jogando: se ela vence, é vitória; se o computador vence, é derrota', () => {
    expect(describeOutcome({ kind: 'win', winner: 1 }, solo)).toEqual({ title: 'Vitória!', tone: 'good' });
    expect(describeOutcome({ kind: 'win', winner: 2 }, solo)).toEqual({ title: 'Derrota', tone: 'bad' });
  });

  it('com duas pessoas, diz qual jogador venceu', () => {
    expect(describeOutcome({ kind: 'win', winner: 2 }, duo).title).toBe('Jogador 2 venceu!');
    expect(describeOutcome({ kind: 'win', winner: 1 }, duo).tone).toBe('good');
  });

  it('duas pessoas + computador: o computador vencer é dito com o nome dele e tom ruim', () => {
    expect(describeOutcome({ kind: 'win', winner: 3 }, trio)).toEqual({ title: 'CPU 1 venceu!', tone: 'bad' });
    expect(describeOutcome({ kind: 'win', winner: 2 }, trio).title).toBe('Jogador 2 venceu!');
  });

  it('em equipes, o título é o do time (e o time com uma pessoa é bom)', () => {
    // mixed: jogadores 1 (pessoa) e 3 (CPU) = time 1 (azul); 2 (pessoa) e 4 (CPU) = time 2 (vermelho)
    expect(describeOutcome({ kind: 'win', winner: 3 }, mixed)).toEqual({ title: 'Time Azul venceu a rodada', tone: 'good' });
    const versus = createGameState({ seed: 1, players: 1, enemies: 2, teams: 'versus' }).players;
    // Uma pessoa sozinha no time é chamada pelo próprio nome ("Você"); o computador junto é o Time Vermelho.
    expect(describeOutcome({ kind: 'win', winner: 1 }, versus)).toEqual({ title: 'Você venceu!', tone: 'good' });
    expect(describeOutcome({ kind: 'win', winner: 2 }, versus)).toEqual({ title: 'Derrota', tone: 'bad' });
  });
});

describe('nomes e times', () => {
  it('playerLabel: Você, Jogador N e CPU k', () => {
    const many = [createPlayer(1, cell), createPlayer(2, cell, 2, true), createPlayer(3, cell, 3, true)];
    expect(many.map((p) => playerLabel(p, many))).toEqual(['Você', 'CPU 1', 'CPU 2']);
    expect(duo.map((p) => playerLabel(p, duo))).toEqual(['Jogador 1', 'Jogador 2']);
  });

  it('isTeamGame: só há equipes quando alguém tem aliado', () => {
    expect(isTeamGame(solo)).toBe(false);
    expect(isTeamGame(trio)).toBe(false);
    expect(isTeamGame(mixed)).toBe(true);
  });

  it('teamName: times com cor em equipes; o próprio jogador cada um por si', () => {
    expect(teamName(1, mixed)).toBe('Time Azul');
    expect(teamName(2, mixed)).toBe('Time Vermelho');
    expect(teamName(2, solo)).toBe('CPU 1');
    expect(teamName(1, solo)).toBe('Você');
  });
});

describe('fim de rodada com placar', () => {
  it('placar: "Você 1 x 0 CPU 1" e "Jogador 1 0 x 2 Jogador 2"', () => {
    const a = createMatch();
    a.wins = { 1: 1 };
    expect(scoreLine(a, solo)).toBe('Você 1 x 0 CPU 1');
    const b = createMatch();
    b.wins = { 2: 2 };
    expect(scoreLine(b, duo)).toBe('Jogador 1 0 x 2 Jogador 2');
  });

  it('em equipes o placar usa os nomes dos times', () => {
    const match = createMatch();
    match.wins = { 1: 2, 2: 1 };
    expect(scoreLine(match, mixed)).toBe('Time Azul 2 x 1 Time Vermelho');
  });

  it('sem adversário só mostra a rodada', () => {
    expect(scoreLine(createMatch(), [createPlayer(1, cell)])).toBe('Rodada 1');
  });

  it('rodada decidida, partida em andamento: título da rodada, placar e "próxima rodada"', () => {
    const match = createMatch();
    recordRound(match, { kind: 'win', winner: 1 }, solo);
    expect(describeRoundEnd({ kind: 'win', winner: 1 }, match, solo)).toEqual({
      title: 'Vitória!',
      tone: 'good',
      subtitle: 'Você 1 x 0 CPU 1',
      hint: 'R: próxima rodada   Q: menu',
    });
  });

  it('partida decidida: título da partida e "nova partida"', () => {
    const match = createMatch();
    recordRound(match, { kind: 'win', winner: 2 }, solo);
    nextRound(match);
    recordRound(match, { kind: 'win', winner: 2 }, solo);
    expect(describeRoundEnd({ kind: 'win', winner: 2 }, match, solo)).toMatchObject({
      title: 'CPU 1 venceu a partida',
      tone: 'bad',
      subtitle: 'Você 0 x 2 CPU 1',
      hint: 'R: nova partida   Q: menu',
    });

    const m2 = createMatch();
    recordRound(m2, { kind: 'win', winner: 1 }, solo);
    nextRound(m2);
    recordRound(m2, { kind: 'win', winner: 1 }, solo);
    expect(describeRoundEnd({ kind: 'win', winner: 1 }, m2, solo).title).toBe('Você venceu a partida!');

    const m3 = createMatch();
    recordRound(m3, { kind: 'win', winner: 2 }, duo);
    nextRound(m3);
    recordRound(m3, { kind: 'win', winner: 2 }, duo);
    expect(describeRoundEnd({ kind: 'win', winner: 2 }, m3, duo).title).toBe('Jogador 2 venceu a partida!');

    const m4 = createMatch();
    recordRound(m4, { kind: 'win', winner: 1 }, mixed);
    nextRound(m4);
    recordRound(m4, { kind: 'win', winner: 3 }, mixed);
    expect(describeRoundEnd({ kind: 'win', winner: 3 }, m4, mixed)).toMatchObject({ title: 'Time Azul venceu a partida!', tone: 'good' });
  });

  it('partida empatada', () => {
    const match = createMatch();
    for (let i = 0; i < 5; i++) {
      if (i > 0) nextRound(match);
      recordRound(match, { kind: 'draw' }, duo);
    }
    expect(describeRoundEnd({ kind: 'draw' }, match, duo)).toMatchObject({ title: 'Partida empatada', tone: 'neutral' });
  });

  it('duas pessoas + computador: o placar lista todos', () => {
    const match = createMatch();
    recordRound(match, { kind: 'win', winner: 1 }, trio);
    expect(scoreLine(match, trio)).toBe('Jogador 1: 1  ·  Jogador 2: 0  ·  CPU 1: 0');
  });
});

describe('classificação e relógio', () => {
  it('rankingLines mostra posição, nome, pontos e eliminações', () => {
    const ranked = [
      { id: 2 as const, points: 800, kills: 3, deaths: 1, roundsWon: 2, position: 1 },
      { id: 1 as const, points: 300, kills: 0, deaths: 2, roundsWon: 1, position: 2 },
    ];
    expect(rankingLines(ranked, solo)).toEqual(['1º CPU 1  ·  800 pts  ·  3 elim.', '2º Você  ·  300 pts  ·  0 elim.']);
  });

  it('formatClock: sem limite de tempo mostra o infinito', () => {
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('∞');
  });

  it('formatClock: minutos e segundos, arredondando para cima', () => {
    expect(formatClock(10800)).toBe('3:00');
    expect(formatClock(10799)).toBe('3:00');
    expect(formatClock(10740)).toBe('2:59');
    expect(formatClock(61)).toBe('0:02');
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('nome do personagem do computador', () => {
  it('com os nomes definidos, o computador aparece pelo nome do personagem (no painel e no placar)', () => {
    const many = [createPlayer(1, cell), createPlayer(2, cell, 2, true), createPlayer(3, cell, 3, true)];
    setCpuNames({ 2: 'Bolt', 3: 'Nimbo' });
    try {
      expect(many.map((p) => playerLabel(p, many))).toEqual(['Você', 'Bolt', 'Nimbo']);
      expect(teamName(2, many)).toBe('Bolt');
    } finally {
      setCpuNames({});
    }
    expect(many.map((p) => playerLabel(p, many))).toEqual(['Você', 'CPU 1', 'CPU 2']);
  });
});
