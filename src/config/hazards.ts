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

/** Gelo fino: quantas manchas (de 1 a 2 células) e quantas passagens (4) até virar buraco. */
export const ICE_PATCHES = 5;
export const ICE_CRACK_LEVELS = 4;

/** Iglu: a cada 20 s (cada iglu; o segundo sai 10 s depois do primeiro) desce uma bola de neve ou um pinguim (alternando), em linha reta, empurrando quem estiver no caminho. */
export const ROLLER_PERIOD_TICKS = 20 * 60;

/** A neve faz crescer, aos poucos e em lugares sorteados, os blocos que tinham sido quebrados: um a cada 8 s. */
export const BLOCK_REGROW_TICKS = 8 * 60;
/** Velocidade em células por passo: bola de neve 0,07 (4,2 células/s) e pinguim 0,11 (6,6 células/s). */
export const ROLLER_SPEED = { snowball: 0.07, penguin: 0.11 } as const;

/** A bola de neve e o pinguim quebram os blocos pelo caminho (senão parariam no primeiro bloco, que é quase sempre logo abaixo da porta). */
export const ROLLER_BREAKS_BLOCKS = true;
