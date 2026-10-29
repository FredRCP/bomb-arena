import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';

// Neve caindo por toda a tela da fase (só desenho). Cada floco é uma imagem pequena que desce balançando de leve e volta
// ao topo ao sair por baixo.

const TEXTURE = 'snowflake';
const COUNT = 150;

interface Flake {
  image: Phaser.GameObjects.Image;
  speed: number;
  sway: number;
  phase: number;
  drift: number;
}

export class SnowView {
  private readonly flakes: Flake[] = [];
  private last = performance.now();
  private readonly left: number;
  private readonly top: number;

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) {
      const g = scene.add.graphics();
      g.fillStyle(0x7fb8e0, 0.5).fillCircle(8, 8, 8); // borda azulada: aparece também sobre o gelo claro
      g.fillStyle(0xffffff, 0.8).fillCircle(8, 8, 6);
      g.fillStyle(0xffffff, 1).fillCircle(8, 8, 3);
      g.generateTexture(TEXTURE, 16, 16);
      g.destroy();
    }
    // A câmera da fase desliza: a tela começa em (scrollX, scrollY), não em (0, 0).
    this.left = scene.cameras.main.scrollX;
    this.top = scene.cameras.main.scrollY;
    for (let i = 0; i < COUNT; i++) {
      const size = 0.35 + Math.random() * 0.9;
      const image = scene.add
        .image(this.left + Math.random() * SCREEN_WIDTH, this.top + Math.random() * SCREEN_HEIGHT, TEXTURE)
        .setDepth(20)
        .setScale(size)
        .setAlpha(0.45 + Math.random() * 0.45);
      this.flakes.push({ image, speed: 28 + size * 46 + Math.random() * 20, sway: 8 + Math.random() * 22, phase: Math.random() * Math.PI * 2, drift: -6 + Math.random() * 12 });
    }
  }

  update(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    for (const flake of this.flakes) {
      flake.phase += dt * 1.4;
      flake.image.y += flake.speed * dt;
      flake.image.x += (Math.cos(flake.phase) * flake.sway + flake.drift) * dt;
      if (flake.image.y > this.top + SCREEN_HEIGHT + 10) {
        flake.image.y = this.top - 10;
        flake.image.x = this.left + Math.random() * SCREEN_WIDTH;
      }
      if (flake.image.x < this.left - 10) flake.image.x = this.left + SCREEN_WIDTH + 5;
      else if (flake.image.x > this.left + SCREEN_WIDTH + 10) flake.image.x = this.left - 5;
    }
  }
}
