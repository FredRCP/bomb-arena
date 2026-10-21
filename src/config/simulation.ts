// Parâmetros da simulação (as regras que dependem de tempo e de tamanho do corpo).
// Importado pelo core, então não pode depender do Phaser nem do navegador.

/** Quantos passos de simulação acontecem por segundo, independente da taxa de quadros da tela. */
export const TICKS_PER_SECOND = 60;

/** Máximo de passos processados num único quadro. Evita a "bola de neve" depois de uma pausa longa. */
export const MAX_TICKS_PER_FRAME = 12;

/**
 * Velocidade inicial do jogador, em células por segundo. É a de antes (4,5) menos 1 ponto de velocidade
 * (SPEED_PER_ITEM, veja config/items.ts): todos (pessoas e computador) começam com ela, sem itens.
 */
export const PLAYER_SPEED = 4.15;

/**
 * Metade do lado do corpo (um quadrado) do jogador, em células.
 * 0,45 deixa o corpo com 0,9 de largura: cabe nos corredores de uma célula e sobra só 0,05 de folga de cada
 * lado (cerca de 3 px). Quanto maior o corpo, menos o boneco "balança" dentro da própria célula ao empurrar
 * contra uma parede; quanto menor, mais fácil passar rente a quinas. A ajuda de canto compensa a folga curta.
 */
export const PLAYER_HALF_SIZE = 0.45;

/** Folga máxima, em células, que o corpo tem para se mexer de cada lado dentro de uma célula livre. */
export const PLAYER_SLACK = 0.5 - PLAYER_HALF_SIZE;
