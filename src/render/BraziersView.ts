import Phaser from 'phaser';
import type { Arena } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Braseiros com chamas nos quatro cantos da arena (Egito): uma tigela de bronze presa ao bloco do canto, com fogo que balança
// e um brilho quente em volta. Tudo desenhado em código; o fogo usa o relógio da tela (anima até na pausa, é só enfeite).

const FLAME_LAYERS = [
  { color: 0xe23d0f, h: 1, w: 1 },
  { color: 0xff8a1f, h: 0.78, w: 0.78 },
  { color: 0xffd84a, h: 0.52, w: 0.52 },
] as const;

export class BraziersView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly spots: Array<{ x: number; y: number; phase: number }> = [];

  constructor(private readonly scene: Phaser.Scene, arena: Arena) {
    this.g = scene.add.graphics().setDepth(6.8);
    this.glow = scene.add.graphics().setDepth(6.75).setBlendMode(Phaser.BlendModes.ADD);
    const corners: Array<[number, number]> = [[0, 0], [arena.cols - 1, 0], [0, arena.rows - 1], [arena.cols - 1, arena.rows - 1]];
    corners.forEach(([col, row], i) => this.spots.push({ x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE + 12, phase: i * 1.7 }));
  }

  update(): void {
    const t = this.scene.time.now / 1000;
    const g = this.g;
    const glow = this.glow;
    g.clear();
    glow.clear();
    for (const s of this.spots) {
      const flicker = 0.85 + 0.15 * Math.sin(t * 9 + s.phase) + 0.08 * Math.sin(t * 23 + s.phase * 2);
      // Brilho quente (somado à cena, por cima do bloco e do chão em volta).
      glow.fillStyle(0xff7a1a, 0.05 * flicker).fillCircle(s.x, s.y - 14, 60);
      glow.fillStyle(0xff9a2a, 0.08 * flicker).fillCircle(s.x, s.y - 14, 40);
      glow.fillStyle(0xffc14a, 0.12 * flicker).fillCircle(s.x, s.y - 14, 24);
      // Tigela: borda escura, corpo de bronze e brasa por cima.
      g.fillStyle(0x2c1d0c, 1).fillEllipse(s.x, s.y, 38, 12);
      g.fillStyle(0x9a6a22, 1).fillPoints([{ x: s.x - 17, y: s.y }, { x: s.x + 17, y: s.y }, { x: s.x + 10, y: s.y + 13 }, { x: s.x - 10, y: s.y + 13 }], true);
      g.fillStyle(0xd9a441, 1).fillRect(s.x - 15, s.y + 1, 30, 3);
      g.fillStyle(0x5c3c12, 1).fillRect(s.x - 5, s.y + 13, 10, 5);
      g.fillStyle(0xff5a1a, 1).fillEllipse(s.x, s.y - 1, 30, 8);
      // Chama: três gotas sobrepostas, o topo balançando para os lados.
      for (const [li, layer] of FLAME_LAYERS.entries()) {
        const h = 34 * layer.h * (0.88 + 0.22 * Math.sin(t * 11 + s.phase + li));
        const w = 12 * layer.w;
        const sway = 4 * Math.sin(t * 6 + s.phase + li * 0.8);
        const pts: Array<{ x: number; y: number }> = [];
        const steps = 8;
        for (let k = 0; k <= steps; k++) {
          const u = k / steps;
          const half = w * Math.pow(1 - u, 0.75) * (0.55 + 0.45 * Math.sin(u * Math.PI * 0.9 + 0.3));
          pts.push({ x: s.x - half + sway * u * u, y: s.y - 2 - h * u });
        }
        for (let k = steps; k >= 0; k--) {
          const u = k / steps;
          const half = w * Math.pow(1 - u, 0.75) * (0.55 + 0.45 * Math.sin(u * Math.PI * 0.9 + 0.3));
          pts.push({ x: s.x + half + sway * u * u, y: s.y - 2 - h * u });
        }
        g.fillStyle(layer.color, 1).fillPoints(pts, true);
      }
    }
  }
}
