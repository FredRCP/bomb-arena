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

  it('Fagulha: joga 7 bombas em casas livres perto dela, com pavios diferentes, e fica imune às chamas', () => {
    const { state, me } = setup('twinbombs');
    use(state, me);
    expect(state.bombs).toHaveLength(7);
    expect(new Set(state.bombs.map((b) => `${b.col},${b.row}`)).size).toBe(7);
    expect(new Set(state.bombs.map((b) => b.ticksLeft)).size).toBeGreaterThan(1);
    expect(state.bombs.every((b) => b.blazing && Math.hypot(b.col + 0.5 - me.x, b.row + 0.5 - me.y) <= 6.01)).toBe(true);
    for (let i = 0; i < 400; i++) step(state);
    expect(me.alive).toBe(true);
  });

  it('Nimbo: cria uma neblina que dura 10 s', () => {
    const { state, me } = setup('fog');
    use(state, me);
    expect(state.fog?.ticks).toBeGreaterThan(9 * 60);
    for (let i = 0; i < 10 * 60 + 5; i++) step(state);
    expect(state.fog).toBeUndefined();
  });

  it('Magnetron: o ímã puxa quem está a até 5 células e derruba 1 powerup dele no cenário', () => {
    const { state, me, other } = setup('magnet');
    other.x = 7.5;
    other.y = 1.5; // 4 células de distância
    other.maxBombs = 3;
    const far = state.players[1]!;
    expect(far).toBe(other);
    const bombs = me.maxBombs;
    use(state, me);
    expect(Math.hypot(other.x - me.x, other.y - me.y)).toBeLessThanOrEqual(3);
    expect(other.maxBombs).toBe(2);
    expect(me.maxBombs).toBe(bombs); // o item não vai para o Magnetron: cai no chão
    expect(state.items.some((item) => item.kind === 'bomb')).toBe(true);
  });

  it('Bolt: o círculo de choque cresce até 5 células e imobiliza por 3 s quem alcança', () => {
    const { state, me, other } = setup('sprint');
    other.x = me.x + 4;
    other.y = me.y;
    use(state, me);
    expect(other.frozenTicks ?? 0).toBe(0); // o círculo ainda não chegou lá
    for (let i = 0; i < 80; i++) step(state);
    expect(other.stunned).toBe(true);
    expect(other.frozenTicks ?? 0).toBeGreaterThan(90);
    expect(me.sprintTicks ?? 0).toBeGreaterThan(0);
  });

  it('Bolt: quem está além de 5 células não leva choque', () => {
    const { state, me, other } = setup('sprint');
    other.x = me.x + 7;
    other.y = me.y;
    use(state, me);
    for (let i = 0; i < 100; i++) step(state);
    expect(other.frozenTicks ?? 0).toBe(0);
  });

  it('Magnetron: quem está além de 5 células, ou com escudo, não é puxado', () => {
    const { state, me, other } = setup('magnet');
    other.x = 11.5;
    other.y = 1.5; // 8 células
    use(state, me);
    expect(other.x).toBe(11.5);
    const second = setup('magnet');
    second.other.x = 6.5;
    second.other.y = 1.5;
    second.other.shieldTicks = 600;
    use(second.state, second.me);
    expect(second.other.x).toBe(6.5);
  });

  it('Pipoca: aparecem 4 sósias que somem em 10 s; uma chama destrói a sósia e dá pontos sem eliminar ninguém', () => {
    const { state, me } = setup('decoys');
    use(state, me);
    expect(state.decoys).toHaveLength(4);
    const decoy = state.decoys![0]!;
    state.flames.push({ col: Math.floor(decoy.x), row: Math.floor(decoy.y), ticksLeft: 30, owners: [2] });
    const events = [] as string[];
    step(state);
    for (const e of drainEvents(state)) events.push(e.type);
    expect(events).toContain('decoyKilled');
    expect(state.decoys).toHaveLength(3);
    expect(state.players.every((p) => p.alive)).toBe(true);
    state.flames.length = 0;
    for (let i = 0; i < 10 * 60 + 5; i++) step(state);
    expect(state.decoys).toHaveLength(0);
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
