import Phaser from 'phaser';
import type { GameEvent, GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Desenho do elefantinho da Ana (superpoder): corre na direção do disparo, com nuvem de poeira ao aparecer e ao sumir.
// Imagens em public/powers/elephant/ (run1-4 de perfil, down1-2 de frente, up1-2 de costas, puff1-3, butt). Sem as
// imagens, nada aparece (o poder continua funcionando). Só desenho: as regras estão em core/powers.ts.

const FILES = ['run1', 'run2', 'run3', 'run4', 'down1', 'down2', 'up1', 'up2', 'puff1', 'puff2', 'puff3', 'butt'];
const key = (name: string): string => `ele-${name}`;
/** Altura do elefante na arena, em pixels lógicos (a célula tem 64). */
const HEIGHT = 92;

export function preloadElephant(scene: Phaser.Scene): void {
  for (const name of FILES) if (!scene.textures.exists(key(name))) scene.load.image(key(name), `powers/elephant/${name}.png`);
}

export class ElephantView {
  private readonly images = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  private ready(): boolean {
    return this.scene.textures.exists(key('run1'));
  }

  /** Nuvem de poeira que cresce em 3 quadros e some (3 x 110 ms). */
  private puff(col: number, row: number, size = 1): void {
    if (!this.scene.textures.exists(key('puff1'))) return;
    const x = (col + 0.5) * TILE_SIZE;
    const y = (row + 0.5) * TILE_SIZE;
    const sprite = this.scene.add.image(x, y, key('puff1')).setDepth(12);
    const fit = (): void => void sprite.setScale((TILE_SIZE * 1.4 * size) / Math.max(sprite.width, sprite.height));
    fit();
    [2, 3].forEach((n, i) => this.scene.time.delayedCall(110 * (i + 1), () => sprite.active && (sprite.setTexture(key(`puff${n}`)), fit())));
    this.scene.tweens.add({ targets: sprite, alpha: 0, delay: 260, duration: 180, onComplete: () => sprite.destroy() });
  }

  onEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'powerUsed') this.puff(event.col, event.row);
      else if (event.type === 'elephantGone') this.puff(event.col, event.row, 0.8);
    }
  }

  update(state: GameState): void {
    if (!this.ready()) return;
    const alive = new Set<number>();
    for (const elephant of state.elephants ?? []) {
      alive.add(elephant.id);
      let image = this.images.get(elephant.id);
      if (!image) {
        image = this.scene.add.image(0, 0, key('run1')).setOrigin(0.5, 1).setDepth(7);
        this.images.set(elephant.id, image);
      }
      const frame = Math.floor(state.tick / 4);
      const name = elephant.dir === 'down' ? `down${(frame % 2) + 1}` : elephant.dir === 'up' ? `up${(frame % 2) + 1}` : `run${(frame % 4) + 1}`;
      image.setTexture(key(name)).setScale(HEIGHT / image.height);
      image.setFlipX(elephant.dir === 'left');
      image.setPosition(elephant.x * TILE_SIZE, (elephant.y + 0.5) * TILE_SIZE - 2);
    }
    for (const [id, image] of this.images) {
      if (alive.has(id)) continue;
      image.destroy();
      this.images.delete(id);
    }
  }
}
