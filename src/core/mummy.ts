import { MUMMY_COOLDOWN_TICKS, MUMMY_FIRST_TICKS, MUMMY_OPEN_TICKS, MUMMY_RESPAWN_TICKS, MUMMY_SPEED, MUMMY_TOUCH_HALF, MUMMY_WARN_TICKS, MUMMY_WRAP_TICKS } from '../config/hazards';
import { cellIndex, getCell } from './arena';
import { freeItemCells } from './items';
import { createRng } from './random';
import type { GameState, ItemKind, MummyBody, MummyState } from './types';

// A múmia do Egito (só regras; o desenho está em render/MummyView.ts).
// 1) O relógio chega a zero: um sarcófago aparece numa célula livre, longe dos jogadores, e avisa por 1,5 s.
// 2) Ele abre e a múmia sai andando ao acaso (de célula em célula, sem pisar em bloco, parede, túnel da pirâmide nem bomba).
// 3) Quem encosta nela fica enfaixado (parado) por 3 s; escudo e super-herói protegem. O mesmo jogador só é enfaixado de novo depois de 5 s.
// 4) Uma explosão na célula dela a desfaz e solta um item bom; o relógio recomeça para a próxima.

export function createMummy(): MummyState {
  return { timer: MUMMY_FIRST_TICKS, coffin: null, mummy: null, wrappedAt: {} };
}

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** A múmia pode pisar nesta célula? (livre, fora do túnel da pirâmide e sem bomba) */
function walkable(state: GameState, col: number, row: number): boolean {
  const { arena } = state;
  if (getCell(arena, col, row) !== 'empty') return false;
  if (state.hazards?.tunnel?.includes(cellIndex(arena, col, row))) return false;
  return !state.bombs.some((b) => b.col === col && b.row === row);
}

function openNeighbours(state: GameState, col: number, row: number): number {
  return DIRS.filter(([dx, dy]) => walkable(state, col + dx, row + dy)).length;
}

/** Sorteia a célula do sarcófago: livre, sem item, com saída, e (se der) a 3 ou mais células de todo jogador vivo. */
function pickCoffinCell(state: GameState, rng: () => number): { col: number; row: number } | null {
  const { arena } = state;
  const alive = state.players.filter((p) => p.alive);
  const all: Array<{ col: number; row: number }> = [];
  const far: Array<{ col: number; row: number }> = [];
  for (let row = 1; row < arena.rows - 1; row++) {
    for (let col = 1; col < arena.cols - 1; col++) {
      if (!walkable(state, col, row) || state.items.some((i) => i.col === col && i.row === row)) continue;
      if (openNeighbours(state, col, row) === 0) continue;
      all.push({ col, row });
      if (alive.every((p) => Math.abs(Math.floor(p.x) - col) + Math.abs(Math.floor(p.y) - row) >= 3)) far.push({ col, row });
    }
  }
  const pool = far.length > 0 ? far : all;
  return pool.length === 0 ? null : pool[Math.floor(rng() * pool.length)]!;
}

/** Escolhe o próximo passo da múmia: segue em frente com mais vontade, vira de lado, e só volta atrás se não houver outro caminho. */
function chooseStep(state: GameState, body: MummyBody): void {
  const rng = createRng(state.tick * 131 + body.col * 17 + body.row * 7 + 5);
  const options: Array<{ dx: number; dy: number; weight: number }> = [];
  for (const [dx, dy] of DIRS) {
    if (!walkable(state, body.col + dx, body.row + dy)) continue;
    const back = dx === -body.dx && dy === -body.dy && (body.dx !== 0 || body.dy !== 0);
    const straight = dx === body.dx && dy === body.dy;
    options.push({ dx, dy, weight: straight ? 3 : back ? 0.5 : 2 });
  }
  const pause = rng() < 0.12; // às vezes para um instante, como quem procura o caminho
  if (options.length === 0 || pause) {
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
  if (pick.dx !== 0) body.facing = pick.dx > 0 ? 1 : -1;
}

function moveMummy(state: GameState, body: MummyBody): void {
  body.progress += MUMMY_SPEED;
  const moving = body.tcol !== body.col || body.trow !== body.row;
  // Uma bomba foi posta no caminho dela: dá meia-volta.
  if (moving && !walkable(state, body.tcol, body.trow)) {
    [body.col, body.tcol] = [body.tcol, body.col];
    [body.row, body.trow] = [body.trow, body.row];
    body.progress = Math.max(0, 1 - body.progress);
    body.dx = -body.dx;
    body.dy = -body.dy;
    if (body.dx !== 0) body.facing = body.dx > 0 ? 1 : -1;
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

/** Item bom que cai quando a múmia é desfeita: na célula livre mais próxima dela. */
function dropReward(state: GameState, col: number, row: number): void {
  const { arena } = state;
  const free = freeItemCells(state);
  if (free.length === 0) return;
  let best = free[0]!;
  let bestDist = Infinity;
  for (const index of free) {
    const d = Math.abs((index % arena.cols) - col) + Math.abs(Math.floor(index / arena.cols) - row);
    if (d < bestDist) {
      best = index;
      bestDist = d;
    }
  }
  const kinds: ItemKind[] = ['bomb', 'range', 'speed', 'kick', 'vest'];
  const kind = kinds[Math.floor(createRng(state.tick * 977 + 13)() * kinds.length)]!;
  const at = { col: best % arena.cols, row: Math.floor(best / arena.cols) };
  state.items.push({ ...at, kind });
  state.events.push({ type: 'itemSpawned', ...at, kind });
}

/** Um passo do evento da múmia. `rate` é a mesma pressa dos iglus e pinguins (1x no começo, mais no fim da rodada). */
export function updateMummy(state: GameState, rate: number): void {
  const mummy = state.hazards?.mummy;
  if (!mummy || state.round.phase !== 'playing') return;
  const coffin = mummy.coffin;

  if (coffin) {
    if (coffin.ticks > 0) {
      coffin.ticks -= 1;
      if (coffin.ticks === 0) {
        coffin.open = MUMMY_OPEN_TICKS;
        mummy.mummy = { col: coffin.col, row: coffin.row, tcol: coffin.col, trow: coffin.row, progress: 1, x: coffin.col + 0.5, y: coffin.row + 0.5, dx: 0, dy: 0, facing: 1 };
        state.events.push({ type: 'mummySpawned', col: coffin.col, row: coffin.row });
      }
    } else if (coffin.open > 0) {
      coffin.open -= 1;
      if (coffin.open === 0) mummy.coffin = null;
    }
  } else if (!mummy.mummy) {
    mummy.timer -= rate;
    if (mummy.timer <= 0) {
      const cell = pickCoffinCell(state, createRng(state.tick * 53 + 29));
      if (cell) {
        mummy.coffin = { ...cell, ticks: MUMMY_WARN_TICKS, open: 0 };
        state.events.push({ type: 'mummyWarn', ...cell });
      } else {
        mummy.timer = 60; // sem lugar agora: tenta de novo daqui a 1 s
      }
    }
  }

  const body = mummy.mummy;
  if (!body) return;
  moveMummy(state, body);

  // Quem encosta é enfaixado (escudo e super-herói protegem, mas também contam a pausa).
  for (const player of state.players) {
    if (!player.alive) continue;
    const last = mummy.wrappedAt[player.id];
    if (last !== undefined && state.tick - last < MUMMY_COOLDOWN_TICKS) continue;
    if (Math.abs(player.x - body.x) > MUMMY_TOUCH_HALF || Math.abs(player.y - body.y) > MUMMY_TOUCH_HALF) continue;
    mummy.wrappedAt[player.id] = state.tick;
    if (player.shieldTicks > 0 || player.heroTicks > 0) continue;
    player.frozenTicks = Math.max(player.frozenTicks ?? 0, MUMMY_WRAP_TICKS);
    player.slide = null;
    state.events.push({ type: 'mummyWrapped', playerId: player.id });
  }

  // Uma explosão na célula em que ela está a desfaz.
  const col = body.progress < 0.5 ? body.col : body.tcol;
  const row = body.progress < 0.5 ? body.row : body.trow;
  if (state.flames.some((f) => f.ticksLeft > 0 && f.col === col && f.row === row)) {
    mummy.mummy = null;
    mummy.timer = MUMMY_RESPAWN_TICKS;
    state.events.push({ type: 'mummyDestroyed', col, row });
    dropReward(state, col, row);
  }
}
