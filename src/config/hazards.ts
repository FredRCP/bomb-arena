// Perigos do terreno (arena do Egito). Importado pelo core: sem Phaser e sem navegador.

/** Quanto da velocidade sobra em cima da areia movediça (0,45 = anda a menos da metade). */
export const QUICKSAND_SPEED_FACTOR = 0.45;

/** Quantas manchas de areia movediça (cada mancha tem 2 células). */
export const QUICKSAND_PATCHES = 7;

/** Armadilha de dardos: primeiro disparo depois de 20 s e depois a cada 14 s (passos de 1/60 s). */
export const DART_FIRST_DELAY_TICKS = 20 * 60;
export const DART_PERIOD_TICKS = 14 * 60;
/** Tempo de aviso antes de cada disparo (setas piscando nas bordas da fileira): 2 s. */
export const DART_WARN_TICKS = 2 * 60;
/** Velocidade dos dardos: células por passo (0,4 = 24 células/s; atravessa a arena em menos de 1 s). */
export const DART_SPEED = 0.4;
/** Meia largura da zona de acerto do dardo, em células. */
export const DART_HIT_HALF = 0.55;
