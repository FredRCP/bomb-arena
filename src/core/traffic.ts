import { TRAFFIC } from '../config/hazards';
import type { TrafficKind } from '../config/hazards';
import { cellIndex, getCell } from './arena';
import { dropPowerups } from './items';
import { createRng } from './random';
import type { Arena, GameState, TrafficLane, TrafficState } from './types';

// Tráfego: faixas (fileiras ou colunas) livres de blocos por onde um veículo passa de tempos em tempos, com aviso antes.
// Quem estiver na faixa no instante da passagem é eliminado (escudo e herói protegem). Bombas e itens não são afetados.

/** Faixas de cada tipo de tráfego. Fileiras e colunas ÍMPARES: não têm pilares, então ficam livres de ponta a ponta. */
export function trafficLanes(kind: TrafficKind, cols: number, rows: number): Array<{ axis: 'row' | 'col'; index: number }> {
  const oddMidCol = (cols - 1) / 2 % 2 === 1 ? (cols - 1) / 2 : (cols - 1) / 2 - 1;
  switch (kind) {
    case 'cars':
      return [{ axis: 'row', index: 3 }, { axis: 'row', index: rows - 4 }];
    case 'train':
      return [{ axis: 'row', index: 5 }, { axis: 'col', index: oddMidCol }];
    case 'bulldozer':
      return [{ axis: 'col', index: 3 }, { axis: 'col', index: cols - 4 }];
    case 'ball':
      return [{ axis: 'row', index: 3 }, { axis: 'row', index: rows - 4 }, { axis: 'col', index: 3 }, { axis: 'col', index: cols - 4 }];
    case 'log':
      return [{ axis: 'col', index: 3 }, { axis: 'col', index: oddMidCol }, { axis: 'col', index: cols - 4 }];
  }
}

/** Cria o tráfego e limpa os blocos das faixas. */
export function createTraffic(arena: Arena, kind: TrafficKind, seed: number): TrafficState {
  const cfg = TRAFFIC[kind];
  const rng = createRng(seed * 13 + 3);
  const lanes: TrafficLane[] = trafficLanes(kind, arena.cols, arena.rows).map((lane, i, all) => {
    // Cada faixa começa em um momento diferente (escalonado), para nunca virem todas juntas.
    const stagger = Math.floor((cfg.period / all.length) * i);
    const length = lane.axis === 'row' ? arena.cols : arena.rows;
    for (let k = 1; k < length - 1; k++) {
      const col = lane.axis === 'row' ? k : lane.index;
      const row = lane.axis === 'row' ? lane.index : k;
      if (getCell(arena, col, row) === 'block') arena.cells[cellIndex(arena, col, row)] = 'empty';
    }
    return {
      axis: lane.axis,
      index: lane.index,
      phase: 'idle' as const,
      timer: Math.max(60, cfg.first - cfg.warn + stagger),
      dir: cfg.fixedDir ? (i % 2 === 0 ? 1 : -1) : rng() < 0.5 ? 1 : -1,
      pos: 0,
      look: Math.floor(rng() * 6),
    };
  });
  return { kind, lanes };
}

/** Passos que o veículo leva para atravessar a faixa e sair dela. */
export function trafficRunTicks(kind: TrafficKind, laneLength: number): number {
  const cfg = TRAFFIC[kind];
  return Math.ceil((laneLength + cfg.length) / cfg.speed);
}

/** Trecho da faixa ocupado agora pelo veículo, em células ao longo da faixa: [de, até]. */
export function trafficSpan(kind: TrafficKind, lane: TrafficLane): [number, number] {
  const length = TRAFFIC[kind].length;
  return lane.dir === 1 ? [lane.pos - length, lane.pos] : [lane.pos, lane.pos + length];
}

export function updateTraffic(state: GameState): void {
  const traffic = state.hazards?.traffic;
  if (!traffic || state.round.phase !== 'playing') return;
  const arena = state.arena;
  const cfg = TRAFFIC[traffic.kind];
  const rng = createRng(state.tick * 17 + 11);
  for (const lane of traffic.lanes) {
    const size = lane.axis === 'row' ? arena.cols : arena.rows;
    if (lane.phase === 'idle') {
      lane.timer -= 1;
      if (lane.timer > 0) continue;
      if (!cfg.fixedDir) lane.dir = rng() < 0.5 ? 1 : -1;
      lane.look = Math.floor(rng() * 6);
      lane.phase = 'warn';
      lane.timer = cfg.warn;
      state.events.push({ type: 'trafficWarn', kind: traffic.kind, axis: lane.axis, index: lane.index });
      continue;
    }
    if (lane.phase === 'warn') {
      lane.timer -= 1;
      if (lane.timer > 0) continue;
      lane.phase = 'run';
      lane.pos = lane.dir === 1 ? 0 : size;
      state.events.push({ type: 'trafficGo', kind: traffic.kind, axis: lane.axis, index: lane.index });
      continue;
    }
    lane.pos += lane.dir * cfg.speed;
    const [from, to] = trafficSpan(traffic.kind, lane);
    for (const player of state.players) {
      if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
      const along = lane.axis === 'row' ? player.x : player.y;
      const across = lane.axis === 'row' ? player.y : player.x;
      if (Math.floor(across) !== lane.index || along < from || along > to) continue;
      player.alive = false;
      state.events.push({ type: 'playerHit', playerId: player.id, killers: [], crushed: true });
      dropPowerups(state, player);
    }
    const gone = lane.dir === 1 ? from > size : to < 0;
    if (gone) {
      lane.phase = 'idle';
      const jitter = Math.floor((rng() - 0.5) * cfg.period * 0.3);
      lane.timer = Math.max(120, cfg.period * (traffic.lanes.length > 2 ? 2 : 1) - cfg.warn - trafficRunTicks(traffic.kind, size) + jitter);
    }
  }
}
