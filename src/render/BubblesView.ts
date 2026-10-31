import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';

// Bolhas de ar subindo por toda a tela do Fundo do Mar, como um protetor de tela (só desenho). Cada bolha sobe balançando de
// leve; ao sair por cima, volta por baixo. Ficam presas à tela (não acompanham o tremor da câmera).

const TEXTURE = 'bubble-air';
const COUNT = 46;

interface Bubble {
  image: Phaser.GameObjects.Image;
  speed: number;
  sway: number;
  phase: number;
  x: number;
}

export class BubblesView {
  private readonly bubbles: Bubble[] = [];
  private last = performance.now();
  private clock = 0;

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) {
      const size = 64;
      const canvas = scene.textures.createCanvas(TEXTURE, size, size);
      const ctx = canvas?.getContext();
      if (canvas && ctx) {
        const c = size / 2;
        const body = ctx.createRadialGradient(c, c, c * 0.3, c, c, c - 2);
        body.addColorStop(0, 'rgba(210,245,255,0.05)');
        body.addColorStop(0.85, 'rgba(190,235,255,0.22)');
        body.addColorStop(1, 'rgba(235,250,255,0.85)');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(c, c, c - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.ellipse(c - 13, c - 14, 9, 5, -0.7, 0, Math.PI * 2);
        ctx.fill();
        canvas.refresh();
      }
    }
    for (let i = 0; i < COUNT; i++) {
      const scale = 0.18 + Math.random() * Math.random() * 0.8;
      const x = Math.random() * SCREEN_WIDTH;
      const image = scene.add.image(x, Math.random() * SCREEN_HEIGHT, TEXTURE).setScale(scale).setAlpha(0.5 + Math.random() * 0.4).setScrollFactor(0).setDepth(20);
      this.bubbles.push({ image, speed: 28 + scale * 90 + Math.random() * 20, sway: 8 + Math.random() * 18, phase: Math.random() * Math.PI * 2, x });
    }
  }

  update(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    for (const b of this.bubbles) {
      b.image.y -= b.speed * dt;
      if (b.image.y < -40) {
        b.image.y = SCREEN_HEIGHT + 40;
        b.x = Math.random() * SCREEN_WIDTH;
      }
      b.image.x = b.x + Math.sin(this.clock * 1.4 + b.phase) * b.sway;
    }
  }
}
