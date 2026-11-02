import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';

// Fumaça e fagulhas flutuando por toda a tela do Vulcão, como um protetor de tela (só desenho). Ficam presas à tela
// (não acompanham o tremor da câmera). As fagulhas sobem piscando; a fumaça sobe devagar e vai crescendo.

const SMOKE = 'ember-smoke';
const SPARK = 'ember-spark';
const SMOKE_COUNT = 16;
const SPARK_COUNT = 54;
const CLOUD = 'ember-cloud';
const CLOUD_COUNT = 10;

interface Floater {
  image: Phaser.GameObjects.Image;
  speed: number;
  sway: number;
  phase: number;
  x: number;
  base: number;
  grow: number;
}

export class EmbersView {
  private readonly smoke: Floater[] = [];
  private readonly sparks: Floater[] = [];
  /** Nuvens pequenas de fumaça que passam de lado, devagar, por cima do cenário (só enfeite, bem transparentes). */
  private readonly clouds: Floater[] = [];
  private last = performance.now();
  private clock = 0;

  constructor(scene: Phaser.Scene) {
    this.makeTextures(scene);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const scale = 1.2 + Math.random() * 1.6;
      const x = Math.random() * SCREEN_WIDTH;
      const image = scene.add.image(x, Math.random() * (SCREEN_HEIGHT + 200), SMOKE).setScale(scale).setAlpha(0.1 + Math.random() * 0.12).setScrollFactor(0).setDepth(19);
      this.smoke.push({ image, speed: 16 + Math.random() * 22, sway: 20 + Math.random() * 40, phase: Math.random() * Math.PI * 2, x, base: scale, grow: 0.05 + Math.random() * 0.06 });
    }
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const scale = 0.7 + Math.random() * 0.9;
      const x = Math.random() * (SCREEN_WIDTH + 400) - 200;
      const image = scene.add.image(x, 80 + Math.random() * (SCREEN_HEIGHT - 120), CLOUD).setScale(scale, scale * (0.7 + Math.random() * 0.3)).setAlpha(0.36 + Math.random() * 0.2).setScrollFactor(0).setDepth(18.5).setFlipX(Math.random() < 0.5);
      this.clouds.push({ image, speed: 10 + Math.random() * 26, sway: 6 + Math.random() * 14, phase: Math.random() * Math.PI * 2, x, base: scale, grow: 0 });
    }
    for (let i = 0; i < SPARK_COUNT; i++) {
      const scale = 0.14 + Math.random() * 0.3;
      const x = Math.random() * SCREEN_WIDTH;
      const image = scene.add.image(x, Math.random() * SCREEN_HEIGHT, SPARK).setScale(scale).setAlpha(0.9).setScrollFactor(0).setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
      this.sparks.push({ image, speed: 40 + scale * 160 + Math.random() * 50, sway: 10 + Math.random() * 30, phase: Math.random() * Math.PI * 2, x, base: scale, grow: 0 });
    }
  }

  private makeTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(SMOKE)) {
      const size = 128;
      const canvas = scene.textures.createCanvas(SMOKE, size, size);
      const ctx = canvas?.getContext();
      if (canvas && ctx) {
        const c = size / 2;
        const body = ctx.createRadialGradient(c, c, 4, c, c, c);
        body.addColorStop(0, 'rgba(70,60,60,0.9)');
        body.addColorStop(0.6, 'rgba(60,52,52,0.4)');
        body.addColorStop(1, 'rgba(50,45,45,0)');
        ctx.fillStyle = body;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }
    if (!scene.textures.exists(CLOUD)) {
      // Nuvem de fumaça: vários círculos macios (gradiente) lado a lado, cinza-quente.
      const w = 256;
      const h = 128;
      const canvas = scene.textures.createCanvas(CLOUD, w, h);
      const ctx = canvas?.getContext();
      if (canvas && ctx) {
        const blobs: Array<[number, number, number]> = [[70, 78, 44], [118, 64, 54], [168, 76, 46], [100, 82, 40], [146, 84, 38], [205, 86, 32]];
        for (const [bx, by, r] of blobs) {
          const g = ctx.createRadialGradient(bx, by, 2, bx, by, r);
          g.addColorStop(0, 'rgba(92,80,78,0.85)');
          g.addColorStop(0.65, 'rgba(78,68,66,0.5)');
          g.addColorStop(1, 'rgba(70,60,58,0)');
          ctx.fillStyle = g;
          ctx.fillRect(bx - r, by - r, r * 2, r * 2);
        }
        canvas.refresh();
      }
    }
    if (!scene.textures.exists(SPARK)) {
      const size = 64;
      const canvas = scene.textures.createCanvas(SPARK, size, size);
      const ctx = canvas?.getContext();
      if (canvas && ctx) {
        const c = size / 2;
        const body = ctx.createRadialGradient(c, c, 1, c, c, c);
        body.addColorStop(0, 'rgba(255,240,170,1)');
        body.addColorStop(0.3, 'rgba(255,150,40,0.85)');
        body.addColorStop(1, 'rgba(255,70,10,0)');
        ctx.fillStyle = body;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }
  }

  update(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    for (const s of this.smoke) {
      s.image.y -= s.speed * dt;
      s.image.setScale(s.image.scaleX + s.grow * dt);
      if (s.image.y < -160) {
        s.image.y = SCREEN_HEIGHT + 160;
        s.image.setScale(s.base);
        s.x = Math.random() * SCREEN_WIDTH;
      }
      s.image.x = s.x + Math.sin(this.clock * 0.5 + s.phase) * s.sway;
    }
    for (const s of this.clouds) {
      s.x -= s.speed * dt; // passam da direita para a esquerda
      if (s.x < -260) {
        s.x = SCREEN_WIDTH + 260;
        s.image.y = 80 + Math.random() * (SCREEN_HEIGHT - 120);
      }
      s.image.x = s.x;
      s.image.y += Math.sin(this.clock * 0.4 + s.phase) * s.sway * dt;
    }
    for (const s of this.sparks) {
      s.image.y -= s.speed * dt;
      if (s.image.y < -20) {
        s.image.y = SCREEN_HEIGHT + 20;
        s.x = Math.random() * SCREEN_WIDTH;
      }
      s.image.x = s.x + Math.sin(this.clock * 2 + s.phase) * s.sway;
      s.image.setAlpha(0.45 + 0.5 * Math.abs(Math.sin(this.clock * 5 + s.phase * 3)));
    }
  }
}
