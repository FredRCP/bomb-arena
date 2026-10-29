import Phaser from 'phaser';
import type { GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Desenho do avião do Lucas (superpoder): biplano que cruza a arena, com sombra no chão. Imagens em
// public/powers/airplane/ (plane1 e plane2 = hélice em dois quadros, de perfil, virado para a direita). Sem as imagens,
// nada aparece (o poder continua funcionando). Só desenho: as regras estão em core/powers.ts.

const key = (name: string): string => `plane-${name}`;
/** Largura do avião na arena, em pixels lógicos (a célula tem 64). */
const WIDTH = 150;

export function preloadPlane(scene: Phaser.Scene): void {
  for (const name of ['plane1', 'plane2']) if (!scene.textures.exists(key(name))) scene.load.image(key(name), `powers/airplane/${name}.png`);
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
      view.plane.setTexture(key(Math.floor(state.tick / 3) % 2 === 0 ? 'plane1' : 'plane2')).setScale(WIDTH / view.plane.width);
      // Para a direita: como está. Esquerda: espelhado. Cima/baixo: girado (o avião "cai" ou "sobe" na tela).
      view.plane.setFlipX(plane.dir === 'left');
      view.plane.setAngle(plane.dir === 'down' ? 90 : plane.dir === 'up' ? -90 : 0);
      const bob = Math.sin(state.tick / 6) * 3;
      view.plane.setPosition(x, y - 22 + bob);
      view.shadow.setPosition(x, y + 20);
      view.shadow.setSize(plane.dir === 'up' || plane.dir === 'down' ? 26 : WIDTH * 0.8, plane.dir === 'up' || plane.dir === 'down' ? WIDTH * 0.8 : 26);
    }
    for (const [id, view] of this.images) {
      if (alive.has(id)) continue;
      view.plane.destroy();
      view.shadow.destroy();
      this.images.delete(id);
    }
  }
}
