import { describe, expect, it } from 'vitest';
import { DEFAULT_BOMB_RANGE } from '../../src/config/bombs';
import { BOMB_RANGE_CAP, MAX_BOMBS_CAP, SPEED_ITEMS_CAP, SPEED_PER_ITEM } from '../../src/config/items';
import { PLAYER_SPEED, TICKS_PER_SECOND } from '../../src/config/simulation';
import {
  applyItem,
  cellIndex,
  collidesAt,
  createAi,
  createGameState,
  createRng,
  drainEvents,
  generateHiddenItems,
  movePlayer,
  step,
  stepDistanceOf,
} from '../../src/core';
import type { Direction, GameState, ItemKind } from '../../src/core';
import { addBomb, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const HALL = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

describe('sorteio dos itens escondidos', () => {
  it('é reproduzível: a mesma semente esconde os mesmos itens, nos mesmos blocos', () => {
    for (const seed of [1, 7, 42]) {
      const a = createGameState({ seed });
      const b = createGameState({ seed });
      expect(a.hiddenItems).toEqual(b.hiddenItems);
      expect(a.hiddenItems.length).toBeGreaterThan(0);
    }
  });

  it('sementes diferentes dão distribuições diferentes', () => {
    const a = createGameState({ seed: 1 }).hiddenItems;
    const b = createGameState({ seed: 2 }).hiddenItems;
    expect(a).not.toEqual(b);
  });

  it('todo item escondido está num bloco, uma vez só por célula, com tipo válido', () => {
    for (const seed of SEEDS) {
      const state = createGameState({ seed });
      const seen = new Set<number>();
      for (const item of state.hiddenItems) {
        const index = cellIndex(state.arena, item.col, item.row);
        expect(state.arena.cells[index], `semente ${seed}`).toBe('block');
        expect(seen.has(index)).toBe(false);
        seen.add(index);
        expect(['bomb', 'range', 'speed', 'kick', 'pierce', 'remote', 'throw', 'ghost', 'invert', 'slow', 'vest', 'hero']).toContain(item.kind);
      }
      expect(state.items).toEqual([]);
    }
  });

  it('a fração de blocos com item fica perto da chance configurada, e os doze tipos aparecem', () => {
    let blocks = 0;
    let withItem = 0;
    const kinds = new Set<ItemKind>();
    for (const seed of SEEDS) {
      const state = createGameState({ seed });
      blocks += state.arena.cells.filter((c) => c === 'block').length;
      withItem += state.hiddenItems.length;
      for (const item of state.hiddenItems) kinds.add(item.kind);
    }
    expect(withItem / blocks).toBeGreaterThan(0.1);
    expect(withItem / blocks).toBeLessThan(0.2);
    expect(kinds.size).toBe(12); // os doze tipos aparecem
    expect(withItem / blocks).toBeGreaterThan(0.1);
  });

  it('arena simétrica: blocos espelhados escondem exatamente o mesmo item (justo para os dois lados)', () => {
    for (const seed of SEEDS) {
      const state = createGameState({ seed, players: 2, symmetric: true });
      const total = state.arena.cells.length;
      const kindAt = new Map(state.hiddenItems.map((item) => [cellIndex(state.arena, item.col, item.row), item.kind]));
      for (const [index, kind] of kindAt) {
        const mirror = total - 1 - index;
        if (mirror === index) continue; // célula central
        expect(kindAt.get(mirror), `semente ${seed}, célula ${index}`).toBe(kind);
      }
    }
  });

  it('items: false não esconde nada, e a arena (blocos) continua idêntica', () => {
    const without = createGameState({ seed: 5, items: false });
    const withItems = createGameState({ seed: 5 });
    expect(without.hiddenItems).toEqual([]);
    expect(without.arena).toEqual(withItems.arena);
  });

  it('chance 0 não esconde nada e chance 1 esconde em todos os blocos', () => {
    const { arena } = createGameState({ seed: 3, items: false });
    const blocks = arena.cells.filter((c) => c === 'block').length;
    expect(generateHiddenItems(arena, 3, true, 0)).toHaveLength(0);
    expect(generateHiddenItems(arena, 3, true, 1)).toHaveLength(blocks);
  });
});

describe('revelar: destruir o bloco faz o item aparecer', () => {
  function scenario(): GameState {
    const state = stateFromText(['#######', '#..o.o#', '#######'], [{ id: 1, col: 1, row: 1 }]);
    state.hiddenItems.push({ col: 3, row: 1, kind: 'range' });
    return state;
  }

  it('o item aparece na célula do bloco destruído, no mesmo passo, com o evento', () => {
    const state = scenario();
    addBomb(state, 2, 1, { range: 1 });
    run(state, 1);
    expect(state.items).toEqual([{ col: 3, row: 1, kind: 'range' }]);
    expect(state.hiddenItems).toEqual([]);
    const events = drainEvents(state);
    expect(events).toContainEqual({ type: 'itemSpawned', col: 3, row: 1, kind: 'range' });
  });

  it('bloco sem item não revela nada; o outro item continua escondido', () => {
    const state = scenario();
    state.hiddenItems.push({ col: 5, row: 1, kind: 'bomb' });
    addBomb(state, 2, 1, { range: 1 });
    run(state, 1);
    expect(state.items.map((i) => i.col)).toEqual([3]);
    expect(state.hiddenItems).toEqual([{ col: 5, row: 1, kind: 'bomb' }]);
  });

  it('o item revelado pela própria explosão sobrevive a ela, mas uma NOVA explosão por cima o destrói', () => {
    const state = scenario();
    addBomb(state, 2, 1, { range: 1 });
    run(state, 1);
    expect(state.items).toHaveLength(1); // revelado em plena chama: inteiro
    state.players[0]!.x = 1.5; // continua longe
    addBomb(state, 2, 1, { range: 2, ticksLeft: 1 }); // nova explosão passando por cima do item
    run(state, 1);
    expect(state.items).toHaveLength(0);
    expect(state.events.some((e) => e.type === 'itemDestroyed')).toBe(true);
  });

  it('a explosão destrói o item do chão no caminho, mas não passa a destruir os de fora da cruz', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }]);
    state.items.push({ col: 3, row: 1, kind: 'kick' }, { col: 3, row: 3, kind: 'bomb' });
    addBomb(state, 4, 1, { owner: 2, range: 2 });
    state.players.push({ ...state.players[0]!, id: 2, team: 2, x: 7.5, y: 5.5, spawn: { col: 7, row: 5 } });
    run(state, 1);
    expect(state.items).toEqual([{ col: 3, row: 3, kind: 'bomb' }]);
  });
});

describe('pegar itens', () => {
  function withItem(kind: ItemKind, col = 3, row = 3): GameState {
    const state = stateFromText(HALL, [{ id: 1, col, row }]);
    state.items.push({ col, row, kind });
    return state;
  }

  it('pisar no item o pega: some do chão, soma o efeito e avisa', () => {
    const cases: Array<[ItemKind, (s: GameState) => number, number]> = [
      ['bomb', (s) => s.players[0]!.maxBombs, 2],
      ['range', (s) => s.players[0]!.bombRange, DEFAULT_BOMB_RANGE + 1],
      ['speed', (s) => s.players[0]!.speedBonus, 1],
    ];
    for (const [kind, read, expected] of cases) {
      const state = withItem(kind);
      run(state, 1);
      expect(state.items, kind).toEqual([]);
      expect(read(state), kind).toBe(expected);
      expect(drainEvents(state)).toContainEqual({ type: 'itemPicked', playerId: 1, kind, col: 3, row: 3, changed: true });
    }
  });

  it('só pega quando o CENTRO do corpo entra na célula do item', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 3 }]);
    state.items.push({ col: 3, row: 3, kind: 'bomb' });
    // Andando para a direita, o corpo encosta na célula 3 antes de o centro chegar.
    let touchedWithoutPicking = false;
    for (let i = 0; i < 100 && state.items.length > 0; i++) {
      step(state, { 1: { move: 'right' } });
      if (state.players[0]!.x + 0.45 > 3 && state.players[0]!.x < 3 && state.items.length === 1) touchedWithoutPicking = true;
    }
    expect(touchedWithoutPicking).toBe(true);
    expect(state.items).toEqual([]);
  });

  it('quem morreu não pega item', () => {
    const state = withItem('bomb');
    state.players[0]!.alive = false;
    run(state, 3);
    expect(state.items).toHaveLength(1);
  });

  it('dois jogadores na mesma célula no mesmo passo: o de menor id pega', () => {
    const state = stateFromText(HALL, [
      { id: 1, col: 3, row: 3 },
      { id: 2, col: 3, row: 3 },
    ]);
    state.items.push({ col: 3, row: 3, kind: 'bomb' });
    run(state, 1);
    expect(state.players[0]!.maxBombs).toBe(2);
    expect(state.players[1]!.maxBombs).toBe(1);
  });

  it('inimigos do computador também pegam', () => {
    const state = stateFromText(HALL, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 3, row: 3, team: 0 },
    ]);
    state.items.push({ col: 3, row: 3, kind: 'range' });
    run(state, 1);
    expect(state.players[1]!.bombRange).toBe(DEFAULT_BOMB_RANGE + 1);
  });

  it('limites: no limite o item é gasto sem efeito (changed = false)', () => {
    const state = withItem('bomb');
    state.players[0]!.maxBombs = MAX_BOMBS_CAP;
    run(state, 1);
    expect(state.players[0]!.maxBombs).toBe(MAX_BOMBS_CAP);
    expect(state.items).toEqual([]);
    expect(drainEvents(state)).toContainEqual(expect.objectContaining({ type: 'itemPicked', changed: false }));

    const player = state.players[0]!;
    player.bombRange = BOMB_RANGE_CAP;
    player.speedBonus = SPEED_ITEMS_CAP;
    expect(applyItem(player, 'range')).toBe(false);
    expect(applyItem(player, 'speed')).toBe(false);
    expect(player.bombRange).toBe(BOMB_RANGE_CAP);
    expect(player.speedBonus).toBe(SPEED_ITEMS_CAP);
  });

  it('+bomba permite duas bombas ao mesmo tempo; sem o item, só uma', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }]);
    step(state, { 1: { move: null, placeBomb: true } });
    state.players[0]!.x = 2.5;
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs).toHaveLength(1);

    state.players[0]!.maxBombs = 2;
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs).toHaveLength(2);
  });

  it('+alcance vale só para as bombas colocadas depois; a que já estava no chão não muda', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 1, row: 1 }]);
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs[0]!.range).toBe(DEFAULT_BOMB_RANGE);
    applyItem(state.players[0]!, 'range');
    expect(state.bombs[0]!.range).toBe(DEFAULT_BOMB_RANGE);
    state.players[0]!.maxBombs = 2;
    state.players[0]!.x = 2.5;
    step(state, { 1: { move: null, placeBomb: true } });
    expect(state.bombs[1]!.range).toBe(DEFAULT_BOMB_RANGE + 1);
  });
});

describe('velocidade', () => {
  it('cada item soma SPEED_PER_ITEM células por segundo ao passo do jogador', () => {
    const state = stateFromText(HALL);
    const player = state.players[0]!;
    expect(stepDistanceOf(player)).toBeCloseTo(PLAYER_SPEED / TICKS_PER_SECOND, 12);
    player.speedBonus = 2;
    expect(stepDistanceOf(player)).toBeCloseTo((PLAYER_SPEED + 2 * SPEED_PER_ITEM) / TICKS_PER_SECOND, 12);
  });

  it('o jogador com itens anda mais longe no mesmo tempo, e o outro não é afetado', () => {
    const state = stateFromText(HALL, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 1, row: 5 },
    ]);
    state.players[0]!.speedBonus = SPEED_ITEMS_CAP;
    run(state, 20, { 1: { move: 'right' }, 2: { move: 'right' } });
    const slow = state.players[1]!.x - 1.5;
    const fast = state.players[0]!.x - 1.5;
    expect(slow).toBeCloseTo((20 * PLAYER_SPEED) / TICKS_PER_SECOND, 9);
    expect(fast / slow).toBeCloseTo((PLAYER_SPEED + SPEED_ITEMS_CAP * SPEED_PER_ITEM) / PLAYER_SPEED, 6);
  });

  it('com velocidade máxima o corpo nunca invade parede, bloco ou bomba (passeio aleatório)', () => {
    const rng = createRng(99);
    const dirs: Direction[] = ['up', 'down', 'left', 'right'];
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = createGameState({ seed });
      const player = state.players[0]!;
      player.speedBonus = SPEED_ITEMS_CAP;
      let move: Direction = 'right';
      for (let t = 0; t < 3000; t++) {
        if (t % 17 === 0) move = dirs[Math.floor(rng() * 4)]!;
        step(state, { 1: { move, placeBomb: t % 211 === 0 } });
        state.events.length = 0;
        if (!player.alive) {
          player.alive = true;
          state.round.phase = 'playing';
        }
        const blocked = new Set(state.bombs.filter((b) => !b.walkThrough.includes(1)).map((b) => cellIndex(state.arena, b.col, b.row)));
        expect(collidesAt(state.arena, player.x, player.y, blocked), `semente ${seed}, passo ${t}`).toBe(false);
      }
    }
  });

  it('movePlayer encosta na parede sem atravessar mesmo com passo grande', () => {
    const state = stateFromText(HALL, [{ id: 1, col: 4, row: 3 }]);
    const player = state.players[0]!;
    player.speedBonus = SPEED_ITEMS_CAP;
    for (let i = 0; i < 60; i++) movePlayer(state.arena, player, 'right');
    expect(player.x).toBeCloseTo(5 + 1 - 0.45, 9);
  });
});

describe('IA e itens', () => {
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];

  it('o inimigo vai buscar um item no chão que está por perto (sem bloco no caminho)', () => {
    const state = stateFromText(OPEN, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 7, row: 5, team: 0 },
    ]);
    state.items.push({ col: 5, row: 5, kind: 'range' });
    state.players[0]!.alive = true;
    const ai = createAi(2, 'normal', 1);
    let picked = false;
    for (let t = 0; t < 400 && !picked; t++) {
      step(state, { 2: ai.decide(state) });
      picked = drainEvents(state).some((e) => e.type === 'itemPicked' && e.playerId === 2);
      state.players[0]!.alive = true;
      state.round.phase = 'playing';
    }
    expect(picked).toBe(true);
    expect(state.players[1]!.bombRange).toBe(DEFAULT_BOMB_RANGE + 1);
  });

  it('com velocidade máxima a IA não "treme" no centro das células: contra alvo imortal nunca se mata', () => {
    // Regressão: com passo maior que o dobro da tolerância, ela ia e voltava sobre o centro e morria na bomba.
    for (const difficulty of ['normal', 'expert'] as const) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const state = createGameState({ seed, players: 1, enemies: 1 });
        state.players[1]!.speedBonus = SPEED_ITEMS_CAP;
        state.players[1]!.maxBombs = 2;
        const ai = createAi(2, difficulty, seed);
        for (let t = 0; t < 2500; t++) {
          state.players[0]!.alive = true;
          state.round.phase = 'playing';
          step(state, { 2: ai.decide(state) });
          state.events.length = 0;
          expect(state.players[1]!.alive, `${difficulty}, semente ${seed}, passo ${t}`).toBe(true);
        }
      }
    }
  }, 120_000);
});
