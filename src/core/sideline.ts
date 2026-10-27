import { BOMB_FUSE_TICKS, REVIVE_SHIELD_TICKS, SIDELINE_MOVE_TICKS, SIDELINE_THROW_DISTANCE } from '../config/bombs';
import { cellIndex, getCell, inBounds } from './arena';
import { findLanding, hitByThrownBomb } from './bombs';
import { bodyOverlapsCell } from './movement';
import type { Arena, Cell, Direction, GameState, PlayerIntent, PlayerState } from './types';

// Jogador eliminado nas laterais.
//
// Quem é eliminado (e não decidiu a rodada) continua jogando: anda pelo "anel" de casas da borda da arena
// (as que ficam por cima da parede externa) e joga bombas para dentro. Se uma bomba dele eliminar alguém,
// ele volta para a arena, protegido por REVIVE_SHIELD_TICKS passos (veja explosions.ts e `revive`).
//
// Regras (testadas em tests/core/sideline.test.ts):
// - Qualquer jogador (pessoa ou computador) vira jogador das laterais, desde que a opção esteja ligada (`sidelineEnabled`)
//   e que, depois da eliminação, ainda restem 2 ou mais times vivos (se a rodada já está decidida, não há o que disputar).
// - O anel é a sequência de casas da borda, no sentido horário. Andar = ir para a casa vizinha do anel na direção
//   pedida (nos cantos, as duas direções funcionam), a cada SIDELINE_MOVE_TICKS passos.
// - Apertar bomba joga uma bomba para dentro da arena (perpendicular à lateral), pelas mesmas regras do arremesso
//   (por cima de tudo, cai na primeira casa livre a partir de SIDELINE_THROW_DISTANCE casas de distância). Só uma bomba dele por vez.
//   A bomba usa o alcance que o jogador tinha; nunca é relógio nem perfurante.
// - Voltar: ele renasce na casa em que nasceu (ou na livre mais próxima), com os mesmos itens.

/** Casas do anel de borda, em sentido horário a partir do canto superior esquerdo. */
export function ringCells(arena: Arena): Cell[] {
  const { cols, rows } = arena;
  const cells: Cell[] = [];
  for (let col = 0; col < cols; col++) cells.push({ col, row: 0 });
  for (let row = 1; row < rows; row++) cells.push({ col: cols - 1, row });
  for (let col = cols - 2; col >= 0; col--) cells.push({ col, row: rows - 1 });
  for (let row = rows - 2; row >= 1; row--) cells.push({ col: 0, row });
  return cells;
}

/** Índice da casa do anel mais perto da posição (x, y) (em unidades de célula). */
export function nearestRingIndex(arena: Arena, x: number, y: number): number {
  const ring = ringCells(arena);
  let best = 0;
  let bestDistance = Infinity;
  ring.forEach((cell, index) => {
    const distance = (cell.col + 0.5 - x) ** 2 + (cell.row + 0.5 - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** Vizinha do anel na direção pedida, ou null se aquela direção não segue o anel a partir desta casa. */
export function ringStep(arena: Arena, index: number, direction: Direction): number | null {
  const ring = ringCells(arena);
  const here = ring[index]!;
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
  for (const next of [(index + 1) % ring.length, (index - 1 + ring.length) % ring.length]) {
    const cell = ring[next]!;
    if (cell.col - here.col === delta[0] && cell.row - here.row === delta[1]) return next;
  }
  return null;
}

/** Para onde a bomba é jogada a partir desta casa do anel: para dentro da arena (nos cantos, na vertical). */
export function inwardDirection(arena: Arena, index: number): Direction {
  const here = ringCells(arena)[index]!;
  if (here.row === 0) return 'down';
  if (here.row === arena.rows - 1) return 'up';
  return here.col === 0 ? 'right' : 'left';
}

function bombsOf(state: GameState, player: PlayerState): number {
  return state.bombs.filter((bomb) => bomb.owner === player.id).length;
}

/** Jogador das laterais: anda no anel (com espera entre casas) e joga a bomba, se pediu. */
export function sidelineAct(state: GameState, player: PlayerState, intent: PlayerIntent | undefined): void {
  if (player.sideline === null) return;
  if (player.sidelineCooldown > 0) player.sidelineCooldown -= 1;

  if (intent?.move && player.sidelineCooldown === 0) {
    const next = ringStep(state.arena, player.sideline, intent.move);
    if (next !== null) {
      player.sideline = next;
      player.sidelineCooldown = SIDELINE_MOVE_TICKS;
    }
  }

  if (intent?.placeBomb && bombsOf(state, player) === 0) {
    const from = ringCells(state.arena)[player.sideline]!;
    const direction = inwardDirection(state.arena, player.sideline);
    const landing = findLanding(state, from.col, from.row, direction, SIDELINE_THROW_DISTANCE);
    if (!landing) return;
    state.bombs.push({
      owner: player.id,
      col: landing.col,
      row: landing.row,
      ticksLeft: BOMB_FUSE_TICKS,
      range: player.bombRange,
      walkThrough: state.players.filter((p) => p.alive && bodyOverlapsCell(p.x, p.y, landing.col, landing.row)).map((p) => p.id),
    });
    state.events.push({ type: 'bombPlaced', col: landing.col, row: landing.row, owner: player.id });
    state.events.push({ type: 'bombThrown', fromCol: from.col, fromRow: from.row, col: landing.col, row: landing.row });
    hitByThrownBomb(state, landing.col, landing.row);
  }
}

/** Quantos times têm alguém vivo. */
function aliveTeams(state: GameState): number {
  return new Set(state.players.filter((p) => p.alive).map((p) => p.team)).size;
}

/**
 * Manda para as laterais os humanos eliminados que ainda não estão lá, se a rodada segue em disputa.
 * Chame depois de `updateRound`: se a eliminação decidiu a rodada, a fase já não é 'playing' e ninguém vai.
 */
export function updateSidelines(state: GameState): void {
  if (state.sidelineEnabled === false || state.round.phase !== 'playing' || state.players.length < 2 || aliveTeams(state) < 2) return;
  for (const player of state.players) {
    if (player.alive || player.sideline !== null) continue;
    player.sideline = nearestRingIndex(state.arena, player.x, player.y);
    player.sidelineCooldown = 0;
  }
}

/** A casa serve para alguém renascer? Livre, sem bomba, sem chama e sem ninguém vivo em cima. */
function isFreeToRevive(state: GameState, cell: Cell): boolean {
  if (getCell(state.arena, cell.col, cell.row) !== 'empty') return false;
  if (state.bombs.some((b) => b.col === cell.col && b.row === cell.row)) return false;
  if (state.flames.some((f) => f.col === cell.col && f.row === cell.row)) return false;
  return !state.players.some((p) => p.alive && bodyOverlapsCell(p.x, p.y, cell.col, cell.row));
}

/** Casa onde o jogador renasce: a dele, ou a livre mais perto dela (busca em largura). Null se não há nenhuma. */
export function reviveCellFor(state: GameState, player: PlayerState): Cell | null {
  const { arena } = state;
  const seen = new Set<number>([cellIndex(arena, player.spawn.col, player.spawn.row)]);
  const queue: Cell[] = [player.spawn];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]!;
    if (isFreeToRevive(state, cell)) return cell;
    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const next = { col: cell.col + dc, row: cell.row + dr };
      if (!inBounds(arena, next.col, next.row) || getCell(arena, next.col, next.row) === 'wall') continue;
      const key = cellIndex(arena, next.col, next.row);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return null;
}

/** O jogador das laterais volta à arena. Devolve false se não houve onde renascer. */
export function revive(state: GameState, player: PlayerState): boolean {
  const cell = reviveCellFor(state, player);
  if (!cell) return false;
  player.alive = true;
  player.x = cell.col + 0.5;
  player.y = cell.row + 0.5;
  player.facing = 'down';
  player.sideline = null;
  player.sidelineCooldown = 0;
  player.shieldTicks = REVIVE_SHIELD_TICKS;
  player.ghostTicks = 0;
  player.invertTicks = 0;
  state.events.push({ type: 'playerRevived', playerId: player.id, col: cell.col, row: cell.row });
  return true;
}
