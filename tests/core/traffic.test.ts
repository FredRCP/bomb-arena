import { describe, expect, it } from 'vitest';
import { TRAFFIC } from '../../src/config/hazards';
import type { TrafficKind } from '../../src/config/hazards';
import { STAGES } from '../../src/config/stages';
import { cellIndex, createGameState, drainEvents, getCell, step, trafficLanes, trafficRunTicks } from '../../src/core';
import type { GameState } from '../../src/core';

const KINDS: TrafficKind[] = ['cars', 'train', 'bulldozer', 'ball', 'log'];
const make = (kind: TrafficKind, cols = 17): GameState => {
  const state = createGameState({ cols, rows: 13, hazards: { traffic: kind }, players: 2, seed: 4, sideline: false });
  state.round.phase = 'playing';
  return state;
};

describe('Tráfego (arenas Selva, Pista, Obras, Parquinho e Trem)', () => {
  it('cada tipo cria faixas ímpares, sem blocos, e as arenas novas existem', () => {
    for (const kind of KINDS) {
      const state = make(kind);
      const traffic = state.hazards!.traffic!;
      expect(traffic.lanes.length).toBeGreaterThanOrEqual(2);
      for (const lane of traffic.lanes) {
        expect(lane.index % 2).toBe(1);
        const size = lane.axis === 'row' ? state.arena.cols : state.arena.rows;
        for (let k = 1; k < size - 1; k++) {
          const col = lane.axis === 'row' ? k : lane.index;
          const row = lane.axis === 'row' ? lane.index : k;
          expect(getCell(state.arena, col, row), `${kind} ${lane.axis}${lane.index}`).toBe('empty');
        }
      }
    }
    for (const id of ['jungle', 'racing', 'construction', 'playground', 'train']) expect(STAGES.find((s) => s.id === id)?.available).toBe(true);
  });

  it('a faixa avisa, depois o veículo passa e elimina quem estiver nela; quem está fora sobrevive', () => {
    const state = make('cars');
    const lane = state.hazards!.traffic!.lanes[0]!; // fileira 3, sentido da esquerda para a direita
    const [victim, safe] = state.players;
    victim!.x = 8.5;
    victim!.y = lane.index + 0.5;
    safe!.x = 8.5;
    safe!.y = lane.index + 2.5;
    let warned = false;
    let went = false;
    for (let i = 0; i < 60 * 40 && victim!.alive; i++) {
      step(state);
      for (const e of drainEvents(state)) {
        if (e.type === 'trafficWarn') warned = true;
        if (e.type === 'trafficGo') went = true;
      }
      // a vítima fica parada na faixa: pode ser que o outro carro venha antes; só importa que alguém passe
    }
    expect(warned).toBe(true);
    expect(went).toBe(true);
    expect(victim!.alive).toBe(false);
    expect(safe!.alive).toBe(true);
  });

  it('escudo protege do veículo', () => {
    const state = make('cars');
    const lane = state.hazards!.traffic!.lanes[0]!;
    const p = state.players[0]!;
    p.x = 8.5;
    p.y = lane.index + 0.5;
    for (let i = 0; i < 60 * 30; i++) {
      p.shieldTicks = 10;
      step(state);
    }
    expect(p.alive).toBe(true);
  });

  it('o veículo sai da faixa e ela volta a ficar parada', () => {
    const state = make('bulldozer');
    for (let i = 0; i < 60 * 14 + trafficRunTicks('bulldozer', 13) + 400; i++) step(state);
    const lanes = state.hazards!.traffic!.lanes;
    expect(lanes.some((l) => l.phase === 'idle')).toBe(true);
    expect(TRAFFIC.bulldozer.length).toBeGreaterThan(2);
    expect(trafficLanes('train', 17, 13).some((l) => l.axis === 'col')).toBe(true);
  });

  it('o parquinho (15 colunas) também tem faixas livres', () => {
    const state = make('ball', 15);
    for (const lane of state.hazards!.traffic!.lanes) expect(lane.index % 2).toBe(1);
    expect(getCell(state.arena, 3, 5)).toBe('empty');
    void cellIndex;
  });
});
