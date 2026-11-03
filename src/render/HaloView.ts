import Phaser from 'phaser';
import type { GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Halo do Filippe: um círculo luminoso de 3 células de raio em volta dele enquanto o poder durar. Só desenho.

export class HaloView {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(7);
  }

  update(state: GameState): void {
    const g = this.g;
    g.clear();
    for (const halo of state.halos ?? []) {
      const owner = state.players.find((p) => p.id === halo.owner);
      if (!owner || !owner.alive) continue;
      const x = owner.x * TILE_SIZE;
      const y = owner.y * TILE_SIZE;
      const r = halo.radius * TILE_SIZE;
      const pulse = 0.5 + 0.5 * Math.sin(state.tick / 8);
      const fade = halo.ticks < 90 ? (state.tick % 10 < 5 ? 0.4 : 1) : 1;
      g.fillStyle(0x7ff5d4, 0.12 * fade).fillCircle(x, y, r);
      g.fillStyle(0xc8fff0, 0.1 * fade).fillCircle(x, y, r * 0.7);
      g.lineStyle(4, 0x9ffbe4, (0.55 + 0.3 * pulse) * fade).strokeCircle(x, y, r);
      g.lineStyle(2, 0xffffff, 0.35 * fade).strokeCircle(x, y, r - 6);
    }
  }
}
