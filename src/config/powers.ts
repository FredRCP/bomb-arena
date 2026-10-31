// Superpoderes dos personagens. Importado pelo core: sem Phaser e sem navegador.

/** Tempo de carga do poder: 50 s (passos de 1/60 s). Começa vazio a cada rodada. */
export const POWER_CHARGE_TICKS = 50 * 60;

/** Elefantinho da Ana: células por passo (0,1 = 6 células/s). */
export const ELEPHANT_SPEED = 0.1;

/** Quantos blocos o elefantinho quebra antes de ir embora (use Infinity para a fileira inteira). */
export const ELEPHANT_MAX_BLOCKS = 6;

/**
 * Avião do Lucas: ao acionar o poder, o avião sai da mão dele e sobrevoa a arena inteira em 4 voltas (uma espiral que
 * começa na borda e vai fechando para o centro), largando 6 bombas em células aleatórias perto de onde está.
 * Tudo em passos de 1/60 s (uma volta = 2,2 s, então o poder dura uns 9 s).
 */
export const AIRPLANE_BOMBS = 6;
export const AIRPLANE_LAPS = 4;
export const AIRPLANE_LAP_TICKS = 130;
/** Tempo para ir da mão do dono até a pista (e para voltar no fim). */
export const AIRPLANE_ENTRY_TICKS = 30;
/** Passos até a primeira bomba e entre uma bomba e a seguinte. */
export const AIRPLANE_FIRST_DROP = 40;
export const AIRPLANE_DROP_TICKS = 70;
/** A pista fecha até esta fração do tamanho no fim da 4ª volta. */
export const AIRPLANE_END_SCALE = 0.5;

/** Fred: teletransporta para uma célula livre sorteada e fica invencível por 10 s. */
export const SHIELD_POWER_TICKS = 10 * 60;
/** Filippe: fantasma (atravessa blocos) por 10 s e empurra os inimigos próximos 3 células para longe. */
export const GHOST_POWER_TICKS = 10 * 60;
export const GHOST_PUSH_RADIUS = 3;
export const GHOST_PUSH_CELLS = 3;
/** Glauceste: todos os outros jogadores ficam com os controles invertidos por 10 s. */
export const CONFUSE_POWER_TICKS = 10 * 60;
/** Wal: a cegonha solta 4 itens bons: 3 perto dela (raio de 3 células) e 1 em qualquer lugar livre da arena. */
export const STORK_ITEMS = 3;
export const STORK_RADIUS = 3;
export const STORK_FAR_ITEMS = 1;
/** Van: congela todas as bombas dos outros jogadores por 10 s. */
export const FREEZE_POWER_TICKS = 10 * 60;

/** Pipoca: pula uma bomba ou um bloco (cai 2 células à frente, se estiver livre). */
export const JUMP_CELLS = 2;
/** Bolt: corre na velocidade máxima do jogo por 10 s. */
export const SPRINT_POWER_TICKS = 10 * 60;
/** Musgo: gosma em 3 células em cada direção; quem pisa (menos ela) fica na velocidade mínima. Dura 10 s. */
export const SLIME_CELLS = 3;
export const SLIME_TICKS = 10 * 60;
/** Violeta: invisível por 10 s. */
export const INVISIBLE_POWER_TICKS = 10 * 60;
/** Fagulha: 2 bombas de alcance 8 (ela fica imune às chamas até elas acabarem). */
export const TWIN_BOMB_RANGE = 8;
/** Nimbo: neblina por 10 s (ele enxerga em volta de si). */
export const FOG_POWER_TICKS = 10 * 60;
/** Cacau: 3 blocos de chocolate na frente. */
export const CHOCOLATE_BLOCKS = 3;

/** Nome do poder, mostrado em cima do jogador quando ele o usa. */
export const POWER_LABELS = {
  elephant: 'ELEFANTE!',
  airplane: 'AVIÃO!',
  shield: 'TELEPORTE!',
  freeze: 'CONGELAR!',
  stork: 'CEGONHA!',
  confuse: 'CONFUSÃO!',
  ghost: 'FANTASMA!',
  jump: 'PULO!',
  sprint: 'TURBO!',
  slime: 'GOSMA!',
  invisible: 'INVISÍVEL!',
  twinbombs: 'DUAS BOMBAS!',
  fog: 'NEBLINA!',
  chocolate: 'CHOCOLATE!',
} as const;
