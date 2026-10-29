import Phaser from 'phaser';
import type { GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Desenho da armadilha de dardos: uma faixa discreta na fileira (sempre visível), setas vermelhas piscando nas duas bordas
// durante o aviso e os dardos voando quando disparam. Só desenho; as regras estão em core/hazards.ts.

export class HazardsView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly warn: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene, state: GameState) {
    this.g = scene.add.graphics().setDepth(9);
    const trap = state.hazards?.dartTrap;
    if (!trap) return;
    // Aviso escrito, nas bordas da fileira (fica fora da arena, no fundo da tela).
    const y = (trap.row + 0.5) * TILE_SIZE;
    const style = { fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ff4d4d', stroke: '#1b1f3b', strokeThickness: 6 };
    this.warn.push(scene.add.text(-6, y, '⚠', style).setOrigin(1, 0.5).setDepth(10).setVisible(false));
    this.warn.push(scene.add.text(state.arena.cols * TILE_SIZE + 6, y, '⚠', style).setOrigin(0, 0.5).setDepth(10).setVisible(false));
    this.drawStrip(state);
  }

  /** Faixa fixa que marca a fileira da armadilha (pequenos buracos nas laterais, como a saída dos dardos). */
  private drawStrip(state: GameState): void {
    const trap = state.hazards?.dartTrap;
    if (!trap) return;
    const strip = this.scene.add.graphics().setDepth(0.7);
    const y = trap.row * TILE_SIZE;
    strip.fillStyle(0x5c3b14, 0.18);
    strip.fillRect(TILE_SIZE, y + 22, (state.arena.cols - 2) * TILE_SIZE, 20);
    strip.fillStyle(0x3a2208, 0.85);
    for (const x of [TILE_SIZE - 14, (state.arena.cols - 1) * TILE_SIZE + 2]) strip.fillRoundedRect(x, y + 24, 12, 16, 3);
  }

  update(state: GameState): void {
    const trap = state.hazards?.dartTrap;
    const g = this.g;
    g.clear();
    if (!trap) return;
    const y = (trap.row + 0.5) * TILE_SIZE;
    const width = state.arena.cols * TILE_SIZE;

    if (trap.phase === 'warn') {
      // Pisca cada vez mais rápido até o disparo; a seta aponta o lado de onde os dardos saem.
      const left = trap.timer / 60;
      const on = Math.floor(left * (left < 1 ? 8 : 4)) % 2 === 0;
      g.fillStyle(0xff3b3b, on ? 0.28 : 0.1);
      g.fillRect(TILE_SIZE, trap.row * TILE_SIZE + 4, width - 2 * TILE_SIZE, TILE_SIZE - 8);
      for (const t of this.warn) t.setVisible(on);
      const fromLeft = trap.dir === 1;
      this.warn[0]!.setText(fromLeft ? '⚠ ▶' : '⚠');
      this.warn[1]!.setText(fromLeft ? '⚠' : '◀ ⚠');
    } else {
      for (const t of this.warn) t.setVisible(false);
    }

    if (trap.phase === 'fly') {
      const px = trap.x * TILE_SIZE;
      const d = trap.dir;
      // Três dardos lado a lado na fileira (cabo, ponta e penas), com um rastro.
      for (const dy of [-18, 0, 18]) {
        const yy = y + dy;
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(Math.min(px, px - d * 90), yy - 2, 90, 4);
        g.lineStyle(4, 0x6b4a1f, 1);
        g.lineBetween(px - d * 34, yy, px + d * 10, yy);
        g.fillStyle(0xd9d9e0, 1);
        g.fillTriangle(px + d * 10, yy - 8, px + d * 10, yy + 8, px + d * 28, yy);
        g.fillStyle(0xe03131, 1);
        g.fillTriangle(px - d * 34, yy, px - d * 46, yy - 8, px - d * 40, yy);
        g.fillTriangle(px - d * 34, yy, px - d * 46, yy + 8, px - d * 40, yy);
      }
    }
  }
}
