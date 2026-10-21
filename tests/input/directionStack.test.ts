import { describe, expect, it } from 'vitest';
import { DirectionStack } from '../../src/input/directionStack';

describe('DirectionStack', () => {
  it('começa sem direção', () => {
    expect(new DirectionStack().current()).toBeNull();
  });

  it('uma tecla apertada define a direção', () => {
    const stack = new DirectionStack();
    stack.press('D', 'right');
    expect(stack.current()).toBe('right');
  });

  it('vale a última tecla apertada que ainda está segurada', () => {
    const stack = new DirectionStack();
    stack.press('D', 'right');
    stack.press('W', 'up');
    expect(stack.current()).toBe('up');
  });

  it('soltar a última tecla volta para a anterior que continua segurada', () => {
    const stack = new DirectionStack();
    stack.press('D', 'right');
    stack.press('W', 'up');
    stack.release('W');
    expect(stack.current()).toBe('right');
    stack.release('D');
    expect(stack.current()).toBeNull();
  });

  it('soltar uma tecla do meio não muda a direção atual', () => {
    const stack = new DirectionStack();
    stack.press('A', 'left');
    stack.press('W', 'up');
    stack.press('D', 'right');
    stack.release('W');
    expect(stack.current()).toBe('right');
  });

  it('repetição da mesma tecla não muda a ordem', () => {
    const stack = new DirectionStack();
    stack.press('D', 'right');
    stack.press('W', 'up');
    stack.press('D', 'right'); // repetição automática do teclado
    expect(stack.current()).toBe('up');
  });

  it('duas teclas para a mesma direção: soltar uma não para o jogador', () => {
    const stack = new DirectionStack();
    stack.press('W', 'up');
    stack.press('UP', 'up');
    stack.release('UP');
    expect(stack.current()).toBe('up');
  });

  it('soltar uma tecla que não estava apertada não faz nada', () => {
    const stack = new DirectionStack();
    stack.press('D', 'right');
    stack.release('Q');
    expect(stack.current()).toBe('right');
  });

  it('clear esquece tudo', () => {
    const stack = new DirectionStack();
    stack.press('D', 'right');
    stack.press('W', 'up');
    stack.clear();
    expect(stack.current()).toBeNull();
  });
});
