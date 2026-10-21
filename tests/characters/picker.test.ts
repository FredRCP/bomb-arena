import { describe, expect, it } from 'vitest';
import { CHARACTERS, characterById, defaultChoices } from '../../src/characters/characters';
import { PICKER_COLUMNS, allConfirmed, cancelPick, confirmPick, createPicker, finalizeChoices, moveCursor } from '../../src/characters/picker';
import { createRng } from '../../src/core/random';

describe('personagens', () => {
  it('ids únicos e id desconhecido cai no primeiro', () => {
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    expect(characterById('nao-existe').id).toBe(CHARACTERS[0]!.id);
    expect(characterById('fred').name).toBe('Fred');
  });

  it('a família está na lista', () => {
    const custom = CHARACTERS.filter((c) => c.custom).map((c) => c.name);
    expect(custom).toEqual(['Fred', 'Vanessa', 'Ana Júlia', 'Lucas', 'Filippe', 'Waleska', 'Gláucio']);
  });

  it('escolha padrão: cada jogador um personagem diferente', () => {
    const choices = defaultChoices(4);
    expect(new Set(Object.values(choices)).size).toBe(4);
  });
});

describe('escolha de personagem', () => {
  it('esquerda/direita dão a volta; cima/baixo param na borda', () => {
    const picker = createPicker(1);
    moveCursor(picker, 0, -1, 0);
    expect(picker.cursor[0]).toBe(CHARACTERS.length - 1);
    moveCursor(picker, 0, 1, 0);
    expect(picker.cursor[0]).toBe(0);
    moveCursor(picker, 0, 0, -1);
    expect(picker.cursor[0]).toBe(0);
    moveCursor(picker, 0, 0, 1);
    expect(picker.cursor[0]).toBe(PICKER_COLUMNS);
    moveCursor(picker, 0, 0, 1); // não existe terceira linha
    expect(picker.cursor[0]).toBe(PICKER_COLUMNS);
  });

  it('dois jogadores não confirmam o mesmo personagem', () => {
    const picker = createPicker(2);
    picker.cursor[1] = picker.cursor[0]!;
    expect(confirmPick(picker, 0)).toBe(true);
    expect(confirmPick(picker, 1)).toBe(false);
    moveCursor(picker, 1, 1, 0);
    expect(confirmPick(picker, 1)).toBe(true);
    expect(allConfirmed(picker)).toBe(true);
  });

  it('quem confirmou não anda; cancelar libera, e cancelar sem confirmação devolve false', () => {
    const picker = createPicker(1);
    expect(cancelPick(picker, 0)).toBe(false);
    confirmPick(picker, 0);
    moveCursor(picker, 0, 1, 0);
    expect(picker.cursor[0]).toBe(0);
    expect(cancelPick(picker, 0)).toBe(true);
    moveCursor(picker, 0, 1, 0);
    expect(picker.cursor[0]).toBe(1);
  });

  it('finalizeChoices: inimigos recebem personagens livres e distintos, sempre os mesmos com a mesma semente', () => {
    const picker = createPicker(2);
    const a = finalizeChoices(picker, 2, createRng(7));
    const b = finalizeChoices(picker, 2, createRng(7));
    expect(a).toEqual(b);
    expect(Object.keys(a)).toEqual(['1', '2', '3', '4']);
    expect(new Set(Object.values(a)).size).toBe(4);
  });
});
