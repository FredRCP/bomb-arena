import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';

// Neve caindo por toda a tela, como um protetor de tela (só desenho). Três camadas dão profundidade: flocos pequenos e lentos
// ao fundo, médios no meio e grandes e rápidos na frente. Um vento suave vai e volta; cada floco balança de leve e, ao sair
// por baixo, volta ao topo. Os flocos ficam presos à tela (não acompanham o tremor da câmera).

const TEXTURE = 'snowflake';

interface Layer {
  count: number;
  scale: [number, number];
  speed: [number, number];
  alpha: [number, number];
  sway: number;
}

const LAYERS: readonly Layer[] = [
  { count: 110, scale: [0.3, 0.5], speed: [26, 44], alpha: [0.55, 0.8], sway: 10 },
  { count: 70, scale: [0.55, 0.85], speed: [56, 86], alpha: [0.7, 0.9], sway: 18 },
  { count: 26, scale: [1.0, 1.7], speed: [110, 160], alpha: [0.6, 0.85], sway: 28 },
];

interface Flake {
  image: Phaser.GameObjects.Image;
  speed: number;
  sway: number;
  phase: number;
  spin: number;
  depthFactor: number;
}

const rand = (range: readonly [number, number]): number => range[0] + Math.random() * (range[1] - range[0]);

export class SnowView {
  private readonly flakes: Flake[] = [];
  private last = performance.now();
  private clock = 0;

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(TEXTURE)) {
      const size = 48;
      const canvas = scene.textures.createCanvas(TEXTURE, size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        const c = size / 2;
        // Borda azulada e miolo branco: o floco aparece também sobre o gelo claro.
        const halo = ctx.createRadialGradient(c, c, 4, c, c, c);
        halo.addColorStop(0, 'rgba(255,255,255,1)');
        halo.addColorStop(0.55, 'rgba(255,255,255,0.95)');
        halo.addColorStop(0.8, 'rgba(150,200,235,0.75)');
        halo.addColorStop(1, 'rgba(150,200,235,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }
    for (const layer of LAYERS) {
      for (let i = 0; i < layer.count; i++) {
        const scale = rand(layer.scale);
        const image = scene.add
          .image(Math.random() * SCREEN_WIDTH, Math.random() * SCREEN_HEIGHT, TEXTURE)
          .setScrollFactor(0)
          .setDepth(20)
          .setScale(scale)
          .setAlpha(rand(layer.alpha));
        this.flakes.push({ image, speed: rand(layer.speed), sway: layer.sway * (0.5 + Math.random()), phase: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 2, depthFactor: scale });
      }
    }
  }

  update(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    const wind = Math.sin(this.clock * 0.35) * 26 + Math.sin(this.clock * 0.13) * 14; // rajadas lentas
    for (const flake of this.flakes) {
      flake.phase += dt * (1 + flake.depthFactor * 0.5);
      flake.image.y += flake.speed * dt;
      flake.image.x += (Math.cos(flake.phase) * flake.sway + wind * (0.4 + flake.depthFactor * 0.6)) * dt;
      flake.image.rotation += flake.spin * dt;
      if (flake.image.y > SCREEN_HEIGHT + 30) {
        flake.image.y = -30;
        flake.image.x = Math.random() * SCREEN_WIDTH;
      }
      if (flake.image.x < -30) flake.image.x = SCREEN_WIDTH + 20;
      else if (flake.image.x > SCREEN_WIDTH + 30) flake.image.x = -20;
    }
  }
}
