// Parâmetros da rodada. Importado pelo core: sem Phaser e sem navegador.

/**
 * Quanto tempo o jogo continua rodando depois de a rodada estar decidida (sobrou só um jogador, ou ninguém),
 * antes de valer o resultado. 90 passos = 1,5 segundo.
 * Serve para: ver a morte acontecer; e ser justo no empate, porque o último sobrevivente ainda pode morrer
 * de uma bomba que já estava acesa (aí o resultado vira empate).
 */
export const ROUND_END_DELAY_TICKS = 90;

/**
 * Duração de uma rodada: 3 minutos (180 s x 60 passos). Se o tempo acabar sem vencedor, a rodada é empate.
 * Conta em passos (e não em segundos reais) para valer igual em qualquer computador e poder ser testada.
 */
export const ROUND_TIME_TICKS = 180 * 60;

/**
 * Morte súbita: quando o tempo acaba, uma parede fecha uma célula da arena a cada 30 passos (0,5 s),
 * em espiral, da borda para o centro. Quem estiver na célula (ou encostando nela) é esmagado.
 * Uma arena 13 x 11 leva cerca de 1 minuto para fechar por completo.
 */
export const SUDDEN_DEATH_INTERVAL_TICKS = 30;

/** Contagem regressiva antes de a rodada começar (3, 2, 1...). Só a cena a usa: o core não sabe dela. */
export const COUNTDOWN_SECONDS = 3;

/** Quantas células à frente a IA enxerga que vão fechar (para sair da frente a tempo). */
export const SUDDEN_DEATH_LOOKAHEAD = 14;
