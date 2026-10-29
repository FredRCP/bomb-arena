import { describe, expect, it } from 'vitest';
import { ICE_CRACK_LEVELS } from '../../src/config/hazards';
import { ELEPHANT_SPEED, POWER_CHARGE_TICKS } from '../../src/config/powers';
import { stageById } from '../../src/config/stages';
import { aiShouldUsePower, createGameState, drainEvents, getCell, givePower, powerFraction, powerReady, step, createAi, iglooCells, placeBomb, pyramidOrigin, pyramidTunnelCells, pyramidWallCells, sphinxCells } from '../../src/core';
import type { GameState } from '../../src/core';
import { stateFromText } from '../helpers/stateFromText';

const ice = (extra: Parameters<typeof createGameState>[0] = {}): GameState => createGameState({ hazards: stageById('ice').hazards!, seed: 4, sideline: false, ...extra });

describe('Egito: pirâmide central, esfinge e borda', () => {
  const egypt = stageById('egypt');
  const make = () => createGameState({ cols: egypt.cols, rows: egypt.rows, hazards: egypt.hazards!, players: 2, seed: 2 });

  it('pirâmide 5 x 5 no centro: 16 paredes e um túnel em cruz de 9 células com os portais ligados às fileiras livres', () => {
    const state = make();
    const tunnel = pyramidTunnelCells(17, 13);
    expect(tunnel).toHaveLength(9);
    expect(pyramidWallCells(17, 13)).toHaveLength(16);
    for (const c of pyramidWallCells(17, 13)) expect(getCell(state.arena, c.col, c.row)).toBe('wall');
    for (const c of tunnel) expect(getCell(state.arena, c.col, c.row)).toBe('empty');
    expect(state.hazards!.tunnel).toHaveLength(9);
    // portais: a célula de fora de cada ponta do túnel está numa fileira/coluna livre (índice ímpar)
    const o = pyramidOrigin(17, 13);
    expect([o.row - 1, o.row + 5].every((r) => r % 2 === 1)).toBe(true);
    expect([o.col - 1, o.col + 5].every((c) => c % 2 === 1)).toBe(true);
  });

  it('esfinge na fileira de cima, no meio; ninguém nasce em parede', () => {
    const state = make();
    for (const c of sphinxCells(17, 13)) {
      expect(c.row).toBe(1);
      expect(getCell(state.arena, c.col, c.row)).toBe('wall');
    }
    for (const p of state.players) expect(getCell(state.arena, Math.floor(p.x), Math.floor(p.y))).toBe('empty');
  });

  it('ninguém coloca bomba dentro do túnel', () => {
    const state = make();
    const p = state.players[0]!;
    const t = pyramidTunnelCells(17, 13)[0]!;
    p.x = t.col + 0.5;
    p.y = t.row + 0.5;
    expect(placeBomb(state, p)).toBe(false);
  });

  it('dá para atravessar o túnel de um portal ao outro', () => {
    const state = make();
    const p = state.players[0]!;
    state.hazards!.quicksand = [];
    const o = pyramidOrigin(17, 13);
    state.arena.cells[(o.row + 2) * 17 + o.col + 5] = 'empty'; // o portal da direita dá numa célula livre
    p.x = o.col + 0.5;
    p.y = o.row + 2.5;
    for (let i = 0; i < 200; i++) step(state, { 1: { move: 'right' } });
    expect(p.x).toBeGreaterThan(o.col + 5);
  });
});

describe('Gelo: iglu, faixas e IA', () => {
  it('iglu 3 x 3 no centro e só 4 jogadores', () => {
    const state = ice({ players: 2 });
    expect(iglooCells(15, 13)).toHaveLength(9);
    for (const c of iglooCells(15, 13)) expect(getCell(state.arena, c.col, c.row)).toBe('wall');
    expect(stageById('ice').maxPlayers).toBe(4);
  });

  it('as faixas escorregadias são poucas (20 células), sem bloco e fora do gelo fino', () => {
    const state = ice({ players: 2 });
    const strips = state.hazards!.slippery!;
    expect(strips).toHaveLength(20);
    for (const i of strips) {
      expect(state.arena.cells[i]).toBe('empty');
      expect(state.hazards!.thinIce!.includes(i)).toBe(false);
    }
  });

  it('fora das faixas o jogador para quando solta a tecla; na faixa, desliza até sair', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    const p = state.players[0]!;
    state.arena.cells.fill('empty');
    state.hazards!.slippery = [7 * 0 + 3 * 15 + 5, 3 * 15 + 6, 3 * 15 + 7];
    p.x = 3.5;
    p.y = 3.5;
    step(state, { 1: { move: 'right' } });
    step(state, { 1: { move: null } });
    const x = p.x;
    step(state, { 1: { move: null } });
    expect(p.x).toBe(x); // fora da faixa, parou
    p.x = 5.5;
    p.y = 3.5;
    p.slide = null;
    step(state, { 1: { move: 'right' } });
    for (let i = 0; i < 80; i++) step(state, { 1: { move: null } });
    expect(p.x).toBeGreaterThan(8); // escorregou pela faixa inteira e parou ao sair
  });

  it('a IA trata o buraco de gelo como obstáculo (não tenta atravessar)', () => {
    const state = stateFromText(['#######', '#.....#', '#######'], [{ id: 1, col: 1, row: 1 }, { id: 2, col: 4, row: 1 }]);
    state.arena.cells[1 * 7 + 3] = 'hole';
    const ai = createAi(2, 'hard', 1);
    for (let i = 0; i < 60; i++) {
      expect(ai.decide(state).move).not.toBe('left');
      step(state, {});
    }
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
    state.hazards!.slippery = Array.from({ length: state.arena.cols }, (_, c) => state.arena.cols + c); // a fileira 1 inteira
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
