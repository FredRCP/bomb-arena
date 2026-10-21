import { describe, expect, it } from 'vitest';
import { BOMB_FUSE_TICKS, GHOST_TICKS, KICK_SLIDE_TICKS, REMOTE_FUSE_TICKS, THROW_DISTANCE } from '../../src/config/bombs';
import { applyItem, createGameState, drainEvents, step } from '../../src/core';
import { addBomb, burning, cells, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const HALL = ['###########', '#.........#', '###########'];

describe('itens-habilidade: pegar', () => {
  it('habilidades valem para sempre; pegar de novo gasta o item sem efeito', () => {
    const state = stateFromText(HALL);
    const p = state.players[0]!;
    for (const [kind, flag] of [['kick', 'canKick'], ['pierce', 'piercing'], ['remote', 'remote'], ['throw', 'canThrow']] as const) {
      expect(p[flag]).toBe(false);
      expect(applyItem(p, kind)).toBe(true);
      expect(p[flag]).toBe(true);
      expect(applyItem(p, kind)).toBe(false);
    }
  });

  it('fantasma dura GHOST_TICKS e pegar de novo renova', () => {
    const p = stateFromText(HALL).players[0]!;
    expect(applyItem(p, 'ghost')).toBe(true);
    expect(p.ghostTicks).toBe(GHOST_TICKS);
    p.ghostTicks = 10;
    expect(applyItem(p, 'ghost')).toBe(true);
    expect(p.ghostTicks).toBe(GHOST_TICKS);
  });
});

describe('explosão perfurante', () => {
  it('atravessa e destrói todos os blocos dentro do alcance; a normal para no primeiro', () => {
    const lines = ['###########', '#.oo.o....#', '###########'];
    const normal = stateFromText(lines);
    addBomb(normal, 1, 1, { range: 6 });
    run(normal, 1);
    expect(burning(normal)).toEqual(cells([1, 1], [2, 1]));

    const pierce = stateFromText(lines);
    addBomb(pierce, 1, 1, { range: 6 });
    pierce.bombs[0]!.pierce = true;
    run(pierce, 1);
    expect(burning(pierce)).toEqual(cells([1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]));
    expect(pierce.arena.cells.filter((c) => c === 'block')).toHaveLength(0);
  });

  it('não atravessa paredes', () => {
    const state = stateFromText(['#######', '#..#..#', '#######']);
    addBomb(state, 1, 1, { range: 5 });
    state.bombs[0]!.pierce = true;
    run(state, 1);
    expect(burning(state)).toEqual(cells([1, 1], [2, 1]));
  });

  it('a bomba colocada por quem tem o item nasce perfurante', () => {
    const state = stateFromText(HALL);
    state.players[0]!.piercing = true;
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs[0]).toMatchObject({ pierce: true, remote: false });
  });
});

describe('bomba-relógio', () => {
  function armed() {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1, bombRange: 1 }]);
    state.players[0]!.remote = true;
    step(state, { 1: { move: null, placeBomb: true } });
    return state;
  }

  it('não explode sozinha no tempo normal; pavio de segurança longo', () => {
    const state = armed();
    expect(state.bombs[0]).toMatchObject({ remote: true, ticksLeft: REMOTE_FUSE_TICKS - 1 });
    state.players[0]!.x = 8.5; // longe do alcance
    run(state, BOMB_FUSE_TICKS + 50);
    expect(state.bombs).toHaveLength(1);
    run(state, REMOTE_FUSE_TICKS);
    expect(state.bombs).toHaveLength(0);
  });

  it('o especial detona no mesmo passo; só o dono detona e só a dele', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 9, row: 1 }]);
    state.players[0]!.remote = true;
    step(state, { 1: { move: null, placeBomb: true } });
    state.players[0]!.x = 6.5;
    step(state, { 2: { move: null, special: true } }); // outro jogador: nada
    expect(state.bombs).toHaveLength(1);
    step(state, { 1: { move: null, special: true } });
    expect(state.bombs).toHaveLength(0);
    expect(burning(state)).toEqual(cells([1, 1], [2, 1]));
    expect(drainEvents(state).filter((e) => e.type === 'bombExploded')).toHaveLength(1);
  });

  it('detona uma por vez, a mais antiga primeiro', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1, maxBombs: 3 }]);
    state.players[0]!.remote = true;
    step(state, { 1: { move: null, placeBomb: true } });
    state.players[0]!.x = 3.5;
    step(state, { 1: { move: null, placeBomb: true } });
    state.players[0]!.x = 7.5;
    expect(state.bombs.map((b) => b.col)).toEqual([1, 3]);
    step(state, { 1: { move: null, special: true } });
    expect(state.bombs.map((b) => b.col)).toEqual([3]);
  });
});

describe('chute', () => {
  it('andar contra a bomba com o item a faz deslizar até bater na parede', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }, { id: 2, col: 9, row: 1 }]);
    state.players[1]!.alive = false;
    state.players[0]!.canKick = true;
    state.players[0]!.x = 2.5;
    addBomb(state, 4, 1, { ticksLeft: 1000 });
    run(state, 60, { 1: { move: 'right' } });
    expect(state.bombs[0]!.col).toBe(9);
    expect(state.bombs[0]!.slide).toBeFalsy();
  });

  it('só chuta quando o corpo está colado na bomba (não de longe)', () => {
    const state = stateFromText(HALL);
    state.players[0]!.canKick = true;
    state.players[0]!.x = 3.2; // na célula 3, ainda a 0,3 da bomba da célula 4
    addBomb(state, 4, 1, { ticksLeft: 1000 });
    run(state, 1, { 1: { move: 'right' } });
    expect(state.bombs[0]!.slide).toBeFalsy();
    expect(drainEvents(state).some((e) => e.type === 'bombKicked')).toBe(false);
  });

  it('sem o item, a bomba não se move', () => {
    const state = stateFromText(HALL);
    state.players[0]!.x = 2.5;
    addBomb(state, 4, 1, { ticksLeft: 1000 });
    run(state, 60, { 1: { move: 'right' } });
    expect(state.bombs[0]!.col).toBe(4);
  });

  function kickScene(extra: (state: ReturnType<typeof stateFromText>) => void) {
    const state = stateFromText(['###########', '#.........#', '###########'], [{ id: 1, col: 1, row: 1 }]);
    state.players[0]!.canKick = true;
    state.players[0]!.x = 2.5;
    addBomb(state, 4, 1, { ticksLeft: 1000 });
    extra(state);
    run(state, 120, { 1: { move: 'right' } });
    return state.bombs.find((b) => b.owner === 1)!.col;
  }

  it('anda uma célula a cada KICK_SLIDE_TICKS', () => {
    const state = stateFromText(['###########', '#.........#', '###########'], [{ id: 1, col: 1, row: 1 }]);
    state.players[0]!.canKick = true;
    state.players[0]!.x = 2.5;
    addBomb(state, 4, 1, { ticksLeft: 1000 });
    run(state, 20, { 1: { move: 'right' } }); // chega e chuta
    const start = state.bombs[0]!.col;
    run(state, KICK_SLIDE_TICKS * 2, {});
    expect(state.bombs[0]!.col).toBe(start + 2);
  });

  it('para antes de outra bomba', () => {
    expect(kickScene((s) => addBomb(s, 8, 1, { owner: 2, ticksLeft: 1000 }))).toBe(7);
  });

  it('para antes de um bloco', () => {
    expect(kickScene((s) => { s.arena.cells[1 * 11 + 7] = 'block'; })).toBe(6);
  });

  it('para antes de um jogador', () => {
    expect(
      kickScene((s) => {
        s.players.push({ ...s.players[0]!, id: 2, team: 2, x: 7.5, canKick: false });
      }),
    ).toBe(6);
  });

  it('bomba chutada continua com o mesmo pavio e explode onde parou', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }]);
    state.players[0]!.canKick = true;
    state.players[0]!.x = 2.5;
    addBomb(state, 3, 1, { ticksLeft: 100 });
    run(state, 30, { 1: { move: 'right' } });
    const left = state.bombs[0]!.ticksLeft;
    expect(left).toBe(70);
    expect(state.bombs[0]!.col).toBeGreaterThan(3);
  });

  it('o evento de chute é emitido uma vez', () => {
    const state = stateFromText(HALL);
    state.players[0]!.canKick = true;
    state.players[0]!.x = 2.5;
    addBomb(state, 4, 1, { ticksLeft: 1000 });
    run(state, 20, { 1: { move: 'right' } });
    expect(drainEvents(state).filter((e) => e.type === 'bombKicked')).toHaveLength(1);
    void KICK_SLIDE_TICKS;
  });
});

describe('arremesso', () => {
  it('o especial em cima da própria bomba a joga THROW_DISTANCE células para onde está olhando', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }]);
    state.players[0]!.canThrow = true;
    state.players[0]!.facing = 'right';
    step(state, { 1: { move: null, placeBomb: true } });
    step(state, { 1: { move: null, special: true } });
    expect(state.bombs[0]).toMatchObject({ col: 1 + THROW_DISTANCE, row: 1 });
    expect(drainEvents(state)).toContainEqual({ type: 'bombThrown', fromCol: 1, fromRow: 1, col: 4, row: 1 });
  });

  it('passa por cima de blocos, e se o destino estiver ocupado segue em frente', () => {
    const state = stateFromText(['#########', '#.ooo...#', '#########'], [{ id: 1, col: 1, row: 1 }]);
    state.arena.cells[1 * 9 + 4] = 'block';
    state.players[0]!.canThrow = true;
    state.players[0]!.facing = 'right';
    step(state, { 1: { move: null, placeBomb: true } });
    step(state, { 1: { move: null, special: true } });
    expect(state.bombs[0]!.col).toBe(5); // 1+3=4 é bloco: cai na seguinte livre
  });

  it('sem espaço à frente tenta mais perto; sem espaço nenhum, não arremessa', () => {
    const near = stateFromText(['#####', '#...#', '#####'], [{ id: 1, col: 1, row: 1 }]);
    near.players[0]!.canThrow = true;
    near.players[0]!.facing = 'right';
    step(near, { 1: { move: null, placeBomb: true } });
    step(near, { 1: { move: null, special: true } });
    expect(near.bombs[0]!.col).toBe(3);

    const none = stateFromText(['###', '#.#', '###'], [{ id: 1, col: 1, row: 1 }]);
    none.players[0]!.canThrow = true;
    step(none, { 1: { move: null, placeBomb: true } });
    step(none, { 1: { move: null, special: true } });
    expect(none.bombs[0]).toMatchObject({ col: 1, row: 1 });
  });

  it('sem o item, nada acontece; o pavio continua', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }]);
    state.players[0]!.facing = 'right';
    step(state, { 1: { move: null, placeBomb: true } });
    step(state, { 1: { move: null, special: true } });
    expect(state.bombs[0]!.col).toBe(1);
    expect(state.bombs[0]!.ticksLeft).toBe(BOMB_FUSE_TICKS - 2);
  });

  it('a direção do olhar é a última direção em que andou', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 3, row: 1 }]);
    run(state, 3, { 1: { move: 'left' } });
    expect(state.players[0]!.facing).toBe('left');
  });
});

describe('fantasma', () => {
  const WALLED = ['#######', '#.ooo.#', '#######'];

  it('com o item atravessa blocos; sem ele não', () => {
    const solid = stateFromText(WALLED);
    run(solid, 120, { 1: { move: 'right' } });
    expect(solid.players[0]!.x).toBeLessThan(2.2);

    const ghost = stateFromText(WALLED);
    ghost.players[0]!.ghostTicks = GHOST_TICKS;
    run(ghost, 120, { 1: { move: 'right' } });
    expect(ghost.players[0]!.x).toBeGreaterThan(5.4);
  });

  it('paredes continuam impedindo', () => {
    const state = stateFromText(['#####', '#.#.#', '#####']);
    state.players[0]!.ghostTicks = 100;
    run(state, 60, { 1: { move: 'right' } });
    expect(state.players[0]!.x).toBeLessThan(1.6);
  });

  it('o tempo acaba, mas com o corpo dentro de um bloco o efeito segue até sair (ninguém fica preso)', () => {
    const state = stateFromText(WALLED);
    state.players[0]!.ghostTicks = 35;
    run(state, 35, { 1: { move: 'right' } }); // o tempo acaba com o corpo dentro dos blocos (x ~ 4,1)
    expect(state.players[0]!.x).toBeGreaterThan(3.8);
    expect(state.players[0]!.ghostTicks).toBeGreaterThan(0);
    // sai pelo outro lado e só então o efeito acaba
    run(state, 200, { 1: { move: 'right' } });
    expect(state.players[0]!.ghostTicks).toBe(0);
    expect(state.players[0]!.x).toBeGreaterThan(5);
  });
});

describe('5 jogadores', () => {
  it('o quinto nasce no centro, com zona livre; no máximo 5 no total', () => {
    const state = createGameState({ seed: 3, players: 2, enemies: 3 });
    expect(state.players).toHaveLength(5);
    expect(state.players[4]).toMatchObject({ x: 7.5, y: 6.5, team: 5, cpu: true });
    for (const row of [5, 6, 7]) expect(state.arena.cells[row * state.arena.cols + 7]).toBe('empty');
    expect(createGameState({ players: 2, enemies: 4 }).players).toHaveLength(5);
    expect(createGameState({ players: 1, enemies: 4 }).players).toHaveLength(5);
  });

  it('com 4 ou menos, a arena não ganha a zona do centro (mesmos blocos de antes)', () => {
    const four = createGameState({ seed: 3, players: 1, enemies: 3 });
    const five = createGameState({ seed: 3, players: 1, enemies: 4 });
    expect(four.arena.cells).not.toEqual(five.arena.cells);
    expect(four.players).toHaveLength(4);
  });
});

describe('partida aleatória com todas as habilidades: invariantes', () => {
  it('ninguém entra em parede; bombas nunca se empilham nem ficam em parede/bloco; nada sai da arena', async () => {
    const { createRng } = await import('../../src/core/random');
    const { collidesAt } = await import('../../src/core/movement');
    const dirs = ['up', 'down', 'left', 'right', null] as const;
    for (let seed = 1; seed <= 8; seed++) {
      const state = createGameState({ seed, players: 2, enemies: 3, roundTicks: 600 });
      for (const p of state.players) {
        Object.assign(p, { canKick: true, canThrow: true, remote: seed % 2 === 0, piercing: seed % 3 === 0, maxBombs: 3, bombRange: 3, ghostTicks: seed % 4 === 0 ? 400 : 0 });
      }
      const rng = createRng(seed * 31);
      const moves = state.players.map(() => dirs[0] as (typeof dirs)[number]);
      for (let t = 0; t < 2500 && state.round.phase !== 'over'; t++) {
        const intents: Record<number, { move: (typeof dirs)[number]; placeBomb: boolean; special: boolean }> = {};
        state.players.forEach((p, i) => {
          if (rng() < 0.08) moves[i] = dirs[Math.floor(rng() * 5)]!;
          intents[p.id] = { move: moves[i]!, placeBomb: rng() < 0.03, special: rng() < 0.04 };
        });
        step(state, intents);
        state.events.length = 0;
        const seen = new Set<string>();
        for (const bomb of state.bombs) {
          const key = `${bomb.col},${bomb.row}`;
          expect(seen.has(key), `semente ${seed}, passo ${t}: duas bombas em ${key}`).toBe(false);
          seen.add(key);
          expect(state.arena.cells[bomb.row * state.arena.cols + bomb.col], `bomba em célula sólida, semente ${seed}, passo ${t}`).toBe('empty');
        }
        for (const p of state.players) {
          if (!p.alive) continue;
          if (p.ghostTicks === 0) expect(collidesAt(state.arena, p.x, p.y), `semente ${seed}, passo ${t}: jogador preso em sólido`).toBe(false);
          expect(p.x).toBeGreaterThan(1);
          expect(p.y).toBeGreaterThan(1);
        }
      }
    }
  });
});
