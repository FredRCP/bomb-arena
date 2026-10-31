import Phaser from 'phaser';
import type { GameEvent, GameState } from '../core';
import { lavaRows } from '../core';
import { FOG_POWER_TICKS } from '../config/powers';
import { BRIDGE_WARN_TICKS, CANNON_FALL_TICKS, LAVA_WARN_TICKS, VOLCANO_FALL_TICKS } from '../config/hazards';
import { TILE_SIZE } from './ArenaRenderer';
import { has, themeById, themeKey } from './theme';

// Desenho dos perigos do Fundo do Mar (correnteza), do Vulcão (rio de lava, sombras e bolas de lava), da Ilha dos Piratas
// (canhões), do Templo (queda das pontes) e dos poderes que mexem no chão (gosma do Musgo, neblina do Nimbo). Só desenho.

const FOG_TOTAL = FOG_POWER_TICKS;

export class ExtraHazardsView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly top: Phaser.GameObjects.Graphics;
  private readonly bridgeG: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, state: GameState, themeId: string) {
    this.g = scene.add.graphics().setDepth(0.85);
    this.top = scene.add.graphics().setDepth(12);
    this.bridgeG = scene.add.graphics().setDepth(0.95);
    const theme = themeById(themeId);
    if (has(scene, theme, 'volcano') && state.hazards?.volcano) {
      const c = Math.floor(state.arena.cols / 2);
      const m = Math.floor(state.arena.rows / 2);
      scene.add.image((c + 0.5) * TILE_SIZE, (m + 0.5) * TILE_SIZE, themeKey(theme, 'volcano')).setDisplaySize(3.1 * TILE_SIZE, 3.1 * TILE_SIZE).setDepth(6.5);
    }
  }

  /** Redesenha o que se mexe (correnteza, lava e bolas), uma vez por quadro. */
  update(state: GameState): void {
    const g = this.g;
    const top = this.top;
    g.clear();
    top.clear();
    const arena = state.arena;
    const hz = state.hazards;
    if (!hz) return;
    const t = state.tick;

    for (const lane of hz.currents ?? []) {
      const set = new Set(lane.cells);
      for (const index of lane.cells) {
        const col = index % arena.cols;
        const row = Math.floor(index / arena.cols);
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        g.fillStyle(0x9be7ff, 0.14).fillRect(x, y, TILE_SIZE, TILE_SIZE);
        g.lineStyle(3, 0xe8fbff, 0.55);
        for (let k = 0; k < 2; k++) {
          const phase = ((t * 1.2 * lane.dx + k * 32) % 64 + 64) % 64;
          const cx = x + phase;
          const cy = y + 22 + k * 20;
          const s = 7 * lane.dx;
          g.lineBetween(cx - s, cy - 7, cx + s, cy).lineBetween(cx + s, cy, cx - s, cy + 7);
        }
      }
      void set;
    }

    this.drawRiver(g, state);
    this.drawBridges(state);
    this.drawSlime(g, state);

    // Bolas de lava: sombra crescendo desde o lançamento; a bola sobe (vinda do vulcão) e despenca sobre a sombra.
    const volcano = hz.volcano;
    if (hz.cannon) this.drawCannon(g, top, state, hz.cannon);
    if (volcano) {
      const vx = (Math.floor(arena.cols / 2) + 0.5) * TILE_SIZE;
      const vy = (Math.floor(arena.rows / 2) + 0.5) * TILE_SIZE;
      for (const shot of volcano.shots) {
        const progress = 1 - shot.ticks / VOLCANO_FALL_TICKS;
        const tx = (shot.col + 0.5) * TILE_SIZE;
        const ty = (shot.row + 0.5) * TILE_SIZE;
        const blink = shot.ticks < 40 && Math.floor(t / 4) % 2 === 0;
        g.fillStyle(0x1b0a05, 0.15 + 0.4 * progress).fillCircle(tx, ty + 4, 10 + 26 * progress);
        g.lineStyle(3, blink ? 0xffe066 : 0xff3b1a, 0.5 + 0.4 * progress).strokeCircle(tx, ty + 4, 12 + 26 * progress);
        const age = VOLCANO_FALL_TICKS - shot.ticks;
        let bx: number;
        let by: number;
        if (age < 30) {
          const u = age / 30;
          bx = vx + (tx - vx) * 0.0;
          by = vy - u * (vy + 160);
        } else if (shot.ticks <= 36) {
          const u = 1 - shot.ticks / 36;
          bx = tx;
          by = -140 + (ty - -140) * u * u;
        } else continue;
        top.fillStyle(0xff7a1a, 0.35).fillCircle(bx, by, 30);
        top.fillStyle(0xff4a0a, 1).fillCircle(bx, by, 17);
        top.fillStyle(0xffc23a, 1).fillCircle(bx, by, 11);
        top.fillStyle(0xfff3a0, 1).fillCircle(bx - 2, by - 2, 5);
        for (let k = 1; k <= 4; k++) top.fillStyle(0xff6a14, 0.4 - k * 0.07).fillCircle(bx + Math.sin(t + k) * 3, by - (age < 30 ? -k * 12 : k * 14), 14 - k * 2);
      }
    }
    this.drawFog(top, state);
  }

  /** Rio de lava: a coluna pisca no aviso e depois a lava desce por ela. */
  private drawRiver(g: Phaser.GameObjects.Graphics, state: GameState): void {
    const lava = state.hazards?.lava;
    if (!lava || lava.phase === 'idle') return;
    const arena = state.arena;
    const t = state.tick;
    const x = lava.col * TILE_SIZE;
    const top = TILE_SIZE;
    const height = (arena.rows - 2) * TILE_SIZE;
    if (lava.phase === 'warn') {
      const on = Math.floor(t / (lava.timer < 60 ? 5 : 10)) % 2 === 0;
      g.fillStyle(0xff3b1a, on ? 0.3 : 0.1).fillRect(x, top, TILE_SIZE, height);
      // Setas indicando por onde a lava entra.
      const entryY = lava.dir === 1 ? top + 6 : top + height - 6;
      g.fillStyle(0xffe066, on ? 0.95 : 0.4);
      for (let k = 0; k < 3; k++) {
        const ay = entryY + lava.dir * (k * 18 + ((t >> 2) % 18));
        g.fillTriangle(x + 14, ay, x + TILE_SIZE - 14, ay, x + TILE_SIZE / 2, ay + lava.dir * 14);
      }
      void LAVA_WARN_TICKS;
      return;
    }
    const [lo, hi] = lavaRows(lava);
    const y0 = Math.max(1, lo) * TILE_SIZE;
    const y1 = Math.min(arena.rows - 1, hi) * TILE_SIZE;
    if (y1 <= y0) return;
    g.fillStyle(0xb81e0a, 1).fillRect(x, y0, TILE_SIZE, y1 - y0);
    g.fillStyle(0xff5a14, 1).fillRect(x + 4, y0, TILE_SIZE - 8, y1 - y0);
    for (let k = 0; k < 9; k++) {
      const by = y0 + ((k * 41 + t * 1.6) % Math.max(10, y1 - y0));
      const bx = x + 14 + ((k * 23 + Math.sin(t / 20 + k) * 12 + 64) % 36);
      g.fillStyle(k % 2 === 0 ? 0xffb02e : 0xffd75a, 0.85).fillCircle(bx, by, 6 + (k % 3) * 2);
    }
    // A frente do rio (cabeça) mais clara.
    const headY = lava.dir === 1 ? y1 : y0;
    g.fillStyle(0xffe066, 0.9).fillEllipse(x + TILE_SIZE / 2, headY, TILE_SIZE - 8, 22);
  }

  /** Ponte do templo que cai: pisca e balança no aviso; some no abismo enquanto está caída. */
  private drawBridges(state: GameState): void {
    const g = this.bridgeG;
    g.clear();
    const fall = state.hazards?.bridgeFall;
    const bridges = state.hazards?.bridges;
    if (!fall || !bridges || fall.phase === 'idle') return;
    const arena = state.arena;
    const t = state.tick;
    for (const index of bridges) {
      const row = Math.floor(index / arena.cols);
      if (row !== fall.row) continue;
      const col = index % arena.cols;
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      if (fall.phase === 'warn') {
        const left = fall.timer;
        const on = Math.floor(t / (left < 60 ? 4 : 8)) % 2 === 0;
        g.fillStyle(0xff3b1a, on ? 0.45 : 0.12).fillRect(x, y + 4, TILE_SIZE, TILE_SIZE - 8);
        const shake = Math.sin(t * 1.7) * 2;
        g.lineStyle(3, 0xffe066, on ? 0.9 : 0.3).lineBetween(x, y + TILE_SIZE / 2 + shake, x + TILE_SIZE, y + TILE_SIZE / 2 - shake);
      } else {
        g.fillStyle(0x070816, 1).fillRect(x, y, TILE_SIZE, TILE_SIZE);
        g.fillStyle(0x16103a, 0.4).fillRect(x, y, TILE_SIZE, TILE_SIZE);
        g.fillStyle(0x8e9bff, 0.07).fillEllipse(x + 32, y + 32, 46, 20);
      }
    }
    void BRIDGE_WARN_TICKS;
  }

  /** Gosma do Musgo: poças verdes brilhantes que somem aos poucos. */
  private drawSlime(g: Phaser.GameObjects.Graphics, state: GameState): void {
    for (const cell of state.slime ?? []) {
      const fade = Math.min(1, cell.ticks / 90);
      const x = (cell.col + 0.5) * TILE_SIZE;
      const y = (cell.row + 0.5) * TILE_SIZE;
      g.fillStyle(0x4fae2a, 0.55 * fade).fillEllipse(x, y + 4, TILE_SIZE - 8, TILE_SIZE - 16);
      g.fillStyle(0x8ee05a, 0.6 * fade).fillEllipse(x - 4, y, TILE_SIZE - 26, TILE_SIZE - 30);
      const wob = Math.sin(state.tick / 14 + cell.col * 2 + cell.row) * 3;
      g.fillStyle(0xd6ffb0, 0.7 * fade).fillCircle(x - 12 + wob, y - 6, 4).fillCircle(x + 10, y + 8 - wob, 3);
    }
  }

  /** Canhões do navio: sombra no chão avisando e a bala caindo de cima (cinza escura, com pavio aceso). */
  private drawCannon(g: Phaser.GameObjects.Graphics, top: Phaser.GameObjects.Graphics, state: GameState, cannon: NonNullable<GameState['hazards']>['cannon'] & object): void {
    const t = state.tick;
    for (const shot of cannon.shots) {
      const progress = 1 - shot.ticks / CANNON_FALL_TICKS;
      const tx = (shot.col + 0.5) * TILE_SIZE;
      const ty = (shot.row + 0.5) * TILE_SIZE;
      const blink = shot.ticks < 40 && Math.floor(t / 4) % 2 === 0;
      g.fillStyle(0x1b0a05, 0.15 + 0.4 * progress).fillCircle(tx, ty + 4, 10 + 26 * progress);
      g.lineStyle(3, blink ? 0xffe066 : 0xff7a1a, 0.5 + 0.4 * progress).strokeCircle(tx, ty + 4, 12 + 26 * progress);
      if (shot.ticks > 36) continue;
      const u = 1 - shot.ticks / 36;
      const by = -140 + (ty + 140) * u * u;
      top.fillStyle(0x15151c, 1).fillCircle(tx, by, 17);
      top.fillStyle(0x4a4a58, 1).fillCircle(tx - 5, by - 5, 6);
      top.fillStyle(0xffc23a, 1).fillCircle(tx + 9, by - 17, 4);
      top.fillStyle(0xff6a14, 0.4).fillCircle(tx, by - 30, 12);
    }
  }

  /** Neblina do Nimbo: cobre a arena, menos em volta dele. */
  private drawFog(top: Phaser.GameObjects.Graphics, state: GameState): void {
    const fog = state.fog;
    if (!fog) return;
    const arena = state.arena;
    const owner = state.players.find((p) => p.id === fog.owner);
    const fade = Math.min(1, fog.ticks / 40, (FOG_TOTAL - fog.ticks) / 40);
    const t = state.tick;
    for (let row = 0; row < arena.rows; row++) {
      for (let col = 0; col < arena.cols; col++) {
        const d = owner ? Math.hypot(col + 0.5 - owner.x, row + 0.5 - owner.y) : 9;
        const clear = Math.max(0, Math.min(1, (d - 1.4) / 1.6));
        const alpha = (0.18 + 0.72 * clear) * Math.max(0, fade);
        if (alpha <= 0.01) continue;
        top.fillStyle(0xe4e9f0, alpha).fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    for (let k = 0; k < 7; k++) {
      const x = (((k * 197 + t * (0.6 + (k % 3) * 0.3)) % (arena.cols * TILE_SIZE + 300)) - 150);
      const y = ((k * 131) % (arena.rows * TILE_SIZE));
      top.fillStyle(0xffffff, 0.16 * Math.max(0, fade)).fillEllipse(x, y, 260, 90);
    }
  }

  /** Efeitos de cena: a bola que cai faz um clarão e a erupção treme a tela toda. */
  onEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'volcanoErupt') this.scene.cameras.main.shake(2600, 0.006);
      if (event.type === 'lavaRiver') this.scene.cameras.main.shake(1200, 0.003);
      if (event.type === 'cannonImpact') {
        const x = (event.col + 0.5) * TILE_SIZE;
        const y = (event.row + 0.5) * TILE_SIZE;
        const flash = this.scene.add.circle(x, y, 20, 0xffe9a8, 0.95).setDepth(12);
        const smoke = this.scene.add.circle(x, y, 20, 0x6b6b78, 0.6).setDepth(11.9);
        this.scene.tweens.add({ targets: flash, scale: 2.6, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
        this.scene.tweens.add({ targets: smoke, scale: 4, alpha: 0, duration: 700, onComplete: () => smoke.destroy() });
        this.scene.cameras.main.shake(140, 0.0025);
      }
      if (event.type === 'lavaImpact') {
        const x = (event.col + 0.5) * TILE_SIZE;
        const y = (event.row + 0.5) * TILE_SIZE;
        const flash = this.scene.add.circle(x, y, 20, 0xffd75a, 0.95).setDepth(12);
        const ring = this.scene.add.circle(x, y, 20, 0xff5a14, 0.55).setDepth(11.9);
        this.scene.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
        this.scene.tweens.add({ targets: ring, scale: 4.4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
        this.scene.cameras.main.shake(160, 0.003);
      }
    }
  }
}
