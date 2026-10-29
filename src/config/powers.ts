// Superpoderes dos personagens. Importado pelo core: sem Phaser e sem navegador.

/** Tempo de carga do poder: 60 s (passos de 1/60 s). Começa vazio a cada rodada. */
export const POWER_CHARGE_TICKS = 60 * 60;

/** Elefantinho da Ana: células por passo (0,1 = 6 células/s). */
export const ELEPHANT_SPEED = 0.1;

/** Quantos blocos o elefantinho quebra antes de ir embora (use Infinity para a fileira inteira). */
export const ELEPHANT_MAX_BLOCKS = 5;

/**
 * Avião do Lucas: ao acionar o poder, o avião sai da mão dele, abre uma espiral até o raio de voo e dá 2 voltas em círculo
 * em torno do ponto de onde saiu, largando 5 bombas em células aleatórias perto de onde está; depois volta ao dono.
 * Tudo em passos de 1/60 s (uma volta = 2,5 s, então o poder dura 5 s).
 */
export const AIRPLANE_BOMBS = 5;
export const AIRPLANE_LAPS = 2;
export const AIRPLANE_LAP_TICKS = 150;
/** Raio do círculo, em células. */
export const AIRPLANE_RADIUS = 3;
/** Tempo para abrir a espiral (e para fechá-la no fim). */
export const AIRPLANE_ENTRY_TICKS = 40;
/** Passos até a primeira bomba e entre uma bomba e a seguinte. */
export const AIRPLANE_FIRST_DROP = 40;
export const AIRPLANE_DROP_TICKS = 45;
