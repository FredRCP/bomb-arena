// Pontuação da partida. Importado pelo core: sem Phaser e sem navegador.

/** Eliminar um jogador de outro time. */
export const POINTS_KILL = 100;
/** Eliminar um aliado (desconta; também não faz voltar das laterais). */
export const POINTS_TEAMKILL = -100;
/** Eliminar-se com a própria bomba (ou com a de um aliado, que conta como erro do aliado). */
export const POINTS_SUICIDE = -50;
/** Vencer a rodada: cada membro do time vencedor ganha estes pontos. */
export const POINTS_ROUND_WIN = 300;
/** Vencer a partida: bônus para cada membro do time vencedor. */
export const POINTS_MATCH_WIN = 500;

/** Quantas pontuações o ranking guarda. */
export const RANKING_SIZE = 10;
