import { describe, expect, it } from 'vitest';
import { LAVA_FIRST_TICKS, LAVA_WARN_TICKS, VOLCANO_FALL_TICKS, VOLCANO_FIRST_TICKS, VOLCANO_PERIOD_TICKS } from '../../src/config/hazards';
import { createGameState, currentRows, cellIndex, drainEvents, getCell, step, volcanoCells } from '../../src/core';
import type { GameState, HazardOptions } from '../../src/core';

const make = (hazards: HazardOptions, extra: Partial<Parameters<typeof createGameState>[0]> = {}): GameState =>
  createGameState({ cols: 17, rows: 13, hazards, players: 2, seed: 5, sideline: false, ...extra });

describe('Fundo do mar: correnteza', () => {
  it('duas faixas em sentidos opostos, em fileiras ímpares livres, que mudam com a semente', () => {
    const state = make({ currents: true });
    const lanes = state.hazards!.currents!;
    expect(lanes).toHaveLength(2);
    expect(lanes[0]!.dx).toBe(-lanes[1]!.dx);
    for (const lane of lanes) for (const i of lane.cells) expect(state.arena.cells[i]).toBe('empty');
    const set = new Set<string>();
    for (let seed = 1; seed < 20; seed++) set.add(JSON.stringify(currentRows(13, seed)));
    expect(set.size).toBeGreaterThan(3);
  });

  it('empurra quem está na faixa e não quem está fora', () => {
    const state = make({ currents: true });
    state.round.phase = 'playing';
    const lane = state.hazards!.currents![0]!;
    const row = Math.floor(lane.cells[0]! / 17);
    const [a, b] = state.players as [GameState['players'][0], GameState['players'][0]];
    a.x = 8.5;
    a.y = row + 0.5;
    b.x = 8.5;
    b.y = row === 3 ? 4.5 : 2.5; // fora (fileira vizinha de pilares/qualquer outra)
    state.hazards!.currents![1]!.cells = [];
    const startA = a.x;
    for (let i = 0; i < 60; i++) step(state);
    expect(Math.sign(a.x - startA)).toBe(lane.dx);
    expect(Math.abs(a.x - startA)).toBeGreaterThan(1);
  });
});

describe('Fundo do mar: bombas na correnteza', () => {
  it('a bomba em cima da faixa é levada no sentido da corrente, devagar, até bater em algo', () => {
    const state = make({ currents: true });
    state.round.phase = 'playing';
    const lane = state.hazards!.currents![0]!;
    const row = Math.floor(lane.cells[0]! / 17);
    state.hazards!.currents![1]!.cells = [];
    for (const p of state.players) {
      p.x = 1.5;
      p.y = 11.5;
    }
    const startCol = lane.dx > 0 ? 3 : 13;
    state.bombs.push({ owner: 1, col: startCol, row, ticksLeft: 5000, range: 1, walkThrough: [] });
    for (let i = 0; i < 100; i++) step(state);
    const moved = (state.bombs[0]!.col - startCol) * lane.dx;
    expect(moved).toBeGreaterThanOrEqual(2);
    expect(moved).toBeLessThanOrEqual(4); // 1 célula a cada ~33 passos
    for (let i = 0; i < 900; i++) step(state);
    const end = lane.dx > 0 ? 15 : 1;
    expect(state.bombs[0]!.col).toBe(end); // parou na borda da faixa
  });
});

describe('Vulcão', () => {
  const volcano = (): GameState => {
    const state = make({ lava: true, volcano: true });
    state.round.phase = 'playing';
    return state;
  };

  it('tem o vulcão 3 x 3 no meio e a morte súbita volta a fechar a arena', () => {
    const state = volcano();
    for (const c of volcanoCells(17, 13)) expect(getCell(state.arena, c.col, c.row)).toBe('wall');
    state.round.ticksLeft = 1;
    for (let i = 0; i < 20; i++) step(state);
    expect(state.round.suddenDeath).toBe(true);
  });

  it('o rio de lava avisa 2,5 s antes, desce pela coluna de ponta a ponta, mata quem está nela e some', () => {
    const state = volcano();
    const lava = state.hazards!.lava!;
    expect(lava.timer).toBe(LAVA_FIRST_TICKS - LAVA_WARN_TICKS);
    state.players[1]!.x = 15.5;
    state.players[1]!.y = 11.5;
    lava.timer = 1;
    step(state);
    expect(lava.phase).toBe('warn');
    expect(drainEvents(state).some((e) => e.type === 'lavaRiver' && e.col === lava.col)).toBe(true);
    expect(lava.col % 2).toBe(1);
    expect(Math.abs(lava.col - 8)).toBeGreaterThan(1); // nunca na coluna do vulcão
    const p = state.players[0]!;
    p.x = lava.col + 0.5;
    p.y = 6.5;
    state.arena.cells[cellIndex(state.arena, lava.col, 6)] = 'empty';
    lava.dir = 1;
    state.players[1]!.x = 1.5; // fora do caminho
    for (let i = 0; i < LAVA_WARN_TICKS + 1; i++) step(state);
    expect(lava.phase).toBe('flow');
    let killed = false;
    for (let i = 0; i < 400 && lava.phase === 'flow'; i++) {
      step(state);
      if (!p.alive) killed = true;
    }
    expect(killed).toBe(true);
  });

  it('depois de atravessar a arena o rio some e só volta uns 60 s depois do aviso anterior', () => {
    const state = volcano();
    const lava = state.hazards!.lava!;
    lava.phase = 'flow';
    lava.col = 3;
    lava.dir = -1;
    lava.y = state.arena.rows;
    state.players[0]!.x = 15.5;
    state.players[0]!.y = 11.5;
    state.players[1]!.x = 13.5;
    state.players[1]!.y = 11.5;
    for (let i = 0; i < 400 && lava.phase === 'flow'; i++) step(state);
    expect(lava.phase).toBe('idle');
    expect(lava.timer).toBeGreaterThan(60 * 20);
  });

  it('o rio destrói blocos e bombas do caminho e o escudo protege', () => {
    const state = volcano();
    const lava = state.hazards!.lava!;
    lava.phase = 'flow';
    lava.col = 3;
    lava.dir = 1;
    lava.y = 0;
    state.arena.cells[cellIndex(state.arena, 3, 4)] = 'block';
    state.bombs.push({ owner: 2, col: 3, row: 6, ticksLeft: 5000, range: 1, walkThrough: [] });
    const p = state.players[0]!;
    p.x = 3.5;
    p.y = 8.5;
    p.shieldTicks = 5000;
    for (let i = 0; i < 400; i++) step(state);
    expect(getCell(state.arena, 3, 4)).toBe('empty');
    expect(state.bombs.some((b) => b.col === 3 && b.row === 6)).toBe(false);
    expect(p.alive).toBe(true);
  });

  it('a erupção treme, avisa a célula 2 s antes e a bola mata quem está embaixo', () => {
    const state = volcano();
    const v = state.hazards!.volcano!;
    v.timer = 1;
    state.players[1]!.x = 15.5;
    state.players[1]!.y = 11.5;
    step(state);
    expect(drainEvents(state).some((e) => e.type === 'volcanoErupt')).toBe(true);
    // próxima passagem lança a primeira bola
    for (let i = 0; i < 3 && v.shots.length === 0; i++) step(state);
    expect(v.shots.length).toBeGreaterThan(0);
    const shot = v.shots[0]!;
    expect(shot.ticks).toBeGreaterThan(VOLCANO_FALL_TICKS - 10);
    const p = state.players[0]!;
    p.x = shot.col + 0.5;
    p.y = shot.row + 0.5;
    let hit = false;
    for (let i = 0; i < VOLCANO_FALL_TICKS + 2; i++) {
      step(state);
      if (drainEvents(state).some((e) => e.type === 'playerHit' && e.playerId === p.id)) hit = true;
    }
    expect(hit).toBe(true);
    expect(VOLCANO_FIRST_TICKS).toBe(1200);
    expect(VOLCANO_PERIOD_TICKS).toBe(45 * 60); // erupção a cada 45 s
  });

  it('a IA enxerga a célula da bola como perigosa', async () => {
    const { buildHazards } = await import('../../src/core');
    const state = volcano();
    state.hazards!.volcano!.shots.push({ col: 3, row: 3, ticks: 50 });
    const map = buildHazards(state);
    expect(map.windows[cellIndex(state.arena, 3, 3)]!.length).toBeGreaterThan(0);
  });
});

describe('Ilha dos Piratas: canhões', () => {
  it('o canhão lança 3 balas com sombra de 2 s e a bala mata quem está embaixo', () => {
    const state = make({ deck: true, cannons: true });
    state.round.phase = 'playing';
    const cannon = state.hazards!.cannon!;
    state.players[1]!.x = 15.5;
    state.players[1]!.y = 11.5;
    cannon.timer = 1;
    for (let i = 0; i < 3 && cannon.shots.length === 0; i++) step(state);
    expect(cannon.shots.length).toBeGreaterThan(0);
    const shot = cannon.shots[0]!;
    expect(shot.ticks).toBeGreaterThan(100);
    const p = state.players[0]!;
    p.x = shot.col + 0.5;
    p.y = shot.row + 0.5;
    let hit = false;
    let impact = false;
    for (let i = 0; i < 130; i++) {
      step(state);
      for (const e of drainEvents(state)) {
        if (e.type === 'playerHit' && e.playerId === p.id) hit = true;
        if (e.type === 'cannonImpact') impact = true;
      }
    }
    expect(impact).toBe(true);
    expect(hit).toBe(true);
  });
});
