import { describe, expect, it } from 'vitest';
import { BOMB_FUSE_TICKS, REMOTE_FUSE_TICKS, REVIVE_SHIELD_TICKS, SIDELINE_MOVE_TICKS } from '../../src/config/bombs';
import { INVERT_TICKS, MIN_SPEED_BONUS } from '../../src/config/items';
import {
  applyItem,
  buildHazards,
  cellIndex,
  createAi,
  inwardDirection,
  nearestRingIndex,
  ringCells,
  ringStep,
  slideProjection,
  step,
  stepDistanceOf,
} from '../../src/core';
import type { GameState } from '../../src/core';
import { addBomb, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const HALL = ['#########', '#.......#', '#.#.#.#.#', '#.......#', '#.#.#.#.#', '#.......#', '#########'];
const WIDE = ['###########', '#.........#', '#.........#', '#.........#', '###########'];
const CORRIDOR = ['###########', '#.........#', '###########'];
const ONE_ROW = ['###########', '#.........#', '###########'];

/** Três jogadores: 1 e 2 humanos, 3 é do computador. */
function trio(): GameState {
  return stateFromText(HALL, [
    { id: 1, col: 1, row: 1 },
    { id: 2, col: 7, row: 5 },
    { id: 3, col: 4, row: 3, team: 0 },
  ]);
}

describe('bomba-relógio: só a primeira bomba', () => {
  it('a primeira é relógio; enquanto ela existir, as outras são normais; depois que some, a próxima volta a ser relógio', () => {
    const state = stateFromText(ONE_ROW, [{ id: 1, col: 1, row: 1, maxBombs: 3 }]);
    const p = state.players[0]!;
    p.remote = true;
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs[0]).toMatchObject({ remote: true, ticksLeft: REMOTE_FUSE_TICKS - 1 });
    run(state, 20, { 1: { move: 'right' } });
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs).toHaveLength(2);
    expect(state.bombs[1]).toMatchObject({ remote: false });
    expect(state.bombs[1]!.ticksLeft).toBeLessThan(BOMB_FUSE_TICKS + 1);
    // Detona a relógio: ela some; a próxima bomba colocada volta a ser relógio.
    p.x = 9.5; // longe da cruz da bomba, para sobreviver à explosão
    p.y = 1.5;
    step(state, { 1: { move: null, special: true } });
    run(state, 3);
    expect(state.bombs.some((b) => b.remote)).toBe(false);
    state.flames = [];
    state.bombs = [];
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs[0]).toMatchObject({ remote: true });
  });
});

describe('itens ruins', () => {
  it('controles invertidos: esquerda vira direita, por INVERT_TICKS passos; depois volta ao normal', () => {
    const state = stateFromText(ONE_ROW, [{ id: 1, col: 5, row: 1 }]);
    const p = state.players[0]!;
    expect(applyItem(p, 'invert')).toBe(true);
    expect(p.invertTicks).toBe(INVERT_TICKS);
    run(state, 10, { 1: { move: 'right' } });
    expect(p.x).toBeLessThan(5.5); // foi para a esquerda
    p.invertTicks = 1;
    const at = p.x;
    step(state, { 1: { move: 'right' } }); // ainda invertido neste passo
    expect(p.x).toBeLessThan(at);
    const after = p.x;
    step(state, { 1: { move: 'right' } }); // normal
    expect(p.x).toBeGreaterThan(after);
  });

  it('a inversão também vale para cima/baixo; bomba e especial não são invertidos', () => {
    const state = stateFromText(['#####', '#...#', '#...#', '#...#', '#####'], [{ id: 1, col: 2, row: 2 }]);
    const p = state.players[0]!;
    p.invertTicks = 100;
    run(state, 5, { 1: { move: 'up' } });
    expect(p.y).toBeGreaterThan(2.5);
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs).toHaveLength(1);
  });

  it('pedra: tira 1 ponto de velocidade por vez, até o mínimo; no mínimo, gasta o item sem efeito', () => {
    const p = stateFromText(HALL).players[0]!;
    const base = stepDistanceOf(p);
    expect(applyItem(p, 'slow')).toBe(true);
    expect(p.speedBonus).toBe(-1);
    expect(stepDistanceOf(p)).toBeLessThan(base);
    applyItem(p, 'slow');
    expect(p.speedBonus).toBe(MIN_SPEED_BONUS);
    expect(applyItem(p, 'slow')).toBe(false);
    expect(p.speedBonus).toBe(MIN_SPEED_BONUS);
    expect(stepDistanceOf(p)).toBeGreaterThan(0);
    // Um item de velocidade desfaz a pedra.
    applyItem(p, 'speed');
    expect(p.speedBonus).toBe(MIN_SPEED_BONUS + 1);
  });
});

describe('laterais: o anel de borda', () => {
  const arena = stateFromText(HALL).arena;

  it('o anel tem todas as casas da borda, uma vez cada, em sequência de vizinhas', () => {
    const ring = ringCells(arena);
    expect(ring).toHaveLength(2 * (arena.cols + arena.rows) - 4);
    expect(new Set(ring.map((c) => `${c.col},${c.row}`)).size).toBe(ring.length);
    for (const c of ring) expect(c.col === 0 || c.row === 0 || c.col === arena.cols - 1 || c.row === arena.rows - 1).toBe(true);
    ring.forEach((c, i) => {
      const next = ring[(i + 1) % ring.length]!;
      expect(Math.abs(c.col - next.col) + Math.abs(c.row - next.row)).toBe(1);
    });
  });

  it('andar: só segue o anel; nos cantos as duas direções valem; para fora/para dentro não vale', () => {
    expect(ringStep(arena, 0, 'right')).toBe(1);
    expect(ringStep(arena, 0, 'down')).toBe(ringCells(arena).length - 1);
    expect(ringStep(arena, 0, 'up')).toBeNull();
    expect(ringStep(arena, 0, 'left')).toBeNull();
    expect(ringStep(arena, 3, 'down')).toBeNull(); // para dentro da arena
    expect(ringStep(arena, 3, 'left')).toBe(2);
  });

  it('a bomba é jogada para dentro, de qualquer lado', () => {
    const ring = ringCells(arena);
    const indexOf = (col: number, row: number): number => ring.findIndex((c) => c.col === col && c.row === row);
    expect(inwardDirection(arena, indexOf(4, 0))).toBe('down');
    expect(inwardDirection(arena, indexOf(4, 6))).toBe('up');
    expect(inwardDirection(arena, indexOf(0, 3))).toBe('right');
    expect(inwardDirection(arena, indexOf(8, 3))).toBe('left');
  });

  it('a casa do anel mais perto de uma posição', () => {
    const ring = ringCells(arena);
    const at = ring[nearestRingIndex(arena, 4.5, 1.5)]!;
    expect(at).toEqual({ col: 4, row: 0 });
  });
});

describe('laterais: virar jogador das laterais', () => {
  it('quem é eliminado vai para as laterais se a rodada segue em disputa (2 ou mais times vivos)', () => {
    const state = trio();
    state.flames.push({ col: 1, row: 1, ticksLeft: 5 });
    step(state);
    const p1 = state.players[0]!;
    expect(p1.alive).toBe(false);
    expect(p1.sideline).not.toBeNull();
    const cell = ringCells(state.arena)[p1.sideline!]!;
    expect(cell.col === 0 || cell.row === 0).toBe(true);
  });

  it('o computador eliminado também vai para as laterais', () => {
    const cpu = trio();
    cpu.flames.push({ col: 4, row: 3, ticksLeft: 5 });
    step(cpu);
    expect(cpu.players[2]!.alive).toBe(false);
    expect(cpu.players[2]!.sideline).not.toBeNull();
  });

  it('com a opção desligada (sidelineEnabled = false), ninguém vai para as laterais', () => {
    const off = trio();
    off.sidelineEnabled = false;
    off.flames.push({ col: 1, row: 1, ticksLeft: 5 }, { col: 4, row: 3, ticksLeft: 5 });
    step(off);
    expect(off.players.filter((p) => !p.alive)).toHaveLength(2);
    expect(off.players.every((p) => p.sideline === null)).toBe(true);
  });

  it('não vão: jogador solo, e quem é eliminado já decidindo a rodada', () => {
    const solo = stateFromText(HALL);
    solo.flames.push({ col: 1, row: 1, ticksLeft: 5 });
    step(solo);
    expect(solo.players[0]!.sideline).toBeNull();

    const duo = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 7, row: 5 }]);
    duo.flames.push({ col: 1, row: 1, ticksLeft: 5 });
    step(duo);
    expect(duo.round.phase).toBe('ending');
    expect(duo.players[0]!.sideline).toBeNull();
  });

  it('andar no anel: uma casa por vez, com espera de SIDELINE_MOVE_TICKS entre elas', () => {
    const state = trio();
    state.players[0]!.alive = false;
    state.players[0]!.sideline = 4; // (4,0)
    step(state, { 1: { move: 'right' } });
    expect(state.players[0]!.sideline).toBe(5);
    step(state, { 1: { move: 'right' } });
    expect(state.players[0]!.sideline).toBe(5);
    run(state, SIDELINE_MOVE_TICKS, { 1: { move: 'right' } });
    expect(state.players[0]!.sideline).toBe(6);
  });

  it('bomba das laterais: cai 2 casas para dentro, só uma por vez, sem ser relógio nem perfurante', () => {
    const state = trio();
    const p1 = state.players[0]!;
    p1.alive = false;
    p1.sideline = 5; // (5,0)
    p1.bombRange = 3;
    p1.remote = true;
    p1.piercing = true;
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]).toMatchObject({ owner: 1, col: 5, row: 2, range: 3 });
    expect(state.bombs[0]!.remote).toBeFalsy();
    expect(state.bombs[0]!.pierce).toBeFalsy();
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs).toHaveLength(1);
  });
});

describe('laterais: voltar à arena', () => {
  /** P1 nas laterais com uma bomba prestes a explodir em cima do inimigo (P3, em 4,3). */
  function ghostKills(): GameState {
    const state = trio();
    const p1 = state.players[0]!;
    p1.alive = false;
    p1.sideline = 4;
    addBomb(state, 4, 3, { owner: 1, ticksLeft: 1, range: 1 });
    return state;
  }

  it('eliminar alguém com a bomba faz o jogador voltar, na casa dele, protegido; a rodada segue', () => {
    const state = ghostKills();
    step(state);
    const [p1, , p3] = state.players;
    expect(p3!.alive).toBe(false);
    expect(p1!.alive).toBe(true);
    expect(p1!.sideline).toBeNull();
    expect({ col: Math.floor(p1!.x), row: Math.floor(p1!.y) }).toEqual({ col: 1, row: 1 });
    expect(p1!.shieldTicks).toBe(REVIVE_SHIELD_TICKS);
    expect(state.round.phase).toBe('playing'); // sem a volta, só o jogador 2 estaria vivo e a rodada estaria decidida
    expect(state.events.some((e) => e.type === 'playerRevived')).toBe(true);
  });

  it('se a casa de origem está ocupada, volta na livre mais próxima', () => {
    const state = ghostKills();
    state.players[1]!.x = 1.5; // jogador 2 em cima da casa de origem do 1
    state.players[1]!.y = 1.5;
    step(state);
    const p1 = state.players[0]!;
    expect(p1.alive).toBe(true);
    expect(Math.abs(Math.floor(p1.x) - 1) + Math.abs(Math.floor(p1.y) - 1)).toBe(1);
  });

  it('a proteção impede o dano das chamas e acaba depois de REVIVE_SHIELD_TICKS', () => {
    const state = ghostKills();
    step(state);
    state.flames.push({ col: 1, row: 1, ticksLeft: REVIVE_SHIELD_TICKS - 5 });
    run(state, REVIVE_SHIELD_TICKS - 10);
    expect(state.players[0]!.alive).toBe(true);
    state.flames.push({ col: Math.floor(state.players[0]!.x), row: Math.floor(state.players[0]!.y), ticksLeft: 20 });
    run(state, 20);
    expect(state.players[0]!.shieldTicks).toBe(0);
    expect(state.players[0]!.alive).toBe(false);
  });

  it('a bomba que não elimina ninguém não faz voltar; com a rodada já decidida, também não', () => {
    const none = trio();
    none.players[0]!.alive = false;
    none.players[0]!.sideline = 4;
    addBomb(none, 3, 5, { owner: 1, ticksLeft: 1, range: 1 });
    step(none);
    expect(none.players[0]!.alive).toBe(false);

    const ending = ghostKills();
    ending.round.phase = 'ending';
    ending.round.endsAtTick = 1000;
    step(ending);
    expect(ending.players[2]!.alive).toBe(false);
    expect(ending.players[0]!.alive).toBe(false);
  });

  it('quem volta não está mais nas laterais (não anda no anel) e perde os efeitos ruins', () => {
    const state = ghostKills();
    state.players[0]!.invertTicks = 300;
    step(state);
    expect(state.players[0]!.invertTicks).toBe(0);
    const ring = state.players[0]!.sideline;
    step(state, { 1: { move: 'right' } });
    expect(state.players[0]!.sideline).toBe(ring);
  });
});

describe('IA: bombas deslizando e bombas-relógio dos outros', () => {
  it('bomba chutada conta como já estando onde vai parar (projeção do deslize)', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }]);
    addBomb(state, 2, 1, { owner: 1, ticksLeft: 100, range: 1 });
    state.bombs[0]!.slide = { direction: 'right', ticks: 0 };
    expect(slideProjection(state, state.bombs[0]!, 100)).toEqual({ col: 9, row: 1 }); // desliza até a parede
    expect(slideProjection(state, state.bombs[0]!, 4)).toEqual({ col: 2, row: 1 }); // ainda não andou
    expect(slideProjection(state, state.bombs[0]!, 12)).toEqual({ col: 4, row: 1 }); // 5, 10 -> duas casas
    const hazards = buildHazards(state);
    expect(hazards.bombs[0]).toMatchObject({ col: 9, row: 1 });
    expect(hazards.windows[cellIndex(state.arena, 8, 1)]!.length).toBeGreaterThan(0);
    expect(hazards.windows[cellIndex(state.arena, 3, 1)]!.length).toBe(0);
  });

  it('bomba-relógio de outro jogador é perigo permanente (a partir de 40 passos) na cruz; a própria, não', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 9, row: 1, team: 0 }]);
    addBomb(state, 5, 1, { owner: 1, ticksLeft: 500, range: 2 });
    state.bombs[0]!.remote = true;
    const idx = (col: number): number => cellIndex(state.arena, col, 1);
    const asEnemy = buildHazards(state, undefined, 2);
    expect(asEnemy.windows[idx(6)]!.some(([from, to]) => from === 40 && to > 100000)).toBe(true);
    expect(asEnemy.windows[idx(8)]!.length).toBe(0);
    const asOwner = buildHazards(state, undefined, 1);
    expect(asOwner.windows[idx(6)]!.every(([, to]) => to < 100000)).toBe(true);
    const unknown = buildHazards(state);
    expect(unknown.windows[idx(6)]!.every(([, to]) => to < 100000)).toBe(true);
  });

  it('a IA sai da cruz de uma bomba-relógio inimiga em vez de ficar esperando o pavio', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 6, row: 1, team: 0 }]);
    addBomb(state, 5, 1, { owner: 1, ticksLeft: 580, range: 2 });
    state.bombs[0]!.remote = true;
    const ai = createAi(2, 'expert', 1);
    run2(state, ai, 120);
    expect(state.players[1]!.x).toBeGreaterThan(7.5); // fora da cruz (colunas 3 a 7)
  });
});

/** Roda a IA 2 por `ticks` passos. */
function run2(state: GameState, ai: ReturnType<typeof createAi>, ticks: number): void {
  for (let t = 0; t < ticks; t++) step(state, { 2: ai.decide(state) });
}

describe('IA: chutar, arremessar e atravessar blocos', () => {
  it('com o chute, para uma bomba colada nela para longe de si; sem o chute, não chuta', () => {
    const make = (kick: boolean): GameState => {
      const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 5, row: 1, team: 0 }]);
      state.players[1]!.canKick = kick;
      addBomb(state, 4, 1, { owner: 1, ticksLeft: 100, range: 2 });
      return state;
    };
    const kicker = make(true);
    expect(createAi(2, 'expert', 1).decide(kicker).move).toBe('left');
    run2(kicker, createAi(2, 'expert', 1), 20);
    expect(kicker.bombs.some((b) => b.slide || b.col < 4)).toBe(true);

    expect(createAi(2, 'expert', 1).decide(make(false)).move).not.toBe('left');
  });

  it('a bomba chutada vai de verdade até o inimigo e a IA sobrevive', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 5, row: 1, team: 0 }]);
    state.players[1]!.canKick = true;
    addBomb(state, 4, 1, { owner: 1, ticksLeft: 100, range: 2 });
    const ai = createAi(2, 'expert', 1);
    run2(state, ai, 140);
    expect(state.players[1]!.alive).toBe(true);
    expect(state.players[0]!.alive).toBe(false); // a bomba parou colada nele e o pegou
  });

  it('a fácil não usa as habilidades de propósito', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 5, row: 1, team: 0 }]);
    state.players[1]!.canKick = true;
    addBomb(state, 4, 1, { owner: 1, ticksLeft: 100, range: 2 });
    const ai = createAi(2, 'easy', 1);
    for (let t = 0; t < 24; t++) expect(ai.decide(state).move).not.toBe('left');
  });

  it('com o arremesso, em cima da própria bomba, joga-a se o destino pega o inimigo e não pega ela', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 2, row: 1 }, { id: 2, col: 5, row: 1, team: 0 }]);
    const me = state.players[1]!;
    me.canThrow = true;
    me.facing = 'left';
    addBomb(state, 5, 1, { owner: 2, ticksLeft: 100, range: 2, walkThrough: [2] });
    const ai = createAi(2, 'expert', 1);
    expect(ai.decide(state).special).toBe(true);
    step(state, { 2: { move: null, special: true } });
    expect(state.bombs[0]).toMatchObject({ col: 2, row: 1 }); // caiu em cima do inimigo (3 casas para a esquerda)
  });

  it('não arremessa se a explosão no destino pegaria ela mesma', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 2, row: 1 }, { id: 2, col: 5, row: 1, team: 0 }]);
    const me = state.players[1]!;
    me.canThrow = true;
    me.facing = 'left';
    addBomb(state, 5, 1, { owner: 2, ticksLeft: 100, range: 4, walkThrough: [2] });
    expect(createAi(2, 'expert', 1).decide(state).special).toBeFalsy();
  });

  it('com o fantasma, atravessa os blocos em vez de bombardeá-los', () => {
    const state = stateFromText(['###########', '#...oo....#', '###########'], [{ id: 1, col: 9, row: 1 }, { id: 2, col: 1, row: 1, team: 0 }]);
    state.players[1]!.ghostTicks = 480;
    const ai = createAi(2, 'expert', 1);
    for (let t = 0; t < 150 && state.players[1]!.x < 6.5; t++) {
      step(state, { 2: ai.decide(state) });
      expect(state.bombs.length, `passo ${t}`).toBe(0);
    }
    expect(state.players[1]!.x).toBeGreaterThan(6.5);
  });
});

describe('IA: itens ruins e controles invertidos', () => {
  it('não pisa nem busca itens ruins, mas busca os bons', () => {
    const state = stateFromText(WIDE, [{ id: 1, col: 1, row: 2 }, { id: 2, col: 9, row: 2, team: 0 }]);
    state.items.push({ col: 5, row: 2, kind: 'invert' }, { col: 7, row: 1, kind: 'slow' });
    const ai = createAi(2, 'expert', 1);
    run2(state, ai, 400);
    expect(state.items.some((i) => i.kind === 'invert')).toBe(true);
    expect(state.items.some((i) => i.kind === 'slow')).toBe(true);
    expect(state.players[1]!.invertTicks).toBe(0);
    expect(state.players[1]!.speedBonus).toBe(0);
  });

  it('com os controles invertidos, a IA compensa e continua indo para onde quer', () => {
    const state = stateFromText(WIDE, [{ id: 1, col: 1, row: 2 }, { id: 2, col: 9, row: 2, team: 0 }]);
    state.players[1]!.invertTicks = 300;
    const ai = createAi(2, 'expert', 1);
    const before = state.players[1]!.x;
    run2(state, ai, 40);
    expect(state.players[1]!.x).toBeLessThan(before - 1);
  });
});
