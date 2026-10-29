// Superpoderes dos personagens. Importado pelo core: sem Phaser e sem navegador.

/** Tempo de carga do poder: 60 s (passos de 1/60 s). Começa vazio a cada rodada. */
export const POWER_CHARGE_TICKS = 60 * 60;

/** Elefantinho da Ana: células por passo (0,1 = 6 células/s). */
export const ELEPHANT_SPEED = 0.1;

/** Quantos blocos o elefantinho quebra antes de ir embora (use Infinity para a fileira inteira). */
export const ELEPHANT_MAX_BLOCKS = 5;

/** Avião do Lucas: células por passo (0,1 = 6 células/s), uma bomba a cada 18 passos e até quantas células para cada lado da linha de voo. */
export const AIRPLANE_SPEED = 0.1;
export const AIRPLANE_DROP_TICKS = 18;
export const AIRPLANE_SPREAD = 3;
