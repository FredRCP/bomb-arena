import Phaser from 'phaser';
import type { GameEvent, GameState } from '../core';
import { TILE_SIZE } from './ArenaRenderer';
import { COLORS } from './palette';
import { ParticleSystem, alphaOf, fancyEffectsOn, sizeOf } from './particles';

// Efeitos visuais da arena: faíscas e fumaça na célula da bomba que explode, estilhaços quando uma caixa quebra, brilho ao pegar item,
// poeira de corrida e um leve tremor de tela. Tudo vem dos eventos do core e só desenha: não muda nenhuma regra.
// Abra o jogo com ?fx=0 para desligar tudo (se o computador estiver lento, por exemplo).

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

const SPARK_COLORS = [0xffe66d, 0xffa94d, 0xff6b35, 0xffffff] as const;
const CHIP_COLORS = [COLORS.blockFace, COLORS.blockShadow, COLORS.blockLine] as const;
const SMOKE_COLORS = [0x6c6f7a, 0x8a8d99, 0xa4a7b3] as const;
const DUST_COLOR = 0xe8dcc0;

export class Effects {
  private readonly particles = new ParticleSystem();
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly enabled: boolean;
  private readonly lastPos = new Map<number, { x: number; y: number }>();
  private readonly dustClock = new Map<number, number>();

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(12);
    let on = true;
    try {
      on = new URLSearchParams(window.location.search).get('fx') !== '0';
    } catch {
      /* sem endereço (testes): efeitos ligados */
    }
    this.enabled = on;
  }

  /** Reage aos eventos do core (chamado junto com o som). */
  onEvents(events: readonly GameEvent[], state: GameState): void {
    if (!this.enabled) return;
    for (const event of events) {
      if (event.type === 'bombExploded') this.bombBlast(event.col, event.row);
      if (event.type === 'blockDestroyed') this.breakBlock(event.col, event.row);
      if (event.type === 'bombPlaced') this.puff((event.col + 0.5) * TILE_SIZE, (event.row + 0.9) * TILE_SIZE, 3, 0.35);
      if (event.type === 'itemPicked' || event.type === 'playerRevived') {
        const p = state.players.find((q) => q.id === (event.type === 'itemPicked' ? event.playerId : event.playerId));
        if (p) this.sparkle(p.x * TILE_SIZE, p.y * TILE_SIZE - 20, event.type === 'itemPicked' ? 0xffe66d : 0x7ed957);
      }
      if (event.type === 'vestBroken' || event.type === 'playerHit') {
        const p = state.players.find((q) => q.id === event.playerId);
        if (p) this.stars(p.x * TILE_SIZE, p.y * TILE_SIZE - 30);
      }
    }
  }

  /** Chamado a cada quadro da tela: nasce o que for novo, anda com as partículas e desenha. */
  update(deltaMs: number, state: GameState): void {
    if (!this.enabled) return;
    this.spawnDust(deltaMs / 1000, state);
    this.particles.update(deltaMs / 1000);
    this.draw();
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    for (const p of this.particles.list) {
      const alpha = alphaOf(p);
      const size = sizeOf(p);
      if (p.kind === 'ring') {
        g.lineStyle(3, p.color, alpha);
        g.strokeCircle(p.x, p.y, size);
      } else if (p.kind === 'chip') {
        g.fillStyle(p.color, alpha);
        g.fillRect(p.x - size / 2, p.y - size / 2, size, size * 0.7);
      } else {
        g.fillStyle(p.color, p.kind === 'smoke' ? alpha * 0.55 : alpha);
        g.fillCircle(p.x, p.y, size);
      }
    }
  }

  /** Faíscas e fumaça só na célula da bomba. O resto da explosão fica só com o fogo, como era. */
  private bombBlast(col: number, row: number): void {
    const cx = (col + 0.5) * TILE_SIZE;
    const cy = (row + 0.5) * TILE_SIZE;
    for (let i = 0; i < 8; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(80, 220);
      this.particles.spawn({ kind: 'spark', x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40, gravity: 260, life: rand(0.25, 0.5), size0: rand(3, 5), size1: 1, color: pick(SPARK_COLORS) });
    }
    for (let i = 0; i < 2; i++) {
      this.particles.spawn({ kind: 'smoke', x: cx + rand(-10, 10), y: cy + rand(-6, 6), vx: rand(-14, 14), vy: rand(-30, -12), gravity: -10, life: rand(0.6, 0.9), size0: 12, size1: 30, color: pick(SMOKE_COLORS) });
    }
  }

  /** Estilhaços laranja e uma nuvem de poeira onde a caixa quebrou. */
  private breakBlock(col: number, row: number): void {
    const cx = (col + 0.5) * TILE_SIZE;
    const cy = (row + 0.5) * TILE_SIZE;
    for (let i = 0; i < 5; i++) {
      const angle = rand(-Math.PI, 0);
      const speed = rand(90, 240);
      this.particles.spawn({ kind: 'chip', x: cx + rand(-14, 14), y: cy + rand(-10, 10), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 620, life: rand(0.5, 0.8), size0: rand(7, 12), size1: 5, color: pick(CHIP_COLORS) });
    }
    this.puff(cx, cy, 2, 0.6);
  }

  private puff(x: number, y: number, count: number, life: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.spawn({ kind: 'smoke', x: x + rand(-14, 14), y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-26, -6), gravity: -8, life: rand(life * 0.7, life), size0: 7, size1: 22, color: DUST_COLOR });
    }
  }

  /** Brilho ao pegar um item: um anel que se abre e faíscas subindo. */
  private sparkle(x: number, y: number, color: number): void {
    this.particles.spawn({ kind: 'ring', x, y, vx: 0, vy: 0, gravity: 0, life: 0.45, size0: 8, size1: 34, color });
    for (let i = 0; i < 6; i++) {
      const angle = rand(0, Math.PI * 2);
      this.particles.spawn({ kind: 'spark', x, y, vx: Math.cos(angle) * 90, vy: Math.sin(angle) * 90 - 50, gravity: 120, life: rand(0.4, 0.7), size0: 4, size1: 1, color });
    }
  }

  /** Estrelinhas quando alguém é atingido. */
  private stars(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.particles.spawn({ kind: 'spark', x, y, vx: Math.cos(angle) * 160, vy: Math.sin(angle) * 160 - 60, gravity: 300, life: 0.55, size0: 5, size1: 1.5, color: i % 2 ? 0xffe66d : 0xffffff });
    }
  }

  /** Poeirinha atrás de quem corre (desliga sozinha se o jogo estiver lento). */
  private spawnDust(dt: number, state: GameState): void {
    const fancy = fancyEffectsOn(this.scene.game.loop.actualFps);
    for (const player of state.players) {
      const last = this.lastPos.get(player.id);
      this.lastPos.set(player.id, { x: player.x, y: player.y });
      if (!fancy || !last || !player.alive || player.sideline !== null) continue;
      const moved = Math.hypot(player.x - last.x, player.y - last.y);
      if (moved < 0.01 || moved > 0.5) continue; // parado, ou saltou (voltou à arena)
      const clock = (this.dustClock.get(player.id) ?? 0) + dt;
      if (clock < 0.16) {
        this.dustClock.set(player.id, clock);
        continue;
      }
      this.dustClock.set(player.id, 0);
      this.particles.spawn({ kind: 'smoke', x: player.x * TILE_SIZE + rand(-6, 6), y: player.y * TILE_SIZE + 26, vx: rand(-14, 14), vy: rand(-16, -4), gravity: -6, life: 0.4, size0: 4, size1: 13, color: DUST_COLOR });
    }
  }
}
