import Phaser from 'phaser';
import type { GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Desenho do avião do Lucas (superpoder): biplano que cruza a arena, com sombra no chão. Imagens em
// public/powers/airplane/plane1.png (biplano em três quartos, com o nariz virado para a esquerda). Sem as imagens,
// nada aparece (o poder continua funcionando). Só desenho: as regras estão em core/powers.ts.

const key = (name: string): string => `plane-${name}`;
/** Largura do avião na arena, em pixels lógicos (a célula tem 64). */
const WIDTH = 150;
/** Altura (em pixels) a que o avião voa acima do chão. */
const HEIGHT_ABOVE = 26;

export function preloadPlane(scene: Phaser.Scene): void {
  for (const name of ['plane1']) if (!scene.textures.exists(key(name))) scene.load.image(key(name), `powers/airplane/${name}.png`);
}

export class PlaneView {
  private readonly images = new Map<number, { plane: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse }>();

  constructor(private readonly scene: Phaser.Scene) {}

  update(state: GameState): void {
    if (!this.scene.textures.exists(key('plane1'))) return;
    const alive = new Set<number>();
    for (const plane of state.planes ?? []) {
      alive.add(plane.id);
      let view = this.images.get(plane.id);
      if (!view) {
        view = {
          plane: this.scene.add.image(0, 0, key('plane1')).setDepth(11.5),
          shadow: this.scene.add.ellipse(0, 0, WIDTH * 0.8, 26, 0x1b1f3b, 0.28).setDepth(9.5),
        };
        this.images.set(plane.id, view);
      }
      const x = plane.x * TILE_SIZE;
      const y = plane.y * TILE_SIZE;
      view.plane.setScale(WIDTH / view.plane.width);
      // O nariz da imagem aponta para a esquerda: espelha quando o avião vai para a direita e inclina como numa curva.
      const goingRight = plane.dir === 'right';
      view.plane.setFlipX(goingRight).setAngle(goingRight ? 7 : -7);
      const bob = Math.sin(state.tick / 6) * 3;
      view.plane.setPosition(x, y - HEIGHT_ABOVE + bob);
      view.shadow.setPosition(x, y + 20);
    }
    for (const [id, view] of this.images) {
      if (alive.has(id)) continue;
      view.plane.destroy();
      view.shadow.destroy();
      this.images.delete(id);
    }
  }
}
