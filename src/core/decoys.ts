import { DECOY_COUNT, DECOY_SPEED, DECOY_TICKS } from '../config/powers';
import { getCell, isTunnel } from './arena';
import { createRng } from './random';
import type { GameState, PlayerState } from './types';

// Sósias da Pipoca: 4 cópias idênticas que andam ao acaso pela arena por DECOY_TICKS. Não machucam, não bloqueiam e não são
// atingidas por nada além de chamas: uma chama que as pega as destrói e dá pontos a quem soltou a bomba (ninguém sai do jogo).

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function free(state: GameState, col: number, row: number): boolean {
  return getCell(state.arena, col, row) === 'empty' && !isTunnel(state.hazards?.tunnel, state.arena, col, row) && !state.bombs.some((b) => b.col === col && b.row === row);
}

/** Cria as sósias em células livres sorteadas (sem repetir, longe de quem já está lá). */
export function spawnDecoys(state: GameState, owner: PlayerState, rng: () => number): void {
  const arena = state.arena;
  const spots: Array<{ col: number; row: number }> = [];
  for (let row = 1; row < arena.rows - 1; row++) {
    for (let col = 1; col < arena.cols - 1; col++) {
      if (!free(state, col, row)) continue;
      if (state.flames.some((f) => f.col === col && f.row === row)) continue;
      if (state.players.some((p) => p.alive && Math.abs(p.x - (col + 0.5)) < 1 && Math.abs(p.y - (row + 0.5)) < 1)) continue;
      spots.push({ col, row });
    }
  }
  const decoys = (state.decoys ??= []);
  let nextId = decoys.reduce((m, d) => Math.max(m, d.id), 0) + 1;
  for (let n = 0; n < DECOY_COUNT && spots.length > 0; n++) {
    const spot = spots.splice(Math.floor(rng() * spots.length), 1)[0]!;
    decoys.push({ id: nextId++, owner: owner.id, x: spot.col + 0.5, y: spot.row + 0.5, tcol: spot.col, trow: spot.row, ticks: DECOY_TICKS });
  }
  state.events.push({ type: 'decoysSpawned', owner: owner.id });
}

/** Um passo das sósias: andam, somem com o tempo e morrem em chamas. */
export function updateDecoys(state: GameState): void {
  const decoys = state.decoys;
  if (!decoys || decoys.length === 0 || state.round.phase !== 'playing') return;
  for (const decoy of [...decoys]) {
    decoy.ticks -= 1;
    const col = Math.floor(decoy.x);
    const row = Math.floor(decoy.y);
    const flame = state.flames.find((f) => f.col === col && f.row === row);
    if (flame) {
      decoys.splice(decoys.indexOf(decoy), 1);
      state.events.push({ type: 'decoyKilled', id: decoy.id, owner: decoy.owner, killers: [...(flame.owners ?? [])] });
      continue;
    }
    if (decoy.ticks <= 0) {
      decoys.splice(decoys.indexOf(decoy), 1);
      state.events.push({ type: 'decoyGone', id: decoy.id, owner: decoy.owner });
      continue;
    }
    const tx = decoy.tcol + 0.5;
    const ty = decoy.trow + 0.5;
    const dist = Math.hypot(tx - decoy.x, ty - decoy.y);
    if (dist > DECOY_SPEED) {
      decoy.x += ((tx - decoy.x) / dist) * DECOY_SPEED;
      decoy.y += ((ty - decoy.y) / dist) * DECOY_SPEED;
      continue;
    }
    // Chegou ao centro da célula: escolhe a próxima (de preferência seguindo reto, sem voltar).
    decoy.x = tx;
    decoy.y = ty;
    const rng = createRng(state.tick * 53 + decoy.id * 19 + decoy.owner);
    const options = DIRS.filter(([dx, dy]) => free(state, decoy.tcol + dx, decoy.trow + dy));
    if (options.length === 0 || rng() < 0.1) continue; // às vezes para um instante
    const [dx, dy] = options[Math.floor(rng() * options.length)]!;
    decoy.tcol += dx;
    decoy.trow += dy;
  }
}
