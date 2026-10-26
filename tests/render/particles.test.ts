import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, ParticleSystem, ageOf, alphaOf, fancyEffectsOn, sizeOf } from '../../src/render/particles';
import type { Particle } from '../../src/render/particles';

const base: Omit<Particle, 'maxLife'> = { kind: 'spark', x: 0, y: 0, vx: 100, vy: 0, gravity: 200, life: 1, size0: 10, size1: 0, color: 0xffffff };

describe('partículas', () => {
  it('anda com velocidade e gravidade', () => {
    const system = new ParticleSystem();
    system.spawn(base);
    system.update(0.1);
    const p = system.list[0]!;
    expect(p.x).toBeCloseTo(10);
    expect(p.vy).toBeCloseTo(20);
    expect(p.y).toBeCloseTo(2);
  });

  it('some quando a vida acaba', () => {
    const system = new ParticleSystem();
    system.spawn({ ...base, life: 0.2 });
    system.update(0.1);
    expect(system.list).toHaveLength(1);
    system.update(0.1);
    system.update(0.1);
    expect(system.list).toHaveLength(0);
  });

  it('respeita o limite de partículas', () => {
    const system = new ParticleSystem();
    for (let i = 0; i < MAX_PARTICLES + 50; i++) system.spawn(base);
    expect(system.list).toHaveLength(MAX_PARTICLES);
    expect(system.spawn(base)).toBe(false);
  });

  it('um quadro muito lento não teleporta as partículas', () => {
    const system = new ParticleSystem();
    system.spawn({ ...base, life: 5 });
    system.update(3);
    expect(system.list[0]!.x).toBeCloseTo(10); // só 0,1 s é simulado
  });

  it('tamanho e transparência acompanham a idade', () => {
    const p: Particle = { ...base, maxLife: 1, life: 1 };
    expect(ageOf(p)).toBe(0);
    expect(sizeOf(p)).toBe(10);
    expect(alphaOf(p)).toBe(1);
    p.life = 0.5;
    expect(sizeOf(p)).toBeCloseTo(5);
    expect(alphaOf(p)).toBeCloseTo(0.75);
    p.life = 0;
    expect(alphaOf(p)).toBe(0);
  });

  it('desliga os efeitos extras quando o jogo está lento', () => {
    expect(fancyEffectsOn(0)).toBe(true);
    expect(fancyEffectsOn(60)).toBe(true);
    expect(fancyEffectsOn(14)).toBe(false);
  });
});
