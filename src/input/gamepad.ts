import type { Direction } from '../core';

// Controles de videogame (Xbox, PlayStation e genéricos). Sem Phaser: recebe uma "foto" do controle e devolve
// o que ela significa, então tem teste. O mapeamento é o padrão do navegador (Gamepad API "standard"):
// A/✕ = botão 0, B/○ = 1, X/□ = 2, Y/△ = 3, Select = 8, Start = 9, direcional = 12 a 15.

export interface PadSnapshot {
  /** Alavanca esquerda: -1 a 1 (x: esquerda/direita, y: cima/baixo). */
  stickX: number;
  stickY: number;
  /** Quais botões estão apertados agora (índice do botão). Botão que não existe = falso. */
  pressed: readonly boolean[];
}

export const PAD_BUTTONS = {
  bomb: [0, 2], // A/✕ ou X/□
  special: [1, 3], // B/○ ou Y/△
  power: [4, 5, 6, 7], // LB/RB/LT/RT (os botões de cima)
  back: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** Alavanca fraca (abaixo disto) é ignorada: controles gastos "andam sozinhos". */
export const STICK_DEADZONE = 0.5;

const any = (pad: PadSnapshot, buttons: readonly number[]): boolean => buttons.some((b) => pad.pressed[b] === true);

/** Direção pedida: o direcional tem prioridade; senão a alavanca, no eixo mais inclinado. Sem diagonais. */
export function padDirection(pad: PadSnapshot): Direction | null {
  if (pad.pressed[PAD_BUTTONS.up]) return 'up';
  if (pad.pressed[PAD_BUTTONS.down]) return 'down';
  if (pad.pressed[PAD_BUTTONS.left]) return 'left';
  if (pad.pressed[PAD_BUTTONS.right]) return 'right';
  const ax = Math.abs(pad.stickX);
  const ay = Math.abs(pad.stickY);
  if (Math.max(ax, ay) < STICK_DEADZONE) return null;
  if (ax >= ay) return pad.stickX < 0 ? 'left' : 'right';
  return pad.stickY < 0 ? 'up' : 'down';
}

export const padBomb = (pad: PadSnapshot): boolean => any(pad, PAD_BUTTONS.bomb);
export const padPower = (pad: PadSnapshot): boolean => any(pad, PAD_BUTTONS.power);
export const padSpecial = (pad: PadSnapshot): boolean => any(pad, PAD_BUTTONS.special);
export const padStart = (pad: PadSnapshot): boolean => pad.pressed[PAD_BUTTONS.start] === true;
export const padBack = (pad: PadSnapshot): boolean => pad.pressed[PAD_BUTTONS.back] === true;
