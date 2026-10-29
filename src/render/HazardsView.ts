import Phaser from 'phaser';
import type { GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Desenho da armadilha de dardos: uma faixa discreta na fileira (sempre visível), setas vermelhas piscando nas duas bordas
// durante o aviso e os dardos voando quando disparam. Só desenho; as regras estão em core/hazards.ts.

export class HazardsView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly warn: Phaser.GameObjects.Text[] = [];
  /** Gelo fino (manchas, rachaduras e buracos): redesenhado só quando algo muda. */
  private readonly ice: Phaser.GameObjects.Graphics;
  private iceKey = '';
  /** Brilho de fogo por cima da pirâmide (para ninguém ser pego por uma chama escondida no túnel). */
  private readonly glow: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, state: GameState) {
    this.g = scene.add.graphics().setDepth(9);
    this.ice = scene.add.graphics().setDepth(0.8);
    this.glow = scene.add.graphics().setDepth(11);
    this.drawSlippery(state);
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

  /** Faixas escorregadias: piso claro, levemente embaçado e riscado no sentido do deslize. */
  private drawSlippery(state: GameState): void {
    const strips = state.hazards?.slippery;
    if (!strips || strips.length === 0) return;
    const arena = state.arena;
    const set = new Set(strips);
    const g = this.scene.add.graphics().setDepth(0.6);
    for (const index of strips) {
      const col = index % arena.cols;
      const row = Math.floor(index / arena.cols);
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const horizontal = set.has(index - 1) || set.has(index + 1);
      // Véu claro (o "embaçado") com bordas mais suaves e riscos finos.
      g.fillStyle(0xeaf8ff, 0.3).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      g.fillStyle(0xffffff, 0.16).fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      g.lineStyle(2, 0xffffff, 0.6);
      for (const o of [12, 26, 40, 54]) {
        const wobble = ((col * 7 + row * 3 + o) % 5) * 2;
        if (horizontal) g.lineBetween(x + 4 + wobble, y + o, x + TILE_SIZE - 4 - (8 - wobble), y + o);
        else g.lineBetween(x + o, y + 4 + wobble, x + o, y + TILE_SIZE - 4 - (8 - wobble));
      }
      g.lineStyle(1, 0x9fd6f0, 0.7);
      for (const o of [19, 47]) {
        if (horizontal) g.lineBetween(x + 8, y + o, x + TILE_SIZE - 8, y + o);
        else g.lineBetween(x + o, y + 8, x + o, y + TILE_SIZE - 8);
      }
    }
  }

  /** Gelo fino: mancha clara com rachaduras por nível; célula quebrada vira um buraco escuro. */
  private drawIce(state: GameState): void {
    const hz = state.hazards;
    if (!hz?.thinIce || !hz.cracks) return;
    const arena = state.arena;
    const key = hz.thinIce.map((i) => `${arena.cells[i] === 'hole' ? 'h' : hz.cracks![i] ?? 0}`).join('');
    if (key === this.iceKey) return;
    this.iceKey = key;
    const g = this.ice;
    g.clear();
    for (const index of hz.thinIce) {
      const x = (index % arena.cols) * TILE_SIZE;
      const y = Math.floor(index / arena.cols) * TILE_SIZE;
      if (arena.cells[index] === 'hole') {
        g.fillStyle(0x0a1d3a, 1).fillRoundedRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 10);
        g.fillStyle(0x03101f, 1).fillRoundedRect(x + 9, y + 9, TILE_SIZE - 18, TILE_SIZE - 18, 8);
        g.lineStyle(3, 0xcdeeff, 0.9).strokeRoundedRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6, 10);
        continue;
      }
      const level = hz.cracks[index] ?? 0;
      g.fillStyle(0xdff6ff, 0.45).fillRoundedRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4, 8);
      g.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4, 8);
      g.lineStyle(3, 0x2f6f9f, 0.95);
      if (level >= 1) {
        g.lineBetween(x + 12, y + 14, x + 30, y + 30);
        g.lineBetween(x + 30, y + 30, x + 26, y + 44);
      }
      if (level >= 2) {
        g.lineBetween(x + 30, y + 30, x + 52, y + 22);
        g.lineBetween(x + 40, y + 27, x + 48, y + 46);
        g.lineBetween(x + 26, y + 44, x + 14, y + 54);
      }
      if (level >= 3) {
        // Quase quebrando: o gelo fica mais escuro e cheio de rachaduras.
        g.fillStyle(0x6fb0d8, 0.4).fillRoundedRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4, 8);
        g.lineBetween(x + 12, y + 14, x + 8, y + 4);
        g.lineBetween(x + 52, y + 22, x + 58, y + 10);
        g.lineBetween(x + 48, y + 46, x + 58, y + 56);
        g.lineBetween(x + 14, y + 54, x + 6, y + 58);
        g.lineBetween(x + 30, y + 30, x + 36, y + 12);
      }
    }
  }

  /** Bola de neve (rola) e pinguim (escorrega de barriga) que descem do iglu. */
  private drawRollers(state: GameState, g: Phaser.GameObjects.Graphics): void {
    for (const roller of state.hazards?.rollers ?? []) {
      const x = roller.x * TILE_SIZE;
      const y = roller.y * TILE_SIZE;
      g.fillStyle(0x1b1f3b, 0.25).fillEllipse(x, y + 22, 44, 12); // sombra
      if (roller.kind === 'snowball') {
        const spin = roller.y * 5;
        g.fillStyle(0xdff3ff, 1).fillCircle(x, y, 27);
        g.fillStyle(0xffffff, 1).fillCircle(x - 7, y - 8, 14);
        g.lineStyle(3, 0x8cc7e8, 1).strokeCircle(x, y, 27);
        g.lineStyle(3, 0x8cc7e8, 0.9).lineBetween(x + Math.cos(spin) * 8, y + Math.sin(spin) * 8, x + Math.cos(spin) * 20, y + Math.sin(spin) * 20);
        g.lineBetween(x + Math.cos(spin + 2.1) * 8, y + Math.sin(spin + 2.1) * 8, x + Math.cos(spin + 2.1) * 20, y + Math.sin(spin + 2.1) * 20);
      } else {
        // Pinguim de barriga para baixo, olhando para a frente (para baixo na tela).
        g.fillStyle(0x1f2540, 1).fillEllipse(x, y, 40, 54);
        g.fillStyle(0xf4f7ff, 1).fillEllipse(x, y + 4, 24, 40);
        g.fillStyle(0x1f2540, 1).fillEllipse(x - 24, y - 2, 10, 30).fillEllipse(x + 24, y - 2, 10, 30); // nadadeiras abertas
        g.fillStyle(0xff9f1a, 1).fillTriangle(x - 7, y + 22, x + 7, y + 22, x, y + 34); // bico
        g.fillStyle(0xff9f1a, 1).fillEllipse(x - 10, y - 28, 14, 8).fillEllipse(x + 10, y - 28, 14, 8); // pés
        g.fillStyle(0xffffff, 1).fillCircle(x - 6, y + 14, 3).fillCircle(x + 6, y + 14, 3);
        g.fillStyle(0x1b1f3b, 1).fillCircle(x - 6, y + 14, 1.5).fillCircle(x + 6, y + 14, 1.5);
      }
    }
  }

  update(state: GameState): void {
    this.drawIce(state);
    const tunnel = state.hazards?.tunnel;
    if (tunnel) {
      this.glow.clear();
      for (const flame of state.flames) {
        if (!tunnel.includes(flame.row * state.arena.cols + flame.col)) continue;
        this.glow.fillStyle(0xff7a1a, 0.85).fillRoundedRect(flame.col * TILE_SIZE + 6, flame.row * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12, 12);
        this.glow.fillStyle(0xffe066, 0.9).fillRoundedRect(flame.col * TILE_SIZE + 18, flame.row * TILE_SIZE + 18, TILE_SIZE - 36, TILE_SIZE - 36, 8);
      }
    }
    const trap = state.hazards?.dartTrap;
    const g = this.g;
    g.clear();
    this.drawRollers(state, g);
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
