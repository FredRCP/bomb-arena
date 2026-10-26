import { describe, expect, it } from 'vitest';
import { REPEAT_DELAY_MS, startPadMemory, stepPadNav } from '../../src/input/padNavLogic';
import type { PadSnapshot } from '../../src/input/gamepad';

const pad = (pressedButtons: number[] = [], stickX = 0, stickY = 0): PadSnapshot => {
  const pressed: boolean[] = [];
  for (let i = 0; i < 17; i++) pressed[i] = pressedButtons.includes(i);
  return { stickX, stickY, pressed };
};

describe('navegação de menu com o controle', () => {
  it('um aperto do A vira uma única confirmação', () => {
    const mem = startPadMemory(pad(), 0);
    expect(stepPadNav(mem, pad([0]), 10)).toEqual(['confirm']);
    expect(stepPadNav(mem, pad([0]), 20)).toEqual([]); // segurando: nada de novo
    expect(stepPadNav(mem, pad(), 30)).toEqual([]);
    expect(stepPadNav(mem, pad([0]), 40)).toEqual(['confirm']); // soltou e apertou de novo
  });

  it('o A ainda apertado da tela anterior NÃO avança a tela nova (era o bug de pular telas)', () => {
    // A tela nova vê o controle pela primeira vez com o A ainda segurado.
    const mem = startPadMemory(pad([0]), 0);
    expect(stepPadNav(mem, pad([0]), 16)).toEqual([]);
    expect(stepPadNav(mem, pad([0]), 32)).toEqual([]);
    expect(stepPadNav(mem, pad(), 48)).toEqual([]);
    expect(stepPadNav(mem, pad([0]), 64)).toEqual(['confirm']); // só depois de soltar
  });

  it('o B (voltar) também espera soltar', () => {
    const mem = startPadMemory(pad([1]), 0);
    expect(stepPadNav(mem, pad([1]), 16)).toEqual([]);
    stepPadNav(mem, pad(), 32);
    expect(stepPadNav(mem, pad([1]), 48)).toEqual(['back']);
  });

  it('direção: dispara ao mudar e repete devagar segurando', () => {
    const mem = startPadMemory(pad(), 0);
    expect(stepPadNav(mem, pad([15]), 100)).toEqual(['right']);
    expect(stepPadNav(mem, pad([15]), 200)).toEqual([]);
    expect(stepPadNav(mem, pad([15]), 100 + REPEAT_DELAY_MS + 200)).toEqual(['right']);
  });

  it('direção já segurada ao entrar na tela não dispara', () => {
    const mem = startPadMemory(pad([13]), 0);
    expect(stepPadNav(mem, pad([13]), 16)).toEqual([]);
  });
});
