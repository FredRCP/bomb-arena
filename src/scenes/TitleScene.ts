import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { CHARACTERS, characterById } from '../characters/characters';
import { PadNav } from '../input/padNav';
import { hasGameParams } from '../menu/gameConfig';
import { loadSettings } from '../menu/settingsStorage';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { addCardArt, addCharacter, preloadCharacters } from '../render/CharacterView';
import { placeArena, SCREEN_HEIGHT, SCREEN_WIDTH } from '../render/layout';
import { preloadFlames } from '../render/FlameSprites';
import { hasItemIcon, ITEM_KINDS, itemTexture, preloadItems } from '../render/ItemSprites';
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
    music.playMenu(); // a tela de início toca as mesmas músicas dos menus (o navegador só libera o som depois do primeiro toque)
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

    this.addDecorations();

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

  /** Enfeites da abertura: os 7 virtuais flutuando de cada lado do nome, itens girando no alto e estrelinhas piscando. */
  private addDecorations(): void {
    // Estrelinhas piscando (atrás de tudo o que vem depois).
    for (let i = 0; i < 26; i++) {
      const x = 40 + ((i * 197) % (SCREEN_WIDTH - 80));
      const y = 30 + ((i * 131) % 420);
      const star = this.add.text(x, y, '✦', { fontFamily: FONT, fontSize: `${14 + (i % 4) * 6}px`, color: i % 3 === 0 ? '#ffe66d' : '#ffffff' }).setOrigin(0.5).setAlpha(0.15).setScrollFactor(0);
      this.tweens.add({ targets: star, alpha: 0.9, scale: 1.3, duration: 700 + (i % 5) * 220, yoyo: true, repeat: -1, delay: (i * 137) % 1500 });
    }
    // Itens (power-ups): uma fileira no alto e dois grupinhos nas laterais, flutuando e balançando.
    const spots: Array<[number, number]> = [];
    for (let i = 0; i < 6; i++) spots.push([500 + i * 120, 62 + (i % 2) * 22]);
    spots.push([60, 410], [170, 450], [1430, 410], [1540, 450], [320, 60], [1280, 60]);
    spots.forEach(([x, y], index) => {
      const kind = ITEM_KINDS[(index * 5 + 3) % ITEM_KINDS.length]!;
      if (!hasItemIcon(this, kind)) return;
      const icon = this.add.image(x, y, itemTexture(kind)).setDisplaySize(50, 50).setScrollFactor(0).setAlpha(0);
      this.tweens.add({ targets: icon, alpha: 1, duration: 400, delay: 300 + index * 90 });
      this.tweens.add({ targets: icon, y: y - 12, angle: index % 2 === 0 ? 10 : -10, duration: 900 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: index * 120 });
    });
    // Os 7 virtuais, três à esquerda e quatro à direita do nome.
    const blobs = CHARACTERS.filter((c) => !c.custom);
    const places: Array<[number, number]> = [[110, 150], [245, 275], [360, 140], [1240, 140], [1355, 265], [1480, 150], [1490, 330]];
    blobs.forEach((blob, index) => {
      const place = places[index];
      if (!place) return;
      const piece = addCharacter(this, blob, place[0], place[1], 36);
      piece.setScrollFactor(0).setAlpha(0);
      this.tweens.add({ targets: piece, alpha: 1, duration: 450, delay: 500 + index * 140 });
      this.tweens.add({ targets: piece, y: place[1] - 16, duration: 800 + index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: index * 150 });
      this.tweens.add({ targets: piece, angle: index % 2 === 0 ? 6 : -6, duration: 1100 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  update(time: number): void {
    if (!this.padNav) return;
    if (this.padNav.poll(time).length > 0) this.next();
  }

  private next(): void {
    if (this.leaving) return;
    this.leaving = true;
    sfx.play('confirm');
    music.sync(); // o toque que avançou a tela libera o áudio: a música começa agora se o navegador a tinha segurado
    this.scene.start('Menu');
  }
}
