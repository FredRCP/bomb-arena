import { describe, expect, it } from 'vitest';
import { SIDELINE_THROW_DISTANCE, THROW_DISTANCE } from '../../src/config/bombs';
import { findLanding, loseRandomPowerup, ringCells, step } from '../../src/core';
import type { GameState, PlayerState } from '../../src/core';
import { addBomb } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const ROW = ['#############', '#...........#', '#############'];
const HALL = ['#########', '#.......#', '#.#.#.#.#', '#.......#', '#.#.#.#.#', '#.......#', '#########'];

/** Quantos itens permanentes o jogador tem (um por unidade). */
function powerupCount(p: PlayerState): number {
  return (p.vest ? 1 : 0) + (p.maxBombs - 1) + (p.bombRange - 1) + p.speedBonus + [p.canKick, p.piercing, p.remote, p.canThrow].filter(Boolean).length;
}

function thrower(): GameState {
  const state = stateFromText(ROW, [
    { id: 1, col: 1, row: 1 },
    { id: 2, col: 1 + THROW_DISTANCE, row: 1 },
  ]);
  const p1 = state.players[0]!;
  p1.canThrow = true;
  p1.facing = 'right';
  addBomb(state, 1, 1, { ticksLeft: 200, walkThrough: [1] });
  return state;
}

describe('bomba arremessada acerta um jogador', () => {
  it('o atingido perde um item permanente, que aparece no chão da arena', () => {
    const state = thrower();
    const victim = state.players[1]!;
    victim.maxBombs = 3;
    victim.speedBonus = 2;
    victim.canKick = true;
    victim.vest = true;
    const before = powerupCount(victim);
    step(state, { 1: { move: null, special: true } });
    expect(state.bombs[0]!.col).toBe(1 + THROW_DISTANCE);
    expect(powerupCount(victim)).toBe(before - 1);
    expect(state.items).toHaveLength(1);
    const hit = state.events.find((e) => e.type === 'thrownHit');
    expect(hit).toMatchObject({ type: 'thrownHit', playerId: 2, lost: state.items[0]!.kind });
    // O item caiu numa casa livre (não em cima da bomba nem na parede).
    const item = state.items[0]!;
    expect(state.bombs.some((b) => b.col === item.col && b.row === item.row)).toBe(false);
    expect(item.row).toBe(1);
  });

  it('quem não tem item nenhum não perde nada (mas o acerto é avisado)', () => {
    const state = thrower();
    step(state, { 1: { move: null, special: true } });
    expect(state.items).toHaveLength(0);
    expect(state.events.find((e) => e.type === 'thrownHit')).toMatchObject({ playerId: 2, lost: null });
  });

  it('bomba que cai em casa vazia não acerta ninguém', () => {
    const state = thrower();
    state.players[1]!.x = 9.5;
    state.players[1]!.canKick = true;
    step(state, { 1: { move: null, special: true } });
    expect(state.events.some((e) => e.type === 'thrownHit')).toBe(false);
    expect(state.players[1]!.canKick).toBe(true);
    expect(state.items).toHaveLength(0);
  });

  it('o item perdido não pode ser temporário: fantasma e controles invertidos ficam', () => {
    const state = thrower();
    const victim = state.players[1]!;
    victim.ghostTicks = 100;
    victim.invertTicks = 100;
    expect(loseRandomPowerup(state, victim)).toBeNull();
    expect(victim.ghostTicks).toBe(100);
    expect(state.items).toHaveLength(0);
  });

  it('sem casa livre para o item, nada se perde', () => {
    const state = stateFromText(['####', '#..#', '####'], [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 2, row: 1 },
    ]);
    state.items.push({ col: 1, row: 1, kind: 'bomb' }, { col: 2, row: 1, kind: 'range' });
    state.players[1]!.canKick = true;
    expect(loseRandomPowerup(state, state.players[1]!)).toBeNull();
    expect(state.players[1]!.canKick).toBe(true);
  });

  it('é determinístico: a mesma situação perde o mesmo item no mesmo lugar', () => {
    const make = (): GameState => {
      const state = thrower();
      const victim = state.players[1]!;
      victim.maxBombs = 3;
      victim.bombRange = 4;
      victim.speedBonus = 2;
      victim.canKick = true;
      step(state, { 1: { move: null, special: true } });
      return state;
    };
    expect(make().items).toEqual(make().items);
  });
});

describe('bomba arremessada das laterais também acerta', () => {
  it('quem está embaixo de onde a bomba cai perde um item', () => {
    const state = stateFromText(HALL, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 1, row: 5 },
      { id: 3, col: 7, row: 5 },
    ]);
    // O jogador 2 está eliminado e joga da lateral de cima, na coluna 4.
    const out = state.players[1]!;
    out.alive = false;
    const ring = ringCells(state.arena);
    out.sideline = ring.findIndex((c) => c.col === 4 && c.row === 0);
    expect(out.sideline).toBeGreaterThanOrEqual(0);
    const landing = findLanding(state, 4, 0, 'down', SIDELINE_THROW_DISTANCE)!;
    const victim = state.players[2]!;
    victim.x = landing.col + 0.5;
    victim.y = landing.row + 0.5;
    victim.canThrow = true;
    victim.maxBombs = 2;
    const before = powerupCount(victim);
    step(state, { 2: { move: null, placeBomb: true } });
    expect(powerupCount(victim)).toBe(before - 1);
    expect(state.items).toHaveLength(1);
    expect(state.events.find((e) => e.type === 'thrownHit')).toMatchObject({ playerId: 3 });
  });
});
