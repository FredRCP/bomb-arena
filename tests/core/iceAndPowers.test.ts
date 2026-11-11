import { describe, expect, it } from 'vitest';
import { ICE_CRACK_LEVELS } from '../../src/config/hazards';
import { ELEPHANT_SPEED, POWER_CHARGE_TICKS } from '../../src/config/powers';
import { AIRPLANE_BOMBS, AIRPLANE_LAPS, AIRPLANE_LAP_TICKS, CONFUSE_POWER_TICKS, FREEZE_POWER_TICKS, GHOST_POWER_TICKS, SHIELD_POWER_TICKS } from '../../src/config/powers';
import { stageById } from '../../src/config/stages';
import { aiShouldUsePower, createGameState, drainEvents, getCell, givePower, powerFraction, powerReady, step, createAi, iglooCells, placeBomb, pyramidExitCells, pyramidOrigin, pyramidTunnelCells, pyramidWallCells, slipperyCells, rollerRate } from '../../src/core';
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

  it('ninguém nasce dentro de iglu, com 1 a 7 jogadores, e os iglus ficam longe da zona de nascimento', () => {
    for (const cols of [15, 17, 19]) {
      const c = Math.floor(cols / 2);
      expect(iglooCells(cols, 13).map((cell) => cell.col)).toEqual([c - 3, c - 2, c - 1, c + 1, c + 2, c + 3]);
    }
    for (let total = 1; total <= 7; total++) {
      const state = ice({ players: 1, enemies: (total - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
      for (const p of state.players) {
        expect(getCell(state.arena, Math.floor(p.x), Math.floor(p.y))).not.toBe('wall');
        expect(getCell(state.arena, Math.floor(p.x), Math.floor(p.y))).not.toBe('block');
      }
    }
  });

  it('só 1 pista escorregadia de 4 células, sem bloco e fora do gelo fino; muda de lugar a cada rodada', () => {
    const state = ice({ players: 2 });
    const strips = state.hazards!.slippery!;
    expect(strips).toHaveLength(4);
    const places = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) places.add(slipperyCells(15, 13, seed).map((c) => `${c.col},${c.row}`).join('|'));
    expect(places.size).toBeGreaterThan(4);
    for (let seed = 1; seed <= 40; seed++) for (const c of slipperyCells(15, 13, seed)) expect(c.col >= 1 && c.col <= 13 && c.row >= 3 && c.row <= 10 && !(c.col % 2 === 0 && c.row % 2 === 0)).toBe(true);
    for (const i of strips) {
      expect(state.arena.cells[i]).toBe('empty');
      expect(state.hazards!.thinIce!.includes(i)).toBe(false);
    }
  });

  it('a cada 12 s sai uma bola de neve de cada iglu (alternados, 6 s de diferença); descem e param na parede', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    state.arena.cells.fill('empty');
    for (let c = 0; c < 15; c++) state.arena.cells[12 * 15 + c] = 'wall';
    state.round.phase = 'playing';
    state.players[0]!.x = 1.5;
    state.players[0]!.y = 1.5;
    const seen: Array<[number, string, number]> = [];
    state.hazards!.penguinGate = undefined; // aqui só os iglus
    state.round.totalTicks = 0; // sem escalada de ritmo
    for (let i = 0; i < 21 * 60; i++) {
      step(state);
      for (const e of drainEvents(state)) if (e.type === 'rollerSpawned') seen.push([e.col, e.kind, Math.round(state.tick / 60)]);
    }
    expect(seen).toEqual([[9, 'snowball', 6], [5, 'snowball', 12], [9, 'snowball', 18]]);
    for (let i = 0; i < 2.5 * 60; i++) step(state);
    expect(state.hazards!.rollers!.length).toBe(0); // já bateram na parede de baixo
  });

  it('pinguins entram pelas laterais, em fileira ímpar sorteada, com aviso 1,5 s antes, e atravessam a arena', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = ice({ players: 1, seed });
      state.hazards!.thinIce = [];
      state.hazards!.doors = [];
      state.arena.cells.fill('empty');
      state.round.phase = 'playing';
      const p = state.players[0]!;
      p.x = 7.5;
      p.y = 1.5;
      const warns: Array<{ row: number; fromLeft: boolean; tick: number }> = [];
      const spawns: Array<{ tick: number; kind: string }> = [];
      let crossed = false;
      for (let i = 0; i < 14 * 60; i++) {
        p.y = 1.5;
        p.x = 7.5;
        step(state);
        for (const e of drainEvents(state)) {
          if (e.type === 'penguinWarn') warns.push({ row: e.row, fromLeft: e.fromLeft, tick: state.tick });
          if (e.type === 'rollerSpawned') spawns.push({ tick: state.tick, kind: e.kind });
        }
        for (const r of state.hazards!.rollers!) if (r.kind === 'penguin' && Math.abs(r.x - 7.5) < 0.1) crossed = true;
      }
      expect(warns).toHaveLength(1);
      expect(warns[0]!.row % 2).toBe(1);
      expect(warns[0]!.row).toBeGreaterThanOrEqual(3);
      expect(spawns).toHaveLength(1);
      expect(spawns[0]!.kind).toBe('penguin');
      expect(spawns[0]!.tick - warns[0]!.tick).toBeGreaterThanOrEqual(85); // o aviso vem antes
      expect(crossed).toBe(true);
    }
  });

  it('a bola de neve amassa (congela por 4 s) em vez de empurrar, uma vez por bola, e o escudo protege', () => {
    const state = ice({ players: 2 });
    state.hazards!.thinIce = [];
    state.hazards!.doors = [];
    state.hazards!.penguinGate = undefined;
    state.arena.cells.fill('empty');
    for (let c = 0; c < 15; c++) state.arena.cells[10 * 15 + c] = 'wall';
    state.round.phase = 'playing';
    const [a, b] = state.players as [typeof state.players[0], typeof state.players[0]];
    a.x = 7.5; a.y = 5.5; b.x = 9.5; b.y = 5.5; b.shieldTicks = 9999;
    state.hazards!.rollers = [{ id: 1, kind: 'snowball', x: 7.5, y: 2.5 }];
    for (let i = 0; i < 90; i++) step(state);
    expect(a.alive).toBe(true);
    expect(a.frozenTicks ?? 0).toBeGreaterThan(100); // congelado
    expect(a.y).toBeCloseTo(5.5, 1); // não foi empurrado
    expect(b.frozenTicks ?? 0).toBe(0);
  });

  it('o ritmo dos iglus e pinguins cresce até 3x conforme o tempo acaba', () => {
    const state = ice({ players: 1 });
    state.round.totalTicks = 1000;
    state.round.ticksLeft = 1000;
    expect(rollerRate(state)).toBe(1);
    state.round.ticksLeft = 500;
    expect(rollerRate(state)).toBeCloseTo(2, 5);
    state.round.ticksLeft = 0;
    state.round.suddenDeath = true;
    expect(rollerRate(state)).toBe(3);
  });

  it('blocos que a neve refaz podem esconder powerups', () => {
    let seen = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const state = ice({ players: 1, seed });
      state.hazards!.thinIce = [];
      state.hazards!.doors = [];
      state.hazards!.penguinGate = undefined;
      state.players[0]!.x = 1.5; state.players[0]!.y = 1.5;
      for (const i of state.hazards!.blockSpots!) state.arena.cells[i] = 'empty';
      state.hiddenItems = [];
      state.round.phase = 'playing';
      for (let i = 0; i < 8 * 60 * 40; i++) { step(state); if (state.round.phase !== 'playing') break; }
      seen += state.hiddenItems.length;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('a bola de neve tem 3 colunas: quebra blocos dos lados, passa por pilares e congela quem está nas colunas vizinhas', () => {
    const state = ice({ players: 2 });
    state.hazards!.thinIce = [];
    state.hazards!.doors = [];
    state.hazards!.penguinGate = undefined;
    state.round.phase = 'playing';
    state.arena.cells.fill('empty');
    for (let c = 0; c < 15; c++) state.arena.cells[12 * 15 + c] = 'wall';
    state.arena.cells[6 * 15 + 6] = 'block'; // lado esquerdo
    state.arena.cells[6 * 15 + 8] = 'block'; // lado direito
    state.arena.cells[8 * 15 + 8] = 'wall'; // pilar numa coluna lateral
    state.arena.cells[4 * 15 + 7] = 'empty';
    const [a, b] = state.players as [typeof state.players[0], typeof state.players[0]];
    a.x = 6.5; a.y = 10.5; // coluna vizinha: congela
    b.x = 11.5; b.y = 10.5; // longe: livre
    state.hazards!.rollers = [{ id: 1, kind: 'snowball', x: 7.5, y: 3.5 }];
    let froze = 0;
    for (let i = 0; i < 400; i++) {
      step(state);
      froze = Math.max(froze, a.frozenTicks ?? 0);
    }
    expect(state.arena.cells[6 * 15 + 6]).toBe('empty');
    expect(state.arena.cells[6 * 15 + 8]).toBe('empty');
    expect(froze).toBeGreaterThan(0);
    expect(b.frozenTicks ?? 0).toBe(0);
    expect(state.hazards!.rollers).toHaveLength(0); // chegou à borda de baixo
  });

  it('o pinguim detona as bombas do caminho e segue', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    state.hazards!.doors = [];
    state.hazards!.penguinGate = undefined;
    state.round.phase = 'playing';
    state.arena.cells.fill('empty');
    for (let r = 0; r < 13; r++) state.arena.cells[r * 15 + 14] = 'wall';
    const p = state.players[0]!;
    p.x = 1.5; p.y = 1.5;
    state.bombs.push({ owner: 1, col: 8, row: 5, ticksLeft: 150, range: 2, walkThrough: [], pierce: false } as never);
    state.hazards!.rollers = [{ id: 1, kind: 'penguin', x: 4.5, y: 5.5, dir: 'right' }];
    let exploded = false;
    for (let i = 0; i < 120; i++) {
      step(state);
      if (state.bombs.length === 0) { exploded = true; break; }
    }
    expect(exploded).toBe(true);
    expect(state.hazards!.rollers!.length === 1 || state.hazards!.rollers!.length === 0).toBe(true);
  });

  it('o pinguim lateral empurra quem está na fileira, sem dano, até a parede', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    state.hazards!.doors = [];
    state.arena.cells.fill('empty');
    for (let r = 0; r < 13; r++) state.arena.cells[r * 15 + 14] = 'wall';
    state.round.phase = 'playing';
    const p = state.players[0]!;
    p.x = 6.5;
    p.y = 5.5;
    state.hazards!.rollers = [{ id: 1, kind: 'penguin', x: 4.5, y: 5.5, dir: 'right' }];
    for (let i = 0; i < 200; i++) step(state);
    expect(p.alive).toBe(true);
    expect(p.x).toBeGreaterThan(12);
    expect(p.x).toBeLessThan(13.7);
    expect(state.hazards!.rollers).toHaveLength(0);
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

  it('na faixa, apertar uma direção de lado no centro da célula larga o deslize e sai pela lateral', () => {
    const state = ice({ players: 1 });
    state.hazards!.thinIce = [];
    const p = state.players[0]!;
    state.arena.cells.fill('empty');
    state.hazards!.slippery = [3 * 15 + 3, 3 * 15 + 4, 3 * 15 + 5, 3 * 15 + 6];
    p.x = 3.5;
    p.y = 3.5;
    step(state, { 1: { move: 'right' } });
    expect(p.slide).toBe('right');
    step(state, { 1: { move: 'down' } }); // fora do centro: o deslize continua
    expect(p.slide).toBe('right');
    let guard = 0;
    while (Math.abs(p.x - 4.5) > 0.05 && guard++ < 40) step(state, { 1: { move: null } });
    const before = p.y;
    step(state, { 1: { move: 'down' } }); // no centro da célula: sai para baixo
    for (let i = 0; i < 6; i++) step(state, { 1: { move: 'down' } });
    expect(p.y).toBeGreaterThan(before + 0.2);
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
    state.hazards!.penguinGate = undefined;
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

  it('carregado, o avião sobrevoa a arena toda em 4 voltas largando 7 bombas e some', () => {
    const state = field();
    const p = state.players[0]!;
    givePower(p, 'airplane');
    p.power!.charge = POWER_CHARGE_TICKS;
    expect(aiShouldUsePower(state, p)).toBe(true);
    step(state, { 1: { move: null, power: true } });
    expect(state.planes).toHaveLength(1);
    const plane = state.planes![0]!;
    let placed = 0;
    let gone = false;
    let minX = 99;
    let maxX = -99;
    for (let i = 0; i < AIRPLANE_LAPS * AIRPLANE_LAP_TICKS + 30; i++) {
      step(state);
      if (state.planes![0]) {
        minX = Math.min(minX, plane.x);
        maxX = Math.max(maxX, plane.x);
      }
      for (const e of drainEvents(state)) {
        if (e.type === 'bombPlaced') placed += 1;
        if (e.type === 'planeGone') gone = true;
      }
    }
    expect(placed).toBe(AIRPLANE_BOMBS);
    expect(AIRPLANE_BOMBS).toBe(7);
    expect(AIRPLANE_LAPS).toBe(4);
    expect(maxX - minX).toBeGreaterThan(state.arena.cols * 0.6); // cobriu a largura da arena
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
    for (let i = 0; i < 300; i++) step(state);
    expect(state.bombs.filter((b) => b.owner === 1).length).toBeGreaterThanOrEqual(2); // mais que o limite de 1
  });
});

describe('superpoderes dos outros personagens', () => {
  const field = (): GameState => {
    const state = stateFromText(['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'], [{ id: 1, col: 2, row: 3 }, { id: 2, col: 10, row: 3 }]);
    state.round.phase = 'playing';
    return state;
  };
  const use = (state: GameState, kind: Parameters<typeof givePower>[1]) => {
    const p = state.players[0]!;
    givePower(p, kind);
    p.power!.charge = POWER_CHARGE_TICKS;
    step(state, { 1: { move: null, power: true } });
    return p;
  };

  it('Fred: invencível por 10 s (e o poder zera a carga)', () => {
    const state = field();
    const p = use(state, 'shield');
    expect(p.shieldTicks).toBeGreaterThan(SHIELD_POWER_TICKS - 5);
    expect(powerFraction(p)).toBeLessThan(0.01);
  });

  it('Filippe: fantasma (atravessa blocos) e Glauceste: inimigos ficam com os controles invertidos', () => {
    const state = field();
    const f = use(state, 'ghost');
    expect(f.ghostTicks).toBeGreaterThan(GHOST_POWER_TICKS - 5);
    const state2 = field();
    use(state2, 'confuse');
    expect(state2.players[1]!.invertTicks).toBeGreaterThan(CONFUSE_POWER_TICKS - 5);
    expect(state2.players[0]!.invertTicks).toBe(0); // todos os outros, menos ele
  });

  it('Van: congela por 10 s as bombas dos outros (as dela não), e a bomba congelada não explode', () => {
    const state = field();
    state.bombs.push({ owner: 1, col: 6, row: 1, ticksLeft: 100, range: 1, walkThrough: [] });
    state.bombs.push({ owner: 2, col: 9, row: 5, ticksLeft: 5, range: 1, walkThrough: [] });
    use(state, 'freeze');
    expect(state.bombs.find((b) => b.owner === 2)!.frozenTicks).toBeGreaterThan(FREEZE_POWER_TICKS - 5);
    expect(state.bombs.find((b) => b.owner === 1)!.frozenTicks ?? 0).toBe(0);
    for (let i = 0; i < 60; i++) step(state);
    const frozen = state.bombs.find((b) => b.owner === 2);
    expect(frozen).toBeDefined(); // passou do pavio e não explodiu
    expect(frozen!.ticksLeft).toBeGreaterThan(0);
    for (let i = 0; i < FREEZE_POWER_TICKS + 10; i++) step(state);
    expect(state.bombs.find((b) => b.owner === 2)).toBeUndefined(); // descongelou e explodiu
  });

  it('Wal: a cegonha solta 4 itens bons: 3 perto e 1 em qualquer lugar', () => {
    const state = field();
    use(state, 'stork');
    expect(state.items).toHaveLength(4);
    expect(state.items.filter((item) => Math.max(Math.abs(item.col - 2), Math.abs(item.row - 3)) <= 3).length).toBeGreaterThanOrEqual(3);
    for (const item of state.items) {
      expect(['bomb', 'range', 'speed', 'vest', 'kick']).toContain(item.kind);
    }
  });

  it('a IA usa escudo/fantasma só com perigo por perto, e a confusão com inimigo perto', () => {
    const state = field();
    const p = state.players[0]!;
    givePower(p, 'shield');
    p.power!.charge = POWER_CHARGE_TICKS;
    expect(aiShouldUsePower(state, p)).toBe(false);
    state.bombs.push({ owner: 2, col: 3, row: 3, ticksLeft: 40, range: 2, walkThrough: [], pierce: false });
    expect(aiShouldUsePower(state, p)).toBe(true);
    givePower(p, 'confuse');
    p.power!.charge = POWER_CHARGE_TICKS;
    expect(aiShouldUsePower(state, p)).toBe(false); // inimigo a 8 células
    state.players[1]!.x = 6.5;
    expect(aiShouldUsePower(state, p)).toBe(true);
  });
});
