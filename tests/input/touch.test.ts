import { describe, expect, it } from 'vitest';
import { STICK_DEAD_ZONE, inCircle, stickDirection } from '../../src/input/touchLogic';

describe('alavanca de toque', () => {
  it('perto do centro não anda', () => {
    expect(stickDirection(0, 0, 100)).toBeNull();
    expect(stickDirection(STICK_DEAD_ZONE * 100 - 1, 0, 100)).toBeNull();
  });

  it('escolhe a direção do eixo mais afastado', () => {
    expect(stickDirection(60, 10, 100)).toBe('right');
    expect(stickDirection(-60, 10, 100)).toBe('left');
    expect(stickDirection(10, -60, 100)).toBe('up');
    expect(stickDirection(10, 60, 100)).toBe('down');
  });

  it('na diagonal exata prefere o horizontal, sempre o mesmo', () => {
    expect(stickDirection(50, 50, 100)).toBe('right');
    expect(stickDirection(-50, -50, 100)).toBe('left');
  });

  it('o dedo pode passar do raio da alavanca e a direção continua valendo', () => {
    expect(stickDirection(0, 500, 100)).toBe('down');
  });
});

describe('botões redondos', () => {
  it('acerta dentro e erra fora (borda conta como dentro)', () => {
    expect(inCircle(100, 100, 100, 100, 50)).toBe(true);
    expect(inCircle(150, 100, 100, 100, 50)).toBe(true);
    expect(inCircle(151, 100, 100, 100, 50)).toBe(false);
    expect(inCircle(135, 135, 100, 100, 50)).toBe(true);
    expect(inCircle(140, 140, 100, 100, 50)).toBe(false);
  });
});
