import { describe, expect, it } from 'vitest';
import { BOMB_POSE_TICKS, LOSE_VISIBLE_TICKS, SPRITE_POSES, chooseSpriteFrame, loseAlpha } from '../../src/characters/poses';
import type { PoseInput } from '../../src/characters/poses';

const base: PoseInput = { alive: true, mode: 'play', facing: 'down', moving: false, walkPhase: 0, tick: 0, bombUntil: -1 };

describe('chooseSpriteFrame', () => {
  it('parado: pose de descanso na direção em que olha', () => {
    expect(chooseSpriteFrame({ ...base, facing: 'up' })).toEqual({ pose: 'idle-up', flipX: false });
  });
  it('esquerda é a imagem da direita espelhada', () => {
    expect(chooseSpriteFrame({ ...base, facing: 'left' })).toEqual({ pose: 'idle-right', flipX: true });
    expect(chooseSpriteFrame({ ...base, facing: 'right' })).toEqual({ pose: 'idle-right', flipX: false });
  });
  it('andando de lado percorre os 8 quadros de corrida, espelhados para a esquerda', () => {
    const poses = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => chooseSpriteFrame({ ...base, moving: true, facing: 'left', walkPhase: i / 8 }));
    expect(poses.map((f) => f.pose)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `run-right-${n}`));
    expect(poses.every((f) => f.flipX)).toBe(true);
  });
  it('o quadro depende só da distância andada: ciclo recomeça a cada volta completa', () => {
    const a = chooseSpriteFrame({ ...base, moving: true, facing: 'right', walkPhase: 0.1 });
    const b = chooseSpriteFrame({ ...base, moving: true, facing: 'right', walkPhase: 3.1 });
    expect(a).toEqual(b);
  });
  it('andando de frente e de costas também percorrem 8 quadros', () => {
    for (const facing of ['down', 'up'] as const) {
      const poses = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => chooseSpriteFrame({ ...base, moving: true, facing, walkPhase: i / 8 }).pose);
      expect(poses).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `run-${facing}-${n}`));
    }
  });
  it('colocar bomba passa pelos 4 quadros, de lado ou de frente, e depois volta ao normal', () => {
    const at = (elapsed: number, facing: PoseInput['facing']) => chooseSpriteFrame({ ...base, facing, moving: true, tick: 100 + elapsed, bombUntil: 100 + BOMB_POSE_TICKS });
    expect([0, 5, 10, 15].map((e) => at(e, 'right').pose)).toEqual(['bomb-side-1', 'bomb-side-2', 'bomb-side-3', 'bomb-side-4']);
    expect(at(0, 'down').pose).toBe('bomb-front-1');
    expect(at(0, 'left').flipX).toBe(true);
    expect(chooseSpriteFrame({ ...base, tick: 100 + BOMB_POSE_TICKS, bombUntil: 100 + BOMB_POSE_TICKS }).pose).toBe('idle-down');
  });
  it('toda pose escolhida existe na lista de imagens', () => {
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      for (let tick = 0; tick < 40; tick++) {
        for (const bombUntil of [-1, 30]) {
          const frame = chooseSpriteFrame({ ...base, facing, moving: true, walkPhase: tick / 7, tick, bombUntil });
          expect(SPRITE_POSES).toContain(frame.pose);
        }
      }
    }
  });
  it('eliminado mostra derrota; vitória vence tudo; laterais ficam em pé', () => {
    expect(chooseSpriteFrame({ ...base, alive: false }).pose).toBe('lose');
    expect(chooseSpriteFrame({ ...base, mode: 'win' }).pose).toBe('win');
    expect(chooseSpriteFrame({ ...base, mode: 'idle', moving: true, walkPhase: 0.5 }).pose).toBe('idle-down');
  });
});

describe('loseAlpha', () => {
  it('fica opaco, some aos poucos e chega a zero', () => {
    expect(loseAlpha(0)).toBe(1);
    expect(loseAlpha(LOSE_VISIBLE_TICKS * 0.5)).toBe(1);
    const mid = loseAlpha(LOSE_VISIBLE_TICKS * 0.85);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(loseAlpha(LOSE_VISIBLE_TICKS)).toBe(0);
  });
});
