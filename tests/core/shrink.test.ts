import { describe, expect, it } from 'vitest';
import { ROUND_END_DELAY_TICKS, SUDDEN_DEATH_INTERVAL_TICKS } from '../../src/config/round';
import { buildHazards, createGameState, drainEvents, step } from '../../src/core';
import { closeNextCell, pendingClosures, spiralOrder } from '../../src/core/shrink';
import { run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const ROOM = ['#######', '#.....#', '#.....#', '#.....#', '#######'];

describe('morte súbita: ordem da espiral', () => {
  it('cobre cada célula de dentro da borda exatamente uma vez, começando no canto de cima à esquerda', () => {
    const order = spiralOrder(15, 13);
    expect(order).toHaveLength(13 * 11);
    expect(new Set(order.map((c) => `${c.col},${c.row}`)).size).toBe(13 * 11);
    expect(order[0]).toEqual({ col: 1, row: 1 });
    expect(order[1]).toEqual({ col: 2, row: 1 });
    expect(order.every((c) => c.col >= 1 && c.col <= 13 && c.row >= 1 && c.row <= 11)).toBe(true);
  });

  it('a volta externa vem antes de qualquer célula da segunda volta', () => {
    const order = spiralOrder(15, 13);
    const ring = (c: { col: number; row: number }): number => Math.min(c.col - 1, c.row - 1, 13 - c.col, 11 - c.row);
    const rings = order.map(ring);
    expect(rings).toEqual([...rings].sort((a, b) => a - b));
  });

  it('funciona em salas pequenas (3 x 5 dentro da borda)', () => {
    expect(spiralOrder(7, 5)).toHaveLength(15);
  });
});

describe('morte súbita: fechamento', () => {
  it('uma célula vira parede a cada intervalo, depois de zerar o tempo', () => {
    const state = stateFromText(ROOM, [{ id: 1, col: 3, row: 2 }, { id: 2, col: 4, row: 2 }]);
    state.round.ticksLeft = 1;
    run(state, 1); // zera
    expect(state.arena.cells.filter((c) => c === 'wall').length).toBe(7 * 5 - 15);
    run(state, SUDDEN_DEATH_INTERVAL_TICKS - 1);
    expect(state.arena.cells[1 * 7 + 1]).toBe('wall');
    expect(drainEvents(state)).toContainEqual({ type: 'cellClosed', col: 1, row: 1 });
    run(state, SUDDEN_DEATH_INTERVAL_TICKS);
    expect(state.arena.cells[1 * 7 + 2]).toBe('wall');
  });

  it('quem está na célula (ou encostando nela) morre; bomba, item e chama dela somem', () => {
    const state = stateFromText(ROOM, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 5, row: 3 }]);
    state.players[0]!.x = 1.9; // corpo invade a célula (2, 1) sem o centro estar nela? centro em col 1
    state.bombs.push({ owner: 2, col: 1, row: 1, ticksLeft: 100, range: 1, walkThrough: [] });
    state.flames.push({ col: 1, row: 1, ticksLeft: 5 });
    state.items.push({ col: 1, row: 1, kind: 'bomb' });
    state.hiddenItems.push({ col: 1, row: 1, kind: 'range' });
    closeNextCell(state);
    expect(state.arena.cells[1 * 7 + 1]).toBe('wall');
    expect(state.players[0]!.alive).toBe(false);
    expect(state.players[1]!.alive).toBe(true);
    expect(state.bombs).toHaveLength(0);
    expect(state.flames).toHaveLength(0);
    expect(state.items).toHaveLength(0);
    expect(state.hiddenItems).toHaveLength(0);
    expect(drainEvents(state)).toContainEqual({ type: 'playerHit', playerId: 1, killers: [], crushed: true });
  });

  it('pula células que já são parede (pilares) sem gastar tempo', () => {
    const state = createGameState({ seed: 1, players: 2 });
    state.round.closedCount = 0;
    const pending = pendingClosures(state, 200);
    expect(pending.every((c) => state.arena.cells[c.row * state.arena.cols + c.col] !== 'wall')).toBe(true);
    expect(pending.length).toBe(13 * 11 - 6 * 5);
  });

  it('a rodada termina quando só um time sobra: quem fica no centro vence a corrida da espiral', () => {
    const state = stateFromText(ROOM, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 3, row: 2 }]);
    state.round.ticksLeft = 1;
    for (let i = 0; i < 2000 && state.round.phase !== 'over'; i++) step(state);
    expect(state.round).toMatchObject({ phase: 'over', outcome: { kind: 'win', winner: 2 } });
    expect(state.round.suddenDeath).toBe(true);
  });

  it('todos esmagados juntos: empate', () => {
    const state = stateFromText(ROOM, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 1, row: 1 }]);
    state.round.ticksLeft = 1;
    run(state, SUDDEN_DEATH_INTERVAL_TICKS + ROUND_END_DELAY_TICKS + 2);
    expect(state.round.outcome).toEqual({ kind: 'draw' });
  });

  it('arena inteira fechada: ninguém sobrevive (sem rodada infinita)', () => {
    const state = stateFromText(ROOM, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 5, row: 3 }]);
    state.round.ticksLeft = 1;
    for (let i = 0; i < 5000 && state.round.phase !== 'over'; i++) step(state);
    expect(state.round.phase).toBe('over');
  });

  it('a IA enxerga as próximas células que vão fechar como perigo permanente', () => {
    const state = stateFromText(ROOM, [{ id: 1, col: 3, row: 2 }]);
    expect(buildHazards(state).windows.every((w) => w.length === 0)).toBe(true);
    state.round.suddenDeath = true;
    state.round.nextCloseIn = 10;
    const hazards = buildHazards(state);
    expect(hazards.windows[1 * 7 + 1]![0]![0]).toBe(10);
    expect(hazards.windows[1 * 7 + 2]![0]![0]).toBe(10 + SUDDEN_DEATH_INTERVAL_TICKS);
    expect(hazards.windows[2 * 7 + 3]!.length).toBe(1); // 14 células à frente alcançam o miolo desta salinha
  });
});
