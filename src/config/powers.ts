// Superpoderes dos personagens. Importado pelo core: sem Phaser e sem navegador.

/** Tempo de carga do poder: 60 s (passos de 1/60 s). Começa vazio a cada rodada. */
export const POWER_CHARGE_TICKS = 60 * 60;

/** Elefantinho da Ana: células por passo (0,1 = 6 células/s). */
export const ELEPHANT_SPEED = 0.1;

/** Quantos blocos o elefantinho quebra antes de ir embora (use Infinity para a fileira inteira). */
export const ELEPHANT_MAX_BLOCKS = 5;

/**
 * Avião do Lucas: ao acionar o poder, o avião sai da mão dele e sobrevoa a arena inteira em 4 voltas (uma espiral que
 * começa na borda e vai fechando para o centro), largando 6 bombas em células aleatórias perto de onde está.
 * Tudo em passos de 1/60 s (uma volta = 3,3 s, então o poder dura uns 13 s).
 */
export const AIRPLANE_BOMBS = 6;
export const AIRPLANE_LAPS = 4;
export const AIRPLANE_LAP_TICKS = 200;
/** Tempo para ir da mão do dono até a pista (e para voltar no fim). */
export const AIRPLANE_ENTRY_TICKS = 40;
/** Passos até a primeira bomba e entre uma bomba e a seguinte. */
export const AIRPLANE_FIRST_DROP = 60;
export const AIRPLANE_DROP_TICKS = 120;
/** A pista fecha até esta fração do tamanho no fim da 4ª volta. */
export const AIRPLANE_END_SCALE = 0.5;

/** Fred: escudo (invulnerável) por 5 s. */
export const SHIELD_POWER_TICKS = 5 * 60;
/** Glauceste: os inimigos ficam com os controles invertidos por 6 s. */
export const CONFUSE_POWER_TICKS = 6 * 60;
/** Wal: a cegonha solta 3 itens bons perto dela (num raio de 3 células). */
export const STORK_ITEMS = 3;
export const STORK_RADIUS = 3;
/** Van: o teletransporte cai a pelo menos 4 células de onde ela estava. */
export const TELEPORT_MIN_DISTANCE = 4;

/** Nome do poder, mostrado em cima do jogador quando ele o usa. */
export const POWER_LABELS = {
  elephant: 'ELEFANTE!',
  airplane: 'AVIÃO!',
  shield: 'ESCUDO!',
  teleport: 'TELEPORTE!',
  stork: 'CEGONHA!',
  confuse: 'CONFUSÃO!',
  ghost: 'FANTASMA!',
} as const;
