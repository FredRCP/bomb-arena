import { describe, expect, it } from 'vitest';
import { DART_FIRST_DELAY_TICKS, DART_PERIOD_TICKS, DART_WARN_TICKS, QUICKSAND_SPEED_FACTOR } from '../../src/config/hazards';
import { STAGES, stageById } from '../../src/config/stages';
import { cellIndex, createGameState, drainEvents, getCell, recordEvents, createScoreboard, speedFactorAt, sphinxCells, step, STEP_DISTANCE } from '../../src/core';
import type { GameState } from '../../src/core';

const EGYPT = stageById('egypt');

function egypt(options: { players?: 1 | 2 | 3 | 4; seed?: number } = {}): GameState {
  return createGameState({ cols: EGYPT.cols, rows: EGYPT.rows, hazards: EGYPT.hazards!, players: options.players ?? 2, seed: options.seed ?? 3, sideline: false });
}

/** Roda passos até a fase da armadilha mudar para `phase` (com um teto, para nunca travar). */
function runUntil(state: GameState, phase: 'warn' | 'fly' | 'idle', max = 5000): void {
  for (let i = 0; i < max && state.hazards!.dartTrap!.phase !== phase; i++) step(state);
  expect(state.hazards!.dartTrap!.phase).toBe(phase);
}

describe('arenas por fase: tamanho e jogadores', () => {
  it('toda fase tem tamanho ímpar, até 5 jogadores e a arena 17 x 13 nasce válida com os 5 jogadores', () => {
    for (const stage of STAGES) {
      expect(stage.cols % 2).toBe(1);
      expect(stage.rows % 2).toBe(1);
      expect(stage.maxPlayers).toBeGreaterThanOrEqual(2);
      expect(stage.maxPlayers).toBeLessThanOrEqual(5);
    }
    const state = createGameState({ cols: 17, rows: 13, players: 3, enemies: 2, seed: 5 });
    expect(state.arena.cols).toBe(17);
    for (const player of state.players) {
      expect(getCell(state.arena, Math.floor(player.x), Math.floor(player.y))).toBe('empty'); // ninguém nasce dentro de pilar
    }
    // O quinto jogador (centro) tem a coluna do meio par: o pilar do centro dá lugar a ele.
    const fifth = state.players[4]!;
    expect([Math.floor(fifth.x), Math.floor(fifth.y)]).toEqual([8, 6]);
  });

  it('arenas 15 e 19 continuam como antes (centro é a mesma célula livre)', () => {
    for (const cols of [15, 19]) {
      const state = createGameState({ cols, rows: 13, players: 3, enemies: 2, seed: 1 });
      expect(getCell(state.arena, Math.floor(state.players[4]!.x), Math.floor(state.players[4]!.y))).toBe('empty');
    }
  });

  it('as músicas de cada fase existem em public/', async () => {
    const { existsSync } = await import('node:fs');
    for (const stage of STAGES) for (const file of stage.music) expect(existsSync(`public/${file}`), file).toBe(true);
    expect(existsSync('public/audio/fechando_blocos.ogg')).toBe(true);
  });
});

describe('Egito: terreno', () => {
  it('esfinge de 3 paredes no centro, fileira de dardos sem blocos e itens só dentro de blocos', () => {
    const state = egypt();
    for (const cell of sphinxCells(17, 13)) expect(getCell(state.arena, cell.col, cell.row)).toBe('wall');
    const row = state.hazards!.dartTrap!.row;
    for (let col = 1; col < 16; col++) expect(getCell(state.arena, col, row)).not.toBe('block');
    for (const item of state.hiddenItems) expect(getCell(state.arena, item.col, item.row)).toBe('block');
  });

  it('areia movediça: aparece à mostra (sem bloco), longe dos cantos, fora da fileira de dardos, igual para a mesma semente', () => {
    const a = egypt({ seed: 7 });
    const b = egypt({ seed: 7 });
    expect(a.hazards!.quicksand).toEqual(b.hazards!.quicksand);
    expect(a.hazards!.quicksand.length).toBeGreaterThan(5);
    for (const index of a.hazards!.quicksand) {
      const col = index % 17;
      const row = Math.floor(index / 17);
      expect(getCell(a.arena, col, row)).toBe('empty');
      expect(row).not.toBe(a.hazards!.dartTrap!.row);
      for (const [cx, cy] of [[1, 1], [15, 1], [1, 11], [15, 11]]) expect(Math.abs(cx! - col) + Math.abs(cy! - row)).toBeGreaterThanOrEqual(5);
    }
    expect(egypt({ seed: 8 }).hazards!.quicksand).not.toEqual(a.hazards!.quicksand);
  });

  it('quem pisa na areia movediça anda mais devagar', () => {
    const state = egypt({ players: 1 });
    const sand = state.hazards!.quicksand[0]!;
    const player = state.players[0]!;
    player.x = (sand % 17) + 0.5;
    player.y = Math.floor(sand / 17) + 0.5;
    expect(speedFactorAt(state, player)).toBe(QUICKSAND_SPEED_FACTOR);
    // Passo de cima de areia pura: só se mexe se houver vizinha livre; mede em linha livre (a própria célula da areia).
    const before = player.x;
    const free = getCell(state.arena, Math.floor(player.x) + 1, Math.floor(player.y)) === 'empty';
    if (free) {
      step(state, { 1: { move: 'right' } });
      expect(player.x - before).toBeCloseTo(STEP_DISTANCE * QUICKSAND_SPEED_FACTOR, 6);
    }
    player.x = 1.5;
    player.y = 1.5;
    expect(speedFactorAt(state, player)).toBe(1);
  });

  it('arena sem perigos não muda nada (sem hazards, fator 1)', () => {
    const state = createGameState({ players: 1 });
    expect(state.hazards).toBeUndefined();
    expect(speedFactorAt(state, state.players[0]!)).toBe(1);
  });
});

describe('Egito: armadilha de dardos', () => {
  it('primeiro aviso ~18 s, disparo 2 s depois, e os disparos seguintes alternam o lado', () => {
    const state = egypt();
    const trap = state.hazards!.dartTrap!;
    runUntil(state, 'warn');
    expect(state.tick).toBeCloseTo(DART_FIRST_DELAY_TICKS - DART_WARN_TICKS, -1);
    expect(drainEvents(state).some((e) => e.type === 'dartWarn')).toBe(true);
    expect(trap.dir).toBe(1);
    const warnAt = state.tick;
    runUntil(state, 'fly');
    expect(state.tick - warnAt).toBe(DART_WARN_TICKS);
    expect(drainEvents(state).some((e) => e.type === 'dartFired')).toBe(true);
    runUntil(state, 'idle');
    expect(trap.dir).toBe(-1);
    const idleAt = state.tick;
    runUntil(state, 'warn');
    expect(state.tick - idleAt).toBeCloseTo(DART_PERIOD_TICKS - DART_WARN_TICKS, -1);
  });

  it('o dardo elimina quem está na fileira (sem pontos de "se matou") e poupa quem está em outra', () => {
    const state = egypt();
    const row = state.hazards!.dartTrap!.row;
    const [inRow, elsewhere] = state.players;
    inRow!.x = 8.5;
    inRow!.y = row + 0.5;
    elsewhere!.x = 8.5;
    elsewhere!.y = row + 2.5;
    runUntil(state, 'fly');
    drainEvents(state);
    runUntil(state, 'idle');
    const events = drainEvents(state);
    expect(inRow!.alive).toBe(false);
    expect(elsewhere!.alive).toBe(true);
    const hit = events.find((e) => e.type === 'playerHit');
    expect(hit).toMatchObject({ playerId: inRow!.id, killers: [], dart: true });
    const board = createScoreboard(state.players);
    recordEvents(board, events, state.players);
    expect(board[inRow!.id]).toMatchObject({ points: 0, deaths: 1 });
  });

  it('o colete aguenta um dardo; o escudo e o super-herói protegem', () => {
    const state = egypt({ players: 3 });
    const row = state.hazards!.dartTrap!.row;
    const [vest, shield, hero] = state.players;
    for (const p of [vest!, shield!, hero!]) {
      p.x = 8.5 + (p === vest ? 0 : 0);
      p.y = row + 0.5;
    }
    vest!.vest = true;
    shield!.shieldTicks = 5000;
    hero!.heroTicks = 5000;
    runUntil(state, 'fly');
    runUntil(state, 'idle');
    expect(vest!.alive).toBe(true);
    expect(vest!.vest).toBe(false);
    expect(shield!.alive).toBe(true);
    expect(hero!.alive).toBe(true);
  });

  it('o dardo sai do lado certo: dir -1 começa na direita', () => {
    const state = egypt();
    runUntil(state, 'fly');
    runUntil(state, 'idle');
    runUntil(state, 'fly');
    expect(state.hazards!.dartTrap!.dir).toBe(-1);
    expect(state.hazards!.dartTrap!.x).toBeLessThan(17);
    expect(state.hazards!.dartTrap!.x).toBeGreaterThan(14);
  });
});

describe('índice de célula usado pela areia', () => {
  it('cellIndex combina com col/row do estado', () => {
    const state = egypt();
    expect(cellIndex(state.arena, 3, 2)).toBe(2 * 17 + 3);
  });
});
