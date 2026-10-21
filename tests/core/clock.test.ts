import { describe, expect, it } from 'vitest';
import { MAX_TICKS_PER_FRAME } from '../../src/config/simulation';
import { createFixedStepper } from '../../src/core';

describe('createFixedStepper (60 passos por segundo por padrão)', () => {
  it('devolve 0 até acumular um passo inteiro', () => {
    const stepper = createFixedStepper();
    expect(stepper.advance(10)).toBe(0);
    expect(stepper.advance(10)).toBe(1);
  });

  it('um quadro de 1/60 s rende exatamente um passo', () => {
    expect(createFixedStepper().advance(1000 / 60)).toBe(1);
  });

  it('100 ms rendem 6 passos quando o limite por quadro permite', () => {
    expect(createFixedStepper(60, 10).advance(100)).toBe(6);
  });

  it('guarda o resto entre quadros', () => {
    const stepper = createFixedStepper();
    expect(stepper.advance(25)).toBe(1); // sobram ~8,3 ms
    expect(stepper.advance(8.4)).toBe(1); // 8,3 + 8,4 já fecha outro passo
  });

  it('o total de passos é o mesmo em 60 e em 144 quadros por segundo', () => {
    function ticksIn10Seconds(fps: number): number {
      const stepper = createFixedStepper();
      let total = 0;
      for (let frame = 0; frame < fps * 10; frame++) total += stepper.advance(1000 / fps);
      return total;
    }

    expect(ticksIn10Seconds(60)).toBeGreaterThanOrEqual(599);
    expect(ticksIn10Seconds(60)).toBeLessThanOrEqual(600);
    expect(ticksIn10Seconds(144)).toBeGreaterThanOrEqual(599);
    expect(ticksIn10Seconds(144)).toBeLessThanOrEqual(600);
    expect(ticksIn10Seconds(30)).toBeGreaterThanOrEqual(599);
    expect(ticksIn10Seconds(30)).toBeLessThanOrEqual(600);
  });

  it('limita os passos por quadro e descarta o atraso acumulado', () => {
    const stepper = createFixedStepper();
    expect(stepper.advance(10_000)).toBe(MAX_TICKS_PER_FRAME);
    expect(stepper.advance(0)).toBe(0);
    expect(stepper.advance(1000 / 60)).toBe(1); // sem "dívida" de tempo
  });

  it('ignora valores inválidos', () => {
    const stepper = createFixedStepper();
    expect(stepper.advance(-5)).toBe(0);
    expect(stepper.advance(Number.NaN)).toBe(0);
    expect(stepper.advance(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('reset esquece o tempo acumulado', () => {
    const stepper = createFixedStepper();
    stepper.advance(10);
    stepper.reset();
    expect(stepper.advance(10)).toBe(0);
  });

  it('aceita outra taxa e outro limite', () => {
    const stepper = createFixedStepper(10, 3);
    expect(stepper.advance(250)).toBe(2);
    expect(stepper.advance(1000)).toBe(3);
  });
});
