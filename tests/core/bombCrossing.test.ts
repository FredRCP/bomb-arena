import { describe, expect, it } from 'vitest';
import { PLAYER_HALF_SIZE } from '../../src/config/simulation';
import { goesDeeperIntoBomb } from '../../src/core';
import { addBomb, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const H = PLAYER_HALF_SIZE;
const CORRIDOR = ['#########', '#.......#', '#########'];

describe('bomba: sair é permitido, atravessar não', () => {
  it('quem está só com a pontinha do corpo sobre a bomba não consegue atravessá-la', () => {
    // Bomba na coluna 3. O jogador 2 está na coluna 4 com o corpo invadindo só um pouco a coluna 3.
    const state = stateFromText(CORRIDOR, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 4, row: 1 },
    ]);
    const edge = 4 + H - 0.05; // borda esquerda do corpo em 3,95: já "em cima" da bomba
    state.players[1]!.x = edge;
    addBomb(state, 3, 1, { owner: 1, ticksLeft: 500, walkThrough: [2] });

    run(state, 120, { 2: { move: 'left' } });

    expect(state.players[1]!.x).toBeGreaterThanOrEqual(edge - 1e-6); // não entrou mais fundo
  });

  it('o dono continua podendo sair da bomba que acabou de colocar, em qualquer direção', () => {
    for (const move of ['left', 'right'] as const) {
      const state = stateFromText(CORRIDOR, [{ id: 1, col: 4, row: 1 }]);
      run(state, 1, { 1: { move: null, placeBomb: true } });
      run(state, 40, { 1: { move } });
      const x = state.players[0]!.x;
      // saiu da célula 4 por completo (borda do corpo fora dela)
      expect(move === 'left' ? x + H <= 4 + 1e-6 : x - H >= 5 - 1e-6).toBe(true);
    }
  });

  it('depois de sair, a bomba bloqueia o dono (não dá para voltar)', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 4, row: 1 }]);
    run(state, 1, { 1: { move: null, placeBomb: true } });
    run(state, 40, { 1: { move: 'left' } });
    run(state, 80, { 1: { move: 'right' } });
    expect(state.players[0]!.x + H).toBeLessThanOrEqual(4 + 1e-6);
  });

  it('goesDeeperIntoBomb: afastar-se do centro pode, aproximar-se não', () => {
    const soft = [{ col: 3, row: 1 }];
    expect(goesDeeperIntoBomb(4.2, 1.5, 4.25, 1.5, soft)).toBe(false); // centro fora da célula, afastando da bomba (centro dela em 3,5)
    expect(goesDeeperIntoBomb(4.2, 1.5, 4.15, 1.5, soft)).toBe(true); // aproximando: atravessar não pode
    expect(goesDeeperIntoBomb(3.7, 1.5, 3.65, 1.5, soft)).toBe(false); // centro dentro da célula: anda livre (quem colocou a bomba)
    expect(goesDeeperIntoBomb(3.9, 1.5, 3.9, 1.5, [])).toBe(false);
  });
});
