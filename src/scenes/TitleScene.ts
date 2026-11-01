import Phaser from 'phaser';
import { music } from '../audio/music';
import { hasGameParams } from '../menu/gameConfig';
import { preloadFlames } from '../render/FlameSprites';
import { preloadItems } from '../render/ItemSprites';
import { preloadCharacters } from '../render/CharacterView';
import { preloadThemes } from '../render/theme';

/**
 * Primeira cena: só carrega as imagens e segue direto para o menu (a antiga tela de "pressione qualquer tecla"
 * foi juntada ao menu, que já mostra o nome do jogo). Endereços de teste (?players=1...) pulam para a partida.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Title' });
  }

  preload(): void {
    preloadCharacters(this);
    preloadThemes(this);
    preloadFlames(this);
    preloadItems(this);
  }

  create(): void {
    if (hasGameParams(window.location.search)) {
      this.scene.start('Game');
      return;
    }
    music.playMenu(); // o navegador só libera o som depois do primeiro toque: o menu chama music.sync() nele
    this.scene.start('Menu');
  }
}
