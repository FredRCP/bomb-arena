import Phaser from 'phaser';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { characterById } from '../characters/characters';
import { createMatch } from '../core';
import type { RankedPlayer } from '../core';
import { PadNav } from '../input/padNav';
import type { GameConfig } from '../menu/gameConfig';
import { addCharacter } from '../render/CharacterView';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { placeArena } from '../render/layout';
import { addMenuBackground, addPanel } from '../render/menuBackground';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const WIDTH = ARENA_COLS * TILE_SIZE;
const HEIGHT = ARENA_ROWS * TILE_SIZE;

export interface PodiumData {
  /** Classificação final da partida, do 1º ao último. */
  ranked: RankedPlayer[];
  /** Personagem de cada jogador (id do jogador -> id do personagem). */
  characters: Record<number, string>;
  config: GameConfig;
}

/** Cores do ouro, da prata e do bronze (faces da frente e de cima de cada degrau). */
const STEP_COLORS = [
  { front: 0xe0a800, top: 0xffd84a },
  { front: 0x9aa3ad, top: 0xd5dbe2 },
  { front: 0xb5651d, top: 0xe39a5a },
] as const;

/**
 * Pódio do fim da partida: o 1º no degrau do meio e mais alto, o 2º à esquerda e o 3º à direita, com confete e fanfarra.
 * Do 4º em diante aparecem numa lista embaixo. Enter joga de novo; Esc/Q volta ao menu.
 */
export class PodiumScene extends Phaser.Scene {
  private padNav!: PadNav;
  private data0!: PodiumData;
  private ready = false;

  constructor() {
    super({ key: 'Podium' });
  }

  init(data: PodiumData): void {
    this.data0 = data;
    this.ready = false;
  }

  create(): void {
    placeArena(this);
    addMenuBackground(this);
    addPanel(this, WIDTH / 2, HEIGHT / 2 + 10, WIDTH - 40, HEIGHT - 20);
    this.add
      .text(WIDTH / 2, 62, 'PÓDIO', { fontFamily: FONT, fontSize: '76px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 9 })
      .setOrigin(0.5);

    const { ranked, characters } = this.data0;
    // Posições dos degraus: [índice na classificação, x do centro, altura do degrau].
    const steps: Array<[number, number, number]> = [
      [1, WIDTH / 2 - 215, 150],
      [0, WIDTH / 2, 215],
      [2, WIDTH / 2 + 215, 105],
    ];
    const baseY = 600;
    for (const [rank, x, height] of steps) {
      const entry = ranked[rank];
      if (!entry) continue;
      const color = STEP_COLORS[rank]!;
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(color.front, 1).fillRoundedRect(x - 95, baseY - height, 190, height, 10);
      g.fillStyle(color.top, 1).fillRoundedRect(x - 95, baseY - height, 190, 22, { tl: 10, tr: 10, bl: 0, br: 0 });
      g.lineStyle(4, 0x1b1f3b, 1).strokeRoundedRect(x - 95, baseY - height, 190, height, 10);
      this.add.text(x, baseY - height + 62, String(rank + 1), { fontFamily: FONT, fontSize: '70px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 7 }).setOrigin(0.5).setDepth(3);
      const character = characterById(characters[entry.id]);
      this.add.text(x, baseY - height + 118, `${entry.points} pts`, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 5 }).setOrigin(0.5).setDepth(3);
      this.add.text(x, baseY + 28, character.name, { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: rank === 0 ? '#ffe66d' : '#ffffff', stroke: '#1b1f3b', strokeThickness: 6 }).setOrigin(0.5).setDepth(3);
      const figure = this.makeFigure(character.id, x, baseY - height);
      this.tweens.add({ targets: figure, y: figure.y - (rank === 0 ? 26 : 12), duration: rank === 0 ? 420 : 640, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rank * 140 });
    }
    if (ranked[0]) this.add.text(WIDTH / 2, 140, `${characterById(characters[ranked[0].id]).name} é o campeão!`, { fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 6 }).setOrigin(0.5);

    // Do 4º em diante.
    ranked.slice(3, 7).forEach((entry, i) => {
      const name = characterById(characters[entry.id]).name;
      this.add.text(WIDTH / 2, 668 + i * 28, `${i + 4}º  ${name} · ${entry.points} pts`, { fontFamily: FONT, fontSize: '22px', color: '#e3e7ff' }).setOrigin(0.5).setDepth(3);
    });
    this.add.text(WIDTH / 2, HEIGHT - 26, 'Enter: jogar de novo   ·   Esc: menu', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5).setDepth(3);

    this.confetti();
    music.fadeOut(300);
    sfx.play('fanfare');
    this.time.delayedCall(2600, () => music.playMenu());

    this.padNav = new PadNav(this);
    this.time.delayedCall(700, () => {
      this.ready = true;
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.ready || event.repeat) return;
      if (event.code === 'Escape' || event.code === 'KeyQ') this.menu();
      else if (event.code === 'Enter' || event.code === 'Space') this.again();
    });
  }

  update(time: number): void {
    if (!this.padNav || !this.ready) return;
    for (const { action } of this.padNav.poll(time)) {
      if (action === 'confirm') this.again();
      else if (action === 'back') this.menu();
    }
  }

  /** O personagem em pé em cima do degrau: pose de vitória se tiver arte de corpo inteiro; senão o rosto/desenho. */
  private makeFigure(characterId: string, x: number, topY: number): Phaser.GameObjects.Container {
    const character = characterById(characterId);
    const key = `char-${character.id}-win`;
    if (character.sprites && this.textures.exists(key)) {
      const image = this.add.image(0, 0, key).setOrigin(0.5, 1);
      image.setScale(210 / image.height);
      return this.add.container(x, topY + 4, [image]).setDepth(4);
    }
    return addCharacter(this, character, x, topY - 70, 70).setDepth(4);
  }

  /** Confete caindo (retângulos coloridos girando), em laço. */
  private confetti(): void {
    const colors = [0xffe66d, 0xff6b6b, 0x74c0fc, 0x8ce99a, 0xf783ac, 0xffa94d];
    for (let i = 0; i < 70; i++) {
      const piece = this.add.rectangle(30 + ((i * 97) % (WIDTH - 60)), -20 - ((i * 53) % 400), 10, 18, colors[i % colors.length], 1).setDepth(5);
      this.tweens.add({ targets: piece, y: HEIGHT + 30, angle: 360 * (i % 2 === 0 ? 2 : -2), duration: 3200 + ((i * 131) % 2600), repeat: -1, delay: (i * 70) % 2400, onRepeat: () => { piece.x = 30 + Math.random() * (WIDTH - 60); } });
    }
  }

  private again(): void {
    sfx.play('confirm');
    const { config, characters } = this.data0;
    this.scene.start('Game', { config: { ...config, seed: config.seed + 10 }, match: createMatch(config.wins), characters });
  }

  private menu(): void {
    sfx.play('confirm');
    this.scene.start('Menu');
  }
}
