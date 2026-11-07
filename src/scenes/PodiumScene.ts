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
      [1, WIDTH / 2 - 215, 175],
      [0, WIDTH / 2, 225],
      [2, WIDTH / 2 + 215, 135],
    ];
    const baseY = 600;
    this.spotlight(WIDTH / 2, baseY - 225);
    // Chão do pódio (sombra embaixo dos degraus).
    this.add.ellipse(WIDTH / 2, baseY + 6, 760, 34, 0x000000, 0.28).setDepth(1);
    for (const [rank, x, height] of steps) {
      const entry = ranked[rank];
      if (!entry) continue;
      const color = STEP_COLORS[rank]!;
      const top = baseY - height;
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x000000, 0.25).fillRoundedRect(x - 90, top + 8, 190, height, 10);
      g.fillStyle(color.front, 1).fillRoundedRect(x - 95, top, 190, height, 10);
      g.fillStyle(0xffffff, 0.16).fillRect(x - 91, top + 26, 26, height - 32);
      g.fillStyle(0x000000, 0.14).fillRect(x + 62, top + 26, 29, height - 32);
      g.fillStyle(color.top, 1).fillRoundedRect(x - 95, top, 190, 24, { tl: 10, tr: 10, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 0.45).fillRoundedRect(x - 85, top + 4, 170, 5, 2);
      g.lineStyle(4, 0x1b1f3b, 1).strokeRoundedRect(x - 95, top, 190, height, 10);
      const character = characterById(characters[entry.id]);
      // Número (ou, no 1º lugar, a taça com o número dentro) e a plaquinha de pontos, sempre dentro da coluna.
      const plaqueY = baseY - 30;
      if (rank === 0) {
        const trophy = this.add.graphics().setDepth(3);
        this.drawTrophy(trophy, x, top + 26, 1.0);
        this.add.text(x, top + 66, '1', { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: '#7a4f00' }).setOrigin(0.5).setDepth(4);
      } else {
        const numberY = top + 24 + (plaqueY - 24 - (top + 24)) / 2;
        this.add.text(x, numberY, String(rank + 1), { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 7 }).setOrigin(0.5).setDepth(3);
      }
      const plaque = this.add.graphics().setDepth(3);
      plaque.fillStyle(0x1b1f3b, 0.85).fillRoundedRect(x - 62, plaqueY - 18, 124, 36, 18);
      this.add.text(x, plaqueY, `${entry.points} pts`, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(4);
      this.add.text(x, baseY + 34, character.name, { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: rank === 0 ? '#ffe66d' : '#ffffff', stroke: '#1b1f3b', strokeThickness: 6 }).setOrigin(0.5).setDepth(3);
      const figure = this.makeFigure(character.id, x, top);
      this.tweens.add({ targets: figure, y: figure.y - (rank === 0 ? 24 : 12), duration: rank === 0 ? 420 : 640, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rank * 140 });
    }
    // Estrelinhas piscando em volta do campeão.
    for (let i = 0; i < 8; i++) {
      const star = this.add.star(WIDTH / 2 + Math.cos(i * 0.785) * 250, baseY - 330 + Math.sin(i * 0.785) * 90, 5, 5, 12, 0xfff3a0, 0.9).setDepth(2);
      this.tweens.add({ targets: star, alpha: 0.15, scale: 0.5, duration: 600 + i * 90, yoyo: true, repeat: -1, delay: i * 120 });
    }
    if (ranked[0]) this.add.text(WIDTH / 2, 128, `🏆 ${characterById(characters[ranked[0].id]).name} é o campeão! 🏆`, { fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 6 }).setOrigin(0.5);

    // Do 4º em diante.
    ranked.slice(3, 7).forEach((entry, i) => {
      const name = characterById(characters[entry.id]).name;
      this.add.text(WIDTH / 2, 692 + i * 26, `${i + 4}º  ${name} · ${entry.points} pts`, { fontFamily: FONT, fontSize: '22px', color: '#e3e7ff' }).setOrigin(0.5).setDepth(3);
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
      image.setScale(190 / image.height);
      return this.add.container(x, topY + 4, [image]).setDepth(4);
    }
    return addCharacter(this, character, x, topY - 70, 70).setDepth(4);
  }

  /** Raios de luz girando devagar atrás do campeão. */
  private spotlight(x: number, y: number): void {
    const g = this.add.graphics({ x, y }).setDepth(1);
    g.fillStyle(0xfff3a0, 0.08);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillTriangle(0, 0, Math.cos(a - 0.12) * 430, Math.sin(a - 0.12) * 430, Math.cos(a + 0.12) * 430, Math.sin(a + 0.12) * 430);
    }
    this.tweens.add({ targets: g, angle: 360, duration: 40000, repeat: -1 });
  }

  /** Taça dourada desenhada com formas simples; (x, y) é o topo da borda da taça. */
  private drawTrophy(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
    const k = scale;
    const outline = 0x1b1f3b;
    // alças
    g.lineStyle(7 * k, outline, 1).strokeCircle(x - 44 * k, y + 28 * k, 15 * k).strokeCircle(x + 44 * k, y + 28 * k, 15 * k);
    g.lineStyle(4 * k, 0xffd84a, 1).strokeCircle(x - 44 * k, y + 28 * k, 15 * k).strokeCircle(x + 44 * k, y + 28 * k, 15 * k);
    // haste e base
    g.fillStyle(0xe0a800, 1).fillRect(x - 8 * k, y + 78 * k, 16 * k, 18 * k);
    g.fillStyle(0x7a4f00, 1).fillRoundedRect(x - 34 * k, y + 108 * k, 68 * k, 16 * k, 4 * k);
    g.fillStyle(0xb57a00, 1).fillRoundedRect(x - 26 * k, y + 94 * k, 52 * k, 16 * k, 4 * k);
    // taça
    g.fillStyle(0xffd84a, 1).fillRoundedRect(x - 40 * k, y, 80 * k, 86 * k, { tl: 6 * k, tr: 6 * k, bl: 40 * k, br: 40 * k });
    g.fillStyle(0xffffff, 0.45).fillRoundedRect(x - 30 * k, y + 8 * k, 10 * k, 52 * k, 5 * k);
    g.lineStyle(3 * k, outline, 1).strokeRoundedRect(x - 40 * k, y, 80 * k, 86 * k, { tl: 6 * k, tr: 6 * k, bl: 40 * k, br: 40 * k });
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
