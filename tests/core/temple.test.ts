import { describe, expect, it } from 'vitest';
import { BOULDER_PERIOD_TICKS, BOULDER_WARN_TICKS } from '../../src/config/hazards';
import { stageById } from '../../src/config/stages';
import { boulderColumns, boulderSides, bridgeRows, buildHazards, cellIndex, chasmCells, createGameState, drainEvents, getCell, placeBomb, step, templeCells, deckCells } from '../../src/core';
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
    for (const c of cells) {
      if (c.row === 5 || c.row === 7 ) { expect(getCell(state.arena, c.col, c.row)).toBe('wall'); continue; } // paredes do templo
      expect(getCell(state.arena, c.col, c.row)).toBe(rows.includes(c.row) ? 'empty' : 'hole');
    }
    expect(state.hazards!.bridges).toHaveLength(6); // a do meio passa por dentro do templo
    expect(state.hazards!.chasm).toHaveLength(18);
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

describe('Templo Perdido: templo no meio do abismo', () => {
  it('quadrado 3 x 3 no meio: 6 paredes e a ponte do meio vira o túnel (sem bombas), com as saídas livres', () => {
    const state = make();
    const { walls, tunnel } = templeCells(17, 13);
    expect(walls).toHaveLength(6);
    expect(tunnel.map((c) => [c.col, c.row])).toEqual([[7, 6], [8, 6], [9, 6]]);
    for (const c of walls) expect(getCell(state.arena, c.col, c.row)).toBe('wall');
    for (const c of tunnel) expect(getCell(state.arena, c.col, c.row)).toBe('empty');
    expect(state.hazards!.tunnel).toHaveLength(3);
    for (const col of [6, 10]) expect(getCell(state.arena, col, 6)).toBe('empty');
  });

  it('dá para atravessar o abismo passando por dentro do templo', () => {
    const state = make();
    clear(state);
    state.arena.cells[cellIndex(state.arena, 6, 6)] = 'empty';
    const p = state.players[0]!;
    p.x = 6.5;
    p.y = 6.5;
    for (let i = 0; i < 220; i++) step(state, { 1: { move: 'right' } });
    expect(p.x).toBeGreaterThan(10);
  });
});

describe('Templo Perdido: pedras gigantes', () => {
  const columns = boulderColumns(17);
  it('só descem por colunas ímpares fora do abismo, uma de cada lado', () => {
    expect(columns).toEqual([1, 3, 5, 11, 13, 15]);
    expect(boulderSides(17)).toEqual([[1, 3, 5], [11, 13, 15]]);
  });

  it('avisam, descem pelas duas colunas esmagando blocos, bombas e jogadores, e somem no fim', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    const boulder = state.hazards!.boulder!;
    boulder.timer = 1;
    let rolled = 0;
    let gone = 0;
    let crushed = 0;
    step(state);
    expect(boulder.phase).toBe('warn');
    expect(boulder.cols).toHaveLength(2);
    const [left, right] = boulder.cols as [number, number];
    expect(left).toBeLessThan(7);
    expect(right).toBeGreaterThan(9);
    const a = state.players[0]!;
    const b = state.players[1]!;
    a.x = left + 0.5;
    a.y = 9.5;
    b.x = right + 0.5;
    b.y = 4.5;
    state.arena.cells[cellIndex(state.arena, left, 5)] = 'block';
    for (let i = 0; i < BOULDER_WARN_TICKS + 200; i++) {
      step(state);
      for (const e of drainEvents(state)) {
        if (e.type === 'boulderRoll') rolled += 1;
        if (e.type === 'boulderGone') gone += 1;
        if (e.type === 'playerHit' && e.crushed) crushed += 1;
      }
      if (gone === 2) break;
    }
    expect(rolled).toBe(2);
    expect(gone).toBe(2);
    expect(crushed).toBe(2);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
    expect(getCell(state.arena, left, 5)).toBe('empty');
    expect(boulder.phase).toBe('idle');
    expect([...boulder.last].sort()).toEqual([left, right].sort());
  });

  it('o jogador que sai da coluna durante o aviso se salva', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    const boulder = state.hazards!.boulder!;
    boulder.timer = 1;
    step(state);
    const p = state.players[0]!;
    const col = boulder.cols[0]!;
    p.x = col + 0.5;
    p.y = 6.5;
    const sideways = col <= 3 ? 'right' : 'left';
    for (let i = 0; i < 40; i++) step(state, { 1: { move: sideways } });
    expect(Math.abs(p.x - (col + 0.5))).toBeGreaterThan(0.9);
    for (let i = 0; i < BOULDER_WARN_TICKS + 200; i++) step(state);
    expect(p.alive).toBe(true);
  });

  it('a próxima queda é em outras colunas e vem depois do intervalo', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    const boulder = state.hazards!.boulder!;
    boulder.timer = 1;
    for (const p of state.players) {
      p.x = 8.5;
      p.y = 6.5;
    }
    const picked: number[][] = [];
    for (let i = 0; i < 2 * BOULDER_PERIOD_TICKS + 600; i++) {
      step(state);
      const cols = drainEvents(state).filter((e) => e.type === 'boulderWarn').map((e) => (e as { col: number }).col);
      if (cols.length) picked.push(cols);
      for (const p of state.players) p.alive = true;
      state.round.phase = 'playing';
    }
    expect(picked.length).toBeGreaterThanOrEqual(2);
    for (const col of picked[1]!) expect(picked[0]).not.toContain(col);
  });

  it('a IA vê as duas colunas das pedras como perigosas durante o aviso', () => {
    const state = make({ players: 2 });
    clear(state);
    state.round.phase = 'playing';
    state.hazards!.boulder!.timer = 1;
    step(state);
    const [left, right] = state.hazards!.boulder!.cols as [number, number];
    const map = buildHazards(state);
    for (const col of [left, right]) expect(map.windows[cellIndex(state.arena, col, 6)]!.length).toBeGreaterThan(0);
    const safe = [1, 3, 5, 11, 13, 15].find((c) => c !== left && c !== right)!;
    expect(map.windows[cellIndex(state.arena, safe, 6)]!.length).toBe(0);
  });
});

describe('ilha dos piratas: convés', () => {
  it('o centro 5 x 5 fica livre de blocos e pilares', () => {
    const state = createGameState({ cols: 17, rows: 13, players: 2, seed: 3, sideline: false, hazards: { deck: true } });
    for (const c of deckCells(17, 13)) expect(getCell(state.arena, c.col, c.row)).toBe('empty');
    expect(deckCells(17, 13)).toHaveLength(25);
  });
});
