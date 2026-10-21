import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ARENA_COLS, ARENA_ROWS } from '../config/arena';
import { RANKING_SIZE } from '../config/score';
import { PadNav } from '../input/padNav';
import { DIFFICULTY_LABELS } from '../menu/menuModel';
import { loadRanking } from '../menu/rankingStorage';
import { TILE_SIZE } from '../render/ArenaRenderer';
import { placeArena } from '../render/layout';
import { addMenuBackground, addPanel } from '../render/menuBackground';
import type { AiDifficulty } from '../config/ai';

const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
const WIDTH = ARENA_COLS * TILE_SIZE;
const HEIGHT = ARENA_ROWS * TILE_SIZE;

/** Tela do Top 10 (guardado no navegador). Qualquer tecla (ou botão do controle) volta ao menu. */
export class RankingScene extends Phaser.Scene {
  private padNav!: PadNav;

  constructor() {
    super({ key: 'Ranking' });
  }

  create(): void {
    placeArena(this);
    addMenuBackground(this);
    addPanel(this, WIDTH / 2, 470, WIDTH - 60, 700);
    this.add
      .text(WIDTH / 2, 90, 'RANKING', { fontFamily: FONT, fontSize: '72px', fontStyle: 'bold', color: '#ffe66d', stroke: '#1b1f3b', strokeThickness: 8 })
      .setOrigin(0.5);
    this.add.text(WIDTH / 2, 150, 'as 10 melhores pontuações de partida neste navegador', { fontFamily: FONT, fontSize: '22px', color: '#e3e7ff' }).setOrigin(0.5);

    const entries = loadRanking();
    if (entries.length === 0) {
      this.add.text(WIDTH / 2, HEIGHT / 2, 'Ainda não há pontuações.\nTermine uma partida para entrar no ranking!', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4, align: 'center' }).setOrigin(0.5);
    }
    entries.slice(0, RANKING_SIZE).forEach((entry, index) => {
      const y = 215 + index * 50;
      const color = index === 0 ? '#ffe66d' : '#d7dbff';
      const level = entry.difficulty ? (DIFFICULTY_LABELS[entry.difficulty as AiDifficulty] ?? entry.difficulty) : 'sem computador';
      const style = { fontFamily: FONT, fontSize: '30px', fontStyle: index < 3 ? 'bold' : 'normal', color };
      this.add.text(120, y, `${index + 1}º`, style).setOrigin(0, 0.5);
      this.add.text(200, y, entry.name, style).setOrigin(0, 0.5);
      this.add.text(560, y, `${entry.points} pts`, style).setOrigin(1, 0.5);
      this.add.text(600, y, `${level} · ${entry.date}`, { ...style, fontSize: '20px', fontStyle: 'normal', color: '#e3e7ff' }).setOrigin(0, 0.5);
    });

    this.add.text(WIDTH / 2, HEIGHT - 48, 'Qualquer tecla volta ao menu', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#1b1f3b', strokeThickness: 4 }).setOrigin(0.5);

    this.padNav = new PadNav(this);
    // Um pequeno atraso evita que o Enter que abriu esta tela já a feche.
    this.time.delayedCall(250, () => {
      this.input.keyboard?.on('keydown', () => this.back());
    });
  }

  update(time: number): void {
    if (!this.padNav) return;
    if (this.padNav.poll(time).some(({ action }) => action === 'confirm' || action === 'back')) this.back();
  }

  private back(): void {
    sfx.play('confirm');
    this.scene.start('Menu');
  }
}
