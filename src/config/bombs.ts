// Parâmetros de bombas e explosões. Importado pelo core: sem Phaser e sem navegador.
// Todo tempo é contado em passos de simulação (60 por segundo, veja simulation.ts).

/** Tempo entre colocar a bomba e ela explodir. 180 passos = 3 segundos. */
export const BOMB_FUSE_TICKS = 180;

/** Quanto tempo cada chama fica acesa depois da explosão. 30 passos = 0,5 segundo. */
export const FLAME_TICKS = 30;

/** Alcance da explosão em células, em cada uma das 4 direções (sem contar a célula da bomba). */
export const DEFAULT_BOMB_RANGE = 1;

/** Quantas bombas o mesmo jogador pode ter ao mesmo tempo na arena. */
export const DEFAULT_MAX_BOMBS = 1;

/** Pavio de segurança da bomba-relógio: se o dono não detonar, ela explode sozinha depois de 10 segundos. */
export const REMOTE_FUSE_TICKS = 600;

/** Bomba chutada: anda uma célula a cada 5 passos (12 células por segundo) até bater em algo. */
export const KICK_SLIDE_TICKS = 5;

/** Distância do arremesso, em células (passa por cima de blocos, paredes e bombas). */
export const THROW_DISTANCE = 3;

/** Proteção de quem volta a jogar depois de eliminar alguém das laterais: 2 segundos sem poder ser atingido por chamas. */
export const REVIVE_SHIELD_TICKS = 120;

/** Bomba jogada das laterais: cai a 2 casas da borda (a segunda fileira), para dar para atingir quem está colado nela. */
export const SIDELINE_THROW_DISTANCE = 2;

/** Jogador eliminado nas laterais: anda uma casa do anel a cada 10 passos (6 casas por segundo, perto da velocidade de quem está na arena). */
export const SIDELINE_MOVE_TICKS = 10;

/** Duração do item fantasma: 8 segundos. */
export const GHOST_TICKS = 480;
