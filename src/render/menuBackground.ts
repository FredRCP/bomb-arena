import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './layout';

// Fundo alegre das telas (menu, abertura, partida): um degradê colorido com bolhas claras subindo devagar.
// Desenhado em faixas horizontais, que funcionam em qualquer modo de renderização do Phaser.

const BANDS = 36;

function mix(a: number, b: number, t: number): number {
  const channel = (shift: number): number => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export interface BackgroundColors {
  top: number;
  bottom: number;
}

/** Roxo-azulado em cima, azul-turquesa embaixo: bem mais alegre do que o preto de antes. */
export const CHEERFUL: BackgroundColors = { top: 0x6a4cf0, bottom: 0x1ab5e6 };

/**
 * Cobre a tela inteira, seja qual for o deslocamento da câmera (a arena fica fora da origem, veja layout.ts).
 * Devolve os objetos criados, caso a cena queira esconder o fundo.
 */
export function addMenuBackground(scene: Phaser.Scene, colors: BackgroundColors = CHEERFUL, bubbles = true): Phaser.GameObjects.GameObject[] {
  const x0 = scene.cameras.main.scrollX;
  const y0 = scene.cameras.main.scrollY;
  const made: Phaser.GameObjects.GameObject[] = [];
  const g = scene.add.graphics().setDepth(-100);
  const bandHeight = SCREEN_HEIGHT / BANDS;
  for (let i = 0; i < BANDS; i++) {
    g.fillStyle(mix(colors.top, colors.bottom, i / (BANDS - 1)), 1);
    g.fillRect(x0, y0 + i * bandHeight, SCREEN_WIDTH, bandHeight + 1);
  }
  made.push(g);
  if (!bubbles) return made;

  // Bolhas: posições e tamanhos fixos (nada de sorteio; é só enfeite), cada uma subindo no seu ritmo.
  for (let i = 0; i < 14; i++) {
    const radius = 18 + ((i * 37) % 46);
    const x = x0 + ((i * 211 + 90) % SCREEN_WIDTH);
    const y = y0 + ((i * 127 + 60) % SCREEN_HEIGHT);
    const bubble = scene.add.circle(x, y, radius, 0xffffff, 0.1 + (i % 3) * 0.04).setDepth(-99);
    scene.tweens.add({ targets: bubble, y: y - 90 - (i % 4) * 30, duration: 5200 + i * 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    made.push(bubble);
  }
  return made;
}

/** Plaquinha escura e translúcida atrás de um bloco de texto, para ele ler bem sobre o fundo colorido. */
export function addPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(-50);
  g.fillStyle(0x14163a, 0.55);
  g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 28);
  return g;
}
