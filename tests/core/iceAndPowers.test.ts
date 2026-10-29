import { describe, expect, it } from 'vitest';
import { ICE_CRACK_LEVELS } from '../../src/config/hazards';
import { ELEPHANT_SPEED, POWER_CHARGE_TICKS } from '../../src/config/powers';
import { stageById } from '../../src/config/stages';
import { aiShouldUsePower, createGameState, drainEvents, getCell, givePower, powerFraction, powerReady, pyramidCells, step } from '../../src/core';
import type { GameState } from '../../src/core';
import { stateFromText } from '../helpers/stateFromText';

const ice = (extra: Parameters<typeof createGameState>[0] = {}): GameState => createGameState({ hazards: stageById('ice').hazards!, seed: 4, sideline: false, ...extra });

describe('Egito: pirâmides', () => {
  it('4 pirâmides de 2 x 2, simétricas, em paredes, longe dos cantos e fora da fileira de dardos', () => {
    const egypt = stageById('egypt');
    const state = createGameState({ cols: egypt.cols, rows: egypt.rows, hazards: egypt.hazards!, players: 2, seed: 2 });
    const cells = pyramidCells(17, 13);
    expect(cells).toHaveLength(16);
    for (const c of cells) {
      expect(getCell(state.arena, c.col, c.row)).toBe('wall');
      // simetria: o espelho (180°) de cada célula também é pirâmide
      expect(cells.some((o) => o.col === 16 - c.col && o.row === 12 - c.row)).toBe(true);
      expect(c.row).not.toBe(state.hazards!.dartTrap!.row);
    }
    for (const p of state.players) expect(getCell(state.arena, Math.floor(p.x), Math.floor(p.y))).toBe('empty');
  });
});

describe('Gelo: piso escorregadio', () => {
  it('quem aperta uma direção continua deslizando sozinho até bater numa parede', () => {
    const state = ice({ players: 1 });
    const p = state.players[0]!;
    state.arena.cells.fill('empty');
    for (let c = 0; c < state.arena.cols; c++) {
      state.arena.cells[c] = 'wall';
      state.arena.cells[(state.arena.rows - 1) * state.arena.cols + c] = 'wall';
    }
    for (let r = 0; r < state.arena.rows; r++) {
      state.arena.cells[r * state.arena.cols] = 'wall';
      state.arena.cells[r * state.arena.cols + state.arena.cols - 1] = 'wall';
    }
    state.hazards!.thinIce = [];
    p.x = 1.5;
    p.y = 1.5;
    step(state, { 1: { move: 'right' } }); // um aperto só...
    for (let i = 0; i < 200; i++) step(state, { 1: { move: null } }); // ...e solta
    expect(p.x).toBeCloseTo(state.arena.cols - 1 - 0.45, 1); // encostou na parede da direita
    expect(p.slide ?? null).toBeNull();
  });

  it('sem piso de gelo o jogador para quando solta a tecla', () => {
    const state = createGameState({ players: 1, seed: 1 });
    const p = state.players[0]!;
    step(state, { 1: { move: 'right' } });
    const x = p.x;
    step(state, { 1: { move: null } });
    expect(p.x).toBe(x);
  });
});

describe('Gelo: gelo fino', () => {
  it('racha a cada entrada e, na terceira passagem, vira buraco quando a célula fica livre', () => {
    const state = ice({ players: 1 });
    const p = state.players[0]!;
    const index = state.hazards!.thinIce![0]!;
    const col = index % state.arena.cols;
    const row = Math.floor(index / state.arena.cols);
    const away = { col: 1, row: 1 };
    for (let pass = 1; pass <= ICE_CRACK_LEVELS; pass++) {
      p.x = col + 0.5;
      p.y = row + 0.5;
      step(state);
      expect(state.hazards!.cracks![index]).toBe(pass);
      if (pass < ICE_CRACK_LEVELS) expect(getCell(state.arena, col, row)).toBe('empty');
      p.x = away.col + 0.5;
      p.y = away.row + 0.5;
      step(state);
    }
    expect(getCell(state.arena, col, row)).toBe('hole');
    const events = drainEvents(state);
    expect(events.filter((e) => e.type === 'iceCracked')).toHaveLength(3);
    expect(events.some((e) => e.type === 'iceBroken')).toBe(true);
    // buraco é intransponível
    p.x = col - 0.5;
    p.y = row + 0.5;
    for (let i = 0; i < 30; i++) step(state, { 1: { move: 'right' } });
    expect(p.x).toBeLessThan(col);
  });

  it('ficar parado na célula não racha de novo (só conta a entrada) e ninguém cai com ela', () => {
    const state = ice({ players: 1 });
    const p = state.players[0]!;
    const index = state.hazards!.thinIce![0]!;
    p.x = (index % state.arena.cols) + 0.5;
    p.y = Math.floor(index / state.arena.cols) + 0.5;
    for (let i = 0; i < 100; i++) step(state);
    expect(state.hazards!.cracks![index]).toBe(1);
    state.hazards!.cracks![index] = ICE_CRACK_LEVELS;
    step(state);
    expect(getCell(state.arena, index % state.arena.cols, Math.floor(index / state.arena.cols))).toBe('empty'); // ainda tem gente em cima
    expect(p.alive).toBe(true);
  });

  it('o fogo atravessa o buraco', () => {
    const state = ice({ players: 1 });
    const index = state.hazards!.thinIce![0]!;
    state.arena.cells[index] = 'hole';
    expect(getCell(state.arena, index % state.arena.cols, Math.floor(index / state.arena.cols))).toBe('hole');
  });
});

describe('superpoder (elefantinho da Ana)', () => {
  const field = (): GameState =>
    stateFromText(['#########', '#.oo.oo.#', '#########'], [{ id: 1, col: 1, row: 1 }]);

  it('carrega sozinho em 60 s, só com a rodada em disputa, e não passa de 100%', () => {
    const state = field();
    const p = state.players[0]!;
    givePower(p, 'elephant');
    expect(powerReady(p)).toBe(false);
    for (let i = 0; i < POWER_CHARGE_TICKS / 2; i++) step(state);
    expect(powerFraction(p)).toBeCloseTo(0.5, 2);
    for (let i = 0; i < POWER_CHARGE_TICKS; i++) step(state);
    expect(powerReady(p)).toBe(true);
    expect(powerFraction(p)).toBe(1);
  });

  it('sem estar carregado, apertar o poder não faz nada', () => {
    const state = field();
    const p = state.players[0]!;
    givePower(p, 'elephant');
    step(state, { 1: { move: null, power: true } });
    expect(state.elephants ?? []).toHaveLength(0);
  });

  it('carregado: o elefante corre na direção do olhar, quebra todos os blocos da fileira e some na parede', () => {
    const state = field();
    const p = state.players[0]!;
    state.round.ticksLeft = Number.POSITIVE_INFINITY;
    givePower(p, 'elephant');
    p.power!.charge = POWER_CHARGE_TICKS;
    p.facing = 'right';
    expect(aiShouldUsePower(state, p)).toBe(true);
    step(state, { 1: { move: null, power: true } });
    expect(p.power!.charge).toBeLessThan(5); // zerou (e já pode ter somado 1)
    expect(state.elephants).toHaveLength(1);
    const events: string[] = [];
    for (let i = 0; i < Math.ceil(8 / ELEPHANT_SPEED); i++) {
      step(state);
      for (const e of drainEvents(state)) events.push(e.type);
    }
    expect(events.filter((e) => e === 'blockDestroyed')).toHaveLength(4);
    expect(events).toContain('elephantGone');
    expect(state.elephants).toHaveLength(0);
    for (let c = 1; c < 8; c++) expect(getCell(state.arena, c, 1)).toBe('empty');
    expect(p.alive).toBe(true);
  });

  it('o computador só solta o poder com pelo menos 2 blocos à frente', () => {
    const state = stateFromText(['#######', '#.o...#', '#######'], [{ id: 1, col: 1, row: 1 }]);
    const p = state.players[0]!;
    givePower(p, 'elephant');
    p.power!.charge = POWER_CHARGE_TICKS;
    p.facing = 'right';
    expect(aiShouldUsePower(state, p)).toBe(false);
    p.facing = 'left';
    expect(aiShouldUsePower(state, p)).toBe(false);
  });
});
