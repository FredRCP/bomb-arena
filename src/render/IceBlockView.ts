import Phaser from 'phaser';
import type { GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Bloco de gelo sobre quem está congelado (poder da Van, bola de neve...): o jogador aparece por dentro, porque o bloco é
// desenhado meio transparente por cima dele. O bloco racha conforme o tempo acaba (inteiro → rachado → quase quebrando).
// Sem as imagens ice1..3 (public/effects), o contorno de gelo desenhado em código (Effects.ts) continua valendo.

/** Altura do bloco em pixels: um pouco maior que o boneco (88 px) para ele caber dentro. */
const BLOCK_HEIGHT = 112;

export function hasIceBlocks(scene: Phaser.Scene): boolean {
  return [1, 2, 3].every((i) => scene.textures.exists(`ice${i}`));
}

export class IceBlockView {
  private readonly images = new Map<number, Phaser.GameObjects.Image>();
  private readonly ready: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    this.ready = hasIceBlocks(scene);
  }

  update(state: GameState): void {
    if (!this.ready) return;
    const wraps = state.hazards?.mummy?.wrappedAt ?? {};
    for (const p of state.players) {
      const left = p.frozenTicks ?? 0;
      const wrapped = wraps[p.id] !== undefined && left > 0 && state.tick - wraps[p.id]! <= 182; // enfaixado: é o casulo, não o gelo
      let image = this.images.get(p.id);
      if (!p.alive || left <= 0 || wrapped || p.stunned) {
        image?.setVisible(false);
        continue;
      }
      if (!image) {
        image = this.scene.add.image(0, 0, 'ice1').setDepth(10.45);
        this.images.set(p.id, image);
      }
      const frame = left > 90 ? 1 : left > 40 ? 2 : 3;
      const shake = left < 40 ? Math.sin(state.tick * 1.8) * 2 : 0; // quase solto: o gelo treme
      const tex = this.scene.textures.get(`ice${frame}`).getSourceImage();
      image
        .setTexture(`ice${frame}`)
        .setScale(BLOCK_HEIGHT / tex.height)
        .setAlpha(0.6)
        .setPosition(p.x * TILE_SIZE + shake, p.y * TILE_SIZE - 4)
        .setVisible(true);
    }
  }
}
