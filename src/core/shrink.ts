import { SUDDEN_DEATH_INTERVAL_TICKS, SUDDEN_DEATH_LOOKAHEAD } from '../config/round';
import { cellIndex, getCell } from './arena';
import { dropPowerups } from './items';
import { bodyOverlapsCell } from './movement';
import type { Cell, GameState } from './types';

// Morte súbita: depois do fim do tempo, a arena fecha em espiral, de fora para dentro.
// A ordem é fixa (só depende do tamanho da arena), então o jogador pode ver para onde o fechamento vai.

const spiralCache = new Map<string, Cell[]>();

/** Todas as células de dentro da borda, na ordem em que fecham: volta externa, depois a próxima, até o centro. */
export function spiralOrder(cols: number, rows: number): Cell[] {
  const key = `${cols}x${rows}`;
  const cached = spiralCache.get(key);
  if (cached) return cached;

  const order: Cell[] = [];
  let top = 1;
  let bottom = rows - 2;
  let left = 1;
  let right = cols - 2;
  while (top <= bottom && left <= right) {
    for (let col = left; col <= right; col++) order.push({ col, row: top });
    for (let row = top + 1; row <= bottom; row++) order.push({ col: right, row });
    if (top < bottom) for (let col = right - 1; col >= left; col--) order.push({ col, row: bottom });
    if (left < right) for (let row = bottom - 1; row > top; row--) order.push({ col: left, row });
    top += 1;
    bottom -= 1;
    left += 1;
    right -= 1;
  }
  spiralCache.set(key, order);
  return order;
}

/** As próximas `count` células que vão fechar (pula as que já são parede, como os pilares). */
export function pendingClosures(state: GameState, count: number): Cell[] {
  const order = spiralOrder(state.arena.cols, state.arena.rows);
  const pending: Cell[] = [];
  for (let i = state.round.closedCount; i < order.length && pending.length < count; i++) {
    const cell = order[i]!;
    if (getCell(state.arena, cell.col, cell.row) !== 'wall') pending.push(cell);
  }
  return pending;
}

/** Janelas de perigo para a IA: a k-ésima célula pendente fecha em `nextCloseIn + k * intervalo` passos e fica fechada para sempre. */
export function closingHazards(state: GameState): Array<{ cell: Cell; closesIn: number }> {
  if (!state.round.suddenDeath) return [];
  return pendingClosures(state, SUDDEN_DEATH_LOOKAHEAD).map((cell, k) => ({
    cell,
    closesIn: state.round.nextCloseIn + k * SUDDEN_DEATH_INTERVAL_TICKS,
  }));
}

/** Fecha a próxima célula: vira parede; bomba, item e chama dela somem; quem encosta nela morre. */
export function closeNextCell(state: GameState): void {
  const [cell] = pendingClosures(state, 1);
  const order = spiralOrder(state.arena.cols, state.arena.rows);
  if (!cell) {
    state.round.closedCount = order.length;
    return;
  }
  state.round.closedCount = order.findIndex((c, i) => i >= state.round.closedCount && c.col === cell.col && c.row === cell.row) + 1;

  state.arena.cells[cellIndex(state.arena, cell.col, cell.row)] = 'wall';
  state.bombs = state.bombs.filter((bomb) => !(bomb.col === cell.col && bomb.row === cell.row));
  state.flames = state.flames.filter((flame) => !(flame.col === cell.col && flame.row === cell.row));
  state.items = state.items.filter((item) => !(item.col === cell.col && item.row === cell.row));
  state.hiddenItems = state.hiddenItems.filter((item) => !(item.col === cell.col && item.row === cell.row));
  for (const player of state.players) {
    if (player.alive && bodyOverlapsCell(player.x, player.y, cell.col, cell.row)) {
      player.alive = false;
      state.events.push({ type: 'playerHit', playerId: player.id, killers: [], crushed: true });
      dropPowerups(state, player);
    }
  }
  state.events.push({ type: 'cellClosed', col: cell.col, row: cell.row });
}
