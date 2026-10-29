import { ARENA_COLS, ARENA_ROWS, ARENA_SYMMETRIC, BLOCK_DENSITY, DEFAULT_SEED } from '../config/arena';
import { createRng } from './random';
import type { Arena, Cell, CellType } from './types';

export interface ArenaOptions {
  cols?: number;
  rows?: number;
  seed?: number;
  /** Fração (0 a 1) das células elegíveis que viram bloco destrutível. */
  blockDensity?: number;
  /** Deixa livre a zona de nascimento do centro (partida com 5 jogadores). */
  centerSpawn?: boolean;
  /** Espelha a arena (girada 180°) para ser justa com dois jogadores. Padrão: ARENA_SYMMETRIC. */
  symmetric?: boolean;
}

/** Posição de nascimento nos quatro cantos: superior esquerdo, superior direito, inferior esquerdo, inferior direito. */
export function spawnCells(cols: number, rows: number): [Cell, Cell, Cell, Cell] {
  return [
    { col: 1, row: 1 },
    { col: cols - 2, row: 1 },
    { col: 1, row: rows - 2 },
    { col: cols - 2, row: rows - 2 },
  ];
}

/** Nascimento do quinto jogador: o centro da arena (coluna e linha do meio). */
export function centerSpawn(cols: number, rows: number): Cell {
  return { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
}

/**
 * Zona de segurança de um canto: a célula de nascimento e as duas vizinhas para dentro da arena.
 * Fica sempre livre de blocos, para o jogador poder sair da própria bomba.
 */
function safeZone(spawn: Cell, cols: number, rows: number): Cell[] {
  const dCol = spawn.col < cols / 2 ? 1 : -1;
  const dRow = spawn.row < rows / 2 ? 1 : -1;
  return [spawn, { col: spawn.col + dCol, row: spawn.row }, { col: spawn.col, row: spawn.row + dRow }];
}

export function inBounds(arena: Arena, col: number, row: number): boolean {
  return col >= 0 && col < arena.cols && row >= 0 && row < arena.rows;
}

/** Posição da célula na lista `arena.cells` (e chave para conjuntos de células). */
export function cellIndex(arena: Arena, col: number, row: number): number {
  return row * arena.cols + col;
}

/** A célula é do túnel da pirâmide? (Ali ninguém coloca bomba: ficaria escondida.) */
export function isTunnel(tunnel: readonly number[] | undefined, arena: Arena, col: number, row: number): boolean {
  return !!tunnel && tunnel.includes(cellIndex(arena, col, row));
}

/** Conteúdo da célula. Fora da arena conta como parede, então ninguém "vaza" pelas bordas. */
export function getCell(arena: Arena, col: number, row: number): CellType {
  if (!inBounds(arena, col, row)) return 'wall';
  return arena.cells[row * arena.cols + col] ?? 'wall';
}

/** Verdadeiro se a célula bloqueia a passagem (parede ou bloco). */
export function isSolid(arena: Arena, col: number, row: number): boolean {
  return getCell(arena, col, row) !== 'empty';
}

/**
 * Cria a arena:
 * - borda toda de parede;
 * - pilares fixos nas células em que coluna e linha são ambas pares;
 * - zonas de nascimento livres nos quatro cantos;
 * - blocos destrutíveis sorteados (com semente) no restante; se `symmetric`, a segunda metade da arena
 *   copia a primeira girada 180° (a célula central é a única que sorteia sozinha).
 */
export function createArena(options: ArenaOptions = {}): Arena {
  const cols = options.cols ?? ARENA_COLS;
  const rows = options.rows ?? ARENA_ROWS;
  const seed = options.seed ?? DEFAULT_SEED;
  const density = options.blockDensity ?? BLOCK_DENSITY;
  const symmetric = options.symmetric ?? ARENA_SYMMETRIC;

  if (cols < 5 || rows < 5 || cols % 2 === 0 || rows % 2 === 0) {
    throw new Error(`Arena inválida (${cols}x${rows}): colunas e linhas precisam ser ímpares e pelo menos 5.`);
  }

  const safe = new Set<number>();
  for (const spawn of spawnCells(cols, rows)) {
    for (const cell of safeZone(spawn, cols, rows)) {
      safe.add(cell.row * cols + cell.col);
    }
  }
  if (options.centerSpawn) {
    // No centro, só as células de cima e de baixo são livres (as laterais são pilares): a zona é essa linha de 3.
    const middle = centerSpawn(cols, rows);
    for (const dRow of [-1, 0, 1]) safe.add((middle.row + dRow) * cols + middle.col);
  }

  const rng = createRng(seed);
  const cells: CellType[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isBorder = col === 0 || row === 0 || col === cols - 1 || row === rows - 1;
      // Com 5 jogadores o centro é a casa do quinto: em arenas de largura 17 (coluna do meio par) o pilar cederia lugar a ele.
      const centre = options.centerSpawn ? centerSpawn(cols, rows) : null;
      const isPillar = col % 2 === 0 && row % 2 === 0 && !(centre && centre.col === col && centre.row === row);

      if (isBorder || isPillar) {
        cells.push('wall');
      } else if (safe.has(row * cols + col)) {
        cells.push('empty');
      } else {
        const index = row * cols + col;
        const mirror = rows * cols - 1 - index;
        // O espelho de uma célula já decidida está atrás dela na lista: basta copiar.
        cells.push(symmetric && mirror < index ? cells[mirror]! : rng() < density ? 'block' : 'empty');
      }
    }
  }

  return { cols, rows, cells };
}
