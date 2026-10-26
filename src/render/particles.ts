// Partículas dos efeitos visuais. Esta parte é só conta (sem Phaser): cada partícula tem posição, velocidade,
// tempo de vida e tamanho, e `update` anda com todas. O desenho fica em Effects.ts. Separar assim permite testar.

export type ParticleKind = 'spark' | 'smoke' | 'chip' | 'ring';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Aceleração para baixo (px/s²): faz estilhaços caírem. Fumaça usa valor negativo (sobe). */
  gravity: number;
  /** Segundos de vida que restam e a vida total (para saber o quanto já envelheceu). */
  life: number;
  maxLife: number;
  size0: number;
  size1: number;
  color: number;
}

/** Limite de partículas vivas ao mesmo tempo: protege computadores fracos. Passando disso, as novas são ignoradas. */
export const MAX_PARTICLES = 260;

export class ParticleSystem {
  readonly list: Particle[] = [];

  /** Cria uma partícula. Devolve false se o limite foi atingido. */
  spawn(p: Omit<Particle, 'maxLife'>): boolean {
    if (this.list.length >= MAX_PARTICLES) return false;
    this.list.push({ ...p, maxLife: p.life });
    return true;
  }

  /** Anda `dt` segundos: move, aplica a gravidade e remove as que acabaram. */
  update(dt: number): void {
    const step = Math.min(dt, 0.1); // um engasgo da máquina não pode "teleportar" as partículas
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]!;
      p.life -= step;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
    }
  }

  clear(): void {
    this.list.length = 0;
  }
}

/** Quanto da vida da partícula já passou, de 0 (nascendo) a 1 (sumindo). */
export function ageOf(p: Particle): number {
  return 1 - p.life / p.maxLife;
}

/** Tamanho atual: vai do tamanho inicial ao final conforme envelhece. */
export function sizeOf(p: Particle): number {
  const t = ageOf(p);
  return p.size0 + (p.size1 - p.size0) * t;
}

/** Transparência atual: some no final da vida. */
export function alphaOf(p: Particle): number {
  const t = ageOf(p);
  return Math.max(0, 1 - t * t);
}

/** Decide se os efeitos "extras" (poeira de corrida) devem aparecer: desliga sozinho quando o jogo está lento. */
export function fancyEffectsOn(fps: number): boolean {
  return fps === 0 || fps >= 30; // fps 0 = ainda não medido
}
