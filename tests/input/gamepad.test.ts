import { describe, expect, it } from 'vitest';
import { PAD_BUTTONS, STICK_DEADZONE, padBack, padBomb, padDirection, padSpecial, padStart } from '../../src/input/gamepad';
import type { PadSnapshot } from '../../src/input/gamepad';

const pad = (over: Partial<PadSnapshot> & { buttons?: number[] } = {}): PadSnapshot => {
  const pressed: boolean[] = [];
  for (const b of over.buttons ?? []) pressed[b] = true;
  return { stickX: over.stickX ?? 0, stickY: over.stickY ?? 0, pressed };
};

describe('controle de videogame', () => {
  it('parado: sem direção', () => {
    expect(padDirection(pad())).toBeNull();
  });

  it('direcional (botões 12 a 15) manda uma direção', () => {
    expect(padDirection(pad({ buttons: [PAD_BUTTONS.up] }))).toBe('up');
    expect(padDirection(pad({ buttons: [PAD_BUTTONS.down] }))).toBe('down');
    expect(padDirection(pad({ buttons: [PAD_BUTTONS.left] }))).toBe('left');
    expect(padDirection(pad({ buttons: [PAD_BUTTONS.right] }))).toBe('right');
  });

  it('alavanca: zona morta ignora movimentos fracos; vale o eixo mais inclinado (sem diagonais)', () => {
    expect(padDirection(pad({ stickX: STICK_DEADZONE - 0.01 }))).toBeNull();
    expect(padDirection(pad({ stickX: 0.9, stickY: 0.4 }))).toBe('right');
    expect(padDirection(pad({ stickX: -0.6, stickY: -0.9 }))).toBe('up');
    expect(padDirection(pad({ stickX: 0.1, stickY: 1 }))).toBe('down');
    expect(padDirection(pad({ stickX: -1 }))).toBe('left');
  });

  it('o direcional tem prioridade sobre a alavanca', () => {
    expect(padDirection(pad({ buttons: [PAD_BUTTONS.left], stickX: 1 }))).toBe('left');
  });

  it('A/✕ e X/□ colocam bomba; B/○ e Y/△ são o especial; Start e Select', () => {
    expect(padBomb(pad({ buttons: [0] }))).toBe(true);
    expect(padBomb(pad({ buttons: [2] }))).toBe(true);
    expect(padBomb(pad({ buttons: [1] }))).toBe(false);
    expect(padSpecial(pad({ buttons: [1] }))).toBe(true);
    expect(padSpecial(pad({ buttons: [3] }))).toBe(true);
    expect(padSpecial(pad({ buttons: [0] }))).toBe(false);
    expect(padStart(pad({ buttons: [9] }))).toBe(true);
    expect(padBack(pad({ buttons: [8] }))).toBe(true);
    expect(padStart(pad())).toBe(false);
  });
});
