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
/** Velocidade dos dardos: células por passo (0,3 = 18 células/s; atravessa a arena em uns 1,5 s). */
export const DART_SPEED = 0.3;
/** Meia largura da zona de acerto do dardo, em células. */
export const DART_HIT_HALF = 0.55;
/** A flecha não mata: o jogador atingido fica na velocidade mínima do jogo por 10 s. */
export const DART_SLOW_TICKS = 10 * 60;

/** Lado da pirâmide do Egito, em células (quadrado no centro da arena, com túnel em cruz). */
export const PYRAMID_SIZE = 3;

/** Gelo fino: quantas manchas (de 1 a 2 células) e quantas passagens (4) até virar buraco. */
export const ICE_PATCHES = 5;
export const ICE_CRACK_LEVELS = 4;

/** Iglu: a cada 10 s (cada iglu; o segundo sai 5 s depois do primeiro) desce uma bola de neve ou um pinguim (alternando), em linha reta, empurrando quem estiver no caminho. */
export const ROLLER_PERIOD_TICKS = 10 * 60;

/** A neve faz crescer, aos poucos e em lugares sorteados, os blocos que tinham sido quebrados: um a cada 8 s. */
export const BLOCK_REGROW_TICKS = 8 * 60;
/** Velocidade em células por passo: bola de neve 0,07 (4,2 células/s) e pinguim 0,11 (6,6 células/s). */
export const ROLLER_SPEED = { snowball: 0.07, penguin: 0.11 } as const;

/** A bola de neve e o pinguim quebram os blocos pelo caminho (senão parariam no primeiro bloco, que é quase sempre logo abaixo da porta). */
export const ROLLER_BREAKS_BLOCKS = true;

/** Templo Perdido: o abismo ocupa 3 colunas no meio da arena e tem pontes de corda de uma margem à outra nestas fileiras (a do meio e as duas a 3 casas das bordas). */
export const CHASM_WIDTH = 3;

/** Pedra gigante: primeira queda 25 s depois do início, depois uma a cada 14 s; aviso (a coluna pisca e treme) 2,5 s antes. */
export const BOULDER_FIRST_DELAY_TICKS = 25 * 60;
export const BOULDER_PERIOD_TICKS = 14 * 60;
export const BOULDER_WARN_TICKS = 150;
/** Células por passo (0,12 = 7,2 células/s: atravessa a arena em menos de 2 s). */
export const BOULDER_SPEED = 0.12;
/** Meia largura (em células) da zona de esmagamento ao redor do centro da pedra. */
export const BOULDER_HIT_HALF = 1.6;
/** A pedra ocupa 3 colunas (a do centro e uma de cada lado) e não mata: atordoa (controles trocados) por 6 s. */
export const BOULDER_WIDTH = 3;
export const BOULDER_STUN_TICKS = 6 * 60;

/** Fundo do mar: a correnteza empurra quem está na faixa (células por passo: 0,03 = 1,8 células/s). */
export const CURRENT_PUSH = 0.03;

/**
 * Vulcão: a cada 60 s um rio de lava (4 células de comprimento) desce por uma coluna sorteada, de uma ponta à outra da arena,
 * e sai pelo outro lado. A coluna pisca 2,5 s antes. Quem estiver no rio morre; blocos, bombas e itens no caminho são destruídos.
 */
export const LAVA_FIRST_TICKS = 22 * 60;
export const LAVA_PERIOD_TICKS = 32 * 60;
export const LAVA_WARN_TICKS = 150;
/** Células por passo (0,06 = 3,6 células/s: atravessa a arena em uns 4 s). */
export const LAVA_SPEED = 0.06;
export const LAVA_LENGTH = 4;
/** O segundo rio de lava sai este tanto de passos depois do primeiro (os dois rios descem por colunas diferentes). */
export const LAVA2_DELAY_TICKS = 150;
/** Erupção: a primeira com 20 s, depois a cada 45 s (a cada 9 s depois que o tempo acaba, no lugar da morte súbita). 8 bolas por erupção, uma a cada 14 passos. */
export const VOLCANO_FIRST_TICKS = 12 * 60;
export const VOLCANO_PERIOD_TICKS = 24 * 60;
export const VOLCANO_PERIOD_LATE_TICKS = 7 * 60;
/** No último minuto da partida o vulcão erupciona bem mais seguido (a cada 8 s). */
export const VOLCANO_PERIOD_LAST_MINUTE_TICKS = 8 * 60;
export const VOLCANO_LAST_MINUTE_TICKS = 60 * 60;
export const VOLCANO_SHOTS = 8;
export const VOLCANO_SHOT_GAP = 14;
/** A sombra aparece 2 s antes da bola cair. */
export const VOLCANO_FALL_TICKS = 120;
/** Meia largura (em células) da zona atingida pela bola de lava. */
export const VOLCANO_HIT_HALF = 0.8;

/** Templo Perdido: a cada 60 s uma das duas pontes (as das beiradas) cai (aviso de 3 s antes; quem estiver nela morre) e volta 10 s depois. */
export const BRIDGE_FIRST_TICKS = 40 * 60;
export const BRIDGE_PERIOD_TICKS = 60 * 60;
export const BRIDGE_WARN_TICKS = 180;
export const BRIDGE_DOWN_TICKS = 10 * 60;

/** Ilha dos Piratas: canhões do navio. Primeiro tiro com 30 s e depois a cada 30 s; 3 balas por salva, sombra no chão 2 s antes. */
export const CANNON_FIRST_TICKS = 30 * 60;
export const CANNON_PERIOD_TICKS = 30 * 60;
export const CANNON_SHOTS = 3;
export const CANNON_SHOT_GAP = 40;
export const CANNON_FALL_TICKS = 120;

/**
 * Tráfego (arenas Selva, Pista de Corrida, Canteiro de Obras, Parquinho e Trenzinho): faixas livres de blocos, de ponta a ponta,
 * por onde passa um veículo de tempos em tempos (a faixa pisca antes). Quem estiver na faixa quando ele passa é eliminado.
 * Velocidades em células por passo; comprimentos em células; tempos em passos de 1/60 s.
 */
export type TrafficKind = 'cars' | 'train' | 'bulldozer' | 'ball' | 'log';
export interface TrafficCfg {
  speed: number;
  length: number;
  warn: number;
  first: number;
  period: number;
  /** true = cada faixa tem sempre o mesmo sentido (mão de rua); false = o sentido muda a cada passagem. */
  fixedDir: boolean;
}
export const TRAFFIC: Record<TrafficKind, TrafficCfg> = {
  cars: { speed: 0.22, length: 1.5, warn: 80, first: 12 * 60, period: 7 * 60, fixedDir: true },
  train: { speed: 0.1, length: 6, warn: 150, first: 14 * 60, period: 20 * 60, fixedDir: false },
  bulldozer: { speed: 0.07, length: 2.2, warn: 110, first: 14 * 60, period: 11 * 60, fixedDir: false },
  ball: { speed: 0.12, length: 1, warn: 100, first: 14 * 60, period: 10 * 60, fixedDir: false },
  log: { speed: 0.11, length: 1.3, warn: 110, first: 14 * 60, period: 12 * 60, fixedDir: false },
};
