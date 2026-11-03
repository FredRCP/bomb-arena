import Phaser from 'phaser';
import { TRAFFIC } from '../config/hazards';
import type { TrafficKind } from '../config/hazards';
import type { GameEvent, GameState, TrafficLane } from '../core';
import { trafficSpan } from '../core';
import { TILE_SIZE } from './ArenaRenderer';

// Desenho do tráfego (veja core/traffic.ts): a faixa fixa no chão (asfalto, trilhos, trilha de terra...), o aviso piscando
// nas duas pontas e o veículo passando. Tudo feito em código (sem imagens). Só desenho: as regras estão no core.

const CAR_COLORS = [0xe03131, 0x1c7ed6, 0xf59f00, 0x2f9e44, 0xae3ec9, 0xf783ac];
const WAGON_COLORS = [0xc92a2a, 0x1971c2, 0xe8890c, 0x2b8a3e, 0x862e9c, 0x0c8599];
const BALL_COLORS: Array<[number, number]> = [[0xff4d4d, 0xffffff], [0x339af0, 0xffd43b], [0x51cf66, 0xffffff], [0xffd43b, 0xff6b6b], [0xcc5de8, 0xffffff], [0xff922b, 0x74c0fc]];

/** Ponto do mundo (px) de uma posição (u ao longo da faixa, v atravessando) de uma faixa. */
function toWorld(lane: TrafficLane, u: number, v: number): { x: number; y: number } {
  return lane.axis === 'row' ? { x: u, y: lane.index * TILE_SIZE + v } : { x: lane.index * TILE_SIZE + v, y: u };
}

export class TrafficView {
  private readonly veh: Phaser.GameObjects.Graphics;
  private readonly warn: Phaser.GameObjects.Graphics;
  constructor(private readonly scene: Phaser.Scene, state: GameState) {
    const traffic = state.hazards?.traffic;
    this.veh = scene.add.graphics().setDepth(9.6);
    this.warn = scene.add.graphics().setDepth(9.2);
    if (traffic) this.drawLanes(state);
  }

  /** Efeitos de tela: o trem e o trator fazem a tela tremer um pouco ao entrar. */
  onEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'trafficGo' && (event.kind === 'train' || event.kind === 'bulldozer')) this.scene.cameras.main.shake(900, 0.0016);
    }
  }

  /** A faixa fixa no chão, desenhada uma vez. */
  private drawLanes(state: GameState): void {
    const traffic = state.hazards!.traffic!;
    const arena = state.arena;
    const g = this.scene.add.graphics().setDepth(0.65);
    for (const lane of traffic.lanes) {
      const size = lane.axis === 'row' ? arena.cols : arena.rows;
      const from = TILE_SIZE;
      const to = (size - 1) * TILE_SIZE;
      const rect = (u0: number, u1: number, v0: number, v1: number, color: number, alpha = 1): void => {
        const a = toWorld(lane, u0, v0);
        const b = toWorld(lane, u1, v1);
        g.fillStyle(color, alpha).fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      };
      if (traffic.kind === 'cars') {
        rect(from, to, 0, TILE_SIZE, 0x3b3f49, 0.96);
        rect(from, to, 3, 7, 0xf1f3f5, 0.85);
        rect(from, to, TILE_SIZE - 7, TILE_SIZE - 3, 0xf1f3f5, 0.85);
        for (let u = from + 6; u < to; u += 40) rect(u, u + 22, TILE_SIZE / 2 - 2, TILE_SIZE / 2 + 2, 0xffd43b, 0.9);
        // Faixa de largada quadriculada no começo e no fim da pista.
        for (const base of [from, to - 8]) for (let v = 0; v < TILE_SIZE; v += 8) for (let k = 0; k < 1; k++) rect(base, base + 8, v, v + 8, (v / 8) % 2 === 0 ? 0xffffff : 0x222222, 0.8);
      } else if (traffic.kind === 'train') {
        rect(from, to, 6, TILE_SIZE - 6, 0x8a7f6e, 0.6); // cascalho
        for (let u = from + 4; u < to; u += 16) rect(u, u + 8, 8, TILE_SIZE - 8, 0x5a3d22, 0.95); // dormentes
        rect(from, to, 17, 22, 0xcfd4da, 1);
        rect(from, to, 42, 47, 0xcfd4da, 1);
        rect(from, to, 22, 24, 0x6b7280, 0.9);
        rect(from, to, 47, 49, 0x6b7280, 0.9);
      } else if (traffic.kind === 'bulldozer') {
        rect(from, to, 6, TILE_SIZE - 6, 0xa67c52, 0.45);
        rect(from, to, 10, 26, 0x6b4a2a, 0.5);
        rect(from, to, 38, 54, 0x6b4a2a, 0.5);
        for (let u = from + 4; u < to; u += 14) {
          rect(u, u + 5, 10, 26, 0x4b331c, 0.45);
          rect(u, u + 5, 38, 54, 0x4b331c, 0.45);
        }
      } else if (traffic.kind === 'ball') {
        rect(from, to, 4, TILE_SIZE - 4, 0xffe066, 0.22);
        for (let u = from + 8; u < to; u += 32) {
          const c = toWorld(lane, u, TILE_SIZE / 2);
          g.fillStyle(0xffffff, 0.45).fillCircle(c.x, c.y, 3);
        }
      } else {
        rect(from, to, 4, TILE_SIZE - 4, 0x5c3d1e, 0.5);
        rect(from, to, 14, 20, 0x3b2610, 0.4);
        rect(from, to, 44, 50, 0x3b2610, 0.4);
        for (let u = from + 10; u < to; u += 46) {
          const c = toWorld(lane, u, 12 + ((u / 46) % 3) * 18);
          g.fillStyle(0x2f9e44, 0.55).fillEllipse(c.x, c.y, 14, 8);
        }
      }
    }
  }

  update(state: GameState): void {
    const traffic = state.hazards?.traffic;
    const warn = this.warn;
    const veh = this.veh;
    warn.clear();
    veh.clear();
    if (!traffic) return;
    const arena = state.arena;
    for (const lane of traffic.lanes) {
      const size = lane.axis === 'row' ? arena.cols : arena.rows;
      if (lane.phase === 'warn') {
        const cfg = TRAFFIC[traffic.kind];
        const left = lane.timer / 60;
        const on = Math.floor(left * (left < 1 ? 8 : 4)) % 2 === 0;
        const a = toWorld(lane, TILE_SIZE, 0);
        const w = lane.axis === 'row' ? (size - 2) * TILE_SIZE : TILE_SIZE;
        const h = lane.axis === 'row' ? TILE_SIZE : (size - 2) * TILE_SIZE;
        warn.fillStyle(0xff3b3b, on ? 0.22 : 0.07).fillRect(a.x, a.y, w, h);
        // Luzes de alerta nas duas pontas (fora da arena) e setinhas andando no sentido da passagem.
        for (const end of [0, 1]) {
          const c = toWorld(lane, end === 0 ? -22 : size * TILE_SIZE + 22, TILE_SIZE / 2);
          warn.fillStyle(0x1b1f3b, 0.9).fillCircle(c.x, c.y, 17);
          warn.fillStyle(on ? 0xff2a2a : 0x7a1a1a, 1).fillCircle(c.x, c.y, 13);
          warn.fillStyle(0xffffff, 0.85).fillRect(c.x - 2, c.y - 8, 4, 10).fillRect(c.x - 2, c.y + 4, 4, 4);
        }
        const phase = ((cfg.warn - lane.timer) * 3) % 64;
        for (let u = TILE_SIZE + phase; u < (size - 1) * TILE_SIZE; u += 64) {
          const c = toWorld(lane, lane.dir === 1 ? u : (size * TILE_SIZE - u), TILE_SIZE / 2);
          const f = lane.dir;
          const p = (du: number, dv: number): { x: number; y: number } => toWorld(lane, (lane.dir === 1 ? u : size * TILE_SIZE - u) + du * f, TILE_SIZE / 2 + dv);
          void c;
          const p1 = p(10, 0);
          const p2 = p(-8, -10);
          const p3 = p(-8, 10);
          warn.fillStyle(0xffffff, on ? 0.7 : 0.35).fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
      } else if (lane.phase === 'run') {
        this.drawVehicle(veh, traffic.kind, lane);
      }
    }
  }

  private drawVehicle(g: Phaser.GameObjects.Graphics, kind: TrafficKind, lane: TrafficLane): void {
    const [from, to] = trafficSpan(kind, lane);
    const mid = ((from + to) / 2) * TILE_SIZE;
    const across = (lane.index + 0.5) * TILE_SIZE;
    const x = lane.axis === 'row' ? mid : across;
    const y = lane.axis === 'row' ? across : mid;
    const angle = lane.axis === 'row' ? (lane.dir === 1 ? 0 : Math.PI) : lane.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    const len = TRAFFIC[kind].length * TILE_SIZE;
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(angle);
    if (kind === 'cars') this.car(g, len, lane.look);
    else if (kind === 'train') this.train(g, len, lane.look);
    else if (kind === 'bulldozer') this.bulldozer(g, len);
    else if (kind === 'ball') this.ball(g, lane.pos * 3 * (lane.dir === 1 ? 1 : -1), lane.look);
    else this.log(g, len, lane.pos * 6);
    g.restore();
  }

  /** Carro de corrida visto de cima (frente para a direita). */
  private car(g: Phaser.GameObjects.Graphics, len: number, look: number): void {
    const color = CAR_COLORS[look % CAR_COLORS.length]!;
    const L = len;
    g.fillStyle(0x000000, 0.28).fillRoundedRect(-L / 2 + 3, -17, L, 40, 12);
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) g.fillStyle(0x15171c, 1).fillRoundedRect(sx * L * 0.27 - 9, sy * 22 - 5, 18, 10, 3);
    g.fillStyle(color, 1).fillRoundedRect(-L / 2, -17, L, 34, 12);
    g.fillStyle(0xffffff, 0.9).fillRect(-L / 2 + 6, -3, L - 24, 6); // faixa central
    g.fillStyle(0x1b2a41, 1).fillRoundedRect(-4, -11, 24, 22, 6); // cabine
    g.fillStyle(0xa5d8ff, 0.8).fillRoundedRect(0, -8, 12, 16, 4);
    g.fillStyle(0x15171c, 1).fillRect(-L / 2 - 2, -20, 8, 40); // aerofólio traseiro
    g.fillStyle(0xffe066, 1).fillCircle(L / 2 - 4, -10, 4).fillCircle(L / 2 - 4, 10, 4); // faróis
    g.lineStyle(2, 0x111111, 0.8).strokeRoundedRect(-L / 2, -17, L, 34, 12);
  }

  /** Locomotiva e vagões vistos de cima (frente para a direita). */
  private train(g: Phaser.GameObjects.Graphics, len: number, look: number): void {
    let x = len / 2;
    // Locomotiva
    const loco = 96;
    x -= loco;
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 3, -22, loco, 48, 8);
    g.fillStyle(0x233a6b, 1).fillRoundedRect(x, -24, loco, 48, 8);
    g.fillStyle(0xd9480f, 1).fillRect(x + 4, -24, 10, 48).fillRect(x + loco - 14, -24, 10, 48);
    g.fillStyle(0x364fc7, 1).fillRoundedRect(x + 16, -18, 40, 36, 6); // cabine (teto)
    g.fillStyle(0x15171c, 1).fillCircle(x + loco - 28, 0, 13); // chaminé
    g.fillStyle(0x495057, 1).fillCircle(x + loco - 28, 0, 8);
    g.fillStyle(0xffe066, 1).fillCircle(x + loco - 4, -9, 4).fillCircle(x + loco - 4, 9, 4);
    g.lineStyle(2, 0x111111, 0.7).strokeRoundedRect(x, -24, loco, 48, 8);
    // Vagões
    let n = 0;
    while (x - 74 > -len / 2 - 10) {
      x -= 74;
      const color = WAGON_COLORS[(look + n) % WAGON_COLORS.length]!;
      g.fillStyle(0x3b3b3b, 1).fillRect(x + 66, -3, 12, 6); // engate
      g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 3, -22, 68, 48, 6);
      g.fillStyle(color, 1).fillRoundedRect(x, -24, 68, 48, 6);
      g.fillStyle(0xffffff, 0.25).fillRect(x + 4, -24, 60, 8);
      for (let k = 0; k < 5; k++) g.fillStyle(0x000000, 0.22).fillRect(x + 8 + k * 12, -14, 3, 28);
      g.lineStyle(2, 0x111111, 0.7).strokeRoundedRect(x, -24, 68, 48, 6);
      n += 1;
    }
  }

  /** Trator de esteira visto de cima, com a lâmina na frente. */
  private bulldozer(g: Phaser.GameObjects.Graphics, len: number, ): void {
    const L = len;
    for (const sy of [-1, 1]) {
      g.fillStyle(0x15171c, 1).fillRoundedRect(-L / 2 + 6, sy * 21 - 8, L - 34, 16, 6);
      for (let k = 0; k < 9; k++) g.fillStyle(0x495057, 1).fillRect(-L / 2 + 12 + k * 10, sy * 21 - 8, 3, 16);
    }
    g.fillStyle(0xfab005, 1).fillRoundedRect(-L / 2 + 14, -17, L - 62, 34, 6);
    g.fillStyle(0x364fc7, 0.9).fillRoundedRect(-L / 2 + 22, -11, 34, 22, 5); // cabine
    g.fillStyle(0xa5d8ff, 0.7).fillRoundedRect(-L / 2 + 28, -7, 16, 14, 3);
    g.fillStyle(0x343a40, 1).fillCircle(-L / 2 + 66, -9, 4); // escapamento
    // Lâmina com listras de aviso
    const bx = L / 2 - 20;
    g.fillStyle(0x868e96, 1).fillRoundedRect(bx, -30, 16, 60, 4);
    for (let k = 0; k < 6; k++) g.fillStyle(k % 2 === 0 ? 0xfab005 : 0x212529, 1).fillRect(bx + 2, -28 + k * 10, 12, 10);
    g.fillStyle(0x868e96, 1).fillRect(bx - 12, -22, 12, 5).fillRect(bx - 12, 17, 12, 5);
    g.lineStyle(2, 0x111111, 0.8).strokeRoundedRect(-L / 2 + 14, -17, L - 62, 34, 6);
  }

  /** Bola gigante colorida (gira conforme anda). */
  private ball(g: Phaser.GameObjects.Graphics, spin: number, look: number): void {
    const [c1, c2] = BALL_COLORS[look % BALL_COLORS.length]!;
    const r = 30;
    g.fillStyle(0x000000, 0.25).fillEllipse(4, 8, r * 2, r * 1.6);
    for (let k = 0; k < 6; k++) {
      g.fillStyle(k % 2 === 0 ? c1 : c2, 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r, spin + (k * Math.PI) / 3, spin + ((k + 1) * Math.PI) / 3);
      g.closePath();
      g.fillPath();
    }
    g.fillStyle(0xffffff, 0.35).fillCircle(-10, -11, 9);
    g.lineStyle(3, 0x1b1f3b, 0.85).strokeCircle(0, 0, r);
  }

  /** Tronco rolando (visto de cima; o eixo do tronco atravessa a faixa). */
  private log(g: Phaser.GameObjects.Graphics, len: number, spin: number): void {
    const w = len * 0.7;
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 4, -28, w, 62, 10);
    g.fillStyle(0x8d5a2b, 1).fillRoundedRect(-w / 2, -31, w, 62, 10);
    for (let k = 0; k < 6; k++) {
      const u = -w / 2 + ((spin + k * 14) % 84) * (w / 84);
      g.fillStyle(0x5c3a17, 0.8).fillRect(u, -29, 3, 58);
      g.fillStyle(0xb98048, 0.55).fillRect(u + 5, -29, 2, 58);
    }
    g.fillStyle(0xd9a566, 1).fillEllipse(0, -31, w * 0.9, 12).fillEllipse(0, 31, w * 0.9, 12); // pontas serradas
    g.lineStyle(2, 0x3b2610, 0.9).strokeRoundedRect(-w / 2, -31, w, 62, 10);
    g.fillStyle(0x51cf66, 0.9).fillEllipse(w * 0.1, -8, 14, 8).fillEllipse(-w * 0.15, 12, 12, 7); // folhas
  }
}
