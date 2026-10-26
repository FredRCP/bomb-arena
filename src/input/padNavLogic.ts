import { padBack, padBomb, padDirection } from './gamepad';
import type { PadSnapshot } from './gamepad';

// A parte "de conta" da navegação de menus com o controle (sem Phaser, para ter teste).
// Cada aperto vale uma vez; segurar a direção repete devagar (como uma tecla).

export type NavAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

export const REPEAT_DELAY_MS = 400;
export const REPEAT_RATE_MS = 140;

export interface PadMemory {
  direction: string | null;
  since: number;
  lastFire: number;
  confirm: boolean;
  back: boolean;
}

/**
 * Memória inicial de um controle que a tela acabou de "ver". Ela já nasce com o que está apertado AGORA:
 * assim, o botão que o jogador ainda segura da tela anterior (o A que o levou até aqui) não conta como um aperto
 * novo e a tela não avança duas vezes. É preciso soltar e apertar de novo.
 */
export function startPadMemory(snapshot: PadSnapshot, nowMs: number): PadMemory {
  return {
    direction: padDirection(snapshot),
    since: nowMs,
    lastFire: nowMs,
    confirm: padBomb(snapshot),
    back: padBack(snapshot) || snapshot.pressed[1] === true,
  };
}

/** Um quadro de navegação: compara o controle com a memória, atualiza a memória e devolve as ações novas. */
export function stepPadNav(mem: PadMemory, snapshot: PadSnapshot, nowMs: number): NavAction[] {
  const actions: NavAction[] = [];

  const direction = padDirection(snapshot);
  if (direction !== mem.direction) {
    mem.direction = direction;
    mem.since = nowMs;
    mem.lastFire = nowMs;
    if (direction) actions.push(direction);
  } else if (direction && nowMs - mem.since > REPEAT_DELAY_MS && nowMs - mem.lastFire > REPEAT_RATE_MS) {
    mem.lastFire = nowMs;
    actions.push(direction);
  }

  const confirm = padBomb(snapshot);
  if (confirm && !mem.confirm) actions.push('confirm');
  mem.confirm = confirm;
  const back = padBack(snapshot) || snapshot.pressed[1] === true;
  if (back && !mem.back) actions.push('back');
  mem.back = back;
  return actions;
}
