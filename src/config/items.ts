// Itens (power-ups) escondidos nos blocos. Importado pelo core: sem Phaser e sem navegador.

/** Chance de um bloco esconder um item. */
export const ITEM_DROP_CHANCE = 0.14;

/** Peso de cada tipo no sorteio (não precisa somar 1). */
export const ITEM_WEIGHTS = { bomb: 4, range: 4, speed: 3, kick: 2, pierce: 1, remote: 1, throw: 1, ghost: 1, invert: 1, slow: 1, vest: 1, hero: 1 } as const;

/** Limites, para ninguém ficar forte demais. Pegar um item no limite o gasta sem efeito. */
export const MAX_BOMBS_CAP = 8;
export const BOMB_RANGE_CAP = 8;
export const SPEED_ITEMS_CAP = 5;

/**
 * Velocidade que cada ponto de velocidade soma, em células por segundo.
 * Com 5 itens: 4,15 + 5 * 0,35 = 5,9 células/s (passo de 0,0983 célula). O passo precisa ficar abaixo do dobro
 * da folga do corpo (2 * 0,05): acima disso o inimigo do computador passaria direto do ponto de alinhamento e
 * ficaria "tremendo" de um lado para o outro sem conseguir parar no centro da célula. (Por isso o ponto vale
 * 0,35 e não mais: com 5 itens o limite de 0,1 por passo é o que manda.)
 */
export const SPEED_PER_ITEM = 0.35;

/** Item ruim "controles invertidos": esquerda vira direita e cima vira baixo por 8 segundos. */
export const INVERT_TICKS = 480;

/** Item ruim "pedra": cada um tira 1 ponto de velocidade, até este mínimo (a velocidade base nunca zera). */
export const MIN_SPEED_BONUS = -2;

/** Itens ruins: a IA os evita de propósito. */
export const BAD_ITEMS = ['invert', 'slow'] as const;

/** Super-herói: imune às chamas por 10 segundos. */
export const HERO_TICKS = 600;

/** Depois que o colete aguenta uma explosão ele se desfaz; a chama ainda acesa não pode matar no passo seguinte. */
export const VEST_BREAK_SHIELD_TICKS = 45;
