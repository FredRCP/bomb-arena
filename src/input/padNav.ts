import Phaser from 'phaser';
import { padBack, padBomb, padDirection } from './gamepad';
import { readPad } from './padReader';

// Navegação de menus com o controle: direcional/alavanca move, A confirma, B volta.
// Cada aperto vale uma vez; segurar a direção repete devagar (como uma tecla).

export type NavAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

const REPEAT_DELAY_MS = 400;
const REPEAT_RATE_MS = 140;

interface PadMemory {
  direction: string | null;
  since: number;
  lastFire: number;
  confirm: boolean;
  back: boolean;
}

export class PadNav {
  private readonly memory = new Map<number, PadMemory>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Chame a cada quadro. Devolve as ações novas de cada controle (índice do controle + ação). */
  poll(nowMs: number): Array<{ pad: number; action: NavAction }> {
    const result: Array<{ pad: number; action: NavAction }> = [];
    const plugin = this.scene.input.gamepad;
    if (!plugin) return result;
    for (let index = 0; index < plugin.total; index++) {
      const snapshot = readPad(plugin.getPad(index));
      if (!snapshot) continue;
      const mem = this.memory.get(index) ?? { direction: null, since: 0, lastFire: 0, confirm: false, back: false };
      this.memory.set(index, mem);

      const direction = padDirection(snapshot);
      if (direction !== mem.direction) {
        mem.direction = direction;
        mem.since = nowMs;
        mem.lastFire = nowMs;
        if (direction) result.push({ pad: index, action: direction });
      } else if (direction && nowMs - mem.since > REPEAT_DELAY_MS && nowMs - mem.lastFire > REPEAT_RATE_MS) {
        mem.lastFire = nowMs;
        result.push({ pad: index, action: direction });
      }

      const confirm = padBomb(snapshot);
      if (confirm && !mem.confirm) result.push({ pad: index, action: 'confirm' });
      mem.confirm = confirm;
      const back = padBack(snapshot) || snapshot.pressed[1] === true;
      if (back && !mem.back) result.push({ pad: index, action: 'back' });
      mem.back = back;
    }
    return result;
  }
}
