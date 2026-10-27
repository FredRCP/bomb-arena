import { describe, expect, it } from 'vitest';
import { AI_SETTINGS } from '../../src/config/ai';
import { SIDELINE_MOVE_TICKS } from '../../src/config/bombs';
import { HERO_TICKS, SPEED_ITEMS_CAP } from '../../src/config/items';
import { PLAYER_SPEED, TICKS_PER_SECOND } from '../../src/config/simulation';
import {
  MAX_STEP_DISTANCE,
  applyItem,
  assignTeams,
  createAi,
  createGameState,
  createMatch,
  createScoreboard,
  dropPowerups,
  rankPlayers,
  recordEvents,
  recordMatchScore,
  recordRound,
  recordRoundScore,
  step,
  stepDistanceOf,
} from '../../src/core';
import type { GameEvent, GameState } from '../../src/core';
import { addBomb, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const HALL = ['#########', '#.......#', '#.#.#.#.#', '#.......#', '#.#.#.#.#', '#.......#', '#########'];

describe('níveis de dificuldade e velocidade', () => {
  it('cinco níveis com 50, 55, 72, 100 e 110% da velocidade base', () => {
    const levels = ['easy', 'normal', 'hard', 'expert', 'ultra'] as const;
    expect(levels.map((level) => AI_SETTINGS[level].speedScale)).toEqual([0.5, 0.55, 0.72, 1, 1.1]);
    const cellsPerSecond = levels.map((level) => stepDistanceOf({ speedBonus: 0, speedScale: AI_SETTINGS[level].speedScale }) * TICKS_PER_SECOND);
    cellsPerSecond.forEach((speed, i) => expect(speed).toBeCloseTo(PLAYER_SPEED * [0.5, 0.55, 0.72, 1, 1.1][i]!, 9));
  });

  it('o teto de velocidade vale para todos: nem o nível mais alto com 5 itens passa do passo de uma pessoa com 5 itens', () => {
    const ultra = stepDistanceOf({ speedBonus: SPEED_ITEMS_CAP, speedScale: 1.2 });
    expect(ultra).toBeCloseTo(MAX_STEP_DISTANCE, 12);
    expect(MAX_STEP_DISTANCE).toBeLessThan(0.1);
    expect(stepDistanceOf({ speedBonus: SPEED_ITEMS_CAP, speedScale: 1 })).toBeCloseTo(MAX_STEP_DISTANCE, 12);
  });

  it('quem joga nas laterais anda mais devagar: uma casa a cada 10 passos (6 por segundo)', () => {
    expect(SIDELINE_MOVE_TICKS).toBe(10);
  });

  it('a IA não chuta a bomba para uma casa ocupada por alguém: a bomba não sairia do lugar', () => {
    // P2 (IA, com chute) em (1,3); a própria bomba em (1,2); o alvo parado em (1,1) logo atrás dela.
    const state = stateFromText(HALL, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 1, row: 3, cpu: true },
    ]);
    state.players[1]!.canKick = true;
    addBomb(state, 1, 2, { owner: 2, ticksLeft: 100, range: 1 });
    const decision = createAi(2, 'expert', 1).decide(state);
    expect(decision.move).not.toBe('up');
  });
});

describe('equipes', () => {
  it('assignTeams: cada um por si, pessoas × computador e times misturados', () => {
    expect(assignTeams('free', 2, 4)).toEqual([1, 2, 3, 4]);
    expect(assignTeams('versus', 1, 4)).toEqual([1, 2, 2, 2]);
    expect(assignTeams('versus', 2, 4)).toEqual([1, 1, 2, 2]);
    expect(assignTeams('mixed', 2, 4)).toEqual([1, 2, 1, 2]);
    expect(assignTeams('mixed', 1, 5)).toEqual([1, 2, 1, 2, 1]);
  });

  it('sem adversário possível o modo vira cada um por si (só pessoas no versus; 2 jogadores no misturado)', () => {
    expect(assignTeams('versus', 2, 2)).toEqual([1, 2]);
    expect(assignTeams('mixed', 1, 2)).toEqual([1, 2]);
  });

  it('createGameState marca quem é do computador e aplica os times', () => {
    const state = createGameState({ seed: 3, players: 2, enemies: 2, teams: 'mixed' });
    expect(state.players.map((p) => [p.id, p.team, p.cpu])).toEqual([
      [1, 1, false],
      [2, 2, false],
      [3, 1, true],
      [4, 2, true],
    ]);
    const free = createGameState({ seed: 3, players: 1, enemies: 3 });
    expect(free.players.map((p) => p.team)).toEqual([1, 2, 3, 4]);
  });

  it('a rodada só acaba quando sobra um único time: aliados vivos continuam a disputa', () => {
    const state = stateFromText(HALL, [
      { id: 1, col: 1, row: 1, team: 1 },
      { id: 2, col: 7, row: 5, team: 2 },
      { id: 3, col: 7, row: 1, team: 1 },
    ]);
    state.players[1]!.alive = false;
    run(state, 400); // a rodada espera um pouco antes de encerrar
    // só o time 1 sobrou (jogadores 1 e 3): vence, representado pelo menor id vivo
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 1 });
  });

  it('o ponto da partida vai para o time inteiro', () => {
    const state = stateFromText(HALL, [
      { id: 1, col: 1, row: 1, team: 1 },
      { id: 2, col: 7, row: 5, team: 2 },
      { id: 3, col: 7, row: 1, team: 1 },
    ]);
    const match = createMatch(1);
    recordRound(match, { kind: 'win', winner: 3 }, state.players);
    expect(match.winnerTeam).toBe(1);
  });

  it('eliminar um ALIADO não faz voltar das laterais; eliminar um inimigo faz', () => {
    const make = (victimTeam: number): GameState => {
      const state = stateFromText(HALL, [
        { id: 1, col: 1, row: 1, team: 1 },
        { id: 2, col: 4, row: 3, team: victimTeam },
        { id: 3, col: 7, row: 5, team: 3 },
      ]);
      state.players[0]!.alive = false;
      state.players[0]!.sideline = 4;
      addBomb(state, 4, 3, { owner: 1, ticksLeft: 1, range: 1 });
      return state;
    };
    const enemy = make(2);
    step(enemy);
    expect(enemy.players[1]!.alive).toBe(false);
    expect(enemy.players[0]!.alive).toBe(true);

    const friend = make(1);
    step(friend);
    expect(friend.players[1]!.alive).toBe(false);
    expect(friend.players[0]!.alive).toBe(false);
  });
});

describe('colete à prova de bala', () => {
  function duel(): GameState {
    return stateFromText(HALL, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 5, row: 5 },
    ]);
  }

  it('pegar o colete liga a proteção; um segundo colete é gasto sem efeito', () => {
    const p = duel().players[0]!;
    expect(applyItem(p, 'vest')).toBe(true);
    expect(p.vest).toBe(true);
    expect(applyItem(p, 'vest')).toBe(false);
  });

  it('aguenta UMA explosão: o jogador sobrevive, o colete se desfaz e o evento avisa', () => {
    const state = duel();
    const p = state.players[0]!;
    p.vest = true;
    addBomb(state, 1, 1, { owner: 2, ticksLeft: 1, range: 1 });
    step(state);
    expect(p.alive).toBe(true);
    expect(p.vest).toBe(false);
    expect(state.events.filter((e) => e.type === 'vestBroken')).toEqual([{ type: 'vestBroken', playerId: 1 }]);
    expect(state.events.some((e) => e.type === 'playerHit')).toBe(false);
    // a mesma chama ainda acesa não o mata no passo seguinte
    run(state, 20);
    expect(p.alive).toBe(true);
  });

  it('depois de gasto, a próxima explosão mata', () => {
    const state = duel();
    const p = state.players[0]!;
    p.vest = true;
    addBomb(state, 1, 1, { owner: 2, ticksLeft: 1, range: 1 });
    run(state, 90); // chama some e a proteção curta acaba
    expect(p.alive).toBe(true);
    addBomb(state, 1, 1, { owner: 2, ticksLeft: 1, range: 1 });
    run(state, 2);
    expect(p.alive).toBe(false);
  });

  it('quem morre com o colete (esmagado, por exemplo) o solta no chão', () => {
    const state = duel();
    const p = state.players[0]!;
    p.vest = true;
    dropPowerups(state, p);
    expect(state.items.map((i) => i.kind)).toEqual(['vest']);
    expect(p.vest).toBe(false);
  });
});

describe('super-herói', () => {
  it('fica imune às chamas por HERO_TICKS passos e depois volta a morrer', () => {
    const state = stateFromText(HALL, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 5, row: 5 },
    ]);
    const p = state.players[0]!;
    expect(applyItem(p, 'hero')).toBe(true);
    expect(p.heroTicks).toBe(HERO_TICKS);
    addBomb(state, 1, 1, { owner: 2, ticksLeft: 1, range: 1 });
    run(state, 40);
    expect(p.alive).toBe(true);
    expect(p.heroTicks).toBe(HERO_TICKS - 40);
    run(state, HERO_TICKS);
    expect(p.heroTicks).toBe(0);
    addBomb(state, 1, 1, { owner: 2, ticksLeft: 1, range: 1 });
    run(state, 2);
    expect(p.alive).toBe(false);
  });

  it('pegar de novo renova o tempo e a morte zera o efeito', () => {
    const state = stateFromText(HALL);
    const p = state.players[0]!;
    p.heroTicks = 100;
    applyItem(p, 'hero');
    expect(p.heroTicks).toBe(HERO_TICKS);
    dropPowerups(state, p);
    expect(p.heroTicks).toBe(0);
  });
});

describe('pontuação', () => {
  const players = stateFromText(HALL, [
    { id: 1, col: 1, row: 1, team: 1 },
    { id: 2, col: 3, row: 1, team: 2 },
    { id: 3, col: 5, row: 1, team: 1 },
  ]).players;
  const hit = (playerId: 1 | 2 | 3, killers: Array<1 | 2 | 3>, crushed = false): GameEvent => ({ type: 'playerHit', playerId, killers, ...(crushed && { crushed }) });

  it('eliminar inimigo +100; aliado -100; eliminar-se -50; esmagado pela morte súbita só conta a morte', () => {
    const board = createScoreboard(players);
    recordEvents(board, [hit(2, [1]), hit(3, [1]), hit(1, []), hit(2, [], true)], players);
    expect(board[1]).toMatchObject({ points: 100 - 100 - 50, kills: 1, deaths: 1 });
    expect(board[2]).toMatchObject({ points: 0, deaths: 2 });
  });

  it('vencer a rodada dá pontos a todo o time; vencer a partida dá bônus', () => {
    const board = createScoreboard(players);
    recordRoundScore(board, { kind: 'win', winner: 1 }, players);
    expect([board[1]!.points, board[2]!.points, board[3]!.points]).toEqual([300, 0, 300]);
    const match = createMatch(1);
    recordRound(match, { kind: 'win', winner: 1 }, players);
    recordMatchScore(board, match, players);
    expect([board[1]!.points, board[2]!.points, board[3]!.points]).toEqual([800, 0, 800]);
    recordRoundScore(board, { kind: 'draw' }, players);
    expect(board[2]!.points).toBe(0);
  });

  it('classificação: pontos, depois eliminações, depois menos mortes; empatados dividem a posição', () => {
    const board = createScoreboard(players);
    board[1] = { points: 300, kills: 1, deaths: 1, roundsWon: 1 };
    board[2] = { points: 300, kills: 2, deaths: 3, roundsWon: 0 };
    board[3] = { points: 300, kills: 2, deaths: 3, roundsWon: 0 };
    expect(rankPlayers(board, players).map((r) => [r.id, r.position])).toEqual([
      [2, 1],
      [3, 1],
      [1, 3],
    ]);
  });
});
