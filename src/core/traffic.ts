import { TRAFFIC, TRAFFIC_BLOCK_KEEP, TRAFFIC_EFFECTS } from '../config/hazards';
import type { TrafficKind } from '../config/hazards';
import { cellIndex, getCell } from './arena';
import { dropPowerups, revealItem } from './items';
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
      // Parte dos blocos continua na faixa: o veículo os destrói ao passar (e pode revelar um item).
      if (getCell(arena, col, row) === 'block' && rng() >= TRAFFIC_BLOCK_KEEP) arena.cells[cellIndex(arena, col, row)] = 'empty';
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
    const effect = TRAFFIC_EFFECTS[traffic.kind];
    // Frente do veículo, limitada às células livres da faixa (a 1ª e a última são parede).
    const front = Math.min(size - 1.5, Math.max(1.5, lane.dir === 1 ? to : from));
    const cellOf = (along: number, across: number) => (lane.axis === 'row' ? { col: along, row: across } : { col: across, row: along });

    // 1) Blocos no caminho são destruídos.
    for (let k = 1; k < size - 1; k++) {
      if (k + 0.5 < from || k + 0.5 > to) continue;
      const c = cellOf(k, lane.index);
      if (getCell(arena, c.col, c.row) !== 'block') continue;
      arena.cells[cellIndex(arena, c.col, c.row)] = 'empty';
      state.events.push({ type: 'blockDestroyed', col: c.col, row: c.row });
      revealItem(state, c.col, c.row);
    }

    // 2) Bombas: a bola do parquinho as empurra até o fim da linha; os outros veículos as acionam.
    for (const bomb of state.bombs) {
      const along = (lane.axis === 'row' ? bomb.col : bomb.row) + 0.5;
      const across = lane.axis === 'row' ? bomb.row : bomb.col;
      if (across !== lane.index || along < from || along > to) continue;
      if (effect.pushBombs) {
        const target = Math.floor(front);
        const c = cellOf(target, lane.index);
        const taken = state.bombs.some((other) => other !== bomb && other.col === c.col && other.row === c.row);
        if (!taken) {
          bomb.col = c.col;
          bomb.row = c.row;
          bomb.slide = null;
          bomb.walkThrough = [];
        }
      } else if (bomb.ticksLeft > 1) {
        bomb.ticksLeft = 1;
      }
    }

    // 3) Jogadores.
    const carried = (lane.carried ??= []);
    for (const player of state.players) {
      if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
      const along = lane.axis === 'row' ? player.x : player.y;
      const across = lane.axis === 'row' ? player.y : player.x;
      if (carried.includes(player.id)) {
        // Levado na frente do veículo, parado, até o fim da pista.
        if (lane.axis === 'row') {
          player.x = front;
          player.y = lane.index + 0.5;
        } else {
          player.y = front;
          player.x = lane.index + 0.5;
        }
        player.frozenTicks = 9999;
        player.slide = null;
        continue;
      }
      if (Math.floor(across) !== lane.index || along < from || along > to) continue;
      if (effect.kill) {
        player.alive = false;
        state.events.push({ type: 'playerHit', playerId: player.id, killers: [], crushed: true });
        dropPowerups(state, player);
        continue;
      }
      if ((player.frozenTicks ?? 0) > 0 && !effect.carry) continue; // já atordoado por este veículo
      if (effect.carry) carried.push(player.id);
      else player.frozenTicks = Math.max(player.frozenTicks ?? 0, effect.freeze ?? 0);
      if (effect.invert) player.invertTicks = Math.max(player.invertTicks, effect.invert);
      if (effect.slow) player.slowTicks = Math.max(player.slowTicks, effect.slow);
      player.slide = null;
      state.events.push({ type: 'stunned', playerId: player.id });
    }
    const gone = lane.dir === 1 ? from > size : to < 0;
    if (gone) {
      // Quem foi levado até o fim da pista é solto: paralisado pelo tempo do veículo (carros: 3 s; bola: solta na hora).
      for (const player of state.players) {
        if (lane.carried?.includes(player.id)) player.frozenTicks = effect.freeze ?? 0;
      }
      lane.carried = [];
      lane.phase = 'idle';
      const jitter = Math.floor((rng() - 0.5) * cfg.period * 0.3);
      lane.timer = Math.max(120, cfg.period * (traffic.lanes.length > 2 ? 2 : 1) - cfg.warn - trafficRunTicks(traffic.kind, size) + jitter);
    }
  }
}
