// Superpoderes dos personagens. Importado pelo core: sem Phaser e sem navegador.

/** Tempo de carga do poder: 50 s (passos de 1/60 s). Começa vazio a cada rodada. */
export const POWER_CHARGE_TICKS = 50 * 60;

/** Elefantinho da Ana: células por passo (0,1 = 6 células/s). */
export const ELEPHANT_SPEED = 0.1;

/** Quantos blocos o elefantinho quebra antes de ir embora (use Infinity para a fileira inteira). */
export const ELEPHANT_MAX_BLOCKS = Infinity;

/**
 * Avião do Lucas: ao acionar o poder, o avião sai da mão dele e sobrevoa a arena inteira em 4 voltas (uma espiral que
 * começa na borda e vai fechando para o centro), largando 7 bombas em células aleatórias perto de onde está.
 * Tudo em passos de 1/60 s (uma volta = 2,2 s, então o poder dura uns 9 s).
 */
export const AIRPLANE_BOMBS = 7;
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
/** Filippe: fantasma (atravessa blocos) por 10 s e um halo de 3 células de raio em volta dele, onde ninguém entra. */
export const GHOST_POWER_TICKS = 10 * 60;
export const GHOST_HALO_RADIUS = 3;
export const GHOST_HALO_TICKS = 10 * 60;
/** Glauceste: todos os outros jogadores ficam com os controles invertidos por 10 s. */
export const CONFUSE_POWER_TICKS = 10 * 60;
/** Wal: a cegonha solta 4 itens bons: 3 perto dela (raio de 3 células) e 1 em qualquer lugar livre da arena. */
export const STORK_ITEMS = 3; // + STORK_FAR_ITEMS = 4 itens
export const STORK_RADIUS = 3;
export const STORK_FAR_ITEMS = 1;
/** Van: congela as bombas dos outros jogadores por 10 s e os próprios jogadores por 5 s. */
export const FREEZE_POWER_TICKS = 10 * 60;
export const FREEZE_PLAYER_TICKS = 5 * 60;
/** Wal: escudo de 5 s junto com a cegonha. */
export const STORK_SHIELD_TICKS = 5 * 60;

/** Pipoca: atira 4 bombas, uma para cada direção, caindo a 4 células de distância. */
export const JUMP_CELLS = 4;
/** Bolt: corre na velocidade máxima do jogo por 10 s. */
export const SPRINT_POWER_TICKS = 10 * 60;
/** Bolt: ao disparar o turbo, quem está a até este raio (em células) leva um choque e fica paralisado este tempo. */
export const SHOCK_RADIUS = 5;
/** O círculo de choque cresce de 0 até SHOCK_RADIUS neste tempo (1,2 s) e fica um instante na borda antes de sumir. */
export const SHOCK_GROW_TICKS = 72;
export const SHOCK_FADE_TICKS = 12;
/** Quem o círculo alcança fica imobilizado por 3 s. */
export const SHOCK_TICKS = 180;
/** Musgo: gosma em 3 células em cada direção; quem pisa (menos ela) fica na velocidade mínima. Dura 10 s. */
export const SLIME_CELLS = 3;
export const SLIME_TICKS = 10 * 60;
/** Violeta: invisível por 10 s. */
export const INVISIBLE_POWER_TICKS = 10 * 60;
/** Fagulha: espalha várias bombas (ela fica imune às chamas até todas acabarem). */
/** Fagulha: joga FAGULHA_BOMBS bombas em casas livres sorteadas até FAGULHA_RADIUS células dela, cada uma com um pavio diferente. */
export const FAGULHA_BOMBS = 7;
export const FAGULHA_RADIUS = 6;
export const FAGULHA_FUSE_MIN = 90;
export const FAGULHA_FUSE_MAX = 200;
/** Nimbo: neblina por 10 s (ele enxerga em volta de si). */
export const FOG_POWER_TICKS = 10 * 60;

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
  decoys: 'SÓSIAS!',
  sprint: 'TURBO!',
  slime: 'GOSMA!',
  invisible: 'INVISÍVEL!',
  twinbombs: 'CHUVA DE BOMBAS!',
  fog: 'NEBLINA!',
  magnet: 'ÍMÃ!',
} as const;

/** Magnetron (o robô ímã): puxa para perto dele os jogadores até este raio (em células) e arranca 1 powerup do mais próximo (cai no cenário). */
export const MAGNET_RADIUS = 5;
export const MAGNET_STEALS = 1;
/** O powerup arrancado cai numa casa livre até este raio (em células) do Magnetron. */
export const MAGNET_DROP_RADIUS = 4;
/** Pipoca: 4 sósias idênticas andam pela arena por 10 s. Matar uma não faz nada, só dá pontos. */
export const DECOY_COUNT = 4;
export const DECOY_TICKS = 10 * 60;
/** Células por passo das sósias (um pouco mais devagar que um jogador normal). */
export const DECOY_SPEED = 0.06;
