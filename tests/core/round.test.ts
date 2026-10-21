import { describe, expect, it } from 'vitest';
import { ROUND_END_DELAY_TICKS, ROUND_TIME_TICKS, SUDDEN_DEATH_INTERVAL_TICKS } from '../../src/config/round';
import { createGameState, drainEvents, step } from '../../src/core';
import type { GameState, PlayerId } from '../../src/core';
import { addBomb, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const LONG = ['###########', '#.........#', '###########'];

function duel(): GameState {
  return stateFromText(LONG, [
    { id: 1, col: 1, row: 1 },
    { id: 2, col: 9, row: 1 },
  ]);
}

function kill(state: GameState, id: PlayerId): void {
  state.players.find((p) => p.id === id)!.alive = false;
}

describe('rodada: partida de dois jogadores', () => {
  it('começa em andamento, sem resultado', () => {
    const state = duel();
    run(state, 20);
    expect(state.round).toMatchObject({ phase: 'playing', endsAtTick: null, outcome: null, suddenDeath: false });
  });

  it('enquanto os dois estão vivos, a rodada não acaba nunca', () => {
    const state = duel();
    run(state, 1000);
    expect(state.round.phase).toBe('playing');
  });

  it('quando um morre, a rodada está decidida mas só termina depois da espera; o resultado é vitória do outro', () => {
    const state = duel();
    kill(state, 1);
    step(state);
    expect(state.round.phase).toBe('ending');
    expect(state.round.outcome).toBeNull();

    run(state, ROUND_END_DELAY_TICKS - 1);
    expect(state.round.phase).toBe('ending');
    expect(state.round.outcome).toBeNull();

    run(state, 1);
    expect(state.round.phase).toBe('over');
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 2 });
  });

  it('o inverso: quem sobra é o jogador 1', () => {
    const state = duel();
    kill(state, 2);
    run(state, ROUND_END_DELAY_TICKS + 1);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 1 });
  });

  it('os dois morrem no mesmo passo: empate', () => {
    const state = stateFromText(LONG, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 5, row: 1 },
    ]);
    addBomb(state, 4, 1, { range: 1 });
    run(state, 1);
    expect(state.players.map((p) => p.alive)).toEqual([false, false]);
    run(state, ROUND_END_DELAY_TICKS);
    expect(state.round.outcome).toEqual({ kind: 'draw' });
  });

  it('o sobrevivente morre durante a espera final (bomba já acesa): empate', () => {
    const state = duel();
    kill(state, 1);
    addBomb(state, 9, 1, { owner: 1, ticksLeft: 30, range: 1 }); // sobre o jogador 2, explode em 30 passos
    run(state, ROUND_END_DELAY_TICKS + 1);
    expect(state.players[1]!.alive).toBe(false);
    expect(state.round.outcome).toEqual({ kind: 'draw' });
  });

  it('o sobrevivente se afasta da bomba durante a espera e vence', () => {
    const state = duel();
    kill(state, 1);
    addBomb(state, 9, 1, { owner: 1, ticksLeft: 60, range: 1, walkThrough: [2] });
    run(state, 40, { 2: { move: 'left' } });
    run(state, ROUND_END_DELAY_TICKS);
    expect(state.players[1]!.alive).toBe(true);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 2 });
  });

  it('durante a espera o jogo continua: dá para andar, e bombas continuam contando', () => {
    const state = duel();
    kill(state, 1);
    step(state);
    const x = state.players[1]!.x;
    run(state, 10, { 2: { move: 'left' } });
    expect(state.players[1]!.x).toBeLessThan(x);
    expect(state.round.phase).toBe('ending');
  });

  it('o evento roundEnded sai uma vez só, com o resultado', () => {
    const state = duel();
    kill(state, 2);
    run(state, ROUND_END_DELAY_TICKS + 50);
    const ended = drainEvents(state).filter((e) => e.type === 'roundEnded');
    expect(ended).toEqual([{ type: 'roundEnded', outcome: { kind: 'win', winner: 1 } }]);
  });

  it('a morte por chama de verdade também decide a rodada', () => {
    const state = duel();
    state.flames.push({ col: 9, row: 1, ticksLeft: 5 });
    run(state, ROUND_END_DELAY_TICKS + 2);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 1 });
  });
});

describe('rodada: partida de um jogador só', () => {
  it('vivo: nunca acaba', () => {
    const state = stateFromText(LONG);
    run(state, 2000);
    expect(state.round.phase).toBe('playing');
  });

  it('morrendo: derrota depois da espera', () => {
    const state = stateFromText(LONG);
    kill(state, 1);
    run(state, ROUND_END_DELAY_TICKS + 1);
    expect(state.round.phase).toBe('over');
    expect(state.round.outcome).toEqual({ kind: 'defeat' });
  });
});

describe('rodada acabada: estado congelado', () => {
  function finished(): GameState {
    const state = duel();
    kill(state, 1);
    addBomb(state, 5, 1, { owner: 2, ticksLeft: 500 });
    run(state, ROUND_END_DELAY_TICKS + 1);
    expect(state.round.phase).toBe('over');
    drainEvents(state);
    return state;
  }

  it('o tempo não passa: o passo não faz nada', () => {
    const state = finished();
    const before = JSON.stringify(state);
    run(state, 300, { 2: { move: 'left', placeBomb: true } });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('ninguém anda, ninguém põe bomba, a bomba não explode', () => {
    const state = finished();
    const { x } = state.players[1]!;
    const fuse = state.bombs[0]!.ticksLeft;
    run(state, 600, { 2: { move: 'left', placeBomb: true } });
    expect(state.players[1]!.x).toBe(x);
    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]!.ticksLeft).toBe(fuse);
  });

  it('o resultado não muda depois de fixado', () => {
    const state = finished();
    state.players[1]!.alive = false;
    run(state, 100);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 2 });
  });
});

describe('reiniciar: uma rodada nova não herda nada da anterior', () => {
  function playMessyRound(): GameState {
    const state = createGameState({ seed: 5, blockDensity: 0.6 });
    state.players[0]!.maxBombs = 3;
    for (let i = 0; i < 400; i++) {
      step(state, { 1: { move: i % 90 < 45 ? 'right' : 'down', placeBomb: i % 40 === 0 } });
    }
    return state;
  }

  it('a rodada anterior deixa sujeira (bombas, chamas ou eventos): sem isso, os testes seguintes não provariam nada', () => {
    const old = playMessyRound();
    expect(old.tick).toBeGreaterThan(0);
    expect(old.bombs.length + old.flames.length + old.events.length).toBeGreaterThan(0);
  });

  it('o estado novo começa limpo: sem bombas, chamas, eventos, resultado, com tempo zero e jogador vivo', () => {
    playMessyRound();
    const fresh = createGameState({ seed: 5, blockDensity: 0.6 });
    expect(fresh.bombs).toEqual([]);
    expect(fresh.flames).toEqual([]);
    expect(fresh.events).toEqual([]);
    expect(fresh.round).toEqual({ phase: 'playing', endsAtTick: null, outcome: null, ticksLeft: ROUND_TIME_TICKS, suddenDeath: false, closedCount: 0, nextCloseIn: SUDDEN_DEATH_INTERVAL_TICKS });
    expect(fresh.tick).toBe(0);
    expect(fresh.players.every((p) => p.alive)).toBe(true);
    expect(fresh.players[0]).toMatchObject({ x: 1.5, y: 1.5 });
  });

  it('a arena volta ao começo (blocos de volta) e a anterior não é afetada', () => {
    const old = playMessyRound();
    const oldCells = [...old.arena.cells];
    const fresh = createGameState({ seed: 5, blockDensity: 0.6 });
    expect(fresh.arena.cells).toEqual(createGameState({ seed: 5, blockDensity: 0.6 }).arena.cells);
    expect(fresh.arena.cells.filter((c) => c === 'block').length).toBeGreaterThan(
      old.arena.cells.filter((c) => c === 'block').length,
    );
    expect(old.arena.cells).toEqual(oldCells);
    expect(fresh.arena.cells).not.toBe(old.arena.cells);
  });

  it('o jogo reiniciado joga igual ao primeiro: mesma semente e mesmo roteiro dão o mesmo estado', () => {
    expect(playMessyRound()).toEqual(playMessyRound());
  });
});

describe('rodada por times (humano contra inimigos do computador)', () => {
  function versus(enemies: number): GameState {
    const specs = [{ id: 1 as PlayerId, col: 1, row: 1 }];
    const ids: PlayerId[] = [2, 3, 4];
    for (let i = 0; i < enemies; i++) specs.push({ id: ids[i]!, col: 3 + i, row: 1, team: 0 } as never);
    return stateFromText(['###########', '#.........#', '###########'], specs);
  }

  it('com 3 inimigos, a morte de um ou dois deles NÃO acaba a rodada', () => {
    const state = versus(3);
    kill(state, 2);
    run(state, ROUND_END_DELAY_TICKS + 20);
    expect(state.round.phase).toBe('playing');
    kill(state, 3);
    run(state, ROUND_END_DELAY_TICKS + 20);
    expect(state.round.phase).toBe('playing');
  });

  it('o humano vence quando morre o último inimigo', () => {
    const state = versus(3);
    for (const id of [2, 3, 4] as PlayerId[]) kill(state, id);
    run(state, ROUND_END_DELAY_TICKS + 1);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 1 });
  });

  it('o humano morre com inimigos vivos: vitória do time deles (vencedor = menor id vivo), mesmo com vários vivos', () => {
    const state = versus(3);
    kill(state, 1);
    run(state, ROUND_END_DELAY_TICKS + 1);
    expect(state.round.phase).toBe('over');
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 2 });
  });

  it('todos morrem juntos: empate', () => {
    const state = versus(2);
    for (const id of [1, 2, 3] as PlayerId[]) kill(state, id);
    run(state, ROUND_END_DELAY_TICKS + 1);
    expect(state.round.outcome).toEqual({ kind: 'draw' });
  });

  it('um inimigo morre por fogo amigo e a rodada segue com os outros', () => {
    const state = versus(2);
    state.flames.push({ col: 3, row: 1, ticksLeft: 5 }); // o inimigo 2 está em (3,1)
    run(state, ROUND_END_DELAY_TICKS + 20);
    expect(state.players[1]!.alive).toBe(false);
    expect(state.round.phase).toBe('playing');
  });
});

describe('rodada: cronômetro regressivo', () => {
  it('começa com 3 minutos e desce um passo por passo de simulação', () => {
    const state = duel();
    expect(state.round.ticksLeft).toBe(ROUND_TIME_TICKS);
    expect(ROUND_TIME_TICKS).toBe(10800);
    run(state, 100);
    expect(state.round.ticksLeft).toBe(ROUND_TIME_TICKS - 100);
  });

  it('zerou o tempo: começa a morte súbita, e a rodada NÃO acaba só por isso', () => {
    const state = duel();
    state.round.ticksLeft = 50;
    run(state, 49);
    expect(state.round.suddenDeath).toBe(false);
    run(state, 1);
    expect(state.round).toMatchObject({ phase: 'playing', suddenDeath: true, ticksLeft: 0 });
  });

  it('o relógio para quando a rodada já está decidida (não começa morte súbita por cima da vitória)', () => {
    const state = duel();
    state.round.ticksLeft = 10;
    kill(state, 2);
    run(state, 1);
    expect(state.round.phase).toBe('ending');
    run(state, ROUND_END_DELAY_TICKS);
    expect(state.round.suddenDeath).toBe(false);
    expect(state.round.outcome).toEqual({ kind: 'win', winner: 1 });
  });

  it('o tempo pode ser escolhido ao criar o estado (roundTicks)', () => {
    expect(createGameState({ roundTicks: 123 }).round.ticksLeft).toBe(123);
  });
});
