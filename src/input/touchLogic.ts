import type { Direction } from '../core';

// A parte "de conta" do controle por toque (sem Phaser, para ter teste): alavanca virtual e botões redondos.

/** Fração do raio da alavanca abaixo da qual o toque é ignorado (o dedo parado no centro não anda). */
export const STICK_DEAD_ZONE = 0.28;

/** Direção pedida por um toque a (dx, dy) do centro da alavanca: vale o eixo mais afastado. Perto do centro: nenhuma. */
export function stickDirection(dx: number, dy: number, radius: number): Direction | null {
  if (Math.hypot(dx, dy) < radius * STICK_DEAD_ZONE) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/** O ponto (px, py) está dentro do círculo de centro (cx, cy) e raio r? */
export function inCircle(px: number, py: number, cx: number, cy: number, r: number): boolean {
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r;
}
