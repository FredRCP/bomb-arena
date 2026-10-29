import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { CHARACTERS, characterById } from '../characters/characters';
import { PadNav } from '../input/padNav';
import { hasGameParams } from '../menu/gameConfig';
import { loadSettings } from '../menu/settingsStorage';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { addCardArt, preloadCharacters } from '../render/CharacterView';
import { placeArena, SCREEN_HEIGHT, SCREEN_WIDTH } from '../render/layout';
import { preloadFlames } from '../render/FlameSprites';
import { preloadItems } from '../render/ItemSprites';
import { preloadThemes } from '../render/theme';
import { addMenuBackground } from '../render/menuBackground';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const WIDTH = ARENA_COLS * TILE_SIZE;
const HEIGHT = ARENA_ROWS * TILE_SIZE;

/** Tela de abertura: o nome do jogo e "pressione qualquer tecla". É a primeira cena; endereços de teste pulam direto para a partida. */
export class TitleScene extends Phaser.Scene {
  private padNav!: PadNav;
  private leaving = false;

  constructor() {
    super({ key: 'Title' });
  }

  /** Pede as imagens dos personagens caricatura (se existirem em public/characters/). */
  preload(): void {
    preloadCharacters(this);
    preloadThemes(this);
    preloadFlames(this);
    preloadItems(this);
  }

  create(): void {
    music.release(); // a tela de início fica sem música
    // Aberto com parâmetros de teste no endereço (?players=1...): pula tudo e começa a jogar direto.
    if (hasGameParams(window.location.search)) {
      this.scene.start('Game');
      return;
    }
    this.leaving = false;
    placeArena(this);
    sfx.setLevel(loadSettings().volume);
    addMenuBackground(this);

    // Os personagens de corpo inteiro (a arte da tela de escolha), em fila embaixo do nome do jogo.
    const ids = CHARACTERS.filter((c) => c.custom && c.sprites).map((c) => c.id);
    const step = SCREEN_WIDTH / (ids.length + 0.4);
    ids.forEach((id, index) => {
      const art = addCardArt(this, characterById(id), 0, 0, 52, 400);
      art.setScrollFactor(0).setPosition(step * (index + 0.7), SCREEN_HEIGHT - 215);
      art.setAlpha(0);
      this.tweens.add({ targets: art, alpha: 1, duration: 450, delay: 200 + index * 160 });
      this.tweens.add({ targets: art, y: art.y - 14, duration: 650 + index * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 900 + index * 110 });
    });

    this.add
      .text(WIDTH / 2, HEIGHT * 0.22, 'BOMB ARENA', { fontFamily: FONT, fontSize: '110px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 12 })
      .setOrigin(0.5);
    this.add.text(WIDTH / 2, HEIGHT * 0.22 + 78, 'nome provisório', { fontFamily: FONT, fontSize: '24px', color: '#e3e7ff' }).setOrigin(0.5);

    const prompt = this.add
      .text(WIDTH / 2, HEIGHT * 0.41, 'Pressione qualquer tecla', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 5 })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.padNav = new PadNav(this);
    // Um pequeno atraso evita que a tecla que abriu a página já avance a tela.
    this.time.delayedCall(300, () => this.input.keyboard?.on('keydown', () => this.next()));
    this.input.on('pointerdown', () => this.next());
  }

  update(time: number): void {
    if (!this.padNav) return;
    if (this.padNav.poll(time).length > 0) this.next();
  }

  private next(): void {
    if (this.leaving) return;
    this.leaving = true;
    sfx.play('confirm');
    this.scene.start('Menu');
  }
}
