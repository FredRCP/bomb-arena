import { ARENA_COLS, ARENA_ROWS, ARENA_SYMMETRIC } from '../../src/config/arena';
import { describe, expect, it } from 'vitest';
import { createArena, getCell, inBounds, isSolid, spawnCells } from '../../src/core';
import type { Arena, Cell } from '../../src/core';

/** Quantidade de células "empty" quando a densidade de blocos é 1: sobram só as zonas de nascimento (4 cantos x 3 células). */
const SAFE_CELLS_TOTAL = 12;

function countCells(arena: Arena, type: 'empty' | 'wall' | 'block'): number {
  return arena.cells.filter((cell) => cell === type).length;
}

function safeZonesOf(arena: Arena): Cell[] {
  const { cols, rows } = arena;
  return [
    { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 1, row: 2 },
    { col: cols - 2, row: 1 }, { col: cols - 3, row: 1 }, { col: cols - 2, row: 2 },
    { col: 1, row: rows - 2 }, { col: 2, row: rows - 2 }, { col: 1, row: rows - 3 },
    { col: cols - 2, row: rows - 2 }, { col: cols - 3, row: rows - 2 }, { col: cols - 2, row: rows - 3 },
  ];
}

describe('createArena', () => {
  it('usa o tamanho da config (15 colunas x 13 linhas: 13x11 jogáveis mais as paredes) por padrão e guarda uma célula para cada posição', () => {
    const arena = createArena();
    expect(arena.cols).toBe(ARENA_COLS);
    expect(arena.rows).toBe(ARENA_ROWS);
    expect([ARENA_COLS, ARENA_ROWS]).toEqual([15, 13]);
    expect(arena.cells).toHaveLength(ARENA_COLS * ARENA_ROWS);
  });

  it('cerca a arena inteira com paredes', () => {
    const arena = createArena({ seed: 5 });
    for (let col = 0; col < arena.cols; col++) {
      expect(getCell(arena, col, 0)).toBe('wall');
      expect(getCell(arena, col, arena.rows - 1)).toBe('wall');
    }
    for (let row = 0; row < arena.rows; row++) {
      expect(getCell(arena, 0, row)).toBe('wall');
      expect(getCell(arena, arena.cols - 1, row)).toBe('wall');
    }
  });

  it('coloca pilares fixos onde coluna e linha são ambas pares', () => {
    const arena = createArena({ seed: 9 });
    for (let row = 2; row < arena.rows - 1; row += 2) {
      for (let col = 2; col < arena.cols - 1; col += 2) {
        expect(getCell(arena, col, row)).toBe('wall');
      }
    }
  });

  it('mantém as zonas de nascimento livres em qualquer semente', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const arena = createArena({ seed });
      for (const { col, row } of safeZonesOf(arena)) {
        expect(getCell(arena, col, row), `semente ${seed}, célula ${col},${row}`).toBe('empty');
      }
    }
  });

  it('gera a mesma arena para a mesma semente e arenas diferentes para sementes diferentes', () => {
    expect(createArena({ seed: 7 })).toEqual(createArena({ seed: 7 }));
    expect(createArena({ seed: 1 }).cells).not.toEqual(createArena({ seed: 2 }).cells);
  });

  it('mantém a proporção de blocos próxima da densidade pedida', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const arena = createArena({ seed });
      const eligible = countCells(arena, 'block') + countCells(arena, 'empty') - SAFE_CELLS_TOTAL;
      const ratio = countCells(arena, 'block') / eligible;
      expect(ratio, `semente ${seed}`).toBeGreaterThan(0.55);
      expect(ratio, `semente ${seed}`).toBeLessThan(0.95);
    }
  });

  it('com densidade 0 não há blocos', () => {
    expect(countCells(createArena({ blockDensity: 0 }), 'block')).toBe(0);
  });

  it('com densidade 1 só sobram livres as zonas de nascimento', () => {
    expect(countCells(createArena({ blockDensity: 1 }), 'empty')).toBe(SAFE_CELLS_TOTAL);
  });

  it('aceita outras dimensões ímpares', () => {
    const arena = createArena({ cols: 7, rows: 5, seed: 3 });
    expect(arena.cells).toHaveLength(7 * 5);
    expect(getCell(arena, 0, 0)).toBe('wall');
    expect(getCell(arena, 6, 4)).toBe('wall');
  });

  it('recusa dimensões pares ou pequenas demais', () => {
    expect(() => createArena({ cols: 12 })).toThrow();
    expect(() => createArena({ rows: 10 })).toThrow();
    expect(() => createArena({ cols: 3 })).toThrow();
  });
});

describe('arena simétrica (justa para dois jogadores)', () => {
  it('com symmetric: true, cada célula é igual à sua oposta (giro de 180°) em qualquer semente', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const arena = createArena({ seed, symmetric: true });
      for (let row = 0; row < arena.rows; row++) {
        for (let col = 0; col < arena.cols; col++) {
          expect(getCell(arena, col, row), `semente ${seed}, célula ${col},${row}`).toBe(
            getCell(arena, arena.cols - 1 - col, arena.rows - 1 - row),
          );
        }
      }
    }
  });

  it('a vizinhança dos dois cantos de nascimento (jogador 1 e jogador 2) é idêntica', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const arena = createArena({ seed, symmetric: true });
      for (let dRow = 0; dRow <= 3; dRow++) {
        for (let dCol = 0; dCol <= 3; dCol++) {
          expect(getCell(arena, 1 + dCol, 1 + dRow)).toBe(getCell(arena, arena.cols - 2 - dCol, arena.rows - 2 - dRow));
        }
      }
    }
  });

  it('por padrão a arena NÃO é simétrica (cada rodada é sorteada de verdade), mas os cantos de nascimento são sempre livres', () => {
    const mirrored = (arena: Arena): boolean =>
      arena.cells.every((cell, index) => cell === arena.cells[arena.cells.length - 1 - index]);
    expect(ARENA_SYMMETRIC).toBe(false);
    expect([1, 2, 3, 4, 5].some((seed) => !mirrored(createArena({ seed })))).toBe(true);
    for (let seed = 1; seed <= 20; seed++) {
      const arena = createArena({ seed });
      expect(getCell(arena, 1, 1)).toBe('empty');
      expect(getCell(arena, arena.cols - 2, arena.rows - 2)).toBe('empty');
    }
  });

  it('com symmetric: false, a arena continua sorteada e (em alguma semente) não é simétrica', () => {
    const mirrored = (arena: Arena): boolean =>
      arena.cells.every((cell, index) => cell === arena.cells[arena.cells.length - 1 - index]);
    expect([1, 2, 3, 4, 5].some((seed) => !mirrored(createArena({ seed, symmetric: false })))).toBe(true);
    expect([1, 2, 3, 4, 5].every((seed) => mirrored(createArena({ seed, symmetric: true })))).toBe(true);
  });

  it('continua determinística e mantém a densidade perto da pedida', () => {
    expect(createArena({ seed: 12 })).toEqual(createArena({ seed: 12 }));
    for (let seed = 1; seed <= 20; seed++) {
      const arena = createArena({ seed });
      const eligible = countCells(arena, 'block') + countCells(arena, 'empty') - SAFE_CELLS_TOTAL;
      const ratio = countCells(arena, 'block') / eligible;
      expect(ratio, `semente ${seed}`).toBeGreaterThan(0.55);
      expect(ratio, `semente ${seed}`).toBeLessThan(0.95);
    }
  });

  it('em arenas pequenas ímpares também vale (inclui a célula central)', () => {
    const arena = createArena({ cols: 7, rows: 5, seed: 8 });
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        expect(getCell(arena, col, row)).toBe(getCell(arena, 6 - col, 4 - row));
      }
    }
  });
});

describe('consulta de células', () => {
  it('inBounds reconhece os limites da arena', () => {
    const arena = createArena();
    expect(inBounds(arena, 0, 0)).toBe(true);
    expect(inBounds(arena, arena.cols - 1, arena.rows - 1)).toBe(true);
    expect(inBounds(arena, -1, 0)).toBe(false);
    expect(inBounds(arena, 0, -1)).toBe(false);
    expect(inBounds(arena, arena.cols, 0)).toBe(false);
    expect(inBounds(arena, 0, arena.rows)).toBe(false);
  });

  it('fora da arena conta como parede e bloqueia a passagem', () => {
    const arena = createArena();
    expect(getCell(arena, -1, -1)).toBe('wall');
    expect(getCell(arena, arena.cols, arena.rows)).toBe('wall');
    expect(isSolid(arena, -5, 3)).toBe(true);
  });

  it('isSolid é falso em célula livre e verdadeiro em parede e bloco', () => {
    const arena = createArena({ seed: 1 });
    expect(isSolid(arena, 1, 1)).toBe(false);
    expect(isSolid(arena, 0, 0)).toBe(true);

    const index = arena.cells.indexOf('block');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(isSolid(arena, index % arena.cols, Math.floor(index / arena.cols))).toBe(true);
  });
});

describe('spawnCells', () => {
  it('devolve os quatro cantos internos da arena', () => {
    expect(spawnCells(13, 11)).toEqual([
      { col: 1, row: 1 },
      { col: 11, row: 1 },
      { col: 1, row: 9 },
      { col: 11, row: 9 },
    ]);
  });
});
