import { describe, expect, it } from 'vitest';
import { BOMB_FUSE_TICKS, DEFAULT_BOMB_RANGE } from '../../src/config/bombs';
import { PLAYER_HALF_SIZE } from '../../src/config/simulation';
import { drainEvents, step } from '../../src/core';
import { addBomb, run } from '../helpers/bombHelpers';
import { stateFromText } from '../helpers/stateFromText';

const H = PLAYER_HALF_SIZE;
const PLACE = { 1: { move: null, placeBomb: true } } as const;

// Corredor horizontal: células livres de (1,1) a (7,1).
const CORRIDOR = ['#########', '#.......#', '#########'];

describe('colocar bomba', () => {
  it('coloca a bomba na célula do jogador, com o pavio, o alcance e o dono certos', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    step(state, PLACE);

    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]).toMatchObject({
      owner: 1,
      col: 3,
      row: 1,
      range: DEFAULT_BOMB_RANGE,
      ticksLeft: BOMB_FUSE_TICKS - 1, // o pavio já andou no passo em que a bomba foi colocada
    });
    expect(drainEvents(state)).toEqual([{ type: 'bombPlaced', col: 3, row: 1, owner: 1 }]);
  });

  it('usa a célula do CENTRO do corpo, mesmo com o corpo invadindo a vizinha', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    state.players[0]!.x = 3.9; // centro ainda na coluna 3, corpo já encosta na coluna 4
    step(state, PLACE);
    expect(state.bombs[0]).toMatchObject({ col: 3, row: 1 });
  });

  it('sem pedir bomba, nada é colocado', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    run(state, 10, { 1: { move: null } });
    run(state, 10, { 1: { move: null, placeBomb: false } });
    expect(state.bombs).toEqual([]);
  });

  it('não coloca duas bombas na mesma célula', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1, maxBombs: 5 }]);
    run(state, 5, PLACE);
    expect(state.bombs).toHaveLength(1);
  });

  it('respeita o máximo de bombas do jogador', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }]); // máximo padrão: 1
    step(state, PLACE);
    state.players[0]!.x = 4.5;
    step(state, PLACE);
    expect(state.bombs).toHaveLength(1);
  });

  it('com máximo 2, coloca duas bombas em células diferentes e não a terceira', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1, maxBombs: 2 }]);
    for (const x of [1.5, 3.5, 5.5]) {
      state.players[0]!.x = x;
      step(state, PLACE);
    }
    expect(state.bombs.map((bomb) => bomb.col)).toEqual([1, 3]);
  });

  it('libera a vaga quando a bomba explode: dá para colocar outra depois', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 1, row: 1 }]);
    step(state, PLACE);
    state.players[0]!.x = 7.5; // longe do alcance (célula 1 ± 2)
    run(state, BOMB_FUSE_TICKS);
    expect(state.bombs).toEqual([]);
    state.flames = []; // chamas apagadas: só queremos saber se há vaga
    state.players[0]!.x = 5.5;
    step(state, PLACE);
    expect(state.bombs).toHaveLength(1);
  });

  it('jogador morto não coloca bomba', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    state.players[0]!.alive = false;
    step(state, PLACE);
    expect(state.bombs).toEqual([]);
  });

  it('não coloca bomba em célula que está em chamas', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    state.flames.push({ col: 3, row: 1, ticksLeft: 10 });
    state.players[0]!.alive = true;
    step(state, PLACE);
    // (o jogador morre na chama, mas a bomba nem chega a ser colocada)
    expect(state.bombs).toEqual([]);
  });

  it('os jogadores 1 e 2 pedindo na MESMA célula e no MESMO passo: vale o jogador 1 (regra definida)', () => {
    const state = stateFromText(CORRIDOR, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 3, row: 1 },
    ]);
    step(state, { 1: { move: null, placeBomb: true }, 2: { move: null, placeBomb: true } });
    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]!.owner).toBe(1);
  });

  it('os dois pedindo em células diferentes no mesmo passo: as duas bombas existem', () => {
    const state = stateFromText(CORRIDOR, [
      { id: 1, col: 2, row: 1 },
      { id: 2, col: 5, row: 1 },
    ]);
    step(state, { 1: { move: null, placeBomb: true }, 2: { move: null, placeBomb: true } });
    expect(state.bombs.map((bomb) => [bomb.owner, bomb.col])).toEqual([
      [1, 2],
      [2, 5],
    ]);
  });
});

describe('sair da própria bomba e ser barrado por ela', () => {
  it('quem coloca a bomba consegue sair de cima dela', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    step(state, PLACE);
    run(state, 40, { 1: { move: 'right' } });
    expect(state.players[0]!.x).toBeGreaterThan(5); // andou bem além da célula da bomba (coluna 3)
  });

  it('enquanto o corpo ainda toca a célula, a bomba não bloqueia o dono; ao sair completamente, passa a bloquear', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    step(state, PLACE);
    expect(state.bombs[0]!.walkThrough).toEqual([1]);

    // Andando para a direita: o corpo deixa a coluna 3 quando x - H >= 4, ou seja, x >= 4.4.
    // Antes de cada passo, o corpo ainda toca a coluna 3, então o dono continua na lista.
    while (state.players[0]!.x - H < 4 - 1e-6) {
      expect(state.bombs[0]!.walkThrough).toEqual([1]);
      run(state, 1, { 1: { move: 'right' } });
    }
    expect(state.bombs[0]!.walkThrough).toEqual([]);
  });

  it('depois de sair, o dono NÃO consegue voltar para dentro da bomba', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    step(state, PLACE);
    run(state, 40, { 1: { move: 'right' } });
    run(state, 80, { 1: { move: 'left' } });
    // Encosta na bomba (coluna 3): borda direita da célula é x = 4, então o centro para em 4 + H.
    expect(state.players[0]!.x).toBeCloseTo(4 + H, 6);
  });

  it('pode sair da bomba em qualquer direção, inclusive para trás', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    step(state, PLACE);
    run(state, 40, { 1: { move: 'left' } });
    expect(state.players[0]!.x).toBeLessThan(2);
  });

  it('outro jogador que NÃO estava na célula é barrado pela bomba', () => {
    const state = stateFromText(CORRIDOR, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 7, row: 1 },
    ]);
    step(state, PLACE);
    run(state, 120, { 2: { move: 'left' } });
    expect(state.players[1]!.x).toBeCloseTo(4 + H, 6);
  });

  it('o outro jogador que estava sobre a célula quando a bomba foi colocada também pode sair', () => {
    const state = stateFromText(CORRIDOR, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 3, row: 1 },
    ]);
    step(state, PLACE);
    expect(state.bombs[0]!.walkThrough).toEqual([1, 2]);
    run(state, 40, { 2: { move: 'right' } });
    expect(state.players[1]!.x).toBeGreaterThan(5);
  });

  it('jogador cujo corpo só TOCA a célula (centro na vizinha) também pode sair, sem ficar preso', () => {
    const state = stateFromText(CORRIDOR, [
      { id: 1, col: 3, row: 1 },
      { id: 2, col: 4, row: 1 },
    ]);
    state.players[1]!.x = 4.3; // corpo de 3.9 a 4.7: invade a coluna 3
    step(state, PLACE);
    expect(state.bombs[0]!.walkThrough).toEqual([1, 2]);
    run(state, 40, { 2: { move: 'right' } });
    expect(state.players[1]!.x).toBeGreaterThan(5);
  });

  it('a bomba bloqueia na vertical também (encruzilhada)', () => {
    const state = stateFromText(['#####', '#...#', '#.#.#', '#...#', '#####'], [{ id: 1, col: 1, row: 1 }]);
    step(state, PLACE);
    run(state, 30, { 1: { move: 'right' } }); // sai pela direita
    run(state, 30, { 1: { move: 'down' } });
    run(state, 30, { 1: { move: 'left' } });
    run(state, 30, { 1: { move: 'up' } }); // tenta voltar por baixo da bomba
    // A bomba está em (1,1): o jogador sobe pela coluna 1 e para embaixo dela.
    expect(state.players[0]!.y).toBeCloseTo(2 + H, 6);
  });

  it('bomba colocada no mesmo passo em que o jogador anda fica na célula de ONDE ele estava', () => {
    const state = stateFromText(CORRIDOR, [{ id: 1, col: 3, row: 1 }]);
    step(state, { 1: { move: 'right', placeBomb: true } });
    expect(state.bombs[0]).toMatchObject({ col: 3, row: 1 });
  });

  it('bomba que explode libera a passagem', () => {
    const state = stateFromText(CORRIDOR, [
      { id: 1, col: 1, row: 1 },
      { id: 2, col: 7, row: 1 },
    ]);
    addBomb(state, 4, 1, { range: 1 });
    run(state, 1); // explode; chamas em 3, 4 e 5
    expect(state.bombs).toEqual([]);
    state.flames = []; // chamas apagadas: queremos só a passagem
    run(state, 120, { 2: { move: 'left' } });
    expect(state.players[1]!.x).toBeLessThan(2); // atravessou a célula onde havia a bomba (e o jogador 1 não está no caminho)
  });
});

describe('addBomb (apoio dos testes)', () => {
  it('cria bomba com valores padrão', () => {
    const state = stateFromText(CORRIDOR);
    addBomb(state, 4, 1);
    expect(state.bombs[0]).toMatchObject({ owner: 1, col: 4, row: 1, ticksLeft: 1, range: DEFAULT_BOMB_RANGE });
  });
});
