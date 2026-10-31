import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../render/layout';

// Fundo da fase numa cena própria, por baixo da partida: assim a arena pode sumir (a câmera da partida fica transparente)
// e o fundo aparece sozinho, com o nome da fase, nos primeiros segundos de cada partida. Só desenho.

export interface BackdropData {
  /** Chave da textura do fundo (já carregada). */
  key: string;
  /** Nome da fase, mostrado por uns segundos (vazio = nada). */
  title?: string;
}

export class BackdropScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Backdrop' });
  }

  create(data: BackdropData): void {
    this.add.image(0, 0, data.key).setOrigin(0, 0).setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT);
    if (!data.title) return;
    const text = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.5, data.title, { fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif', fontSize: '84px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 12 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: text, alpha: 1, duration: 500 });
    this.tweens.add({ targets: text, alpha: 0, delay: 1700, duration: 400 });
  }
}
