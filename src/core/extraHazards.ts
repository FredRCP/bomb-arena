import { CANNON_FALL_TICKS, CANNON_FIRST_TICKS, CANNON_PERIOD_TICKS, CANNON_SHOT_GAP, CANNON_SHOTS, CURRENT_PUSH, LAVA_FIRST_TICKS, LAVA_LENGTH, LAVA_PERIOD_TICKS, LAVA_SPEED, LAVA_WARN_TICKS, VOLCANO_FALL_TICKS, VOLCANO_FIRST_TICKS, VOLCANO_HIT_HALF, VOLCANO_PERIOD_LATE_TICKS, VOLCANO_PERIOD_TICKS, VOLCANO_SHOT_GAP, VOLCANO_SHOTS } from '../config/hazards';
import { VEST_BREAK_SHIELD_TICKS } from '../config/items';
import { cellIndex, getCell } from './arena';
import { blockedCellsFor, walkThroughCellsFor } from './bombs';
import { dropPowerups, revealItem } from './items';
import { bodyOverlapsCell, movePlayer, stepDistanceOf } from './movement';
import { createRng } from './random';
import type { Arena, Cell, CurrentLane, GameState, HazardsState } from './types';

// Perigos do Fundo do Mar (correnteza) e do Vulcão (lava que escorre, erupções e o vulcão no meio).
// Ficam fora de hazards.ts só para esse arquivo não crescer demais; createHazards/updateHazards chamam estas funções.

/** Quais opções destes perigos uma fase pode ligar (a interface completa está em hazards.ts). */
export interface ExtraHazardOptions {
  currents?: boolean;
  lava?: boolean;
  volcano?: boolean;
  /** Ilha dos Piratas: canhões do navio. */
  cannons?: boolean;
}

/** O vulcão: 3 x 3 de pedra no meio da arena. */
export function volcanoCells(cols: number, rows: number): Cell[] {
  const c = Math.floor(cols / 2);
  const m = Math.floor(rows / 2);
  const out: Cell[] = [];
  for (let row = m - 1; row <= m + 1; row++) for (let col = c - 1; col <= c + 1; col++) out.push({ col, row });
  return out;
}

/** Fileiras (ímpares, sem pilar) das duas correntezas, uma em cima e outra embaixo, e o sentido de cada: sorteados pela semente (muda a cada rodada). */
export function currentRows(rows: number, seed: number): Array<{ row: number; dx: 1 | -1 }> {
  const rng = createRng(seed * 17 + 3);
  const mid = Math.floor(rows / 2);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let row = 3; row <= rows - 4; row += 2) (row < mid ? upper : lower).push(row);
  const first = rng() < 0.5 ? 1 : -1;
  return [
    { row: upper[Math.floor(rng() * upper.length)]!, dx: first as 1 | -1 },
    { row: lower[Math.floor(rng() * lower.length)]!, dx: (-first) as 1 | -1 },
  ];
}

/** Monta o que as fases novas precisam (muda a arena e o estado dos perigos). Chamado no fim de createHazards. */
export function applyExtraHazards(arena: Arena, options: ExtraHazardOptions, seed: number, hazards: HazardsState): void {
  const { cols, rows } = arena;
  if (options.currents) {
    hazards.currents = currentRows(rows, seed).map(({ row, dx }): CurrentLane => {
      const cells: number[] = [];
      for (let col = 1; col < cols - 1; col++) {
        const index = cellIndex(arena, col, row);
        if (arena.cells[index] === 'wall') continue;
        arena.cells[index] = 'empty'; // a faixa aparece inteira desde o começo
        cells.push(index);
      }
      return { cells, dx, dy: 0 };
    });
  }
  if (options.volcano) for (const cell of volcanoCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'wall';
  if (options.lava) hazards.lava = { phase: 'idle', timer: LAVA_FIRST_TICKS - LAVA_WARN_TICKS, col: 0, dir: 1, y: 0 };
  if (options.cannons) hazards.cannon = { phase: 'idle', timer: CANNON_FIRST_TICKS, remaining: 0, gap: 0, shots: [] };
  if (options.volcano || options.lava) hazards.volcano = { phase: 'idle', timer: VOLCANO_FIRST_TICKS, remaining: 0, gap: 0, shots: [] };
}

/** Avança os perigos novos um passo. */
export function updateExtraHazards(state: GameState): void {
  const hz = state.hazards;
  if (!hz) return;
  if (hz.currents) updateCurrents(state, hz.currents);
  if (hz.lava) updateLava(state, hz.lava);
  if (hz.volcano) updateShots(state, hz.volcano, VOLCANO_SHOTS_CFG);
  if (hz.cannon) updateShots(state, hz.cannon, CANNON_CFG);
}

/** Correnteza: quem está numa célula da faixa é levado na direção dela (sem atravessar nada). */
function updateCurrents(state: GameState, lanes: CurrentLane[]): void {
  if (state.round.phase !== 'playing') return;
  const arena = state.arena;
  for (const player of state.players) {
    if (!player.alive) continue;
    const index = cellIndex(arena, Math.floor(player.x), Math.floor(player.y));
    const lane = lanes.find((l) => l.cells.includes(index));
    if (!lane) continue;
    const dir = lane.dx > 0 ? 'right' : lane.dx < 0 ? 'left' : lane.dy > 0 ? 'down' : 'up';
    movePlayer(arena, player, dir, blockedCellsFor(state, player.id), walkThroughCellsFor(state, player.id), CURRENT_PUSH / stepDistanceOf(player));
  }
  // As bombas também são levadas, devagar (uma célula a cada 1/CURRENT_PUSH passos), até algo as parar.
  for (const bomb of state.bombs) {
    if (bomb.slide) continue;
    const index = cellIndex(arena, bomb.col, bomb.row);
    const lane = lanes.find((l) => l.cells.includes(index));
    if (!lane) continue;
    const direction = lane.dx > 0 ? 'right' : 'left';
    const nextCol = bomb.col + Math.sign(lane.dx);
    if (getCell(arena, nextCol, bomb.row) !== 'empty' || state.bombs.some((b) => b.col === nextCol && b.row === bomb.row)) continue;
    if (state.players.some((p) => p.alive && bodyOverlapsCell(p.x, p.y, nextCol, bomb.row))) continue;
    bomb.slide = { direction, ticks: 0, interval: Math.round(1 / CURRENT_PUSH) };
  }
}

/** Colunas por onde o rio de lava pode descer: ímpares (sem pilar), fora das do vulcão do meio. */
export function lavaColumns(cols: number): number[] {
  const mid = Math.floor(cols / 2);
  const out: number[] = [];
  for (let col = 1; col < cols - 1; col += 2) if (Math.abs(col - mid) > 1) out.push(col);
  return out;
}

/** Passos que o rio leva para atravessar a arena e sair dela. */
export function lavaFlowTicks(rows: number): number {
  return Math.ceil((rows + LAVA_LENGTH) / LAVA_SPEED);
}

/** Linhas cobertas pelo rio agora (a frente em `y`; o rio tem LAVA_LENGTH células de comprimento). */
export function lavaRows(lava: NonNullable<HazardsState['lava']>): [number, number] {
  const tail = lava.y - lava.dir * LAVA_LENGTH;
  return [Math.min(lava.y, tail), Math.max(lava.y, tail)];
}

/**
 * Rio de lava: de tempos em tempos uma coluna sorteada pisca (aviso) e a lava desce por ela de ponta a ponta, saindo da arena.
 * Elimina quem estiver nela (escudo e herói protegem) e destrói blocos, bombas e itens do caminho.
 */
function updateLava(state: GameState, lava: NonNullable<HazardsState['lava']>): void {
  if (state.round.phase !== 'playing') return;
  const arena = state.arena;
  if (lava.phase === 'idle') {
    lava.timer -= 1;
    if (lava.timer > 0) return;
    const rng = createRng(state.tick * 29 + 7);
    const options = lavaColumns(arena.cols);
    lava.col = options[Math.floor(rng() * options.length)]!;
    lava.dir = rng() < 0.5 ? 1 : -1;
    lava.phase = 'warn';
    lava.timer = LAVA_WARN_TICKS;
    state.events.push({ type: 'lavaRiver', col: lava.col });
    return;
  }
  if (lava.phase === 'warn') {
    lava.timer -= 1;
    if (lava.timer > 0) return;
    lava.phase = 'flow';
    lava.y = lava.dir === 1 ? 0 : arena.rows;
    return;
  }
  lava.y += lava.dir * LAVA_SPEED;
  const [lo, hi] = lavaRows(lava);
  for (let row = 1; row < arena.rows - 1; row++) {
    if (row + 0.5 < lo || row + 0.5 > hi) continue;
    const col = lava.col;
    const index = cellIndex(arena, col, row);
    if (arena.cells[index] === 'wall') continue;
    if (arena.cells[index] === 'block') {
      arena.cells[index] = 'empty';
      state.events.push({ type: 'blockDestroyed', col, row });
      revealItem(state, col, row);
    }
    state.bombs = state.bombs.filter((bomb) => !(bomb.col === col && bomb.row === row));
    state.items = state.items.filter((item) => !(item.col === col && item.row === row));
    for (const player of state.players) {
      if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
      if (Math.floor(player.x) !== col || Math.floor(player.y) !== row) continue;
      player.alive = false;
      state.events.push({ type: 'playerHit', playerId: player.id, killers: [], crushed: true });
      dropPowerups(state, player);
    }
  }
  const gone = lava.dir === 1 ? lo > arena.rows : hi < 0;
  if (gone) {
    lava.phase = 'idle';
    lava.timer = Math.max(60, LAVA_PERIOD_TICKS - LAVA_WARN_TICKS - lavaFlowTicks(arena.rows));
  }
}

interface ShotConfig {
  fall: number;
  gap: number;
  count: number;
  period: number;
  periodLate: number;
  /** Evento de lançamento/queda: o do vulcão ou o do canhão. */
  kind: 'volcano' | 'cannon';
}
const VOLCANO_SHOTS_CFG: ShotConfig = { fall: VOLCANO_FALL_TICKS, gap: VOLCANO_SHOT_GAP, count: VOLCANO_SHOTS, period: VOLCANO_PERIOD_TICKS, periodLate: VOLCANO_PERIOD_LATE_TICKS, kind: 'volcano' };
const CANNON_CFG: ShotConfig = { fall: CANNON_FALL_TICKS, gap: CANNON_SHOT_GAP, count: CANNON_SHOTS, period: CANNON_PERIOD_TICKS, periodLate: CANNON_PERIOD_TICKS, kind: 'cannon' };

/** Vulcão e canhões: de tempos em tempos lançam uma salva de bolas que caem em células sorteadas (sombra no chão antes da queda). */
function updateShots(state: GameState, volcano: NonNullable<HazardsState['volcano']>, cfg: ShotConfig): void {
  if (state.round.phase === 'playing') {
    if (volcano.phase === 'idle') {
      volcano.timer -= 1;
      if (volcano.timer <= 0) {
        volcano.phase = 'erupt';
        volcano.remaining = cfg.count;
        volcano.gap = 0;
        if (cfg.kind === 'volcano') state.events.push({ type: 'volcanoErupt' });
      }
    } else {
      volcano.gap -= 1;
      if (volcano.gap <= 0 && volcano.remaining > 0) {
        const cell = pickTarget(state, volcano.remaining);
        if (cell) {
          volcano.shots.push({ col: cell.col, row: cell.row, ticks: cfg.fall });
          state.events.push({ type: cfg.kind === 'volcano' ? 'lavaShot' : 'cannonShot', col: cell.col, row: cell.row });
        }
        volcano.remaining -= 1;
        volcano.gap = cfg.gap;
      }
      if (volcano.remaining <= 0) {
        volcano.phase = 'idle';
        volcano.timer = state.round.ticksLeft === 0 ? cfg.periodLate : cfg.period;
      }
    }
  }
  for (const shot of [...volcano.shots]) {
    shot.ticks -= 1;
    if (shot.ticks > 0) continue;
    volcano.shots.splice(volcano.shots.indexOf(shot), 1);
    impact(state, shot.col, shot.row, cfg.kind);
  }
}

/** Sorteia o alvo: metade cai perto de um jogador vivo, metade em qualquer célula comum. */
function pickTarget(state: GameState, salt: number): Cell | null {
  const arena = state.arena;
  const rng = createRng(state.tick * 17 + salt * 3 + 9);
  const alive = state.players.filter((p) => p.alive);
  for (let attempt = 0; attempt < 60; attempt++) {
    let col: number;
    let row: number;
    if (alive.length > 0 && rng() < 0.4) {
      const p = alive[Math.floor(rng() * alive.length)]!;
      col = Math.floor(p.x) + Math.floor(rng() * 5) - 2;
      row = Math.floor(p.y) + Math.floor(rng() * 5) - 2;
    } else {
      col = 1 + Math.floor(rng() * (arena.cols - 2));
      row = 1 + Math.floor(rng() * (arena.rows - 2));
    }
    const kind = getCell(arena, col, row);
    if (kind === 'wall' || kind === 'hole') continue;
    if (col < 1 || row < 1 || col > arena.cols - 2 || row > arena.rows - 2) continue;
    return { col, row };
  }
  return null;
}

/** A bola cai: derruba o bloco, some com bombas e itens e elimina quem está na célula (o colete aguenta uma vez; escudo e herói protegem). */
function impact(state: GameState, col: number, row: number, kind: 'volcano' | 'cannon'): void {
  const arena = state.arena;
  const index = cellIndex(arena, col, row);
  if (arena.cells[index] === 'block') {
    arena.cells[index] = 'empty';
    state.events.push({ type: 'blockDestroyed', col, row });
    revealItem(state, col, row);
  }
  state.bombs = state.bombs.filter((bomb) => !(bomb.col === col && bomb.row === row));
  state.items = state.items.filter((item) => !(item.col === col && item.row === row));
  state.events.push({ type: kind === 'volcano' ? 'lavaImpact' : 'cannonImpact', col, row });
  for (const player of state.players) {
    if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
    if (Math.abs(player.x - (col + 0.5)) > VOLCANO_HIT_HALF || Math.abs(player.y - (row + 0.5)) > VOLCANO_HIT_HALF) continue;
    if (player.vest) {
      player.vest = false;
      player.shieldTicks = VEST_BREAK_SHIELD_TICKS;
      state.events.push({ type: 'vestBroken', playerId: player.id });
    } else {
      player.alive = false;
      state.events.push({ type: 'playerHit', playerId: player.id, killers: [], crushed: true });
      dropPowerups(state, player);
    }
  }
}
