import Phaser from 'phaser';
import type { GameEvent, GameState } from '../core';
import { FLAME_TICKS } from '../config/bombs';
import { TILE_SIZE } from './ArenaRenderer';

// Fogo em imagem (public/effects/fire/*.png, recortado do esquema da Fred): cada explosão é feita de PEÇAS por célula,
// emendadas sem falha: o centro (cruz), o meio do braço (repetido, espelhado de dois em dois) e a ponta arredondada.
// No começo há um estouro (burst0..5) e os braços crescem; no fim eles afinam e somem.
// Só desenho: o core já decidiu quais células queimam. Sem as imagens, o ArenaRenderer usa o fogo feito em código.

const CENTER = 'fire-center';
const MID = 'fire-mid';
const TIP = 'fire-tip';
const BURST = 'fire-burst';
const BURSTS = 6;
/** Espessura do braço em relação à célula. */
const THICK = 1;

export function preloadFlames(scene: Phaser.Scene): void {
  scene.load.image(CENTER, 'effects/fire/center.png');
  scene.load.image(MID, 'effects/fire/mid.png');
  scene.load.image(TIP, 'effects/fire/tip.png');
  for (let i = 0; i < BURSTS; i++) scene.load.image(`${BURST}${i}`, `effects/fire/burst${i}.png`);
}

const DIRECTIONS = [
  { dc: 1, dr: 0, angle: 0 },
  { dc: -1, dr: 0, angle: Math.PI },
  { dc: 0, dr: -1, angle: -Math.PI / 2 },
  { dc: 0, dr: 1, angle: Math.PI / 2 },
] as const;

export class FlameSprites {
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private used = 0;
  /** Células onde bombas explodiram e até que passo a chama delas dura. */
  private readonly centers = new Map<number, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** As imagens do fogo foram carregadas? Se não, quem chama usa o fogo desenhado em código. */
  get ready(): boolean {
    return this.scene.textures.exists(CENTER) && this.scene.textures.exists(MID) && this.scene.textures.exists(TIP);
  }

  onEvents(events: readonly GameEvent[], state: GameState, flameTicks: number): void {
    for (const event of events) {
      if (event.type === 'bombExploded') this.centers.set(event.row * state.arena.cols + event.col, state.tick + flameTicks + 1);
    }
  }

  private next(texture: string): Phaser.GameObjects.Image {
    let image = this.pool[this.used];
    if (!image) {
      image = this.scene.add.image(0, 0, texture).setDepth(5.1);
      this.pool.push(image);
    }
    this.used++;
    return image.setTexture(texture).setVisible(true).setFlip(false, false).setRotation(0).setOrigin(0.5, 0.5).setAlpha(1);
  }

  /** Redesenha o fogo do estado atual (chamado a cada quadro da tela). */
  update(state: GameState): void {
    this.used = 0;
    const cols = state.arena.cols;
    const burning = new Map<number, number>();
    for (const flame of state.flames) burning.set(flame.row * cols + flame.col, flame.ticksLeft);
    const covered = new Set<number>();
    const T = TILE_SIZE;

    for (const [index, expiry] of this.centers) {
      if (state.tick > expiry || !burning.has(index)) {
        if (state.tick > expiry) this.centers.delete(index);
        continue;
      }
      const col = index % cols;
      const row = Math.floor(index / cols);
      const left = burning.get(index) ?? 0;
      const p = Math.min(1, Math.max(0, 1 - left / FLAME_TICKS));
      const alpha = Math.min(1, left / 8);
      const thick = p < 0.2 ? 0.55 + 0.45 * (p / 0.2) : p < 0.55 ? 1 : 1 - 0.7 * ((p - 0.55) / 0.45);
      const grow = Math.min(1, p / 0.2);
      const cx = (col + 0.5) * T;
      const cy = (row + 0.5) * T;
      covered.add(index);
      DIRECTIONS.forEach((dir) => {
        let k = 0;
        while (burning.has((row + dir.dr * (k + 1)) * cols + col + dir.dc * (k + 1))) {
          k++;
          covered.add((row + dir.dr * k) * cols + col + dir.dc * k);
        }
        if (k === 0) return;
        const shown = Math.max(1, Math.ceil(k * grow));
        for (let i = 1; i <= shown; i++) {
          const piece = this.next(i === shown ? TIP : MID);
          piece.setOrigin(0, 0.5).setRotation(dir.angle).setAlpha(alpha);
          if (i !== shown && i % 2 === 0) piece.setFlipX(true);
          piece.setDisplaySize(i === shown ? T * 0.9 : T + 1, T * THICK * thick);
          piece.setPosition(cx + dir.dc * (i - 0.5) * T, cy + dir.dr * (i - 0.5) * T);
        }
      });
      if (p < 0.5) {
        const burst = this.next(`${BURST}${Math.min(BURSTS - 1, Math.floor((p / 0.5) * BURSTS))}`);
        burst.setAlpha(alpha).setDisplaySize(T * 1.3, T * 1.3).setPosition(cx, cy);
      } else {
        const c = this.next(CENTER);
        c.setAlpha(alpha).setDisplaySize(T * (0.6 + 0.4 * thick), T * (0.6 + 0.4 * thick)).setPosition(cx, cy);
      }
    }

    // Chama que não ficou ligada a nenhuma explosão conhecida: pelo menos uma bolinha de fogo.
    for (const [index, ticksLeft] of burning) {
      if (covered.has(index)) continue;
      const c = this.next(CENTER);
      c.setAlpha(Math.min(1, ticksLeft / 8)).setDisplaySize(T * 1.1, T * 1.1).setPosition(((index % cols) + 0.5) * T, (Math.floor(index / cols) + 0.5) * T);
    }

    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
  }
}
