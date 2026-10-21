import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core';

function take(rng: () => number, count: number): number[] {
  return Array.from({ length: count }, () => rng());
}

describe('createRng', () => {
  it('repete a mesma sequência para a mesma semente', () => {
    expect(take(createRng(42), 20)).toEqual(take(createRng(42), 20));
  });

  it('gera sequências diferentes para sementes diferentes', () => {
    expect(take(createRng(1), 20)).not.toEqual(take(createRng(2), 20));
  });

  it('só devolve números em [0, 1)', () => {
    for (const value of take(createRng(123), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
