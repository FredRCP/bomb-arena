import { DART_FIRST_DELAY_TICKS, DART_HIT_HALF, DART_PERIOD_TICKS, DART_SPEED, DART_WARN_TICKS, QUICKSAND_PATCHES, QUICKSAND_SPEED_FACTOR } from '../config/hazards';
import { VEST_BREAK_SHIELD_TICKS } from '../config/items';
import { cellIndex, getCell } from './arena';
import { dropPowerups } from './items';
import { createRng } from './random';
import type { Arena, Cell, GameState, HazardsState, PlayerState } from './types';

// Perigos do terreno. Só existem nas arenas que pedem (veja config/stages.ts); sem `state.hazards` nada disso acontece.
// - Areia movediça: células em que o jogador anda bem mais devagar.
// - Armadilha de dardos: uma fileira SEM blocos; de tempos em tempos pisca um aviso nas bordas e, 2 s depois, dardos
//   varrem a fileira de um lado a outro (alternando o lado). Quem estiver na frente é atingido (colete e escudo valem).
// - Esfinge: três células de parede no centro da arena.

export interface HazardOptions {
  /** Espalha manchas de areia movediça. */
  quicksand?: boolean;
  /** Linha (ímpar) da armadilha de dardos; a fileira fica livre de blocos. */
  dartRow?: number;
  /** Esfinge no centro: três paredes na linha do meio. */
  sphinx?: boolean;
}

/** Células da esfinge (três na horizontal, no centro da arena). */
export function sphinxCells(cols: number, rows: number): Cell[] {
  const col = Math.floor(cols / 2);
  const row = Math.floor(rows / 2);
  return [-1, 0, 1].map((d) => ({ col: col + d, row }));
}

function nearSpawn(cell: Cell, cols: number, rows: number): boolean {
  // Cantos de nascimento: nada de areia a menos de 4 células (distância de grade) deles.
  const corners: Cell[] = [{ col: 1, row: 1 }, { col: cols - 2, row: 1 }, { col: 1, row: rows - 2 }, { col: cols - 2, row: rows - 2 }];
  return corners.some((c) => Math.abs(c.col - cell.col) + Math.abs(c.row - cell.row) < 5);
}

/**
 * Prepara o terreno: ajusta as células da arena (esfinge, fileira de dardos limpa) e devolve o estado dos perigos.
 * Chame ANTES de sortear os itens escondidos (para não restar item dentro de um bloco que sumiu).
 * Devolve undefined se a arena não tem perigo nenhum.
 */
export function createHazards(arena: Arena, options: HazardOptions | undefined, seed: number): HazardsState | undefined {
  if (!options) return undefined;
  const { cols, rows } = arena;

  if (options.sphinx) {
    for (const cell of sphinxCells(cols, rows)) arena.cells[cellIndex(arena, cell.col, cell.row)] = 'wall';
  }

  let dartTrap: HazardsState['dartTrap'] = null;
  if (options.dartRow !== undefined) {
    const row = options.dartRow;
    for (let col = 1; col < cols - 1; col++) {
      if (getCell(arena, col, row) === 'block') arena.cells[cellIndex(arena, col, row)] = 'empty';
    }
    dartTrap = { row, phase: 'idle', timer: DART_FIRST_DELAY_TICKS - DART_WARN_TICKS, dir: 1, x: 0 };
  }

  const quicksand: number[] = [];
  if (options.quicksand) {
    const rng = createRng(seed * 7 + 13);
    const taken = new Set<number>();
    const free = (cell: Cell): boolean =>
      getCell(arena, cell.col, cell.row) !== 'wall' && cell.row !== options.dartRow && !nearSpawn(cell, cols, rows) && !taken.has(cellIndex(arena, cell.col, cell.row));
    let guard = 0;
    for (let patch = 0; patch < QUICKSAND_PATCHES && guard++ < 400; ) {
      const cell = { col: 1 + Math.floor(rng() * (cols - 2)), row: 1 + Math.floor(rng() * (rows - 2)) };
      if (!free(cell)) continue;
      const side = rng() < 0.5 ? { col: cell.col + 1, row: cell.row } : { col: cell.col, row: cell.row + 1 };
      const mark = (c: Cell): void => {
        const index = cellIndex(arena, c.col, c.row);
        taken.add(index);
        quicksand.push(index);
        arena.cells[index] = 'empty'; // a areia fica à mostra desde o começo (sem bloco por cima)
      };
      mark(cell);
      if (free(side)) mark(side);
      patch += 1;
    }
  }
  return { quicksand, dartTrap };
}

/** Fator de velocidade do jogador: reduzido em cima da areia movediça (pela célula do centro do corpo). */
export function speedFactorAt(state: GameState, player: Pick<PlayerState, 'x' | 'y'>): number {
  const quicksand = state.hazards?.quicksand;
  if (!quicksand || quicksand.length === 0) return 1;
  return quicksand.includes(cellIndex(state.arena, Math.floor(player.x), Math.floor(player.y))) ? QUICKSAND_SPEED_FACTOR : 1;
}

/** Avança a armadilha de dardos um passo (chamado uma vez por passo, pelo `step`). */
export function updateHazards(state: GameState): void {
  const trap = state.hazards?.dartTrap;
  if (!trap || state.round.phase === 'over') return;

  if (trap.phase === 'idle') {
    trap.timer -= 1;
    if (trap.timer <= 0) {
      trap.phase = 'warn';
      trap.timer = DART_WARN_TICKS;
      state.events.push({ type: 'dartWarn', row: trap.row, dir: trap.dir });
    }
    return;
  }

  if (trap.phase === 'warn') {
    trap.timer -= 1;
    if (trap.timer <= 0) {
      trap.phase = 'fly';
      trap.x = trap.dir === 1 ? 0.5 : state.arena.cols - 0.5;
      state.events.push({ type: 'dartFired', row: trap.row, dir: trap.dir });
    }
    return;
  }

  // Voando: o dardo avança e acerta quem está na fileira, perto dele.
  trap.x += trap.dir * DART_SPEED;
  for (const player of state.players) {
    if (!player.alive || player.shieldTicks > 0 || player.heroTicks > 0) continue;
    if (Math.floor(player.y) !== trap.row || Math.abs(player.x - trap.x) > DART_HIT_HALF + 0.3) continue;
    if (player.vest) {
      player.vest = false;
      player.shieldTicks = VEST_BREAK_SHIELD_TICKS;
      state.events.push({ type: 'vestBroken', playerId: player.id });
    } else {
      player.alive = false;
      state.events.push({ type: 'playerHit', playerId: player.id, killers: [], dart: true });
      dropPowerups(state, player);
    }
  }
  if (trap.x < -0.5 || trap.x > state.arena.cols + 0.5) {
    trap.phase = 'idle';
    trap.timer = DART_PERIOD_TICKS - DART_WARN_TICKS;
    trap.dir = trap.dir === 1 ? -1 : 1;
  }
}
