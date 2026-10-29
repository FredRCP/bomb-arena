import { describe, expect, it } from 'vitest';
import { BOULDER_PERIOD_TICKS, BOULDER_WARN_TICKS } from '../../src/config/hazards';
import { stageById } from '../../src/config/stages';
import { boulderColumns, bridgeRows, buildHazards, cellIndex, chasmCells, createGameState, drainEvents, getCell, placeBomb, step } from '../../src/core';
import type { GameState } from '../../src/core';

const temple = stageById('temple');
const make = (extra: Parameters<typeof createGameState>[0] = {}): GameState =>
  createGameState({ cols: temple.cols, rows: temple.rows, hazards: temple.hazards!, players: 2, seed: 3, sideline: false, ...extra });

/** Deixa a arena limpa (sem blocos nem pilares) para testar a pedra sem interferência. */
function clear(state: GameState): void {
  for (let row = 1; row < state.arena.rows - 1; row++) for (let col = 1; col < state.arena.cols - 1; col++) if (getCell(state.arena, col, row) === 'block' || getCell(state.arena, col, row) === 'wall') state.arena.cells[cellIndex(state.arena, col, row)] = 'empty';
}

describe('Templo Perdido: abismo e pontes', () => {
  it('abismo de 3 colunas no meio, com 3 pontes livres e as margens das pontes sem pilar', () => {
    const state = make();
    const cells = chasmCells(17, 13);
    expect(cells).toHaveLength(3 * 11);
    const rows = bridgeRows(13);
    expect(rows).toEqual([3, 6, 9]);
    for (const c of cells) expect(getCell(state.arena, c.col, c.row)).toBe(rows.includes(c.row) ? 'empty' : 'hole');
    expect(state.hazards!.bridges).toHaveLength(9);
    expect(state.hazards!.chasm).toHaveLength(24);
    for (const r of rows) for (const col of [6, 10]) expect(getCell(state.arena, col, r)).toBe('empty');
  });

  it('é simétrico (girado 180°) e todo jogador nasce em célula livre', () => {
    const state = make({ players: 4 });
    const { cols, rows } = state.arena;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const a = getCell(state.arena, col, row);
      const b = getCell(state.arena, cols - 1 - col, rows - 1 - row);
      if (a === 'hole' || a === 'wall' || b === 'hole' || b === 'wall') expect(a === 'hole' || a === 'wall').toBe(b === 'hole' || b === 'wall');
    }
    for (const p of state.players) expect(getCell(state.arena, Math.floor(p.x), Math.floor(p.y))).toBe('empty');
  });

  it('só dá para atravessar o abismo pelas pontes; fora delas o jogador não passa', () => {
    const state = make();
    clear(state);
    const p = state.players[0]!;
    p.x = 6.5;
    p.y = 2.5; // fileira 2: abismo
    for (let i = 0; i < 120; i++) step(state, { 1: { move: 'right' } });
    expect(p.x).toBeLessThan(7);
    p.x = 6.5;
    p.y = 3.5; // fileira 3: ponte
    for (let i = 0; i < 200; i++) step(state, { 1: { move: 'right' } });
    expect(p.x).toBeGreaterThan(10);
  });

  it('o fogo passa por cima do abismo', () => {
    const state = make();
    clear(state);
    const p = state.players[0]!;
    p.bombRange = 3;
    p.x = 8.5;
    p.y = 3.5; // em cima da ponte do meio da fileira 3
    placeBomb(state, p);
    p.x = 6.5;
    for (let i = 0; i < 300 && state.flames.length === 0; i++) step(state);
    const burning = state.flames.map((f) => f.row * 17 + f.col);
    expect(burning).toContain(2 * 17 + 8); // a célula de cima é abismo e pega fogo
    expect(burning).toContain(1 * 17 + 8);
  });
});

describe('Templo Perdido: pedra gigante', () => {
  const columns = boulderColumns(17);
  it('só desce por colunas ímpares fora do abismo', () => {
    expect(columns).toEqual([1, 3, 5, 11, 13, 15]);
  });

  it('avisa, desce pela coluna esmagando blocos, bombas e jogadores, e some no fim', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    const boulder = state.hazards!.boulder!;
    boulder.timer = 1;
    const warned: number[] = [];
    let rolled = false;
    let gone = false;
    let crushed = false;
    step(state);
    // coloca a vítima na coluna sorteada, a meio caminho, e um bloco no caminho
    const col = boulder.col;
    expect(columns).toContain(col);
    expect(boulder.phase).toBe('warn');
    const victim = state.players[1]!;
    victim.x = col + 0.5;
    victim.y = 9.5;
    const other = state.players[0]!;
    other.x = col === 1 ? 3.5 : 1.5;
    other.y = 1.5;
    state.arena.cells[cellIndex(state.arena, col, 5)] = 'block';
    for (let i = 0; i < BOULDER_WARN_TICKS + 200; i++) {
      step(state);
      for (const e of drainEvents(state)) {
        if (e.type === 'boulderWarn') warned.push(e.col);
        if (e.type === 'boulderRoll') rolled = true;
        if (e.type === 'boulderGone') gone = true;
        if (e.type === 'playerHit' && e.crushed) crushed = true;
      }
      if (gone) break;
    }
    expect(rolled).toBe(true);
    expect(gone).toBe(true);
    expect(crushed).toBe(true);
    expect(victim.alive).toBe(false);
    expect(other.alive).toBe(true);
    expect(getCell(state.arena, col, 5)).toBe('empty');
    expect(boulder.phase).toBe('idle');
    expect(boulder.last).toBe(col);
  });

  it('o jogador que sai da coluna durante o aviso se salva', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    const boulder = state.hazards!.boulder!;
    boulder.timer = 1;
    step(state);
    const p = state.players[0]!;
    p.x = boulder.col + 0.5;
    p.y = 6.5;
    const col = boulder.col;
    const sideways = col <= 5 ? 'right' : 'left';
    for (let i = 0; i < 40; i++) step(state, { 1: { move: sideways } });
    expect(Math.abs(p.x - (col + 0.5))).toBeGreaterThan(0.9);
    for (let i = 0; i < BOULDER_WARN_TICKS + 200; i++) step(state);
    expect(p.alive).toBe(true);
  });

  it('a próxima queda é em outra coluna e vem depois do intervalo', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    const boulder = state.hazards!.boulder!;
    boulder.timer = 1;
    for (const p of state.players) {
      p.x = 1.5;
      p.y = 1.5;
    }
    const picked: number[] = [];
    for (let i = 0; i < 2 * BOULDER_PERIOD_TICKS + 600; i++) {
      step(state);
      for (const e of drainEvents(state)) if (e.type === 'boulderWarn') picked.push(e.col);
      if (state.players[0]!.alive === false) state.players[0]!.alive = true; // só queremos contar as quedas
      if (state.players[1]!.alive === false) state.players[1]!.alive = true;
      state.round.phase = 'playing';
    }
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(picked[1]).not.toBe(picked[0]);
  });

  it('a IA vê a coluna da pedra como perigosa durante o aviso', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    state.hazards!.boulder!.timer = 1;
    step(state);
    const col = state.hazards!.boulder!.col;
    const map = buildHazards(state);
    expect(map.windows[cellIndex(state.arena, col, 6)]!.length).toBeGreaterThan(0);
    expect(map.windows[cellIndex(state.arena, col === 1 ? 3 : 1, 6)]!.length).toBe(0);
  });
});
