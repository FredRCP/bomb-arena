// Parâmetros da arena.
// Este arquivo é importado pelo core, então não pode depender do Phaser nem do navegador.

/**
 * Colunas da arena, CONTANDO as paredes da borda. Precisa ser ímpar (os pilares fixos dependem disso).
 * 15 = 13 colunas jogáveis + 2 paredes, o mesmo tamanho jogável do Bomberman clássico.
 */
export const ARENA_COLS = 15;

/** Linhas da arena, contando as paredes da borda. Precisa ser ímpar. 13 = 11 linhas jogáveis + 2 paredes. */
export const ARENA_ROWS = 13;

/** Fração das células livres (fora das zonas de nascimento) que recebem bloco destrutível: 0 a 1. */
export const BLOCK_DENSITY = 0.75;

/** Semente usada quando nenhuma é informada. A mesma semente sempre gera a mesma arena. */
export const DEFAULT_SEED = 1;

/**
 * Arena simétrica (girada 180°): o que existe em (col, row) também existe em (última coluna - col, última linha - row).
 * Garante que os dois cantos opostos dos jogadores 1 e 2 tenham exatamente os mesmos blocos à volta,
 * então nenhum lado nasce com vantagem. Desligue (false) para arenas totalmente sorteadas.
 */
export const ARENA_SYMMETRIC = false;
