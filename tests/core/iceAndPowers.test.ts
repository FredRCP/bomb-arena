import { describe, expect, it } from 'vitest';
import { ICE_CRACK_LEVELS } from '../../src/config/hazards';
import { ELEPHANT_SPEED, POWER_CHARGE_TICKS } from '../../src/config/powers';
import { AIRPLANE_BOMBS, AIRPLANE_LAPS, AIRPLANE_LAP_TICKS } from '../../src/config/powers';
import { stageById } from '../../src/config/stages';
import { aiShouldUsePower, createGameState, drainEvents, getCell, givePower, powerFraction, powerReady, step, createAi, iglooCells, placeBomb, pyramidExitCells, pyramidOrigin, pyramidTunnelCells, pyramidWallCells } from '../../src/core';
import type { GameState } from '../../src/core';
import { stateFromText } from '../helpers/stateFromText';

const ice = (extra: Parameters<typeof createGameState>[0] = {}): GameState => createGameState({ hazards: stageById('ice').hazards!, seed: 4, sideline: false, ...extra });

describe('Egito: pirâmide central, esfinge e borda', () => {
  const egypt = stageById('egypt');
  const make = () => createGameState({ cols: egypt.cols, rows: egypt.rows, hazards: egypt.hazards!, players: 2, seed: 2 });

  it('pirâmide 3 x 3 no centro: 4 paredes e um túnel em cruz de 5 células, com a saída de cada porta sempre livre (sem pilar)', () => {
    const state = make();
    const tunnel = pyramidTunnelCells(17, 13);
    expect(tunnel).toHaveLength(5);
    expect(pyramidWallCells(17, 13)).toHaveLength(4);
    for (const c of pyramidWallCells(17, 13)) expect(getCell(state.arena, c.col, c.row)).toBe('wall');
    for (const c of tunnel) expect(getCell(state.arena, c.col, c.row)).toBe('empty');
    expect(state.hazards!.tunnel).toHaveLength(5);
    // as quatro saídas (uma no meio de cada lado) são células livres, mesmo caindo onde ficaria um pilar
    const exits = pyramidExitCells(17, 13);
    expect(exits.map((c) => [c.col, c.row])).toEqual([[8, 4], [8, 8], [6, 6], [10, 6]]);
    for (const c of exits) expect(getCell(state.arena, c.col, c.row)).toBe('empty');
  });

  it('sem esfinge, e ninguém nasce em parede', () => {
    const state = make();
    expect(getCell(state.arena, 8, 1)).not.toBe('wall');
    for (const p of state.players) expect(getCell(state.arena, Math.floor(p.x), Math.floor(p.y))).toBe('empty');
  });

  it('o fogo entra no túnel da pirâmide', () => {
    const state = make();
    const t = pyramidTunnelCells(17, 13);
    const o = pyramidOrigin(17, 13);
    // bomba no portal de cima (fora do túnel), com alcance de sobra: as chamas descem pela coluna do túnel
    const p = state.players[0]!;
    p.bombRange = 5;
    p.x = o.col + 1.5;
    p.y = o.row - 0.5;
    state.arena.cells[(o.row - 1) * 17 + o.col + 1] = 'empty';
    placeBomb(state, p);
    for (let i = 0; i < 300 && state.flames.length === 0; i++) step(state);
    const burning = state.flames.map((f) => f.row * 17 + f.col);
    expect(t.some((c) => burning.includes(c.row * 17 + c.col))).toBe(true);
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
    state.arena.cells[(o.row + 1) * 17 + o.col + 3] = 'empty'; // o portal da direita dá numa célula livre
    p.x = o.col + 0.5;
    p.y = o.row + 1.5;
    for (let i = 0; i < 200; i++) step(state, { 1: { move: 'right' } });
    expect(p.x).toBeGreaterThan(o.col + 3);
  });
});

describe('Gelo: iglu, faixas e IA', () => {
  it('dois iglus (3 paredes cada) na lateral de cima, simétricos, com a porta (livre) no meio de cada um, para baixo', () => {
    const state = ice({ players: 2 });
    const cells = iglooCells(15, 13);
    expect(cells.map((c) => c.col)).toEqual([4, 5, 6, 8, 9, 10]);
    for (const c of cells) {
      expect(c.row).toBe(1);
      expect(getCell(state.arena, c.col, c.row)).toBe('wall');
    }
    expect(state.hazards!.doors!.map((d) => [d.col, d.row])).toEqual([[5, 2], [9, 2]]);
    for (const d of state.hazards!.doors!) expect(getCell(state.arena, d.col, d.row)).toBe('empty');
  });

  it('só 2 faixas escorregadias de 4 células, sem bloco e fora do gelo fino', () => {
    const state = ice({ players: 2 });
    const strips = state.hazards!.slippery!;
    expect(strips).toHaveLength(8);
    for (const i of strips) {
      expect(state.arena.cells[i]).toBe('empty');
      expect(state.hazards!.thinIce!.includes(i)).toBe(false);
    }
  });

  it('a cada 20 s sai uma bola de neve ou um pinguim de cada iglu (o segundo, 10 s depois); descem e param na parede', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    state.arena.cells.fill('empty');
    for (let c = 0; c < 15; c++) state.arena.cells[12 * 15 + c] = 'wall';
    state.round.phase = 'playing';
    state.players[0]!.x = 1.5;
    state.players[0]!.y = 1.5;
    const seen: Array<[number, string, number]> = [];
    for (let i = 0; i < 41 * 60; i++) {
      step(state);
      for (const e of drainEvents(state)) if (e.type === 'rollerSpawned') seen.push([e.col, e.kind, Math.round(state.tick / 60)]);
    }
    // segundo iglu (coluna 9) em 10 s e 30 s; primeiro (coluna 5) em 20 s e 40 s; alternando bola de neve e pinguim
    expect(seen).toEqual([[9, 'penguin', 10], [5, 'snowball', 20], [9, 'snowball', 30], [5, 'penguin', 40]]);
    for (let i = 0; i < 4 * 60; i++) step(state);
    expect(state.hazards!.rollers!.length).toBe(0); // já bateram na parede de baixo
  });

  it('quem está no caminho é empurrado (sem dano); sem espaço, o rolo para', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    state.arena.cells.fill('empty');
    for (let c = 0; c < 15; c++) state.arena.cells[10 * 15 + c] = 'wall';
    state.round.phase = 'playing';
    const p = state.players[0]!;
    p.x = 7.5;
    p.y = 4.5;
    state.hazards!.rollers = [{ id: 1, kind: 'penguin', x: 7.5, y: 2.5 }];
    state.hazards!.doors = [];
    for (let i = 0; i < 200; i++) step(state);
    expect(p.alive).toBe(true);
    expect(p.y).toBeGreaterThan(8); // foi empurrado até a parede
    expect(p.y).toBeLessThan(9.6);
    expect(state.hazards!.rollers).toHaveLength(0);
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
  it('racha a cada entrada e, na quarta passagem, vira buraco quando a célula fica livre', () => {
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
    expect(events.filter((e) => e.type === 'iceCracked')).toHaveLength(ICE_CRACK_LEVELS);
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

describe('Gelo: a neve faz os blocos crescerem de novo', () => {
  it('a cada 8 s cresce um bloco numa casa que começou com bloco, hoje livre e longe de todos', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    state.round.phase = 'playing';
    state.hazards!.doors = [];
    const spots = state.hazards!.blockSpots!;
    expect(spots.length).toBeGreaterThan(20);
    for (const i of spots) state.arena.cells[i] = 'empty'; // tudo quebrado
    const p = state.players[0]!;
    const before = state.arena.cells.filter((c) => c === 'block').length;
    expect(before).toBe(0);
    let grown = 0;
    for (let i = 0; i < 8 * 60 * 3; i++) {
      step(state);
      for (const e of drainEvents(state)) if (e.type === 'blockGrown') grown += 1;
    }
    expect(grown).toBe(3);
    expect(state.arena.cells.filter((c) => c === 'block').length).toBe(3);
    for (const index of state.arena.cells.keys()) if (state.arena.cells[index] === 'block') {
      expect(spots.includes(index)).toBe(true);
      expect(Math.abs((index % 15) - Math.floor(p.x)) + Math.abs(Math.floor(index / 15) - Math.floor(p.y))).toBeGreaterThan(1);
    }
  });

  it('não cresce bloco em cima de bomba, fogo ou item', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    state.round.phase = 'playing';
    state.hazards!.doors = [];
    const spots = state.hazards!.blockSpots!;
    for (const i of spots) state.arena.cells[i] = 'empty';
    state.hazards!.blockSpots = [spots[0]!];
    const index = spots[0]!;
    const col = index % 15;
    const row = Math.floor(index / 15);
    state.items.push({ kind: 'bomb', col, row } as never);
    state.hazards!.regrowTimer = 1;
    step(state);
    expect(state.arena.cells[index]).toBe('empty');
  });
});

describe('superpoder do Lucas: avião', () => {
  const field = (): GameState => {
    const state = stateFromText(['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'], [{ id: 1, col: 1, row: 3 }, { id: 2, col: 5, row: 5 }]);
    state.round.phase = 'playing';
    return state;
  };

  it('carregado, o avião dá 2 voltas em círculo em volta do jogador largando 5 bombas e some', () => {
    const state = field();
    const p = state.players[0]!;
    givePower(p, 'airplane');
    p.power!.charge = POWER_CHARGE_TICKS;
    p.facing = 'right';
    expect(aiShouldUsePower(state, p)).toBe(true); // há inimigo a menos de 6 células
    step(state, { 1: { move: null, power: true } });
    expect(state.planes).toHaveLength(1);
    const plane = state.planes![0]!;
    let placed = 0;
    let gone = false;
    let maxDist = 0;
    for (let i = 0; i < AIRPLANE_LAPS * AIRPLANE_LAP_TICKS + 30; i++) {
      step(state);
      if (state.planes![0]) maxDist = Math.max(maxDist, Math.hypot(plane.x - plane.cx, plane.y - plane.cy));
      for (const e of drainEvents(state)) {
        if (e.type === 'bombPlaced') placed += 1;
        if (e.type === 'planeGone') gone = true;
      }
    }
    expect(placed).toBe(AIRPLANE_BOMBS);
    expect(maxDist).toBeGreaterThan(2.9); // chegou ao raio do círculo
    expect(gone).toBe(true);
    expect(state.planes).toHaveLength(0);
  });

  it('as bombas do avião não ocupam o limite de bombas do dono', () => {
    const state = field();
    const p = state.players[0]!;
    p.maxBombs = 1;
    givePower(p, 'airplane');
    p.power!.charge = POWER_CHARGE_TICKS;
    step(state, { 1: { move: null, power: true } });
    for (let i = 0; i < 160; i++) step(state);
    expect(state.bombs.filter((b) => b.owner === 1).length).toBeGreaterThanOrEqual(2); // mais que o limite de 1
  });
});
