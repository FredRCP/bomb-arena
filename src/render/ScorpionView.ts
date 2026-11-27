import Phaser from 'phaser';
import { SCORPION_WARN_TICKS } from '../config/hazards';
import type { GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';
import { themeById, themeKey } from './theme';

const SPRITE_HEIGHT = 88; // altura do desenho em pixels (cauda incluída)
const FRAME_TICKS = 10;

// Escorpiões do Templo: usa as imagens scorpion1/2 (andando) e scorpion3 (ataque, quando há alguém perto); sem elas, desenha em código (vista de cima): corpo, pinças, cauda com ferrão e oito patas que mexem.
// Só desenho; as regras estão em core/scorpion.ts.

export class ScorpionView {
  private readonly g: Phaser.GameObjects.Graphics;
  /** Direção em que cada escorpião olha (radianos), guardada para ele não girar de volta ao parar. */
  private readonly angles = new Map<number, number>();
  private readonly images = new Map<number, Phaser.GameObjects.Image>();
  private readonly keys: string[];
  private readonly ready: boolean;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(9.1);
    const theme = themeById('temple');
    this.keys = ['scorpion1', 'scorpion2', 'scorpion3'].map((n) => themeKey(theme, n));
    this.ready = this.keys.every((k) => scene.textures.exists(k));
  }

  update(state: GameState): void {
    const g = this.g;
    g.clear();
    const sc = state.hazards?.scorpions;
    if (!sc) return;
    const t = state.tick;
    if (sc.warning) {
      const p = 1 - sc.warning.ticks / SCORPION_WARN_TICKS;
      const cx = (sc.warning.col + 0.5) * TILE_SIZE;
      const cy = (sc.warning.row + 0.5) * TILE_SIZE;
      g.fillStyle(0x2a1c0c, 0.45).fillEllipse(cx, cy + 6, 34 + 14 * p, 16 + 6 * p);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + t * 0.15;
        const r = 10 + 14 * p + (k % 3) * 3;
        g.fillStyle(0xb9a075, 0.75 - 0.4 * p).fillCircle(cx + Math.cos(a) * r + Math.sin(t * 0.7 + k) * 2, cy + 4 + Math.sin(a) * r * 0.45 - p * 8, 3 + (k % 3));
      }
    }
    const live = new Set<number>();
    for (const body of sc.list) {
      live.add(body.id);
      if (body.dx !== 0 || body.dy !== 0) this.angles.set(body.id, Math.atan2(body.dy, body.dx));
      const angle = this.angles.get(body.id) ?? Math.PI / 2;
      if (this.ready) {
        let image = this.images.get(body.id);
        if (!image) {
          image = this.scene.add.image(0, 0, this.keys[0]!).setOrigin(0.5, 0.62).setDepth(9.1);
          this.images.set(body.id, image);
        }
        const moving = body.dx !== 0 || body.dy !== 0;
        const near = state.players.some((p) => p.alive && Math.hypot(p.x - body.x, p.y - body.y) < 0.9);
        const frame = near ? 2 : moving ? Math.floor(t / FRAME_TICKS) % 2 : 0;
        g.fillStyle(0x000000, 0.25).fillEllipse(body.x * TILE_SIZE + 2, body.y * TILE_SIZE + 8, 46, 24);
        image.setTexture(this.keys[frame]!).setScale(SPRITE_HEIGHT / 160).setPosition(body.x * TILE_SIZE, body.y * TILE_SIZE).setRotation(angle - Math.PI / 2 + (moving ? Math.sin(t * 0.35) * 0.06 : 0));
        continue;
      }
      this.drawOne(g, body.x * TILE_SIZE, body.y * TILE_SIZE, angle, (body.id * 13 + t) * 0.35, body.dx !== 0 || body.dy !== 0 ? 1 : 0.3);
    }
    for (const id of this.angles.keys()) if (!live.has(id)) this.angles.delete(id);
    for (const [id, image] of this.images) {
      if (live.has(id)) continue;
      image.destroy();
      this.images.delete(id);
    }
  }

  /** Desenha um escorpião em (cx, cy) olhando para `angle`; `walk` é a fase das patas e `amount` o tamanho do movimento delas. */
  private drawOne(g: Phaser.GameObjects.Graphics, cx: number, cy: number, angle: number, walk: number, amount: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // (u, v): u para frente, v para o lado direito do bicho.
    const K = 1.4;
    const at = (u: number, v: number): { x: number; y: number } => ({ x: cx + (u * cos - v * sin) * K, y: cy + (u * sin + v * cos) * K });
    const line = (w: number, color: number, ...pts: Array<[number, number]>): void => {
      g.lineStyle(w, color, 1);
      for (let i = 1; i < pts.length; i++) {
        const a = at(...pts[i - 1]!);
        const b = at(...pts[i]!);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    };
    g.fillStyle(0x000000, 0.28).fillEllipse(cx + 2, cy + 8, 52, 26);
    // Patas (4 de cada lado), alternando.
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const phase = Math.sin(walk + i * 1.6 + (side > 0 ? Math.PI : 0)) * 4 * amount;
        const u0 = 6 - i * 5;
        line(3, 0x3a1f0e, [u0, side * 6], [u0 + phase * 0.5, side * 15], [u0 + phase - 3, side * 21]);
      }
    }
    // Cauda: sai de trás, sobe em arco e termina no ferrão (por cima do corpo, de cima para a frente).
    const sway = Math.sin(walk * 0.5) * 2.5 * amount;
    const tail: Array<[number, number]> = [[-12, 0], [-21, 2 + sway], [-27, 7 + sway], [-26, 13 + sway], [-19, 15 + sway * 0.6], [-12, 11]];
    line(7, 0x2b140a, ...tail);
    line(4.5, 0xa5522a, ...tail);
    const sting = at(-12, 11);
    g.fillStyle(0xd93a1e, 1).fillCircle(sting.x, sting.y, 4);
    // Corpo segmentado.
    for (const [u, w, c] of [[-8, 9, 0x7a3a1c], [-1, 11, 0x8d4624], [7, 12, 0x9f5229]] as const) {
      const p = at(u, 0);
      g.fillStyle(0x2b140a, 1).fillEllipse(p.x, p.y, w * 2 + 3, w * 1.7 + 3);
      g.fillStyle(c, 1).fillEllipse(p.x, p.y, w * 2, w * 1.7);
    }
    // Pinças na frente.
    for (const side of [-1, 1]) {
      const snap = Math.sin(walk * 0.8 + side) * 1.5 * amount;
      line(4, 0x2b140a, [10, side * 6], [18, side * 11 + snap], [24, side * 8]);
      const claw = at(26, side * 7);
      g.fillStyle(0x2b140a, 1).fillCircle(claw.x, claw.y, 6.5);
      g.fillStyle(0xb5602f, 1).fillCircle(claw.x, claw.y, 4.6);
    }
    // Olhinhos.
    for (const side of [-1, 1]) {
      const eye = at(13, side * 4);
      g.fillStyle(0xfff3c0, 1).fillCircle(eye.x, eye.y, 2);
    }
  }
}
