import Phaser from 'phaser';
import { startPadMemory, stepPadNav } from './padNavLogic';
import type { NavAction, PadMemory } from './padNavLogic';
import { readPad } from './padReader';
import { TouchNav } from './touchNav';
import { wantsTouchControls } from './touchUi';

// Navegação de menus com o controle: direcional/alavanca move, A confirma, B volta.
// Cada aperto vale uma vez; segurar a direção repete devagar (como uma tecla). A conta está em padNavLogic.ts.

export type { NavAction } from './padNavLogic';

export class PadNav {
  private readonly memory = new Map<number, PadMemory>();

  private readonly touch: TouchNav | null;

  constructor(private readonly scene: Phaser.Scene) {
    // Em celular/tablet, botões na tela fazem o papel das setas, do OK e do voltar (a abertura já avança com um toque).
    this.touch = scene.scene.key !== 'Title' && wantsTouchControls() ? new TouchNav(scene) : null;
  }

  /** Chame a cada quadro. Devolve as ações novas de cada controle (índice do controle + ação). */
  poll(nowMs: number): Array<{ pad: number; action: NavAction }> {
    const result: Array<{ pad: number; action: NavAction }> = [];
    if (this.touch) for (const action of this.touch.poll(nowMs)) result.push({ pad: 0, action });
    const plugin = this.scene.input.gamepad;
    if (!plugin) return result;
    for (let index = 0; index < plugin.total; index++) {
      const snapshot = readPad(plugin.getPad(index));
      if (!snapshot) continue;
      const mem = this.memory.get(index);
      if (!mem) {
        // Primeira vez que esta tela vê o controle: só memoriza o que está apertado, sem gerar ação.
        this.memory.set(index, startPadMemory(snapshot, nowMs));
        continue;
      }
      for (const action of stepPadNav(mem, snapshot, nowMs)) result.push({ pad: index, action });
    }
    return result;
  }
}
