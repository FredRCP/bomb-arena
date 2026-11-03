import { describe, expect, it } from 'vitest';
import { BRIDGE_DOWN_TICKS, BRIDGE_WARN_TICKS } from '../../src/config/hazards';
import { POWER_CHARGE_TICKS } from '../../src/config/powers';
import { cellIndex, createGameState, drainEvents, getCell, givePower, step, stepDistanceOf } from '../../src/core';
import type { GameState, PlayerState, PowerKind } from '../../src/core';
import { CHARACTERS } from '../../src/characters/characters';

/** Arena aberta (sem blocos), 2 jogadores; o jogador 1 tem o poder pronto e olha para a direita; o 2 fica longe. */
function setup(kind: PowerKind, extra: Partial<Parameters<typeof createGameState>[0]> = {}): { state: GameState; me: PlayerState; other: PlayerState } {
  const state = createGameState({ seed: 3, players: 2, sideline: false, ...extra });
  for (let i = 0; i < state.arena.cells.length; i++) if (state.arena.cells[i] === 'block') state.arena.cells[i] = 'empty';
  state.hiddenItems = [];
  state.round.phase = 'playing';
  const [me, other] = state.players as [PlayerState, PlayerState];
  me.x = 3.5;
  me.y = 1.5;
  me.facing = 'right';
  other.x = 13.5;
  other.y = 11.5;
  givePower(me, kind);
  me.power!.charge = POWER_CHARGE_TICKS;
  return { state, me, other };
}
const use = (state: GameState, me: PlayerState): void => {
  step(state, { [me.id]: { move: null, placeBomb: false, power: true } } as never);
};

describe('Poderes: carga e personagens', () => {
  it('carrega em 50 s e todos os 14 personagens têm poder', () => {
    expect(POWER_CHARGE_TICKS).toBe(50 * 60);
    expect(CHARACTERS).toHaveLength(14);
    for (const c of CHARACTERS) expect(c.power, c.id).toBeDefined();
    expect(new Set(CHARACTERS.map((c) => c.power)).size).toBe(14);
  });

  it('Fred: teletransporta para uma célula livre e fica invencível por 10 s', () => {
    const { state, me } = setup('shield');
    const from = { x: me.x, y: me.y };
    use(state, me);
    expect(me.shieldTicks).toBeGreaterThan(9 * 60);
    expect(getCell(state.arena, Math.floor(me.x), Math.floor(me.y))).toBe('empty');
    expect(me.x !== from.x || me.y !== from.y).toBe(true);
  });

  it('Filippe: vira fantasma e cria um halo de 3 células de raio: o inimigo é empurrado para fora e não consegue entrar', () => {
    const { state, me, other } = setup('ghost');
    other.x = 5.5;
    other.y = 1.5;
    use(state, me);
    expect(me.ghostTicks).toBeGreaterThan(9 * 60);
    expect(state.halos).toHaveLength(1);
    expect(Math.hypot(other.x - me.x, other.y - me.y)).toBeGreaterThanOrEqual(2.99);
    // tenta voltar andando para cima dele durante o halo: continua fora do círculo
    for (let i = 0; i < 120; i++) {
      step(state, { [other.id]: { move: 'left', placeBomb: false } } as never);
      expect(Math.hypot(other.x - me.x, other.y - me.y)).toBeGreaterThanOrEqual(2.9);
    }
  });

  it('Filippe: o halo some depois de 10 s', () => {
    const { state, me } = setup('ghost');
    use(state, me);
    for (let i = 0; i < 10 * 60 + 5; i++) step(state);
    expect(state.halos ?? []).toHaveLength(0);
  });

  it('Pipoca: atira bombas a 4 células nas direções livres (onde não dá, cai mais perto); sem lugar nenhum não gasta a carga', () => {
    const { state, me } = setup('jump');
    use(state, me);
    const at = (c: number, r: number) => state.bombs.some((b) => b.col === c && b.row === r);
    expect(at(7, 1)).toBe(true); // direita, 4 células
    expect(at(3, 5)).toBe(true); // baixo, 4 células
    expect(state.bombs.length).toBeGreaterThanOrEqual(3);
    expect(me.power!.charge).toBeLessThan(10);
    // cercada por paredes/blocos: nada a fazer, mantém a carga
    const t = setup('jump');
    for (let k = 1; k <= 4; k++) for (const [c, r] of [[3 + k, 1], [3 - k, 1], [3, 1 + k], [3, 1 - k]] as const) if (getCell(t.state.arena, c, r) === 'empty') t.state.arena.cells[cellIndex(t.state.arena, c, r)] = 'block';
    use(t.state, t.me);
    expect(t.state.bombs).toHaveLength(0);
    expect(t.me.power!.charge).toBeGreaterThanOrEqual(POWER_CHARGE_TICKS);
  });

  it('Bolt: corre na velocidade máxima por 10 s', () => {
    const normal = setup('sprint');
    const fast = setup('sprint');
    use(fast.state, fast.me);
    expect(fast.me.sprintTicks).toBeGreaterThan(9 * 60);
    const x0 = fast.me.x;
    const x1 = normal.me.x;
    for (let i = 0; i < 20; i++) {
      step(fast.state, { 1: { move: 'right', placeBomb: false } } as never);
      step(normal.state, { 1: { move: 'right', placeBomb: false } } as never);
    }
    expect(fast.me.x - x0).toBeGreaterThan((normal.me.x - x1) * 1.2);
    expect(stepDistanceOf({ speedBonus: 5 })).toBeGreaterThan(stepDistanceOf({ speedBonus: 0 }));
  });

  it('Musgo: espalha gosma (3 células em cada direção) e só os outros ficam lentos', () => {
    const { state, me, other } = setup('slime');
    me.x = 5.5;
    me.y = 1.5;
    use(state, me);
    expect(state.slime!.length).toBeGreaterThanOrEqual(6);
    expect(state.slime!.every((c) => c.owner === me.id)).toBe(true);
    other.x = 7.5;
    other.y = 1.5; // 2 células à direita dela, em cima da gosma
    step(state);
    expect(other.slowTicks).toBeGreaterThan(0);
    expect(me.slowTicks).toBe(0);
  });

  it('Violeta: fica invisível por 10 s', () => {
    const { state, me } = setup('invisible');
    use(state, me);
    expect(me.invisibleTicks).toBeGreaterThan(9 * 60);
  });

  it('Fagulha: põe 2 bombas que varrem a linha e a coluna inteiras e fica imune às chamas', () => {
    const { state, me } = setup('twinbombs');
    use(state, me);
    expect(state.bombs).toHaveLength(2);
    expect(state.bombs.every((b) => b.range >= 20 && b.pierce)).toBe(true);
    for (let i = 0; i < 300; i++) step(state);
    expect(me.alive).toBe(true);
  });

  it('Nimbo: cria uma neblina que dura 10 s', () => {
    const { state, me } = setup('fog');
    use(state, me);
    expect(state.fog?.ticks).toBeGreaterThan(9 * 60);
    for (let i = 0; i < 10 * 60 + 5; i++) step(state);
    expect(state.fog).toBeUndefined();
  });

  it('Cacau: põe 3 blocos de chocolate na frente, parando no que estiver no caminho', () => {
    const { state, me } = setup('chocolate');
    use(state, me);
    for (const col of [4, 5, 6]) expect(getCell(state.arena, col, 1)).toBe('block');
    expect(state.chocolate).toHaveLength(3);
    const t = setup('chocolate');
    t.state.bombs.push({ owner: 2, col: 5, row: 1, ticksLeft: 5000, range: 1, walkThrough: [] });
    use(t.state, t.me);
    expect(getCell(t.state.arena, 4, 1)).toBe('block');
    expect(getCell(t.state.arena, 5, 1)).toBe('empty');
  });
});

describe('Templo: a ponte que cai', () => {
  const temple = (): GameState => {
    const state = createGameState({ cols: 17, rows: 13, seed: 4, players: 2, sideline: false, hazards: { chasm: true, boulder: true, island: true, bridgeFall: true } });
    state.round.phase = 'playing';
    return state;
  };

  it('avisa, derruba uma das 2 pontes (mata quem está nela) e a refaz 10 s depois', () => {
    const state = temple();
    const fall = state.hazards!.bridgeFall!;
    const bridges = state.hazards!.bridges!;
    expect(new Set(bridges.map((i) => Math.floor(i / 17))).size).toBe(2);
    state.hazards!.boulder!.timer = 99999;
    state.players[1]!.x = 1.5;
    state.players[1]!.y = 1.5;
    fall.timer = 1;
    step(state);
    expect(fall.phase).toBe('warn');
    expect(drainEvents(state).some((e) => e.type === 'bridgeWarn' && e.row === fall.row)).toBe(true);
    const onBridge = bridges.find((i) => Math.floor(i / 17) === fall.row)!;
    const p = state.players[0]!;
    p.x = (onBridge % 17) + 0.5;
    p.y = fall.row + 0.5;
    for (let i = 0; i < BRIDGE_WARN_TICKS; i++) step(state);
    expect(fall.phase).toBe('down');
    expect(getCell(state.arena, onBridge % 17, fall.row)).toBe('hole');
    expect(p.alive).toBe(false);
    for (let i = 0; i < BRIDGE_DOWN_TICKS; i++) {
      state.round.phase = 'playing';
      step(state);
    }
    expect(fall.phase).toBe('idle');
    expect(getCell(state.arena, onBridge % 17, fall.row)).toBe('empty');
  });
});

describe('Egito: dardos', () => {
  it('a fileira da armadilha é sorteada por rodada e fica livre de blocos', () => {
    const rows = new Set<number>();
    for (let seed = 1; seed < 30; seed++) {
      const state = createGameState({ cols: 17, rows: 13, seed, players: 2, hazards: { quicksand: true, dartRow: 9, pyramid: true } });
      const row = state.hazards!.dartTrap!.row;
      rows.add(row);
      for (let col = 1; col < 16; col++) expect(getCell(state.arena, col, row)).not.toBe('block');
    }
    expect(rows.size).toBeGreaterThan(1);
  });
});

describe('Poderes reformulados (lote 54)', () => {
  it('Fagulha: o fogo atravessa blocos e vai até a parede em toda a linha', () => {
    const { state, me } = setup('twinbombs');
    state.arena.cells[cellIndex(state.arena, 8, 1)] = 'block';
    state.arena.cells[cellIndex(state.arena, 11, 1)] = 'block';
    use(state, me);
    for (let i = 0; i < 200 && state.bombs.length > 0; i++) step(state);
    expect(getCell(state.arena, 8, 1)).toBe('empty');
    expect(getCell(state.arena, 11, 1)).toBe('empty');
  });

  it('Van: congela os outros jogadores por 5 s (não andam nem soltam bomba) e depois voltam', () => {
    const { state, me, other } = setup('freeze');
    use(state, me);
    expect(other.frozenTicks).toBeGreaterThan(5 * 60 - 5);
    expect(me.frozenTicks ?? 0).toBe(0);
    const x0 = other.x;
    for (let i = 0; i < 60; i++) step(state, { [other.id]: { move: 'left', placeBomb: true } } as never);
    expect(other.x).toBe(x0);
    expect(state.bombs.filter((b) => b.owner === other.id)).toHaveLength(0);
    for (let i = 0; i < 5 * 60; i++) step(state);
    step(state, { [other.id]: { move: 'left', placeBomb: false } } as never);
    expect(other.x).toBeLessThan(x0);
  });

  it('Wal: 4 itens (3 perto, 1 em qualquer lugar) e escudo de 5 s', () => {
    const { state, me } = setup('stork');
    use(state, me);
    expect(state.items.length).toBe(4);
    expect(me.shieldTicks).toBeGreaterThan(5 * 60 - 5);
    expect(me.shieldTicks).toBeLessThanOrEqual(5 * 60);
  });

  it('Cacau: ganha +2 bombas e ainda constrói os blocos', () => {
    const { state, me } = setup('chocolate');
    const before = me.maxBombs;
    use(state, me);
    expect(me.maxBombs).toBe(before + 2);
    expect(state.chocolate).toHaveLength(3);
  });

  it('Ana: o elefante quebra a fileira inteira e empurra quem está no caminho', () => {
    const { state, me, other } = setup('elephant');
    for (const c of [5, 9, 13]) state.arena.cells[cellIndex(state.arena, c, 1)] = 'block';
    other.x = 8.5;
    other.y = 1.5;
    use(state, me);
    let minGap = 99;
    for (let i = 0; i < 400 && (state.elephants?.length ?? 0) > 0; i++) {
      step(state);
      minGap = Math.min(minGap, other.x - (state.elephants?.[0]?.x ?? 99));
    }
    for (const c of [5, 9, 13]) expect(getCell(state.arena, c, 1)).toBe('empty');
    expect(other.x).toBeGreaterThan(8.5); // foi empurrado
  });
});
