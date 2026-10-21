import type { Arena, CellType } from '../../src/core';

const SYMBOLS: Record<string, CellType> = {
  '#': 'wall',
  o: 'block',
  '.': 'empty',
};

/**
 * Monta uma arena a partir de um desenho em texto, para testes que precisam de um cenário exato.
 * Legenda: # parede, o bloco destrutível, . célula livre.
 */
export function arenaFromText(lines: string[]): Arena {
  const cols = lines[0]?.length ?? 0;
  const cells: CellType[] = [];

  for (const line of lines) {
    if (line.length !== cols) throw new Error(`Linhas com larguras diferentes: "${line}"`);
    for (const symbol of line) {
      const type = SYMBOLS[symbol];
      if (type === undefined) throw new Error(`Símbolo desconhecido "${symbol}" na linha "${line}"`);
      cells.push(type);
    }
  }

  return { cols, rows: lines.length, cells };
}
