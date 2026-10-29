import Phaser from 'phaser';
import { preloadCharacters } from '../render/CharacterView';
import { preloadFlames } from '../render/FlameSprites';
import { preloadItems } from '../render/ItemSprites';
import { preloadElephant } from '../render/ElephantView';
import { addMenuBackground } from '../render/menuBackground';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../render/layout';
import { preloadThemes } from '../render/theme';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
/** Imagem opcional de abertura (arte pronta, 1600x900). Se o arquivo não existir, vale o desenho feito no código. */
export const SPLASH_FILE = 'loading/splash.jpg';
/** Tempo mínimo (ms) que a tela fica aberta, para a tela não piscar. */
const MIN_SHOW_MS = 2500;
/** Depois disso, um toque ou tecla já pula a tela. */
const SKIP_AFTER_MS = 1200;

/** Primeira cena: carrega as imagens (sem barra de progresso) e fica um instante na tela antes de abrir a abertura (onde aparecem os personagens). */
export class LoadingScene extends Phaser.Scene {
  private startedAt = 0;
  private leaving = false;

  constructor() {
    super({ key: 'Loading' });
  }

  preload(): void {
    this.startedAt = this.time.now;
    this.load.on('loaderror', () => undefined); // a imagem de abertura é opcional
    this.load.image('splash', SPLASH_FILE);
    this.buildUi();
    this.time.delayedCall(60, () => document.getElementById('boot')?.remove()); // o fundo do Phaser já está desenhado
    preloadCharacters(this);
    preloadThemes(this);
    preloadFlames(this);
    preloadElephant(this);
    preloadItems(this);
  }

  create(): void {
    this.leaving = false;
    const cx = SCREEN_WIDTH / 2;
    if (this.textures.exists('splash') && this.textures.get('splash').key !== '__MISSING') {
      const img = this.add.image(cx, SCREEN_HEIGHT / 2, 'splash').setDepth(-50);
      img.setScale(Math.max(SCREEN_WIDTH / img.width, SCREEN_HEIGHT / img.height));
    }
    // Quanto tempo ainda falta para completar o mínimo (o carregamento em si pode ter demorado).
    const elapsed = this.time.now - this.startedAt;
    this.time.delayedCall(Math.max(0, MIN_SHOW_MS - elapsed), () => this.next());
    this.time.delayedCall(Math.max(0, SKIP_AFTER_MS - elapsed), () => {
      this.input.once('pointerdown', () => this.next());
      this.input.keyboard?.once('keydown', () => this.next());
    });
  }

  private next(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('Title');
  }

  private buildUi(): void {
    addMenuBackground(this);
    // Só o nome do jogo e uma bolinha pulando enquanto carrega (sem barra nem porcentagem).
    const cx = SCREEN_WIDTH / 2;
    this.add
      .text(cx, SCREEN_HEIGHT / 2 - 20, 'BOMB ARENA', { fontFamily: FONT, fontSize: '110px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 12 })
      .setOrigin(0.5)
      .setName('loadingTitle');
    const dots = [0, 1, 2].map((i) => this.add.circle(cx - 40 + i * 40, SCREEN_HEIGHT / 2 + 100, 11, 0xffffff).setName('loadingDot'));
    dots.forEach((d, i) => this.tweens.add({ targets: d, y: d.y - 18, duration: 380, yoyo: true, repeat: -1, delay: i * 140, ease: 'Sine.easeOut' }));
  }
}
