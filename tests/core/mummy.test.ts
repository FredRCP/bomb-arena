import { describe, expect, it } from 'vitest';
import { MUMMY_COOLDOWN_TICKS, MUMMY_FIRST_TICKS, MUMMY_OPEN_TICKS, MUMMY_RESPAWN_TICKS, MUMMY_SPEED, MUMMY_WARN_TICKS, MUMMY_WRAP_TICKS } from '../../src/config/hazards';
import { stageById } from '../../src/config/stages';
import { createGameState, drainEvents, getCell, step, updateMummy } from '../../src/core';
import { buildHazards, hasHazard } from '../../src/core/danger';
import type { GameEvent, GameState } from '../../src/core';

const egypt = stageById('egypt');
const make = (seed = 2): GameState => createGameState({ cols: egypt.cols, rows: egypt.rows, hazards: egypt.hazards!, players: 2, seed, sideline: false });

/** Anda até a múmia sair do sarcófago (o relógio é adiantado para o teste não esperar 25 s). */
function withMummy(seed = 2): GameState {
  const state = make(seed);
  state.hazards!.mummy!.timer = 1;
  for (let i = 0; i < 400 && !state.hazards!.mummy!.mummy; i++) step(state);
  return state;
}

describe('Egito: a múmia', () => {
  it('só o Egito tem múmia, e o relógio começa em MUMMY_FIRST_TICKS', () => {
    const state = make();
    expect(state.hazards!.mummy).toBeDefined();
    expect(state.hazards!.mummy!.timer).toBe(MUMMY_FIRST_TICKS);
    expect(state.hazards!.mummy!.mummy).toBeNull();
    const ice = createGameState({ hazards: stageById('ice').hazards!, seed: 4, sideline: false });
    expect(ice.hazards!.mummy).toBeUndefined();
  });

  it('o sarcófago avisa por MUMMY_WARN_TICKS e só então sai a múmia, na mesma célula', () => {
    const state = make();
    state.hazards!.mummy!.timer = 1;
    const events: GameEvent[] = [];
    let warnAt = -1;
    let spawnAt = -1;
    for (let i = 0; i < 300; i++) {
      step(state);
      for (const e of drainEvents(state)) {
        events.push(e);
        if (e.type === 'mummyWarn') warnAt = state.tick;
        if (e.type === 'mummySpawned') spawnAt = state.tick;
      }
    }
    expect(warnAt).toBeGreaterThan(0);
    expect(spawnAt - warnAt).toBe(MUMMY_WARN_TICKS);
    const warn = events.find((e) => e.type === 'mummyWarn') as Extract<GameEvent, { type: 'mummyWarn' }>;
    const spawned = events.find((e) => e.type === 'mummySpawned') as Extract<GameEvent, { type: 'mummySpawned' }>;
    expect([spawned.col, spawned.row]).toEqual([warn.col, warn.row]);
    expect(getCell(state.arena, warn.col, warn.row)).toBe('empty');
  });

  it('o sarcófago nasce longe dos jogadores (3 células ou mais) e o sarcófago some depois de aberto', () => {
    const state = make(5);
    state.hazards!.mummy!.timer = 1;
    step(state);
    const coffin = state.hazards!.mummy!.coffin!;
    expect(coffin).not.toBeNull();
    for (const p of state.players) expect(Math.abs(Math.floor(p.x) - coffin.col) + Math.abs(Math.floor(p.y) - coffin.row)).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < MUMMY_WARN_TICKS + MUMMY_OPEN_TICKS + 2; i++) step(state);
    expect(state.hazards!.mummy!.coffin).toBeNull();
    expect(state.hazards!.mummy!.mummy).not.toBeNull();
  });

  it('anda ao acaso só por células livres (nunca em bloco, parede, túnel da pirâmide ou bomba) e sempre devagar', () => {
    const state = withMummy();
    const tunnel = new Set(state.hazards!.tunnel);
    const visited = new Set<string>();
    let last = { x: state.hazards!.mummy!.mummy!.x, y: state.hazards!.mummy!.mummy!.y };
    for (let i = 0; i < 3000 && state.hazards!.mummy!.mummy; i++) {
      step(state);
      const body = state.hazards!.mummy!.mummy;
      if (!body) break;
      expect(getCell(state.arena, body.col, body.row)).toBe('empty');
      expect(tunnel.has(body.row * state.arena.cols + body.col)).toBe(false);
      expect(Math.hypot(body.x - last.x, body.y - last.y)).toBeLessThanOrEqual(MUMMY_SPEED + 1e-9);
      last = { x: body.x, y: body.y };
      visited.add(`${body.col},${body.row}`);
    }
    expect(visited.size).toBeGreaterThanOrEqual(6); // de fato passeia pela arena
  });

  it('a mesma semente dá o mesmo passeio', () => {
    const run = (): string => {
      const state = withMummy(7);
      const trail: string[] = [];
      for (let i = 0; i < 600; i++) {
        step(state);
        const b = state.hazards!.mummy!.mummy;
        if (b) trail.push(`${b.x.toFixed(3)},${b.y.toFixed(3)}`);
      }
      return trail.join(';');
    };
    expect(run()).toBe(run());
  });

  it('enfaixa quem encosta (parado por 3 s) e não enfaixa o mesmo jogador de novo durante a pausa', () => {
    const state = withMummy();
    const player = state.players[0]!;
    const body = state.hazards!.mummy!.mummy!;
    player.x = body.x;
    player.y = body.y;
    step(state);
    expect(drainEvents(state).some((e) => e.type === 'mummyWrapped' && e.playerId === player.id)).toBe(true);
    expect(player.frozenTicks).toBeGreaterThanOrEqual(MUMMY_WRAP_TICKS - 2);
    // logo depois, ainda encostado: nada de novo enquanto durar a pausa de 5 s
    player.x = state.hazards!.mummy!.mummy!.x;
    player.y = state.hazards!.mummy!.mummy!.y;
    for (let i = 0; i < MUMMY_COOLDOWN_TICKS - 10; i++) {
      step(state);
      player.x = state.hazards!.mummy!.mummy!.x;
      player.y = state.hazards!.mummy!.mummy!.y;
      expect(drainEvents(state).some((e) => e.type === 'mummyWrapped' && e.playerId === player.id)).toBe(false);
    }
  });

  it('escudo e super-herói protegem do enfaixamento', () => {
    const state = withMummy();
    const [a, b] = state.players as [GameState['players'][0], GameState['players'][0]];
    const body = state.hazards!.mummy!.mummy!;
    a.shieldTicks = 300;
    b.heroTicks = 300;
    for (const p of [a, b]) {
      p.x = body.x;
      p.y = body.y;
    }
    step(state);
    expect(drainEvents(state).some((e) => e.type === 'mummyWrapped')).toBe(false);
    expect(a.frozenTicks ?? 0).toBe(0);
    expect(b.frozenTicks ?? 0).toBe(0);
  });

  it('uma explosão na célula dela a desfaz, solta um item bom perto e reinicia o relógio', () => {
    const state = withMummy();
    const body = state.hazards!.mummy!.mummy!;
    const cell = body.progress < 0.5 ? { col: body.col, row: body.row } : { col: body.tcol, row: body.trow };
    state.flames.push({ col: cell.col, row: cell.row, ticksLeft: 20 });
    const itemsBefore = state.items.length;
    drainEvents(state);
    updateMummy(state, 1);
    expect(state.hazards!.mummy!.mummy).toBeNull();
    expect(state.hazards!.mummy!.timer).toBe(MUMMY_RESPAWN_TICKS);
    const events = drainEvents(state);
    expect(events.some((e) => e.type === 'mummyDestroyed' && e.col === cell.col && e.row === cell.row)).toBe(true);
    expect(state.items.length).toBe(itemsBefore + 1);
    const item = state.items[state.items.length - 1]!;
    expect(getCell(state.arena, item.col, item.row)).toBe('empty');
    expect(['bomb', 'range', 'speed', 'kick', 'vest']).toContain(item.kind);
  });

  it('chama em outra célula não a atinge', () => {
    const state = withMummy();
    const body = state.hazards!.mummy!.mummy!;
    state.flames.push({ col: body.col + 5 > state.arena.cols - 2 ? 1 : body.col + 5, row: body.row === 1 ? 3 : 1, ticksLeft: 20 });
    updateMummy(state, 1);
    expect(state.hazards!.mummy!.mummy).not.toBeNull();
  });

  it('depois de desfeita, uma nova sai quando o relógio zera (e o relógio anda mais rápido no fim: rate)', () => {
    const state = withMummy();
    const body = state.hazards!.mummy!.mummy!;
    state.flames.push({ col: body.col, row: body.row, ticksLeft: 20 });
    updateMummy(state, 1);
    const mm = state.hazards!.mummy!;
    expect(mm.timer).toBe(MUMMY_RESPAWN_TICKS);
    mm.coffin = null; // o sarcófago aberto some sozinho; o relógio só conta sem ele
    updateMummy(state, 3);
    expect(mm.timer).toBe(MUMMY_RESPAWN_TICKS - 3);
    mm.timer = 2;
    updateMummy(state, 3);
    expect(mm.coffin).not.toBeNull();
  });

  it('uma bomba posta no caminho faz a múmia dar meia-volta, e ela nunca fica numa célula com bomba', () => {
    const state = withMummy();
    const mm = state.hazards!.mummy!;
    // espera ela estar a caminho de outra célula
    for (let i = 0; i < 600 && !(mm.mummy!.tcol !== mm.mummy!.col || mm.mummy!.trow !== mm.mummy!.row); i++) step(state);
    const body = mm.mummy!;
    const from = { col: body.col, row: body.row };
    const target = { col: body.tcol, row: body.trow };
    expect(target).not.toEqual(from);
    state.bombs.push({ owner: 1, col: target.col, row: target.row, ticksLeft: 5000, range: 1 } as GameState['bombs'][number]);
    updateMummy(state, 1);
    expect({ col: mm.mummy!.tcol, row: mm.mummy!.trow }).toEqual(from);
  });

  it('com a rodada acabada, nada acontece', () => {
    const state = make();
    state.hazards!.mummy!.timer = 1;
    state.round.phase = 'over';
    updateMummy(state, 1);
    expect(state.hazards!.mummy!.coffin).toBeNull();
    expect(state.hazards!.mummy!.timer).toBe(1);
  });

  it('a múmia caça: depois de andar um tempo, está mais perto do jogador do que no começo', () => {
    const state = withMummy(5);
    // Abre o caminho: sem blocos destrutíveis, toda célula livre se alcança.
    state.arena.cells = state.arena.cells.map((c) => (c === 'block' ? 'empty' : c));
    const body = state.hazards!.mummy!.mummy!;
    const prey = state.players[0]!;
    state.players[1]!.alive = false;
    const dist = () => Math.abs(prey.x - body.x) + Math.abs(prey.y - body.y);
    const before = dist();
    for (let i = 0; i < 20 * 60 && !prey.frozenTicks; i++) {
      updateMummy(state, 1);
      state.tick += 1;
    }
    expect(prey.frozenTicks || dist() < before).toBeTruthy();
  });

  it('não caça quem tem escudo (anda ao acaso) e sempre fica em células livres', () => {
    const state = withMummy(5);
    const body = state.hazards!.mummy!.mummy!;
    for (const p of state.players) p.shieldTicks = 99999;
    for (let i = 0; i < 600; i++) {
      updateMummy(state, 1);
      state.tick += 1;
      expect(getCell(state.arena, body.col, body.row)).toBe('empty');
    }
  });

  it('a IA trata a múmia como perigo: a célula dela e as vizinhas ficam marcadas', () => {
    const state = withMummy(5);
    const body = state.hazards!.mummy!.mummy!;
    const hazards = buildHazards(state);
    expect(hasHazard(hazards, body.row * state.arena.cols + body.col)).toBe(true);
  });
});
