import type { Direction } from '../core';

// Quais teclas cada jogador usa. Fica num arquivo próprio, sem Phaser, para poder ser testado:
// o teste garante que nenhuma tecla é usada por dois comandos ao mesmo tempo.
// Os nomes são os que o Phaser entende em `addKey('W')`, `addKey('SPACE')`, `addKey('UP')`...

export interface PlayerControls {
  /** Cada comando pode ter mais de uma tecla (qualquer uma vale). */
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  bomb: string[];
  /** Habilidade especial: detonar bomba-relógio / arremessar a bomba em que pisa. */
  special: string[];
}

/** Pessoas: 1 e 2 jogam no teclado (ou com controle); de 3 a 5 só com controle de videogame (o controle N comanda o jogador N). */
export type HumanId = 1 | 2 | 3 | 4 | 5;

/** Jogadores que têm teclas no teclado. */
export type KeyboardPlayerId = 1 | 2;

/**
 * Jogador 1: A S D W, Espaço (bomba), E (especial).
 * Jogador 2: 2 4 8 6 (do teclado numérico; os mesmos números da fileira de cima também funcionam), Enter (bomba),
 * 9 (especial). As setas também movem o jogador 2, para quem joga sem teclado numérico.
 */
export const PLAYER_CONTROLS: Record<KeyboardPlayerId, PlayerControls> = {
  1: { up: ['W'], down: ['S'], left: ['A'], right: ['D'], bomb: ['SPACE'], special: ['E'] },
  2: {
    up: ['NUMPAD_EIGHT', 'EIGHT', 'UP'],
    down: ['NUMPAD_TWO', 'TWO', 'DOWN'],
    left: ['NUMPAD_FOUR', 'FOUR', 'LEFT'],
    right: ['NUMPAD_SIX', 'SIX', 'RIGHT'],
    bomb: ['ENTER'],
    special: ['NUMPAD_NINE', 'NINE'],
  },
};

/**
 * Teclas da partida (valem para todos): R reinicia a rodada (ou, com a rodada acabada, vai para a próxima),
 * M liga/desliga o som, Esc pausa, Q volta ao menu (só com o jogo pausado ou a rodada acabada).
 */
export const RESTART_KEY = 'R';
export const MUTE_KEY = 'M';
export const PAUSE_KEY = 'ESC';
export const QUIT_KEY = 'Q';

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
