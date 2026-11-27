import { SCORPION_COOLDOWN_TICKS, SCORPION_FIRST_TICKS, SCORPION_MAX, SCORPION_RESPAWN_TICKS, SCORPION_SPEED, SCORPION_STUN_TICKS, SCORPION_TOUCH_HALF, SCORPION_WARN_TICKS } from '../config/hazards';
import { cellIndex, getCell } from './arena';
import { createRng } from './random';
import type { GameState, ScorpionBody, ScorpionState } from './types';

// Escorpiões do Templo Perdido (só regras; o desenho está em render/ScorpionView.ts).
// 1) O relógio chega a zero: numa casa livre, longe dos jogadores, a terra treme por 1 s e um escorpião sai (no máximo SCORPION_MAX em campo).
// 2) Ele anda devagar pelas casas livres, parando de vez em quando e virando ao acaso; não entra em ponte, bloco, templo nem bomba.
// 3) Quem encosta fica atordoado por 1,5 s (estrelas); escudo e super-herói protegem. O mesmo jogador só é picado de novo depois de 4 s.
// 4) Uma explosão na casa dele o mata; o relógio recomeça.

export function createScorpions(): ScorpionState {
  return { timer: SCORPION_FIRST_TICKS, list: [], stungAt: {} };
}

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function walkable(state: GameState, col: number, row: number): boolean {
  const { arena } = state;
  if (getCell(arena, col, row) !== 'empty') return false;
  const index = cellIndex(arena, col, row);
  const hz = state.hazards;
  if (hz?.tunnel?.includes(index) || hz?.bridges?.includes(index) || hz?.sprouts?.some((s) => s.index === index)) return false;
  return !state.bombs.some((b) => b.col === col && b.row === row);
}

function pickCell(state: GameState, rng: () => number): { col: number; row: number } | null {
  const { arena } = state;
  const alive = state.players.filter((p) => p.alive);
  const taken = state.hazards?.scorpions?.list ?? [];
  const pool: Array<{ col: number; row: number }> = [];
  for (let row = 1; row < arena.rows - 1; row++) {
    for (let col = 1; col < arena.cols - 1; col++) {
      if (!walkable(state, col, row) || state.items.some((i) => i.col === col && i.row === row)) continue;
      if (!DIRS.some(([dx, dy]) => walkable(state, col + dx, row + dy))) continue;
      if (alive.some((p) => Math.abs(Math.floor(p.x) - col) + Math.abs(Math.floor(p.y) - row) < 4)) continue;
      if (taken.some((s) => Math.abs(s.col - col) + Math.abs(s.row - row) < 4)) continue;
      pool.push({ col, row });
    }
  }
  return pool.length === 0 ? null : pool[Math.floor(rng() * pool.length)]!;
}

function chooseStep(state: GameState, body: ScorpionBody): void {
  const rng = createRng(state.tick * 151 + body.col * 19 + body.row * 5 + body.id * 7);
  const options: Array<{ dx: number; dy: number; weight: number }> = [];
  for (const [dx, dy] of DIRS) {
    if (!walkable(state, body.col + dx, body.row + dy)) continue;
    const back = dx === -body.dx && dy === -body.dy && (body.dx !== 0 || body.dy !== 0);
    const straight = dx === body.dx && dy === body.dy;
    options.push({ dx, dy, weight: straight ? 3 : back ? 0.4 : 2 });
  }
  // Para de vez em quando (dá tempo de fugir e de ver o bicho).
  if (options.length === 0 || rng() < 0.25) {
    body.tcol = body.col;
    body.trow = body.row;
    body.dx = 0;
    body.dy = 0;
    return;
  }
  let roll = rng() * options.reduce((sum, o) => sum + o.weight, 0);
  let pick = options[options.length - 1]!;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) {
      pick = option;
      break;
    }
  }
  body.tcol = body.col + pick.dx;
  body.trow = body.row + pick.dy;
  body.dx = pick.dx;
  body.dy = pick.dy;
}

function move(state: GameState, body: ScorpionBody): void {
  body.progress += SCORPION_SPEED;
  const moving = body.tcol !== body.col || body.trow !== body.row;
  if (moving && !walkable(state, body.tcol, body.trow)) {
    [body.col, body.tcol] = [body.tcol, body.col];
    [body.row, body.trow] = [body.trow, body.row];
    body.progress = Math.max(0, 1 - body.progress);
    body.dx = -body.dx;
    body.dy = -body.dy;
  }
  if (body.progress >= 1) {
    body.col = body.tcol;
    body.row = body.trow;
    body.progress = 0;
    chooseStep(state, body);
  }
  body.x = body.col + 0.5 + (body.tcol - body.col) * body.progress;
  body.y = body.row + 0.5 + (body.trow - body.row) * body.progress;
}

/** Um passo do evento dos escorpiões. `rate` é a pressa dos outros eventos (maior no fim da rodada). */
export function updateScorpions(state: GameState, rate: number): void {
  const sc = state.hazards?.scorpions;
  if (!sc || state.round.phase !== 'playing') return;

  if (sc.list.length < SCORPION_MAX && !sc.warning) {
    sc.timer -= rate;
    if (sc.timer <= 0) {
      const cell = pickCell(state, createRng(state.tick * 61 + 31));
      if (cell) {
        sc.warning = { ...cell, ticks: SCORPION_WARN_TICKS };
        state.events.push({ type: 'scorpionWarn', ...cell });
      } else {
        sc.timer = 60;
      }
    }
  }
  if (sc.warning) {
    sc.warning.ticks -= 1;
    if (sc.warning.ticks <= 0) {
      const { col, row } = sc.warning;
      sc.warning = null;
      if (walkable(state, col, row)) {
        sc.nextId = (sc.nextId ?? 0) + 1;
        sc.list.push({ id: sc.nextId, col, row, tcol: col, trow: row, progress: 1, x: col + 0.5, y: row + 0.5, dx: 0, dy: 0 });
        state.events.push({ type: 'scorpionSpawned', col, row });
      }
      sc.timer = sc.list.length < SCORPION_MAX ? SCORPION_RESPAWN_TICKS : 0;
    }
  }

  for (const body of [...sc.list]) {
    move(state, body);
    for (const player of state.players) {
      if (!player.alive || player.sideline !== null) continue;
      const last = sc.stungAt[player.id];
      if (last !== undefined && state.tick - last < SCORPION_COOLDOWN_TICKS) continue;
      if (Math.abs(player.x - body.x) > SCORPION_TOUCH_HALF || Math.abs(player.y - body.y) > SCORPION_TOUCH_HALF) continue;
      sc.stungAt[player.id] = state.tick;
      if (player.shieldTicks > 0 || player.heroTicks > 0) continue;
      player.frozenTicks = Math.max(player.frozenTicks ?? 0, SCORPION_STUN_TICKS);
      player.stunned = true;
      player.slide = null;
      state.events.push({ type: 'stunned', playerId: player.id });
    }
    const col = body.progress < 0.5 ? body.col : body.tcol;
    const row = body.progress < 0.5 ? body.row : body.trow;
    if (state.flames.some((f) => f.ticksLeft > 0 && f.col === col && f.row === row)) {
      sc.list.splice(sc.list.indexOf(body), 1);
      sc.timer = Math.max(sc.timer, SCORPION_RESPAWN_TICKS);
      state.events.push({ type: 'scorpionKilled', col, row });
    }
  }
}
