import type { Direction } from '../core/types';

// Escolha da pose de um personagem com sprites (corpo inteiro). Só lógica, sem Phaser, por isso tem teste.
// As imagens ficam em public/characters/<id>/<pose>.png (veja characters.ts).

/**
 * Quadros de corrida e de colocar bomba. As imagens só existem para a direita (e de frente/costas): a esquerda é a da
 * direita espelhada (flipX). Cada sequência lista os números dos quadros, na ordem em que passam.
 * Cada direção (frente, costas e lado) tem 8 quadros de corrida.
 */
export const RUN_CYCLES = {
  down: [1, 2, 3, 4, 5, 6, 7, 8],
  up: [1, 2, 3, 4, 5, 6, 7, 8],
  right: [1, 2, 3, 4, 5, 6, 7, 8],
} as const;
/** Colocar bomba: 4 quadros (agacha, abaixa, solta, levanta), de lado ('side') ou de frente ('front'). */
export const BOMB_FRAMES = 4;

const RUN_FILES = (['down', 'up', 'right'] as const).flatMap((dir) =>
  [...new Set<number>(RUN_CYCLES[dir])].map((n) => `run-${dir}-${n}` as const),
);
const BOMB_FILES = (['side', 'front'] as const).flatMap((kind) =>
  Array.from({ length: BOMB_FRAMES }, (_, i) => `bomb-${kind}-${i + 1}` as const),
);
/** Todas as imagens de pose de um personagem com sprites (public/characters/<id>/<nome>.png). */
export const SPRITE_POSES = ['idle-down', 'idle-up', 'idle-right', 'win', 'lose', ...RUN_FILES, ...BOMB_FILES] as const;
export type SpritePose = (typeof SPRITE_POSES)[number];

/** O quadro a desenhar: qual imagem e se ela deve ser espelhada na horizontal. */
export interface SpriteFrame {
  pose: SpritePose;
  flipX: boolean;
}

/** Outras imagens do personagem: o rosto (normal, feliz, triste) e o desenho grande da tela de escolha. */
export const SPRITE_EXTRAS = ['face', 'face-happy', 'face-sad', 'art'] as const;
export type SpriteExtra = (typeof SPRITE_EXTRAS)[number];

/**
 * Distância (em casas) que o personagem percorre durante um ciclo completo de corrida (todos os quadros).
 * O quadro vem da distância andada, e não do relógio: com mais velocidade, os passos ficam mais rápidos sozinhos.
 * Valor pequeno = pernas rápidas (parece correria sem sair do lugar); valor grande = pernas lentas (parece patinar).
 * Dá para testar sem mexer no código: abra o jogo com ?cycle=1.0, ?cycle=2.0 etc. no endereço.
 */
export const WALK_CYCLE_TILES = 0.9;
/** Depois de eliminado, a pose de derrota fica na tela por este tempo (1,5 s) e vai sumindo. */
export const LOSE_VISIBLE_TICKS = 90;
/** Quanto tempo a pose de "colocar bomba" aparece depois de soltar a bomba (passos). */
export const BOMB_POSE_TICKS = 20;
/** Parado há mais que isto (passos), o personagem não está mais "andando". */
export const MOVING_GRACE_TICKS = 3;

export interface PoseInput {
  alive: boolean;
  /** play: partida normal; idle: sempre de pé, mesmo eliminado (jogador das laterais); win: comemorando. */
  mode: 'play' | 'idle' | 'win';
  facing: Direction;
  moving: boolean;
  /** Quantos ciclos de corrida já foram percorridos desde que começou a andar (só a parte fracionária importa). */
  walkPhase: number;
  tick: number;
  /** A pose da bomba vale enquanto tick < bombUntil. */
  bombUntil: number;
}

export function chooseSpriteFrame(input: PoseInput): SpriteFrame {
  const left = input.facing === 'left';
  const side = left || input.facing === 'right';
  if (input.mode === 'win') return { pose: 'win', flipX: false };
  if (input.mode === 'play' && !input.alive) return { pose: 'lose', flipX: false };
  if (input.mode === 'play' && input.tick < input.bombUntil) {
    // Os 4 quadros se distribuem por todo o tempo da pose.
    const elapsed = input.tick - (input.bombUntil - BOMB_POSE_TICKS);
    const n = Math.min(BOMB_FRAMES, 1 + Math.floor((Math.max(0, elapsed) * BOMB_FRAMES) / BOMB_POSE_TICKS));
    return { pose: `bomb-${side ? 'side' : 'front'}-${n}` as SpritePose, flipX: left };
  }
  if (input.mode === 'play' && input.moving) {
    const dir = side ? 'right' : (input.facing as 'up' | 'down');
    const cycle = RUN_CYCLES[dir];
    const fraction = input.walkPhase - Math.floor(input.walkPhase);
    const n = cycle[Math.min(cycle.length - 1, Math.floor(fraction * cycle.length))];
    return { pose: `run-${dir}-${n}` as SpritePose, flipX: left };
  }
  return { pose: side ? 'idle-right' : `idle-${input.facing as 'up' | 'down'}`, flipX: left };
}

/** Transparência da pose de derrota: inteira por 2/3 do tempo e depois some; 0 = já pode esconder. */
export function loseAlpha(deadTicks: number): number {
  const fadeStart = (LOSE_VISIBLE_TICKS * 2) / 3;
  if (deadTicks <= fadeStart) return 1;
  return Math.max(0, 1 - (deadTicks - fadeStart) / (LOSE_VISIBLE_TICKS - fadeStart));
}
