import Phaser from 'phaser';
import type { GameEvent, GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Fogo em imagem (public/effects/fire-ball.png e fire-jet.png, 8 quadros cada, desenhados pela Gemini).
// Cada explosão vira uma bola de fogo na célula da bomba e, em cada direção, um "jato" de chama esticado até a ponta.
// Só desenho: o core já decidiu quais células queimam. Sem as imagens, o ArenaRenderer usa o fogo feito em código.

const BALL = 'fire-ball';
const JET = 'fire-jet';
const FRAMES = 8;
/** Um quadro de animação dura este tanto de passos da simulação (60 por segundo). */
const TICKS_PER_FRAME = 4;
const BALL_SIZE = 112;
/** Um jato nunca é esticado além deste comprimento: arms longos ganham vários jatos em fila. */
const MAX_JET = 150;
const JET_THICKNESS = 80;

export function preloadFlames(scene: Phaser.Scene): void {
  scene.load.spritesheet(BALL, 'effects/fire-ball.png', { frameWidth: 128, frameHeight: 128 });
  scene.load.spritesheet(JET, 'effects/fire-jet.png', { frameWidth: 128, frameHeight: 64 });
}

const DIRECTIONS = [
  { dc: -1, dr: 0, angle: 0 },
  { dc: 1, dr: 0, angle: Math.PI },
  { dc: 0, dr: -1, angle: Math.PI / 2 },
  { dc: 0, dr: 1, angle: -Math.PI / 2 },
] as const;

export class FlameSprites {
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private used = 0;
  /** Células onde bombas explodiram e até que passo a chama delas dura. */
  private readonly centers = new Map<number, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** As imagens do fogo foram carregadas? Se não, quem chama usa o fogo desenhado em código. */
  get ready(): boolean {
    return this.scene.textures.exists(BALL) && this.scene.textures.exists(JET);
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
    return image.setTexture(texture).setVisible(true);
  }

  /** Redesenha o fogo do estado atual (chamado a cada quadro da tela). */
  update(state: GameState): void {
    this.used = 0;
    const cols = state.arena.cols;
    const burning = new Map<number, number>();
    for (const flame of state.flames) burning.set(flame.row * cols + flame.col, flame.ticksLeft);
    const covered = new Set<number>();
    const frameAt = (salt: number): number => (Math.floor(state.tick / TICKS_PER_FRAME) + salt * 3) % FRAMES;

    for (const [index, expiry] of this.centers) {
      if (state.tick > expiry || !burning.has(index)) {
        if (state.tick > expiry) this.centers.delete(index);
        continue;
      }
      const col = index % cols;
      const row = Math.floor(index / cols);
      const alpha = Math.min(1, (burning.get(index) ?? 0) / 10);
      covered.add(index);
      DIRECTIONS.forEach((dir, d) => {
        let k = 0;
        while (burning.has((row + dir.dr * (k + 1)) * cols + col + dir.dc * (k + 1))) {
          k++;
          covered.add((row + dir.dr * k) * cols + col + dir.dc * k);
        }
        if (k === 0) return;
        const length = (k + 0.5) * TILE_SIZE;
        const segments = Math.ceil(length / MAX_JET);
        const seg = length / segments;
        for (let i = 0; i < segments; i++) {
          const from = i * seg;
          const jet = this.next(JET);
          jet.setFrame(frameAt(index + d + i));
          jet.setOrigin(1, 0.5).setRotation(dir.angle).setAlpha(alpha).setDisplaySize(seg + 6, JET_THICKNESS);
          jet.setPosition((col + 0.5) * TILE_SIZE + dir.dc * from, (row + 0.5) * TILE_SIZE + dir.dr * from);
        }
      });
      const ball = this.next(BALL);
      ball.setFrame(frameAt(index)).setOrigin(0.5, 0.58).setRotation(0).setAlpha(alpha).setDisplaySize(BALL_SIZE, BALL_SIZE);
      ball.setPosition((col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE);
    }

    // Chama que não ficou ligada a nenhuma explosão conhecida: pelo menos uma bolinha de fogo.
    for (const [index, ticksLeft] of burning) {
      if (covered.has(index)) continue;
      const ball = this.next(BALL);
      ball.setFrame(frameAt(index)).setOrigin(0.5, 0.58).setRotation(0).setAlpha(Math.min(1, ticksLeft / 10)).setDisplaySize(BALL_SIZE * 0.85, BALL_SIZE * 0.85);
      ball.setPosition(((index % cols) + 0.5) * TILE_SIZE, (Math.floor(index / cols) + 0.5) * TILE_SIZE);
    }

    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
  }
}
